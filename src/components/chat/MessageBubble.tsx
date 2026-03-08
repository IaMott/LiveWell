import type { ChatMessage } from '@/hooks/useChat'
import type { Domain } from '@/lib/ai/types'

const DOMAIN_COLORS: Record<Domain, string> = {
  nutrition: '#AF52DE',
  training: '#007AFF',
  health: '#34C759',
  mindfulness: '#5AC8FA',
  inspiration: '#FF9F0A',
  general: '#8E8E93',
  coordination: '#8E8E93',
}

type Props = {
  message: ChatMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const domainColor = message.domain ? DOMAIN_COLORS[message.domain] : undefined

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '0.25rem 1rem',
      }}
    >
      {!isUser && domainColor && (
        <div
          style={{
            width: '3px',
            borderRadius: '2px',
            backgroundColor: domainColor,
            marginRight: '0.5rem',
            flexShrink: 0,
            alignSelf: 'stretch',
            minHeight: '1.5rem',
          }}
        />
      )}
      <div
        style={{
          maxWidth: '72%',
          backgroundColor: 'var(--color-surface)',
          borderRadius: isUser ? '1.25rem 1.25rem 0.375rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.375rem',
          padding: '0.625rem 0.875rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
      >
        {message.streaming && !message.content ? (
          <TypingDots />
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              lineHeight: 1.5,
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
            {message.streaming && <span style={{ opacity: 0.5 }}>▋</span>}
          </p>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-text-secondary)',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            display: 'inline-block',
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
