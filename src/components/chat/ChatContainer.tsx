'use client'

import { useState, useCallback } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { AppShell } from '@/components/layout/AppShell'
import type { ChatMessage } from './MessageBubble'

export function ChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const handleSend = useCallback((content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])

    // Mock assistant reply — replaced by real orchestrator in STEP 5+7
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Ho ricevuto il tuo messaggio. Il team di specialisti è in fase di configurazione (STEP 5-8).`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    }, 800)
  }, [])

  return (
    <AppShell>
      <MessageList messages={messages} />
      <ChatInput onSend={handleSend} />
    </AppShell>
  )
}
