'use client'

import { useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video } from 'lucide-react'
import type { LiveMode } from '@/hooks/useLiveSession'
import { specialistDisplayName, specialistEmoji } from '@/lib/ai/specialist-meta'

interface TranscriptEntry {
  role: 'user' | 'assistant'
  content: string
}

interface LiveSessionOverlayProps {
  isActive: boolean
  isConnecting: boolean
  isMuted: boolean
  mode: LiveMode | null
  specialist: string | null
  transcript: TranscriptEntry[]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onStop: () => void
  onToggleMute: () => void
}

export function LiveSessionOverlay({
  isActive,
  isConnecting,
  isMuted,
  mode,
  specialist,
  transcript,
  videoRef,
  onStop,
  onToggleMute,
}: LiveSessionOverlayProps) {
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  if (!isActive && !isConnecting) return null

  const spec = specialist
    ? {
        name: specialistDisplayName[specialist] ?? 'Assistente',
        emoji: specialistEmoji[specialist] ?? '🤖',
      }
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-center gap-2 px-4 pt-8 pb-4">
        <div className="text-center">
          {spec && (
            <div className="mb-1 text-3xl">{spec.emoji}</div>
          )}
          <h2 className="text-lg font-semibold text-white">
            {isConnecting
              ? 'Connessione in corso...'
              : spec
                ? `${spec.name} LiveWell`
                : 'LiveWell Live'}
          </h2>
          <p className="text-sm text-white/50">
            {mode === 'video' ? 'Audio + Video' : 'Audio'}
          </p>
        </div>
      </div>

      {/* Video preview (if video mode) */}
      {mode === 'video' && (
        <div className="mx-auto mb-4 w-full max-w-sm overflow-hidden rounded-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-48 w-full object-cover"
          />
        </div>
      )}

      {/* Pulsing indicator */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {isConnecting ? (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-bounce rounded-full bg-green-400 [animation-delay:0ms]" />
            <div className="h-3 w-3 animate-bounce rounded-full bg-green-400 [animation-delay:150ms]" />
            <div className="h-3 w-3 animate-bounce rounded-full bg-green-400 [animation-delay:300ms]" />
          </div>
        ) : (
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-green-500/30" />
            <div className="relative h-24 w-24 rounded-full bg-green-500/20 p-4">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-green-500/40">
                {mode === 'video' ? (
                  <Video className="h-8 w-8 text-white" />
                ) : (
                  <Phone className="h-8 w-8 text-white" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transcript area */}
      {transcript.length > 0 && (
        <div className="mx-4 mb-4 max-h-48 overflow-y-auto rounded-xl bg-white/5 p-3">
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={`mb-2 text-sm ${
                entry.role === 'user' ? 'text-green-300' : 'text-white/80'
              }`}
            >
              <span className="font-medium">
                {entry.role === 'user' ? 'Tu: ' : `${spec?.name || 'AI'}: `}
              </span>
              {entry.content}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 pb-12">
        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            isMuted
              ? 'bg-red-500/80 text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
          disabled={isConnecting}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        {/* End call */}
        <button
          onClick={onStop}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-700"
        >
          <PhoneOff className="h-7 w-7" />
        </button>
      </div>
    </div>
  )
}
