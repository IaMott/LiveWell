import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const profileUpdateSchema = z.object({
  section: z.enum([
    'personal',
    'health',
    'nutrition',
    'training',
    'mindfulness',
    'goals',
    'settings',
  ]),
  data: z.record(z.unknown()),
})

export async function GET(): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
  })

  if (!profile) {
    return NextResponse.json({ profile: null })
  }

  return NextResponse.json({
    profile: {
      birthDate: profile.birthDate,
      gender: profile.gender,
      height: profile.height,
      weight: profile.weight,
      health: profile.health,
      nutrition: profile.nutrition,
      training: profile.training,
      mindfulness: profile.mindfulness,
      goals: profile.goals,
      settings: profile.settings,
    },
  })
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json()
  const result = profileUpdateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    )
  }

  const { section, data } = result.data
  const userId = session.user.id

  // Build the update payload based on section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (section === 'personal') {
    if (data.birthDate) updateData.birthDate = new Date(data.birthDate as string)
    if (data.gender !== undefined) updateData.gender = data.gender as string
    if (data.height !== undefined) updateData.height = Number(data.height)
    if (data.weight !== undefined) updateData.weight = Number(data.weight)
    // Also update User.name
    if (data.name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: data.name as string },
      })
    }
  } else {
    // JSON sections: health, nutrition, training, mindfulness, goals, settings
    updateData[section] = data
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  })

  return NextResponse.json({ success: true, profile })
}
