import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

function getQueueId(provider: string) {
  return provider === 'seedance'
    ? 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
    : 'fal-ai/kling-video/v3/pro/text-to-video'
}

export async function POST(req: NextRequest) {
  try {
    const { requestId, provider = 'kling' } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const queueId = getQueueId(provider)

    const status = await fal.queue.status(queueId, {
      requestId,
      logs: false,
    })

    console.log('Status:', status.status)

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(queueId, {
        requestId,
      })

      const data = result.data as { video?: { url: string } }
      console.log('Video URL:', data?.video?.url)

      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: data?.video?.url } }
      })
    }

    return NextResponse.json({ status: status.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }
}
