'use client'

import { useMemo, useState } from 'react'

type SectionsPayload = {
  personal: {
    birthDate: string | null
    age: number | null
    gender: string | null
    heightCurrent: unknown
    weightCurrent: unknown
  }
  sections: Record<string, unknown>
  counts: { dynamicAttributes: number; dynamicKeysByDomain: Record<string, number> }
  generatedAt: string
}

export default function HomePage() {
  const [message, setMessage] = useState(
    'Ho mal di schiena da 10 giorni e prendo ibuprofene al bisogno',
  )
  const [assistant, setAssistant] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [profileData, setProfileData] = useState<SectionsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSend = useMemo(() => message.trim().length > 0 && !loadingChat, [message, loadingChat])

  async function sendChat() {
    if (!canSend) return
    setLoadingChat(true)
    setError(null)
    setAssistant('')
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok || !res.body) {
        const t = await res.text()
        throw new Error(`chat failed (${res.status}): ${t.slice(0, 200)}`)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const c of chunks) {
          if (!c.startsWith('data: ')) continue
          const payload = c.slice(6)
          try {
            const event = JSON.parse(payload) as {
              type: string
              delta?: string
              content?: string
            }
            if (event.type === 'message.delta' && event.delta) {
              setAssistant((prev) => prev + event.delta)
            }
            if (event.type === 'message.complete' && event.content) {
              setAssistant(event.content)
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore chat')
    } finally {
      setLoadingChat(false)
    }
  }

  async function loadSections() {
    setLoadingProfile(true)
    setError(null)
    try {
      const res = await fetch('/api/profile/sections', { cache: 'no-store' })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(`profile failed (${res.status}): ${t.slice(0, 200)}`)
      }
      const json = (await res.json()) as SectionsPayload
      setProfileData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento profilo')
    } finally {
      setLoadingProfile(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 20px',
        maxWidth: 1000,
        margin: '0 auto',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <h1 style={{ marginBottom: 8 }}>LiveWell</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Interfaccia diagnostica: raccolta dati agenti e compilazione sezioni profilo dinamico.
      </p>

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Chat Multi-Agente</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc' }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button
            onClick={sendChat}
            disabled={!canSend}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #999' }}
          >
            {loadingChat ? 'Invio...' : 'Invia'}
          </button>
          <button
            onClick={loadSections}
            disabled={loadingProfile}
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #999' }}
          >
            {loadingProfile ? 'Carico sezioni...' : 'Carica Sezioni Profilo'}
          </button>
        </div>
        <pre
          style={{
            marginTop: 14,
            whiteSpace: 'pre-wrap',
            background: '#f7f7f7',
            padding: 12,
            borderRadius: 8,
            minHeight: 70,
          }}
        >
          {assistant || 'Risposta agente in attesa...'}
        </pre>
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Sezioni Profilo (DB dinamico)</h2>
        <pre
          style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 12, borderRadius: 8 }}
        >
          {profileData ? JSON.stringify(profileData, null, 2) : 'Nessun dato caricato'}
        </pre>
      </section>

      {error ? <p style={{ color: '#b00020', marginTop: 16 }}>Errore: {error}</p> : null}
    </main>
  )
}
