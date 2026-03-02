import { describe, it, expect } from 'vitest'

describe('Smoke test', () => {
  it('should pass', () => {
    expect(true).toBe(true)
  })

  it('env module loads without throwing', async () => {
    process.env.NODE_ENV = 'test'
    await expect(import('../src/lib/validators/env')).resolves.toBeDefined()
  })
})
