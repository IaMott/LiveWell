'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble, type ChatMessage } from './MessageBubble'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: ChatMessage[]
  className?: string
}

export function MessageList({ messages, className }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 flex-col items-center justify-center gap-3 p-8', className)}>
        <div className="text-4xl">👋</div>
        <h2 className="text-lg font-medium text-on-surface">Ciao! Sono il tuo team LiveWell</h2>
        <p className="max-w-sm text-center text-sm text-on-surface-muted">
          Chiedi qualsiasi cosa su nutrizione, allenamento, benessere mentale o salute. Il nostro
          team di specialisti è pronto ad aiutarti.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('chat-scroll flex-1 overflow-y-auto', className)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-[var(--spacing-chat-px)] py-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
