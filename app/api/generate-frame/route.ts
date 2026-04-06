import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { characterImageUrl, prompt } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    // 如果係 base64，先上傳
    let imageUrl = characterImageUrl
    if (characterImageUrl.startsWith('data:')) {
      const response = await fetch(characterImageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'character.jpg', { type: blob.type })
      imageUrl = await fal.storage.upload(file)
      console.log('Uploaded character image:', imageUrl)
    }

    const result = await fal.subscribe('fal-ai/flux/dev/redux', {
      input: {
        image_url: imageUrl,
        prompt: prompt,
        num_images: 1,
        image_size: 'portrait_4_3' as const,
      },
    })

    const data = result.data as { images?: { url: string }[] }
    const frameUrl = data?.images?.[0]?.url

    if (!frameUrl) throw new Error('冇生成到圖片')

    console.log('Generated frame:', frameUrl)
    return NextResponse.json({ frameUrl })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate frame error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
