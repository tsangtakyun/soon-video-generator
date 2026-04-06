import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const { characterImageUrl, prompt } = await req.json()

    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    let imageUrl = characterImageUrl
    if (characterImageUrl.startsWith('data:')) {
      const response = await fetch(characterImageUrl)
      const blob = await response.blob()
      const file = new File([blob], 'character.jpg', { type: blob.type })
      imageUrl = await fal.storage.upload(file)
      console.log('Uploaded character image:', imageUrl)
    }

    const response = await fetch('https://fal.run/fal-ai/flux/dev/redux', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        num_images: 1,
        image_size: {
          width: 720,
          height: 1280,
        },
      }),
    })

    const data = await response.json()
    console.log('Flux Redux response:', JSON.stringify(data).substring(0, 200))

    if (!response.ok) throw new Error(data.detail || JSON.stringify(data))

    const frameUrl = data?.images?.[0]?.url
    if (!frameUrl) throw new Error('冇生成到圖片')

    return NextResponse.json({ frameUrl })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Generate frame error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
