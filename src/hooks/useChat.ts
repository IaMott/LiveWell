'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/components/chat/MessageBubble'
import type { Domain } from '@/lib/ai/types'

const STORAGE_KEY = 'livewell_conversation_id'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null)
  const [activeSpecialistId, setActiveSpecialistId] = useState<string | null>(null)
  const [activeSpecialistName, setActiveSpecialistName] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  // Persist conversationId to localStorage
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(STORAGE_KEY, conversationId)
    }
  }, [conversationId])

  // On mount, restore the last conversation from DB
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const savedId = localStorage.getItem(STORAGE_KEY)
    if (!savedId) return

    fetch(`/api/conversations/${savedId}`)
      .then((res) => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(({ conversation }) => {
        setConversationId(savedId)
        setMessages(
          (conversation.messages ?? []).map(
            (m: { id: string; role: string; content: string; createdAt: string }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.createdAt),
            }),
          ),
        )
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
      })
  }, [])

  const send = useCallback(
    async (text: string, domain?: Domain) => {
      if (isStreaming || !text.trim()) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)

      const assistantId = crypto.randomUUID()
      // Placeholder so TypingIndicator renders immediately
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
      ])

      try {
        abortRef.current = new AbortController()

        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationId: conversationId ?? undefined,
            ...(domain ? { domain } : {}),
          }),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => 'Errore di rete')
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: 'Errore: ' + errText } : m,
            ),
          )
          setIsStreaming(false)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setIsStreaming(false)
          return
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const json = line.slice(6)
            try {
              const event = JSON.parse(json) as {
                type: string
                id?: string
                delta?: string
                content?: string
                domain?: Domain
                specialistId?: string
                specialistName?: string
                conversationId?: string
              }

              if (event.type === 'message.delta' && event.id === assistantId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (event.delta ?? '') }
                      : m,
                  ),
                )
              } else if (event.type === 'message.complete' && event.id === assistantId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: event.content ?? m.content } : m,
                  ),
                )
              } else if (event.type === 'ui.state') {
                if (event.domain) setActiveDomain(event.domain)
                if (event.specialistId) setActiveSpecialistId(event.specialistId)
                if (event.specialistName) setActiveSpecialistName(event.specialistName)
              } else if (event.type === 'meta' && event.conversationId) {
                setConversationId(event.conversationId)
              }
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Errore di connessione. Riprova.' }
              : m,
          ),
        )
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [isStreaming, conversationId],
  )

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`)
    if (!res.ok) return
    const { conversation } = (await res.json()) as {
      conversation: {
        id: string
        messages: Array<{ id: string; role: string; content: string; createdAt: string }>
      }
    }
    setConversationId(id)
    setMessages(
      (conversation.messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      })),
    )
  }, [])

  const newConversation = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
    setMessages([])
    setConversationId(null)
    setActiveDomain(null)
    setActiveSpecialistId(null)
    setActiveSpecialistName(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const exportConversation = useCallback(async () => {
    if (!conversationId) return
    const res = await fetch(`/api/conversations/${conversationId}/export`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `livewell-chat-${conversationId.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [conversationId])

  const exitSpecialist = useCallback(() => {
    setActiveSpecialistId(null)
    setActiveSpecialistName(null)
  }, [])

  return {
    messages,
    send,
    isStreaming,
    conversationId,
    activeDomain,
    activeSpecialistId,
    activeSpecialistName,
    loadConversation,
    newConversation,
    exportConversation,
    exitSpecialist,
  }
}
