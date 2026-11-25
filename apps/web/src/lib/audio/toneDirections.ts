import { SPEECH_MODELS_READING_AUDIO_TAGS } from '@/lib/speech/model'
import type { AudioTone } from './audioClipRegistry'

/**
 * How a clip's tone reaches the speech model.
 *
 * gpt-4o-mini-tts took a free-text `instructions` field. ElevenLabs has no
 * such field; eleven_v3 instead reads bracketed audio tags at the start of the
 * text ("[excited] You got it!"). A tag the model doesn't know may be spoken
 * as words, so tone maps onto a small set of tags from ElevenLabs' own v3
 * prompting guide, never onto free text in brackets. Neutral tones get no tag
 * and are read in the voice's natural delivery.
 */
export type AudioTag = '[excited]' | '[curious]' | '[whispers]' | '[mischievously]'

/** Registered clip tones (also stored verbatim as some collected clips' tone). */
export const TONE_AUDIO_TAGS: Record<AudioTone, AudioTag | null> = {
  'math-dictation': null,
  celebration: '[excited]',
  corrective: null,
  encouragement: null,
  'tutorial-instruction': null,
  'tutorial-celebration': '[excited]',
}

/**
 * Collected clips carry free-text directions written for gpt-4o-mini-tts
 * ("Hushed, floating awe..."). The first rule whose words appear wins; a
 * direction matching none (calm, gentle, patient) gets no tag.
 */
const FREEFORM_RULES: ReadonlyArray<[RegExp, AudioTag]> = [
  [/\b(whisper\w*|hushed)\b/i, '[whispers]'],
  [/\b(mischiev\w*|conspirator\w*|magic trick)\b/i, '[mischievously]'],
  [
    /\b(excit\w*|celebrat\w*|congratulat\w*|delight\w*|glee\w*|game-show|breathless|thrill\w*)\b/i,
    '[excited]',
  ],
  [/\b(curious|curiosity|wonder|awe)\b/i, '[curious]'],
]

const AUDIO_TONES: ReadonlySet<string> = new Set(Object.keys(TONE_AUDIO_TAGS))

function isAudioTone(tone: string): tone is AudioTone {
  return AUDIO_TONES.has(tone)
}

/** The audio tag for a tone (a registered tone name or a free-text direction), or null. */
export function audioTagForTone(tone: string | null | undefined): AudioTag | null {
  if (!tone) return null
  if (isAudioTone(tone)) return TONE_AUDIO_TAGS[tone]
  for (const [pattern, tag] of FREEFORM_RULES) {
    if (pattern.test(tone)) return tag
  }
  return null
}

/**
 * The text to send for a clip. For a tag-reading model, square brackets in the
 * clip's own words become parentheses (so the model never takes them for a
 * direction) and the tone's tag, if any, leads. For any other model the tone
 * is dropped and the words go as they are.
 */
export function speechTextFor(
  text: string,
  tone: string | null | undefined,
  model: string
): { text: string; tag: AudioTag | null } {
  if (!SPEECH_MODELS_READING_AUDIO_TAGS.has(model)) return { text, tag: null }
  const words = text.replace(/\[/g, '(').replace(/\]/g, ')')
  const tag = audioTagForTone(tone)
  return { text: tag ? `${tag} ${words}` : words, tag }
}
