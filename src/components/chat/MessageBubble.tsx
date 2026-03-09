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

const DOMAIN_LABELS: Partial<Record<Domain, string>> = {
  nutrition: 'Nutrizionista',
  training: 'Personal Trainer',
  health: 'Medico',
  mindfulness: 'Mental Coach',
  inspiration: 'Coach',
}

type Props = {
  message: ChatMessage
  streamingSpecialistName?: string
}

export function MessageBubble({ message, streamingSpecialistName }: Props) {
  const isUser = message.role === 'user'
  const domainColor = message.domain ? DOMAIN_COLORS[message.domain] : undefined
  const specialistLabel =
    !isUser && message.specialistName
      ? message.specialistName
      : !isUser && message.domain && DOMAIN_LABELS[message.domain]
        ? DOMAIN_LABELS[message.domain]
        : null

  // Name to show in ThinkingDots: prefer message-level name (from ui.state), fallback to streaming context
  const thinkingName = message.specialistName ?? (message.streaming ? streamingSpecialistName : undefined)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        padding: '0.25rem 1rem',
      }}
    >
      {/* Specialist label above assistant bubble */}
      {specialistLabel && (
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: domainColor ?? 'var(--color-text-secondary)',
            marginBottom: '0.25rem',
            marginLeft: '0.375rem',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          {specialistLabel}
        </span>
      )}

      <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
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
            borderRadius: isUser
              ? '1.25rem 1.25rem 0.375rem 1.25rem'
              : '1.25rem 1.25rem 1.25rem 0.375rem',
            padding: '0.625rem 0.875rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {message.streaming && !message.content ? (
            <ThinkingDots specialistName={thinkingName} />
          ) : (
            <MarkdownContent
              content={message.content}
              streaming={message.streaming}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/** Lightweight inline markdown renderer */
function MarkdownContent({
  content,
  streaming,
}: {
  content: string
  streaming?: boolean
}) {
  const blocks = parseBlocks(content)

  return (
    <div
      style={{
        fontSize: '0.9375rem',
        lineHeight: 1.6,
        color: 'var(--color-text-primary)',
        wordBreak: 'break-word',
      }}
    >
      {blocks.map((block, i) => {
        if (block.type === 'bullet-list') {
          return (
            <ul key={i} style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
              {block.items!.map((item, j) => (
                <li key={j} style={{ marginBottom: '0.125rem' }}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === 'numbered-list') {
          return (
            <ol key={i} style={{ margin: '0.25rem 0', paddingLeft: '1.25rem' }}>
              {block.items!.map((item, j) => (
                <li key={j} style={{ marginBottom: '0.125rem' }}>
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={i} style={{ margin: i === 0 ? '0' : '0.5rem 0 0' }}>
            {renderInline(block.text ?? '')}
            {streaming && i === blocks.length - 1 && (
              <span style={{ opacity: 0.5 }}>▋</span>
            )}
          </p>
        )
      })}
      {!blocks.length && streaming && <span style={{ opacity: 0.5 }}>▋</span>}
    </div>
  )
}

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }
  | { type: 'numbered-list'; items: string[] }

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^[-*•]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'bullet-list', items })
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push({ type: 'numbered-list', items })
      continue
    }

    if (line.trim() === '') {
      i++
      continue
    }

    const paragraphLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[-*•]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i])
    ) {
      paragraphLines.push(lines[i])
      i++
    }
    if (paragraphLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') })
    }
  }

  return blocks
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4]) {
      parts.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.875em',
            backgroundColor: 'var(--color-separator)',
            borderRadius: '3px',
            padding: '0 3px',
          }}
        >
          {match[4]}
        </code>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return parts.length === 1 ? parts[0] : parts
}

function ThinkingDots({ specialistName }: { specialistName?: string }) {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '2px 0', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-text-secondary)',
            animation: `lw-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
            display: 'inline-block',
          }}
        />
      ))}
      {specialistName && (
        // key={specialistName} causes remount on agent switch → CSS animation replays (crossfade effect)
        <span
          key={specialistName}
          style={{
            marginLeft: '7px',
            fontSize: '0.6875rem',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            animation: 'lw-name-in 0.4s ease forwards',
          }}
        >
          {specialistName}
        </span>
      )}
      <style>{`
        @keyframes lw-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes lw-name-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 0.55; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
