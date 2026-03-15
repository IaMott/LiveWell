import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import type { ReactNode } from 'react'
import { ChatProvider } from '@/contexts/ChatContext'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')
  // ChatProvider lives at layout level so chat state and streaming persist
  // across client-side navigation (profile, settings, etc.)
  return <ChatProvider>{children}</ChatProvider>
}
