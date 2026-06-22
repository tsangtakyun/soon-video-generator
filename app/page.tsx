'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'

type Tier = 'fast' | 'standard'
type OutputFormat = 'ig' | 'youtube'
type InputMode = 'text' | 'grid' | 'reference'
type SegmentStatus = 'idle' | 'submitting' | 'queued' | 'generating' | 'completed' | 'error'

type SegmentState = {
  label: string
  prompt: string
  requestId: string
  endpointId: string
  status: SegmentStatus
  videoUrl: string
  error: string
  referenceUrls: string[]
  referenceNames: string[]
  referencePreviews: string[]
  referenceUploading: boolean
}

type HistorySegment = {
  label: string
  prompt: string
  videoUrl: string
  requestId: string
  endpointId: string
}

type HistoryItem = {
  id: string
  createdAt: string
  tier: Tier
  outputFormat: OutputFormat
  inputMode: InputMode
  fileName: string
  imageUrl: string
  segments: HistorySegment[]
}

type CharacterProfile = {
  id: string
  name: string
  promptLock: string
  assetUrls: string[]
  assetNames: string[]
  createdAt: string
}

const HISTORY_KEY = 'soon-video-generator:recent-runs'
const CHARACTER_LIBRARY_KEY = 'soon-video-generator:character-library'
const MAX_HISTORY = 8
const MAX_CHARACTER_REFERENCES = 9
const SAFE_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_COMPRESSED_DIMENSION = 2048

const OUTPUT_FORMATS: Record<OutputFormat, { label: string; aspectRatio: string; note: string }> = {
  ig: { label: 'IG', aspectRatio: '9:16', note: '直向短片尺寸' },
  youtube: { label: 'YouTube', aspectRatio: '16:9', note: '橫向 YouTube 尺寸' },
}

const STATUS_LABELS: Record<SegmentStatus, string> = {
  idle: '未生成',
  submitting: '提交中',
  queued: '排隊中',
  generating: '生成中',
  completed: '完成',
  error: '失敗',
}

const DEFAULT_CHARACTER_PROMPT_LOCK = [
  '角色鎖定：Eggy',
  '主角是 Eggy，一隻可愛的太陽蛋角色；白色蛋白身體、圓形黃色蛋黃臉、短短幼黑手腳、簡單點狀眼睛、細小嘴巴、表情非常豐富。',
  'Eggy 的喜劇感來自純真、笨拙、誇張反應和默劇式肢體語言；要有明亮黃色角色的親切感，但不要模仿任何現有卡通角色或品牌。',
  '每個鏡頭都保持同一隻 Eggy：同一個蛋白輪廓、同一張蛋黃臉、同一雙幼黑手腳、同一種天真又荒謬的氣質。',
  '畫面可以是電影感 3D 動畫或高質感玩具模型風格，角色表情要清楚，動作要簡潔而有戲劇性。',
].join('\n')

const BUILT_IN_CHARACTER: CharacterProfile = {
  id: 'built-in-eggy',
  name: 'Eggy',
  promptLock: DEFAULT_CHARACTER_PROMPT_LOCK,
  assetUrls: [],
  assetNames: [],
  createdAt: '',
}

const DEFAULT_PROMPTS = [
  [
    'Eggy 覺得很孤單。',
    '他在路邊看見一條香蕉，以為它是朋友。',
    'Eggy 小心翼翼坐在香蕉旁邊，試著跟它聊天。',
    '夕陽很暖，畫面有點荒謬但很溫柔。',
    '可愛喜劇，表情誇張，鏡頭慢慢推近。',
  ].join('\n'),
  [
    'Eggy 發現香蕉其實只是香蕉。',
    '他先呆住，然後戲劇性地倒在地上。',
    '下一秒他又坐起來，假裝自己沒事。',
    '節奏像短片笑位，最後留一個尷尬又可愛的停頓。',
  ].join('\n'),
]

const SAFETY_WRAPPER = [
  '內容安全要求：請使用完全虛構的角色與場景，不要生成真實政治人物、國旗、國歌、政黨標誌、警徽、暴力執法、受傷或煽動性政治畫面。',
  '如果需要群眾、公共空間或衝突感，請改成抽象、非真實地點、低多邊形人物或遠景剪影處理。',
].join('\n')

function createFreshSegments(): SegmentState[] {
  return [0, 1].map(index => ({
    label: `第 ${index + 1} 段`,
    prompt: DEFAULT_PROMPTS[index],
    requestId: '',
    endpointId: '',
    status: 'idle',
    videoUrl: '',
    error: '',
    referenceUrls: [],
    referenceNames: [],
    referencePreviews: [],
    referenceUploading: false,
  }))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-HK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function buildSeedancePrompt(prompt: string, inputMode: InputMode, imageCount: number) {
  const referenceInstruction =
    inputMode === 'reference'
      ? [
          `請使用已上載的 ${imageCount} 張參考圖作為視覺參考。`,
          '如果 prompt 提到 @Image1、@Image2 等，請按對應圖片理解角色、場景、構圖或動作。',
          '不要將所有參考圖硬塞進同一個畫面；請按文字描述選擇最相關的視覺元素。',
        ].join('\n')
      : ''

  return [prompt.trim(), referenceInstruction, SAFETY_WRAPPER].filter(Boolean).join('\n\n')
}

async function compressImageForUpload(file: File) {
  if (file.size <= SAFE_UPLOAD_BYTES) return file

  try {
    const image = await createImageBitmap(file)
    const scale = Math.min(1, MAX_COMPRESSED_DIMENSION / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return file

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    image.close()

    for (const quality of [0.92, 0.86, 0.8]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) continue

      const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      })

      if (compressedFile.size <= SAFE_UPLOAD_BYTES || quality === 0.8) return compressedFile
    }
  } catch {
    return file
  }

  return file
}

export default function Home() {
  const [tier, setTier] = useState<Tier>('fast')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('ig')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadSizeLabel, setUploadSizeLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [segments, setSegments] = useState<SegmentState[]>(createFreshSegments)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [characterLibrary, setCharacterLibrary] = useState<CharacterProfile[]>([BUILT_IN_CHARACTER])
  const [selectedCharacterId, setSelectedCharacterId] = useState(BUILT_IN_CHARACTER.id)
  const [characterName, setCharacterName] = useState('Eggy')
  const [characterPromptLock, setCharacterPromptLock] = useState(DEFAULT_CHARACTER_PROMPT_LOCK)
  const [characterUploading, setCharacterUploading] = useState(false)
  const [characterUploadError, setCharacterUploadError] = useState('')
  const [editingCharacter, setEditingCharacter] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const previewObjectUrl = useRef('')
  const referenceObjectUrls = useRef<string[]>([])
  const pollingTimers = useRef<Array<ReturnType<typeof setTimeout> | null>>([null, null])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('outputFormat') === 'youtube') setOutputFormat('youtube')

    try {
      const saved = window.localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch {
      setHistory([])
    }

    try {
      const savedCharacters = window.localStorage.getItem(CHARACTER_LIBRARY_KEY)
      if (savedCharacters) {
        const parsed = JSON.parse(savedCharacters) as CharacterProfile[]
        const nextLibrary = parsed.length > 0 ? parsed : [BUILT_IN_CHARACTER]
        setCharacterLibrary(nextLibrary)
        setSelectedCharacterId(nextLibrary[0]?.id ?? BUILT_IN_CHARACTER.id)
      }
    } catch {
      setCharacterLibrary([BUILT_IN_CHARACTER])
      setSelectedCharacterId(BUILT_IN_CHARACTER.id)
    }

    return () => {
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
      referenceObjectUrls.current.forEach(url => URL.revokeObjectURL(url))
      pollingTimers.current.forEach(timer => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [])

  const selectedCharacter = useMemo(
    () => characterLibrary.find(character => character.id === selectedCharacterId) ?? characterLibrary[0],
    [characterLibrary, selectedCharacterId]
  )
  const activeSegment = segments[activeSegmentIndex]
  const latestVideoSegment = [...segments].reverse().find(segment => segment.videoUrl) ?? activeSegment
  const currentFormat = OUTPUT_FORMATS[outputFormat]
  const isBusy =
    uploading ||
    segments.some(segment =>
      segment.referenceUploading || ['submitting', 'queued', 'generating'].includes(segment.status)
    )
  const canGenerateActive =
    Boolean(activeSegment?.prompt.trim()) &&
    (inputMode === 'text' ||
      (inputMode === 'grid' && Boolean(imageUrl)) ||
      (inputMode === 'reference' && activeSegment.referenceUrls.length > 0))
  const canGenerateAll =
    segments.every(segment => segment.prompt.trim()) &&
    (inputMode === 'text' ||
      (inputMode === 'grid' && Boolean(imageUrl)) ||
      (inputMode === 'reference' && segments.every(segment => segment.referenceUrls.length > 0)))

  function updateSegment(index: number, patch: Partial<SegmentState>) {
    setSegments(current =>
      current.map((segment, segmentIndex) =>
        segmentIndex === index ? { ...segment, ...patch } : segment
      )
    )
  }

  function persistCharacterLibrary(nextLibrary: CharacterProfile[]) {
    setCharacterLibrary(nextLibrary)
    window.localStorage.setItem(CHARACTER_LIBRARY_KEY, JSON.stringify(nextLibrary))
  }

  function mergeCharacterPrompt(prompt: string, character: CharacterProfile) {
    const markers = [`角色鎖定：${character.name}`, `Character Lock: ${character.name}`]
    if (markers.some(marker => prompt.includes(marker))) return prompt
    return [character.promptLock.trim(), prompt.trim()].filter(Boolean).join('\n\n')
  }

  function applyCharacterToSegment(index: number) {
    if (!selectedCharacter) return
    updateSegment(index, {
      prompt: mergeCharacterPrompt(segments[index]?.prompt ?? '', selectedCharacter),
      error: '',
    })
  }

  function applyCharacterToAll() {
    if (!selectedCharacter) return
    setSegments(current =>
      current.map(segment => ({
        ...segment,
        prompt: mergeCharacterPrompt(segment.prompt, selectedCharacter),
        error: '',
      }))
    )
  }

  async function uploadFileToFal(file: File) {
    const uploadFile = await compressImageForUpload(file)
    const formData = new FormData()
    formData.append('file', uploadFile)

    const response = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()

    if (!response.ok || data.error) throw new Error(data.error || '上載失敗。')
    return { url: data.url as string, uploadedFile: uploadFile }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    setGlobalError('')
    setImageUrl('')
    setFileName(file.name)
    setUploadSizeLabel(formatBytes(file.size))

    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current)
    const localPreviewUrl = URL.createObjectURL(file)
    previewObjectUrl.current = localPreviewUrl
    setPreviewUrl(localPreviewUrl)

    try {
      setUploading(true)
      const { url, uploadedFile } = await uploadFileToFal(file)
      setUploadSizeLabel(
        uploadedFile === file
          ? formatBytes(file.size)
          : `${formatBytes(file.size)} -> ${formatBytes(uploadedFile.size)}`
      )
      setImageUrl(url)
    } catch (error: unknown) {
      setUploadError(error instanceof Error ? error.message : '上載失敗。')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function uploadReferenceFiles(index: number, files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).slice(0, 9)
    if (selectedFiles.length === 0) return

    const previews = selectedFiles.map(file => {
      const url = URL.createObjectURL(file)
      referenceObjectUrls.current.push(url)
      return url
    })

    updateSegment(index, {
      referenceUploading: true,
      referenceUrls: [],
      referenceNames: selectedFiles.map(file => file.name),
      referencePreviews: previews,
      error: '',
    })

    try {
      const urls: string[] = []
      for (const file of selectedFiles) {
        const { url } = await uploadFileToFal(file)
        urls.push(url)
      }

      updateSegment(index, {
        referenceUrls: urls,
        referenceUploading: false,
        error: '',
      })
    } catch (error: unknown) {
      updateSegment(index, {
        referenceUploading: false,
        error: error instanceof Error ? error.message : '參考圖上載失敗。',
      })
    }
  }

  async function createCharacterFromFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).slice(0, MAX_CHARACTER_REFERENCES)
    const trimmedName = characterName.trim() || '未命名角色'
    const trimmedPrompt = characterPromptLock.trim()

    if (!trimmedPrompt) {
      setCharacterUploadError('請先填寫角色描述。')
      return
    }

    setCharacterUploading(true)
    setCharacterUploadError('')

    try {
      const urls: string[] = []
      const names: string[] = []
      for (const file of selectedFiles) {
        const { url } = await uploadFileToFal(file)
        urls.push(url)
        names.push(file.name)
      }

      const character: CharacterProfile = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: trimmedName,
        promptLock: trimmedPrompt,
        assetUrls: urls,
        assetNames: names,
        createdAt: new Date().toISOString(),
      }
      const nextLibrary = [character, ...characterLibrary.filter(item => item.name !== trimmedName)].slice(0, 12)
      persistCharacterLibrary(nextLibrary)
      setSelectedCharacterId(character.id)
      setEditingCharacter(false)
    } catch (error: unknown) {
      setCharacterUploadError(error instanceof Error ? error.message : '角色儲存失敗。')
    } finally {
      setCharacterUploading(false)
    }
  }

  function deleteCharacter(characterId: string) {
    const nextLibrary = characterLibrary.filter(character => character.id !== characterId)
    persistCharacterLibrary(nextLibrary.length > 0 ? nextLibrary : [BUILT_IN_CHARACTER])
    setSelectedCharacterId(nextLibrary[0]?.id ?? BUILT_IN_CHARACTER.id)
  }

  function saveCompletedSegment(index: number, videoUrl: string, requestId: string, endpointId: string) {
    const currentSegment = segments[index]
    if (!currentSegment) return

    const segmentRecord: HistorySegment = {
      label: currentSegment.label,
      prompt: currentSegment.prompt,
      videoUrl,
      requestId,
      endpointId,
    }

    setHistory(currentHistory => {
      const nextRun: HistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
        tier,
        outputFormat,
        inputMode,
        fileName:
          fileName ||
          (inputMode === 'text' ? '純文字生成' : inputMode === 'reference' ? '多圖參考' : '單張分鏡圖'),
        imageUrl,
        segments: [segmentRecord],
      }
      const nextHistory = [nextRun, ...currentHistory].slice(0, MAX_HISTORY)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      return nextHistory
    })
  }

  function restoreHistory(item: HistoryItem) {
    setTier(item.tier)
    setOutputFormat(item.outputFormat ?? 'ig')
    setInputMode(item.inputMode ?? 'text')
    setFileName(item.fileName)
    setImageUrl(item.imageUrl)
    setPreviewUrl('')
    setUploadError('')
    setGlobalError('')
    setActiveSegmentIndex(0)
    setSegments(
      createFreshSegments().map(segment => {
        const saved = item.segments.find(historySegment => historySegment.label === segment.label)
        return saved
          ? {
              ...segment,
              prompt: saved.prompt,
              requestId: saved.requestId,
              endpointId: saved.endpointId,
              status: 'completed',
              videoUrl: saved.videoUrl,
            }
          : segment
      })
    )
  }

  async function submitSegment(index: number) {
    const segment = segments[index]
    if (!segment.prompt.trim()) throw new Error(`請先填寫 ${segment.label} 的 prompt。`)
    if (inputMode === 'grid' && !imageUrl) throw new Error('請先上載一張分鏡圖。')
    if (inputMode === 'reference' && segment.referenceUrls.length === 0) {
      throw new Error(`請先上載 ${segment.label} 的參考圖。`)
    }

    const finalPrompt = buildSeedancePrompt(
      segment.prompt,
      inputMode,
      inputMode === 'reference' ? segment.referenceUrls.length : 0
    )

    updateSegment(index, {
      status: 'submitting',
      requestId: '',
      endpointId: '',
      videoUrl: '',
      error: '',
    })

    const response = await fetch('/api/generate-seedance-segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl,
        imageUrls: segment.referenceUrls,
        prompt: finalPrompt,
        tier,
        outputFormat,
        mode: inputMode,
      }),
    })
    const data = await response.json()

    if (!response.ok || data.error) throw new Error(data.error || '提交生成失敗。')

    updateSegment(index, {
      requestId: data.requestId,
      endpointId: data.endpointId,
      status: 'queued',
    })
    void pollSegment(index, data.requestId, data.endpointId)
  }

  async function generateSingleSegment(index: number) {
    setGlobalError('')
    setActiveSegmentIndex(index)
    try {
      await submitSegment(index)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '生成失敗。'
      updateSegment(index, { status: 'error', error: message })
      setGlobalError(message)
    }
  }

  async function generateBothSegments() {
    setGlobalError('')
    try {
      await submitSegment(0)
      await submitSegment(1)
    } catch (error: unknown) {
      setGlobalError(error instanceof Error ? error.message : '生成兩段失敗。')
    }
  }

  async function pollSegment(index: number, requestId: string, endpointId: string) {
    if (pollingTimers.current[index]) clearTimeout(pollingTimers.current[index]!)

    try {
      const response = await fetch('/api/check-seedance-segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, endpointId }),
      })
      const data = await response.json()

      if (!response.ok || data.error) throw new Error(data.error || '檢查生成狀態失敗。')

      if (data.status === 'COMPLETED') {
        updateSegment(index, {
          status: 'completed',
          videoUrl: data.videoUrl,
          error: '',
        })
        saveCompletedSegment(index, data.videoUrl, requestId, endpointId)
        return
      }

      updateSegment(index, {
        status: data.status === 'IN_QUEUE' ? 'queued' : 'generating',
      })

      pollingTimers.current[index] = setTimeout(() => {
        void pollSegment(index, requestId, endpointId)
      }, 8000)
    } catch (error: unknown) {
      updateSegment(index, {
        status: 'error',
        error: error instanceof Error ? error.message : '檢查生成狀態失敗。',
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0b0d] text-[#f4f4f5]">
      <div className="grid min-h-screen lg:grid-cols-[440px_minmax(0,1fr)]">
        <aside className="border-r border-[#24262d] bg-[#111216]">
          <div className="sticky top-0 max-h-screen overflow-y-auto px-4 py-5">
            <div className="rounded-2xl border border-[#2a2430] bg-[#17151d] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20293a] text-lg font-black text-[#8fb7ff]">
                  S
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold">Seedance 2.0</h1>
                    <span className="rounded-full bg-[#ff3f68] px-2 py-0.5 text-[10px] font-bold text-white">SOON</span>
                  </div>
                  <p className="mt-1 text-xs text-[#989aa3]">多模式輸入，角色庫與短片生成工作台</p>
                </div>
              </div>
            </div>

            <section className="mt-5">
              <div className="mb-2 text-xs font-bold text-[#a5a7b2]">建立方式</div>
              <div className="grid grid-cols-3 rounded-xl border border-[#2a2c33] bg-[#1a1b20] p-1">
                {[
                  { id: 'text', label: '文字' },
                  { id: 'grid', label: '圖片' },
                  { id: 'reference', label: '媒體' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setInputMode(item.id as InputMode)}
                    className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                      inputMode === item.id
                        ? 'bg-gradient-to-r from-[#8b5cf6] to-[#f04da1] text-white'
                        : 'text-[#9da0aa] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            {inputMode === 'grid' && (
              <section className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-bold">分鏡圖</div>
                  {fileName && (
                    <button
                      type="button"
                      onClick={() => {
                        setFileName('')
                        setImageUrl('')
                        setPreviewUrl('')
                      }}
                      className="text-xs font-bold text-[#ff657d]"
                    >
                      清除
                    </button>
                  )}
                </div>
                <label className="block cursor-pointer rounded-xl border border-[#30323a] bg-[#1b1c21] p-3 transition hover:border-[#8b5cf6]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {previewUrl ? (
                    <img src={previewUrl} alt="分鏡圖預覽" className="h-28 w-28 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[#3b3d45] text-sm text-[#a5a7b2]">
                      拖放或點擊上載
                    </div>
                  )}
                </label>
                <div className="mt-2 text-xs text-[#7f828c]">
                  {uploading ? '正在上載...' : imageUrl ? '上載完成，可以生成。' : '支援 JPG / PNG / WebP'}
                  {uploadSizeLabel && ` · ${uploadSizeLabel}`}
                </div>
                {uploadError && (
                  <div className="mt-2 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {uploadError}
                  </div>
                )}
              </section>
            )}

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold">角色庫</div>
                <button
                  type="button"
                  onClick={() => {
                    setCharacterName('')
                    setCharacterPromptLock(DEFAULT_CHARACTER_PROMPT_LOCK)
                    setCharacterUploadError('')
                    setEditingCharacter(true)
                  }}
                  className="rounded-lg border border-[#343741] px-3 py-1.5 text-xs font-bold text-[#d6d7dc] transition hover:border-[#8b5cf6]"
                >
                  新增
                </button>
              </div>
              <div className="rounded-2xl border border-[#2a2c33] bg-[#15161a] p-3">
                <select
                  value={selectedCharacterId}
                  onChange={event => setSelectedCharacterId(event.target.value)}
                  className="w-full rounded-lg border border-[#343741] bg-black px-3 py-2 text-sm outline-none focus:border-[#8b5cf6]"
                >
                  {characterLibrary.map(character => (
                    <option key={character.id} value={character.id}>
                      {character.name}（{character.assetUrls.length} 張參考圖）
                    </option>
                  ))}
                </select>

                {selectedCharacter && (
                  <div className="mt-3">
                    {selectedCharacter.assetUrls.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {selectedCharacter.assetUrls.slice(0, 8).map((url, index) => (
                          <img
                            key={`${selectedCharacter.id}-${url}`}
                            src={url}
                            alt={`${selectedCharacter.name} 參考圖 ${index + 1}`}
                            className="h-16 rounded-lg border border-[#2d3038] object-cover"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#32343c] px-3 py-3 text-xs leading-5 text-[#8d9099]">
                        目前用文字鎖定角色。需要更穩定外形時，可以新增角色參考圖。
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => applyCharacterToSegment(activeSegmentIndex)}
                        className="rounded-lg bg-[#7c5cff] px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
                      >
                        套用到目前段落
                      </button>
                      <button
                        type="button"
                        onClick={applyCharacterToAll}
                        className="rounded-lg border border-[#7c5cff] px-3 py-2 text-xs font-bold text-[#c8bdff] transition hover:bg-[#7c5cff]/10"
                      >
                        套用到全部
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCharacterName(selectedCharacter.name)
                          setCharacterPromptLock(selectedCharacter.promptLock)
                          setCharacterUploadError('')
                          setEditingCharacter(true)
                        }}
                        className="rounded-lg border border-[#343741] px-3 py-2 text-xs font-bold text-[#d6d7dc]"
                      >
                        編輯角色
                      </button>
                      {selectedCharacter.id !== BUILT_IN_CHARACTER.id && (
                        <button
                          type="button"
                          onClick={() => deleteCharacter(selectedCharacter.id)}
                          className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-200"
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {editingCharacter && (
                  <div className="mt-4 space-y-3 border-t border-[#282a31] pt-4">
                    <input
                      value={characterName}
                      onChange={event => setCharacterName(event.target.value)}
                      placeholder="角色名稱"
                      className="w-full rounded-lg border border-[#343741] bg-black px-3 py-2 text-sm outline-none focus:border-[#8b5cf6]"
                    />
                    <textarea
                      value={characterPromptLock}
                      onChange={event => setCharacterPromptLock(event.target.value)}
                      rows={6}
                      className="w-full resize-y rounded-lg border border-[#343741] bg-black px-3 py-2 text-xs leading-5 outline-none focus:border-[#8b5cf6]"
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#343741] bg-black px-4 py-4 text-center text-xs font-bold transition hover:border-[#8b5cf6]">
                      {characterUploading ? '正在儲存角色...' : '上載並儲存角色參考圖（可選，1-9 張）'}
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={event => void createCharacterFromFiles(event.target.files)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void createCharacterFromFiles(null)}
                      disabled={characterUploading}
                      className="w-full rounded-lg border border-[#343741] px-3 py-2 text-xs font-bold text-[#d6d7dc] disabled:opacity-40"
                    >
                      只儲存文字角色
                    </button>
                    {characterUploadError && (
                      <div className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                        {characterUploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold">提示詞</div>
                <div className="flex rounded-lg border border-[#2a2c33] bg-black p-1">
                  {segments.map((segment, index) => (
                    <button
                      key={segment.label}
                      type="button"
                      onClick={() => setActiveSegmentIndex(index)}
                      className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${
                        activeSegmentIndex === index ? 'bg-[#2f3544] text-white' : 'text-[#8d9099]'
                      }`}
                    >
                      {segment.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={activeSegment.prompt}
                onChange={event => updateSegment(activeSegmentIndex, { prompt: event.target.value })}
                rows={8}
                className="w-full resize-y rounded-xl border border-[#30323a] bg-[#111216] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-[#555] focus:border-[#8b5cf6]"
                placeholder="描述角色、動作、場景、鏡頭、情緒..."
              />
              <div className="mt-2 flex items-center justify-between text-xs text-[#7f828c]">
                <span>{activeSegment.prompt.length}/10000</span>
                <button
                  type="button"
                  onClick={() => applyCharacterToSegment(activeSegmentIndex)}
                  className="font-bold text-[#b59cff]"
                >
                  插入角色設定
                </button>
              </div>
            </section>

            {inputMode === 'reference' && (
              <section className="mt-5 rounded-2xl border border-[#2a2c33] bg-[#15161a] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{activeSegment.label} 參考素材</div>
                    <div className="mt-1 text-xs text-[#858894]">最多 9 張，會作為 Seedance 多圖參考。</div>
                  </div>
                  <label className="cursor-pointer rounded-lg border border-[#343741] px-3 py-2 text-xs font-bold transition hover:border-[#8b5cf6]">
                    選擇圖片
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={event => void uploadReferenceFiles(activeSegmentIndex, event.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
                {activeSegment.referencePreviews.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {activeSegment.referencePreviews.map((url, index) => (
                      <div key={`${activeSegment.label}-${url}`} className="rounded-lg border border-[#2d3038] bg-black/40 p-1">
                        <img src={url} alt={`參考圖 ${index + 1}`} className="h-16 w-full rounded object-cover" />
                        <div className="mt-1 truncate text-[10px] text-[#858894]">@Image{index + 1}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#343741] px-3 py-6 text-center text-xs text-[#858894]">
                    未上載參考素材
                  </div>
                )}
                <div className="mt-2 text-xs text-[#858894]">
                  {activeSegment.referenceUploading
                    ? '參考圖上載中...'
                    : `${activeSegment.referenceUrls.length} 張參考圖已就緒`}
                </div>
              </section>
            )}

            <section className="mt-5">
              <div className="grid grid-cols-2 gap-3">
                {(['fast', 'standard'] as Tier[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTier(option)}
                    className={`rounded-xl border p-4 text-left transition ${
                      tier === option
                        ? 'border-[#d7c58a] bg-[#2b2617]'
                        : 'border-[#2d3038] bg-[#15161a] hover:border-[#555b6a]'
                    }`}
                  >
                    <div className="font-bold">{option === 'fast' ? '快速' : '標準'}</div>
                    <div className="mt-1 text-xs text-[#a5a7b2]">約 US${option === 'fast' ? '0.24' : '0.30'} / 秒</div>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {(Object.keys(OUTPUT_FORMATS) as OutputFormat[]).map(format => {
                  const option = OUTPUT_FORMATS[format]
                  return (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setOutputFormat(format)}
                      className={`rounded-xl border p-4 text-left transition ${
                        outputFormat === format
                          ? 'border-[#4fd1a1] bg-[#123429]'
                          : 'border-[#2d3038] bg-[#15161a] hover:border-[#555b6a]'
                      }`}
                    >
                      <div className="font-bold">{option.aspectRatio}</div>
                      <div className="mt-1 text-xs text-[#a5a7b2]">{option.label} · {option.note}</div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#2d3038] bg-[#15161a] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">時長</span>
                  <span className="font-bold text-[#8fb7ff]">15 秒</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#2a2c33]">
                  <div className="h-2 w-full rounded-full bg-[#4f8cff]" />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-bold">解析度</span>
                  <span className="rounded-lg border border-[#4c3569] bg-[#24152d] px-3 py-1.5 font-bold text-[#d8b4fe]">
                    720p
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void generateSingleSegment(activeSegmentIndex)}
                disabled={!canGenerateActive || isBusy}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ffb21a] to-[#ff6b1a] px-4 py-4 text-sm font-black text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                生成目前段落
              </button>
              <button
                type="button"
                onClick={() => void generateBothSegments()}
                disabled={!canGenerateAll || isBusy}
                className="mt-3 w-full rounded-xl border border-[#343741] px-4 py-3 text-sm font-bold text-[#e8e8e8] transition hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-40"
              >
                生成兩段
              </button>
              {globalError && (
                <div className="mt-3 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {globalError}
                </div>
              )}
            </section>
          </div>
        </aside>

        <section className="min-w-0 bg-[#0b0c0f]">
          <div className="border-b border-[#24262d] bg-[#16130f] px-6 py-4">
            <div className="text-sm font-bold text-[#ffd166]">溫馨提示</div>
            <p className="mt-1 text-sm leading-6 text-[#f0c868]">
              一般短片建議使用「標準」角色設定加「文字」模式開始；需要指定外形時，再加入角色參考圖或多圖參考素材。
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24262d] pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-[#7f828c]">SOON Video Workspace</div>
                <h2 className="mt-2 text-2xl font-bold">影片生成工作台</h2>
                <div className="mt-1 text-sm text-[#8d9099]">
                  {currentFormat.label} {currentFormat.aspectRatio} · {tier === 'fast' ? '快速' : '標準'} · {inputMode === 'text' ? '文字' : inputMode === 'grid' ? '圖片' : '媒體'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSegments(createFreshSegments())
                    setActiveSegmentIndex(0)
                    setGlobalError('')
                  }}
                  className="rounded-full border border-[#343741] px-4 py-2 text-sm font-bold text-[#d6d7dc] transition hover:border-[#8b5cf6]"
                >
                  新建
                </button>
                <button
                  type="button"
                  onClick={() => void generateSingleSegment(activeSegmentIndex)}
                  disabled={!canGenerateActive || isBusy}
                  className="rounded-full border border-[#343741] px-4 py-2 text-sm font-bold text-[#d6d7dc] transition hover:border-[#ffb21a] disabled:opacity-40"
                >
                  重新生成
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-bold text-[#a5a7b2]">最近任務（{history.length}）</div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      window.localStorage.removeItem(HISTORY_KEY)
                      setHistory([])
                    }}
                    className="text-xs font-bold text-[#8d9099] hover:text-white"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#30323a] px-4 py-5 text-sm text-[#858894]">
                    尚未有生成紀錄
                  </div>
                ) : (
                  history.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => restoreHistory(item)}
                      className="w-36 shrink-0 rounded-xl border border-[#2d3038] bg-[#15161a] p-2 text-left transition hover:border-[#8b5cf6]"
                    >
                      <div className="line-clamp-2 h-10 text-xs font-bold">{item.fileName}</div>
                      <div className="mt-2 text-[11px] text-[#858894]">{formatDateTime(item.createdAt)}</div>
                      <div className="mt-2 text-[11px] text-[#b59cff]">{item.segments.length} 段影片</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-[#24262d] bg-[#111216] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[#d946ef]">
                      {latestVideoSegment?.status === 'completed' ? '完成' : STATUS_LABELS[activeSegment.status]}
                    </div>
                    <div className="mt-1 text-xs text-[#858894]">
                      {activeSegment.requestId ? `Seed:${activeSegment.requestId.slice(0, 8)}` : '等待生成'}
                    </div>
                  </div>
                  <div className="flex rounded-full border border-[#30323a] bg-black p-1">
                    {segments.map((segment, index) => (
                      <button
                        key={`preview-${segment.label}`}
                        type="button"
                        onClick={() => setActiveSegmentIndex(index)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                          activeSegmentIndex === index ? 'bg-[#7c5cff] text-white' : 'text-[#8d9099]'
                        }`}
                      >
                        {segment.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex min-h-[520px] items-center justify-center rounded-2xl bg-black">
                  {latestVideoSegment?.videoUrl ? (
                    <video
                      src={latestVideoSegment.videoUrl}
                      controls
                      playsInline
                      className="max-h-[74vh] w-full rounded-2xl bg-black object-contain"
                    />
                  ) : previewUrl && inputMode === 'grid' ? (
                    <img src={previewUrl} alt="上載素材預覽" className="max-h-[74vh] w-full rounded-2xl object-contain" />
                  ) : (
                    <div className="px-6 text-center">
                      <div className="text-lg font-bold text-[#d6d7dc]">預覽會顯示喺呢度</div>
                      <p className="mt-2 text-sm leading-6 text-[#858894]">
                        左邊填好 prompt、角色同輸出設定後，按生成目前段落。
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <a
                    href={latestVideoSegment?.videoUrl || undefined}
                    download={latestVideoSegment?.videoUrl ? `${latestVideoSegment.label}.mp4` : undefined}
                    className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${
                      latestVideoSegment?.videoUrl
                        ? 'bg-[#7c5cff] text-white'
                        : 'pointer-events-none bg-[#24262d] text-[#6f727c]'
                    }`}
                  >
                    下載
                  </a>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(activeSegment.prompt)}
                    className="rounded-xl border border-[#30323a] px-4 py-3 text-sm font-bold text-[#d6d7dc] transition hover:border-[#8b5cf6]"
                  >
                    複製 Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateSingleSegment(activeSegmentIndex)}
                    disabled={!canGenerateActive || isBusy}
                    className="rounded-xl border border-[#4c3569] bg-[#24152d] px-4 py-3 text-sm font-bold text-[#d8b4fe] transition hover:border-[#8b5cf6] disabled:opacity-40"
                  >
                    重新生成
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSegmentIndex(activeSegmentIndex === 0 ? 1 : 0)}
                    className="rounded-xl border border-[#35405f] bg-[#141a2e] px-4 py-3 text-sm font-bold text-[#a8c7ff] transition hover:border-[#4f8cff]"
                  >
                    下一段
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {segments.map((segment, index) => (
                  <article
                    key={`task-${segment.label}`}
                    className={`rounded-2xl border p-4 transition ${
                      activeSegmentIndex === index
                        ? 'border-[#7c5cff] bg-[#171420]'
                        : 'border-[#24262d] bg-[#111216]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveSegmentIndex(index)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold">{segment.label}</div>
                          <div className="mt-1 text-xs text-[#858894]">{STATUS_LABELS[segment.status]}</div>
                        </div>
                        <div
                          className={`h-3 w-3 rounded-full ${
                            segment.status === 'completed'
                              ? 'bg-[#4fd1a1]'
                              : segment.status === 'error'
                                ? 'bg-[#ff657d]'
                                : ['submitting', 'queued', 'generating'].includes(segment.status)
                                  ? 'bg-[#ffb21a]'
                                  : 'bg-[#3d4049]'
                          }`}
                        />
                      </div>
                      <p className="mt-3 line-clamp-4 text-xs leading-5 text-[#a5a7b2]">{segment.prompt}</p>
                    </button>
                    {segment.error && (
                      <div className="mt-3 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                        {segment.error}
                      </div>
                    )}
                    {segment.videoUrl && (
                      <a
                        href={segment.videoUrl}
                        download={`${segment.label}.mp4`}
                        className="mt-3 inline-flex rounded-lg border border-[#343741] px-3 py-2 text-xs font-bold text-[#d6d7dc]"
                      >
                        下載影片
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
