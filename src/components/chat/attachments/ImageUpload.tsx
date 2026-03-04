'use client'

import { useRef, useState, useCallback } from 'react'
import { X, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UploadedFile {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
}

interface ImageUploadProps {
  onUpload: (file: UploadedFile) => void
  onClose: () => void
}

const MAX_DIMENSION = 1200

function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
        resolve(file)
        return
      }

      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Resize fallito'))),
        file.type,
        0.85,
      )
    }
    img.onerror = () => reject(new Error('Immagine non valida'))
    img.src = URL.createObjectURL(file)
  })
}

export function ImageUpload({ onUpload, onClose }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedFile = useRef<File | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    selectedFile.current = file
    setPreview(URL.createObjectURL(file))
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selectedFile.current) return

    setUploading(true)
    setError(null)

    try {
      const resized = await resizeImage(selectedFile.current)
      const formData = new FormData()
      formData.append('file', resized, selectedFile.current.name)

      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload fallito' }))
        setError(data.error || 'Upload fallito')
        return
      }

      const data: UploadedFile = await res.json()
      onUpload(data)
    } catch {
      setError('Errore di connessione')
    } finally {
      setUploading(false)
    }
  }, [onUpload])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-surface-dim bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">Allega immagine</span>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-on-surface-muted hover:bg-surface-dim"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
            'border-surface-dim p-6 text-on-surface-muted',
            'hover:border-brand-400 hover:text-brand-500 transition-colors',
          )}
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">Tocca per scegliere un&apos;immagine</span>
        </button>
      ) : (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Anteprima"
            className="max-h-48 w-full rounded-lg object-contain"
          />
          <button
            onClick={() => {
              setPreview(null)
              selectedFile.current = null
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
            aria-label="Rimuovi immagine"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {preview && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={cn(
            'rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white',
            'hover:bg-brand-600 disabled:opacity-50 transition-colors',
          )}
        >
          {uploading ? 'Caricamento...' : 'Invia immagine'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
