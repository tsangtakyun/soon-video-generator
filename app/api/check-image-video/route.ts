import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falApiKey}` } }
    )

    const statusData = await statusRes.json()

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${falApiKey}` } }
      )
      const resultData = await resultRes.json()
      console.log('Result data:', JSON.stringify(resultData).substring(0, 300)) 
      const videoUrl = resultData.video?.url || resultData.videos?.[0]?.url
      return NextResponse.json({ status: 'COMPLETED', output: { video: { url: videoUrl } } })
    }

    return NextResponse.json({ status: statusData.status || 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
