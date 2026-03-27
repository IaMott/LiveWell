import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatShell } from '@/components/chat/ChatShell'

const useChatMock = vi.fn()

vi.mock('@/hooks/useChat', () => ({
  useChat: () => useChatMock(),
}))

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => <div data-testid="topbar" />,
}))

vi.mock('@/components/chat/MessageList', () => ({
  MessageList: () => <div data-testid="message-list" />,
}))

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input" />,
}))

vi.mock('@/components/chat/ConversationHistory', () => ({
  ConversationHistory: () => null,
}))

describe('ChatShell specialist banner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers the latest assistant speaker label over the stale lead-panel specialist in the banner', () => {
    useChatMock.mockReturnValue({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Il Fisioterapista è qui disponibile quando vuoi.',
          domain: 'training',
          specialistName: 'Fisioterapista',
        },
      ],
      send: vi.fn(),
      isStreaming: false,
      conversationId: 'conv-1',
      stateSnapshot: {
        schemaVersion: 1,
        conversationId: 'conv-1',
        activeDomains: ['health', 'training'],
        domainPanels: [
          {
            domain: 'health',
            selectedAgentId: 'mmg',
            candidateAgentIds: ['mmg'],
            status: 'active',
            priorityScore: 0.8,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
          {
            domain: 'training',
            selectedAgentId: 'fisioterapista',
            candidateAgentIds: ['fisioterapista'],
            status: 'monitoring',
            priorityScore: 0.6,
            lastReasoningAt: null,
            pendingNeeds: [],
          },
        ],
        leadDomain: 'health',
        speakerPolicy: 'lead',
        conversationFocus: {
          activeProblems: ['spalla debole'],
          activeGoals: ['ricomposizione'],
          activeConstraints: [],
          summary: 'test',
        },
        coordinationState: {
          crossDomainConflicts: [],
          dependencies: [],
          needsReview: false,
        },
        sharedOpenQuestions: [],
        domainOpenQuestions: {},
        updatedAt: '2026-03-27T20:35:00.000Z',
      },
      activeDomain: 'health',
      activeSpecialistId: 'mmg',
      activeSpecialistName: 'MMG',
      cartellaNotifications: [],
      loadConversation: vi.fn(),
      newConversation: vi.fn(),
      exportConversation: vi.fn(),
      exitSpecialist: vi.fn(),
      stopStreaming: vi.fn(),
      editDraft: undefined,
      startEdit: vi.fn(),
      clearEditDraft: vi.fn(),
      appendLiveMessage: vi.fn(),
    })

    render(<ChatShell />)

    expect(screen.getByText('FISIOTERAPISTA')).toBeInTheDocument()
    expect(screen.queryByText('MMG')).not.toBeInTheDocument()
  })
})
