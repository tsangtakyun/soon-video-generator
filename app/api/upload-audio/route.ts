import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')

    // 上傳到 fal.ai storage
    const uploadFormData = new FormData()
    uploadFormData.append('file', file)

    const response = await fetch('https://rest.alpha.fal.ai/storage/upload/file', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
      },
      body: uploadFormData,
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.detail || 'Upload error')

    return NextResponse.json({ url: data.access_url || data.url })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
