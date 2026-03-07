import { describe, expect, it, beforeEach } from 'vitest'
import {
  consumeConfirmToken,
  issueConfirmToken,
  resetConfirmTokenStoreForTests,
} from '@/lib/tools/confirmTokenService'

describe('confirmTokenService two-step flow', () => {
  beforeEach(() => {
    resetConfirmTokenStoreForTests()
  })

  it('issues and consumes a valid confirm token', async () => {
    const issued = await issueConfirmToken({
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 1_000,
      ttlSeconds: 60,
    })

    const consumed = await consumeConfirmToken({
      confirmToken: issued.confirmToken,
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 2_000,
    })

    expect(consumed.ok).toBe(true)
  })

  it('rejects invalid confirm token', async () => {
    const consumed = await consumeConfirmToken({
      confirmToken: 'not-existing-token',
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 2_000,
    })

    expect(consumed.ok).toBe(false)
    if (!consumed.ok) {
      expect(consumed.reason.length).toBeGreaterThan(0)
    }
  })

  it('rejects expired confirm token', async () => {
    const issued = await issueConfirmToken({
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 10_000,
      ttlSeconds: 1,
    })

    const consumed = await consumeConfirmToken({
      confirmToken: issued.confirmToken,
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 20_500,
    })

    expect(consumed.ok).toBe(false)
  })

  it('rejects confirm token reuse', async () => {
    const issued = await issueConfirmToken({
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 30_000,
      ttlSeconds: 60,
    })

    const first = await consumeConfirmToken({
      confirmToken: issued.confirmToken,
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 31_000,
    })
    expect(first.ok).toBe(true)

    const second = await consumeConfirmToken({
      confirmToken: issued.confirmToken,
      userId: 'u1',
      toolName: 'share.createLink',
      payload: { resourceType: 'recipe', resourceId: 'r1' },
      now: 32_000,
    })
    expect(second.ok).toBe(false)
  })
})
