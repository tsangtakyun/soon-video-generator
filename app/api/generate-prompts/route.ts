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

function parseDialogueLine(rawDialogue: string) {
  const trimmed = rawDialogue.trim()
  const match = trimmed.match(/^([^:：\-\n]+?)\s*[:：-]\s*["“”']?([\s\S]+?)["“”']?$/)

  if (!match) {
    return null
  }

  return {
    speaker: match[1].trim(),
    line: match[2].trim(),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { shotInputs, styleJson, characters, sceneRef } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')

    const client = new Anthropic({ apiKey })

    const characterDesc = characters && characters.length > 0
      ? `\n\n角色鎖定（每個 prompt 都必須保持一致）：\n${characters.map((c: { name: string; description: string; appearanceJson?: string }) => {
          let desc = `- ${c.name}：base description = ${c.description}`
          if (c.appearanceJson) {
            try {
              const appearance = JSON.parse(c.appearanceJson)
              const entries = Object.entries(appearance)
              const appearanceEntries = entries.filter(([key]) => !['wardrobe_lock', 'negative_constraints'].includes(key))
              const wardrobe = entries.find(([key]) => key === 'wardrobe_lock')?.[1]
              const negatives = entries.find(([key]) => key === 'negative_constraints')?.[1]
              if (appearanceEntries.length > 0) {
                desc += ` | identity lock: ${appearanceEntries.map(([k, v]) => `${k}: ${v}`).join(', ')}`
              }
              if (typeof wardrobe === 'string' && wardrobe.trim()) {
                desc += ` | wardrobe lock: ${wardrobe}`
              }
              if (typeof negatives === 'string' && negatives.trim()) {
                desc += ` | do not change: ${negatives}`
              }
            } catch {
              desc += ` | identity lock raw: ${c.appearanceJson}`
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
        const parsedDialogue = parseDialogueLine(s.dialogue)
        if (parsedDialogue) {
          desc += `\n[此 Shot 有對白。Speaker = ${parsedDialogue.speaker}. Exact spoken line reference = ${parsedDialogue.line}]`
          desc += `\n[請喺 prompt 內清楚指明係 ${parsedDialogue.speaker} 講出呢句說話，保留原句意思同內容，並描述嘴型、停頓、語氣、情緒同表演節奏；但唔好出現字幕、caption、screen text、on-screen words。]`
        } else {
          desc += `\n[此 Shot 有對白。請保留以下原文作為 exact spoken line reference，唔好改寫意思，唔好另作新句子：${s.dialogue}]`
          desc += `\n[請喺 prompt 內清楚寫出角色正在講呢句說話，並描述嘴型、停頓、語氣、情緒同表演節奏；但唔好出現字幕、caption、screen text、on-screen words。]`
        }
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
5. 如果有對白，prompt 要保留輸入嘅 exact dialogue 作為 spoken line reference，唔好改寫成另一句說話
6. 如果有角色描述，每個 prompt 都必須加入對應角色嘅外貌描述、服裝鎖定，同埋避免變動項
7. 如果有場景參考，每個 prompt 都必須保持同一個場景設定
8. 回覆必須係 JSON 格式，shots 數量必須同輸入嘅 Shot 數量一樣
9. 如果有對白，可以將原文對白寫入 prompt 作為 spoken line reference，但必須清楚指示係角色講出呢句說話，而唔係字幕、caption 或畫面文字
10. 生成 prompt 時優先考慮角色樣貌一致性，而唔係誇張變化。避免突然轉髮型、年齡、服裝、臉部比例、身形
11. prompt 內要清楚區分固定元素（identity lock, wardrobe lock, scene lock）同可變元素（action, emotion, camera）
12. 有對白時，優先保留原句內容，其次先補充 delivery，例如 soft, restrained, cold, pained, whispering, paused
13. 有對白時，明確避免任何 on-screen text, subtitles, captions, floating words, or text overlay
14. 如果對白有 speaker 標記（例如 Mia: "..."），必須明確保留 speaker 身份，唔好將說話錯配到其他角色

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
保持每個 Shot 嘅鏡頭類型同情緒，如果有對白請保留原文作為 exact spoken line reference，唔好自行改句子；如果有 speaker，就要清楚寫明由該角色講。`

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
