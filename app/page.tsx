'use client'

import { useState, useEffect } from 'react'

import { supabase } from './lib/supabase'

const PRESETS = [
  {
    key: 'korean', emoji: '🇰🇷', name: '韓劇', desc: '眼神情感，奶油 bokeh',
    json: {
      color_grade: "natural skin tone, soft warm tint, light desaturation, no heavy filter",
      lighting: "diffused natural daylight or soft window light, minimal shadows, clean and bright",
      camera_movement: "subtle handheld or static, occasional slow zoom on face",
      lens: "85mm to 135mm telephoto, very shallow depth of field, creamy bokeh background",
      composition: "subject centered or slightly off-center, emphasis on facial expression and eyes",
      mood: "restrained emotion, quiet intensity, beautiful sadness beneath calm surface",
      aspect_ratio: "9:16",
      style_reference: "Korean drama cinematography, like Queen of Tears or My Mister, emotionally grounded realism"
    }
  },
  {
    key: 'hollywood', emoji: '🎬', name: '荷里活', desc: '高張力，冷藍專業感',
    json: {
      color_grade: "cool desaturated tones, cinematic blue-grey LUT, high contrast shadows",
      lighting: "directional artificial lighting, motivated light sources, layered depth with rim lighting",
      camera_movement: "purposeful tracking shots, steady cam walk-and-talk, occasional wide establishing",
      lens: "24mm to 50mm, moderate depth of field, sharp foreground and background both visible",
      composition: "symmetrical corridors, centered authority figures, environmental storytelling in frame",
      mood: "high stakes tension, institutional power, everyone has an agenda",
      aspect_ratio: "9:16",
      style_reference: "Netflix prestige drama cinematography, cold professional realism, like Designated Survivor or The Crown"
    }
  },
  {
    key: 'thriller', emoji: '😱', name: '驚悚', desc: '黑暗壓迫，霓虹恐懼',
    json: {
      color_grade: "deep shadow crush, cold blue-green tint, heavy vignette, crushed blacks with no lifted shadows",
      lighting: "single motivated light source only — neon, wall lamp or moonlight — face partially lit, rest in darkness",
      camera_movement: "static and oppressive, very slow push in, no handheld shake",
      lens: "50mm, sharp center with heavy vignette edges, subject trapped in frame",
      composition: "subject centered and surrounded by darkness, large negative space filled with black",
      mood: "dread, trapped, something is wrong but undefined, psychological unease",
      aspect_ratio: "9:16",
      style_reference: "European psychological thriller, dark atmospheric horror, like La Casa or Marianne, neon-noir darkness"
    }
  },
  {
    key: 'japanese', emoji: '🎌', name: '日系', desc: '青春自然，夏日紀錄片',
    json: {
      color_grade: "natural slightly overexposed, true-to-life colors, soft summer haze, no heavy grading",
      lighting: "100% natural daylight, outdoor scattered light or direct sun, no artificial fill",
      camera_movement: "observational handheld, documentary feel, camera follows action naturally",
      lens: "35mm to 50mm, medium depth of field, environment and character equally important",
      composition: "unforced framing, subject integrated into environment, imperfect and alive",
      mood: "youth, spontaneity, genuine emotion, beautiful imperfection",
      aspect_ratio: "9:16",
      style_reference: "Japanese live-action film, summer youth drama, naturalistic like Solanin or Tokyo Story"
    }
  },
  {
    key: 'wongkarwai', emoji: '🏙️', name: '香港文藝', desc: '王家衛，橙紅慾望',
    json: {
      color_grade: "heavy warm amber and orange grade, high saturation, film grain, intentional color bleeding, vintage Kodak film look",
      lighting: "neon signs, street lamps, single warm practical lights, strong contrast between lit and unlit areas, no clean fill light",
      camera_movement: "slow motion moments, step-printed frames, sudden handheld intimacy, long static holds",
      lens: "mixed wide and telephoto, deliberate foreground obstruction — shooting through objects, windows, mirrors, curtains",
      composition: "unconventional framing, partial faces, reflections doubling subjects, negative space charged with longing",
      mood: "repressed desire, time dissolving, loneliness in proximity, what cannot be said",
      aspect_ratio: "9:16",
      style_reference: "Wong Kar-wai cinematography, In the Mood for Love, Chungking Express, Christopher Doyle visual language"
    }
  },
  {
    key: 'hkrealist', emoji: '🥢', name: '港式寫實', desc: '彭浩翔，城市日常',
    json: {
      color_grade: "natural cool-neutral tones, slight desaturation, realistic Hong Kong street look, no cinematic grade",
      lighting: "available natural light, fluorescent interior lighting, no dramatic shadows",
      camera_movement: "casual observational handheld, sometimes static, feels accidental and real",
      lens: "50mm standard lens, natural perspective, medium depth of field",
      composition: "characters embedded in real Hong Kong environments — cha chaan teng, alleyways, tiny apartments",
      mood: "urban irony, relationship absurdity, city loneliness disguised as comedy",
      aspect_ratio: "9:16",
      style_reference: "Pang Ho-cheung Hong Kong urban comedy-drama, Isabella, Love in a Puff, naturalistic city realism"
    }
  }
]

interface ShotInput {
  id: string
  number: number
  sceneDesc: string
  shotType: string
  hasDialogue: boolean
  dialogue: string
}

const SHOT_TYPES = [
  'Wide Shot', 'Medium Shot', 'Close-up', 'Extreme Close-up',
  'OTS Shot', 'Insert Shot', 'Reaction Shot', 'Static Shot',
  'Tracking Shot', 'POV Shot'
]

const ASPECT_RATIOS = [
  { key: '9:16', label: '9:16', desc: '直式' },
  { key: '16:9', label: '16:9', desc: '橫式 1920x1080' },
  { key: '2.35:1', label: '2.35:1', desc: '電影闊銀幕' },
] as const


interface Character {
  id: string
  name: string
  description: string
  appearanceJson: string
  imageUrl: string
  loraUrl?: string
}

interface Scene {
  id: string
  name: string
  description: string
  imageUrl: string
}

interface Shot {
  id: string
  number: number
  type: string
  emotion: string
  prompt: string
  camera_setting: string
  sourceInputSignature?: string
  videoProvider?: 'kling' | 'seedance'
  frameApproved?: boolean
  videoUrl?: string
  videoStatus?: 'idle' | 'generating' | 'done' | 'error'
  requestId?: string
  lipSyncUrl?: string
  lipSyncStatus?: 'idle' | 'uploading' | 'generating' | 'done' | 'error'
  lipSyncRequestId?: string
  frameUrl?: string
  frameStatus?: 'idle' | 'generating' | 'done' | 'error'
  usedFrame?: boolean
}

export default function Home() {
  const [shotInputs, setShotInputs] = useState<ShotInput[]>([
    { id: '1', number: 1, sceneDesc: '', shotType: 'Wide Shot', hasDialogue: false, dialogue: '' }
  ])
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0])
  const [customJson, setCustomJson] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [shots, setShots] = useState<Shot[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [fetchingResult, setFetchingResult] = useState<number | null>(null)
  const [savingReferenceId, setSavingReferenceId] = useState<string | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [showScenePicker, setShowScenePicker] = useState(false)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [videoProvider, setVideoProvider] = useState<'kling' | 'seedance'>('kling')
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '2.35:1'>('9:16')

  useEffect(() => {
  loadData()
}, [])

async function loadData() {
  const { data: chars } = await supabase.from('characters').select('*').order('created_at', { ascending: true })
  if (chars) {
    setCharacters(chars.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      appearanceJson: c.appearance_json || '',
      imageUrl: c.image_url || '',
      loraUrl: c.lora_url || '',
    })))
  }

  const { data: sceneData } = await supabase.from('scenes').select('*').order('created_at', { ascending: true })
  if (sceneData) {
    setScenes(sceneData.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      imageUrl: s.image_url || '',
    })))
  }
}

  const activeCharacters = characters.filter(character => selectedCharacterIds.includes(character.id))
  const frameReadyCharacters = activeCharacters.filter(character => character.imageUrl || character.loraUrl)

  function selectPreset(preset: typeof PRESETS[0]) {
    setSelectedPreset(preset)
    setIsCustom(false)
  }

  function getActiveJson() {
    if (isCustom) {
      try { return JSON.parse(customJson) } catch { return selectedPreset.json }
    }
    return selectedPreset.json
  }

  function addShot() {
    setShotInputs(prev => [...prev, {
      id: Date.now().toString(),
      number: prev.length + 1,
      sceneDesc: '',
      shotType: 'Wide Shot',
      hasDialogue: false,
      dialogue: '',
    }])
  }

  function removeShot(id: string) {
    setShotInputs(prev => {
      const filtered = prev.filter(s => s.id !== id)
      return filtered.map((s, i) => ({ ...s, number: i + 1 }))
    })
  }

  function updateShot(id: string, field: keyof ShotInput, value: string | boolean) {
    setShotInputs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function toggleCharacter(id: string) {
    setSelectedCharacterIds(prev => prev.includes(id)
      ? prev.filter(characterId => characterId !== id)
      : [...prev, id]
    )
  }

  function getShotInputSignature(input: ShotInput) {
    return JSON.stringify({
      sceneDesc: input.sceneDesc.trim(),
      shotType: input.shotType,
      hasDialogue: input.hasDialogue,
      dialogue: input.dialogue.trim(),
    })
  }

  function createBaseShotState(inputId: string, inputSignature: string, shot: Shot): Shot {
    return {
      ...shot,
      id: inputId,
      sourceInputSignature: inputSignature,
      videoProvider: 'kling',
      frameStatus: 'idle',
      frameApproved: false,
      videoStatus: 'idle',
      lipSyncStatus: 'idle',
      usedFrame: false,
    }
  }

  async function generatePrompts() {
    const validShots = shotInputs.filter(s => s.sceneDesc.trim())
    if (validShots.length === 0) { setError('請至少填寫一個 Shot 嘅場景描述'); return }
    if (selectedCharacterIds.length === 0) { setError('請至少鎖定一個角色，先開始生成'); return }
    setError('')
    setNotice('')
    setGenerating(true)

    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotInputs: validShots,
          styleJson: getActiveJson(),
          aspectRatio,
          characters: activeCharacters.map(c => ({
            name: c.name,
            description: c.description,
            appearanceJson: c.appearanceJson
          })),
          sceneRef: selectedScene ? { name: selectedScene.name, description: selectedScene.description } : null
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShots(prev => {
        const previousShots = new Map(prev.map(shot => [shot.id, shot]))

        return data.shots.map((generatedShot: Shot, index: number) => {
          const input = validShots[index]
          const inputId = input.id
          const inputSignature = getShotInputSignature(input)
          const existingShot = previousShots.get(inputId)

          if (!existingShot) {
            return createBaseShotState(inputId, inputSignature, generatedShot)
          }

          const inputChanged = existingShot.sourceInputSignature !== inputSignature
          if (inputChanged) {
            return createBaseShotState(inputId, inputSignature, generatedShot)
          }

          return {
            ...existingShot,
            id: inputId,
            number: generatedShot.number,
            type: generatedShot.type,
            emotion: generatedShot.emotion,
            prompt: existingShot.prompt,
            camera_setting: existingShot.camera_setting,
            sourceInputSignature: inputSignature,
          }
        })
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失敗')
    } finally {
      setGenerating(false)
    }
  }

  async function generateVideo(index: number, frameImageUrl?: string) {
  const provider = videoProvider
  setShots(prev => { const n = [...prev]; n[index] = { ...n[index], videoStatus: 'generating', usedFrame: !!frameImageUrl, videoProvider: provider }; return n })
  try {
    const endpoint = frameImageUrl ? '/api/image-to-video' : '/api/generate-video'
    const body = frameImageUrl
      ? { prompt: shots[index].prompt, imageUrl: frameImageUrl, provider }
      : { prompt: shots[index].prompt, provider, aspectRatio }
    const normalizedBody = frameImageUrl
      ? { ...body, aspectRatio }
      : body

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedBody),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], requestId: data.request_id }; return n })
  } catch (err: unknown) {
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], videoStatus: 'error' }; return n })
    setError(err instanceof Error ? err.message : '影片生成失敗')
  }
}

  async function fetchResult(index: number) {
    const shot = shots[index]
    if (!shot.requestId) return
    setFetchingResult(index)
    try {
      const endpoint = shot.usedFrame ? '/api/check-image-video' : '/api/check-video'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: shot.requestId, provider: shot.videoProvider || 'kling' }),
      })
      const data = await res.json()
      if (data.status === 'COMPLETED') {
        const videoUrl = data.output?.video?.url
        setShots(prev => { const n = [...prev]; n[index] = { ...n[index], videoStatus: 'done', videoUrl }; return n })
      } else if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS') {
        setError(`Shot ${shot.number} 仍然生成緊，請等多一陣再查詢`)
      } else {
        setError(`狀態：${data.status || '未知'}，請重試`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '查詢失敗')
    } finally {
      setFetchingResult(null)
    }
  }

  async function handleLipSync(index: number, file: File) {
  setShots(prev => { const n = [...prev]; n[index] = { ...n[index], lipSyncStatus: 'uploading' }; return n })

  try {
    // 上傳音頻
    const formData = new FormData()
    formData.append('file', file)
    const uploadRes = await fetch('/api/upload-audio', {
      method: 'POST',
      body: formData,
    })
    const uploadData = await uploadRes.json()
    if (uploadData.error) throw new Error(uploadData.error)
    const audioUrl = uploadData.url

    // 開始 Lip Sync
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], lipSyncStatus: 'generating' }; return n })

    const lipSyncRes = await fetch('/api/lip-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: shots[index].videoUrl,
        audioUrl,
      }),
    })
    const lipSyncData = await lipSyncRes.json()
    if (lipSyncData.error) throw new Error(lipSyncData.error)

    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], lipSyncRequestId: lipSyncData.request_id }; return n })

  } catch (err: unknown) {
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], lipSyncStatus: 'error' }; return n })
    setError(err instanceof Error ? err.message : 'Lip Sync 失敗')
  }
}

async function fetchLipSyncResult(index: number) {
  const shot = shots[index]
    if (!shot.lipSyncRequestId) return

  try {
    const res = await fetch('/api/check-lip-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: shot.lipSyncRequestId }),
    })
    const data = await res.json()

    if (data.status === 'COMPLETED') {
      const lipSyncUrl = data.output?.video?.url
      setShots(prev => { const n = [...prev]; n[index] = { ...n[index], lipSyncStatus: 'done', lipSyncUrl }; return n })
    } else {
      setError(`Shot ${shot.number} Lip Sync 仍然生成緊，請等多一陣`)
    }
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : '查詢失敗')
  }
}

  async function generateFrame(index: number, character: Character) {
  setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'generating' }; return n })
  try {
    const shot = shots[index]
    const framePrompt = `${shot.type}, ${shot.prompt}, first frame composition`
    
    const res = await fetch('/api/generate-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterImageUrl: character.imageUrl,
        prompt: framePrompt,
        loraUrl: character.loraUrl,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'done', frameUrl: data.frameUrl, frameApproved: false }; return n })
  } catch (err: unknown) {
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'error' }; return n })
    setError(err instanceof Error ? err.message : '生成第一格失敗')
  }
}

  async function generateFrameFromPreviousShot(index: number) {
  const previousShot = shots[index - 1]
  if (!previousShot?.frameUrl) {
    setError('上一個 Shot 仲未有第一格，未能沿用')
    return
  }

  setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'generating' }; return n })
  try {
    const shot = shots[index]
    const framePrompt = `${shot.type}, ${shot.prompt}, first frame composition`

    const res = await fetch('/api/generate-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterImageUrl: previousShot.frameUrl,
        prompt: framePrompt,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'done', frameUrl: data.frameUrl, frameApproved: false }; return n })
  } catch (err: unknown) {
    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], frameStatus: 'error' }; return n })
    setError(err instanceof Error ? err.message : '沿用上一個 Shot 第一格失敗')
  }
}

  function approveFrame(index: number) {
    setShots(prev => {
      const next = [...prev]
      next[index] = { ...next[index], frameApproved: true }
      return next
    })
  }

  async function setCharacterMasterReference(character: Character, frameUrl: string) {
    setSavingReferenceId(character.id)
    setError('')
    setNotice('')

    const { error: updateError } = await supabase
      .from('characters')
      .update({ image_url: frameUrl })
      .eq('id', character.id)

    if (updateError) {
      setSavingReferenceId(null)
      setError(`儲存角色主圖失敗：${updateError.message}`)
      return
    }

    setCharacters(prev =>
      prev.map(item =>
        item.id === character.id
          ? { ...item, imageUrl: frameUrl }
          : item
      )
    )
    setNotice(`已將呢張圖設為 ${character.name} 嘅角色主參考圖`)
    setSavingReferenceId(null)
  }
  
  async function copyPrompt(index: number) {
    await navigator.clipboard.writeText(shots[index].prompt)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  async function copyAll() {
    const all = shots.map(s => `=== Shot ${s.number} · ${s.type} ===\n${s.prompt}`).join('\n\n')
    await navigator.clipboard.writeText(all)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] font-sans">

      <header className="border-b border-[#222] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-serif text-[#e8d5b0] tracking-wide">SOON</span>
          <span className="text-xs text-[#555] tracking-widest uppercase">影片生成器</span>
        </div>
        <nav className="flex gap-2">
          {[
            { label: '💡 題材庫', href: 'https://idea-brainstorm.vercel.app' },
            { label: '📝 劇本', href: 'https://script-generator-xi.vercel.app' },
            { label: '🎬 分鏡', href: 'https://soon-storyboard.vercel.app/storyboard' },
            { label: '👤 角色庫', href: '/characters' },
            { label: '🏠 場景庫', href: '/scenes' },
          ].map(nav => (
            <a key={nav.href} href={nav.href}
              className="px-3 py-1.5 rounded-full text-xs border border-[#222] text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
              {nav.label}
            </a>
          ))}
          <span className="px-3 py-1.5 rounded-full text-xs bg-[#e8d5b0] text-[#0a0a0a] font-bold">🎥 影片生成</span>
        </nav>
      </header>

      <div className="grid grid-cols-[440px_1fr] min-h-[calc(100vh-73px)]">

        {/* LEFT */}
        <div className="border-r border-[#222] p-6 flex flex-col gap-5 overflow-y-auto">

          {/* 場景參考圖 */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">場景參考圖</div>
            {selectedScene ? (
              <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#e8d5b0]/30 rounded-xl p-3">
                <img src={selectedScene.imageUrl} alt={selectedScene.name}
                  className="w-10 h-10 rounded-lg object-cover" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-[#e8d5b0]">{selectedScene.name}</div>
                  <div className="text-[10px] text-[#555]">{selectedScene.description || '場景已設定'}</div>
                </div>
                <button onClick={() => setSelectedScene(null)} className="text-[#555] hover:text-red-400 text-xs">移除</button>
              </div>
            ) : (
              <div className="relative">
                <button onClick={() => setShowScenePicker(!showScenePicker)}
                  className="w-full py-2 border border-dashed border-[#333] rounded-xl text-xs text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
                  🏠 {scenes.length > 0 ? '選擇場景參考圖（可選）' : '先去場景庫新增場景'}
                </button>
                {showScenePicker && scenes.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden z-10">
                    {scenes.map(s => (
                      <button key={s.id} onClick={() => { setSelectedScene(s); setShowScenePicker(false) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#222] transition-all text-left">
                        <img src={s.imageUrl} alt={s.name} className="w-8 h-8 rounded-lg object-cover" />
                        <div className="text-xs font-bold text-[#e8e8e8]">{s.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#555]">角色鎖定</div>
              <span className="text-[10px] text-[#444]">{selectedCharacterIds.length} 個角色</span>
            </div>
            {characters.length === 0 ? (
              <div className="text-xs text-[#555]">請先去角色庫建立角色 reference。</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {characters.map(character => {
                  const selected = selectedCharacterIds.includes(character.id)
                  return (
                    <button
                      key={character.id}
                      onClick={() => toggleCharacter(character.id)}
                      className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                        selected
                          ? 'border-[#e8d5b0] bg-[#e8d5b0]/10 text-[#e8d5b0]'
                          : 'border-[#222] text-[#666] hover:border-[#444] hover:text-[#e8e8e8]'
                      }`}
                    >
                      {character.name}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="text-[10px] text-[#444] mt-3 leading-relaxed">
              建議只鎖定今次場景真正會出現嘅角色，避免 prompt 同 reference 太亂，令人物樣貌漂走。
            </div>
          </div>

          {/* 電影風格 */}
          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">電影風格</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PRESETS.map(preset => (
                <button key={preset.key} onClick={() => selectPreset(preset)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedPreset.key === preset.key && !isCustom
                      ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                      : 'border-[#222] hover:border-[#444]'
                  }`}>
                  <div className="text-base mb-0.5">{preset.emoji}</div>
                  <div className={`text-[10px] font-bold ${selectedPreset.key === preset.key && !isCustom ? 'text-[#e8d5b0]' : 'text-[#e8e8e8]'}`}>
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setIsCustom(!isCustom)}
              className={`w-full py-1.5 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all ${
                isCustom ? 'border-[#e8d5b0] text-[#e8d5b0]' : 'border-[#222] text-[#555] hover:border-[#444]'
              }`}>
              ✏️ 自訂 JSON
            </button>
            {isCustom && (
              <textarea value={customJson} onChange={e => setCustomJson(e.target.value)}
                placeholder={JSON.stringify(selectedPreset.json, null, 2)}
                rows={6}
                className="w-full mt-2 bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-[10px] font-mono text-green-400 outline-none focus:border-[#e8d5b0] transition-colors resize-none"
              />
            )}
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">影片引擎</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setVideoProvider('kling')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  videoProvider === 'kling'
                    ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                    : 'border-[#222] hover:border-[#444]'
                }`}
              >
                <div className={`text-xs font-bold ${videoProvider === 'kling' ? 'text-[#e8d5b0]' : 'text-[#e8e8e8]'}`}>Kling</div>
                <div className="text-[10px] text-[#555] mt-1">目前預設，穩定沿用</div>
              </button>
              <button
                onClick={() => setVideoProvider('seedance')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  videoProvider === 'seedance'
                    ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                    : 'border-[#222] hover:border-[#444]'
                }`}
              >
                <div className={`text-xs font-bold ${videoProvider === 'seedance' ? 'text-[#e8d5b0]' : 'text-[#e8e8e8]'}`}>Seedance</div>
                <div className="text-[10px] text-[#555] mt-1">暫時使用 Seedance 1.5 Pro</div>
              </button>
            </div>
            <div className="text-[10px] text-[#444] mt-3 leading-relaxed">
              只會影響「生成影片」嗰一步；prompt、第一格、角色鎖定同沿用上一個 Shot 第一格流程全部保持不變。
            </div>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">畫面比例</div>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIOS.map(option => (
                <button
                  key={option.key}
                  onClick={() => setAspectRatio(option.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    aspectRatio === option.key
                      ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                      : 'border-[#222] hover:border-[#444]'
                  }`}
                >
                  <div className={`text-xs font-bold ${aspectRatio === option.key ? 'text-[#e8d5b0]' : 'text-[#e8e8e8]'}`}>{option.label}</div>
                  <div className="text-[10px] text-[#555] mt-1">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Shots 輸入 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold tracking-widest uppercase text-[#555]">Shot 列表</div>
              <span className="text-[10px] text-[#444]">{shotInputs.length} 個 Shot</span>
            </div>

            {shotInputs.map((shot) => (
              <div key={shot.id} className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">

                {/* Shot Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#e8d5b0] text-[#0a0a0a] text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      Shot {shot.number}
                    </span>
                    <select
                      value={shot.shotType}
                      onChange={e => updateShot(shot.id, 'shotType', e.target.value)}
                      className="bg-transparent text-[10px] text-[#c0392b] font-bold uppercase tracking-widest outline-none cursor-pointer">
                      {SHOT_TYPES.map(t => <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>)}
                    </select>
                  </div>
                  {shotInputs.length > 1 && (
                    <button onClick={() => removeShot(shot.id)}
                      className="text-[#333] hover:text-red-400 text-xs transition-all">✕</button>
                  )}
                </div>

                {/* Scene Desc */}
                <div className="px-4 pt-3">
                  <textarea
                    value={shot.sceneDesc}
                    onChange={e => updateShot(shot.id, 'sceneDesc', e.target.value)}
                    placeholder="場景描述...（例如：Mia 冷冷地執嘢，阿俊靠牆站）"
                    rows={2}
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-xs text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none placeholder:text-[#333]"
                  />
                </div>

                {/* Dialogue Toggle */}
                <div className="px-4 py-2">
                  <button
                    onClick={() => updateShot(shot.id, 'hasDialogue', !shot.hasDialogue)}
                    className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
                      shot.hasDialogue ? 'text-[#e8d5b0]' : 'text-[#444]'
                    }`}>
                    <div className={`w-3 h-3 rounded-sm border transition-all ${
                      shot.hasDialogue ? 'bg-[#e8d5b0] border-[#e8d5b0]' : 'border-[#333]'
                    }`} />
                    有對白
                  </button>
                </div>

                {/* Dialogue Input */}
                {shot.hasDialogue && (
                  <div className="px-4 pb-3">
                    <textarea
                      value={shot.dialogue}
                      onChange={e => updateShot(shot.id, 'dialogue', e.target.value)}
                      placeholder={`Mia：「我唔想同你一齊瞓...」\n阿俊：「好...如果咁樣你好過啲...」`}
                      rows={3}
                      className="w-full bg-[#0a0a0a] border border-[#e8d5b0]/20 rounded-lg px-3 py-2 text-xs text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none placeholder:text-[#333] font-mono"
                    />
                  </div>
                )}

              </div>
            ))}

            {/* Add Shot */}
            <button onClick={addShot}
              className="w-full py-2.5 border border-dashed border-[#333] rounded-xl text-xs text-[#444] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
              + 新增 Shot
            </button>
          </div>

          {/* Generate Button */}
          <button onClick={generatePrompts} disabled={generating}
            className="w-full py-4 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed sticky bottom-0">
            {generating ? '⏳ Claude 生成中...' : '🎬 生成 Kling Prompts'}
          </button>
        </div>

        {/* RIGHT */}
        <div className="p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-serif text-[#e8d5b0] italic">生成結果</h1>
            {shots.length > 0 && (
              <button onClick={copyAll}
                className="px-4 py-2 rounded-full border border-[#222] text-xs font-bold tracking-widest uppercase text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
                {copiedAll ? '✅ 已複製全部' : '複製全部 Prompts'}
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-5 py-4 text-sm text-red-400 mb-6">
              {error}
              <button onClick={() => setError('')} className="ml-3 underline text-xs">關閉</button>
            </div>
          )}

          {notice && (
            <div className="bg-green-900/20 border border-green-800/40 rounded-xl px-5 py-4 text-sm text-green-400 mb-6">
              {notice}
              <button onClick={() => setNotice('')} className="ml-3 underline text-xs">關閉</button>
            </div>
          )}

          {shots.length === 0 && !generating && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
              <div className="text-5xl opacity-20">🎥</div>
              <div className="text-2xl font-serif text-[#444] italic">準備好開始了</div>
              <div className="text-sm text-[#333] max-w-xs leading-relaxed">
                填寫每個 Shot 嘅場景描述，選擇電影風格，然後生成 Prompts
              </div>
            </div>
          )}

          {shots.length > 0 && (
            <>
              <div className="bg-[#111] border border-[#222] rounded-xl px-6 py-4 mb-6 flex items-center gap-4">
                <span className="text-2xl">{selectedPreset.emoji}</span>
                <div>
                  <div className="text-xs font-bold text-[#e8d5b0] uppercase tracking-widest">{selectedPreset.name} 風格</div>
                  <div className="text-xs text-[#555]">{selectedPreset.desc}</div>
                </div>
                <div className="ml-auto flex gap-6">
                  {[['Mode', '720p'], ['Duration', '5s'], ['Ratio', aspectRatio]].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] text-[#333] font-mono uppercase">{k}</div>
                      <div className="text-sm text-[#e8d5b0] font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111] border border-[#e8d5b0]/20 rounded-xl px-5 py-4 mb-6 text-xs text-[#bbb] leading-relaxed">
                建議流程：先為每個 Shot 生成第一格，確認角色樣貌、服裝同場景都啱，再用該第一格去生成影片。直接文字生片會快，但人物最容易走樣。
              </div>

              <div className="flex flex-col gap-5">
                {shots.map((shot, i) => (
                  <div key={shot.id} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">

                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
                      <div className="flex items-center gap-3">
                        <span className="bg-[#e8d5b0] text-[#0a0a0a] text-xs font-bold px-3 py-1 rounded-full font-mono">Shot {shot.number}</span>
                        <span className="text-xs font-bold text-[#c0392b] uppercase tracking-widest">{shot.type}</span>
                        <span className="text-xs text-[#555] italic">{shot.emotion}</span>
                      </div>
                      <button onClick={() => copyPrompt(i)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                          copied === i ? 'border-green-500 text-green-400' : 'border-[#222] text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0]'
                        }`}>
                        {copied === i ? '✅ 已複製' : '📋 複製'}
                      </button>
                    </div>

                    <div className="px-5 py-4">
                      <p className="font-mono text-xs text-green-400 leading-relaxed">{shot.prompt}</p>
                    </div>

                    <div className="px-5 pb-5 flex flex-col gap-3">
                     {shot.videoStatus === 'idle' && (
  <div className="flex flex-col gap-2">

    {/* 第一格預覽 */}
    {shot.frameUrl && (
      <div className="mb-2">
        <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest mb-1">第一格預覽</div>
        <div className="w-[200px] aspect-[9/16] rounded-xl overflow-hidden mx-auto">
  <img src={shot.frameUrl} alt="frame" className="w-full h-full object-cover" />
</div>
        {activeCharacters.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest">角色主圖</div>
            {activeCharacters.map(character => (
              <button
                key={character.id}
                onClick={() => setCharacterMasterReference(character, shot.frameUrl!)}
                disabled={savingReferenceId === character.id}
                className="w-full py-2 rounded-xl border border-[#333] text-[10px] font-bold tracking-widest uppercase text-[#888] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all disabled:opacity-40"
              >
                {savingReferenceId === character.id
                  ? '⏳ 儲存主圖中...'
                  : `👤 設為 ${character.name} 主參考圖`}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => approveFrame(i)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all ${
              shot.frameApproved
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : 'border border-[#e8d5b0] text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a]'
            }`}
          >
            {shot.frameApproved ? '✅ 已確認第一格' : '確認第一格'}
          </button>
          <button
            onClick={() => {
              setShots(prev => {
                const next = [...prev]
                next[i] = { ...next[i], frameUrl: undefined, frameStatus: 'idle', frameApproved: false }
                return next
              })
            }}
            className="flex-1 py-2 rounded-xl border border-[#333] text-[10px] font-bold tracking-widest uppercase text-[#666] hover:border-[#444] hover:text-[#e8e8e8] transition-all"
          >
            重生第一格
          </button>
        </div>
      </div>
    )}

    {/* 生成第一格 */}
    {frameReadyCharacters.length > 0 && !shot.frameUrl && (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest">Step 1 — 生成第一格</div>
        {i > 0 && shots[i - 1]?.frameUrl && (
          <button
            onClick={() => generateFrameFromPreviousShot(i)}
            disabled={shot.frameStatus === 'generating'}
            className="w-full py-2.5 border border-[#e8d5b0]/40 rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0]/10 transition-all disabled:opacity-40"
          >
            {shot.frameStatus === 'generating' ? '⏳ 沿用上一個 Shot 中...' : `↪️ 沿用 Shot ${i} 第一格`}
          </button>
        )}
        {frameReadyCharacters.map(char => (
          <button key={char.id}
            onClick={() => generateFrame(i, char)}
            disabled={shot.frameStatus === 'generating'}
            className="w-full py-2.5 border border-[#333] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all disabled:opacity-40">
            {shot.frameStatus === 'generating' ? '⏳ 生成第一格中...' : `🖼️ 用 ${char.name} 鎖定第一格`}
          </button>
        ))}
      </div>
    )}

    {activeCharacters.length > 0 && frameReadyCharacters.length === 0 && !shot.frameUrl && (
      <div className="rounded-xl border border-amber-800/40 bg-amber-900/10 px-4 py-3 text-xs text-amber-300 leading-relaxed">
        你已經鎖定角色，但目前冇角色有 reference 圖或 LoRA，所以未能生成第一格。
        請先去角色庫幫該角色上傳圖片，或者先訓練 LoRA。
      </div>
    )}

    {/* 生成影片 */}
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-[#555] font-bold uppercase tracking-widest">Step 2 — 生成影片</div>
      {shot.frameUrl ? (
        <button onClick={() => generateVideo(i, shot.frameUrl)}
          disabled={!shot.frameApproved}
          className="w-full py-3 border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all">
          {shot.frameApproved ? '🎬 用已確認第一格生成影片' : '先確認第一格先可以生成影片'}
        </button>
      ) : (
        <button onClick={() => generateVideo(i)}
          className="w-full py-3 border border-[#222] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
          🎥 直接文字生成（較易走樣）
        </button>
      )}
    </div>

  </div>
)}

                      
                      {shot.videoStatus === 'generating' && (
                        <>
                          <div className="w-full py-3 border border-[#e8d5b0]/30 rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0]/50 text-center animate-pulse">
                            ⏳ {shot.videoProvider === 'seedance' ? 'Seedance' : 'Kling'} 生成中... 約需 3-5 分鐘
                          </div>
                          <button onClick={() => fetchResult(i)} disabled={fetchingResult === i}
                            className="w-full py-3 bg-[#1a1a1a] border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all disabled:opacity-50">
                            {fetchingResult === i ? '🔍 查詢中...' : '🔍 查詢影片結果'}
                          </button>
                          {shot.requestId && (
                            <div className="text-[10px] text-[#333] font-mono text-center">
                              Provider: {shot.videoProvider || 'kling'} · Request ID: {shot.requestId}
                            </div>
                          )}
                        </>
                      )}
                      {shot.videoStatus === 'done' && shot.videoUrl && (
  <div className="space-y-3">
    <video src={shot.lipSyncUrl || shot.videoUrl} controls className="w-full rounded-xl max-h-[500px]" />
    <a href={shot.lipSyncUrl || shot.videoUrl} download target="_blank" rel="noreferrer"
      className="block w-full py-2.5 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase text-center hover:opacity-90 transition-all">
      ⬇️ 下載影片
    </a>

    {/* Lip Sync Section */}
    <div className="border-t border-[#222] pt-3">
      <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">🎤 Lip Sync 配音</div>

      {(!shot.lipSyncStatus || shot.lipSyncStatus === 'idle') && (
        <label className="block w-full py-2.5 border border-dashed border-[#333] rounded-xl text-xs text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all cursor-pointer text-center">
          📁 上傳配音檔案（MP3/WAV）
          <input type="file" accept="audio/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleLipSync(i, file)
            }} />
        </label>
      )}

      {shot.lipSyncStatus === 'uploading' && (
        <div className="w-full py-2.5 border border-[#e8d5b0]/30 rounded-xl text-xs text-[#e8d5b0]/50 text-center animate-pulse">
          ⬆️ 上傳配音中...
        </div>
      )}

      {shot.lipSyncStatus === 'generating' && (
        <>
          <div className="w-full py-2.5 border border-[#e8d5b0]/30 rounded-xl text-xs text-[#e8d5b0]/50 text-center animate-pulse mb-2">
            ⏳ Lip Sync 生成中... 約需 2-3 分鐘
          </div>
          <button onClick={() => fetchLipSyncResult(i)}
            className="w-full py-2.5 bg-[#1a1a1a] border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all">
            🔍 查詢 Lip Sync 結果
          </button>
        </>
      )}

      {shot.lipSyncStatus === 'done' && shot.lipSyncUrl && (
        <div className="text-xs text-green-400 text-center py-2">
          ✅ Lip Sync 完成！影片已更新
        </div>
      )}

      {shot.lipSyncStatus === 'error' && (
        <div className="text-xs text-red-400 text-center py-2">
          Lip Sync 失敗，請重試
        </div>
      )}
    </div>
  </div>
)}
                      {shot.videoStatus === 'error' && (
                        <div className="flex flex-col gap-2">
                          <div className="w-full py-3 border border-red-800/40 rounded-xl text-xs text-red-400 text-center">生成失敗</div>
                          <button onClick={() => generateVideo(i)}
                            className="w-full py-2.5 border border-[#222] rounded-xl text-xs text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">重試</button>
                        </div>
                      )}
                    </div>

                    <div className="px-5 py-3 border-t border-[#222] bg-[#0a0a0a] flex gap-6">
                      {[['Camera', shot.camera_setting], ['Duration', '5s'], ['Ratio', aspectRatio], ['Mode', '720p'], ['Engine', shot.videoProvider || videoProvider]].map(([k, v]) => (
                        <div key={k} className="text-[11px] text-[#333] font-mono">
                          {k}: <span className="text-[#e8d5b0]">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
