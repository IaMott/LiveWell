// @vitest-environment jsdom

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveModal } from '@/components/chat/live/LiveModal'

const connectMock = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function MockGoogleGenAI() {
    return {
      live: {
        connect: connectMock,
      },
    }
  }),
  Modality: {
    AUDIO: 'AUDIO',
  },
}))

type MockAudioNode = {
  connect: ReturnType<typeof vi.fn>
}

class MockAudioContext {
  sampleRate = 24000
  state = 'running'
  currentTime = 0
  destination = {}

  resume = vi.fn(async () => undefined)
  close = vi.fn(async () => undefined)
  createMediaStreamSource = vi.fn(
    () =>
      ({
        connect: vi.fn(),
      }) satisfies MockAudioNode,
  )
  createAnalyser = vi.fn(() => ({
    fftSize: 0,
    frequencyBinCount: 32,
    getByteFrequencyData: vi.fn(),
  }))
  createScriptProcessor = vi.fn(() => ({
    connect: vi.fn(),
    onaudioprocess: null as ((event: unknown) => void) | null,
  }))
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
  }))
  createBuffer = vi.fn(() => ({
    duration: 0.1,
    copyToChannel: vi.fn(),
  }))
  createBufferSource = vi.fn(() => ({
    buffer: null as unknown,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }))
}

function makeSnapshot(leadDomain: 'health' | 'training') {
  return {
    schemaVersion: 1,
    conversationId: 'conv-live-1',
    activeDomains: [leadDomain],
    domainPanels: [
      {
        domain: leadDomain,
        selectedAgentId: leadDomain === 'training' ? 'fisioterapista' : 'medico',
        candidateAgentIds: [leadDomain === 'training' ? 'fisioterapista' : 'medico'],
        status: 'active' as const,
        priorityScore: 8,
        lastReasoningAt: null,
        pendingNeeds: [],
      },
    ],
    leadDomain,
    speakerPolicy: 'lead' as const,
    conversationFocus: {
      activeProblems: ['focus'],
      activeGoals: ['goal'],
      activeConstraints: [],
      summary: 'summary',
    },
    coordinationState: {
      crossDomainConflicts: [],
      dependencies: [],
      needsReview: false,
    },
    sharedOpenQuestions: [],
    domainOpenQuestions: {},
    updatedAt: '2026-03-27T22:16:00.000Z',
  }
}

describe('LiveModal browser-facing bootstrap boundary', () => {
  const originalFetch = global.fetch
  const originalAudioContext = global.AudioContext
  const originalRequestAnimationFrame = global.requestAnimationFrame
  const originalCancelAnimationFrame = global.cancelAnimationFrame

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()

    connectMock.mockImplementation(
      async ({ callbacks }: { callbacks?: { onopen?: () => void } }) => {
        callbacks?.onopen?.()
        return {
          sendRealtimeInput: vi.fn(),
          sendClientContent: vi.fn(),
          close: vi.fn(),
        }
      },
    )

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== '/api/live-token') {
        throw new Error(`Unexpected fetch call: ${String(input)}`)
      }
      return new Response(
        JSON.stringify({
          token: 'auth_tokens/test-live-token',
          model: 'gemini-2.0-flash-live-001',
          systemInstruction: 'Istruzione server di test.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }) as typeof global.fetch

    Object.defineProperty(global.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
        enumerateDevices: vi.fn(async () => []),
      },
    })

    vi.stubGlobal('AudioContext', MockAudioContext)
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0)) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', ((id: number) =>
      clearTimeout(id)) as typeof cancelAnimationFrame)
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalAudioContext) {
      vi.stubGlobal('AudioContext', originalAudioContext)
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: originalAudioContext,
      })
    }
    if (originalRequestAnimationFrame) {
      vi.stubGlobal('requestAnimationFrame', originalRequestAnimationFrame)
    }
    if (originalCancelAnimationFrame) {
      vi.stubGlobal('cancelAnimationFrame', originalCancelAnimationFrame)
    }
  })

  it('uses the locally persisted snapshot to enrich the live system instruction when /api/live-token omits stateSnapshot', async () => {
    const bootstrapSnapshot = makeSnapshot('training')
    window.localStorage.setItem(
      'livewell_case_state_snapshot:conv-live-1',
      JSON.stringify(bootstrapSnapshot),
    )

    const { unmount } = render(
      React.createElement(LiveModal, {
        onClose: vi.fn(),
        conversationId: 'conv-live-1',
      }),
    )

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(1)
    })

    const fetchBody = JSON.parse(
      String((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body),
    ) as {
      conversationId: string
    }
    expect(fetchBody.conversationId).toBe('conv-live-1')

    const connectConfig = connectMock.mock.calls[0]?.[0]?.config as {
      systemInstruction?: { parts?: Array<{ text?: string }> }
    }
    const instruction = connectConfig.systemInstruction?.parts?.[0]?.text ?? ''
    expect(instruction).toContain('Istruzione server di test.')
    expect(instruction).toContain('CONTESTO SHARED CLIENT: leadDomain=training')

    unmount()
  })

  it('persists the server snapshot in localStorage and prefers it over a stale client bootstrap snapshot', async () => {
    const staleSnapshot = makeSnapshot('training')
    const serverSnapshot = makeSnapshot('health')
    window.localStorage.setItem(
      'livewell_case_state_snapshot:conv-live-1',
      JSON.stringify(staleSnapshot),
    )

    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          token: 'auth_tokens/test-live-token',
          model: 'gemini-2.0-flash-live-001',
          systemInstruction: 'Istruzione server con stateSnapshot.',
          stateSnapshot: serverSnapshot,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }) as typeof global.fetch

    const { unmount } = render(
      React.createElement(LiveModal, {
        onClose: vi.fn(),
        conversationId: 'conv-live-1',
      }),
    )

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(1)
    })

    const storedSnapshot = JSON.parse(
      window.localStorage.getItem('livewell_case_state_snapshot:conv-live-1') ?? 'null',
    ) as { leadDomain?: string }
    expect(storedSnapshot.leadDomain).toBe('health')

    const connectConfig = connectMock.mock.calls[0]?.[0]?.config as {
      systemInstruction?: { parts?: Array<{ text?: string }> }
    }
    const instruction = connectConfig.systemInstruction?.parts?.[0]?.text ?? ''
    expect(instruction).toContain('Istruzione server con stateSnapshot.')
    expect(instruction).toContain('CONTESTO SHARED CLIENT: leadDomain=health')
    expect(instruction).not.toContain('leadDomain=training')

    unmount()
  })
})
