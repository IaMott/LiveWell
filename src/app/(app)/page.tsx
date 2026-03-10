import { auth } from '@/lib/auth'
import { ChatShell } from '@/components/chat/ChatShell'

export default async function HomePage() {
  const session = await auth()
  const name = session?.user?.name ?? ''
  const initials = name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ME'
  return <ChatShell userInitials={initials} />
}
