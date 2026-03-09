import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SettingsSection } from '@/components/profile/sections/SettingsSection'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  })

  return (
    <SettingsSection
      user={{ email: user?.email ?? '', name: user?.name ?? null }}
    />
  )
}
