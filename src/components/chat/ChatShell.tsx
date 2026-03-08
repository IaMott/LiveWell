'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConversationHistory } from './ConversationHistory'
import { useChat } from '@/hooks/useChat'

type Props = { userInitials?: string }

export function ChatShell({ userInitials = 'ME' }: Props) {
  const { messages, send, isStreaming, conversationId, loadConversation, newConversation } = useChat()
  const [historyOpen, setHistoryOpen] = useState(false)

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
      <ChatInput
        onSend={send}
        onHistory={() => setHistoryOpen(true)}
        disabled={isStreaming}
      />
      <ConversationHistory
        open={historyOpen}
        currentId={conversationId}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadConversation}
        onNew={newConversation}
      />
    </div>
  )
}
