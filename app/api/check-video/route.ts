import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const response = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${falApiKey}`,
      },
    })

    const data = await response.json()

    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Key ${falApiKey}`,
        },
      })
      const resultData = await resultRes.json()
      return NextResponse.json({ status: 'COMPLETED', output: resultData })
    }

    return NextResponse.json(data)

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
