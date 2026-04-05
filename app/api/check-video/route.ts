import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()
    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    // 先 check status
    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falApiKey}` } }
    )
    const statusText = await statusRes.text()
    console.log('Status text:', statusText)

    if (!statusText || statusText.trim() === '') {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const statusData = JSON.parse(statusText)
    console.log('Status:', statusData.status)

    if (statusData.status === 'COMPLETED') {
      // 用 response_url 攞結果
      const responseUrl = statusData.response_url
      console.log('Response URL:', responseUrl)

      if (!responseUrl) {
        return NextResponse.json({ status: 'IN_PROGRESS' })
      }

      const resultRes = await fetch(responseUrl, {
        headers: { 'Authorization': `Key ${falApiKey}` },
      })
      const resultText = await resultRes.text()
      console.log('Result:', resultText.substring(0, 300))

      const resultData = JSON.parse(resultText)
      const videoUrl = resultData.video?.url || resultData.videos?.[0]?.url

      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: videoUrl } }
      })
    }

    if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    return NextResponse.json({ status: statusData.status || 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
