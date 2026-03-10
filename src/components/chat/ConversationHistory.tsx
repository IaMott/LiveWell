'use client'

import { useState, useEffect } from 'react'

interface Conversation {
  id: string
  title: string
  createdAt: string
  lastMessage?: string
}

interface Props {
  open: boolean
  currentId: string | null
  onClose: () => void
  onSelect: (id: string) => void
  onNew: () => void
  onExport?: () => void
}

export function ConversationHistory({ open, currentId, onClose, onSelect, onNew, onExport }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data: { conversations?: Conversation[] }) => {
        setConversations(data.conversations ?? [])
      })
      .catch(() => setConversations([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
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
          maxHeight: '70dvh',
          backgroundColor: 'var(--color-bg-elevated, #fff)',
          borderRadius: '1.25rem 1.25rem 0 0',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: '2.5rem',
            height: '0.25rem',
            backgroundColor: 'var(--color-separator, #E5E5EA)',
            borderRadius: '2px',
            margin: '0.75rem auto 0',
            flexShrink: 0,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-separator, #E5E5EA)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--color-text-primary, #1C1C1E)',
            }}
          >
            Cronologia
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {onExport && currentId && (
              <button
                type="button"
                onClick={() => { onExport(); onClose() }}
                style={actionBtnStyle}
              >
                Esporta
              </button>
            )}
            <button
              type="button"
              onClick={() => { onNew(); onClose() }}
              style={{ ...actionBtnStyle, color: '#007AFF' }}
            >
              + Nuova
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-secondary, #8E8E93)', fontSize: '0.875rem' }}>
              Caricamento…
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-secondary, #8E8E93)', fontSize: '0.875rem' }}>
              Nessuna conversazione precedente
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === currentId
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => { onSelect(conv.id); onClose() }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.875rem 1rem',
                    borderBottom: '1px solid var(--color-separator, #E5E5EA)',
                    backgroundColor: isActive ? 'rgba(0,122,255,0.06)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#007AFF' : 'var(--color-text-primary, #1C1C1E)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {conv.title || 'Conversazione'}
                  </div>
                  {conv.lastMessage && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary, #8E8E93)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '0.125rem',
                      }}
                    >
                      {conv.lastMessage}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--color-text-secondary, #8E8E93)',
                      marginTop: '0.125rem',
                    }}
                  >
                    {new Date(conv.createdAt).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

const actionBtnStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--color-text-secondary, #8E8E93)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.25rem 0.5rem',
  borderRadius: '6px',
}
