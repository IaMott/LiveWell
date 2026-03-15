import { getAuthUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Diagnostic endpoint — returns DB + auth status for the current user.
 *  Only enabled when ENABLE_DEBUG_ENDPOINT=1 is set in Vercel env, or in dev. */
export async function GET(request: Request): Promise<Response> {
  const enabled =
    process.env.NODE_ENV === 'development' || process.env.ENABLE_DEBUG_ENDPOINT === '1'
  if (!enabled) {
    return Response.json({ error: 'debug endpoint disabled' }, { status: 404 })
  }

  const userId = await getAuthUserId(request)
  if (!userId) {
    return Response.json({ auth: 'unauthenticated', userId: null })
  }

  const result: Record<string, unknown> = { auth: 'ok', userId }

  try {
    const convCount = await prisma.conversation.count({ where: { userId } })
    result.conversationCount = convCount

    const msgCount = await prisma.message.count({
      where: { conversation: { userId } },
    })
    result.messageCount = msgCount

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    })
    result.userExists = !!user
    result.userEmail = user?.email ?? null
  } catch (err) {
    result.dbError = String(err)
  }

  // Test a simple write to check if persistence works
  try {
    const testConvId = `debug-test-${Date.now()}`
    await prisma.conversation.create({
      data: { id: testConvId, userId, title: '__debug_test__' },
    })
    await prisma.conversation.delete({ where: { id: testConvId } })
    result.writeTest = 'ok'
  } catch (err) {
    result.writeTest = `FAILED: ${String(err)}`
  }

  return Response.json(result)
}
