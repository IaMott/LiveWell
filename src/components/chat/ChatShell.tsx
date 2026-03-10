'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConversationHistory } from './ConversationHistory'
import { useChat } from '@/hooks/useChat'

type Props = { userInitials?: string }

const DOMAIN_COLORS: Record<string, string> = {
  nutrition: '#34C759',
  health: '#FF3B30',
  training: '#FF9500',
  mindfulness: '#AF52DE',
  inspiration: '#007AFF',
  coordination: '#8E8E93',
}

export function ChatShell({ userInitials = 'ME' }: Props) {
  const {
    messages,
    send,
    isStreaming,
    conversationId,
    activeDomain,
    activeSpecialistId,
    activeSpecialistName,
    loadConversation,
    newConversation,
    exportConversation,
    exitSpecialist,
  } = useChat()
  const [historyOpen, setHistoryOpen] = useState(false)
  const lastSpokenIdRef = useRef<string | undefined>(undefined)
  // Ref so handleVoiceEnd closure always sees the latest conversationId
  const conversationIdRef = useRef(conversationId)
  useEffect(() => { conversationIdRef.current = conversationId }, [conversationId])

  const handleVoiceStart = useCallback(() => {
    // Pin lastSpokenId to the current last message so the TTS effect does NOT
    // re-speak it when the modal opens. Only new messages will be spoken.
    lastSpokenIdRef.current = messages.at(-1)?.id
  }, [messages])

  const handleVoiceEnd = useCallback((liveConversationId?: string) => {
    // Prefer the conversation used during the Live session (may be newly created)
    // over the one that was active before it started.
    const cid = liveConversationId ?? conversationIdRef.current
    if (cid) {
      // Small delay so the last DB writes from the session flush before reload
      setTimeout(() => { void loadConversation(cid) }, 600)
    }
  }, [loadConversation])

  const specialistColor = activeDomain ? (DOMAIN_COLORS[activeDomain] ?? '#007AFF') : '#007AFF'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        backgroundColor: 'var(--color-bg)',
        maxWidth: '640px',
        margin: '0 auto',
      }}
    >
      <TopBar userInitials={userInitials} />

      {/* Specialist mode banner */}
      {activeSpecialistId && activeSpecialistName && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 1rem',
            backgroundColor: `${specialistColor}18`,
            borderBottom: `1px solid ${specialistColor}40`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: specialistColor,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: specialistColor,
                letterSpacing: '0.04em',
              }}
            >
              {activeSpecialistName.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-secondary, rgba(0,0,0,0.45))',
              }}
            >
              — modalità specialista attiva
            </span>
          </div>
          <button
            type="button"
            onClick={exitSpecialist}
            style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary, rgba(0,0,0,0.45))',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
            }}
          >
            Esci
          </button>
        </div>
      )}

      <MessageList
        messages={messages}
        streamingSpecialistName={isStreaming ? (activeSpecialistName ?? undefined) : undefined}
      />
      <ChatInput
        onSend={send}
        onHistory={() => setHistoryOpen(true)}
        disabled={isStreaming}
        activeDomain={activeDomain}
        onVoiceStart={handleVoiceStart}
        onVoiceEnd={handleVoiceEnd}
        conversationId={conversationId}
      />
      <ConversationHistory
        open={historyOpen}
        currentId={conversationId}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadConversation}
        onNew={newConversation}
        onExport={exportConversation}
      />
    </div>
  )
}
