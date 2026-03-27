'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConversationHistory } from './ConversationHistory'
import { useChat } from '@/hooks/useChat'
import type { ChatMessage } from '@/hooks/useChat'
import type { Domain } from '@/lib/ai/types'
import { getDomainColor } from '@/lib/ui/domainColors'

/** Stable ID for the live interim message — never persisted, replaced on turn complete. */
const LIVE_INTERIM_ID = 'live-interim'

type Props = {
  userInitials?: string
  userName?: string | null
  userImage?: string | null
}

/** Interim live-transcript state: partial text growing in real-time before turnComplete. */
type LiveInterim = {
  role: 'user' | 'assistant'
  text: string
} | null

function formatAgentIdLabel(agentId?: string | null): string | undefined {
  if (!agentId) return undefined
  const normalized = agentId.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return undefined
  return normalized.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function ChatShell({ userInitials = 'ME', userName, userImage }: Props) {
  const {
    messages,
    send,
    isStreaming,
    conversationId,
    stateSnapshot,
    activeDomain,
    activeSpecialistId,
    activeSpecialistName,
    cartellaNotifications,
    loadConversation,
    newConversation,
    exportConversation,
    exitSpecialist,
    stopStreaming,
    editDraft,
    startEdit,
    clearEditDraft,
    appendLiveMessage,
  } = useChat()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [liveActive, setLiveActive] = useState(false)
  const [liveInterim, setLiveInterim] = useState<LiveInterim>(null)
  const lastSpokenIdRef = useRef<string | undefined>(undefined)
  // Ref so handleVoiceEnd closure always sees the latest conversationId
  const conversationIdRef = useRef(conversationId)
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  const handleVoiceStart = useCallback(() => {
    setLiveActive(true)
    // Pin lastSpokenId to the current last message so the TTS effect does NOT
    // re-speak it when the modal opens. Only new messages will be spoken.
    lastSpokenIdRef.current = messages.at(-1)?.id
  }, [messages])

  const handleVoiceEnd = useCallback(
    (liveConversationId?: string) => {
      // Clear any remaining interim bubble and live flag
      setLiveActive(false)
      setLiveInterim(null)
      // Prefer the conversation used during the Live session (may be newly created)
      // over the one that was active before it started.
      const cid = liveConversationId ?? conversationIdRef.current
      if (cid) {
        // Small delay so the last DB writes from the session flush before reload
        setTimeout(() => {
          void loadConversation(cid)
        }, 600)
      }
    },
    [loadConversation],
  )

  /** Real-time partial transcript handler: update the ghost bubble while the user/AI speaks. */
  const handleInterimTranscription = useCallback((role: 'user' | 'assistant', text: string) => {
    if (!text) {
      // Empty string = clear interim for this role
      setLiveInterim((prev) => (prev?.role === role ? null : prev))
    } else {
      setLiveInterim({ role, text })
    }
  }, [])

  /** Confirmed message handler: append to local messages immediately (no session-end wait). */
  const handleLiveMessage = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      // Clear interim for this role — it's now confirmed
      setLiveInterim((prev) => (prev?.role === role ? null : prev))
      appendLiveMessage(role, text)
    },
    [appendLiveMessage],
  )

  const handleSend = useCallback(
    (text: string, domain?: Parameters<typeof send>[1], files?: File[]) => {
      clearEditDraft()
      void send(text, domain, files)
    },
    [send, clearEditDraft],
  )

  const leadPanel =
    stateSnapshot?.domainPanels.find((panel) => panel.domain === stateSnapshot.leadDomain) ??
    stateSnapshot?.domainPanels[0]
  const visualActiveDomain = (stateSnapshot?.leadDomain ?? activeDomain ?? null) as Domain | null
  const visualSpecialistId = leadPanel?.selectedAgentId ?? activeSpecialistId ?? undefined
  const visualSpecialistName =
    formatAgentIdLabel(leadPanel?.selectedAgentId) ?? activeSpecialistName ?? undefined
  const specialistColor = getDomainColor(visualActiveDomain)

  /** Merge confirmed messages with the live interim message (if any) so the text
   * grows word-by-word directly inside the chat bubble — same as text streaming. */
  const displayMessages = useMemo((): ChatMessage[] => {
    if (!liveInterim) return messages
    return [
      ...messages,
      {
        id: LIVE_INTERIM_ID,
        role: liveInterim.role,
        content: liveInterim.text,
        streaming: true, // renders with ▋ cursor via MessageBubble/MarkdownContent
      },
    ]
  }, [messages, liveInterim])

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
      <TopBar userInitials={userInitials} userName={userName} userImage={userImage} />

      {/* Specialist mode banner — hidden during live session to avoid duplicate
          specialist chrome while the shared live turn is in progress.
          The canonical state is still re-applied to text chat when live ends. */}
      {visualSpecialistId && visualSpecialistName && !liveActive && (
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
              {visualSpecialistName.toUpperCase()}
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

      {/* displayMessages merges confirmed messages with the live interim (if any).
          The interim appears as a streaming bubble directly in the chat flow,
          growing word-by-word with the ▋ cursor — same UX as text streaming. */}
      <MessageList
        messages={displayMessages}
        conversationId={conversationId}
        onSend={handleSend}
        onEdit={startEdit}
      />

      <ChatInput
        onSend={handleSend}
        onHistory={() => setHistoryOpen(true)}
        disabled={isStreaming}
        activeDomain={visualActiveDomain}
        onVoiceStart={handleVoiceStart}
        onVoiceEnd={handleVoiceEnd}
        conversationId={conversationId}
        onStop={stopStreaming}
        editDraft={editDraft}
        onLiveMessage={handleLiveMessage}
        onInterimTranscription={handleInterimTranscription}
      />
      <ConversationHistory
        open={historyOpen}
        currentId={conversationId}
        onClose={() => setHistoryOpen(false)}
        onSelect={loadConversation}
        onNew={newConversation}
        onExport={exportConversation}
      />

      {/* Fase 6: Cartella save notifications */}
      {cartellaNotifications.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: '90vw',
          }}
        >
          {cartellaNotifications.map((n) => (
            <div
              key={n.id}
              style={{
                background: 'rgba(34, 139, 34, 0.92)',
                color: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 500,
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                animation: 'cartellaFadeIn 0.3s ease-out',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '400px',
              }}
            >
              {n.message}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes cartellaFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
