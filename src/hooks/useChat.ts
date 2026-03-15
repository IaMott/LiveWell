'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { Domain } from '@/lib/ai/types'

export type ThinkingStep = {
  specialistName: string
  title: string
  thought?: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: Domain
  specialistName?: string
  /** Accumulated step-by-step reasoning shown during streaming */
  thinkingSteps?: ThinkingStep[]
  /** @deprecated use thinkingSteps */
  thinkingSpecialistName?: string
  /** @deprecated use thinkingSteps */
  thinkingTitle?: string
  /** @deprecated use thinkingSteps */
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

    // Prefer localStorage (keeps current session on same device), but fall back
    // to the most recent server-side conversation so cross-device sync works.
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (savedId) {
      void loadConversation(savedId)
    } else {
      // New device or cleared storage — load the most recent conversation from DB
      void (async () => {
        try {
          const res = await fetch('/api/conversations')
          if (!res.ok) return
          const data = (await res.json()) as { conversations: Array<{ id: string }> }
          const latest = data.conversations?.[0]
          if (latest?.id) {
            void loadConversation(latest.id)
          }
        } catch {
          // best-effort: if server fetch fails, start with empty state
        }
      })()
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
    async (text: string, _domain?: Domain, files?: File[]) => {
      const trimmed = text.trim()
      if ((!trimmed && (!files || files.length === 0)) || isStreaming) return

      if (!conversationIdRef.current) {
        const newId = crypto.randomUUID()
        conversationIdRef.current = newId
        setConversationId(newId)
        localStorage.setItem(STORAGE_KEY, newId)
      }

      // Upload files before sending the message so the context pack can include them
      let fileIds: string[] = []
      if (files && files.length > 0) {
        try {
          const formData = new FormData()
          formData.append('conversationId', conversationIdRef.current ?? '')
          files.forEach((f) => formData.append('file', f))
          const uploadRes = await fetch('/api/chat/upload', { method: 'POST', body: formData })
          if (uploadRes.ok) {
            const data = (await uploadRes.json()) as { files: Array<{ id: string }> }
            fileIds = data.files.map((f) => f.id)
          }
        } catch {
          // best-effort upload
        }
      }

      setActiveDomain(null)

      // Append file names to the visible user message for clarity
      const filesSuffix =
        files && files.length > 0 ? '\n' + files.map((f) => `📎 ${f.name}`).join('\n') : ''

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed + filesSuffix,
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
            fileIds: fileIds.length > 0 ? fileIds : undefined,
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
                          thinkingSteps: undefined,
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
                const stepName = String(event.specialistName ?? '').trim()
                const stepTitle = String(event.title ?? '').trim()
                const stepThought =
                  event.thought != null ? String(event.thought).trim() || undefined : undefined
                if (stepName || stepTitle) {
                  const newStep: ThinkingStep = {
                    specialistName: stepName || 'Team',
                    title: stepTitle || 'Elaborazione in corso',
                    thought: stepThought,
                  }
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            streaming: true,
                            thinkingSteps: [...(m.thinkingSteps ?? []), newStep],
                            // keep legacy fields for back-compat
                            thinkingSpecialistName: stepName || undefined,
                            thinkingTitle: stepTitle || undefined,
                            thinkingThought: stepThought,
                          }
                        : m,
                    ),
                  )
                }
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
