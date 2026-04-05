import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, audioUrl } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/video-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_url: videoUrl,
        audio_url: audioUrl,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Lip sync error')

    return NextResponse.json({ request_id: data.request_id })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
