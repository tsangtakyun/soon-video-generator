import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageUrl } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const { request_id } = await fal.queue.submit('fal-ai/kling-video/v1.6/standard/image-to-video', {
      input: {
        prompt,
        image_url: imageUrl,
        aspect_ratio: '9:16',
        duration: '5',
      },
    })

    return NextResponse.json({ request_id })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
