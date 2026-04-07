import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
          const { prompt, imageUrl, provider = 'kling' } = await req.json()

      const falApiKey = process.env.FAL_API_KEY    
      
          if (!falApiKey) throw new Error('Missing FAL_API_KEY')

      const queueId = provider === 'seedance'
        ? 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video'
        : 'fal-ai/kling-video/v3/pro/text-to-video'

      const body: Record<string, unknown> = {
        prompt,
        image_url: imageUrl,
        duration: '5',
        aspect_ratio: '9:16',
      }

      if (provider === 'seedance') {
        body.resolution = '720p'
        body.generate_audio = false
      }

      const response = await fetch(`https://queue.fal.run/${queueId}`, {
              method: 'POST',
              headers: {
                        'Authorization': `Key ${falApiKey}`,
                        'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
      })

      const data = await response.json()
      if (!response.ok) {
        const detail = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data)
        throw new Error(detail || 'fal.ai error')
      }

      return NextResponse.json({ request_id: data.request_id, provider })

    } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          return NextResponse.json({ error: message }, { status: 500 })
    }
}
