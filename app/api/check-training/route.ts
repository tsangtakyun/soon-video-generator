import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { supabase } from '../../lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { requestId, characterId } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const status = await fal.queue.status('fal-ai/flux-lora-fast-training', {
      requestId,
      logs: false,
    })

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/flux-lora-fast-training', {
        requestId,
      })
      const loraUrl = (result.data as any)?.diffusers_lora_file?.url
      if (loraUrl && characterId) {
        await supabase
          .from('characters')
          .update({ lora_url: loraUrl })
          .eq('id', characterId)
      }
      return NextResponse.json({ status: 'COMPLETED', loraUrl })
    }

    return NextResponse.json({ status: status.status || 'IN_PROGRESS' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
