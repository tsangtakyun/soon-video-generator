import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const responseUrl = `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}`

    const resultRes = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${falApiKey}` },
    })

    if (!resultRes.ok) {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const resultData = await resultRes.json()
    console.log('Result:', JSON.stringify(resultData).substring(0, 300))

    const videoUrl = resultData.video?.url || resultData.videos?.[0]?.url

    if (videoUrl) {
      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: videoUrl } }
      })
    }

    return NextResponse.json({ status: 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
