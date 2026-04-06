import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { requestId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status('fal-ai/kling-video/lipsync/audio-to-video', {
      requestId,
      logs: false,
    })

    console.log('Lip sync status:', status.status)

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/kling-video/lipsync/audio-to-video', {
        requestId,
      })
      const data = result.data as { video?: { url: string } }
      console.log('Lip sync video URL:', data?.video?.url)
      return NextResponse.json({
        status: 'COMPLETED',
        output: { video: { url: data?.video?.url } }
      })
    }

    return NextResponse.json({ status: status.status })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Lip sync check error:', message)
    return NextResponse.json({ status: 'IN_PROGRESS' })
  }
}
