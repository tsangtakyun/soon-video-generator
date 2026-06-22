'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'

type Tier = 'fast' | 'standard'
type OutputFormat = 'ig' | 'youtube'
type InputMode = 'grid' | 'reference'
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
const SAFE_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_COMPRESSED_DIMENSION = 2048
const MAX_CHARACTER_REFERENCES = 9

const OUTPUT_FORMATS: Record<OutputFormat, { label: string; aspectRatio: string; note: string }> = {
  ig: {
    label: 'IG',
    aspectRatio: '9:16',
    note: '直向短片尺寸',
  },
  youtube: {
    label: 'YouTube',
    aspectRatio: '16:9',
    note: '橫向 YouTube 尺寸',
  },
}

const DEFAULT_CHARACTER_PROMPT_LOCK = [
  '角色鎖定：Eggy',
  '主角是 Eggy，一隻原創、可愛、圓潤、精力充沛的太陽蛋角色；白色蛋白身體、圓形黃色蛋黃臉、幼黑手腳、簡單圓點眼、細小笑口，帶有輕鬆幽默的香港感。',
  'Eggy 性格天真、貪吃、樂觀、容易驚慌；行動有少少笨拙但很討喜，表情可以誇張，動作可以有兒童動畫式的喜劇節奏。',
  '每個鏡頭都要保持 Eggy 是同一隻非真人卡通蛋角色，不要變成真人、動物、機械人、其他食物或另一個吉祥物。',
  '請以已上載的參考圖作為 Eggy 外形、比例、面部、蛋白輪廓、手腳、表情和性格的準則。',
  'Eggy 可以開心、慌張、得戚、肚餓、驚訝或戲劇化，但必須保持同一個角色的辨識度。',
  '整體感覺必須是原創可愛吉祥物，不要模仿、重現或引用任何現有卡通角色。',
].join('\n')

const BUILT_IN_CHARACTER: CharacterProfile = {
  id: 'built-in-eggy',
  name: 'Eggy',
  promptLock: DEFAULT_CHARACTER_PROMPT_LOCK,
  assetUrls: [],
  assetNames: [],
  createdAt: '',
}

const SEGMENT_DEFAULTS = [
  '我俾文字稿你，我想你發揮最大創意，鏡頭要一直運動，一鏡直落，由第 1 格去到第 8 格；你唔需要錄旁白，只需要音效 / 環境聲：',
  '我俾文字稿你，我想你發揮最大創意，鏡頭要一直運動，一鏡直落，由第 8 格去到最後一格；你唔需要錄旁白，只需要音效 / 環境聲：',
]

const STATUS_LABELS: Record<SegmentStatus, string> = {
  idle: '未生成',
  submitting: '提交中',
  queued: '排隊中',
  generating: '生成中',
  completed: '完成',
  error: '失敗',
}

const SAFETY_WRAPPER = [
  '內容安全要求：請把故事處理成虛構公共事件的抽象影像，不要生成真實政治人物肖像、國旗、國歌、政黨標誌、警徽、暴力執法、拘捕、拖走、受傷或煽動性政治畫面。',
  '如文字稿涉及警察、示威、總統、國歌或選舉衝突，請改寫成「保安人員」「市民群體」「公共大樓」「行政人物剪影」「人群移動」「文件箱」等中性視覺符號。',
  '保持電影感建築模型 / 低多邊形人物風格，以象徵性鏡頭、建築空間、光影、人群站位表達事件，不要直接重現敏感衝突。',
].join('\n')

function createFreshSegments(): SegmentState[] {
  return [0, 1].map(index => ({
    label: `第 ${index + 1} 段`,
    prompt: SEGMENT_DEFAULTS[index],
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

function stripDefaultLead(text: string) {
  let cleaned = text.trim()
  for (const defaultPrompt of SEGMENT_DEFAULTS) {
    if (cleaned.startsWith(defaultPrompt)) {
      cleaned = cleaned.slice(defaultPrompt.length).trim()
    }
  }

  return cleaned
}

function buildSeedancePrompt(prompt: string, index: number, inputMode: InputMode, imageCount: number) {
  const userScript = stripDefaultLead(prompt)
  const segmentLead = SEGMENT_DEFAULTS[index]
  const referenceInstruction =
    inputMode === 'reference'
      ? [
          `請嚴格依照參考素材的順序推進畫面：由 @Image1 開始，按 @Image2、@Image3 一路去到 @Image${imageCount}。`,
          '不要當成拼貼圖；要把它們理解成連續關鍵畫面 / 分鏡節點，用一個流暢鏡頭或自然剪接串起來。',
        ].join('\n')
      : ''

  return [segmentLead, userScript, referenceInstruction, SAFETY_WRAPPER]
    .filter(Boolean)
    .join('\n\n')
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

    const qualities = [0.92, 0.86, 0.8]
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality)
      })
      if (!blob) continue

      const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg',
      })

      if (compressedFile.size <= SAFE_UPLOAD_BYTES || quality === qualities[qualities.length - 1]) {
        return compressedFile
      }
    }
  } catch {
    return file
  }

  return file
}

export default function Home() {
  const [tier, setTier] = useState<Tier>('fast')
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('ig')
  const [inputMode, setInputMode] = useState<InputMode>('grid')
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadSizeLabel, setUploadSizeLabel] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [segments, setSegments] = useState<SegmentState[]>(createFreshSegments)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [characterLibrary, setCharacterLibrary] = useState<CharacterProfile[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState('')
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
        if (nextLibrary[0]) setSelectedCharacterId(nextLibrary[0].id)
      } else {
        setCharacterLibrary([BUILT_IN_CHARACTER])
        setSelectedCharacterId(BUILT_IN_CHARACTER.id)
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

  function getSelectedCharacter() {
    return characterLibrary.find(character => character.id === selectedCharacterId) ?? characterLibrary[0]
  }

  function mergeCharacterPrompt(prompt: string, character: CharacterProfile) {
    const markers = [`角色鎖定：${character.name}`, `Character Lock: ${character.name}`]
    if (markers.some(marker => prompt.includes(marker))) return prompt
    return [prompt.trim(), character.promptLock.trim()].filter(Boolean).join('\n\n')
  }

  function applyCharacterToSegment(character: CharacterProfile, index: number) {
    updateSegment(index, {
      prompt: mergeCharacterPrompt(segments[index]?.prompt ?? '', character),
      referenceUploading: false,
      error: '',
    })
  }

  function applyCharacterToAll(character: CharacterProfile) {
    setSegments(current =>
      current.map(segment => ({
        ...segment,
        prompt: mergeCharacterPrompt(segment.prompt, character),
        referenceUploading: false,
        error: '',
      }))
    )
  }

  async function createCharacterFromFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).slice(0, MAX_CHARACTER_REFERENCES)
    const trimmedName = characterName.trim() || '未命名角色'
    const trimmedPrompt = characterPromptLock.trim()

    if (selectedFiles.length === 0) {
      setCharacterUploadError('請先選擇 1-9 張角色參考圖。')
      return
    }

    if (!trimmedPrompt) {
      setCharacterUploadError('請先填好角色鎖定提示。')
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
      const nextLibrary = [character, ...characterLibrary].slice(0, 12)
      persistCharacterLibrary(nextLibrary)
      setSelectedCharacterId(character.id)
      applyCharacterToAll(character)
      setEditingCharacter(false)
    } catch (error: unknown) {
      setCharacterUploadError(error instanceof Error ? error.message : '角色參考圖上載失敗。')
    } finally {
      setCharacterUploading(false)
    }
  }

  function deleteCharacter(characterId: string) {
    const nextLibrary = characterLibrary.filter(character => character.id !== characterId)
    persistCharacterLibrary(nextLibrary)
    setSelectedCharacterId(nextLibrary[0]?.id ?? '')
  }

  function editSelectedCharacter(character: CharacterProfile) {
    setCharacterName(character.name)
    setCharacterPromptLock(character.promptLock)
    setCharacterUploadError('')
    setEditingCharacter(true)
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
      const existingRun = currentHistory.find(
        item =>
          item.imageUrl === imageUrl &&
          item.fileName === fileName &&
          item.tier === tier &&
          (item.outputFormat ?? 'ig') === outputFormat &&
          (item.inputMode ?? 'grid') === inputMode
      )
      const nextRun: HistoryItem = existingRun
        ? {
            ...existingRun,
            createdAt: new Date().toISOString(),
            segments: [
              ...existingRun.segments.filter(segment => segment.label !== segmentRecord.label),
              segmentRecord,
            ],
          }
        : {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            createdAt: new Date().toISOString(),
            tier,
            outputFormat,
            inputMode,
            fileName: fileName || (inputMode === 'reference' ? '參考素材' : '分鏡圖'),
            imageUrl,
            segments: [segmentRecord],
          }

      const withoutExisting = currentHistory.filter(item => item.id !== nextRun.id)
      const nextHistory = [nextRun, ...withoutExisting].slice(0, MAX_HISTORY)
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      return nextHistory
    })
  }

  function restoreHistory(item: HistoryItem) {
    setTier(item.tier)
    setOutputFormat(item.outputFormat ?? 'ig')
    setInputMode(item.inputMode ?? 'grid')
    setFileName(item.fileName)
    setImageUrl(item.imageUrl)
    setPreviewUrl('')
    setUploadError('')
    setGlobalError('')
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

  function clearHistory() {
    window.localStorage.removeItem(HISTORY_KEY)
    setHistory([])
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

    if (!response.ok || data.error) {
      throw new Error(data.error || '上載失敗。')
    }

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
    setSegments(createFreshSegments())

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
    }
  }

  async function uploadReferenceFiles(index: number, files: FileList | null) {
    const selectedFiles = Array.from(files ?? []).slice(0, 9)
    if (selectedFiles.length === 0) return

    updateSegment(index, {
      referenceUploading: true,
      referenceUrls: [],
      referenceNames: selectedFiles.map(file => file.name),
      referencePreviews: selectedFiles.map(file => {
        const url = URL.createObjectURL(file)
        referenceObjectUrls.current.push(url)
        return url
      }),
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

  async function submitSegment(index: number) {
    if (inputMode === 'grid' && !imageUrl) {
      throw new Error('請先上載分鏡圖。')
    }

    const segment = segments[index]
    if (inputMode === 'reference' && segment.referenceUrls.length === 0) {
      throw new Error(`請先上載 ${segment.label} 的參考圖。`)
    }

    const finalPrompt = buildSeedancePrompt(
      segment.prompt,
      index,
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

    if (!response.ok || data.error) {
      throw new Error(data.error || '提交生成失敗。')
    }

    updateSegment(index, {
      requestId: data.requestId,
      endpointId: data.endpointId,
      status: 'queued',
    })

    pollSegment(index, data.requestId, data.endpointId)
  }

  async function generateSingleSegment(index: number) {
    setGlobalError('')
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

      if (!response.ok || data.error) {
        throw new Error(data.error || '檢查生成狀態失敗。')
      }

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
        pollSegment(index, requestId, endpointId)
      }, 8000)
    } catch (error: unknown) {
      updateSegment(index, {
        status: 'error',
        error: error instanceof Error ? error.message : '檢查生成狀態失敗。',
      })
    }
  }

  const isBusy =
    uploading ||
    segments.some(segment =>
      segment.referenceUploading || ['submitting', 'queued', 'generating'].includes(segment.status)
    )
  const canGenerate =
    inputMode === 'grid'
      ? Boolean(imageUrl)
      : segments.every(segment => segment.referenceUrls.length > 0)
  const currentFormat = OUTPUT_FORMATS[outputFormat]
  const selectedCharacter = getSelectedCharacter()

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8">
        <header className="border-b border-[#222] pb-6">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-[#777]">
            SOON 影片生成
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            影片生成（Seedance 2.0）
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#aaa]">
            上載分鏡圖或每段參考素材，兩段分別送去 Seedance。固定輸出 {currentFormat.aspectRatio}、720p，並保留 Seedance 自帶環境聲。
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-[#222] bg-[#111] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">最近紀錄</h2>
              <p className="mt-1 text-xs text-[#777]">
                完成生成後會自動保留最近 {MAX_HISTORY} 次紀錄，下載連結可由呢度載入。
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold text-[#aaa] transition hover:border-red-400 hover:text-red-200"
              >
                清除紀錄
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[#333] bg-[#0c0c0c] px-4 py-5 text-sm text-[#888]">
              暫時未有紀錄。下一次影片完成後，下載連結會出現在這裡。
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {history.map(item => (
                <article key={item.id} className="rounded-xl border border-[#252525] bg-[#0c0c0c] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{item.fileName}</div>
                      <div className="mt-1 text-xs text-[#777]">
                        {formatDateTime(item.createdAt)} · {OUTPUT_FORMATS[item.outputFormat ?? 'ig'].label} {OUTPUT_FORMATS[item.outputFormat ?? 'ig'].aspectRatio} · {item.tier === 'fast' ? '快速' : '標準'} · {item.segments.length} 段
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreHistory(item)}
                      className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]"
                    >
                      載入
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.segments.map(segment => (
                      <a
                        key={`${item.id}-${segment.label}`}
                        href={segment.videoUrl}
                        download={`${segment.label.toLowerCase().replace(' ', '-')}.mp4`}
                        className="rounded-lg bg-[#e8d5b0] px-3 py-2 text-xs font-bold text-[#0a0a0a] transition hover:opacity-90"
                      >
                        下載 {segment.label}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-[#222] bg-[#111] p-5">
            <h2 className="text-base font-bold">設定</h2>

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#777]">
                輸出格式
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(OUTPUT_FORMATS) as OutputFormat[]).map(format => {
                  const option = OUTPUT_FORMATS[format]
                  const active = outputFormat === format
                  return (
                    <button
                      key={format}
                      type="button"
                      onClick={() => setOutputFormat(format)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-[#7c5cfc] bg-[#7c5cfc]/20'
                          : 'border-[#2a2a2a] bg-[#0c0c0c] hover:border-[#555]'
                      }`}
                    >
                      <div className="font-bold">{option.label}</div>
                      <div className="mt-1 text-xs text-[#aaa]">{option.aspectRatio}</div>
                      <div className="mt-1 text-xs text-[#777]">{option.note}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#777]">
                生成速度
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['fast', 'standard'] as Tier[]).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTier(option)}
                    className={`rounded-xl border p-4 text-left transition ${
                      tier === option
                        ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                        : 'border-[#2a2a2a] bg-[#0c0c0c] hover:border-[#555]'
                    }`}
                  >
                    <div className="font-bold">{option === 'fast' ? '快速' : '標準'}</div>
                    <div className="mt-1 text-xs text-[#aaa]">
                      約 US${option === 'fast' ? '0.24' : '0.30'} / 秒
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#777]">
                輸入模式
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setInputMode('grid')}
                  className={`rounded-xl border p-4 text-left transition ${
                    inputMode === 'grid'
                      ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                      : 'border-[#2a2a2a] bg-[#0c0c0c] hover:border-[#555]'
                  }`}
                >
                  <div className="font-bold">單張分鏡圖</div>
                  <div className="mt-1 text-xs text-[#aaa]">上載一張 15 格參考圖</div>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('reference')}
                  className={`rounded-xl border p-4 text-left transition ${
                    inputMode === 'reference'
                      ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                      : 'border-[#2a2a2a] bg-[#0c0c0c] hover:border-[#555]'
                  }`}
                >
                  <div className="font-bold">多圖參考</div>
                  <div className="mt-1 text-xs text-[#aaa]">每段最多 9 張，建議 1-8 / 8-15</div>
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[#252525] bg-[#0c0c0c] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">角色庫</div>
                  <div className="mt-1 text-xs text-[#777]">
                    先把角色參考圖上載到 fal.ai，之後可重複套用到 Seedance 多圖參考影片。
                  </div>
                </div>
                {selectedCharacter && (
                  <button
                    type="button"
                    onClick={() => applyCharacterToAll(selectedCharacter)}
                    className="rounded-lg bg-[#7c5cfc] px-3 py-2 text-xs font-bold text-white transition hover:opacity-90"
                  >
                    套用文字到全部
                  </button>
                )}
              </div>

              {characterLibrary.length > 0 && (
                <div className="mt-4 space-y-3">
                  <select
                    value={selectedCharacterId}
                    onChange={event => setSelectedCharacterId(event.target.value)}
                    className="w-full rounded-lg border border-[#333] bg-black px-3 py-2 text-sm outline-none transition focus:border-[#e8d5b0]"
                  >
                    {characterLibrary.map(character => (
                      <option key={character.id} value={character.id}>
                        {character.name}（{character.assetUrls.length} 張參考圖）
                      </option>
                    ))}
                  </select>

                  {selectedCharacter && (
                    <div className="rounded-xl border border-[#222] bg-black/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold">{selectedCharacter.name}</div>
                          <div className="mt-1 text-xs text-[#777]">
                            {selectedCharacter.assetUrls.length > 0
                              ? `${selectedCharacter.assetUrls.length} 張角色參考圖，會留在角色庫作身份設定；套用時只會加入角色鎖定文字。`
                              : '未有參考圖；套用時會先把角色鎖定文字加入 prompt。'}
                          </div>
                        </div>
                        {selectedCharacter.id !== BUILT_IN_CHARACTER.id && (
                          <button
                            type="button"
                            onClick={() => deleteCharacter(selectedCharacter.id)}
                            className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/10"
                          >
                            刪除
                          </button>
                        )}
                      </div>

                      {selectedCharacter.assetUrls.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {selectedCharacter.assetUrls.slice(0, 6).map((url, imageIndex) => (
                            <img
                              key={`${selectedCharacter.id}-${url}`}
                              src={url}
                              alt={`${selectedCharacter.name} 參考圖 ${imageIndex + 1}`}
                              className="h-20 w-full rounded-lg border border-[#222] object-cover"
                            />
                          ))}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {segments.map((segment, index) => (
                          <button
                            key={`${selectedCharacter.id}-${segment.label}`}
                            type="button"
                            onClick={() => applyCharacterToSegment(selectedCharacter, index)}
                            className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]"
                          >
                            套用文字到第 {index + 1} 段
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => applyCharacterToAll(selectedCharacter)}
                          className="rounded-lg border border-[#7c5cfc] px-3 py-2 text-xs font-bold text-[#b8a8ff] transition hover:bg-[#7c5cfc]/10"
                        >
                          套用文字到全部
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-[#222] pt-4">
                <div className="flex flex-wrap gap-2">
                  {selectedCharacter && (
                    <button
                      type="button"
                      onClick={() => editSelectedCharacter(selectedCharacter)}
                      className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]"
                    >
                      編輯角色
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCharacterName('')
                      setCharacterPromptLock(DEFAULT_CHARACTER_PROMPT_LOCK)
                      setCharacterUploadError('')
                      setEditingCharacter(true)
                    }}
                    className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]"
                  >
                    新增角色
                  </button>
                </div>

                {editingCharacter && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[#222] bg-black/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-[#888]">建立／編輯角色</div>
                        <div className="mt-1 text-xs leading-5 text-[#666]">
                          平時只需要在上面揀角色再套用；只有建立新角色，或想補充角色參考圖時，先進入這裡。
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingCharacter(false)}
                        className="rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]"
                      >
                        收起
                      </button>
                    </div>
                    <input
                      value={characterName}
                      onChange={event => setCharacterName(event.target.value)}
                      placeholder="角色名稱"
                      className="w-full rounded-lg border border-[#333] bg-black px-3 py-2 text-sm outline-none transition placeholder:text-[#555] focus:border-[#e8d5b0]"
                    />
                    <textarea
                      value={characterPromptLock}
                      onChange={event => setCharacterPromptLock(event.target.value)}
                      rows={5}
                      className="w-full resize-y rounded-lg border border-[#333] bg-black px-3 py-2 text-xs leading-5 outline-none transition placeholder:text-[#555] focus:border-[#e8d5b0]"
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#333] bg-black px-4 py-4 text-center text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]">
                      {characterUploading ? '上載角色中...' : '上載並儲存角色參考圖（1-9 張）'}
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={event => void createCharacterFromFiles(event.target.files)}
                        className="hidden"
                      />
                    </label>
                    {characterUploadError && (
                      <div className="whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                        {characterUploadError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {inputMode === 'grid' && (
              <div className="mt-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#777]">
                  分鏡圖
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#333] bg-[#0c0c0c] px-4 py-8 text-center transition hover:border-[#e8d5b0]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-sm font-bold">上載 15 格分鏡圖</span>
                  <span className="mt-2 text-xs text-[#777]">JPEG / PNG / WebP，最多 30MB</span>
                </label>

                {fileName && (
                  <div className="mt-4 rounded-xl border border-[#252525] bg-[#0c0c0c] p-3">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                      alt="分鏡圖預覽"
                        className="mb-3 max-h-72 w-full rounded-lg object-contain"
                      />
                    )}
                    <div className="text-sm font-semibold">{fileName}</div>
                    <div className="mt-1 text-xs text-[#777]">
                      {uploading ? '正在上載...' : imageUrl ? '上載完成，可以生成。' : '等待上載完成'}
                    </div>
                    {uploadSizeLabel && (
                      <div className="mt-1 text-xs text-[#666]">上載大小：{uploadSizeLabel}</div>
                    )}
                  </div>
                )}

                {uploadError && (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {uploadError}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={generateBothSegments}
              disabled={!canGenerate || uploading || isBusy}
              className="mt-6 w-full rounded-xl bg-[#e8d5b0] px-4 py-4 text-sm font-bold text-[#0a0a0a] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              生成兩段
            </button>

            {globalError && (
              <div className="mt-3 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {globalError}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {segments.map((segment, index) => (
              <section key={segment.label} className="rounded-2xl border border-[#222] bg-[#111] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{segment.label}</h2>
                    <div className="mt-1 text-xs text-[#777]">
                      狀態：{STATUS_LABELS[segment.status]}
                      {segment.requestId && ` · 請求 ${segment.requestId.slice(0, 8)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => generateSingleSegment(index)}
                    disabled={
                      uploading ||
                      segment.referenceUploading ||
                      (inputMode === 'grid' ? !imageUrl : segment.referenceUrls.length === 0) ||
                      ['submitting', 'queued', 'generating'].includes(segment.status)
                    }
                    className="rounded-lg border border-[#333] px-4 py-2 text-sm font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    生成
                  </button>
                </div>

                {inputMode === 'reference' && (
                  <div className="mt-4 rounded-xl border border-[#252525] bg-[#0c0c0c] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">
                          {index === 0 ? '上載第 1-8 格參考素材' : '上載第 8-15 格參考素材'}
                        </div>
                        <div className="mt-1 text-xs text-[#777]">
                          最多 9 張，生成時會用 @Image1、@Image2... 作為參考圖。
                        </div>
                      </div>
                      <label className="cursor-pointer rounded-lg border border-[#333] px-3 py-2 text-xs font-bold transition hover:border-[#e8d5b0] hover:text-[#e8d5b0]">
                        選擇圖片
                        <input
                          type="file"
                          multiple
                          accept="image/jpeg,image/png,image/webp"
                          onChange={event => void uploadReferenceFiles(index, event.target.files)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {segment.referencePreviews.length > 0 && (
                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {segment.referencePreviews.map((url, imageIndex) => (
                          <div key={`${segment.label}-ref-${url}`} className="rounded-lg border border-[#222] bg-black/40 p-2">
                            <img
                              src={url}
                              alt={`參考圖 ${imageIndex + 1}`}
                              className="h-24 w-full rounded object-cover"
                            />
                            <div className="mt-1 truncate text-[11px] text-[#777]">
                              @{`Image${imageIndex + 1}`} · {segment.referenceNames[imageIndex] ?? ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 text-xs text-[#777]">
                      {segment.referenceUploading
                        ? '參考圖上載中...'
                        : segment.referenceUrls.length > 0
                          ? `${segment.referenceUrls.length} 張參考圖已上載`
                          : '等待上載參考圖'}
                    </div>
                  </div>
                )}

                <textarea
                  value={segment.prompt}
                  onChange={event => updateSegment(index, { prompt: event.target.value })}
                  rows={7}
                  className="mt-4 w-full resize-y rounded-xl border border-[#2a2a2a] bg-[#0c0c0c] px-4 py-3 text-sm leading-6 text-[#e8e8e8] outline-none transition placeholder:text-[#555] focus:border-[#e8d5b0]"
                />

                {segment.endpointId && (
                  <div className="mt-2 text-xs text-[#666]">生成端點：{segment.endpointId}</div>
                )}

                {segment.error && (
                  <div className="mt-3 whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {segment.error}
                  </div>
                )}

                {segment.videoUrl && (
                  <div className="mt-4 rounded-xl border border-[#252525] bg-[#0c0c0c] p-3">
                    <video
                      src={segment.videoUrl}
                      controls
                      playsInline
                      className="max-h-[520px] w-full rounded-lg bg-black"
                    />
                    <a
                      href={segment.videoUrl}
                      download={`${segment.label.toLowerCase().replace(' ', '-')}.mp4`}
                      className="mt-3 inline-flex rounded-lg bg-[#e8d5b0] px-4 py-2 text-sm font-bold text-[#0a0a0a] transition hover:opacity-90"
                    >
                      下載影片
                    </a>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
