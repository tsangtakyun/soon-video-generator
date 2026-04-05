'use client'

import { useState } from 'react'

const EP1_JSON = {
  color_grade: "warm amber, slight desaturation, film grain",
  lighting: "practical warm light, soft shadows, window side light",
  camera_movement: "handheld slight shake",
  lens: "35mm equivalent, shallow depth of field, soft bokeh",
  composition: "subject slightly off-center, negative space",
  mood: "cold, detached on surface, underlying tension",
  aspect_ratio: "9:16",
  style_reference: "cinematic Korean drama, quiet emotional realism"
}

const EP2_JSON = {
  color_grade: "cool blue, low contrast, desaturated grey tones",
  lighting: "top light or side light, strong facial shadows",
  camera_movement: "static, occasional slow push in",
  lens: "50mm, slightly distant, isolating subject",
  composition: "subject centered but overwhelmed by negative space",
  mood: "suppressed, patient, unheard silence",
  aspect_ratio: "9:16",
  style_reference: "minimalist Asian arthouse, like Wong Kar-wai"
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
}

export default function Home() {
  const [scene, setScene] = useState('')
  const [styleJson, setStyleJson] = useState(JSON.stringify(EP1_JSON, null, 2))
  const [shotCount, setShotCount] = useState(6)
  const [shots, setShots] = useState<Shot[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('ep1')
  const [copied, setCopied] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [fetchingResult, setFetchingResult] = useState<number | null>(null)

  function setPresetStyle(type: string) {
    setPreset(type)
    if (type === 'ep1') setStyleJson(JSON.stringify(EP1_JSON, null, 2))
    if (type === 'ep2') setStyleJson(JSON.stringify(EP2_JSON, null, 2))
  }

  async function generatePrompts() {
    if (!scene) {
      setError('請輸入場景描述')
      return
    }
    setError('')
    setGenerating(true)
    setShots([])

    try {
      let parsed
      try { parsed = JSON.parse(styleJson) }
      catch { throw new Error('JSON 格式有問題') }

      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene, styleJson: parsed, shotCount }),
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
    const updated = [...shots]
    updated[index] = { ...shot, videoStatus: 'generating' }
    setShots(updated)

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: shot.prompt }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const requestId = data.request_id
      setShots(prev => {
        const newShots = [...prev]
        newShots[index] = { ...newShots[index], requestId, videoStatus: 'generating' }
        return newShots
      })

    } catch (err: unknown) {
      setShots(prev => {
        const newShots = [...prev]
        newShots[index] = { ...newShots[index], videoStatus: 'error' }
        return newShots
      })
      setError(err instanceof Error ? err.message : '影片生成失敗')
    }
  }

  async function fetchResult(index: number) {
    const shot = shots[index]
    if (!shot.requestId) return

    setFetchingResult(index)

    try {
      const res = await fetch('/api/check-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: shot.requestId }),
      })

      const data = await res.json()

      if (data.status === 'COMPLETED') {
        const videoUrl = data.output?.video?.url || data.output?.videos?.[0]?.url
        setShots(prev => {
          const newShots = [...prev]
          newShots[index] = { ...newShots[index], videoStatus: 'done', videoUrl }
          return newShots
        })
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
          ].map(nav => (
            <a key={nav.href} href={nav.href}
              className="px-3 py-1.5 rounded-full text-xs border border-[#222] text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
              {nav.label}
            </a>
          ))}
          <span className="px-3 py-1.5 rounded-full text-xs bg-[#e8d5b0] text-[#0a0a0a] font-bold">🎥 影片生成</span>
        </nav>
      </header>

      <div className="grid grid-cols-[360px_1fr] min-h-[calc(100vh-73px)]">

        <div className="border-r border-[#222] p-8 flex flex-col gap-6 overflow-y-auto">

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">場景描述</div>
            <textarea
              value={scene}
              onChange={e => setScene(e.target.value)}
              placeholder="例如：臥室前，夜晚。Mia 冷冷地執嘢，阿俊靠牆站，唔敢出聲..."
              rows={6}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none leading-relaxed placeholder:text-[#333]"
            />
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">風格 JSON</div>
            <div className="flex gap-2 mb-3">
              {[
                { key: 'ep1', label: '集一 · Mia' },
                { key: 'ep2', label: '集二 · 阿俊' },
                { key: 'custom', label: '自訂' },
              ].map(p => (
                <button key={p.key} onClick={() => setPresetStyle(p.key)}
                  className={`px-3 py-1 rounded-full text-xs border transition-all ${preset === p.key ? 'bg-[#e8d5b0] text-[#0a0a0a] border-[#e8d5b0] font-bold' : 'border-[#222] text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0]'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={styleJson}
              onChange={e => { setStyleJson(e.target.value); setPreset('custom') }}
              rows={8}
              className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-xs font-mono text-green-400 outline-none focus:border-[#e8d5b0] transition-colors resize-none leading-relaxed"
            />
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">鏡頭數量</div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShotCount(Math.max(1, shotCount - 1))}
                className="w-8 h-8 rounded-full border border-[#222] text-[#e8e8e8] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all text-lg flex items-center justify-center">−</button>
              <span className="text-3xl text-[#e8d5b0] font-serif min-w-[40px] text-center">{shotCount}</span>
              <button onClick={() => setShotCount(Math.min(12, shotCount + 1))}
                className="w-8 h-8 rounded-full border border-[#222] text-[#e8e8e8] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all text-lg flex items-center justify-center">+</button>
              <span className="text-xs text-[#555]">個鏡頭</span>
            </div>
          </div>

          <button onClick={generatePrompts} disabled={generating}
            className="w-full py-4 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {generating ? '⏳ Claude 生成中...' : '🎬 生成 Kling Prompts'}
          </button>

        </div>

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
              <div className="text-sm text-[#333] max-w-xs leading-relaxed">輸入場景描述，選擇風格 JSON，然後撳「生成 Kling Prompts」</div>
            </div>
          )}

          {shots.length > 0 && (
            <>
              <div className="bg-[#111] border border-[#222] rounded-xl px-6 py-4 mb-6">
                <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-3">Kling 設定（每個 Shot 統一使用）</div>
                <div className="flex gap-8">
                  {[['Mode', '720p'], ['Duration', '5s'], ['Ratio', '9:16'], ['Multi-Shot', 'OFF'], ['Native Audio', 'ON']].map(([k, v]) => (
                    <div key={k}>
                      <div className="text-[10px] text-[#333] font-mono uppercase">{k}</div>
                      <div className="text-sm text-[#e8d5b0] font-bold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-5">
                {shots.map((shot, i) => (
                  <div key={i} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">

                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
                      <div className="flex items-center gap-3">
                        <span className="bg-[#e8d5b0] text-[#0a0a0a] text-xs font-bold px-3 py-1 rounded-full font-mono">Shot {shot.number}</span>
                        <span className="text-xs font-bold text-[#c0392b] uppercase tracking-widest">{shot.type}</span>
                        <span className="text-xs text-[#555] italic">{shot.emotion}</span>
                      </div>
                      <button onClick={() => copyPrompt(i)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${copied === i ? 'border-green-500 text-green-400' : 'border-[#222] text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0]'}`}>
                        {copied === i ? '✅ 已複製' : '📋 複製'}
                      </button>
                    </div>

                    <div className="px-5 py-4">
                      <p className="font-mono text-xs text-green-400 leading-relaxed">{shot.prompt}</p>
                    </div>

                    <div className="px-5 pb-5 flex flex-col gap-3">
                      {shot.videoStatus === 'idle' && (
                        <button onClick={() => generateVideo(i)}
                          className="w-full py-3 border border-[#222] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all">
                          🎥 一鍵生成影片
                        </button>
                      )}

                      {shot.videoStatus === 'generating' && (
                        <>
                          <div className="w-full py-3 border border-[#e8d5b0]/30 rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0]/50 text-center animate-pulse">
                            ⏳ 生成中... 約需 3 分鐘，生成完撳下面按鈕
                          </div>
                          <button onClick={() => fetchResult(i)}
                            disabled={fetchingResult === i}
                            className="w-full py-3 bg-[#1a1a1a] border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all disabled:opacity-50">
                            {fetchingResult === i ? '🔍 查詢中...' : '🔍 查詢影片結果'}
                          </button>
                          {shot.requestId && (
                            <div className="text-[10px] text-[#333] font-mono text-center">
                              Request ID: {shot.requestId}
                            </div>
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
                          <div className="w-full py-3 border border-red-800/40 rounded-xl text-xs text-red-400 text-center">
                            生成失敗
                          </div>
                          <button onClick={() => generateVideo(i)}
                            className="w-full py-2.5 border border-[#222] rounded-xl text-xs text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
                            重試
                          </button>
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
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
