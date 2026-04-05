import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    // Check status
    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}/status`,
      {
        headers: { 'Authorization': `Key ${falApiKey}` },
      }
    )

    const statusData = await statusRes.json()

    if (statusData.status === 'COMPLETED') {
      // 用 response_url 攞結果
      const responseUrl = statusData.response_url
      const resultRes = await fetch(responseUrl, {
        headers: { 'Authorization': `Key ${falApiKey}` },
      })
      const resultData = await resultRes.json()
      return NextResponse.json({ 
        status: 'COMPLETED', 
        output: { video: { url: resultData.video?.url || resultData.videos?.[0]?.url } }
      })
    }

    return NextResponse.json({ status: statusData.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
