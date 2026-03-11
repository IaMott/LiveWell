import { auth } from '@/lib/auth'
import { ChatShell } from '@/components/chat/ChatShell'

export default async function ChatPage() {
  const session = await auth()
  const name = session?.user?.name ?? ''
  const image = session?.user?.image ?? null
  const initials = name
    ? name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ME'
  return <ChatShell userInitials={initials} userName={name} userImage={image} />
}
