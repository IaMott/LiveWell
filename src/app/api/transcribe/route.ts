import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isGeminiConfigured } from '@/lib/ai'

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'Trascrizione non disponibile (GEMINI_API_KEY non configurata)' },
      { status: 503 },
    )
  }

  const formData = await request.formData()
  const audio = formData.get('audio') as File | null

  if (!audio) {
    return NextResponse.json({ error: 'Nessun file audio fornito' }, { status: 400 })
  }

  if (audio.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio troppo grande. Massimo 10 MB.' }, { status: 400 })
  }

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const audioBytes = await audio.arrayBuffer()
    const base64Audio = Buffer.from(audioBytes).toString('base64')

    const response = await ai.models.generateContent({
      model: process.env.AI_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: audio.type,
                data: base64Audio,
              },
            },
            {
              text: 'Trascrivi questo audio in italiano. Restituisci SOLO il testo trascritto, senza commenti o formattazione aggiuntiva. Se l\'audio non è chiaro o è vuoto, rispondi con una stringa vuota.',
            },
          ],
        },
      ],
      config: {
        maxOutputTokens: 1024,
        temperature: 0.1,
      },
    })

    const transcript = response.text?.trim() ?? ''

    return NextResponse.json({ transcript })
  } catch (err) {
    console.error('[Transcribe] Error:', err)
    return NextResponse.json(
      { error: 'Errore durante la trascrizione' },
      { status: 500 },
    )
  }
}
