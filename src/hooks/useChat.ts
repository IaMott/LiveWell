'use client'

// Re-export types so existing imports of '@/hooks/useChat' keep working
export type { ChatMessage, ThinkingStep, CartellaNotification } from '@/contexts/ChatContext'

// The hook is now backed by ChatContext (lives at app layout level),
// so chat state and streaming persist across client-side navigation.
export { useChatContext as useChat } from '@/contexts/ChatContext'
