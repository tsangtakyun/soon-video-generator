'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Scene {
  id: string
  name: string
  description: string
  imageUrl: string
  createdAt: number
}

export default function Scenes() {
  const [scenes, setScenes] = useState<Scene[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadScenes()
  }, [])

  async function loadScenes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('scenes')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) {
      setScenes(data.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        imageUrl: s.image_url || '',
        createdAt: s.created_at,
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

  async function addScene() {
    if (!name || !uploadedImage) { setError('請輸入名字同上傳圖片'); return }
    setError('')
    const newScene = {
      id: Date.now().toString(),
      name,
      description,
      image_url: uploadedImage,
      created_at: Date.now(),
    }
    const { error } = await supabase.from('scenes').insert(newScene)
    if (error) { setError('儲存失敗：' + error.message); return }
    await loadScenes()
    setName('')
    setDescription('')
    setUploadedImage(null)
    setShowAdd(false)
  }

  async function deleteScene(id: string) {
    await supabase.from('scenes').delete().eq('id', id)
    await loadScenes()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] font-sans">
      <header className="border-b border-[#222] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-serif text-[#e8d5b0] tracking-wide">SOON</span>
          <span className="text-xs text-[#555] tracking-widest uppercase">場景庫</span>
        </div>
        <nav className="flex gap-2">
          {[
            { label: '💡 題材庫', href: 'https://idea-brainstorm.vercel.app' },
            { label: '📝 劇本', href: 'https://script-generator-xi.vercel.app' },
            { label: '🎬 分鏡', href: 'https://soon-storyboard.vercel.app/storyboard' },
            { label: '👤 角色庫', href: '/characters' },
            { label: '🎥 影片生成', href: '/' },
          ].map(nav => (
            <a key={nav.href} href={nav.href}
              className="px-3 py-1.5 rounded-full text-xs border border-[#222] text-[#555] hover:text-[#e8d5b0] hover:border-[#e8d5b0] transition-all">
              {nav.label}
            </a>
          ))}
          <span className="px-3 py-1.5 rounded-full text-xs bg-[#e8d5b0] text-[#0a0a0a] font-bold">🏠 場景庫</span>
        </nav>
      </header>

      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif text-[#e8d5b0] italic">場景庫</h1>
            <p className="text-xs text-[#555] mt-1">上傳真實場景照片，生成影片時保持場景一致性</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-5 py-2.5 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-all">
            + 新增場景
          </button>
        </div>

        {showAdd && (
          <div className="bg-[#111] border border-[#e8d5b0]/30 rounded-2xl p-6 mb-8">
            <h2 className="text-sm font-bold text-[#e8d5b0] mb-5 uppercase tracking-widest">新增場景</h2>
            {error && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 text-sm text-red-400 mb-4">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">場景名字</div>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="例如：臥室前、客廳、梳化"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">場景描述（可選）</div>
                  <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="例如：香港典型細房，木門，暖黃燈光"
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2.5 text-sm text-[#e8e8e8] outline-none focus:border-[#e8d5b0] transition-colors resize-none"
                  />
                </div>
                <label className="w-full py-3 border border-[#222] rounded-xl text-xs font-bold tracking-widest uppercase text-[#555] hover:border-[#e8d5b0] hover:text-[#e8d5b0] transition-all cursor-pointer text-center block">
                  📁 上傳場景照片
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              <div className="flex flex-col gap-4">
                <div className="text-[10px] font-bold tracking-widest uppercase text-[#555] mb-2">圖片預覽</div>
                <div className="flex-1 bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden flex items-center justify-center min-h-[200px]">
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-[#333] text-xs text-center">
                      <div className="text-3xl mb-2">🏠</div>
                      上傳場景照片
                    </div>
                  )}
                </div>
                {uploadedImage && (
                  <button onClick={addScene}
                    className="w-full py-3 bg-[#e8d5b0] text-[#0a0a0a] rounded-xl text-xs font-bold tracking-widest uppercase hover:opacity-90 transition-all">
                    ✅ 儲存場景
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-[#555] text-sm">載入中...</div>
          </div>
        ) : scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
            <div className="text-5xl opacity-20">🏠</div>
            <div className="text-2xl font-serif text-[#444] italic">場景庫係空嘅</div>
            <div className="text-sm text-[#333] max-w-xs leading-relaxed">上傳真實場景照片，生成每個 Shot 時保持同一個場景</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {scenes.map(scene => (
              <div key={scene.id} className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden group">
                <div className="aspect-video overflow-hidden relative">
                  <img src={scene.imageUrl} alt={scene.name} className="w-full h-full object-cover" />
                  <button onClick={() => deleteScene(scene.id)}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <div className="font-bold text-sm text-[#e8d5b0] mb-1">{scene.name}</div>
                  <div className="text-xs text-[#555] leading-relaxed">{scene.description || '冇描述'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
