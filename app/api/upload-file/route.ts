import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

const MAX_FILE_SIZE = 30 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function assertBodySize(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > MAX_FILE_SIZE) {
    throw new Error('檔案太大，最多只可上載 30MB。')
  }
}

function getFalErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const body = 'body' in error ? (error as { body?: { detail?: unknown } }).body : undefined
    const detail = body?.detail
    if (typeof detail === 'string') {
      if (/exhausted balance|top up/i.test(detail)) {
        return 'Fal 餘額不足或帳戶已被暫停。請先到 fal.ai/dashboard/billing 增值，再重新上載。'
      }
      return detail
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/forbidden/i.test(message)) {
    return 'Fal storage 拒絕上載。請檢查 Fal API key、帳戶狀態或餘額。'
  }
  return message || '上載失敗'
}

export async function POST(req: NextRequest) {
  try {
    assertBodySize(req)

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      throw new Error('請上載一張 storyboard grid 圖。')
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error('只支援 JPEG、PNG 或 WebP 圖片。')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('檔案太大，最多只可上載 30MB。')
    }

    let url: string
    try {
      url = await fal.storage.upload(file)
    } catch (error: unknown) {
      console.error('[upload-file] fal storage upload failed', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error,
      })
      throw new Error(getFalErrorMessage(error))
    }

    return NextResponse.json({ url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '上載失敗'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
