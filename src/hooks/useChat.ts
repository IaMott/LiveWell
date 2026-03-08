'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Domain } from '@/lib/ai/types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: Domain
  streaming?: boolean
}

const STORAGE_KEY = 'livewell_conversation_id'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const conversationIdRef = useRef<string | undefined>(undefined)

  // Sync ref with state
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  // On mount: restore last conversation from localStorage
  useEffect(() => {
    const savedId =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (savedId) {
      void loadConversation(savedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsStreaming(true)
    setMessages([])
    try {
      const res = await fetch(`/api/conversations/${id}`)
      if (!res.ok) {
        // Conversation not found — start fresh
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      const data = (await res.json()) as {
        messages: Array<{ id: string; role: string; content: string }>
      }
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      )
      setConversationId(id)
      conversationIdRef.current = id
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const newConversation = useCallback(() => {
    const newId = crypto.randomUUID()
    setMessages([])
    setConversationId(newId)
    conversationIdRef.current = newId
    localStorage.setItem(STORAGE_KEY, newId)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      // Initialize conversationId on first send if not yet set
      if (!conversationIdRef.current) {
        const newId = crypto.randomUUID()
        conversationIdRef.current = newId
        setConversationId(newId)
        localStorage.setItem(STORAGE_KEY, newId)
      }

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      }
      const assistantId = crypto.randomUUID()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            conversationId: conversationIdRef.current,
          }),
        })

        if (!res.ok || !res.body) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Si è verificato un errore. Riprova.', streaming: false }
                : m,
            ),
          )
          return
        }

        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6)) as Record<string, unknown>
              if (event.type === 'message.delta') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + String(event.delta ?? '') }
                      : m,
                  ),
                )
              } else if (event.type === 'message.complete') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: String(event.content ?? m.content), streaming: false }
                      : m,
                  ),
                )
              } else if (event.type === 'ui.state') {
                const domain = event.domain as Domain | undefined
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, domain } : m)),
                )
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Connessione interrotta. Riprova.', streaming: false }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming],
  )

  return { messages, send, isStreaming, conversationId, loadConversation, newConversation }
}
