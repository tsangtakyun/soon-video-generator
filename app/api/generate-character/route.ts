import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: `Portrait photo of ${description}, cinematic lighting, photorealistic, high quality, film still, 9:16 aspect ratio`,
        image_size: 'portrait_9_16',
        num_images: 1,
      },
    })

    const data = result.data as { images?: { url: string }[] }
    const imageUrl = data?.images?.[0]?.url

    return NextResponse.json({ imageUrl })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
