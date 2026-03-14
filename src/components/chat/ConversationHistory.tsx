'use client'

import { useEffect, useState } from 'react'
import { X, MessageSquare, Trash2, Plus, Download } from 'lucide-react'

type ConvPreview = {
  id: string
  title: string
  preview: string
  updatedAt: string
  specialist?: string | null
}

type Props = {
  open: boolean
  currentId?: string
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onExport: (id: string) => void
}

export function ConversationHistory({
  open,
  currentId,
  onClose,
  onSelect,
  onNew,
  onExport,
}: Props) {
  const [convs, setConvs] = useState<ConvPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data: { conversations: ConvPreview[] }) => setConvs(data.conversations ?? []))
      .catch(() => setConvs([]))
      .finally(() => setLoading(false))
  }, [open])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return
    setDeleting(id)
    try {
      await fetch(`/api/conversations?id=${id}`, { method: 'DELETE' })
      setConvs((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleExport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (exporting) return
    setExporting(id)
    try {
      await onExport(id)
    } finally {
      setExporting(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 40,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '70vh',
          background: 'var(--color-surface)',
          borderRadius: '1.25rem 1.25rem 0 0',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle + Header */}
        <div
          style={{
            padding: '0.75rem 1rem 0.5rem',
            borderBottom: '1px solid var(--color-separator)',
          }}
        >
          <div
            style={{
              width: '2.5rem',
              height: '0.25rem',
              background: 'var(--color-separator)',
              borderRadius: '9999px',
              margin: '0 auto 0.75rem',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.0625rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Cronologia
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  onNew()
                  onClose()
                }}
                aria-label="Nuova conversazione"
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--color-accent)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
              </button>
              <button
                onClick={onClose}
                aria-label="Chiudi"
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p
              style={{
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                padding: '2rem 0',
              }}
            >
              Caricamento…
            </p>
          )}
          {!loading && convs.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '3rem 1rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              <MessageSquare size={32} strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Nessuna conversazione salvata</p>
            </div>
          )}
          {!loading &&
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c.id)
                  onClose()
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: c.id === currentId ? 'var(--color-bg)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--color-separator)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <MessageSquare
                  size={18}
                  strokeWidth={1.5}
                  color="var(--color-text-secondary)"
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {c.specialist && (
                    <p
                      style={{
                        margin: '0 0 0.125rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: 'var(--color-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.specialist}
                    </p>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.9375rem',
                      fontWeight: c.id === currentId ? 600 : 400,
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.title}
                  </p>
                  {c.preview && (
                    <p
                      style={{
                        margin: '0.125rem 0 0',
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.preview}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-secondary)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {new Date(c.updatedAt).toLocaleString('it-IT', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <button
                  onClick={(e) => handleExport(c.id, e)}
                  aria-label="Esporta conversazione"
                  style={{
                    padding: '0.25rem',
                    background: 'transparent',
                    border: 'none',
                    color:
                      exporting === c.id ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Download size={15} />
                </button>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  aria-label="Elimina conversazione"
                  style={{
                    padding: '0.25rem',
                    background: 'transparent',
                    border: 'none',
                    color: deleting === c.id ? 'var(--color-text-secondary)' : '#FF3B30',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </button>
            ))}
        </div>
      </div>
    </>
  )
}
