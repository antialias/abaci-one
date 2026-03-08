/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the helpers module
const mockRecordLlmClientStreamUsage = vi.fn()
const mockRecordLlmClientUsage = vi.fn()
const mockRecordEmbeddingUsage = vi.fn()

vi.mock('../helpers', () => ({
  recordLlmClientStreamUsage: (...args: any[]) => mockRecordLlmClientStreamUsage(...args),
  recordLlmClientUsage: (...args: any[]) => mockRecordLlmClientUsage(...args),
  recordEmbeddingUsage: (...args: any[]) => mockRecordEmbeddingUsage(...args),
}))

const { AiFeature } = await import('../features')

describe('LLM middleware', () => {
  let middleware: typeof import('../llm-middleware')

  beforeEach(async () => {
    vi.clearAllMocks()
    middleware = await import('../llm-middleware')
  })

  const context = {
    userId: 'user-123',
    feature: AiFeature.FLOWCHART_GENERATE,
  } as const

  describe('createUsageRecordingMiddleware', () => {
    it('records usage on complete event and yields all events', async () => {
      const mw = middleware.createUsageRecordingMiddleware(context, 'openai', 'gpt-5')

      async function* fakeStream(): AsyncGenerator<any, void, unknown> {
        yield { type: 'text', text: 'hello' }
        yield {
          type: 'complete',
          usage: { promptTokens: 100, completionTokens: 50 },
          text: 'hello world',
          parsed: null,
        }
      }

      const events: any[] = []
      for await (const event of mw.wrap(fakeStream())) {
        events.push(event)
      }

      expect(events).toHaveLength(2)
      expect(events[0]).toEqual({ type: 'text', text: 'hello' })
      expect(events[1].type).toBe('complete')

      expect(mockRecordLlmClientStreamUsage).toHaveBeenCalledWith(
        { promptTokens: 100, completionTokens: 50 },
        'openai',
        'gpt-5',
        context
      )
    })

    it('does not record on non-complete events', async () => {
      const mw = middleware.createUsageRecordingMiddleware(context)

      async function* fakeStream(): AsyncGenerator<any, void, unknown> {
        yield { type: 'text', text: 'chunk1' }
        yield { type: 'text', text: 'chunk2' }
      }

      const events: any[] = []
      for await (const event of mw.wrap(fakeStream())) {
        events.push(event)
      }

      expect(events).toHaveLength(2)
      expect(mockRecordLlmClientStreamUsage).not.toHaveBeenCalled()
    })
  })

  describe('trackedCall', () => {
    it('calls llm.call() and records usage', async () => {
      const mockResponse = {
        usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
        provider: 'openai',
        model: 'gpt-5',
        text: 'result',
        parsed: { answer: 42 },
      }

      const mockLlm = {
        call: vi.fn().mockResolvedValue(mockResponse),
      }

      const request = { prompt: 'test' } as any
      const result = await middleware.trackedCall(mockLlm as any, request, context)

      expect(result).toBe(mockResponse)
      expect(mockLlm.call).toHaveBeenCalledWith(request)
      expect(mockRecordLlmClientUsage).toHaveBeenCalledWith(mockResponse, context)
    })

    it('does not swallow errors from llm.call()', async () => {
      const mockLlm = {
        call: vi.fn().mockRejectedValue(new Error('API error')),
      }

      await expect(
        middleware.trackedCall(mockLlm as any, {} as any, context)
      ).rejects.toThrow('API error')

      expect(mockRecordLlmClientUsage).not.toHaveBeenCalled()
    })
  })

  describe('trackedEmbed', () => {
    it('calls llm.embed() and records usage', async () => {
      const mockResponse = {
        usage: { promptTokens: 50, totalTokens: 50 },
        model: 'text-embedding-3-large',
        embeddings: [[0.1, 0.2]],
      }

      const mockLlm = {
        embed: vi.fn().mockResolvedValue(mockResponse),
      }

      const request = { input: ['test'] } as any
      const result = await middleware.trackedEmbed(mockLlm as any, request, context)

      expect(result).toBe(mockResponse)
      expect(mockLlm.embed).toHaveBeenCalledWith(request)
      expect(mockRecordEmbeddingUsage).toHaveBeenCalledWith(mockResponse, context)
    })
  })
})
