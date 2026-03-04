'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, MessageAttachment } from '@/components/chat/MessageBubble'
import type { ChatAttachment } from '@/components/chat/ChatInput'

const STORAGE_KEY = 'livewell_conversation_id'
const specialistLabels: Record<string, string> = {
  intervistatore: 'Intervistatore',
  dietista: 'Dietista',
  personal_trainer: 'Personal Trainer',
  psicologo: 'Psicologo',
  mental_coach: 'Mental Coach',
  chef: 'Chef',
  fisioterapista: 'Fisioterapista',
  fisiatra: 'Fisiatra',
  medico_sport: 'Medico dello Sport',
  mmg: 'MMG',
  gastroenterologo: 'Gastroenterologo',
  chinesologo: 'Chinesologo',
  analista_contesto: 'Analista del Contesto',
}

function parseAssistantContent(
  content: string,
): { content: string; specialists?: string[] } {
  const marker = content.match(/^\[\[specialist:([a-z_]+)\]\]\s*/i)
  if (!marker) return { content }
  const specialistId = marker[1]
  const label = specialistLabels[specialistId] ?? specialistId
  return {
    content: content.replace(/^\[\[specialist:[a-z_]+\]\]\s*/i, ''),
    specialists: [label],
  }
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [activeSpecialist, setActiveSpecialist] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const initialLoadDone = useRef(false)

  // Persist conversationId to localStorage whenever it changes
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
    if (savedId) {
      fetch(`/api/conversations/${savedId}`)
        .then((res) => {
          if (!res.ok) throw new Error('not found')
          return res.json()
        })
        .then(({ conversation }) => {
          setConversationId(savedId)
          setMessages(
            conversation.messages.map(
              (m: { id: string; role: string; content: string; createdAt: string }) => {
                const parsed = m.role === 'assistant' ? parseAssistantContent(m.content) : { content: m.content }
                return {
                  id: m.id,
                  role: m.role as 'user' | 'assistant',
                  content: parsed.content,
                  specialists: parsed.specialists,
                  timestamp: new Date(m.createdAt),
                }
              },
            ),
          )
        })
        .catch(() => {
          // Conversation deleted or expired — start fresh
          localStorage.removeItem(STORAGE_KEY)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const sendMessage = useCallback(
    async (content: string, attachments?: ChatAttachment[]) => {
      if (isStreaming) return

      // Map ChatAttachment to MessageAttachment for display
      const msgAttachments: MessageAttachment[] | undefined = attachments?.map((a) => ({
        url: a.url,
        fileName: a.fileName,
        mimeType: a.mimeType,
        type: a.type,
        barcodeValue: a.barcodeValue,
      }))

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
        attachments: msgAttachments,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsStreaming(true)

      // Created dynamically when agent turns are emitted.
      let activeAssistantId: string | null = null
      let activeSpecialistLabel: string | null = null

      try {
        abortRef.current = new AbortController()

        // Build payload with attachment references
        const payload: Record<string, unknown> = { message: content, conversationId }
        if (attachments && attachments.length > 0) {
          payload.attachments = attachments.map((a) => ({
            url: a.url,
            fileName: a.fileName,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            type: a.type,
            barcodeValue: a.barcodeValue,
          }))
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortRef.current.signal,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Errore di rete' }))
          const errorId = activeAssistantId ?? crypto.randomUUID()
          if (!activeAssistantId) {
            setMessages((prev) => [
              ...prev,
              {
                id: errorId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              },
            ])
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === errorId ? { ...m, content: err.error || 'Errore' } : m,
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
              const event = JSON.parse(json)
              if (event.type === 'meta' && event.conversationId) {
                setConversationId(event.conversationId)
              } else if (event.type === 'routing' && event.specialist) {
                setActiveSpecialist(event.specialist)
              } else if (event.type === 'agent_turn' && event.specialist) {
                activeSpecialistLabel = specialistLabels[event.specialist] ?? event.specialist
                activeAssistantId = crypto.randomUUID()
                const newMsg: ChatMessage = {
                  id: activeAssistantId,
                  role: 'assistant',
                  content: '',
                  specialists: [activeSpecialistLabel],
                  timestamp: new Date(),
                }
                setMessages((prev) => [...prev, newMsg])
              } else if (event.type === 'agent_delta' && event.content) {
                if (!activeAssistantId) {
                  activeSpecialistLabel =
                    specialistLabels[event.specialist] ?? event.specialist ?? 'Assistente'
                  activeAssistantId = crypto.randomUUID()
                  const newMsg: ChatMessage = {
                    id: activeAssistantId,
                    role: 'assistant',
                    content: '',
                    specialists: [activeSpecialistLabel],
                    timestamp: new Date(),
                  }
                  setMessages((prev) => [...prev, newMsg])
                }
                const targetId = activeAssistantId
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === targetId ? { ...m, content: m.content + event.content } : m,
                  ),
                )
              } else if (event.type === 'delta') {
                if (!activeAssistantId) {
                  activeAssistantId = crypto.randomUUID()
                  const newMsg: ChatMessage = {
                    id: activeAssistantId,
                    role: 'assistant',
                    content: '',
                    specialists: activeSpecialistLabel ? [activeSpecialistLabel] : undefined,
                    timestamp: new Date(),
                  }
                  setMessages((prev) => [...prev, newMsg])
                }
                const targetId = activeAssistantId
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === targetId
                      ? { ...m, content: m.content + event.content }
                      : m,
                  ),
                )
              }
              // 'done' event — stream ended
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled
        } else {
          const errorId = activeAssistantId ?? crypto.randomUUID()
          if (!activeAssistantId) {
            setMessages((prev) => [
              ...prev,
              {
                id: errorId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
              },
            ])
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === errorId
                ? { ...m, content: 'Errore di connessione. Riprova.' }
                : m,
            ),
          )
        }
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

    const { conversation } = await res.json()
    setConversationId(id)
    setMessages(
      conversation.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => {
        const parsed = m.role === 'assistant' ? parseAssistantContent(m.content) : { content: m.content }
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: parsed.content,
          specialists: parsed.specialists,
          timestamp: new Date(m.createdAt),
        }
      }),
    )
  }, [])

  const newConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    messages,
    isStreaming,
    isLoading,
    conversationId,
    activeSpecialist,
    sendMessage,
    loadConversation,
    newConversation,
  }
}
