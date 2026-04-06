import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const falApiKey = process.env.FAL_API_KEY
    if (!falApiKey) throw new Error('Missing FAL_API_KEY')

    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) throw new Error('No file provided')

    console.log('File name:', file.name)
    console.log('File size:', file.size)
    console.log('File type:', file.type)

    const uploadFormData = new FormData()
    uploadFormData.append('file', file)

    const response = await fetch('https://rest.alpha.fal.ai/storage/upload/file', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
      },
      body: uploadFormData,
    })

    console.log('Upload status:', response.status)
    const responseText = await response.text()
    console.log('Upload response:', responseText)

    if (!response.ok) throw new Error(`Upload failed: ${response.status} - ${responseText}`)

    const data = JSON.parse(responseText)
    const url = data.access_url || data.url
    console.log('File URL:', url)

    return NextResponse.json({ url })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Upload error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
