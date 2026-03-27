// @vitest-environment jsdom

import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatShell } from '@/components/chat/ChatShell'

const useChatMock = vi.fn()
const chatInputMock = vi.fn()

vi.mock('@/hooks/useChat', () => ({
  useChat: () => useChatMock(),
}))

vi.mock('@/components/layout/TopBar', () => ({
  TopBar: () => React.createElement('div', { 'data-testid': 'topbar' }),
}))

vi.mock('@/components/chat/MessageList', () => ({
  MessageList: () => React.createElement('div', { 'data-testid': 'message-list' }),
}))

vi.mock('@/components/chat/ChatInput', () => ({
  ChatInput: (props: { activeDomain?: string | null; activeDomains?: string[] }) => {
    chatInputMock(props)
    return React.createElement(
      'div',
      { 'data-testid': 'chat-input' },
      `activeDomain:${props.activeDomain ?? 'none'}|activeDomains:${(props.activeDomains ?? []).join(',')}`,
    )
  },
}))

vi.mock('@/components/chat/ConversationHistory', () => ({
  ConversationHistory: () => null,
}))

describe('ChatShell domain visuals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes the top specialist banner and prioritizes the current canonical domain over stale assistant metadata', () => {
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
        leadDomain: 'training',
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

    render(React.createElement(ChatShell))

    expect(screen.queryByText(/modalità specialista attiva/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toHaveTextContent(
      'activeDomain:health|activeDomains:health,training',
    )
    expect(chatInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDomain: 'health',
        activeDomains: ['health', 'training'],
      }),
    )
  })
})
