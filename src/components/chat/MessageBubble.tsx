'use client'

import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[var(--radius-bubble)] px-4 py-2.5 text-[0.9375rem] leading-relaxed',
          'sm:max-w-[70%]',
          isUser
            ? 'bg-bubble-user text-bubble-user-text rounded-br-md'
            : 'bg-bubble-assistant text-bubble-assistant-text rounded-bl-md',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <time
          className={cn(
            'mt-1 block text-right text-[0.6875rem]',
            isUser ? 'text-bubble-user-text/60' : 'text-on-surface-muted',
          )}
          dateTime={message.timestamp.toISOString()}
        >
          {message.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </div>
  )
}
