import type { ChatMessage, ThinkingStep } from '@/hooks/useChat'
import type { Domain } from '@/lib/ai/types'
import { FeedbackWidget } from './FeedbackWidget'
import { DOMAIN_COLORS } from '@/lib/ui/domainColors'

/** Convert a hex color to rgba with the given alpha */
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return `rgba(142, 142, 147, ${alpha})`
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`
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
  conversationId?: string
}

export function MessageBubble({ message, conversationId }: Props) {
  const isUser = message.role === 'user'
  const domainColor = message.domain ? DOMAIN_COLORS[message.domain] : undefined
  const specialistLabel =
    !isUser && message.specialistName
      ? message.specialistName
      : !isUser && message.domain && DOMAIN_LABELS[message.domain]
        ? DOMAIN_LABELS[message.domain]
        : null

  const thinkingSteps: ThinkingStep[] = message.thinkingSteps ?? []

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

      <div
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          width: '100%',
        }}
      >
        <div
          style={{
            maxWidth: '72%',
            backgroundColor:
              !isUser && domainColor ? hexToRgba(domainColor, 0.14) : 'var(--color-surface)',
            borderRadius: isUser
              ? '1.25rem 1.25rem 0.375rem 1.25rem'
              : '1.25rem 1.25rem 1.25rem 0.375rem',
            padding: '0.625rem 0.875rem',
            boxShadow:
              !isUser && domainColor
                ? `0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 1px ${hexToRgba(domainColor, 0.18)}`
                : '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {message.streaming && !message.content ? (
            <ThinkingDots steps={thinkingSteps} />
          ) : (
            <MarkdownContent content={message.content} streaming={message.streaming} />
          )}
        </div>
      </div>

      {/* Feedback widget — only for completed assistant messages */}
      {!isUser && !message.streaming && message.content && conversationId && (
        <FeedbackWidget
          messageId={message.id}
          conversationId={conversationId}
          agentName={message.specialistName ?? specialistLabel ?? undefined}
          domain={message.domain}
        />
      )}
    </div>
  )
}

/** Lightweight inline markdown renderer */
function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
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
            {streaming && i === blocks.length - 1 && <span style={{ opacity: 0.5 }}>▋</span>}
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

/**
 * ThinkingDots — shows accumulated reasoning steps while the AI is thinking.
 *
 * Format (as requested):
 *   • Previous steps: faded out (opacity 0.3), no dots
 *   • Latest step: full opacity, with bouncing dots to the left
 *   • Each step: [SpecialistName] → [title]
 *                  [thought (italic, smaller)]
 */
function ThinkingDots({ steps }: { steps: ThinkingStep[] }) {
  // Show up to last 5 steps; all visible, latest highlighted
  const visible = steps.slice(-5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '3px 0' }}>
      {visible.map((step, i) => {
        const isLatest = i === visible.length - 1
        return (
          <div
            key={`${i}-${step.specialistName}-${step.title}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              opacity: isLatest ? 1 : 0.7,
              animation: isLatest ? 'lw-step-in 0.3s ease forwards' : undefined,
            }}
          >
            {/* Row: [dots if latest] [Name → title] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Bouncing dots only on latest step */}
              {isLatest && (
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
                  {[0, 1, 2].map((j) => (
                    <span
                      key={j}
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-text-secondary)',
                        animation: `lw-bounce 1.4s ease-in-out ${j * 0.2}s infinite`,
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Name → title */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  maxWidth: '300px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginLeft: isLatest ? 0 : '17px', // align with dots offset
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.6875rem',
                    letterSpacing: '0.06em',
                  }}
                >
                  {step.specialistName}
                </span>
                <span style={{ opacity: 0.5, fontWeight: 400 }}>→</span>
                <span style={{ fontWeight: 400 }}>{step.title}</span>
              </span>
            </div>
            {/* FIX-1: Show full specialist reasoning — wrap text, no truncation */}
            {step.thought && (
              <span
                style={{
                  marginLeft: '17px',
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-secondary)',
                  fontStyle: 'italic',
                  opacity: isLatest ? undefined : 0.7,
                  animation: isLatest ? 'lw-thought-in 0.4s ease 0.2s forwards' : undefined,
                  maxWidth: '320px',
                  display: 'block',
                  lineHeight: 1.4,
                }}
              >
                {step.thought}
              </span>
            )}
          </div>
        )
      })}

      {/* Fallback: plain dots when no steps yet */}
      {visible.length === 0 && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
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
        </div>
      )}

      <style>{`
        @keyframes lw-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes lw-step-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lw-thought-in {
          from { opacity: 0; }
          to { opacity: 0.75; }
        }
      `}</style>
    </div>
  )
}
