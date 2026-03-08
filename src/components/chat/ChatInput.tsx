'use client'

import { useState, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import { Mic, Plus, Clock, Apple, Dumbbell, Heart, Brain, Lightbulb } from 'lucide-react'
import type { Domain } from '@/lib/ai/types'

const DOMAINS: Array<{ domain: Domain; icon: typeof Apple; label: string }> = [
  { domain: 'nutrition', icon: Apple, label: 'Nutrizione' },
  { domain: 'training', icon: Dumbbell, label: 'Allenamento' },
  { domain: 'health', icon: Heart, label: 'Salute' },
  { domain: 'mindfulness', icon: Brain, label: 'Mindfulness' },
  { domain: 'inspiration', icon: Lightbulb, label: 'Idee' },
]

const DOMAIN_COLORS: Partial<Record<Domain, string>> = {
  nutrition: '#AF52DE',
  training: '#007AFF',
  health: '#34C759',
  mindfulness: '#5AC8FA',
  inspiration: '#FF9F0A',
}

type Props = {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: Props) {
  const [text, setText] = useState('')
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function toggleDomain(domain: Domain) {
    setActiveDomain((prev) => (prev === domain ? null : domain))
  }

  const canSend = text.trim().length > 0 && !disabled

  return (
    <div style={{ padding: '0.5rem 0.75rem 1.5rem' }}>
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: '1.25rem',
          border: '1px solid var(--color-separator)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '0.75rem 0.875rem 0.5rem',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything"
          rows={1}
          disabled={disabled}
          aria-label="Messaggio"
          style={{
            width: '100%',
            resize: 'none',
            outline: 'none',
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '0.375rem',
            gap: '0.125rem',
          }}
        >
          {/* History */}
          <button
            type="button"
            aria-label="Storico"
            style={{
              padding: '0.375rem',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Clock size={18} strokeWidth={1.5} />
          </button>

          {/* Separator */}
          <div
            style={{
              width: '1px',
              height: '16px',
              backgroundColor: 'var(--color-separator)',
              margin: '0 0.25rem',
            }}
          />

          {/* Domain icons */}
          {DOMAINS.map(({ domain, icon: Icon, label }) => {
            const isActive = activeDomain === domain
            const color = DOMAIN_COLORS[domain] ?? 'var(--color-text-secondary)'
            return (
              <button
                key={domain}
                type="button"
                aria-label={label}
                onClick={() => toggleDomain(domain)}
                style={{
                  padding: '0.375rem',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: isActive ? `${color}18` : 'transparent',
                  cursor: 'pointer',
                  color: isActive ? color : 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s, background-color 0.15s',
                }}
              >
                <Icon size={18} strokeWidth={1.5} />
              </button>
            )
          })}

          {/* Right side actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              aria-label="Aggiungi allegato"
              style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--color-separator)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-primary)',
              }}
            >
              <Plus size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              aria-label="Registra messaggio vocale"
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                padding: '0.25rem',
              }}
            >
              <Mic size={20} strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              aria-label="Invia messaggio"
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: canSend ? 'var(--color-text-primary)' : 'var(--color-separator)',
                cursor: canSend ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s',
              }}
            >
              <SendArrow active={canSend} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SendArrow({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 1L7 13M7 1L2 6M7 1L12 6"
        stroke={active ? '#fff' : 'var(--color-text-secondary)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
