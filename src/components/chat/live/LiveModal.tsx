'use client'

import type React from 'react'
import { useEffect, useRef, useState, useCallback } from 'react'

// ── AudioWorklet source (inlined as blob URL) ─────────────────────────────────
// Converts float32 mic samples → int16 PCM and posts them to the main thread.
const WORKLET_CODE = `
class MicPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch && ch.length > 0) {
      const int16 = new Int16Array(ch.length)
      for (let i = 0; i < ch.length; i++) {
        const s = Math.max(-1, Math.min(1, ch[i]))
        int16[i] = s < 0 ? s * 32768 : s * 32767
      }
      this.port.postMessage(int16.buffer, [int16.buffer])
    }
    return true
  }
}
registerProcessor('mic-pcm-processor', MicPcmProcessor)
`

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconPhoneEnd() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10 21 3 14 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  )
}

function IconSwitchCamera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 4v6h6" />
      <path d="M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  )
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconVideoOff() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M15 9.5L23 7v10l-8-2.5" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'connecting' | 'live' | 'error'

interface LiveTokenResponse {
  apiKey?: string
  model?: string
}

interface Props {
  onClose: () => void
  onTranscription?: (text: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveModal({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [bars, setBars] = useState<number[]>(Array(12).fill(4))
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const captureCtxRef = useRef<AudioContext | null>(null)
  const playCtxRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const nextPlayAtRef = useRef(0)
  const animRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const closingRef = useRef(false)
  const aiSpeakingRef = useRef(false)

  // ── Waveform animation ───────────────────────────────────────────────────────

  const startAnim = useCallback(() => {
    function tick() {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const step = Math.floor(data.length / 12)
        setBars(
          Array.from({ length: 12 }, (_, i) => {
            const val = data[i * step] ?? 0
            return Math.max(4, Math.round((val / 255) * 52))
          }),
        )
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    closingRef.current = true
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    workletNodeRef.current?.disconnect()
    workletNodeRef.current = null
    captureCtxRef.current?.close().catch(() => {})
    captureCtxRef.current = null
    playCtxRef.current?.close().catch(() => {})
    playCtxRef.current = null
    micStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current = null
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close(1000, 'user ended session')
    }
    wsRef.current = null
  }, [])

  // ── Convert ArrayBuffer → base64 ─────────────────────────────────────────────

  function ab2b64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // ── Play PCM audio chunk received from Gemini (24 kHz, int16) ────────────────

  const playPCM = useCallback((base64: string) => {
    const ctx = playCtxRef.current
    if (!ctx) return

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const int16 = new Int16Array(bytes.buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000)
    buffer.copyToChannel(float32, 0)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    const now = ctx.currentTime
    const startAt = Math.max(now + 0.02, nextPlayAtRef.current)
    source.start(startAt)
    nextPlayAtRef.current = startAt + buffer.duration

    aiSpeakingRef.current = true
    setIsAiSpeaking(true)

    source.onended = () => {
      if (nextPlayAtRef.current <= (ctx.currentTime + 0.08)) {
        aiSpeakingRef.current = false
        setIsAiSpeaking(false)
      }
    }
  }, [])

  // ── Start Gemini Live session ─────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    async function start() {
      try {
        // 1. Get API key from server (auth-protected endpoint)
        const tokenRes = await fetch('/api/live-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!tokenRes.ok) throw new Error('Autenticazione fallita')
        const tokenData = (await tokenRes.json()) as LiveTokenResponse
        const { apiKey, model } = tokenData
        if (!apiKey) throw new Error('Servizio live non disponibile')
        if (!mounted) return

        // 2. Request microphone access
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        micStreamRef.current = micStream
        if (!mounted) {
          micStream.getTracks().forEach((t) => t.stop())
          return
        }

        // 3. Capture AudioContext at 16 kHz (Gemini input format)
        const captureCtx = new AudioContext({ sampleRate: 16000 })
        captureCtxRef.current = captureCtx

        const source = captureCtx.createMediaStreamSource(micStream)
        const analyser = captureCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser

        // AudioWorklet: float32 → int16 PCM
        const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
        const workletUrl = URL.createObjectURL(blob)
        await captureCtx.audioWorklet.addModule(workletUrl)
        URL.revokeObjectURL(workletUrl)

        const workletNode = new AudioWorkletNode(captureCtx, 'mic-pcm-processor')
        workletNodeRef.current = workletNode

        // source → analyser → worklet → silent gain (keeps graph active, no echo)
        const silencer = captureCtx.createGain()
        silencer.gain.value = 0
        source.connect(workletNode)
        workletNode.connect(silencer)
        silencer.connect(captureCtx.destination)

        // 4. Playback AudioContext at 24 kHz (Gemini output format)
        const playCtx = new AudioContext({ sampleRate: 24000 })
        playCtxRef.current = playCtx
        nextPlayAtRef.current = 0

        // 5. Open WebSocket to Gemini Live API
        const liveModel = model ?? 'gemini-2.0-flash-live-001'
        const wsUrl =
          `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          // Send setup message — system prompt in Italian, audio-only response
          ws.send(
            JSON.stringify({
              setup: {
                model: `models/${liveModel}`,
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Charon' },
                    },
                  },
                },
                systemInstruction: {
                  parts: [
                    {
                      text: 'Sei un assistente AI per la salute e il benessere personale. Rispondi in italiano in modo naturale, conciso e conversazionale. Sei parte di un team multidisciplinare che include nutrizionisti, allenatori, medici e psicologi.',
                    },
                  ],
                },
              },
            }),
          )
        }

        ws.onmessage = (ev) => {
          if (closingRef.current) return
          try {
            const msg = JSON.parse(ev.data as string) as Record<string, unknown>

            // Setup complete → start live phase and begin streaming mic audio
            if (msg.setupComplete !== undefined) {
              if (!mounted) return
              setPhase('live')
              startAnim()

              workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
                if (ws.readyState !== WebSocket.OPEN) return
                ws.send(
                  JSON.stringify({
                    realtimeInput: {
                      mediaChunks: [
                        {
                          mimeType: 'audio/pcm;rate=16000',
                          data: ab2b64(e.data),
                        },
                      ],
                    },
                  }),
                )
              }
              return
            }

            // Audio response from Gemini
            const serverContent = msg.serverContent as Record<string, unknown> | undefined
            const modelTurn = serverContent?.modelTurn as Record<string, unknown> | undefined
            const parts = (modelTurn?.parts as Array<Record<string, unknown>> | undefined) ?? []
            for (const part of parts) {
              const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined
              if (inlineData?.data && inlineData.mimeType?.startsWith('audio/pcm')) {
                playPCM(inlineData.data)
              }
            }
          } catch (e) {
            console.error('[LiveModal] ws parse error', e)
          }
        }

        ws.onerror = (e) => {
          console.error('[LiveModal] ws error', e)
          if (!mounted) return
          setPhase('error')
          setErrorMsg('Connessione interrotta')
        }

        ws.onclose = (e) => {
          if (!mounted || closingRef.current) return
          if (e.code !== 1000) {
            setPhase('error')
            setErrorMsg(`Connessione chiusa (${e.code})`)
          }
        }
      } catch (err: unknown) {
        if (!mounted) return
        console.error('[LiveModal] start error', err)
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Errore avvio sessione')
      }
    }

    void start()

    return () => {
      mounted = false
      cleanup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video ─────────────────────────────────────────────────────────────────────

  async function toggleVideo() {
    if (videoEnabled) {
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setVideoEnabled(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        videoStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
        setVideoEnabled(true)
        setCurrentCameraIdx(0)
      } catch (e) {
        console.error('[LiveModal] camera error', e)
      }
    }
  }

  async function switchCamera() {
    if (videoDevices.length < 2) return
    const nextIdx = (currentCameraIdx + 1) % videoDevices.length
    setCurrentCameraIdx(nextIdx)
    try {
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: videoDevices[nextIdx]?.deviceId } },
      })
      videoStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (e) {
      console.error('[LiveModal] switchCamera error', e)
    }
  }

  function handleEnd() {
    cleanup()
    onClose()
  }

  // ── UI state ──────────────────────────────────────────────────────────────────

  const statusText =
    phase === 'connecting'
      ? 'Connessione a Gemini Live…'
      : phase === 'error'
        ? errorMsg
        : isAiSpeaking
          ? "L'assistente sta parlando…"
          : 'In ascolto — parla liberamente'

  const barColor =
    phase !== 'live' ? 'rgba(255,255,255,0.2)' : isAiSpeaking ? '#007AFF' : '#FF3B30'

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.90)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Video background */}
      {videoEnabled && (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.4,
          }}
        />
      )}

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
              marginBottom: '0.5rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isAiSpeaking ? '#007AFF' : '#FF3B30',
                display: 'inline-block',
                animation:
                  phase === 'live' ? 'lw-pulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span
              style={{
                color: '#fff',
                fontSize: '1.0625rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              LIVE
            </span>
          </div>
          <p
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '0.875rem',
              margin: 0,
              minHeight: '1.25rem',
            }}
          >
            {statusText}
          </p>
        </div>

        {/* Waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '60px' }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: phase === 'connecting' ? '8px' : `${h}px`,
                borderRadius: '2px',
                backgroundColor: barColor,
                transition: 'height 0.08s ease, background-color 0.3s ease',
                animation:
                  phase === 'connecting'
                    ? `lw-bounce ${0.8 + (i % 3) * 0.1}s ${(i * 0.06).toFixed(2)}s ease-in-out infinite`
                    : 'none',
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Switch camera — visible when video is on */}
          {videoEnabled && (
            <button
              type="button"
              onClick={() => {
                void switchCamera()
              }}
              aria-label="Cambia fotocamera"
              style={btnStyle('rgba(255,255,255,0.18)', '3rem')}
            >
              <IconSwitchCamera />
            </button>
          )}

          {/* Video toggle */}
          <button
            type="button"
            onClick={() => {
              void toggleVideo()
            }}
            aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
            style={btnStyle(videoEnabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', '3rem')}
          >
            {videoEnabled ? <IconVideo /> : <IconVideoOff />}
          </button>

          {/* End session — phone-end icon, red circle */}
          <button
            type="button"
            onClick={handleEnd}
            aria-label="Termina sessione"
            style={btnStyle('#FF3B30', '4rem')}
          >
            <IconPhoneEnd />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes lw-bounce {
          0%, 80%, 100% { transform: scaleY(0.6); opacity: 0.5; }
          40% { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes lw-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

function btnStyle(bg: string, size: string): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: bg,
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
}
