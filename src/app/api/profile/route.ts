import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  jsonSize,
  parseProfileSectionUpdate,
  profileSectionEnum,
  safeParseProfileSectionUpdate,
  type ProfileSection,
} from '@/lib/profile/schema'

const MAX_SECTION_SIZE = 10_000 // 10 KB max per section

const profileUpdateSchema = z.object({
  section: profileSectionEnum,
  data: z.unknown(),
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
      health: safeParseProfileSectionUpdate('health', profile.health),
      nutrition: safeParseProfileSectionUpdate('nutrition', profile.nutrition),
      training: safeParseProfileSectionUpdate('training', profile.training),
      mindfulness: safeParseProfileSectionUpdate('mindfulness', profile.mindfulness),
      goals: safeParseProfileSectionUpdate('goals', profile.goals),
      settings: safeParseProfileSectionUpdate('settings', profile.settings),
    },
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

type UserSettings = {
  notifications: boolean
  theme: 'system' | 'light' | 'dark'
  language: 'it' | 'en'
}

function pickUserSettingsFields(value: Record<string, unknown>): UserSettings {
  return {
    notifications: value.notifications === false ? false : true,
    theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
    language: value.language === 'en' ? 'en' : 'it',
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // Rate limit: 20 profile updates per minute per user
  const rl = rateLimit(`profile:${session.user.id}`, { max: 20 })
  if (!rl.success) return rateLimitResponse(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const result = profileUpdateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    )
  }

  const { section, data } = result.data
  const userId = session.user.id

  let parsedData: Record<string, unknown>
  try {
    parsedData = parseProfileSectionUpdate(section, data)
  } catch {
    return NextResponse.json({ error: 'Dati sezione non validi' }, { status: 400 })
  }

  if (jsonSize(parsedData) > MAX_SECTION_SIZE) {
    return NextResponse.json(
      { error: 'Dati profilo troppo grandi (max 10 KB)' },
      { status: 400 },
    )
  }

  // Build the update payload based on section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {}

  if (section === 'personal') {
    const personalData = parsedData as {
      name?: string
      birthDate?: string | null
      gender?: string | null
      height?: number | null
      weight?: number | null
    }

    if (personalData.birthDate !== undefined) {
      updateData.birthDate = personalData.birthDate
        ? new Date(personalData.birthDate)
        : null
    }
    if (personalData.gender !== undefined) {
      updateData.gender = personalData.gender
    }
    if (personalData.height !== undefined) {
      updateData.height = personalData.height
    }
    if (personalData.weight !== undefined) {
      updateData.weight = personalData.weight
    }

    // Also update User.name
    if (personalData.name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: personalData.name },
      })
    }
  } else {
    if (section === 'settings') {
      const existingProfile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { settings: true },
      })
      const existingSettings = asRecord(existingProfile?.settings)
      const userSettings = pickUserSettingsFields(parsedData)
      updateData.settings = { ...existingSettings, ...userSettings }
    } else {
      updateData[section as Exclude<ProfileSection, 'personal' | 'settings'>] =
        parsedData
    }
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, ...updateData },
    update: updateData,
  })

  return NextResponse.json({ success: true, profile })
}
