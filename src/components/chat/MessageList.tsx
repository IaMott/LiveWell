'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '@/hooks/useChat'
import type { Domain } from '@/lib/ai/types'

type Props = {
  messages: ChatMessage[]
  conversationId?: string
  onSend?: (text: string) => void
  onEdit?: (messageId: string) => void
  activeDomain?: Domain | null
  onReply?: (messageId: string, content: string) => void
}

export function MessageList({
  messages,
  conversationId,
  onSend,
  onEdit,
  activeDomain,
  onReply,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '2rem',
        }}
      >
        <p
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          LiveWell
        </p>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Il tuo team di professionisti è pronto.
          <br />
          Cosa ti posso aiutare oggi?
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
      }}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          conversationId={conversationId}
          onSend={onSend}
          onEdit={onEdit ? () => onEdit(msg.id) : undefined}
          activeDomain={activeDomain}
          onReply={onReply}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
