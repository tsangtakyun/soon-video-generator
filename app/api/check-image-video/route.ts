import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

const KLING_QUEUE_ID = 'fal-ai/kling-video/v3/pro/text-to-video'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status(KLING_QUEUE_ID, {
      requestId,
      logs: false,
    })

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(KLING_QUEUE_ID, { requestId })
      const data = result.data as { video?: { url?: string }; videos?: Array<{ url?: string }> }
      const videoUrl = data?.video?.url || data?.videos?.[0]?.url

      if (!videoUrl) {
        return NextResponse.json({ status: 'IN_PROGRESS' })
      }

      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: videoUrl } },
      })
    }

    return NextResponse.json({ status: status.status || 'IN_PROGRESS' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check image video error:', message)
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }
}
