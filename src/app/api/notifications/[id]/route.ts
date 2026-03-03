import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { id } = await params

  const notification = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!notification) {
    return NextResponse.json({ error: 'Notifica non trovata' }, { status: 404 })
  }

  await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { id } = await params

  const notification = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!notification) {
    return NextResponse.json({ error: 'Notifica non trovata' }, { status: 404 })
  }

  await prisma.notification.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
