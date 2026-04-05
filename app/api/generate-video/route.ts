import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const response = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: '9:16',
        duration: '5',
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.detail || 'fal.ai API error')
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
