import { fal } from '@fal-ai/client'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ENDPOINTS = new Set([
  'bytedance/seedance-2.0/fast/text-to-video',
  'bytedance/seedance-2.0/text-to-video',
  'bytedance/seedance-2.0/fast/image-to-video',
  'bytedance/seedance-2.0/image-to-video',
  'bytedance/seedance-2.0/fast/reference-to-video',
  'bytedance/seedance-2.0/reference-to-video',
])

function extractErrorText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message

  if (Array.isArray(value)) {
    return value.map(extractErrorText).filter(Boolean).join('\n')
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const direct =
      extractErrorText(record.msg) ||
      extractErrorText(record.message) ||
      extractErrorText(record.error) ||
      extractErrorText(record.detail)
    if (direct) return direct

    const body = record.body as { detail?: unknown } | undefined
    const bodyDetail = extractErrorText(body?.detail)
    if (bodyDetail) return bodyDetail

    const type = extractErrorText(record.type)
    const ctx = record.ctx as Record<string, unknown> | undefined
    const extraInfo = ctx?.extra_info as Record<string, unknown> | undefined
    const reason = extractErrorText(extraInfo?.reason)
    if (type || reason) return [type, reason].filter(Boolean).join('\n')

    const loc = Array.isArray(record.loc) ? record.loc.join('.') : ''
    if (loc) return [loc, type].filter(Boolean).join(': ')
  }

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
    const detail = extractErrorText(body?.detail)
    if (detail) return normalizeJobError(detail)
  }

  return normalizeJobError(extractErrorText(error) || '檢查生成狀態失敗。')
}

function normalizeJobError(message: string) {
  if (/Output audio has sensitive content|content_policy_violation|sensitive content|partner_validation_failed/i.test(message)) {
    return [
      'Seedance 判斷生成音訊可能包含敏感內容，所以拒絕了這次生成。',
      '我已將純文字模式預設改為不生成原生音訊。請再試一次；如果仍然被拒，可以把 prompt 寫得更中性，例如把「He treats the banana like you」改成「He mistakes the banana for a friend」。',
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
        throw new Error('Seedance 已完成，但回傳內容沒有 video URL。')
      }

      return NextResponse.json({ status: 'COMPLETED', videoUrl })
    }

    if (statusName === 'ERROR') {
      const statusRecord = status as unknown as Record<string, unknown>
      const errorMessage =
        extractErrorText(statusRecord.error) ||
        extractErrorText(statusRecord.message) ||
        extractErrorText(statusRecord.logs) ||
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
