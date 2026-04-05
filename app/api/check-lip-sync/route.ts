import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status('fal-ai/kling-video/v1.6/standard/video-to-video', {
      requestId,
      logs: false,
    })

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/kling-video/v1.6/standard/video-to-video', {
        requestId,
      })
      const data = result.data as { video?: { url: string } }
      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: data?.video?.url } }
      })
    }

    return NextResponse.json({ status: status.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }
}
