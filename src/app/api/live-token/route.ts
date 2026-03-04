import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildContext } from '@/lib/ai'
import { buildSpecialistPrompt } from '@/lib/ai/prompts'
import { routeMessage } from '@/lib/ai/orchestrator'
import type { AIMessage } from '@/lib/ai'

const schema = z.object({
  conversationId: z.string().nullish(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini non configurato' }, { status: 503 })
  }

  const body = await request.json()
  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Input non valido' }, { status: 400 })
  }

  const userId = session.user.id
  const { conversationId } = result.data

  // Load user profile
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      birthDate: true,
      gender: true,
      height: true,
      weight: true,
      health: true,
      nutrition: true,
      training: true,
      mindfulness: true,
      goals: true,
    },
  })

  // Load conversation history if available
  let aiMessages: AIMessage[] = []
  if (conversationId) {
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 20,
    })
    aiMessages = history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
  }

  // Build context and get specialist prompt
  const context = buildContext(aiMessages, userId, userProfile)
  const routing = routeMessage('conversazione live', context)
  const systemPrompt = await buildSpecialistPrompt(
    routing.primarySpecialist,
    { ...context, domain: routing.domain },
  )

  // Add live-specific instructions to the system prompt
  const liveSystemPrompt = `${systemPrompt}

### Istruzioni per sessione live (voce)
- Stai conversando IN TEMPO REALE via voce con l'utente.
- Rispondi in modo conciso e naturale, come in una conversazione telefonica.
- Frasi brevi e dirette. Evita muri di testo.
- Usa un tono colloquiale ma professionale.
- Se l'utente parla di più argomenti, rispondi uno alla volta.
- Fai domande brevi per chiarire se necessario.
`

  return NextResponse.json({
    apiKey,
    model: 'gemini-2.0-flash-live',
    systemPrompt: liveSystemPrompt,
    specialist: routing.primarySpecialist,
  })
}
