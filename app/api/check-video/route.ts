import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()
    console.log('Checking requestId:', requestId)

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    // 直接用 response URL 攞結果
    const responseUrl = `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}`
    console.log('Fetching:', responseUrl)

    const res = await fetch(responseUrl, {
      headers: { 'Authorization': `Key ${falApiKey}` },
    })

    console.log('HTTP status:', res.status)
    const text = await res.text()
    console.log('Raw response:', text.substring(0, 500))

    if (!res.ok) {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const data = JSON.parse(text)
    const videoUrl = data.video?.url || data.videos?.[0]?.url

    if (videoUrl) {
      return NextResponse.json({ 
        status: 'COMPLETED', 
        output: { video: { url: videoUrl } }
      })
    }

    return NextResponse.json({ status: 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check video error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
