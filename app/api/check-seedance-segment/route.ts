import { fal } from '@fal-ai/client'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ENDPOINTS = new Set([
  'bytedance/seedance-2.0/fast/image-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'bytedance/seedance-2.0/fast/reference-to-video',
  'bytedance/seedance-2.0/reference-to-video',
])

function stringifyError(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getFalErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const body = record.body as { detail?: unknown } | undefined
    const detail = stringifyError(body?.detail)
    if (detail) return detail
  }

  return stringifyError(error) || '檢查生成狀態失敗。'
}

function normalizeJobError(message: string) {
  if (/content_policy_violation|sensitive content|partner_validation_failed/i.test(message)) {
    return [
      'Seedance 內容審核擋咗呢段影片：畫面或 prompt 可能涉及真實政治人物、警察/示威衝突、國歌、拘捕/拖走等敏感元素。',
      '請改用虛構地點同虛構角色，避免真實政治肖像、國旗/國歌、警徽、暴力執法字眼；可以描述成「保安人員」「市民群體」「公共大樓外的人群移動」。',
    ].join('\n')
  }

  return message
}

export async function POST(req: NextRequest) {
  try {
    const { requestId, endpointId } = await req.json()

    if (!requestId || typeof requestId !== 'string') {
      throw new Error('Missing requestId')
    }

    if (!endpointId || typeof endpointId !== 'string' || !ALLOWED_ENDPOINTS.has(endpointId)) {
      throw new Error('Invalid endpointId')
    }

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status(endpointId, {
      requestId,
      logs: true,
    })

    const statusName = String(status.status)

    if (statusName === 'COMPLETED') {
      const result = await fal.queue.result(endpointId, {
        requestId,
      })

      const data = result.data as { video?: { url?: string }; videos?: { url?: string }[] }
      const videoUrl = data.video?.url || data.videos?.[0]?.url

      if (!videoUrl) {
        throw new Error('Seedance 已完成，但回傳結果沒有 video URL。')
      }

      return NextResponse.json({ status: 'COMPLETED', videoUrl })
    }

    if (statusName === 'ERROR') {
      const statusRecord = status as unknown as Record<string, unknown>
      const errorMessage =
        stringifyError(statusRecord.error) ||
        stringifyError(statusRecord.message) ||
        stringifyError(statusRecord.logs) ||
        'Seedance 生成失敗。'

      return NextResponse.json(
        {
          error: normalizeJobError(errorMessage),
          status: statusName,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: statusName })
  } catch (error: unknown) {
    console.error('[check-seedance-segment] failed', error)
    const message = getFalErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
