'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ShareMenu } from './share'
import { LiveSessionOverlay } from './live/LiveSessionOverlay'
import { AppShell } from '@/components/layout/AppShell'
import { useChat } from '@/hooks/useChat'
import { useLiveSession } from '@/hooks/useLiveSession'
import type { LiveMode } from '@/hooks/useLiveSession'
import { specialistDisplayName } from '@/lib/ai/specialist-meta'

export function ChatContainer() {
  const {
    messages,
    isStreaming,
    isLoading,
    conversationId,
    activeSpecialist,
    sendMessage,
    loadConversation,
    newConversation,
    clearAllConversations,
  } = useChat()
  const [isClearingHistory, setIsClearingHistory] = useState(false)
  const live = useLiveSession()
  const specialistLabel = useMemo(() => {
    if (!activeSpecialist) return null
    return specialistDisplayName[activeSpecialist] ?? activeSpecialist
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

  const handleNewChat = useCallback(() => {
    newConversation()
  }, [newConversation])

  const handleClearHistory = useCallback(async () => {
    const confirmed = window.confirm(
      'Vuoi eliminare tutto lo storico chat? Questa azione non puo essere annullata.',
    )
    if (!confirmed) return
    setIsClearingHistory(true)
    try {
      await clearAllConversations()
    } catch (err) {
      console.error('[Chat] Failed to clear history:', err)
      window.alert('Impossibile eliminare lo storico. Riprova.')
    } finally {
      setIsClearingHistory(false)
    }
  }, [clearAllConversations])

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
          <div className="absolute -top-10 right-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-surface-dim bg-surface px-2 text-xs text-on-surface-muted transition-colors hover:text-on-surface"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuova chat
            </button>
            <button
              type="button"
              onClick={handleClearHistory}
              disabled={isClearingHistory}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-300/40 bg-rose-50/40 px-2 text-xs text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isClearingHistory ? 'Eliminazione...' : 'Elimina storico'}
            </button>
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
