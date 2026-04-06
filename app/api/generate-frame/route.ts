import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { characterImageUrl, prompt, loraUrl, triggerWord } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    // 有 LoRA 就用 LoRA，冇就 fallback 去 Redux
    if (loraUrl) {
      const result = await fal.subscribe('fal-ai/flux-lora', {
        input: {
          prompt: `${triggerWord || 'MIACHAR'}, ${prompt}`,
          loras: [{ path: loraUrl, scale: 1.0 }],
          image_size: 'portrait_16_9',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
        },
      })
      const frameUrl = (result.data as any)?.images?.[0]?.url
      if (!frameUrl) throw new Error('冇生成到圖片')
      return NextResponse.json({ frameUrl })
    }

    // Fallback: Flux Redux
    let imageUrl = characterImageUrl
    if (characterImageUrl?.startsWith('data:')) {
      const response = await fetch(characterImageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'character.jpg', { type: blob.type })
      imageUrl = await fal.storage.upload(file)
    }

    const result = await fal.subscribe('fal-ai/flux/dev/redux', {
      input: {
        image_url: imageUrl,
        num_images: 1,
        image_size: 'portrait_16_9',
      },
    })

    const frameUrl = (result.data as any)?.images?.[0]?.url
    if (!frameUrl) throw new Error('冇生成到圖片')
    return NextResponse.json({ frameUrl })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate frame error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
