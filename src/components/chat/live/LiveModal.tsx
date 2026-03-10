'use client'

import type React from 'react'
import { GoogleGenAI } from '@google/genai'
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
  onTranscription?: (text: string) => void
}

// ── Live model candidates (fallback chain if primary gets 1008) ────────────────

const LIVE_MODEL_FALLBACKS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-live-2.5-flash-preview-native-audio-09-2025',
  'gemini-2.0-flash-live-001',
]

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
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10 21 3 14 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
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

function IconSwitchCamera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7h-3.5l-1.5-2H9L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M9 13l2-2 2 2" />
      <path d="M13 11l2 2-2 2" />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveModal({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [statusText, setStatusText] = useState('Connessione a Gemini Live…')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0)
  const [bars, setBars] = useState<number[]>(Array(12).fill(4))

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

  // ── Waveform animation ────────────────────────────────────────────────────

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

  // ── Audio playback ────────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    outputSourcesRef.current.forEach((src) => {
      try { src.stop() } catch { /* already stopped */ }
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
      if (outputSourcesRef.current.size === 0 && outputNextPlayRef.current <= ctx.currentTime + 0.1) {
        setIsAiSpeaking(false)
      }
    }
  }, [])

  // ── Media streaming (mic + optional video) ────────────────────────────────

  const startMediaStreaming = useCallback(
    async (session: LiveSession, micStream: MediaStream) => {
      // window.AudioContext is available globally; webkit prefix cast uses unknown (not any)
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

      // ScriptProcessor: reliable cross-browser, no worker-blob CSP issues
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
      setStatusText('In ascolto — parla liberamente')
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

    try { sessionRef.current?.close() } catch { /* ignore */ }
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
          body: JSON.stringify({}),
        })
        if (!tokenRes.ok) {
          const err = (await tokenRes.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Autenticazione fallita')
        }
        const tokenData = (await tokenRes.json()) as { token: string; model: string }
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
        } catch { /* ignore — camera list not critical */ }

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

        // Use model from server (already the right fallback chain on server side)
        // but prefer the known working model locally if server returns a legacy one
        const serverModel = tokenData.model ?? ''
        const liveModel =
          serverModel && !serverModel.includes('2.0-flash-live')
            ? serverModel
            : (LIVE_MODEL_FALLBACKS[0] ?? serverModel)

        const liveConfig: LiveConnectConfig = {
          systemInstruction: {
            parts: [
              {
                text: 'Sei un assistente AI per la salute e il benessere personale. Rispondi in italiano in modo naturale, conciso e conversazionale. Sei parte di un team multidisciplinare che include nutrizionisti, allenatori, medici e psicologi.',
              },
            ],
          },
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        }

        // ── Do NOT reference `rawSession` inside callbacks — Temporal Dead Zone ──
        // onopen sets the ready flag only; startMediaStreaming is called AFTER
        // await resolves so rawSession is guaranteed assigned (iManager pattern).
        const rawSession = (await ai.live.connect({
          model: liveModel,
          config: liveConfig,
          callbacks: {
            onopen: () => {
              // Mark ready so ScriptProcessor onaudioprocess will start sending
              sessionReadyRef.current = true
            },
            onmessage: (message: LiveServerMessage) => {
              if (!mounted || closingRef.current) return
              const parts = message.serverContent?.modelTurn?.parts ?? []
              for (const part of parts) {
                const inline = part.inlineData
                if (inline?.data && (inline.mimeType ?? '').startsWith('audio/pcm')) {
                  enqueuePCM(inline.data)
                }
              }
            },
            onerror: (error: ErrorEvent) => {
              console.error('[LiveModal] session error', error)
              if (!mounted) return
              setPhase('error')
              setStatusText('Errore connessione Live')
            },
            onclose: (ev: CloseEvent) => {
              if (!mounted || closingRef.current) return
              if (ev.code !== 1000) {
                const reason = ev.reason ? ` — ${ev.reason}` : ''
                setPhase('error')
                setStatusText(`Sessione chiusa (${ev.code}${reason})`)
                console.error('[LiveModal] session closed', ev.code, ev.reason)
              }
            },
          },
        })) as unknown as LiveSession

        // Secure session ref before starting media pipeline
        sessionRef.current = rawSession
        if (!mounted) {
          rawSession.close()
          return
        }

        // Start audio pipeline now that rawSession is assigned.
        // onaudioprocess checks sessionReadyRef (set in onopen) so no audio
        // is sent until the WebSocket is actually open.
        await startMediaStreaming(rawSession, micStream)
      } catch (err: unknown) {
        if (!mounted) return
        console.error('[LiveModal] connect error', err)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start video stream with a specific device ─────────────────────────────

  const startVideoStream = useCallback(async (deviceId?: string) => {
    const constraints: MediaStreamConstraints = deviceId
      ? { video: { deviceId: { exact: deviceId } } }
      : { video: { facingMode: 'environment' } }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints)
    } catch {
      // Fallback: any camera
      stream = await navigator.mediaDevices.getUserMedia({ video: true })
    }

    // Refresh camera device list after permission
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter((d) => d.kind === 'videoinput')
      setVideoDevices(cameras)
    } catch { /* ignore */ }

    videoStreamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    setVideoEnabled(true)

    // Send a video frame to Gemini every 1.1 seconds
    videoTimerRef.current = window.setInterval(() => {
      const session = sessionRef.current
      if (!sessionReadyRef.current || !session || !videoRef.current || !videoStreamRef.current) return
      if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(videoRef.current, 0, 0, 320, 180)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.55)
      session.sendRealtimeInput({
        video: {
          mimeType: 'image/jpeg',
          data: dataUrl.split(',')[1],
        },
      })
    }, 1100)
  }, [])

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
    if (!videoEnabled || videoDevices.length < 2) return
    const nextIdx = (currentCameraIdx + 1) % videoDevices.length
    setCurrentCameraIdx(nextIdx)

    // Stop current video stream
    if (videoTimerRef.current) {
      clearInterval(videoTimerRef.current)
      videoTimerRef.current = null
    }
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setVideoEnabled(false)

    // Start with new camera
    try {
      await startVideoStream(videoDevices[nextIdx]?.deviceId)
    } catch (e) {
      console.error('[LiveModal] camera switch error', e)
    }
  }

  function handleEnd() {
    cleanup()
    onClose()
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  const barColor =
    phase !== 'live'
      ? 'rgba(255,255,255,0.2)'
      : isAiSpeaking
        ? '#007AFF'
        : '#FF3B30'

  const displayStatus =
    phase === 'live' && isAiSpeaking ? "L'assistente sta parlando…" : statusText

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Camera preview — always in DOM so videoRef is immediately available on enable */}
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
          opacity: videoEnabled ? 0.35 : 0,
          pointerEvents: 'none',
        }}
      />

      {/* Overlay content */}
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
                animation: phase === 'live' ? 'lw-live-pulse 2s ease-in-out infinite' : 'none',
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
            {displayStatus}
          </p>
        </div>

        {/* Waveform visualiser */}
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
                    ? `lw-live-bar ${0.8 + (i % 3) * 0.1}s ${(i * 0.06).toFixed(2)}s ease-in-out infinite`
                    : 'none',
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Video toggle */}
          <button
            type="button"
            onClick={() => void toggleVideo()}
            aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
            style={circleBtn(videoEnabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', '3rem')}
          >
            {videoEnabled ? <IconVideo /> : <IconVideoOff />}
          </button>

          {/* Camera switch — shown only when video is on and multiple cameras available */}
          {videoEnabled && videoDevices.length > 1 && (
            <button
              type="button"
              onClick={() => void switchCamera()}
              aria-label="Cambia fotocamera"
              style={circleBtn('rgba(255,255,255,0.12)', '3rem')}
            >
              <IconSwitchCamera />
            </button>
          )}

          {/* End session */}
          <button
            type="button"
            onClick={handleEnd}
            aria-label="Termina sessione"
            style={circleBtn('#FF3B30', '4rem')}
          >
            <IconPhoneEnd />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes lw-live-bar {
          0%, 80%, 100% { transform: scaleY(0.6); opacity: 0.5; }
          40% { transform: scaleY(1.4); opacity: 1; }
        }
        @keyframes lw-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  )
}

function circleBtn(bg: string, size: string): React.CSSProperties {
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
