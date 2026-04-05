import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status('fal-ai/kling-video/v1.6/standard/text-to-video', {
      requestId,
      logs: false,
    })

    console.log('Status:', JSON.stringify(status))

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/kling-video/v1.6/standard/text-to-video', {
        requestId,
      })

      console.log('Result:', JSON.stringify(result.data).substring(0, 300))

      const data = result.data as { video?: { url: string } }
      const videoUrl = data?.video?.url

      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: videoUrl } }
      })
    }

    return NextResponse.json({ status: status.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
