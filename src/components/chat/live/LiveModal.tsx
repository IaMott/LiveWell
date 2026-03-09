'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  onClose: () => void
  onTranscription?: (text: string) => void
}

function IconVideo({ crossed }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      {crossed && (
        <>
          <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function LiveModal({ onClose, onTranscription }: Props) {
  const [phase, setPhase] = useState<'requesting' | 'active' | 'processing' | 'error'>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [bars, setBars] = useState<number[]>(Array(12).fill(4))
  const [videoEnabled, setVideoEnabled] = useState(false)
  const mediaRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

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

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRef.current = stream

        try {
          const ctx = new AudioContext()
          const source = ctx.createMediaStreamSource(stream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          analyserRef.current = analyser
        } catch {}

        setPhase('active')
        startAnim()

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const recorder = new MediaRecorder(stream, { mimeType })
        recorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.start()
      } catch (err) {
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Microfono non accessibile')
      }
    }

    start()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      if (mediaRef.current) mediaRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [startAnim])

  async function toggleVideo() {
    if (videoEnabled) {
      // Stop video tracks
      if (mediaRef.current) {
        mediaRef.current.getVideoTracks().forEach((t) => t.stop())
      }
      if (videoRef.current) videoRef.current.srcObject = null
      setVideoEnabled(false)
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
        videoStream.getVideoTracks().forEach((t) => mediaRef.current?.addTrack(t))
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream
          await videoRef.current.play()
        }
        setVideoEnabled(true)
      } catch {}
    }
  }

  async function stopAndSend() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setPhase('processing')

    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      onClose()
      return
    }

    recorder.onstop = async () => {
      if (chunksRef.current.length === 0) { onClose(); return }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      if (blob.size < 1000) { onClose(); return }

      try {
        const fd = new FormData()
        fd.append('file', blob, 'voice.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
        if (res.ok) {
          const data = (await res.json()) as { text?: string }
          if (data.text && onTranscription) onTranscription(data.text)
        }
      } catch {}
      onClose()
    }

    if (mediaRef.current) mediaRef.current.getTracks().forEach((t) => t.stop())
    recorder.stop()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.88)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)',
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
            objectFit: 'cover', opacity: 0.35,
          }}
        />
      )}

      {/* X button top-right */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Chiudi"
        style={{
          position: 'absolute', top: '1.25rem', right: '1.25rem',
          width: '2.5rem', height: '2.5rem', borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.15)', border: 'none',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <IconX />
      </button>

      {/* Content */}
      <div
        style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '2rem', padding: '2rem',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#FF3B30', display: 'inline-block' }} />
            <span style={{ color: '#fff', fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '0.1em' }}>LIVE</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', margin: 0 }}>
            {phase === 'requesting' && 'Richiesta accesso microfono…'}
            {phase === 'active' && 'In ascolto — parla ora'}
            {phase === 'processing' && 'Elaborazione in corso…'}
            {phase === 'error' && errorMsg}
          </p>
        </div>

        {/* Waveform */}
        {(phase === 'active' || phase === 'requesting') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '60px' }}>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  width: '4px',
                  height: `${h}px`,
                  borderRadius: '2px',
                  backgroundColor: phase === 'active' ? '#FF3B30' : 'rgba(255,255,255,0.3)',
                  transition: 'height 0.08s ease',
                }}
              />
            ))}
          </div>
        )}

        {phase === 'processing' && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: '#FF3B30',
                  animation: `lw-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* Controls: video camera button (send) */}
        {phase === 'active' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Video toggle */}
            <button
              type="button"
              onClick={toggleVideo}
              aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
              title={videoEnabled ? 'Disabilita video' : 'Abilita video'}
              style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '50%', border: 'none',
                backgroundColor: videoEnabled ? '#FF3B30' : 'rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconVideo crossed={!videoEnabled} />
            </button>

            {/* Send (stop + transcribe) */}
            <button
              type="button"
              onClick={stopAndSend}
              aria-label="Invia messaggio"
              title="Invia messaggio vocale"
              style={{
                width: '4rem', height: '4rem', borderRadius: '50%', border: 'none',
                backgroundColor: '#FF3B30', color: '#fff',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {/* Mic / stop icon */}
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes lw-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
