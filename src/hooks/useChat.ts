'use client'

import { useState, useRef, useCallback } from 'react'
import type { Domain } from '@/lib/ai/types'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: Domain
  streaming?: boolean
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const conversationIdRef = useRef<string | undefined>(undefined)

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

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

      // Generate conversationId on first message
      if (!conversationIdRef.current) {
        conversationIdRef.current = crypto.randomUUID()
      }

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

  return { messages, send, isStreaming }
}
