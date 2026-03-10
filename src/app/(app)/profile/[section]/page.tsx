import { notFound } from 'next/navigation'
import { ProfileShell } from '@/components/profile/ProfileShell'
import { PersonalPageContent } from '@/components/profile/pages/PersonalPageContent'
import { HealthPageContent } from '@/components/profile/pages/HealthPageContent'
import { NutritionPageContent } from '@/components/profile/pages/NutritionPageContent'
import { TrainingPageContent } from '@/components/profile/pages/TrainingPageContent'
import { MindfulnessPageContent } from '@/components/profile/pages/MindfulnessPageContent'
import { GoalsPageContent } from '@/components/profile/pages/GoalsPageContent'
import { HistoryPageContent } from '@/components/profile/pages/HistoryPageContent'
import { SettingsPageContent } from '@/components/profile/pages/SettingsPageContent'

const sectionComponents: Record<string, React.ComponentType> = {
  personal: PersonalPageContent,
  health: HealthPageContent,
  nutrition: NutritionPageContent,
  training: TrainingPageContent,
  mindfulness: MindfulnessPageContent,
  goals: GoalsPageContent,
  history: HistoryPageContent,
  settings: SettingsPageContent,
}

const sectionTitles: Record<string, string> = {
  personal: 'Personale',
  health: 'Salute',
  nutrition: 'Nutrizione',
  training: 'Allenamento',
  mindfulness: 'Mindfulness',
  goals: 'Obiettivi',
  history: 'Storico',
  settings: 'Impostazioni',
}

export function generateStaticParams() {
  return Object.keys(sectionComponents).map((section) => ({ section }))
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  return { title: sectionTitles[section] ?? 'Profilo' }
}

export default async function ProfileSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const Content = sectionComponents[section]
  if (!Content) notFound()

  return (
    <ProfileShell>
      <Content />
    </ProfileShell>
  )
}
