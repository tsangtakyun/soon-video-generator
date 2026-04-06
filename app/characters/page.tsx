'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Character {
    id: string
    name: string
    description: string
    appearanceJson: string
    imageUrl: string | null
    loraUrl: string | null
    createdAt: number
}

export default function Characters() {
    const [characters, setCharacters] = useState<Character[]>([])
    const [showAdd, setShowAdd] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [appearanceJson, setAppearanceJson] = useState('')

  useEffect(() => {
        loadCharacters()
  }, [])

  async function loadCharacters() {
        setLoading(true)
        const { data, error } = await supabase
          .from('characters')
          .select('*')
          .order('created_at', { ascending: true })
        if (!error && data) {
                setCharacters(data.map(c => ({
                          id: c.id,
                          name: c.name,
                          description: c.description || '',
                          appearanceJson: c.appearance_json || '',
                          imageUrl: c.image_url || null,
                          loraUrl: c.lora_url || null,
                          createdAt: c.created_at,
                })))
        }
        setLoading(false)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setUploadedImage(reader.result as string)
        reader.readAsDataURL(file)
  }

  async function generateCharacterImage() {
        if (!description) { setError('請輸入角色描述'); return }
        setGenerating(true)
        setError('')
        try {
                const res = await fetch('/api/generate-character', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ description }),
                })
                const data = await res.json()
                if (data.error) throw new Error(data.error)
                setUploadedImage(data.imageUrl)
        } catch (err: unknown) {
                setError(err instanceof Error ? err.message : '生成失敗')
        } finally {
                setGenerating(false)
        }
  }

  async function addCharacter() {
        if (!name) { setError('請輸入角色名字'); return }
        setError('')
        const newChar = {
                id: Date.now().toString(),
                name,
                description,
                appearance_json: appearanceJson,
                image_url: uploadedImage || '',
                created_at: Date.now(),
        }
        const { error } = await supabase.from('characters').insert(newChar)
        if (error) { setError('儲存失敗：' + error.message); return }
        await loadCharacters()
        setName('')
        setDescription('')
        setAppearanceJson('')
        setUploadedImage(null)
        setShowAdd(false)
  }

  async function deleteCharacter(id: string) {
        await supabase.from('characters').delete().eq('id', id)
        await loadCharacters()
  }

  async function handleTrainLora(characterId: string, e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async () => {
                try {
                          const res = await fetch('/api/train-lora', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                                    characterId,
                                                    imagesZipUrl: reader.result,
                                                    triggerWord: 'MIACHAR',
                                      }),
                          })
                          const data = await res.json()
                          if (data.error) throw new Error(data.error)
                          alert('訓練開始！大概需要 15-30 分鐘，完成後會自動儲存。')
                          pollTraining(data.request_id, characterId)
                } catch (err) {
                          alert('訓練失敗：' + err)
                }
        }
        reader.readAsDataURL(file)
  }

  async function pollTraining(requestId: string, characterId: string) {
        const interval = setInterval(async () => {
                const res = await fetch('/api/check-training', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ requestId, characterId }),
                })
                const data = await res.json()
                if (data.status === 'COMPLETED') {
                          clearInterval(interval)
                          await loadCharacters()
                }
        }, 30000)
  }

  return (
        <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] font-sans">
              <header className="border-b border-[#222] px-8 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                                <span className="text-xl font-serif text-[#e8d5b0] tracking-wide">SOON</span>span>
                                <span className="text-xs text-[#555] tracking-widest uppercase">角色庫</span>span>
                      </div>div>
                      <nav className="flex gap-2">
                        {[
          { label: '💡 題材庫', href: 'https://idea-brainstorm.vercel.app' },
          { label: '📝 劇本', href: 'https://script-generator-xi.vercel.app' },
          { label: '🎬 分鏡', href: 'https://soon-storyboard.vercel.app/storyboard' },
          { label: '🎥 影片生成', href: '/' },
                    ].map(nav => (
                                  <a key={nav.href} href={nav.href}
                                                  className="px-3 py-1.5 rounded-full text-xs border border-[#222] text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
                                    {nav.label}
                                  </a>a>
                                ))}
                                <span className="px-3 py-1.5 rounded-full text-xs bg-[#e8d5b0] text-[#0a0a0a] font-bold">👤 角色庫</span>span>
                      </nav>nav>
              </header>header>
        
              <div className="p-8">
                      <div className="flex items-center justify-between mb-8">
                                <div>
                                            <h1 className="text-3xl font-serif text-[#e8d5b0] italic">角色庫</h1>h1>
                                            <p className="text-xs text-[#555] mt-1">儲存角色參考圖，生成影片時保持角色一致性</p>p>
                                </div>div>
                                <button onClick={() => setShowAdd(!showAdd)}
                                              className="px-5 py-2.5 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-all">
                                            + 新增角色
                                </button>button>
                      </div>div>
              
                {showAdd && (
                    <div className="bg-[#111] border border-[#e8d5b0]/30 rounded-2xl p-6 mb-8">
                                <h2 className="text-sm font-bold text-[#e8d5b0] mb-5 uppercase tracking-widest">新增角色</h2>h2>
                      {error && (
                                    <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400 mb-4">{error}</div>div>
                                )}
                                <div className="grid grid-cols-2 gap-6">
                                              <div className="flex flex-col gap-4">
                                                              <div>
                                                                                <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">角色名字</div>div>
                                                                                <input value={name} onChange={e => setName(e.target.value)}
                                                                                                      placeholder="例如：Mia、阿俊"
                                                                                                      className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors"
                                                                                                    />
                                                              </div>div>
                                                              <div>
                                                                                <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">角色描述</div>div>
                                                                                <textarea value={description} onChange={e => setDescription(e.target.value)}
                                                                                                      placeholder="例如：young Asian woman, 25 years old, short bob hair..."
                                                                                                      rows={3}
                                                                                                      className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none"
                                                                                                    />
                                                              </div>div>
                                                              <div>
                                                                                <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">外貌 JSON</div>div>
                                                                                <textarea value={appearanceJson} onChange={e => setAppearanceJson(e.target.value)}
                                                                                                      placeholder={`{\n  "hair": "short bob, dark brown",\n  "face": "delicate features"\n}`}
                                                                                                      rows={5}
                                                                                                      className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-xs font-mono text-green-400 outline-none focus:border-[#e8d5b0] transition-colors resize-none"
                                                                                                    />
                                                              </div>div>
                                                              <div className="flex gap-3">
                                                                                <button onClick={generateCharacterImage} disabled={generating}
                                                                                                      className="flex-1 py-2.5 border border-[#e8d5b0] rounded-xl text-xs font-bold tracking-widest uppercase text-[#e8d5b0] hover:bg-[#e8d5b0] hover:text-[#0a0a0a] transition-all disabled:opacity-40">
                                                                                  {generating ? '⏳ 生成中...' : '✨ AI 生成圖片'}
                                                                                </button>button>
                                                                                <label className="flex-1 py-2.5 border border-[#222] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all cursor-pointer text-center">
                                                                                                    📁 上傳圖片
                                                                                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                                                                </label>label>
                                                              </div>div>
                                              </div>div>
                                              <div className="flex flex-col gap-4">
                                                              <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">圖片預覽</div>div>
                                                              <div className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden flex items-center justify-center min-h-[250px]">
                                                                {uploadedImage ? (
                                          <img src={uploadedImage} alt="preview" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="text-[#333] text-xs text-center">
                                                                <div className="text-3xl mb-2">👤</div>div>
                                                                AI 生成或上傳圖片（可選）
                                          </div>div>
                                                                                )}
                                                              </div>div>
                                                              <button onClick={addCharacter}
                                                                                  className="w-full py-3 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-all">
                                                                                儲存角色
                                                              </button>button>
                                              </div>div>
                                </div>div>
                    </div>div>
                      )}
              
                {loading ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-[#555] text-sm">載入中...</div>div>
                    </div>div>
                  ) : characters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                                <div className="text-5xl opacity-20">👤</div>div>
                                <div className="text-2xl font-serif text-[#444] italic">角色庫係空嘅</div>div>
                                <div className="text-sm text-[#333] max-w-xs leading-relaxed">新增角色後，生成影片時可以保持角色樣子一致</div>div>
                    </div>div>
                  ) : (
                    <div className="grid grid-cols-4 gap-5">
                      {characters.map(char => (
                                    <div key={char.id} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden group">
                                                    <div className="aspect-[9/16] overflow-hidden relative bg-[#0a0a0a] flex items-center justify-center">
                                                      {char.imageUrl ? (
                                                          <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                          <div className="text-4xl opacity-20">👤</div>div>
                                                                      )}
                                                                      <button onClick={() => deleteCharacter(char.id)}
                                                                                            className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                                                          ✕
                                                                      </button>button>
                                                    </div>div>
                                                    <div className="p-4">
                                                                      <div className="font-bold text-sm text-[#e8d5b0] mb-1">{char.name}</div>div>
                                                                      <div className="text-xs text-[#555] leading-relaxed line-clamp-2">{char.description || '冇描述'}</div>div>
                                                    </div>div>
                                                    <div className="p-3 border-t border-[#222]">
                                                      {char.loraUrl ? (
                                                          <div className="text-[10px] text-green-400 text-center">✅ LoRA 已訓練</div>div>
                                                        ) : (
                                                          <label className="w-full py-2 border border-[#333] rounded-lg text-[10px] font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all cursor-pointer flex items-center justify-center gap-1">
                                                                                🧠 訓練 LoRA
                                                                                <input
                                                                                                          type="file"
                                                                                                          accept=".zip"
                                                                                                          className="hidden"
                                                                                                          onChange={(e) => handleTrainLora(char.id, e)}
                                                                                                        />
                                                          </label>label>
                                                                      )}
                                                    </div>div>
                                    </div>div>
                                  ))}
                    </div>div>
                      )}
              </div>div>
        </div>div>
      )
}</div>
