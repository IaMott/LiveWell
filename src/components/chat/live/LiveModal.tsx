'use client'

import type React from 'react'
import { GoogleGenAI, Modality } from '@google/genai'
import type { LiveConnectConfig, LiveServerMessage, Session } from '@google/genai'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'connecting' | 'live' | 'error'

interface LiveSession extends Session {
  sendRealtimeInput: (params: Record<string, unknown>) => void
  sendClientContent: (params: Record<string, unknown>) => void
  close: () => void
}

interface Props {
  onClose: () => void
  conversationId?: string | null
  /** Called for each completed transcript segment from user or assistant. */
  onTranscription?: (role: 'user' | 'assistant', text: string) => void
  /** Called in real-time with the growing partial text as the user or AI speaks.
   * Fires on every incoming chunk before turnComplete. Pass empty string to clear. */
  onInterimTranscription?: (role: 'user' | 'assistant', text: string) => void
}

// ── Live model — must use v1alpha BidiGenerateContentConstrained endpoint ────
// Only dated native-audio snapshots work with ephemeral tokens + v1alpha.
// "gemini-live-2.5-flash-preview" exists in SDK types but is NOT supported
// for bidiGenerateContent with ephemeral tokens (tested 2026-03-10).

const LIVE_MODEL_FALLBACKS = ['gemini-2.5-flash-native-audio-preview-12-2025']

// ── Audio / encoding helpers ──────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function resampleFloat32(src: Float32Array, srcRate: number, dstRate: number): Float32Array {
  if (srcRate === dstRate) return src
  const ratio = srcRate / dstRate
  const outLen = Math.round(src.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, src.length - 1)
    out[i] = src[lo] + (src[hi] - src[lo]) * (pos - lo)
  }
  return out
}

function float32ToPcm16Bytes(samples: Float32Array): Uint8Array {
  const buf = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, s < 0 ? s * 32768 : s * 32767, true)
  }
  return new Uint8Array(buf)
}

function normalizeEphemeralToken(name: string): string {
  const t = name.trim()
  if (!t) return t
  if (t.startsWith('auth_tokens/')) return t
  if (t.startsWith('authTokens/')) return `auth_tokens/${t.slice('authTokens/'.length)}`
  const marker = '/authTokens/'
  const idx = t.indexOf(marker)
  if (idx >= 0) return `auth_tokens/${t.slice(idx + marker.length)}`
  return t
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPhoneEnd() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10 21 3 14 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconVideoOff() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M15 9.5L23 7v10l-8-2.5" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconSwitchCamera() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 7h-3.5l-1.5-2H9L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M9 13l2-2 2 2" />
      <path d="M13 11l2 2-2 2" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveModal({
  onClose,
  conversationId,
  onTranscription,
  onInterimTranscription,
}: Props) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [statusText, setStatusText] = useState('Connessione…')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0)
  const [bars, setBars] = useState<number[]>(Array(5).fill(4))

  // ── PiP drag state ────────────────────────────────────────────────────────
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null)
  const pipDragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const sessionRef = useRef<LiveSession | null>(null)
  const sessionReadyRef = useRef(false)
  const closingRef = useRef(false)

  const micStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoTimerRef = useRef<number | null>(null)

  const inputAudioCtxRef = useRef<AudioContext | null>(null)
  const outputAudioCtxRef = useRef<AudioContext | null>(null)
  const outputNextPlayRef = useRef(0)
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())

  const animRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // Transcript buffers — accumulate chunks across partial messages
  const userTranscriptBufRef = useRef('')
  const aiTranscriptBufRef = useRef('')

  // Tracks current facingMode for devices with a single camera (front/back toggle)
  const facingModeRef = useRef<'environment' | 'user'>('environment')

  // ── Waveform animation (5 bars, ChatGPT-style) ────────────────────────────

  const startAnim = useCallback(() => {
    function tick() {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const step = Math.floor(data.length / 5)
        setBars(
          Array.from({ length: 5 }, (_, i) => {
            const val = data[i * step] ?? 0
            return Math.max(4, Math.round((val / 255) * 28))
          }),
        )
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Audio playback ────────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    outputSourcesRef.current.forEach((src) => {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
    })
    outputSourcesRef.current.clear()
    outputNextPlayRef.current = 0
    setIsAiSpeaking(false)
  }, [])

  const enqueuePCM = useCallback((base64Data: string) => {
    const ctx = outputAudioCtxRef.current
    if (!ctx) return

    const bytes = fromBase64(base64Data)
    // PCM from Gemini is 16-bit signed int, little-endian, 24 kHz
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768

    const buf = ctx.createBuffer(1, float32.length, 24000)
    buf.copyToChannel(float32, 0)

    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)

    const now = ctx.currentTime
    const startAt = Math.max(now + 0.02, outputNextPlayRef.current)
    src.start(startAt)
    outputNextPlayRef.current = startAt + buf.duration

    outputSourcesRef.current.add(src)
    setIsAiSpeaking(true)

    src.onended = () => {
      outputSourcesRef.current.delete(src)
      if (
        outputSourcesRef.current.size === 0 &&
        outputNextPlayRef.current <= ctx.currentTime + 0.1
      ) {
        setIsAiSpeaking(false)
      }
    }
  }, [])

  // ── Media streaming (mic + optional video) ────────────────────────────────

  const startMediaStreaming = useCallback(
    async (session: LiveSession, micStream: MediaStream) => {
      const AudioCtxCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtxCtor) return

      const inCtx = new AudioCtxCtor()
      inputAudioCtxRef.current = inCtx
      if (inCtx.state === 'suspended') await inCtx.resume()

      const inputSampleRate = Math.max(8000, Math.round(inCtx.sampleRate))
      const targetRate = 16000

      const src = inCtx.createMediaStreamSource(micStream)
      const analyser = inCtx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser

      const proc = inCtx.createScriptProcessor(2048, 1, 1)
      const mute = inCtx.createGain()
      mute.gain.value = 0
      src.connect(proc)
      proc.connect(mute)
      mute.connect(inCtx.destination)

      proc.onaudioprocess = (ev) => {
        if (!sessionReadyRef.current || closingRef.current) return
        const mono = ev.inputBuffer.getChannelData(0)
        const resampled = resampleFloat32(mono, inputSampleRate, targetRate)
        const pcm = float32ToPcm16Bytes(resampled)
        session.sendRealtimeInput({
          audio: {
            mimeType: `audio/pcm;rate=${targetRate}`,
            data: toBase64(pcm),
          },
        })
      }

      startAnim()
      setPhase('live')
      setStatusText('In ascolto…')
    },
    [startAnim],
  )

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    closingRef.current = true
    sessionReadyRef.current = false

    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current)
      videoTimerRef.current = null
    }

    stopPlayback()

    inputAudioCtxRef.current?.close().catch(() => {})
    inputAudioCtxRef.current = null
    outputAudioCtxRef.current?.close().catch(() => {})
    outputAudioCtxRef.current = null

    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null

    try {
      sessionRef.current?.close()
    } catch {
      /* ignore */
    }
    sessionRef.current = null
  }, [stopPlayback])

  // ── Connect to Gemini Live ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    async function connect() {
      try {
        // 1. Get ephemeral token from auth-protected endpoint
        const tokenRes = await fetch('/api/live-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        })
        if (!tokenRes.ok) {
          const err = (await tokenRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Autenticazione fallita')
        }
        const tokenData = (await tokenRes.json()) as {
          token: string
          model: string
          systemInstruction?: string
        }
        if (!tokenData.token) throw new Error('Servizio live non disponibile')
        if (!mounted) return

        // 2. Get microphone access
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        })
        micStreamRef.current = micStream
        if (!mounted) {
          micStream.getTracks().forEach((t) => t.stop())
          return
        }

        // Enumerate camera devices after mic permission is granted
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const cameras = devices.filter((d) => d.kind === 'videoinput')
          if (mounted) setVideoDevices(cameras)
        } catch {
          /* ignore — camera list not critical */
        }

        // 3. Output audio context (24 kHz — Gemini output sample rate)
        const outCtx = new AudioContext({ sampleRate: 24000 })
        outputAudioCtxRef.current = outCtx
        if (outCtx.state === 'suspended') await outCtx.resume()
        outputNextPlayRef.current = 0

        // 4. Connect via @google/genai SDK (v1alpha required for ephemeral tokens)
        const sdkToken = normalizeEphemeralToken(tokenData.token)
        const ai = new GoogleGenAI({
          apiKey: sdkToken,
          apiVersion: 'v1alpha',
          httpOptions: { apiVersion: 'v1alpha' },
        } as ConstructorParameters<typeof GoogleGenAI>[0])

        const liveModel = tokenData.model || (LIVE_MODEL_FALLBACKS[0] ?? '')

        const systemInstructionText =
          tokenData.systemInstruction ??
          'Sei un assistente AI per la salute e il benessere personale. Rispondi in italiano in modo naturale, conciso e conversazionale.'

        const liveConfig: LiveConnectConfig = {
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }

        const rawSession = (await ai.live.connect({
          model: liveModel,
          config: liveConfig,
          callbacks: {
            onopen: () => {
              sessionReadyRef.current = true
            },
            onmessage: (message: LiveServerMessage) => {
              if (!mounted || closingRef.current) return

              const sc = message.serverContent

              // ── Audio playback ────────────────────────────────────────────
              const parts = sc?.modelTurn?.parts ?? []
              for (const part of parts) {
                const inline = part.inlineData
                if (inline?.data && (inline.mimeType ?? '').startsWith('audio/pcm')) {
                  enqueuePCM(inline.data)
                }
              }

              // ── Transcript accumulation ───────────────────────────────────
              const userText = sc?.inputTranscription?.text
              if (typeof userText === 'string' && userText) {
                userTranscriptBufRef.current += userText
                // Fire interim in real-time so the UI can show partial text
                onInterimTranscription?.('user', userTranscriptBufRef.current)
              }
              const aiText = sc?.outputTranscription?.text
              if (typeof aiText === 'string' && aiText) {
                aiTranscriptBufRef.current += aiText
                // Fire interim in real-time so the UI can show partial text
                onInterimTranscription?.('assistant', aiTranscriptBufRef.current)
              }

              // Emit both segments on turn complete, clear interim
              if (sc?.turnComplete) {
                const userSeg = userTranscriptBufRef.current.trim()
                userTranscriptBufRef.current = ''
                if (userSeg) {
                  onInterimTranscription?.('user', '') // clear user interim
                  onTranscription?.('user', userSeg)
                }

                const aiSeg = aiTranscriptBufRef.current.trim()
                aiTranscriptBufRef.current = ''
                if (aiSeg) {
                  onInterimTranscription?.('assistant', '') // clear assistant interim
                  onTranscription?.('assistant', aiSeg)
                }
              }
            },
            onerror: (error: ErrorEvent) => {
              console.error('[LiveModal] session error', error)
              if (!mounted) return
              setPhase('error')
              setStatusText('Errore connessione')
            },
            onclose: (ev: CloseEvent) => {
              if (!mounted || closingRef.current) return
              if (ev.code !== 1000) {
                setPhase('error')
                setStatusText(`Connessione persa (${ev.code})`)
              }
            },
          },
        })) as unknown as LiveSession

        sessionRef.current = rawSession
        if (!mounted) {
          rawSession.close()
          return
        }

        await startMediaStreaming(rawSession, micStream)
      } catch (err: unknown) {
        if (!mounted) return
        setPhase('error')
        const msg = err instanceof Error ? err.message : 'Errore avvio sessione'
        setStatusText(msg)
      }
    }

    void connect()

    return () => {
      mounted = false
      cleanup()
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start video stream with a specific device ─────────────────────────────

  const startVideoStream = useCallback(
    async (deviceId?: string, facingMode?: 'environment' | 'user') => {
      const effectiveFacing = facingMode ?? facingModeRef.current
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: { facingMode: effectiveFacing } }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter((d) => d.kind === 'videoinput')
        setVideoDevices(cameras)
      } catch {
        /* ignore */
      }

      videoStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setVideoEnabled(true)

      // Send a video frame to Gemini every 1.1 seconds
      videoTimerRef.current = window.setInterval(() => {
        const session = sessionRef.current
        if (!sessionReadyRef.current || !session || !videoRef.current || !videoStreamRef.current)
          return
        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 180
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(videoRef.current, 0, 0, 320, 180)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55)
        session.sendRealtimeInput({
          video: { mimeType: 'image/jpeg', data: dataUrl.split(',')[1] },
        })
      }, 1100)
    },
    [],
  )

  // ── Video toggle ──────────────────────────────────────────────────────────

  async function toggleVideo() {
    if (videoEnabled) {
      if (videoTimerRef.current) {
        clearInterval(videoTimerRef.current)
        videoTimerRef.current = null
      }
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setVideoEnabled(false)
    } else {
      try {
        await startVideoStream(videoDevices[currentCameraIdx]?.deviceId)
      } catch (e) {
        console.error('[LiveModal] camera error', e)
      }
    }
  }

  // ── Camera switch ─────────────────────────────────────────────────────────

  async function switchCamera() {
    if (!videoEnabled) return
    const prevCameraIdx = currentCameraIdx
    const prevFacingMode = facingModeRef.current
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current)
      videoTimerRef.current = null
    }
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setVideoEnabled(false)
    try {
      if (videoDevices.length > 1) {
        const nextIdx = (currentCameraIdx + 1) % videoDevices.length
        setCurrentCameraIdx(nextIdx)
        await startVideoStream(videoDevices[nextIdx]?.deviceId)
      } else {
        const next = facingModeRef.current === 'environment' ? 'user' : 'environment'
        facingModeRef.current = next
        await startVideoStream(undefined, next)
      }
    } catch {
      try {
        setCurrentCameraIdx(prevCameraIdx)
        facingModeRef.current = prevFacingMode
        await startVideoStream(videoDevices[prevCameraIdx]?.deviceId, prevFacingMode)
      } catch {
        /* ignore */
      }
    }
  }

  function handleEnd() {
    cleanup()
    onClose()
  }

  // ── PiP drag handlers ─────────────────────────────────────────────────────

  function onPipPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    pipDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pipPos?.x ?? window.innerWidth - 180,
      origY: pipPos?.y ?? window.innerHeight - 180,
    }
    // Ensure initial pos is set
    if (!pipPos) {
      setPipPos({ x: window.innerWidth - 180, y: window.innerHeight - 180 })
    }
    void rect // suppress lint
  }

  function onPipPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pipDragRef.current) return
    const { startX, startY, origX, origY } = pipDragRef.current
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    const newX = Math.max(0, Math.min(window.innerWidth - 180, origX + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - 120, origY + dy))
    setPipPos({ x: newX, y: newY })
  }

  function onPipPointerUp() {
    pipDragRef.current = null
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  const dotColor = phase !== 'live' ? '#8E8E93' : isAiSpeaking ? '#007AFF' : '#FF3B30'

  const barColor = dotColor

  const displayStatus =
    phase === 'connecting'
      ? 'Connessione…'
      : phase === 'error'
        ? statusText
        : isAiSpeaking
          ? 'In risposta…'
          : 'In ascolto…'

  // PiP default position: bottom-right (above ChatInput area, ~68px from bottom)
  const pipX = pipPos?.x ?? (typeof window !== 'undefined' ? window.innerWidth - 196 : 200)
  const pipY = pipPos?.y ?? (typeof window !== 'undefined' ? window.innerHeight - 196 : 200)

  // ── Render: compact LiveBar + optional PiP video ──────────────────────────

  return (
    <>
      {/* ── Compact live bar (replaces fullscreen overlay) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'var(--color-surface, #fff)',
          borderTop: '1px solid var(--color-separator, #E5E5EA)',
          minHeight: '52px',
        }}
      >
        {/* Live dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: dotColor,
              display: 'inline-block',
              animation: phase === 'live' ? 'lw-live-pulse 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: dotColor,
            }}
          >
            LIVE
          </span>
        </div>

        {/* Waveform — 5 bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '28px',
            flexShrink: 0,
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: phase === 'connecting' ? '6px' : `${h}px`,
                borderRadius: '1.5px',
                backgroundColor: barColor,
                transition: 'height 0.08s ease, background-color 0.3s ease',
                animation:
                  phase === 'connecting'
                    ? `lw-live-bar ${0.8 + (i % 3) * 0.12}s ${(i * 0.08).toFixed(2)}s ease-in-out infinite`
                    : 'none',
              }}
            />
          ))}
        </div>

        {/* Status text */}
        <span
          style={{
            flex: 1,
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary, #8E8E93)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayStatus}
        </span>

        {/* Video toggle */}
        <button
          type="button"
          onClick={() => void toggleVideo()}
          aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
          style={barIconBtn(videoEnabled ? 'var(--color-bg, #F2F2F7)' : 'transparent')}
        >
          {videoEnabled ? <IconVideo /> : <IconVideoOff />}
        </button>

        {/* Camera switch — only when video on */}
        {videoEnabled && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            aria-label="Cambia fotocamera"
            style={barIconBtn('transparent')}
          >
            <IconSwitchCamera />
          </button>
        )}

        {/* End session */}
        <button
          type="button"
          onClick={handleEnd}
          aria-label="Termina sessione live"
          style={{
            ...barIconBtn('#FF3B30'),
            color: '#fff',
          }}
        >
          <IconPhoneEnd />
        </button>
      </div>

      {/* ── Draggable PiP video preview ── */}
      {/* Always in DOM so videoRef.current is available when startVideoStream sets srcObject. */}
      {/* Visibility controlled by display:none — avoids the ref-null race with {condition && ...}. */}
      <div
        onPointerDown={onPipPointerDown}
        onPointerMove={onPipPointerMove}
        onPointerUp={onPipPointerUp}
        style={{
          display: videoEnabled ? 'block' : 'none',
          position: 'fixed',
          left: pipX,
          top: pipY,
          width: '120px',
          height: '213px',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
          cursor: 'grab',
          zIndex: 900,
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Close button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void toggleVideo()}
          aria-label="Chiudi video"
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* ── CSS keyframes ── */}
      <style>{`
        @keyframes lw-live-bar {
          0%, 80%, 100% { transform: scaleY(0.5); opacity: 0.4; }
          40% { transform: scaleY(1.5); opacity: 1; }
        }
        @keyframes lw-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  )
}

function barIconBtn(bg: string): React.CSSProperties {
  return {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: bg,
    color: 'var(--color-text-primary, #1C1C1E)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transition: 'background-color 0.15s',
  }
}
