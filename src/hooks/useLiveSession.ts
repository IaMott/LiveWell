'use client'

import { useState, useCallback, useRef, type RefObject } from 'react'
import type { LiveServerMessage } from '@google/genai'
import {
  float32ToPcm16,
  pcm16ToFloat32,
  downsample,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from '@/lib/audio-utils'

export type LiveMode = 'audio' | 'video'

interface TranscriptEntry {
  role: 'user' | 'assistant'
  content: string
}

interface UseLiveSessionReturn {
  isActive: boolean
  isConnecting: boolean
  isMuted: boolean
  mode: LiveMode | null
  specialist: string | null
  transcript: TranscriptEntry[]
  videoRef: RefObject<HTMLVideoElement | null>
  startSession: (mode: LiveMode, conversationId: string | null) => Promise<void>
  stopSession: () => void
  toggleMute: () => void
}

export function useLiveSession(): UseLiveSessionReturn {
  const [isActive, setIsActive] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [mode, setMode] = useState<LiveMode | null>(null)
  const [specialist, setSpecialist] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])

  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Refs for cleanup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionRef = useRef<any>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const playbackCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const videoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const conversationIdRef = useRef<string | null>(null)
  const nextPlayTimeRef = useRef(0)
  const mutedRef = useRef(false)
  const currentAssistantTextRef = useRef('')

  /** Play received PCM audio chunk */
  const playAudioChunk = useCallback((base64Data: string) => {
    const ctx = playbackCtxRef.current
    if (!ctx) return

    const arrayBuf = base64ToArrayBuffer(base64Data)
    const int16 = new Int16Array(arrayBuf)
    const float32 = pcm16ToFloat32(int16)

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000)
    audioBuffer.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current)
    source.start(startTime)
    nextPlayTimeRef.current = startTime + audioBuffer.duration
  }, [])

  /** Save transcript to DB when session ends */
  const saveTranscript = useCallback(async (entries: TranscriptEntry[], convId: string | null) => {
    if (entries.length === 0) return
    try {
      await fetch('/api/live-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convId,
          messages: entries.filter((e) => e.content.trim().length > 0),
        }),
      })
    } catch (err) {
      console.error('[LiveSession] Failed to save transcript:', err)
    }
  }, [])

  /** Clean up all resources */
  const cleanup = useCallback(() => {
    // Stop video frame capture
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current)
      videoIntervalRef.current = null
    }

    // Stop audio processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    // Close audio contexts
    if (captureCtxRef.current?.state !== 'closed') {
      captureCtxRef.current?.close().catch(() => {})
    }
    captureCtxRef.current = null

    if (playbackCtxRef.current?.state !== 'closed') {
      playbackCtxRef.current?.close().catch(() => {})
    }
    playbackCtxRef.current = null

    // Close Gemini session
    try {
      sessionRef.current?.close()
    } catch {
      // Ignore
    }
    sessionRef.current = null

    nextPlayTimeRef.current = 0
  }, [])

  const startSession = useCallback(
    async (sessionMode: LiveMode, conversationId: string | null) => {
      setIsConnecting(true)
      setMode(sessionMode)
      setTranscript([])
      conversationIdRef.current = conversationId
      currentAssistantTextRef.current = ''

      try {
        // 1. Get API key and system prompt
        const tokenRes = await fetch('/api/live-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        })
        if (!tokenRes.ok) throw new Error('Token non disponibile')
        const { apiKey, model, systemPrompt, specialist: spec } = await tokenRes.json()
        setSpecialist(spec)

        // 2. Get media access
        const constraints: MediaStreamConstraints = {
          audio: { echoCancellation: true, noiseSuppression: true },
        }
        if (sessionMode === 'video') {
          constraints.video = { width: 640, height: 480, facingMode: 'user' }
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream

        // Attach video stream to ref element
        if (sessionMode === 'video' && videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }

        // 3. Set up audio capture
        const captureCtx = new AudioContext()
        captureCtxRef.current = captureCtx
        const source = captureCtx.createMediaStreamSource(stream)
        const processor = captureCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        source.connect(processor)
        processor.connect(captureCtx.destination)

        // 4. Set up audio playback
        playbackCtxRef.current = new AudioContext({ sampleRate: 24000 })

        // 5. Connect to Gemini Live
        const { GoogleGenAI, Modality } = await import('@google/genai')
        const ai = new GoogleGenAI({ apiKey })

        const session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
          callbacks: {
            onopen: () => {
              console.log('[LiveSession] Connected')
              setIsConnecting(false)
              setIsActive(true)
            },
            onmessage: (message: LiveServerMessage) => {
              const serverContent = message.serverContent

              if (serverContent?.modelTurn?.parts) {
                for (const part of serverContent.modelTurn.parts) {
                  if (part.inlineData?.data) {
                    playAudioChunk(part.inlineData.data)
                  }
                  if (part.text) {
                    currentAssistantTextRef.current += part.text
                  }
                }
              }

              if (serverContent?.turnComplete && currentAssistantTextRef.current) {
                const text = currentAssistantTextRef.current.trim()
                if (text) {
                  setTranscript((prev) => [...prev, { role: 'assistant', content: text }])
                }
                currentAssistantTextRef.current = ''
              }
            },
            onerror: (error: unknown) => {
              console.error('[LiveSession] Error:', error)
            },
            onclose: () => {
              console.log('[LiveSession] Closed')
              setIsActive(false)
              setIsConnecting(false)
            },
          },
        })
        sessionRef.current = session

        // 6. Start sending audio chunks
        const nativeSampleRate = captureCtx.sampleRate
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (mutedRef.current) return

          const inputData = e.inputBuffer.getChannelData(0)
          const downsampled = downsample(inputData, nativeSampleRate, 16000)
          const pcm16 = float32ToPcm16(downsampled)
          const base64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer)

          try {
            session.sendRealtimeInput({
              media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
            })
          } catch {
            // Session might be closing
          }
        }

        // 7. Start sending video frames if in video mode
        if (sessionMode === 'video') {
          const canvas = document.createElement('canvas')
          canvas.width = 640
          canvas.height = 480
          canvasRef.current = canvas
          const ctx2d = canvas.getContext('2d')!

          videoIntervalRef.current = setInterval(() => {
            if (videoRef.current && ctx2d) {
              ctx2d.drawImage(videoRef.current, 0, 0, 640, 480)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.5)
              const base64Frame = dataUrl.split(',')[1]
              try {
                session.sendRealtimeInput({
                  media: { data: base64Frame, mimeType: 'image/jpeg' },
                })
              } catch {
                // Session might be closing
              }
            }
          }, 1000) // 1 FPS
        }
      } catch (err) {
        console.error('[LiveSession] Start error:', err)
        cleanup()
        setIsConnecting(false)
        setIsActive(false)
        throw err
      }
    },
    [cleanup, playAudioChunk],
  )

  const stopSession = useCallback(() => {
    // Save transcript before cleanup
    saveTranscript(transcript, conversationIdRef.current)
    cleanup()
    setIsActive(false)
    setIsConnecting(false)
    setMode(null)
    setSpecialist(null)
  }, [cleanup, saveTranscript, transcript])

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current
    setIsMuted(mutedRef.current)
  }, [])

  return {
    isActive,
    isConnecting,
    isMuted,
    mode,
    specialist,
    transcript,
    videoRef,
    startSession,
    stopSession,
    toggleMute,
  }
}
