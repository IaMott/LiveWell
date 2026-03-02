'use client'

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  className?: string
}

export function ChatInput({ onSend, disabled, className }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = value.trim()
      if (!trimmed || disabled) return
      onSend(trimmed)
      setValue('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    },
    [value, disabled, onSend],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'shrink-0 border-t border-surface-dim bg-surface/80 backdrop-blur-sm',
        'px-[var(--spacing-chat-px)] py-3',
        className,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <div
          className={cn(
            'flex min-h-[2.75rem] flex-1 items-end rounded-[var(--radius-input)]',
            'border border-surface-dim bg-surface-bright px-4 py-2',
            'focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400/30',
            'transition-colors',
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            rows={1}
            disabled={disabled}
            className={cn(
              'max-h-40 w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed',
              'text-on-surface placeholder:text-on-surface-muted',
              'outline-none disabled:opacity-50',
            )}
          />
        </div>

        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
            'bg-brand-500 text-white transition-all',
            'hover:bg-brand-600 active:scale-95',
            'disabled:opacity-40 disabled:hover:bg-brand-500 disabled:active:scale-100',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          )}
          aria-label="Invia messaggio"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </form>
  )
}
