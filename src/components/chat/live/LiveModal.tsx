'use client'

import type React from 'react'
import { useEffect, useRef, useState, useCallback } from 'react'

// Minimal Web Speech API type definitions (not always in TS lib)
interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}
interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onstart: ((ev: Event) => void) | null
  onend: ((ev: Event) => void) | null
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onspeechend: ((ev: Event) => void) | null
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface Props {
  onClose: () => void
  onTranscription?: (text: string) => void
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
      <path d="M15 9.5L23 7v10l-7.5-2.5" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  )
}

function IconSwitchCamera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M9 2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z" />
      <circle cx="12" cy="13" r="3" />
      <path d="M10 10.5 L14 14.5" />
    </svg>
  )
}

function IconPhoneEnd() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10 21 3 14 3 5c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  )
}

type Phase = 'requesting' | 'listening' | 'thinking' | 'aiSpeaking' | 'error'

export function LiveModal({ onClose, onTranscription }: Props) {
  const [phase, setPhase] = useState<Phase>('requesting')
  const [interimText, setInterimText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [bars, setBars] = useState<number[]>(Array(12).fill(4))
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const animRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const finalTranscriptRef = useRef('')
  const isClosingRef = useRef(false)
  const phaseRef = useRef<Phase>('requesting')
  const prevTtsSpeakingRef = useRef(false)

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Waveform animation ────────────────────────────────────────────────────

  const startAnim = useCallback(() => {
    function tick() {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const step = Math.floor(data.length / 12)
        setBars(Array.from({ length: 12 }, (_, i) => {
          const val = data[i * step] ?? 0
          return Math.max(4, Math.round((val / 255) * 48))
        }))
      } else {
        setBars((prev) => prev.map(() => Math.floor(Math.random() * 20) + 4))
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  function stopAnim() {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
    setBars(Array(12).fill(4))
  }

  // ── Mic analyser for waveform ─────────────────────────────────────────────

  async function startMicAnalyser() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      startAnim()
    } catch {}
  }

  // ── Speech Recognition setup ─────────────────────────────────────────────

  function startListening(recognition: SpeechRecognitionInstance) {
    if (isClosingRef.current) return
    finalTranscriptRef.current = ''
    setInterimText('')
    setPhase('listening')
    try { recognition.start() } catch {}
  }

  useEffect(() => {
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : null

    if (!SpeechRecognitionClass) {
      setPhase('error')
      setErrorMsg('Riconoscimento vocale non supportato. Usa Chrome o Safari.')
      return
    }

    void startMicAnalyser()

    const recognition = new SpeechRecognitionClass() as SpeechRecognitionInstance
    recognition.lang = 'it-IT'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += t
        } else {
          interim += t
        }
      }
      setInterimText(finalTranscriptRef.current + interim)
    }

    recognition.onend = () => {
      if (isClosingRef.current) return
      const text = finalTranscriptRef.current.trim()

      if (text) {
        // Speech detected — send to AI, wait for TTS to finish
        setPhase('thinking')
        setInterimText('')
        onTranscription?.(text)
        // Recognition restarts automatically when TTS ends (via polling below)
      } else {
        // No speech — restart listening after a short pause
        if (!isClosingRef.current) {
          setTimeout(() => {
            if (!isClosingRef.current && (phaseRef.current === 'listening' || phaseRef.current === 'requesting')) {
              startListening(recognition)
            }
          }, 400)
        }
      }
    }

    recognition.onerror = (event) => {
      if (isClosingRef.current) return
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Benign — restart
        setTimeout(() => {
          if (!isClosingRef.current && (phaseRef.current === 'listening' || phaseRef.current === 'requesting')) {
            startListening(recognition)
          }
        }, 400)
        return
      }
      setPhase('error')
      setErrorMsg(`Errore microfono: ${event.error}`)
    }

    startListening(recognition)

    return () => {
      isClosingRef.current = true
      recognition.stop()
      stopAnim()
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Monitor TTS (AI speaking) via polling ─────────────────────────────────
  // When TTS starts: show aiSpeaking phase (recognition paused)
  // When TTS ends:   restart recognition automatically

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    const timer = setInterval(() => {
      const ttsActive = window.speechSynthesis.speaking
      const wasActive = prevTtsSpeakingRef.current

      if (ttsActive && !wasActive) {
        // AI started speaking
        prevTtsSpeakingRef.current = true
        setPhase('aiSpeaking')
      } else if (!ttsActive && wasActive) {
        // AI finished speaking → restart listening
        prevTtsSpeakingRef.current = false
        if (!isClosingRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (!isClosingRef.current) {
              startListening(recognitionRef.current!)
            }
          }, 400)
        }
      }
    }, 150)

    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (videoEnabled && videoRef.current && videoStreamRef.current) {
      videoRef.current.srcObject = videoStreamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [videoEnabled])

  async function startVideo(deviceId?: string) {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      videoStreamRef.current = stream
      setVideoEnabled(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
    } catch {}
  }

  function stopVideo() {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setVideoEnabled(false)
  }

  async function toggleVideo() {
    if (videoEnabled) {
      stopVideo()
    } else {
      await startVideo()
      setCurrentCameraIdx(0)
    }
  }

  async function switchCamera() {
    if (videoDevices.length < 2) return
    const nextIdx = (currentCameraIdx + 1) % videoDevices.length
    setCurrentCameraIdx(nextIdx)
    await startVideo(videoDevices[nextIdx]?.deviceId)
  }

  function handleEnd() {
    isClosingRef.current = true
    recognitionRef.current?.stop()
    window.speechSynthesis?.cancel()
    stopVideo()
    stopAnim()
    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
    onClose()
  }

  // ── Status text ──────────────────────────────────────────────────────────

  const statusText: Record<Phase, string> = {
    requesting: 'Accesso al microfono…',
    listening: 'In ascolto — parla liberamente',
    thinking: 'Il team sta elaborando…',
    aiSpeaking: 'L\'assistente sta parlando…',
    error: errorMsg,
  }

  // ── Bar color ────────────────────────────────────────────────────────────

  const barColor =
    phase === 'listening' ? '#FF3B30' :
    phase === 'aiSpeaking' ? '#007AFF' :
    'rgba(255,255,255,0.3)'

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.90)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
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
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.4,
          }}
        />
      )}

      <div
        style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '2rem', padding: '2rem', width: '100%', maxWidth: '400px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <span
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: phase === 'aiSpeaking' ? '#007AFF' : '#FF3B30',
                display: 'inline-block',
                animation: (phase === 'listening' || phase === 'aiSpeaking') ? 'lw-pulse 2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: '#fff', fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '0.1em' }}>
              LIVE
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0, minHeight: '1.25rem' }}>
            {statusText[phase]}
          </p>
          {/* Interim transcript */}
          {interimText && phase === 'listening' && (
            <p style={{
              color: 'rgba(255,255,255,0.85)', fontSize: '0.9375rem',
              margin: '0.75rem 0 0', fontStyle: 'italic',
              maxWidth: '280px', textAlign: 'center',
            }}>
              "{interimText}"
            </p>
          )}
        </div>

        {/* Waveform */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '60px' }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: '4px',
                height: phase === 'thinking' ? '8px' : `${h}px`,
                borderRadius: '2px',
                backgroundColor: barColor,
                transition: 'height 0.08s ease, background-color 0.3s ease',
                animation: phase === 'thinking' ? `lw-bounce ${0.8 + (i % 3) * 0.1}s ${(i * 0.06).toFixed(2)}s ease-in-out infinite` : 'none',
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
              onClick={() => { void switchCamera() }}
              aria-label="Cambia fotocamera"
              style={btnStyle('rgba(255,255,255,0.18)', '3rem')}
            >
              <IconSwitchCamera />
            </button>
          )}

          {/* Video toggle */}
          <button
            type="button"
            onClick={() => { void toggleVideo() }}
            aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
            style={btnStyle(videoEnabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)', '3rem')}
          >
            {videoEnabled ? <IconVideo /> : <IconVideoOff />}
          </button>

          {/* End session */}
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
    width: size, height: size, borderRadius: '50%', border: 'none',
    backgroundColor: bg, color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }
}
