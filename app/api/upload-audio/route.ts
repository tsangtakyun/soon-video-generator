import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export async function POST(req: NextRequest) {
  try {
    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    fal.config({ credentials: falApiKey })

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')

    console.log('File name:', file.name, 'Size:', file.size, 'Type:', file.type)

    const url = await fal.storage.upload(file)
    console.log('Uploaded URL:', url)

    return NextResponse.json({ url })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Upload error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
