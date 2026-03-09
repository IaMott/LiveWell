'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

function IconSwitchCamera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
      <path d="M9 2H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z" />
      <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M9.5 9.5 L14.5 14.5" />
    </svg>
  )
}

export function LiveModal({ onClose, onTranscription }: Props) {
  const [phase, setPhase] = useState<'requesting' | 'active' | 'processing' | 'error'>('requesting')
  const [errorMsg, setErrorMsg] = useState('')
  const [bars, setBars] = useState<number[]>(Array(12).fill(4))
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0)

  const audioStreamRef = useRef<MediaStream | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
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

  // Start audio on mount
  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = stream

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
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [startAnim])

  // Enumerate video devices when video is enabled
  useEffect(() => {
    if (!videoEnabled) return
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
    }).catch(() => {})
  }, [videoEnabled])

  // Attach video stream to <video> element after it mounts
  useEffect(() => {
    if (videoEnabled && videoRef.current && videoStreamRef.current) {
      videoRef.current.srcObject = videoStreamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [videoEnabled])

  async function startVideo(deviceId?: string) {
    // Stop any existing video stream
    videoStreamRef.current?.getTracks().forEach((t) => t.stop())
    videoStreamRef.current = null

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      videoStreamRef.current = stream
      setVideoEnabled(true)
      // If ref is already mounted (switching camera), attach immediately
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
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
      // Enumerate after first start to populate device list
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
      const vdevs = devices.filter((d) => d.kind === 'videoinput')
      setVideoDevices(vdevs)
      setCurrentCameraIdx(0)
    }
  }

  async function switchCamera() {
    if (videoDevices.length < 2) return
    const nextIdx = (currentCameraIdx + 1) % videoDevices.length
    setCurrentCameraIdx(nextIdx)
    await startVideo(videoDevices[nextIdx]?.deviceId)
  }

  async function stopAndSend() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setPhase('processing')
    stopVideo()

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

    audioStreamRef.current?.getTracks().forEach((t) => t.stop())
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
            objectFit: 'cover', opacity: 0.45,
          }}
        />
      )}

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

        {/* Controls */}
        {phase === 'active' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

            {/* Camera switch button — only when multiple cameras & video active */}
            {videoEnabled && videoDevices.length > 1 && (
              <button
                type="button"
                onClick={() => { void switchCamera() }}
                aria-label="Cambia fotocamera"
                title="Cambia fotocamera"
                style={{
                  width: '3rem', height: '3rem', borderRadius: '50%', border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconSwitchCamera />
              </button>
            )}

            {/* Video toggle */}
            <button
              type="button"
              onClick={() => { void toggleVideo() }}
              aria-label={videoEnabled ? 'Disabilita video' : 'Abilita video'}
              title={videoEnabled ? 'Disabilita video' : 'Abilita video'}
              style={{
                width: '3.5rem', height: '3.5rem', borderRadius: '50%', border: 'none',
                backgroundColor: videoEnabled ? '#FF3B30' : 'rgba(255,255,255,0.15)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconVideo />
            </button>

            {/* Stop + send */}
            <button
              type="button"
              onClick={() => { void stopAndSend() }}
              aria-label="Invia messaggio"
              title="Invia messaggio vocale"
              style={{
                width: '4rem', height: '4rem', borderRadius: '50%', border: 'none',
                backgroundColor: '#FF3B30', color: '#fff',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
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
