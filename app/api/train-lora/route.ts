import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const formData = await req.formData()
    const file = formData.get('file') as File
    const characterId = formData.get('characterId') as string
    const triggerWord = (formData.get('triggerWord') as string) || 'MIACHAR'

    if (!file) throw new Error('冇收到檔案')

    // 上傳 zip 到 fal storage
    const zipUrl = await fal.storage.upload(file)
    console.log('Uploaded zip:', zipUrl)

    // 開始訓練
    const { request_id } = await fal.queue.submit('fal-ai/flux-lora-fast-training', {
      input: {
        images_data_url: zipUrl,
        trigger_word: triggerWord,
        create_masks: true,
        steps: 1000,
      },
    })

    return NextResponse.json({ request_id, characterId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
