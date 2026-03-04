import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { auth } from '@/lib/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg',
]

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Tipo file non supportato.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File troppo grande. Massimo 10 MB.' },
      { status: 400 },
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const ext = file.name.split('.').pop() || 'bin'
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const uploadDir = join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })

  const filePath = join(uploadDir, uniqueName)
  await writeFile(filePath, buffer)

  const url = `/uploads/${uniqueName}`

  return NextResponse.json({
    url,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  })
}
