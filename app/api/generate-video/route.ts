import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { prompt, elementImageUrl, provider = 'kling' } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    let uploadedImageUrl: string | null = null

    // 如果係 base64，先上傳到 fal.ai storage
    if (elementImageUrl && elementImageUrl.startsWith('data:')) {
      const response = await fetch(elementImageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'character.jpg', { type: blob.type })
      uploadedImageUrl = await fal.storage.upload(file)
      console.log('Uploaded element image:', uploadedImageUrl)
    } else if (elementImageUrl) {
      uploadedImageUrl = elementImageUrl
    }

    const body: Record<string, unknown> = {
      prompt: uploadedImageUrl ? `${prompt}, @Element1 is the main character` : prompt,
      aspect_ratio: '9:16',
      duration: '5',
      generate_audio: false,
    }

    if (provider === 'seedance') {
      body.resolution = '720p'
    }

    if (uploadedImageUrl) {
      body.elements = [
        {
          images: [
            { image_url: uploadedImageUrl }
          ]
        }
      ]
    }

    const queueId = provider === 'seedance'
      ? 'bytedance/seedance-2.0/text-to-video'
      : 'fal-ai/kling-video/v3/pro/text-to-video'

    const response = await fetch(`https://queue.fal.run/${queueId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log('Response:', JSON.stringify(data).substring(0, 300))
    if (!response.ok) throw new Error(data.detail || JSON.stringify(data))

    return NextResponse.json({ request_id: data.request_id, provider })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
