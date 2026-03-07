import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ToolCall } from '@/lib/ai/types'
import { createToolExecutor, shouldBlockByPromptInjectionGuard } from '@/lib/tools/toolExecutor'
import { resetConfirmTokenStoreForTests } from '@/lib/tools/confirmTokenService'

function context(overrides?: Partial<Parameters<ReturnType<typeof createToolExecutor>['executeToolCall']>[1]>) {
  return {
    requestId: 'r1',
    conversationId: 'c1',
    actor: { userId: 'u1', role: 'USER' as const, ownerModeEnabled: false },
    source: 'assistant' as const,
    confirmedByUser: false,
    ...overrides,
  }
}

describe('tool executor security', () => {
  beforeEach(() => {
    resetConfirmTokenStoreForTests()
  })

  it('blocks tool not in allowlist', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({ handlers: {}, writeAuditLog })

    const call: ToolCall = { id: 't1', name: 'unknown.tool', args: {} }
    const result = await executor.executeToolCall(call, context())

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('TOOL_NOT_ALLOWED')
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it('validates args with zod schema', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: {
        'nutrition.logMeal': async () => ({ id: 'm1' }),
      },
      writeAuditLog,
    })

    const call: ToolCall = {
      id: 't1',
      name: 'nutrition.logMeal',
      args: { mealType: 'lunch', items: [] },
    }

    const result = await executor.executeToolCall(call, context())
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('VALIDATION_ERROR')
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it('enforces RBAC by role', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: {
        'notifications.createInApp': async () => ({ id: 'n1' }),
      },
      writeAuditLog,
    })

    const call: ToolCall = {
      id: 't1',
      name: 'notifications.createInApp',
      args: { title: 'Ciao', message: 'Messaggio' },
    }

    const result = await executor.executeToolCall(call, context())
    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('FORBIDDEN')
  })

  it('writes audit log for mutation success', async () => {
    const writeAuditLog = vi.fn(async () => undefined)
    const executor = createToolExecutor({
      handlers: {
        'health.addMetric': async () => ({ id: 'metric1' }),
      },
      writeAuditLog,
    })

    const call: ToolCall = {
      id: 't1',
      name: 'health.addMetric',
      args: { metricType: 'weight', value: 82.4 },
    }

    const result = await executor.executeToolCall(call, context())

    expect(result.ok).toBe(true)
    expect(writeAuditLog).toHaveBeenCalledTimes(1)
    expect(writeAuditLog.mock.calls[0][0].status).toBe('success')
  })

  it('prompt injection guard blocks destructive execution from untrusted sources', () => {
    expect(shouldBlockByPromptInjectionGuard({ source: 'file-upload', destructive: true })).toBe(true)
    expect(shouldBlockByPromptInjectionGuard({ source: 'web-content', destructive: true })).toBe(true)
    expect(shouldBlockByPromptInjectionGuard({ source: 'assistant', destructive: true })).toBe(false)
    expect(shouldBlockByPromptInjectionGuard({ source: 'file-upload', destructive: false })).toBe(false)
  })
})
