'use client'

import { useState, useRef, useEffect } from 'react'
import { Share2, Download, Link2, Copy, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShareMenuProps {
  conversationId: string | null
}

export function ShareMenu({ conversationId }: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  if (!conversationId) return null

  async function handleExport() {
    const a = document.createElement('a')
    a.href = `/api/conversations/${conversationId}/export`
    a.download = `livewell-${conversationId!.slice(0, 8)}.txt`
    a.click()
    setOpen(false)
  }

  async function handleShare() {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
      })
      if (!res.ok) return
      const data = await res.json()
      const fullUrl = `${window.location.origin}${data.shareUrl}`
      setShareUrl(fullUrl)

      // Try native share API on mobile
      if (navigator.share) {
        await navigator.share({
          title: 'Conversazione LiveWell',
          url: fullUrl,
        })
        setOpen(false)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          'text-on-surface-muted transition-colors hover:text-on-surface',
        )}
        aria-label="Condividi conversazione"
      >
        <Share2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-[var(--radius-card)] border border-surface-dim bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-surface-dim px-3 py-2">
            <span className="text-sm font-semibold text-on-surface">Condividi</span>
            <button onClick={() => setOpen(false)} className="text-on-surface-muted hover:text-on-surface">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-2 space-y-1">
            <button
              onClick={handleExport}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-dim"
            >
              <Download className="h-4 w-4 text-on-surface-muted" />
              Esporta come testo
            </button>

            <button
              onClick={handleShare}
              disabled={loading}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-dim disabled:opacity-50"
            >
              <Link2 className="h-4 w-4 text-on-surface-muted" />
              {loading ? 'Creazione link...' : 'Crea link condivisibile'}
            </button>

            {shareUrl && (
              <div className="mt-2 rounded-lg bg-surface-dim p-2">
                <p className="mb-1.5 truncate text-xs text-on-surface-muted">{shareUrl}</p>
                <button
                  onClick={handleCopy}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiato!' : 'Copia link'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
