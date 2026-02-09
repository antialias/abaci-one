import type { AudioTone } from './audioClipRegistry'

export const TONE_DIRECTIONS: Record<AudioTone, string> = {
  'math-dictation':
    'Speaking clearly and steadily. Reading one word in a math problem to a young child. Neutral, measured pace.',
  celebration:
    'Warmly congratulating a child who answered correctly. Genuinely encouraging and happy.',
  corrective:
    'Gently and supportively guiding a child after a wrong answer. Kind, not disappointed.',
  'tutorial-instruction':
    'Patiently guiding a young child through their first time using an abacus app. Clear, slow, friendly.',
  'tutorial-celebration':
    'Proudly encouraging a child who completed a tutorial step. Warm and affirming.',
}

/**
 * Build the input text and instructions for OpenAI TTS.
 * The instructions go into the separate `instructions` parameter
 * (supported by gpt-4o-mini-tts), so the voice never speaks the direction.
 */
export function buildTtsParams(text: string, tone: AudioTone): { input: string; instructions: string } {
  return { input: text, instructions: TONE_DIRECTIONS[tone] }
}
