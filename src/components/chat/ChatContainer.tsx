'use client'

import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { AppShell } from '@/components/layout/AppShell'
import { useChat } from '@/hooks/useChat'

export function ChatContainer() {
  const { messages, isStreaming, sendMessage } = useChat()

  return (
    <AppShell>
      <MessageList messages={messages} isStreaming={isStreaming} />
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </AppShell>
  )
}
