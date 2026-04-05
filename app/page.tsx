'use client'

import { useState, useEffect } from 'react'

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

interface Character {
  id: string
  name: string
  description: string
  imageUrl: string
}

interface Scene {
  id: string
  name: string
  description: string
  imageUrl: string
}

interface Shot {
  number: number
  type: string
  emotion: string
  prompt: string
  camera_setting: string
  videoUrl?: string
  videoStatus?: 'idle' | 'generating' | 'done' | 'error'
  requestId?: string
  characterId?: string
}

export default function Home() {
  const [scene, setScene] = useState('')
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0])
  const [customJson, setCustomJson] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [shotCount, setShotCount] = useState(6)
  const [shots, setShots] = useState<Shot[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [fetchingResult, setFetchingResult] = useState<number | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [showCharPicker, setShowCharPicker] = useState<number | null>(null)

  const [scenes, setScenes] = useState<Scene[]>([])
const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
const [showScenePicker, setShowScenePicker] = useState(false)

useEffect(() => {
  const savedChars = localStorage.getItem('soon_characters')
  if (savedChars) setCharacters(JSON.parse(savedChars))
  const savedScenes = localStorage.getItem('soon_scenes')
  if (savedScenes) setScenes(JSON.parse(savedScenes))
}, [])

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

  function assignCharacter(shotIndex: number, charId: string) {
    setShots(prev => {
      const n = [...prev]
      n[shotIndex] = { ...n[shotIndex], characterId: charId }
      return n
    })
    setShowCharPicker(null)
  }

  function removeCharacter(shotIndex: number) {
    setShots(prev => {
      const n = [...prev]
      n[shotIndex] = { ...n[shotIndex], characterId: undefined }
      return n
    })
  }

  async function generatePrompts() {
    if (!scene) { setError('請輸入場景描述'); return }
    setError('')
    setGenerating(true)
    setShots([])
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
  scene, 
  styleJson: getActiveJson(), 
  shotCount,
  characters: characters.map(c => ({ name: c.name, description: c.description }))
}),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShots(data.shots.map((s: Shot) => ({ ...s, videoStatus: 'idle' })))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失敗')
    } finally {
      setGenerating(false)
    }
  }

  async function generateVideo(index: number) {
    const shot = shots[index]
    const character = characters.find(c => c.id === shot.characterId)

    setShots(prev => { const n = [...prev]; n[index] = { ...n[index], videoStatus: 'generating' }; return n })

    try {
      const endpoint = character ? '/api/image-to-video' : '/api/generate-video'
      const body = character
        ? { prompt: shot.prompt, imageUrl: character.imageUrl }
        : { prompt: shot.prompt }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    const character = characters.find(c => c.id === shot.characterId)
    const endpoint = character ? '/api/check-image-video' : '/api/check-video'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: shot.requestId }),
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

      <div className="grid grid-cols-[400px_1fr] min-h-[calc(100vh-73px)]">

        {/* LEFT */}
        <div className="border-r border-[#222] p-8 flex flex-col gap-6 overflow-y-auto">

          {/* Scene Picker */}
<div className="bg-[#111] border border-[#222] rounded-xl p-5">
  <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">場景參考圖</div>
  {selectedScene ? (
    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#e8d5b0]/30 rounded-xl p-3">
      <img src={selectedScene.imageUrl} alt={selectedScene.name}
        className="w-12 h-12 rounded-lg object-cover border border-[#e8d5b0]/30" />
      <div className="flex-1">
        <div className="text-xs font-bold text-[#e8d5b0]">{selectedScene.name}</div>
        <div className="text-[10px] text-[#555]">{selectedScene.description || '場景參考已設定'}</div>
      </div>
      <button onClick={() => setSelectedScene(null)}
        className="text-[#555] hover:text-red-400 text-xs transition-all">移除</button>
    </div>
  ) : (
    <div className="relative">
      <button onClick={() => setShowScenePicker(!showScenePicker)}
        className="w-full py-2.5 border border-dashed border-[#333] rounded-xl text-xs text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
        🏠 {scenes.length > 0 ? '選擇場景參考圖（可選）' : '先去場景庫新增場景'}
      </button>
      {showScenePicker && scenes.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden z-10">
          {scenes.map(scene => (
            <button key={scene.id}
              onClick={() => { setSelectedScene(scene); setShowScenePicker(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#222] transition-all text-left">
              <img src={scene.imageUrl} alt={scene.name}
                className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <div className="text-xs font-bold text-[#e8e8e8]">{scene.name}</div>
                <div className="text-[10px] text-[#555]">{scene.description || '冇描述'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )}
  <a href="/scenes" className="block text-center text-[10px] text-[#444] hover:text-[#e8d5b0] mt-2 transition-all">
    管理場景庫 →
  </a>
</div>
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">場景描述</div>
            <textarea value={scene} onChange={e => setScene(e.target.value)}
              placeholder="例如：臥室前，夜晚。Mia 冷冷地執嘢，阿俊靠牆站，唔敢出聲..."
              rows={5}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none leading-relaxed placeholder:text-[#333]"
            />
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-4">電影風格</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESETS.map(preset => (
                <button key={preset.key} onClick={() => selectPreset(preset)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedPreset.key === preset.key && !isCustom
                      ? 'border-[#e8d5b0] bg-[#e8d5b0]/10'
                      : 'border-[#222] hover:border-[#444]'
                  }`}>
                  <div className="text-lg mb-1">{preset.emoji}</div>
                  <div className={`text-xs font-bold ${selectedPreset.key === preset.key && !isCustom ? 'text-[#e8d5b0]' : 'text-[#e8e8e8]'}`}>
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-[#555] mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>

            {!isCustom && (
              <div className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 mb-3">
                <div className="text-[10px] text-[#555] font-mono mb-2 uppercase tracking-widest">
                  {selectedPreset.emoji} {selectedPreset.name} — 風格參數
                </div>
                <div className="text-[10px] font-mono text-green-500 leading-relaxed space-y-0.5">
                  {Object.entries(selectedPreset.json).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-[#555]">"{k}":</span>{' '}
                      <span className="text-green-400">"{v}"</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setIsCustom(!isCustom)}
              className={`w-full py-2 rounded-lg border text-xs font-bold tracking-widest uppercase transition-all ${
                isCustom ? 'border-[#e8d5b0] text-[#e8d5b0]' : 'border-[#222] text-[#555] hover:border-[#444]'
              }`}>
              ✏️ 自訂 JSON
            </button>

            {isCustom && (
              <textarea value={customJson} onChange={e => setCustomJson(e.target.value)}
                placeholder={JSON.stringify(selectedPreset.json, null, 2)}
                rows={8}
                className="w-full mt-3 bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-xs font-mono text-green-400 outline-none focus:border-[#e8d5b0] transition-colors resize-none leading-relaxed"
              />
            )}
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">鏡頭數量</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShotCount(Math.max(1, shotCount - 1))}
                className="w-8 h-8 rounded-full border border-[#222] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all text-lg flex items-center justify-center">−</button>
              <span className="text-3xl text-[#e8d5b0] font-serif min-w-[40px] text-center">{shotCount}</span>
              <button onClick={() => setShotCount(Math.min(12, shotCount + 1))}
                className="w-8 h-8 rounded-full border border-[#222] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all text-lg flex items-center justify-center">+</button>
              <span className="text-xs text-[#555]">個鏡頭</span>
            </div>
          </div>

          <button onClick={generatePrompts} disabled={generating}
            className="w-full py-4 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
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

          {shots.length === 0 && !generating && (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
              <div className="text-5xl opacity-20">🎥</div>
              <div className="text-2xl font-serif text-[#444] italic">準備好開始了</div>
              <div className="text-sm text-[#333] max-w-xs leading-relaxed">
                選擇電影風格，輸入場景描述，然後撳「生成 Kling Prompts」
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
                  {[['Mode', '720p'], ['Duration', '5s'], ['Ratio', '9:16']].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] text-[#333] font-mono uppercase">{k}</div>
                      <div className="text-sm text-[#e8d5b0] font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {shots.map((shot, i) => {
                  const assignedChar = characters.find(c => c.id === shot.characterId)
                  return (
                    <div key={i} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">

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

                      {/* Character Picker */}
                      <div className="px-5 pb-3">
                        {assignedChar ? (
                          <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#e8d5b0]/30 rounded-xl px-4 py-2.5">
                            <img src={assignedChar.imageUrl} alt={assignedChar.name}
                              className="w-8 h-8 rounded-full object-cover border border-[#e8d5b0]/50" />
                            <div>
                              <div className="text-xs font-bold text-[#e8d5b0]">{assignedChar.name}</div>
                              <div className="text-[10px] text-[#555]">Image-to-Video 模式</div>
                            </div>
                            <button onClick={() => removeCharacter(i)}
                              className="ml-auto text-[#555] hover:text-red-400 text-xs transition-all">移除</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <button onClick={() => setShowCharPicker(showCharPicker === i ? null : i)}
                              className="w-full py-2 border border-dashed border-[#333] rounded-xl text-xs text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
                              👤 {characters.length > 0 ? '指定角色（可選）' : '指定角色（可選）'}
                            </button>
                            {showCharPicker === i && characters.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden z-10">
                                {characters.map(char => (
                                  <button key={char.id} onClick={() => assignCharacter(i, char.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#222] transition-all text-left">
                                    <img src={char.imageUrl} alt={char.name}
                                      className="w-8 h-8 rounded-full object-cover" />
                                    <div>
                                      <div className="text-xs font-bold text-[#e8e8e8]">{char.name}</div>
                                      <div className="text-[10px] text-[#555] truncate max-w-[200px]">{char.description}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="px-5 pb-5 flex flex-col gap-3">
                        {shot.videoStatus === 'idle' && (
                          <button onClick={() => generateVideo(i)}
                            className="w-full py-3 border border-[#222] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
                            {assignedChar ? `🎥 用 ${assignedChar.name} 生成影片` : '🎥 一鍵生成影片'}
                          </button>
                        )}
                        {shot.videoStatus === 'generating' && (
                          <>
                            <div className="w-full py-3 border border-[#e8d5b0]/30 rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0]/50 text-center animate-pulse">
                              ⏳ 生成中... 約需 3 分鐘
                            </div>
                            <button onClick={() => fetchResult(i)} disabled={fetchingResult === i}
                              className="w-full py-3 bg-[#1a1a1a] border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all disabled:opacity-50">
                              {fetchingResult === i ? '🔍 查詢中...' : '🔍 查詢影片結果'}
                            </button>
                            {shot.requestId && (
                              <div className="text-[10px] text-[#333] font-mono text-center">Request ID: {shot.requestId}</div>
                            )}
                          </>
                        )}
                        {shot.videoStatus === 'done' && shot.videoUrl && (
                          <div className="space-y-3">
                            <video src={shot.videoUrl} controls className="w-full rounded-xl max-h-[500px]" />
                            <a href={shot.videoUrl} download target="_blank" rel="noreferrer"
                              className="block w-full py-2.5 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase text-center hover:opacity-90 transition-all">
                              ⬇️ 下載影片
                            </a>
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
                        {[['Camera', shot.camera_setting], ['Duration', '5s'], ['Ratio', '9:16'], ['Mode', '720p']].map(([k, v]) => (
                          <div key={k} className="text-[11px] text-[#333] font-mono">
                            {k}: <span className="text-[#e8d5b0]">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
