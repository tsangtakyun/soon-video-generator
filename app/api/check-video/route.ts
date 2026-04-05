import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falApiKey}` } }
    )

    const statusText = await statusRes.text()
    if (!statusText || statusText.trim() === '') {
      return NextResponse.json({ status: 'IN_PROGRESS' })
    }

    const statusData = JSON.parse(statusText)

    if (statusData.status === 'COMPLETED') {
      const responseUrl = statusData.response_url
      if (!responseUrl) return NextResponse.json({ status: 'IN_PROGRESS' })

      const resultRes = await fetch(responseUrl, {
        headers: { 'Authorization': `Key ${falApiKey}` },
      })
      const resultData = await resultRes.json()
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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
