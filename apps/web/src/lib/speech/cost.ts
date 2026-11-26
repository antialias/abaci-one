/**
 * What generating clips costs, from the characters each would bill. Client
 * safe (the admin page shows it on "Generate N Missing" before a run).
 */
import { estimateCost } from '@/lib/ai-usage/pricing'
import { SPEECH_MODEL } from './model'

export function estimateSpeechCost(charsPerClip: number[]): { chars: number; cost: number } {
  const chars = charsPerClip.reduce((sum, n) => sum + n, 0)
  const cost =
    estimateCost({
      provider: 'elevenlabs',
      model: SPEECH_MODEL,
      apiType: 'tts',
      inputCharacters: chars,
    }) ?? 0
  return { chars, cost }
}
