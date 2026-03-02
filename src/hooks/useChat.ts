'use client'

import { useState, useCallback, useRef } from 'react'
import type { ChatMessage, MessageAttachment } from '@/components/chat/MessageBubble'
import type { ChatAttachment } from '@/components/chat/ChatInput'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

      // Create placeholder assistant message
      const assistantId = crypto.randomUUID()
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMsg])

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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: err.error || 'Errore' } : m,
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
              } else if (event.type === 'delta') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
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
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
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
      conversation.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      })),
    )
  }, [])

  const newConversation = useCallback(() => {
    setMessages([])
    setConversationId(null)
  }, [])

  return {
    messages,
    isStreaming,
    conversationId,
    sendMessage,
    loadConversation,
    newConversation,
  }
}
