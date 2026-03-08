/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest'
import { estimateCost, PRICING } from '../pricing'

describe('estimateCost', () => {
  describe('token-based models', () => {
    it('calculates cost for GPT-4o-mini', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiType: 'chat_completions',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
      })
      // 1M input * $0.15/M + 0.5M output * $0.6/M = $0.15 + $0.30 = $0.45
      expect(cost).toBeCloseTo(0.45)
    })

    it('calculates cost for GPT-5.2 with reasoning tokens', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-5.2',
        apiType: 'responses',
        inputTokens: 100_000,
        outputTokens: 50_000,
        reasoningTokens: 200_000,
      })
      // 0.1M * $2 + 0.05M * $8 + 0.2M * $8 = $0.20 + $0.40 + $1.60 = $2.20
      expect(cost).toBeCloseTo(2.2)
    })

    it('handles zero tokens', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiType: 'chat_completions',
        inputTokens: 0,
        outputTokens: 0,
      })
      expect(cost).toBe(0)
    })

    it('handles null tokens', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-4o-mini',
        apiType: 'chat_completions',
        inputTokens: null,
        outputTokens: null,
      })
      expect(cost).toBe(0)
    })

    it('calculates embedding cost (input only)', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'text-embedding-3-large',
        apiType: 'embedding',
        inputTokens: 10_000_000,
      })
      // 10M * $0.13/M = $1.30
      expect(cost).toBeCloseTo(1.3)
    })
  })

  describe('image-based models', () => {
    it('calculates cost for OpenAI image generation', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-image-1',
        apiType: 'image',
        imageCount: 5,
      })
      // 5 * $0.04 = $0.20
      expect(cost).toBeCloseTo(0.2)
    })

    it('calculates cost for Gemini image generation', () => {
      const cost = estimateCost({
        provider: 'gemini',
        model: 'gemini-2.5-flash-image',
        apiType: 'image',
        imageCount: 3,
      })
      // 3 * $0.039 = $0.117
      expect(cost).toBeCloseTo(0.117)
    })

    it('handles null imageCount', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-image-1',
        apiType: 'image',
        imageCount: null,
      })
      expect(cost).toBe(0)
    })
  })

  describe('audio-based models', () => {
    it('calculates cost for realtime voice', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-realtime-1.5',
        apiType: 'realtime',
        audioDurationSeconds: 300, // 5 minutes
      })
      // 5 min * $0.066/min = $0.33
      expect(cost).toBeCloseTo(0.33)
    })

    it('calculates cost for ElevenLabs music', () => {
      const cost = estimateCost({
        provider: 'elevenlabs',
        model: 'music_v1',
        apiType: 'music',
        audioDurationSeconds: 120, // 2 minutes
      })
      // 2 min * $0.30/min = $0.60
      expect(cost).toBeCloseTo(0.6)
    })
  })

  describe('character-based models', () => {
    it('calculates cost for TTS', () => {
      const cost = estimateCost({
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        apiType: 'tts',
        inputCharacters: 5000,
      })
      // 5000 / 1M * $12 = $0.06
      expect(cost).toBeCloseTo(0.06)
    })
  })

  describe('unknown models', () => {
    it('returns null for unknown provider/model', () => {
      const cost = estimateCost({
        provider: 'unknown',
        model: 'mystery-model',
        apiType: 'chat',
      })
      expect(cost).toBeNull()
    })
  })

  describe('PRICING table', () => {
    it('has entries for all expected models', () => {
      const expectedKeys = [
        'openai/gpt-5',
        'openai/gpt-5.2',
        'openai/gpt-4o-mini',
        'openai/gpt-realtime-1.5',
        'openai/gpt-4o-mini-tts',
        'openai/gpt-image-1',
        'openai/text-embedding-3-large',
        'gemini/gemini-2.5-flash-image',
        'elevenlabs/music_v1',
      ]
      for (const key of expectedKeys) {
        expect(PRICING).toHaveProperty(key)
      }
    })
  })
})
