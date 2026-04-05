import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    // 直接攞結果
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}`,
      { headers: { 'Authorization': `Key ${falApiKey}` } }
    )

    const resultData = await resultRes.json()
    console.log('Result keys:', Object.keys(resultData))
    console.log('Video:', JSON.stringify(resultData.video))

    if (resultData.video?.url) {
      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: resultData.video.url } }
      })
    }

    // 仲未完成
    return NextResponse.json({ status: 'IN_PROGRESS' })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
