import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/security/errorSchema'

const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB per file
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

    // Extract text content for text-based files
    let extractedText: string | null = null
    if (mimeType.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
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
