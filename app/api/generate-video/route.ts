import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt, elementImageUrl } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const body: Record<string, unknown> = {
      prompt: elementImageUrl ? `${prompt} @Element1` : prompt,
      aspect_ratio: '9:16',
      duration: '5',
      generate_audio: false,
    }

    if (elementImageUrl) {
      body.elements = [
        {
          images: [{ image_url: elementImageUrl }]
        }
      ]
    }

    const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log('Generate video response:', JSON.stringify(data).substring(0, 300))
    if (!response.ok) throw new Error(data.detail || JSON.stringify(data))

    return NextResponse.json({ request_id: data.request_id })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate video error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
