import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()
    console.log('Checking requestId:', requestId)

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const statusUrl = `https://queue.fal.run/fal-ai/kling-video/v1.6/standard/text-to-video/requests/${requestId}/status`
    console.log('Status URL:', statusUrl)

    const statusRes = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falApiKey}` },
    })

    const statusText = await statusRes.text()
    console.log('Status response:', statusText)

    const statusData = JSON.parse(statusText)

    if (statusData.status === 'COMPLETED') {
      const responseUrl = statusData.response_url
      console.log('Response URL:', responseUrl)
      
      const resultRes = await fetch(responseUrl, {
        headers: { 'Authorization': `Key ${falApiKey}` },
      })
      const resultText = await resultRes.text()
      console.log('Result response:', resultText)
      
      const resultData = JSON.parse(resultText)
      const videoUrl = resultData.video?.url || resultData.videos?.[0]?.url
      console.log('Video URL:', videoUrl)
      
      return NextResponse.json({ 
        status: 'COMPLETED', 
        output: { video: { url: videoUrl } }
      })
    }

    return NextResponse.json({ status: statusData.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check video error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
