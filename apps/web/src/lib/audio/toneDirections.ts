import type { AudioTone } from './audioClipRegistry'

export const TONE_DIRECTIONS: Record<AudioTone, string> = {
  'math-dictation':
    'Speaking clearly and steadily. Reading one word in a math problem to a young child. Neutral, measured pace.',
  celebration:
    "Bursting with genuine excitement for a child who just got the answer right! Like a favorite teacher who can't contain their pride. Energetic, joyful, maybe a little silly. Make the kid feel like a champion.",
  corrective:
    'Gently and supportively guiding a child after a wrong answer. Kind, not disappointed.',
  encouragement:
    'Like a warm, playful coach cheering on a little kid. Patient and gentle but with a spark of fun — like you genuinely think this kid is about to do something amazing. Not syrupy or condescending. Think friendly older sibling energy.',
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
export function buildTtsParams(
  text: string,
  tone: AudioTone
): { input: string; instructions: string } {
  return { input: text, instructions: TONE_DIRECTIONS[tone] }
}
