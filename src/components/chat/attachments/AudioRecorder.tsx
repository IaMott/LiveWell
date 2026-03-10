'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioRecorderProps {
  onTranscription: (text: string) => void
  onAudioReady: (file: File, url: string) => void
  disabled?: boolean
}

export function AudioRecorder({ onTranscription, onAudioReady, disabled }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Prefer webm, fallback to mp4
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = mimeType.includes('webm') ? 'webm' : 'm4a'
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType })

        // Upload audio file
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (uploadRes.ok) {
          const { url } = await uploadRes.json()
          onAudioReady(file, url)
        }

        // Transcribe
        setTranscribing(true)
        try {
          const transcribeData = new FormData()
          transcribeData.append('audio', file)
          const res = await fetch('/api/transcribe', { method: 'POST', body: transcribeData })

          if (res.ok) {
            const { transcript } = await res.json()
            if (transcript) {
              onTranscription(transcript)
            }
          } else {
            const data = await res.json().catch(() => ({}))
            if (data.error) setError(data.error)
          }
        } catch {
          setError('Errore di connessione')
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start(250) // Collect data every 250ms
      setRecording(true)
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Permesso microfono negato')
      } else {
        setError('Impossibile avviare la registrazione')
      }
    }
  }, [onTranscription, onAudioReady])

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (transcribing) {
    return (
      <div className="flex items-center gap-2 text-sm text-on-surface-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Trascrizione in corso...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500">{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          className="text-xs text-on-surface-muted underline"
        >
          Riprova
        </button>
      </div>
    )
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm font-medium tabular-nums text-on-surface">
            {formatDuration(duration)}
          </span>
        </div>
        <button
          type="button"
          onClick={stopRecording}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            'bg-red-500 text-white transition-all',
            'hover:bg-red-600 active:scale-95',
          )}
          aria-label="Ferma registrazione"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      className={cn(
        'flex h-11 w-11 items-center justify-center rounded-full',
        'text-on-surface-muted transition-colors',
        'hover:bg-surface-dim hover:text-on-surface',
        'disabled:opacity-40',
      )}
      aria-label="Registra messaggio vocale"
    >
      <Mic className="h-5 w-5" />
    </button>
  )
}
