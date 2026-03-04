'use client'

import { useCallback, useMemo } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ShareMenu } from './share'
import { LiveSessionOverlay } from './live/LiveSessionOverlay'
import { AppShell } from '@/components/layout/AppShell'
import { useChat } from '@/hooks/useChat'
import { useLiveSession } from '@/hooks/useLiveSession'
import type { LiveMode } from '@/hooks/useLiveSession'

export function ChatContainer() {
  const {
    messages,
    isStreaming,
    isLoading,
    conversationId,
    activeSpecialist,
    sendMessage,
    loadConversation,
  } = useChat()
  const live = useLiveSession()
  const specialistLabel = useMemo(() => {
    if (!activeSpecialist) return null
    const labels: Record<string, string> = {
      intervistatore: 'Intervistatore',
      dietista: 'Dietista',
      personal_trainer: 'Personal Trainer',
      psicologo: 'Psicologo',
      mental_coach: 'Mental Coach',
      chef: 'Chef',
      fisioterapista: 'Fisioterapista',
      fisiatra: 'Fisiatra',
      medico_sport: 'Medico dello Sport',
      mmg: 'MMG',
      gastroenterologo: 'Gastroenterologo',
      chinesologo: 'Chinesologo',
      analista_contesto: 'Analista del Contesto',
    }
    return labels[activeSpecialist] ?? activeSpecialist
  }, [activeSpecialist])

  const handleStartLive = useCallback(
    async (mode: LiveMode) => {
      try {
        if (mode === 'video' && !live.isActive) {
          return
        }
        await live.startSession(mode, conversationId)
      } catch (err) {
        console.error('[Chat] Failed to start live session:', err)
      }
    },
    [live, conversationId],
  )

  const handleStopLive = useCallback(async () => {
    const savedConversationId = await live.stopSession()
    const idToReload = savedConversationId ?? conversationId
    if (idToReload) {
      setTimeout(() => loadConversation(idToReload), 500)
    }
  }, [live, conversationId, loadConversation])

  return (
    <AppShell>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground text-sm">Caricamento conversazione...</div>
        </div>
      ) : (
        <>
          {specialistLabel && (
            <div className="px-4 py-2 text-center text-xs text-on-surface-muted">
              Risposta in corso con supervisione: {specialistLabel}
            </div>
          )}
          <MessageList messages={messages} isStreaming={isStreaming} />
        </>
      )}
      <div className="relative">
        {live.fallbackMessage && (
          <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            {live.fallbackMessage}
          </div>
        )}
        {conversationId && (
          <div className="absolute -top-10 right-4 z-10">
            <ShareMenu conversationId={conversationId} />
          </div>
        )}
        <ChatInput
          onSend={sendMessage}
          onStartLive={handleStartLive}
          liveAudioActive={live.isActive && live.mode === 'audio'}
          disabled={isStreaming || isLoading}
        />
      </div>

      <LiveSessionOverlay
        isActive={live.isActive}
        isConnecting={live.isConnecting}
        isMuted={live.isMuted}
        mode={live.mode}
        specialist={live.specialist}
        transcript={live.transcript}
        videoRef={live.videoRef}
        onStop={handleStopLive}
        onToggleMute={live.toggleMute}
      />
    </AppShell>
  )
}
