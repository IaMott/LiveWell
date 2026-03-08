'use client'

import { TopBar } from '@/components/layout/TopBar'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useChat } from '@/hooks/useChat'

type Props = { userInitials?: string }

export function ChatShell({ userInitials = 'ME' }: Props) {
  const { messages, send, isStreaming } = useChat()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        backgroundColor: 'var(--color-bg)',
        maxWidth: '640px',
        margin: '0 auto',
      }}
    >
      <TopBar userInitials={userInitials} />
      <MessageList messages={messages} />
      <ChatInput onSend={send} disabled={isStreaming} />
    </div>
  )
}
