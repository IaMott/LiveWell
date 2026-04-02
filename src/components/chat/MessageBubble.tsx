import { useState, memo } from 'react'
import type { ChatMessage, ThinkingStep, QuickReplyOption } from '@/hooks/useChat'
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
  nutrition: 'Dietista',
  training: 'Personal Trainer',
  health: 'Medico di Base',
  mindfulness: 'Mental Coach',
  inspiration: 'Coach Motivazionale',
}

type Props = {
  message: ChatMessage
  conversationId?: string
  onSend?: (text: string) => void
  onEdit?: () => void
  activeDomain?: Domain | null
  onReply?: (messageId: string, content: string) => void
}

function MessageBubbleInner({
  message,
  conversationId,
  onSend,
  onEdit,
  activeDomain,
  onReply,
}: Props) {
  const isUser = message.role === 'user'
  const [hovered, setHovered] = useState(false)
  // Reasoning accordion: open while streaming (no content yet), closed once content arrives
  const hasContent = message.content.length > 0
  const [reasoningOpen, setReasoningOpen] = useState(false)
  const resolvedDomain = !isUser ? (message.domain ?? activeDomain ?? undefined) : undefined
  const domainColor = resolvedDomain ? DOMAIN_COLORS[resolvedDomain] : undefined
  const specialistLabel =
    !isUser && message.specialistName
      ? message.specialistName
      : !isUser && resolvedDomain && DOMAIN_LABELS[resolvedDomain]
        ? DOMAIN_LABELS[resolvedDomain]
        : null

  const thinkingSteps: ThinkingStep[] = message.thinkingSteps ?? []
  const showReasoningAccordion = !isUser && thinkingSteps.length > 0

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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

      {/* Reply-to quote indicator */}
      {message.replyToContent && (
        <div
          style={{
            maxWidth: '72%',
            marginBottom: '0.25rem',
            padding: '0.375rem 0.625rem',
            borderLeft: '3px solid var(--color-separator)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: '0 0.5rem 0.5rem 0',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            fontStyle: 'italic',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {message.replyToContent.length > 80
            ? message.replyToContent.slice(0, 77) + '...'
            : message.replyToContent}
        </div>
      )}

      {/* Reasoning accordion — shown above the bubble when steps exist */}
      {showReasoningAccordion && (
        <div
          style={{
            maxWidth: '72%',
            width: '100%',
            marginBottom: '0.375rem',
          }}
        >
          {/* Toggle header */}
          {hasContent ? (
            <button
              type="button"
              onClick={() => setReasoningOpen((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.125rem 0.375rem',
                marginLeft: '0.125rem',
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary)',
                borderRadius: '4px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
            >
              <svg
                viewBox="0 0 16 16"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: reasoningOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <polyline points="4 6 8 10 12 6" />
              </svg>
              Ragionamento ({thinkingSteps.length} step{thinkingSteps.length !== 1 ? 's' : ''})
            </button>
          ) : null}

          {/* Expanded content: animated during streaming, static when collapsed/expanded */}
          {(!hasContent || reasoningOpen) && (
            <div
              style={{
                marginTop: hasContent ? '0.25rem' : '0',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-separator)',
                borderRadius: '0.75rem',
                animation: hasContent ? 'lw-accordion-in 0.2s ease forwards' : undefined,
              }}
            >
              <ThinkingDots steps={thinkingSteps} animating={!hasContent} />
            </div>
          )}
        </div>
      )}

      {!(message.streaming && !hasContent && thinkingSteps.length > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            width: '100%',
          }}
        >
          <div
            data-testid={!isUser ? 'assistant-bubble' : 'user-bubble'}
            data-domain={resolvedDomain ?? ''}
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
            {message.streaming && !hasContent ? (
              // Show bouncing dots while waiting for content and no reasoning steps yet
              !isUser && thinkingSteps.length === 0 ? (
                <div
                  style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}
                >
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
              ) : null
            ) : (
              <MarkdownContent content={message.content} streaming={message.streaming} />
            )}
          </div>
        </div>
      )}

      {/* Edit button — shown on hover for user messages */}
      {isUser && hovered && !message.streaming && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifica messaggio"
          style={{
            marginTop: '0.25rem',
            marginRight: '0.125rem',
            padding: '0.25rem 0.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.6875rem',
            color: 'var(--color-text-secondary)',
            borderRadius: '4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Modifica
        </button>
      )}

      {/* Reply button — shown on hover for completed assistant messages */}
      {!isUser && hovered && !message.streaming && message.content && onReply && (
        <button
          type="button"
          onClick={() => onReply(message.id, message.content)}
          aria-label="Rispondi a questo messaggio"
          style={{
            marginTop: '0.25rem',
            marginLeft: '0.125rem',
            padding: '0.25rem 0.5rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.6875rem',
            color: 'var(--color-text-secondary)',
            borderRadius: '4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 00-4-4H4" />
          </svg>
          Rispondi
        </button>
      )}

      {/* Quick-reply buttons (multi-domain triage, specialist suggestions) */}
      {!isUser && !message.streaming && message.quickReplies && message.quickReplies.length > 0 && (
        <QuickReplies options={message.quickReplies} onSelect={onSend} />
      )}

      {/* Feedback widget — only for completed assistant messages */}
      {!isUser && !message.streaming && message.content && conversationId && (
        <FeedbackWidget
          messageId={message.id}
          conversationId={conversationId}
          agentName={message.specialistName ?? specialistLabel ?? undefined}
          domain={resolvedDomain}
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

type AgentStepsGroup = {
  specialistName: string
  domain?: string
  steps: ThinkingStep[]
  isExpanded: boolean
}

function groupStepsByAgent(steps: ThinkingStep[]): AgentStepsGroup[] {
  const groups: AgentStepsGroup[] = []
  for (const step of steps) {
    const existing = groups.find((g) => g.specialistName === step.specialistName)
    if (existing) {
      existing.steps.push(step)
    } else {
      groups.push({
        specialistName: step.specialistName,
        domain: step.domain as string | undefined,
        steps: [step],
        isExpanded: false,
      })
    }
  }
  return groups
}

/**
 * ThinkingDots — shows accumulated reasoning steps while the AI is thinking.
 *
 * When animating (streaming): shows last 5 steps sequentially with live dots.
 * When complete: groups steps by agent, each group collapsible with step count.
 *
 * Backward compat: if all steps have the same specialistName, falls back to flat view.
 */
function ThinkingDots({ steps, animating = true }: { steps: ThinkingStep[]; animating?: boolean }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // While streaming: show last 5 to follow live progress (flat view)
  if (animating) {
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    letterSpacing: '0.02em',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '5px',
                    minWidth: 0,
                    flex: 1,
                    marginLeft: isLatest ? 0 : '17px',
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
              {step.thought && step.thought.trim() !== step.title.trim() && (
                <span
                  style={{
                    marginLeft: '17px',
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                    opacity: isLatest ? undefined : 0.7,
                    animation: isLatest ? 'lw-thought-in 0.4s ease 0.2s forwards' : undefined,
                    display: 'block',
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {step.thought}
                </span>
              )}
            </div>
          )
        })}
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

  // Completed: group by agent, each group collapsible
  const groups = groupStepsByAgent(steps)

  // Backward compat: if only one unique specialist, flat view
  const allSameName = groups.length <= 1
  if (allSameName) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', padding: '3px 0' }}>
        {steps.map((step, i) => (
          <div
            key={`${i}-${step.specialistName}-${step.title}`}
            style={{ display: 'flex', flexDirection: 'column', gap: '2px', opacity: 1 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '5px',
                  minWidth: 0,
                  flex: 1,
                  marginLeft: '17px',
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
            {step.thought && step.thought.trim() !== step.title.trim() && (
              <span
                style={{
                  marginLeft: '17px',
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-secondary)',
                  fontStyle: 'italic',
                  opacity: 0.7,
                  display: 'block',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                {step.thought}
              </span>
            )}
          </div>
        ))}
        <style>{`
          @keyframes lw-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
            30% { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // Multi-agent grouped view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '3px 0' }}>
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.specialistName)
        return (
          <div key={group.specialistName}>
            {/* Group header — click to expand/collapse */}
            <button
              type="button"
              onClick={() => toggleGroup(group.specialistName)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                fontSize: '0.6875rem',
                color: 'var(--color-text-secondary)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span style={{ opacity: 0.6, fontSize: '0.625rem' }}>{isExpanded ? '▼' : '▶'}</span>
              <span
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.6875rem',
                }}
              >
                {group.specialistName}
              </span>
              <span style={{ opacity: 0.5 }}>—</span>
              <span style={{ opacity: 0.6 }}>
                {group.steps.length} step{group.steps.length !== 1 ? 's' : ''}
              </span>
            </button>

            {/* Expanded steps */}
            {isExpanded && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  marginLeft: '16px',
                  marginTop: '2px',
                  paddingLeft: '8px',
                  borderLeft: '1px solid var(--color-separator)',
                }}
              >
                {group.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 500,
                      }}
                    >
                      {step.title}
                    </span>
                    {step.thought && step.thought.trim() !== step.title.trim() && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--color-text-secondary)',
                          fontStyle: 'italic',
                          opacity: 0.7,
                          lineHeight: 1.4,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {step.thought}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
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

/**
 * Quick-reply buttons — tappable suggestions below an assistant message.
 * Tapping a button sends its text as a new user message.
 */
function QuickReplies({
  options,
  onSelect,
}: {
  options: QuickReplyOption[]
  onSelect?: (text: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginTop: '0.5rem',
        marginLeft: '0.25rem',
        animation: 'lw-qr-in 0.3s ease forwards',
      }}
    >
      {options.map((option) => {
        const domainColor = option.domain ? DOMAIN_COLORS[option.domain] : undefined
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect?.(option.text)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: domainColor ?? 'var(--color-text-primary)',
              backgroundColor: domainColor ? hexToRgba(domainColor, 0.1) : 'var(--color-surface)',
              border: `1.5px solid ${domainColor ? hexToRgba(domainColor, 0.3) : 'var(--color-separator)'}`,
              borderRadius: '1.25rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget
              btn.style.backgroundColor = domainColor
                ? hexToRgba(domainColor, 0.2)
                : 'var(--color-separator)'
              btn.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget
              btn.style.backgroundColor = domainColor
                ? hexToRgba(domainColor, 0.1)
                : 'var(--color-surface)'
              btn.style.transform = 'translateY(0)'
            }}
          >
            {option.emoji && <span>{option.emoji}</span>}
            <span>{option.label.replace(/^.+?\s/, '')}</span>
          </button>
        )
      })}
      <style>{`
        @keyframes lw-qr-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lw-accordion-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleInner)
