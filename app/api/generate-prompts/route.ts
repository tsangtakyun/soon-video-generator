import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { scene, styleJson, shotCount, characters } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

    const client = new Anthropic({ apiKey })

    const characterDesc = characters && characters.length > 0
      ? `\n\n角色描述（每個 prompt 都必須包含）：\n${characters.map((c: { name: string; description: string }) => `- ${c.name}：${c.description}`).join('\n')}`
      : ''

    const systemPrompt = `你係一個專業嘅電影分鏡師同 AI 影片 prompt 專家。
你嘅任務係根據場景描述同風格 JSON，生成精確嘅 Kling AI 影片生成 prompt。

規則：
1. 每個 prompt 必須係英文
2. 每個 prompt 包含：鏡頭類型、畫面描述、演員動作指引、從 JSON 抽取嘅風格參數
3. 必須指定 9:16 aspect ratio
4. 避免 AI 感，要有電影質感
5. 如果係特寫或唔需要見臉嘅鏡頭，加「No faces visible」
6. 如果有角色描述，每個 prompt 都必須加入對應角色嘅外貌描述
7. 回覆必須係 JSON 格式

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

    const userPrompt = `場景描述：${scene}${characterDesc}

風格 JSON：${JSON.stringify(styleJson, null, 2)}

請為呢個場景生成 ${shotCount} 個鏡頭嘅 Kling prompt。
每個鏡頭要有唔同嘅角度同情緒層次，由建立場景到情緒頂點。
如果有角色描述，每個 prompt 都要包含角色嘅外貌特徵。`

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
