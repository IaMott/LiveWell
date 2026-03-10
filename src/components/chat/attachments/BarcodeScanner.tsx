'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, ScanBarcode } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BarcodeScannerProps {
  onScan: (value: string, format: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()

        if (!videoRef.current || cancelled) return

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        videoRef.current.srcObject = stream

        const result = await reader.decodeOnceFromVideoElement(videoRef.current)

        if (!cancelled && result) {
          setScanning(false)
          onScan(result.getText(), result.getBarcodeFormat().toString())
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof DOMException && err.name === 'NotAllowedError') {
            setError('Permesso fotocamera negato')
          } else {
            setError('Impossibile avviare lo scanner')
          }
          setScanning(false)
        }
      }
    }

    startScanner()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [onScan, stopCamera])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-white">
          <ScanBarcode className="h-5 w-5" />
          <span className="text-sm font-medium">Scansiona codice a barre</span>
        </div>
        <button
          onClick={() => {
            stopCamera()
            onClose()
          }}
          className="rounded-full p-2 text-white hover:bg-white/10"
          aria-label="Chiudi scanner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <p className="text-center text-sm text-red-400">{error}</p>
        ) : (
          <div className="relative w-full max-w-sm overflow-hidden rounded-xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
            />
            {scanning && (
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center',
                  'border-2 border-brand-400/50 rounded-xl',
                )}
              >
                <div className="h-0.5 w-3/4 animate-pulse bg-brand-400/70" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
