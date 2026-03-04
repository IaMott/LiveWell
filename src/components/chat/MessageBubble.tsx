'use client'

import { cn } from '@/lib/utils'
import { ScanBarcode, Mic } from 'lucide-react'

export interface MessageAttachment {
  url: string
  fileName: string
  mimeType: string
  type: 'image' | 'barcode' | 'audio'
  barcodeValue?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  attachments?: MessageAttachment[]
  specialists?: string[]
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
        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {message.attachments.map((att, i) => {
              if (att.type === 'image') {
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={att.url}
                    alt={att.fileName}
                    className="max-h-48 rounded-lg object-contain"
                  />
                )
              }
              if (att.type === 'audio') {
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                      isUser ? 'bg-white/10' : 'bg-surface-dim',
                    )}
                  >
                    <Mic className="h-4 w-4 shrink-0" />
                    {att.url && (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio src={att.url} controls className="h-8 max-w-[200px]" />
                    )}
                  </div>
                )
              }
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                    isUser ? 'bg-white/10' : 'bg-surface-dim',
                  )}
                >
                  <ScanBarcode className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{att.barcodeValue}</span>
                </div>
              )
            })}
          </div>
        )}

        {message.content && (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {!isUser && message.specialists && message.specialists.length > 0 && (
          <p className="mt-2 text-[0.6875rem] text-on-surface-muted">
            Professionista: {message.specialists.join(', ')}
          </p>
        )}
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
