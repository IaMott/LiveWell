'use client'

import { useCallback } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ShareMenu } from './share'
import { LiveSessionOverlay } from './live/LiveSessionOverlay'
import { AppShell } from '@/components/layout/AppShell'
import { useChat } from '@/hooks/useChat'
import { useLiveSession } from '@/hooks/useLiveSession'
import type { LiveMode } from '@/hooks/useLiveSession'

export function ChatContainer() {
  const { messages, isStreaming, isLoading, conversationId, sendMessage, loadConversation } = useChat()
  const live = useLiveSession()

  const handleStartLive = useCallback(
    async (mode: LiveMode) => {
      try {
        await live.startSession(mode, conversationId)
      } catch (err) {
        console.error('[Chat] Failed to start live session:', err)
      }
    },
    [live, conversationId],
  )

  const handleStopLive = useCallback(() => {
    live.stopSession()
    // Reload conversation to show saved transcript messages
    if (conversationId) {
      setTimeout(() => loadConversation(conversationId), 1000)
    }
  }, [live, conversationId, loadConversation])

  return (
    <AppShell>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground text-sm">Caricamento conversazione...</div>
        </div>
      ) : (
        <MessageList messages={messages} isStreaming={isStreaming} />
      )}
      <div className="relative">
        {conversationId && (
          <div className="absolute -top-10 right-4 z-10">
            <ShareMenu conversationId={conversationId} />
          </div>
        )}
        <ChatInput
          onSend={sendMessage}
          onStartLive={handleStartLive}
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
