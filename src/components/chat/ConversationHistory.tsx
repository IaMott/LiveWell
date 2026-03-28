'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, MessageSquare, Trash2, Plus, MoreHorizontal } from 'lucide-react'

type ConvPreview = {
  id: string
  title: string
  preview: string
  updatedAt: string
  specialist?: string | null
  caseStatus?: string | null
  casePriority?: string | null
}

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  open: 'Aperta',
  active: 'Attiva',
  pending: 'In attesa',
  completed: 'Conclusa',
  archived: 'Archiviata',
}

const STATUS_COLOR: Record<string, string> = {
  open: '#007AFF',
  active: '#34C759',
  pending: '#FF9500',
  completed: '#8E8E93',
  archived: '#636366',
}

const PRIORITY_LABEL: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  normal: '',
  low: 'Bassa',
  backlog: 'Backlog',
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#FF3B30',
  high: '#FF9500',
  normal: '',
  low: '#8E8E93',
  backlog: '#636366',
}

type StatusFilter = 'all' | 'active' | 'archived'

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
  const [exportingFeedback, setExportingFeedback] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [patching, setPatching] = useState<string | null>(null)

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

  /**
   * PATCH handler — the real write path for caseStatus/casePriority.
   * Optimistically updates local state, then syncs with server.
   */
  const handlePatch = useCallback(
    async (id: string, patch: { caseStatus?: string; casePriority?: string }) => {
      if (patching) return
      setPatching(id)
      // Optimistic update
      setConvs((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                ...(patch.caseStatus ? { caseStatus: patch.caseStatus } : {}),
                ...(patch.casePriority ? { casePriority: patch.casePriority } : {}),
              }
            : c,
        ),
      )
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          // Revert optimistic update on failure
          setConvs((prev) =>
            prev.map((c) =>
              c.id === id
                ? {
                    ...c,
                    ...(patch.caseStatus ? { caseStatus: undefined } : {}),
                    ...(patch.casePriority ? { casePriority: undefined } : {}),
                  }
                : c,
            ),
          )
        }
      } catch {
        /* best-effort — optimistic state remains */
      } finally {
        setPatching(null)
      }
    },
    [patching],
  )

  const handleExportWithFeedback = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (exportingFeedback) return
    setExportingFeedback(id)
    try {
      const res = await fetch(`/api/conversations/${id}/export?includeFeedback=true`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `livewell-${id.slice(0, 8)}-feedback.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExportingFeedback(null)
    }
  }

  if (!open) return null

  const filteredConvs = convs.filter((c) => {
    if (statusFilter === 'active')
      return c.caseStatus !== 'completed' && c.caseStatus !== 'archived'
    if (statusFilter === 'archived')
      return c.caseStatus === 'completed' || c.caseStatus === 'archived'
    return true
  })

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Tutte' },
    { key: 'active', label: 'Backlog vivo' },
    { key: 'archived', label: 'Archivio' },
  ]

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

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.5rem 1rem',
            borderBottom: '1px solid var(--color-separator)',
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: statusFilter === tab.key ? 600 : 400,
                background: statusFilter === tab.key ? 'var(--color-accent)' : 'var(--color-bg)',
                color: statusFilter === tab.key ? '#fff' : 'var(--color-text-secondary)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
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
          {!loading && filteredConvs.length === 0 && (
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
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                {convs.length === 0
                  ? 'Nessuna conversazione salvata'
                  : 'Nessuna conversazione in questa categoria'}
              </p>
            </div>
          )}
          {!loading &&
            filteredConvs.map((c) => (
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
                  {/* Status / Priority badges — always show, clickable to open controls */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.25rem',
                      marginTop: '0.25rem',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {c.caseStatus && c.caseStatus !== 'active' && (
                      <span
                        style={{
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: STATUS_COLOR[c.caseStatus] ?? '#8E8E93',
                          background: `${STATUS_COLOR[c.caseStatus] ?? '#8E8E93'}18`,
                          borderRadius: '4px',
                          padding: '0.1rem 0.35rem',
                          lineHeight: 1.4,
                        }}
                      >
                        {STATUS_LABEL[c.caseStatus] ?? c.caseStatus}
                      </span>
                    )}
                    {c.casePriority &&
                      c.casePriority !== 'normal' &&
                      PRIORITY_LABEL[c.casePriority] && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: PRIORITY_COLOR[c.casePriority] ?? '#8E8E93',
                            background: `${PRIORITY_COLOR[c.casePriority] ?? '#8E8E93'}18`,
                            borderRadius: '4px',
                            padding: '0.1rem 0.35rem',
                            lineHeight: 1.4,
                          }}
                        >
                          {PRIORITY_LABEL[c.casePriority]}
                        </span>
                      )}
                  </div>
                  {/* Inline editor — expanded when editingId === c.id */}
                  {editingId === c.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        marginTop: '0.5rem',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.125rem',
                          fontSize: '0.6875rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Stato
                        <select
                          value={c.caseStatus ?? 'active'}
                          disabled={patching === c.id}
                          onChange={(e) => {
                            void handlePatch(c.id, { caseStatus: e.target.value })
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-separator)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            cursor: patching === c.id ? 'not-allowed' : 'pointer',
                            opacity: patching === c.id ? 0.6 : 1,
                          }}
                        >
                          <option value="active">Attiva</option>
                          <option value="open">Aperta</option>
                          <option value="pending">In attesa</option>
                          <option value="completed">Conclusa</option>
                          <option value="archived">Archiviata</option>
                        </select>
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.125rem',
                          fontSize: '0.6875rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        Priorità
                        <select
                          value={c.casePriority ?? 'normal'}
                          disabled={patching === c.id}
                          onChange={(e) => {
                            void handlePatch(c.id, { casePriority: e.target.value })
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '6px',
                            border: '1px solid var(--color-separator)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            cursor: patching === c.id ? 'not-allowed' : 'pointer',
                            opacity: patching === c.id ? 0.6 : 1,
                          }}
                        >
                          <option value="urgent">Urgente</option>
                          <option value="high">Alta</option>
                          <option value="normal">Normale</option>
                          <option value="low">Bassa</option>
                          <option value="backlog">Backlog</option>
                        </select>
                      </label>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          marginTop: '0.875rem',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.6875rem',
                          background: 'transparent',
                          border: '1px solid var(--color-separator)',
                          borderRadius: '6px',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        Chiudi
                      </button>
                    </div>
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
                {/* ⋯ toggle case-editor */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(editingId === c.id ? null : c.id)
                  }}
                  aria-label="Modifica stato caso"
                  title="Stato / Priorità"
                  style={{
                    padding: '0.25rem',
                    background: editingId === c.id ? 'var(--color-accent)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: editingId === c.id ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <MoreHorizontal size={15} />
                </button>
                {/* Export: solo chat */}
                <button
                  onClick={(e) => handleExport(c.id, e)}
                  aria-label="Scarica chat"
                  title="Scarica solo chat"
                  style={{
                    padding: '0.2rem 0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--color-separator)',
                    borderRadius: '6px',
                    color:
                      exporting === c.id ? 'var(--color-text-secondary)' : 'var(--color-accent)',
                    cursor: exporting === c.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    opacity: exporting === c.id ? 0.5 : 1,
                  }}
                >
                  {exporting === c.id ? '…' : '↓ chat'}
                </button>
                {/* Export: chat + feedback */}
                <button
                  onClick={(e) => handleExportWithFeedback(c.id, e)}
                  aria-label="Scarica chat con feedback"
                  title="Scarica chat + feedback"
                  style={{
                    padding: '0.2rem 0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--color-separator)',
                    borderRadius: '6px',
                    color:
                      exportingFeedback === c.id
                        ? 'var(--color-text-secondary)'
                        : 'var(--color-text-secondary)',
                    cursor: exportingFeedback === c.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    lineHeight: 1,
                    opacity: exportingFeedback === c.id ? 0.5 : 1,
                  }}
                >
                  {exportingFeedback === c.id ? '…' : '↓ ★'}
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
