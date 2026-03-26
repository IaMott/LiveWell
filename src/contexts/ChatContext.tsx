'use client'

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import type { CanonicalCaseStateSnapshot, Domain } from '@/lib/ai/types'

export type ThinkingStep = {
  specialistName: string
  title: string
  thought?: string
}

export type CartellaNotification = {
  id: string
  message: string
}

export type QuickReplyOption = {
  id: string
  label: string
  text: string
  emoji?: string
  domain?: Domain
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  domain?: Domain
  specialistName?: string
  thinkingSteps?: ThinkingStep[]
  streaming?: boolean
  /** Quick-reply buttons shown below the message (e.g. multi-domain triage) */
  quickReplies?: QuickReplyOption[]
}

type ChatContextValue = {
  messages: ChatMessage[]
  isStreaming: boolean
  conversationId: string | undefined
  activeDomain: Domain | null
  activeSpecialistId: string | undefined
  activeSpecialistName: string | undefined
  cartellaNotifications: CartellaNotification[]
  dismissCartellaNotification: (id: string) => void
  send: (text: string, domain?: Domain, files?: File[]) => Promise<void>
  stopStreaming: () => void
  editDraft: string | undefined
  startEdit: (messageId: string) => void
  clearEditDraft: () => void
  loadConversation: (id: string) => Promise<void>
  newConversation: () => void
  exitSpecialist: () => void
  exportConversation: (id?: string) => Promise<void>
  /** Append a confirmed live-session message to the local message list immediately,
   * without waiting for loadConversation to reload from DB. */
  appendLiveMessage: (role: 'user' | 'assistant', text: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

const STORAGE_KEY = 'livewell_conversation_id'
const LOAD_TIMEOUT_MS = 8000
const SEND_RECOVERY_DELAY_MS = 1500
const SEND_RECOVERY_TIMEOUT_MS = 12000

function specialistKeyForConversation(conversationId: string): string {
  return `livewell_active_specialist:${conversationId}`
}

function specialistNameKeyForConversation(conversationId: string): string {
  return `livewell_active_specialist_name:${conversationId}`
}

function stateSnapshotKeyForConversation(conversationId: string): string {
  return `livewell_case_state_snapshot:${conversationId}`
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null)
  const [activeSpecialistId, setActiveSpecialistId] = useState<string | undefined>(undefined)
  const [activeSpecialistName, setActiveSpecialistName] = useState<string | undefined>(undefined)
  const [stateSnapshot, setStateSnapshot] = useState<CanonicalCaseStateSnapshot | null>(null)
  const [cartellaNotifications, setCartellaNotifications] = useState<CartellaNotification[]>([])
  const [editDraft, setEditDraft] = useState<string | undefined>(undefined)

  const dismissCartellaNotification = useCallback((id: string) => {
    setCartellaNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const conversationIdRef = useRef<string | undefined>(undefined)
  const activeSpecialistIdRef = useRef<string | undefined>(undefined)
  const stateSnapshotRef = useRef<CanonicalCaseStateSnapshot | null>(null)
  const isStreamingRef = useRef(false)
  // F5: AbortController ref so in-flight SSE streams can be cancelled on navigation/re-send.
  const sendAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    activeSpecialistIdRef.current = activeSpecialistId
  }, [activeSpecialistId])

  useEffect(() => {
    stateSnapshotRef.current = stateSnapshot
  }, [stateSnapshot])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (savedId) {
      void loadConversation(savedId)
    } else {
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
          // best-effort
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    // F5: If a send is in progress, abort the stream so we don't get duplicate messages.
    if (sendAbortRef.current) {
      sendAbortRef.current.abort()
      sendAbortRef.current = null
    }
    setIsStreaming(true)
    setMessages([])
    setActiveDomain(null)
    setActiveSpecialistId(undefined)
    setActiveSpecialistName(undefined)
    setStateSnapshot(null)
    activeSpecialistIdRef.current = undefined
    stateSnapshotRef.current = null

    if (typeof window !== 'undefined') {
      const savedSpecialistId = localStorage.getItem(specialistKeyForConversation(id))
      const savedSpecialistName = localStorage.getItem(specialistNameKeyForConversation(id))
      const savedStateSnapshot = localStorage.getItem(stateSnapshotKeyForConversation(id))

      if (savedSpecialistId) {
        setActiveSpecialistId(savedSpecialistId)
        activeSpecialistIdRef.current = savedSpecialistId
      }
      if (savedSpecialistName) {
        setActiveSpecialistName(savedSpecialistName)
      }
      if (savedStateSnapshot) {
        try {
          const parsed = JSON.parse(savedStateSnapshot) as CanonicalCaseStateSnapshot
          setStateSnapshot(parsed)
          stateSnapshotRef.current = parsed
        } catch {
          localStorage.removeItem(stateSnapshotKeyForConversation(id))
        }
      }
    }

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
          thinkingSteps?: ThinkingStep[]
        }>
        stateSnapshot?: CanonicalCaseStateSnapshot
      }
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          domain: m.domain as Domain | undefined,
          specialistName: m.specialistName,
          thinkingSteps: m.thinkingSteps,
        })),
      )
      setConversationId(id)
      conversationIdRef.current = id
      localStorage.setItem(STORAGE_KEY, id)

      if (data.stateSnapshot) {
        setStateSnapshot(data.stateSnapshot)
        stateSnapshotRef.current = data.stateSnapshot
        localStorage.setItem(
          stateSnapshotKeyForConversation(id),
          JSON.stringify(data.stateSnapshot),
        )
      }

      const latestAssistantWithSpecialist = [...data.messages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.specialistName)
      if (latestAssistantWithSpecialist?.specialistName) {
        setActiveSpecialistName(latestAssistantWithSpecialist.specialistName)
        localStorage.setItem(
          specialistNameKeyForConversation(id),
          latestAssistantWithSpecialist.specialistName,
        )
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
    setStateSnapshot(null)
    activeSpecialistIdRef.current = undefined
    stateSnapshotRef.current = null
    setConversationId(newId)
    conversationIdRef.current = newId
    localStorage.setItem(STORAGE_KEY, newId)
    localStorage.removeItem(specialistKeyForConversation(newId))
    localStorage.removeItem(specialistNameKeyForConversation(newId))
    localStorage.removeItem(stateSnapshotKeyForConversation(newId))
  }, [])

  const exitSpecialist = useCallback(() => {
    setActiveSpecialistId(undefined)
    setActiveSpecialistName(undefined)
    activeSpecialistIdRef.current = undefined
    const currentConversationId = conversationIdRef.current
    if (currentConversationId) {
      localStorage.removeItem(specialistKeyForConversation(currentConversationId))
      localStorage.removeItem(specialistNameKeyForConversation(currentConversationId))
    }
  }, [])

  const stopStreaming = useCallback(() => {
    if (sendAbortRef.current) {
      sendAbortRef.current.abort()
      sendAbortRef.current = null
    }
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)))
    setIsStreaming(false)
    isStreamingRef.current = false
  }, [])

  const startEdit = useCallback((messageId: string) => {
    // Stop any in-flight stream
    if (sendAbortRef.current) {
      sendAbortRef.current.abort()
      sendAbortRef.current = null
    }
    setIsStreaming(false)
    isStreamingRef.current = false
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId && m.role === 'user')
      if (idx === -1) return prev
      setEditDraft(prev[idx].content)
      return prev.slice(0, idx)
    })
  }, [])

  const clearEditDraft = useCallback(() => {
    setEditDraft(undefined)
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

  const recoverConversationAfterSendFailure = useCallback(async (id: string): Promise<boolean> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SEND_RECOVERY_TIMEOUT_MS)

    try {
      const res = await fetch(`/api/conversations/${id}`, { signal: controller.signal })
      if (!res.ok) return false

      const data = (await res.json()) as {
        messages: Array<{
          id: string
          role: string
          content: string
          domain?: string
          specialistName?: string
          thinkingSteps?: ThinkingStep[]
        }>
        stateSnapshot?: CanonicalCaseStateSnapshot
      }

      if (!Array.isArray(data.messages) || data.messages.length === 0) return false

      const recoveredMessages = data.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        domain: m.domain as Domain | undefined,
        specialistName: m.specialistName,
        thinkingSteps: m.thinkingSteps,
      }))

      setMessages(recoveredMessages)

      const latestAssistantWithSpecialist = [...recoveredMessages]
        .reverse()
        .find((m) => m.role === 'assistant' && m.specialistName)
      if (latestAssistantWithSpecialist?.specialistName) {
        setActiveSpecialistName(latestAssistantWithSpecialist.specialistName)
        localStorage.setItem(
          specialistNameKeyForConversation(id),
          latestAssistantWithSpecialist.specialistName,
        )
      }

      if (data.stateSnapshot) {
        setStateSnapshot(data.stateSnapshot)
        stateSnapshotRef.current = data.stateSnapshot
        localStorage.setItem(
          stateSnapshotKeyForConversation(id),
          JSON.stringify(data.stateSnapshot),
        )
      }

      return recoveredMessages.some((m) => m.role === 'assistant' && m.content.trim().length > 0)
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }, [])

  const send = useCallback(
    async (text: string, _domain?: Domain, files?: File[]) => {
      const trimmed = text.trim()
      if ((!trimmed && (!files || files.length === 0)) || isStreamingRef.current) return

      if (!conversationIdRef.current) {
        const newId = crypto.randomUUID()
        conversationIdRef.current = newId
        setConversationId(newId)
        localStorage.setItem(STORAGE_KEY, newId)
      }

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

      const filesSuffix =
        files && files.length > 0 ? '\n' + files.map((f) => `📎 ${f.name}`).join('\n') : ''

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed + filesSuffix,
      }
      const assistantId = crypto.randomUUID()
      let currentAssistantId = assistantId
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)
      isStreamingRef.current = true

      // F5: Abort any in-flight SSE stream before starting a new one.
      if (sendAbortRef.current) sendAbortRef.current.abort()
      const sendAbort = new AbortController()
      sendAbortRef.current = sendAbort

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
          signal: sendAbort.signal,
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
              const serverMessageId =
                typeof event.id === 'string' && event.id.trim().length > 0 ? event.id.trim() : null
              if (serverMessageId && serverMessageId !== currentAssistantId) {
                const previousAssistantId = currentAssistantId
                currentAssistantId = serverMessageId
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === previousAssistantId ? { ...m, id: serverMessageId } : m,
                  ),
                )
              }

              if (event.type === 'message.delta') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentAssistantId
                      ? { ...m, content: m.content + String(event.delta ?? '') }
                      : m,
                  ),
                )
              } else if (event.type === 'message.complete') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentAssistantId
                      ? {
                          ...m,
                          content: String(event.content ?? m.content),
                          streaming: false,
                        }
                      : m,
                  ),
                )
              } else if (event.type === 'ui.state') {
                const domain = event.domain as Domain | undefined
                const specialistName = event.specialistName as string | undefined
                const newSpecialistId = event.activeSpecialistId as string | undefined
                const nextStateSnapshot =
                  event.stateSnapshot != null
                    ? (event.stateSnapshot as CanonicalCaseStateSnapshot)
                    : undefined

                if (domain) setActiveDomain(domain)
                if (nextStateSnapshot) {
                  setStateSnapshot(nextStateSnapshot)
                  stateSnapshotRef.current = nextStateSnapshot
                  const targetConversationId =
                    typeof event.conversationId === 'string' &&
                    event.conversationId.trim().length > 0
                      ? event.conversationId.trim()
                      : conversationIdRef.current
                  if (targetConversationId) {
                    localStorage.setItem(
                      stateSnapshotKeyForConversation(targetConversationId),
                      JSON.stringify(nextStateSnapshot),
                    )
                  }
                }

                if (newSpecialistId && newSpecialistId !== activeSpecialistIdRef.current) {
                  setActiveSpecialistId(newSpecialistId)
                  setActiveSpecialistName(specialistName)
                  activeSpecialistIdRef.current = newSpecialistId
                  const targetConversationId =
                    typeof event.conversationId === 'string' &&
                    event.conversationId.trim().length > 0
                      ? event.conversationId.trim()
                      : conversationIdRef.current
                  if (newSpecialistId && targetConversationId) {
                    localStorage.setItem(
                      specialistKeyForConversation(targetConversationId),
                      newSpecialistId,
                    )
                    if (specialistName) {
                      localStorage.setItem(
                        specialistNameKeyForConversation(targetConversationId),
                        specialistName,
                      )
                    }
                  }
                }

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentAssistantId ? { ...m, domain, specialistName } : m,
                  ),
                )
              } else if (event.type === 'tool.result') {
                // Fase 6: Show cartella notification for successful setAttribute saves
                if (event.ok && typeof event.message === 'string' && event.message) {
                  const notifId = crypto.randomUUID()
                  setCartellaNotifications((prev) => [
                    ...prev,
                    { id: notifId, message: event.message as string },
                  ])
                  // Auto-dismiss after 4 seconds
                  setTimeout(() => {
                    setCartellaNotifications((prev) => prev.filter((n) => n.id !== notifId))
                  }, 4000)
                }
              } else if (event.type === 'message.suggestions') {
                const suggestions = event.suggestions as Array<{
                  id: string
                  label: string
                  text: string
                  emoji?: string
                  domain?: Domain
                }>
                if (Array.isArray(suggestions) && suggestions.length > 0) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === currentAssistantId ? { ...m, quickReplies: suggestions } : m,
                    ),
                  )
                }
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
                    prev.map((m) => {
                      if (m.id !== currentAssistantId) return m
                      const existing = m.thinkingSteps ?? []
                      // Deduplicate: skip if same specialist+title already present
                      const isDupe = existing.some(
                        (s) =>
                          s.specialistName === newStep.specialistName && s.title === newStep.title,
                      )
                      if (isDupe) return m
                      return {
                        ...m,
                        streaming: true,
                        thinkingSteps: [...existing, newStep],
                      }
                    }),
                  )
                }
              }
            } catch {
              // ignore malformed SSE lines
            }
          }
        }
      } catch {
        const currentConversationId = conversationIdRef.current
        let recovered = false

        if (currentConversationId && !sendAbort.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, SEND_RECOVERY_DELAY_MS))
          recovered = await recoverConversationAfterSendFailure(currentConversationId)
        }

        if (!recovered) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentAssistantId
                ? { ...m, content: 'Connessione interrotta. Riprova.', streaming: false }
                : m,
            ),
          )
        }
      } finally {
        setIsStreaming(false)
        isStreamingRef.current = false
      }
    },
    [recoverConversationAfterSendFailure],
  )

  const appendLiveMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content: text, streaming: false },
    ])
  }, [])

  const value: ChatContextValue = {
    messages,
    isStreaming,
    conversationId,
    activeDomain,
    activeSpecialistId,
    activeSpecialistName,
    cartellaNotifications,
    dismissCartellaNotification,
    send,
    stopStreaming,
    editDraft,
    startEdit,
    clearEditDraft,
    loadConversation,
    newConversation,
    exitSpecialist,
    exportConversation,
    appendLiveMessage,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
