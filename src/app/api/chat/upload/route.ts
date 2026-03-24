import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    // Dynamic import — avoids bundling the heavy lib at module load time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('pdf-parse')) as any
    const pdfParse = mod.default ?? mod
    const data = await pdfParse(buffer)
    return (data.text as string | undefined)?.trim() || null
  } catch {
    return null
  }
}

const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB per file
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB for inline base64 (stays within Neon text limits)
const MAX_TEXT_LENGTH = 60_000 // chars stored in extractedText

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'text/',
  'application/pdf',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats',
]

function isMimeAllowed(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))
}

export async function POST(request: Request): Promise<Response> {
  const userId = await getAuthUserId(request)
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', 'Authentication required')

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(400, 'BAD_REQUEST', 'Invalid form data')
  }

  const conversationId = (formData.get('conversationId') as string | null) || null
  const rawFiles = formData.getAll('file')
  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0)

  if (files.length === 0) return errorResponse(400, 'BAD_REQUEST', 'Nessun file fornito')

  const results: Array<{ id: string; filename: string; mimeType: string; size: number }> = []

  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_FILE_SIZE_BYTES) continue

    const mimeType = file.type || 'application/octet-stream'
    if (!isMimeAllowed(mimeType)) continue

    // Extract content based on file type
    let extractedText: string | null = null

    if (mimeType.startsWith('image/')) {
      // Store as inline base64 so Gemini can analyse it (max 4 MB)
      if (file.size <= MAX_IMAGE_SIZE_BYTES) {
        try {
          const bytes = await file.arrayBuffer()
          const base64 = Buffer.from(bytes).toString('base64')
          extractedText = `data:${mimeType};base64,${base64}`
        } catch {
          // skip — will be stored as metadata-only
        }
      }
    } else if (mimeType === 'application/pdf') {
      try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const pdfText = await extractPdfText(buffer)
        if (pdfText) {
          extractedText =
            pdfText.length > MAX_TEXT_LENGTH
              ? pdfText.slice(0, MAX_TEXT_LENGTH) + '\n…[troncato]'
              : pdfText
        }
      } catch {
        // PDF parsing failed — stored as metadata-only
      }
    } else if (
      mimeType.startsWith('text/') ||
      file.name.endsWith('.md') ||
      file.name.endsWith('.txt')
    ) {
      try {
        const raw = await file.text()
        extractedText =
          raw.length > MAX_TEXT_LENGTH ? raw.slice(0, MAX_TEXT_LENGTH) + '\n…[troncato]' : raw
      } catch {
        // not a text file
      }
    }

    try {
      const asset = await prisma.fileAsset.create({
        data: {
          userId,
          conversationId,
          filename: file.name,
          mimeType,
          size: file.size,
          extractedText,
        },
        select: { id: true, filename: true, mimeType: true, size: true },
      })
      results.push(asset)
    } catch {
      // best-effort: skip failed file
    }
  }

  if (results.length === 0) return errorResponse(400, 'BAD_REQUEST', 'Nessun file elaborato')

  return Response.json({ files: results })
}
