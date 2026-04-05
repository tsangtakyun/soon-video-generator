import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}`,
      { headers: { 'Authorization': `Key ${falApiKey}` } }
    )

    console.log('HTTP status:', resultRes.status)

    // 仲未完成時 fal.ai 返回非 200
    if (!resultRes.ok) {
      console.log('Not ready yet, status:', resultRes.status)
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const text = await resultRes.text()
    console.log('Response text:', text.substring(0, 200))

    if (!text || text.trim() === '') {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const resultData = JSON.parse(text)

    if (resultData.video?.url) {
      console.log('Video URL found:', resultData.video.url)
      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: resultData.video.url } }
      })
    }

    return NextResponse.json({ status: 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }
}
