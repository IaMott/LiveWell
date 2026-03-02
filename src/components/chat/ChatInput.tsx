'use client'

import { useState, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { Send, Paperclip, ScanBarcode, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarcodeScanner, ImageUpload, AudioRecorder, type UploadedFile } from './attachments'

export interface ChatAttachment {
  url: string
  fileName: string
  fileSize: number
  mimeType: string
  type: 'image' | 'barcode' | 'audio'
  barcodeValue?: string
}

interface ChatInputProps {
  onSend: (content: string, attachments?: ChatAttachment[]) => void
  disabled?: boolean
  className?: string
}

export function ChatInput({ onSend, disabled, className }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showRecorder, setShowRecorder] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [])

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault()
      const trimmed = value.trim()
      if ((!trimmed && attachments.length === 0) || disabled) return
      onSend(trimmed || '(allegato)', attachments.length > 0 ? attachments : undefined)
      setValue('')
      setAttachments([])
      setShowRecorder(false)
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    },
    [value, disabled, onSend, attachments],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleBarcodeScan = useCallback((barcodeValue: string, format: string) => {
    setShowScanner(false)
    setAttachments((prev) => [
      ...prev,
      {
        url: '',
        fileName: `barcode-${format}`,
        fileSize: 0,
        mimeType: 'text/plain',
        type: 'barcode' as const,
        barcodeValue,
      },
    ])
    setValue((prev) => (prev ? `${prev}\n` : '') + `[Barcode: ${barcodeValue}]`)
  }, [])

  const handleImageUpload = useCallback((file: UploadedFile) => {
    setShowUpload(false)
    setAttachments((prev) => [
      ...prev,
      { ...file, type: 'image' as const },
    ])
  }, [])

  const handleAudioTranscription = useCallback((text: string) => {
    setValue((prev) => (prev ? `${prev} ` : '') + text)
    setShowRecorder(false)
  }, [])

  const handleAudioReady = useCallback((file: File, url: string) => {
    setAttachments((prev) => [
      ...prev,
      {
        url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        type: 'audio' as const,
      },
    ])
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const hasContent = value.trim() || attachments.length > 0

  return (
    <>
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          'shrink-0 border-t border-surface-dim bg-surface/80 backdrop-blur-sm',
          'px-[var(--spacing-chat-px)] py-3',
          className,
        )}
      >
        <div className="mx-auto max-w-2xl">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg bg-surface-dim px-2.5 py-1.5 text-xs text-on-surface"
                >
                  {att.type === 'barcode' ? (
                    <ScanBarcode className="h-3.5 w-3.5 text-brand-500" />
                  ) : att.type === 'audio' ? (
                    <Mic className="h-3.5 w-3.5 text-brand-500" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.url} alt="" className="h-6 w-6 rounded object-cover" />
                  )}
                  <span className="max-w-[120px] truncate">
                    {att.type === 'barcode' ? att.barcodeValue : att.fileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="ml-1 text-on-surface-muted hover:text-red-500"
                    aria-label="Rimuovi allegato"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Image upload panel */}
          {showUpload && (
            <div className="mb-2">
              <ImageUpload
                onUpload={handleImageUpload}
                onClose={() => setShowUpload(false)}
              />
            </div>
          )}

          {/* Audio recorder panel */}
          {showRecorder && (
            <div className="mb-2 rounded-xl border border-surface-dim bg-surface p-3">
              <AudioRecorder
                onTranscription={handleAudioTranscription}
                onAudioReady={handleAudioReady}
                disabled={disabled}
              />
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* Attachment buttons */}
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowUpload(!showUpload)
                  setShowScanner(false)
                  setShowRecorder(false)
                }}
                disabled={disabled}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full',
                  'text-on-surface-muted transition-colors',
                  'hover:bg-surface-dim hover:text-on-surface',
                  'disabled:opacity-40',
                )}
                aria-label="Allega immagine"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowScanner(true)
                  setShowUpload(false)
                  setShowRecorder(false)
                }}
                disabled={disabled}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full',
                  'text-on-surface-muted transition-colors',
                  'hover:bg-surface-dim hover:text-on-surface',
                  'disabled:opacity-40',
                )}
                aria-label="Scansiona codice a barre"
              >
                <ScanBarcode className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRecorder(!showRecorder)
                  setShowUpload(false)
                  setShowScanner(false)
                }}
                disabled={disabled}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full',
                  'text-on-surface-muted transition-colors',
                  'hover:bg-surface-dim hover:text-on-surface',
                  'disabled:opacity-40',
                  showRecorder && 'bg-red-500/10 text-red-500',
                )}
                aria-label="Registra messaggio vocale"
              >
                <Mic className="h-5 w-5" />
              </button>
            </div>

            {/* Text input */}
            <div
              className={cn(
                'flex min-h-[2.75rem] flex-1 items-end rounded-[var(--radius-input)]',
                'border border-surface-dim bg-surface-bright px-4 py-2',
                'focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400/30',
                'transition-colors',
              )}
            >
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  adjustHeight()
                }}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi un messaggio..."
                rows={1}
                disabled={disabled}
                className={cn(
                  'max-h-40 w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed',
                  'text-on-surface placeholder:text-on-surface-muted',
                  'outline-none disabled:opacity-50',
                )}
              />
            </div>

            {/* Send button */}
            <button
              type="submit"
              disabled={disabled || !hasContent}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                'bg-brand-500 text-white transition-all',
                'hover:bg-brand-600 active:scale-95',
                'disabled:opacity-40 disabled:hover:bg-brand-500 disabled:active:scale-100',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              )}
              aria-label="Invia messaggio"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </form>
    </>
  )
}
