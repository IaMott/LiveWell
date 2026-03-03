'use client'

import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ShareMenu } from './share'
import { AppShell } from '@/components/layout/AppShell'
import { useChat } from '@/hooks/useChat'

export function ChatContainer() {
  const { messages, isStreaming, conversationId, sendMessage } = useChat()

  return (
    <AppShell>
      <MessageList messages={messages} isStreaming={isStreaming} />
      <div className="relative">
        {conversationId && (
          <div className="absolute -top-10 right-4 z-10">
            <ShareMenu conversationId={conversationId} />
          </div>
        )}
        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </AppShell>
  )
}
