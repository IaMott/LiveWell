import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import type { ReactNode } from 'react'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  return <>{children}</>
}
