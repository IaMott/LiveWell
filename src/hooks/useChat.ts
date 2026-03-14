'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Domain } from '@/lib/ai/types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: Domain
  specialistName?: string
  thinkingSpecialistName?: string
  thinkingTitle?: string
  thinkingThought?: string
  streaming?: boolean
}

const STORAGE_KEY = 'livewell_conversation_id'
const SPECIALIST_KEY = 'livewell_active_specialist'
const SPECIALIST_NAME_KEY = 'livewell_active_specialist_name'
// Max time to wait for conversation history before giving up (Neon cold-start)
const LOAD_TIMEOUT_MS = 8000

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null)
  const [activeSpecialistId, setActiveSpecialistId] = useState<string | undefined>(undefined)
  const [activeSpecialistName, setActiveSpecialistName] = useState<string | undefined>(undefined)

  const conversationIdRef = useRef<string | undefined>(undefined)
  const activeSpecialistIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    activeSpecialistIdRef.current = activeSpecialistId
  }, [activeSpecialistId])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSpecialistId = localStorage.getItem(SPECIALIST_KEY)
      const savedSpecialistName = localStorage.getItem(SPECIALIST_NAME_KEY)
      if (savedSpecialistId) {
        setActiveSpecialistId(savedSpecialistId)
        activeSpecialistIdRef.current = savedSpecialistId
      }
      if (savedSpecialistName) setActiveSpecialistName(savedSpecialistName)
    }

    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (savedId) {
      void loadConversation(savedId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsStreaming(true)
    setMessages([])
    setActiveDomain(null)

    // Abort the request if it takes too long (protects against Neon DB cold-start hangs)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS)

    try {
      const res = await fetch(`/api/conversations/${id}`, { signal: controller.signal })
      if (!res.ok) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      const data = (await res.json()) as {
        messages: Array<{
          id: string
          role: string
          content: string
          domain?: string
          specialistName?: string
        }>
      }
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          domain: m.domain as Domain | undefined,
          specialistName: m.specialistName,
        })),
      )
      setConversationId(id)
      conversationIdRef.current = id
      localStorage.setItem(STORAGE_KEY, id)

      // Keep specialist mode locked across temporary navigation (profile/settings)
      // and recover visible specialist name from the latest assistant turn.
      const latestAssistantWithSpecialist = [...data.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.specialistName)
      if (latestAssistantWithSpecialist?.specialistName) {
        setActiveSpecialistName(latestAssistantWithSpecialist.specialistName)
        localStorage.setItem(SPECIALIST_NAME_KEY, latestAssistantWithSpecialist.specialistName)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      clearTimeout(timeout)
      setIsStreaming(false)
    }
  }, [])

  const newConversation = useCallback(() => {
    const newId = crypto.randomUUID()
    setMessages([])
    setActiveDomain(null)
    setActiveSpecialistId(undefined)
    setActiveSpecialistName(undefined)
    activeSpecialistIdRef.current = undefined
    setConversationId(newId)
    conversationIdRef.current = newId
    localStorage.setItem(STORAGE_KEY, newId)
    localStorage.removeItem(SPECIALIST_KEY)
    localStorage.removeItem(SPECIALIST_NAME_KEY)
  }, [])

  const exitSpecialist = useCallback(() => {
    setActiveSpecialistId(undefined)
    setActiveSpecialistName(undefined)
    activeSpecialistIdRef.current = undefined
    localStorage.removeItem(SPECIALIST_KEY)
    localStorage.removeItem(SPECIALIST_NAME_KEY)
  }, [])

  const exportConversation = useCallback(async (id?: string) => {
    const targetId = id ?? conversationIdRef.current
    if (!targetId) return
    try {
      const res = await fetch(`/api/conversations/${targetId}/export`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `livewell-chat-${new Date().toISOString().slice(0, 10)}.txt`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      if (!conversationIdRef.current) {
        const newId = crypto.randomUUID()
        conversationIdRef.current = newId
        setConversationId(newId)
        localStorage.setItem(STORAGE_KEY, newId)
      }

      setActiveDomain(null)

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
            activeSpecialistId: activeSpecialistIdRef.current,
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
                      ? {
                          ...m,
                          content: String(event.content ?? m.content),
                          streaming: false,
                          thinkingSpecialistName: undefined,
                          thinkingTitle: undefined,
                          thinkingThought: undefined,
                        }
                      : m,
                  ),
                )
              } else if (event.type === 'ui.state') {
                const domain = event.domain as Domain | undefined
                const specialistName = event.specialistName as string | undefined
                const newSpecialistId = event.activeSpecialistId as string | undefined

                if (domain) setActiveDomain(domain)

                // Update specialist state from server response
                if (newSpecialistId && newSpecialistId !== activeSpecialistIdRef.current) {
                  setActiveSpecialistId(newSpecialistId)
                  setActiveSpecialistName(specialistName)
                  activeSpecialistIdRef.current = newSpecialistId
                  if (newSpecialistId) {
                    localStorage.setItem(SPECIALIST_KEY, newSpecialistId)
                    if (specialistName) localStorage.setItem(SPECIALIST_NAME_KEY, specialistName)
                  }
                }

                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, domain, specialistName } : m)),
                )
              } else if (event.type === 'agent.thinking') {
                const thinkingSpecialistName = String(event.specialistName ?? '')
                const thinkingTitle = String(event.title ?? '')
                const thinkingThought = event.thought != null ? String(event.thought) : undefined
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          specialistName: thinkingSpecialistName || m.specialistName,
                          content: m.content,
                          streaming: true,
                          thinkingSpecialistName: thinkingSpecialistName || undefined,
                          thinkingTitle: thinkingTitle || undefined,
                          thinkingThought: thinkingThought || undefined,
                        }
                      : m,
                  ),
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

  return {
    messages,
    isStreaming,
    conversationId,
    activeDomain,
    activeSpecialistId,
    activeSpecialistName,
    send,
    loadConversation,
    newConversation,
    exitSpecialist,
    exportConversation,
  }
}
