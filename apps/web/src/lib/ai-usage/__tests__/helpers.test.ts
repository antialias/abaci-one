/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the record module
const mockRecordAiUsage = vi.fn()
vi.mock('../record', () => ({
  recordAiUsage: (...args: any[]) => mockRecordAiUsage(...args),
}))

// Use real features module
const { AiFeature } = await import('../features')

describe('usage recording helpers', () => {
  let helpers: typeof import('../helpers')

  beforeEach(async () => {
    vi.clearAllMocks()
    helpers = await import('../helpers')
  })

  const baseContext = {
    userId: 'user-123',
    feature: AiFeature.EUCLID_CHAT,
  } as const

  describe('recordOpenAiChatUsage', () => {
    it('extracts usage from chat completion response', () => {
      helpers.recordOpenAiChatUsage(
        {
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          model: 'gpt-4o-mini',
        },
        baseContext
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        feature: 'euclid:chat',
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiType: 'chat_completions',
        inputTokens: 100,
        outputTokens: 50,
      })
    })

    it('handles missing usage gracefully', () => {
      helpers.recordOpenAiChatUsage({ model: 'gpt-4o-mini' }, baseContext)

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          inputTokens: null,
          outputTokens: null,
        })
      )
    })

    it('defaults model to unknown', () => {
      helpers.recordOpenAiChatUsage({}, baseContext)

      expect(mockRecordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ model: 'unknown' }))
    })
  })

  describe('recordOpenAiResponsesUsage', () => {
    it('extracts usage from responses API', () => {
      helpers.recordOpenAiResponsesUsage(
        {
          usage: { input_tokens: 200, output_tokens: 100 },
          model: 'gpt-5',
        },
        baseContext
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          apiType: 'responses',
          inputTokens: 200,
          outputTokens: 100,
        })
      )
    })
  })

  describe('recordOpenAiResponsesStreamUsage', () => {
    it('records streaming usage with reasoning tokens', () => {
      helpers.recordOpenAiResponsesStreamUsage(
        { input_tokens: 300, output_tokens: 150, reasoning_tokens: 50 },
        'gpt-5.2',
        baseContext
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          apiType: 'responses_streaming',
          model: 'gpt-5.2',
          inputTokens: 300,
          outputTokens: 150,
          reasoningTokens: 50,
        })
      )
    })
  })

  describe('recordImageGenUsage', () => {
    it('records a single image generation', () => {
      helpers.recordImageGenUsage('openai', 'gpt-image-1', {
        userId: 'user-456',
        feature: AiFeature.IMAGE_GENERATE,
      })

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-image-1',
          apiType: 'image',
          imageCount: 1,
        })
      )
    })
  })

  describe('recordTtsUsage', () => {
    it('records character count from input text', () => {
      helpers.recordTtsUsage('Hello, world!', 'gpt-4o-mini-tts', {
        userId: 'user-789',
        feature: AiFeature.TTS_CLIP,
      })

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          apiType: 'tts',
          inputCharacters: 13, // "Hello, world!".length
          model: 'gpt-4o-mini-tts',
        })
      )
    })
  })

  describe('recordRealtimeHeartbeat', () => {
    it('records voice session metrics', () => {
      helpers.recordRealtimeHeartbeat(
        {
          durationSeconds: 120,
          turnCount: 5,
          modelCharacters: 500,
          userCharacters: 200,
          toolCallCount: 2,
          endReason: 'user',
          final: true,
        },
        'gpt-realtime-1.5',
        { userId: 'user-123', feature: AiFeature.NUMBER_LINE_VOICE }
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          apiType: 'realtime',
          audioDurationSeconds: 120,
          inputCharacters: 200,
          outputTokens: 500,
          metadata: {
            turnCount: 5,
            toolCallCount: 2,
            endReason: 'user',
            final: true,
          },
        })
      )
    })
  })

  describe('recordElevenLabsUsage', () => {
    it('calculates total duration from sections', () => {
      helpers.recordElevenLabsUsage(
        {
          sections: [{ duration_ms: 30000 }, { duration_ms: 45000 }, { duration_ms: 15000 }],
        },
        { userId: 'user-123', feature: AiFeature.MUSIC_GENERATE }
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'elevenlabs',
          model: 'music_v1',
          apiType: 'music',
          audioDurationSeconds: 90, // 90000ms = 90s
        })
      )
    })
  })

  describe('recordLlmClientUsage', () => {
    it('maps camelCase fields from llm-client response', () => {
      helpers.recordLlmClientUsage(
        {
          usage: { promptTokens: 400, completionTokens: 200, totalTokens: 600 },
          provider: 'openai',
          model: 'gpt-5',
        },
        baseContext
      )

      expect(mockRecordAiUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          model: 'gpt-5',
          apiType: 'responses',
          inputTokens: 400,
          outputTokens: 200,
        })
      )
    })
  })
})
