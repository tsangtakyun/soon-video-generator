import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId, falApiKey } = await req.json()

    const response = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falApiKey}`,
      },
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.detail || 'fal.ai status check error')
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
