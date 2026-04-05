import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

interface ShotInput {
  id: string
  number: number
  sceneDesc: string
  shotType: string
  hasDialogue: boolean
  dialogue: string
}

export async function POST(req: NextRequest) {
  try {
    const { shotInputs, styleJson, characters, sceneRef } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

    const client = new Anthropic({ apiKey })

    const characterDesc = characters && characters.length > 0
      ? `\n\n角色描述（每個 prompt 都必須包含）：\n${characters.map((c: { name: string; description: string; appearanceJson?: string }) => {
          let desc = `- ${c.name}：${c.description}`
          if (c.appearanceJson) {
            try {
              const appearance = JSON.parse(c.appearanceJson)
              const appearanceStr = Object.entries(appearance)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
              desc += ` | 外貌：${appearanceStr}`
            } catch {
              // ignore
            }
          }
          return desc
        }).join('\n')}`
      : ''

    const sceneDesc = sceneRef
      ? `\n\n場景參考：${sceneRef.name}${sceneRef.description ? ` — ${sceneRef.description}` : ''}（每個 prompt 都必須保持呢個場景設定）`
      : ''

    const shotsDesc = shotInputs.map((s: ShotInput) => {
      let desc = `Shot ${s.number} [${s.shotType}]：${s.sceneDesc}`
      if (s.hasDialogue && s.dialogue) {
        desc += `\n對白：\n${s.dialogue}`
      }
      return desc
    }).join('\n\n')

    const systemPrompt = `你係一個專業嘅電影分鏡師同 AI 影片 prompt 專家。
你嘅任務係根據每個 Shot 嘅描述同風格 JSON，生成精確嘅 Kling AI 影片生成 prompt。

規則：
1. 每個 prompt 必須係英文
2. 每個 prompt 包含：鏡頭類型、畫面描述、演員動作指引、從 JSON 抽取嘅風格參數
3. 必須指定 9:16 aspect ratio
4. 避免 AI 感，要有電影質感
5. 如果有對白，prompt 要反映對話嘅情緒同氣氛，但唔需要逐字翻譯對白
6. 如果有角色描述，每個 prompt 都必須加入對應角色嘅外貌描述
7. 如果有場景參考，每個 prompt 都必須保持同一個場景設定
8. 回覆必須係 JSON 格式，shots 數量必須同輸入嘅 Shot 數量一樣

回覆格式：
{
  "shots": [
    {
      "number": 1,
      "type": "Wide Shot",
      "emotion": "情緒描述（中文）",
      "prompt": "完整英文 prompt",
      "camera_setting": "Static / Handheld / Slow Push In"
    }
  ]
}`

    const userPrompt = `以下係每個 Shot 嘅描述：

${shotsDesc}
${characterDesc}
${sceneDesc}

風格 JSON：${JSON.stringify(styleJson, null, 2)}

請為以上每個 Shot 生成對應嘅 Kling prompt。
保持每個 Shot 嘅鏡頭類型同情緒，如果有對白請反映喺情緒同演員指引入面。`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('回覆格式有問題')

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
