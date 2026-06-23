import { fal } from '@fal-ai/client'
import { NextRequest, NextResponse } from 'next/server'

type SeedanceTier = 'fast' | 'standard'
type OutputFormat = 'ig' | 'youtube'
type SeedanceMode = 'image' | 'reference' | 'text'

const TEXT_ENDPOINTS: Record<SeedanceTier, string> = {
  fast: 'bytedance/seedance-2.0/fast/text-to-video',
  standard: 'bytedance/seedance-2.0/text-to-video',
}

const IMAGE_ENDPOINTS: Record<SeedanceTier, string> = {
  fast: 'bytedance/seedance-2.0/fast/image-to-video',
  standard: 'bytedance/seedance-2.0/image-to-video',
}

const REFERENCE_ENDPOINTS: Record<SeedanceTier, string> = {
  fast: 'bytedance/seedance-2.0/fast/reference-to-video',
  standard: 'bytedance/seedance-2.0/reference-to-video',
}

const ASPECT_RATIOS: Record<OutputFormat, string> = {
  ig: '9:16',
  youtube: '16:9',
}

const MAX_BODY_SIZE = 50 * 1024 * 1024
const MAX_REFERENCE_IMAGES = 9

function assertBodySize(req: NextRequest) {
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > MAX_BODY_SIZE) {
    throw new Error('Request body too large. Maximum size is 50MB.')
  }
}

function stringifyFalDetail(detail: unknown) {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const loc = Array.isArray(record.loc) ? record.loc.join('.') : undefined
          const msg = typeof record.msg === 'string' ? record.msg : undefined
          if (loc && msg) return `${loc}: ${msg}`
          if (msg) return msg
        }
        return JSON.stringify(item)
      })
      .filter(Boolean)
      .join('；')
  }

  if (detail && typeof detail === 'object') {
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }

  return ''
}

function getFalErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const body = 'body' in error ? (error as { body?: { detail?: unknown } }).body : undefined
    const detail = body?.detail
    if (typeof detail === 'string') {
      if (/exhausted balance|top up/i.test(detail)) {
        return 'Fal 額度不足，請先到 fal.ai/dashboard/billing 充值後再試。'
      }
      return detail
    }

    const detailMessage = stringifyFalDetail(detail)
    if (detailMessage) {
      return `Fal validation error: ${detailMessage}`
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/forbidden/i.test(message)) {
    return 'Fal 拒絕生成，請檢查 Fal API key 或帳戶額度。'
  }
  return message || '生成失敗'
}

export async function POST(req: NextRequest) {
  try {
    assertBodySize(req)

    const {
      imageUrl,
      imageUrls,
      prompt,
      tier = 'fast',
      outputFormat = 'ig',
      mode = 'image',
    } = await req.json()

    const selectedTier: SeedanceTier = tier === 'standard' ? 'standard' : 'fast'
    const selectedFormat: OutputFormat = outputFormat === 'youtube' ? 'youtube' : 'ig'
    const selectedMode: SeedanceMode =
      mode === 'reference' ? 'reference' : mode === 'text' ? 'text' : 'image'
    const endpointId =
      selectedMode === 'text'
        ? TEXT_ENDPOINTS[selectedTier]
        : selectedMode === 'reference'
        ? REFERENCE_ENDPOINTS[selectedTier]
        : IMAGE_ENDPOINTS[selectedTier]

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('請填寫 segment prompt。')
    }

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const baseInput = {
      prompt: prompt.trim(),
      resolution: '720p',
      duration: selectedMode === 'reference' ? 'auto' : '15',
      aspect_ratio: ASPECT_RATIOS[selectedFormat],
      // Keep native Seedance audio off for now to avoid audio policy false positives.
      generate_audio: false,
    }

    const input =
      selectedMode === 'text'
        ? baseInput
        : selectedMode === 'reference'
        ? {
            ...baseInput,
            image_urls: Array.isArray(imageUrls)
              ? imageUrls.filter((url) => typeof url === 'string' && url.trim()).slice(0, MAX_REFERENCE_IMAGES)
              : [],
          }
        : {
            ...baseInput,
            image_url: typeof imageUrl === 'string' ? imageUrl : '',
          }

    if (selectedMode === 'text') {
      // Text-to-video only needs the prompt and generation settings.
    } else if (selectedMode === 'reference') {
      if (!('image_urls' in input) || input.image_urls.length === 0) {
        throw new Error('請先上載 reference images。')
      }
    } else if (!('image_url' in input) || !input.image_url) {
      throw new Error('請先上載 storyboard grid 圖。')
    }

    const { request_id } = await fal.queue.submit(endpointId, { input })

    return NextResponse.json({ requestId: request_id, endpointId })
  } catch (error: unknown) {
    console.error('[generate-seedance-segment] submit failed', error)
    const message = getFalErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
