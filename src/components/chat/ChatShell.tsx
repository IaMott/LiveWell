'use client'

import { useState, useRef, useEffect } from 'react'
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
  // voiceMode: true after a live voice message — next assistant reply gets spoken aloud
  const [voiceMode, setVoiceMode] = useState(false)
  const lastSpokenIdRef = useRef<string | undefined>(undefined)

  // Speak new assistant messages when voiceMode is active
  useEffect(() => {
    if (!voiceMode) return
    const lastMsg = messages.at(-1)
    if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.streaming) return
    if (lastMsg.id === lastSpokenIdRef.current) return
    lastSpokenIdRef.current = lastMsg.id

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(lastMsg.content)
      utterance.lang = 'it-IT'
      utterance.rate = 1.05
      utterance.pitch = 1.0
      // Try to use an Italian voice if available
      const voices = window.speechSynthesis.getVoices()
      const itVoice = voices.find((v) => v.lang.startsWith('it'))
      if (itVoice) utterance.voice = itVoice
      window.speechSynthesis.speak(utterance)
    }
    // Reset voice mode after speaking — user can trigger again by pressing LIVE
    setVoiceMode(false)
  }, [messages, voiceMode])

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

      <MessageList messages={messages} />
      <ChatInput
        onSend={send}
        onHistory={() => setHistoryOpen(true)}
        disabled={isStreaming}
        activeDomain={activeDomain}
        onVoiceSend={() => setVoiceMode(true)}
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
