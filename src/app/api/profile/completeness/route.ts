import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  completenessSectionOrder,
  computeProfileCompleteness,
  type CompletenessSection,
  type SectionCompleteness,
} from '@/lib/profile/completeness'

const querySchema = z.object({
  section: z
    .enum(['all', ...completenessSectionOrder])
    .optional()
    .default('all'),
})

function computeOverallCompletion(sections: SectionCompleteness[]): number {
  if (sections.length === 0) return 0
  const total = sections.reduce((sum, section) => sum + section.completion, 0)
  return Math.round(total / sections.length)
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsedQuery = querySchema.safeParse({
    section: url.searchParams.get('section') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Query non valida' }, { status: 400 })
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
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

  const allSections = computeProfileCompleteness(profile)
  const selectedSections =
    parsedQuery.data.section === 'all'
      ? allSections
      : allSections.filter(
          (section) => section.section === (parsedQuery.data.section as CompletenessSection),
        )

  return NextResponse.json({
    sections: selectedSections.map((section) => ({
      section: section.section,
      completion: section.completion,
      missingFields: section.missingFields,
      nextField: section.nextField,
    })),
    overallCompletion: computeOverallCompletion(selectedSections),
  })
}
