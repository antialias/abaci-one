/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the db module before importing record
const mockValues = vi.fn(() => Promise.resolve())
const mockInsert = vi.fn(() => ({ values: mockValues }))

vi.mock('@/db', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
  },
}))

vi.mock('@/db/schema/ai-usage', () => ({
  aiUsage: Symbol('aiUsage'),
}))

describe('recordAiUsage', () => {
  let recordAiUsage: typeof import('../record').recordAiUsage

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-import to get fresh module
    const mod = await import('../record')
    recordAiUsage = mod.recordAiUsage
  })

  it('inserts a record into the database', async () => {
    const record = {
      userId: 'user-123',
      feature: 'euclid:chat' as const,
      provider: 'openai',
      model: 'gpt-5',
      apiType: 'responses',
      inputTokens: 100,
      outputTokens: 50,
    }

    recordAiUsage(record)

    // Allow the microtask to run
    await new Promise((r) => setTimeout(r, 0))

    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockValues).toHaveBeenCalledWith(record)
  })

  it('never throws even when insert fails', () => {
    mockValues.mockRejectedValueOnce(new Error('DB connection lost'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Should not throw
    expect(() =>
      recordAiUsage({
        userId: 'user-123',
        feature: 'euclid:chat' as const,
        provider: 'openai',
        model: 'gpt-5',
        apiType: 'responses',
      })
    ).not.toThrow()

    consoleSpy.mockRestore()
  })

  it('logs errors to console when insert fails', async () => {
    const error = new Error('DB connection lost')
    mockValues.mockRejectedValueOnce(error)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    recordAiUsage({
      userId: 'user-123',
      feature: 'euclid:chat' as const,
      provider: 'openai',
      model: 'gpt-5',
      apiType: 'responses',
    })

    // Allow the microtask to run
    await new Promise((r) => setTimeout(r, 10))

    expect(consoleSpy).toHaveBeenCalledWith('[ai-usage] Failed to record usage:', error)
    consoleSpy.mockRestore()
  })
})
