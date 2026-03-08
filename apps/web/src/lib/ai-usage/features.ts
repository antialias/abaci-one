/**
 * Typed feature strings for AI usage tracking.
 *
 * Every AI API call must specify a feature from this const object.
 * This prevents typos and enables IDE autocomplete.
 */
export const AiFeature = {
  // Euclid geometry teacher
  EUCLID_CHAT: 'euclid:chat',
  EUCLID_THINK_HARD: 'euclid:think-hard',
  EUCLID_MARKUP: 'euclid:markup',
  EUCLID_SUMMARIZE: 'euclid:summarize',
  EUCLID_VOICE: 'euclid:voice',

  // Number line
  NUMBER_LINE_SCENARIO: 'number-line:scenario',
  NUMBER_LINE_SCENARIO_EVOLVE: 'number-line:scenario-evolve',
  NUMBER_LINE_VOICE: 'number-line:voice',

  // Worksheet / vision
  WORKSHEET_PARSE: 'worksheet:parse',
  WORKSHEET_GRADE: 'worksheet:grade',

  // TTS
  TTS_CLIP: 'tts:clip',
  TTS_BATCH: 'tts:batch',
  TTS_COLLECTED: 'tts:collected',
  TTS_PREVIEW: 'tts:preview',

  // Image generation
  IMAGE_GENERATE: 'image:generate',

  // Music generation
  MUSIC_GENERATE: 'music:generate',

  // Session song lyrics
  SESSION_SONG_PROMPT: 'session-song:prompt',

  // Flowcharts
  FLOWCHART_GENERATE: 'flowchart:generate',
  FLOWCHART_REFINE: 'flowchart:refine',
  FLOWCHART_EMBED: 'flowchart:embed',

  // Moment cull
  MOMENT_CULL: 'moment:cull',

  // Postcards
  POSTCARD_REVIEW: 'postcard:review',

  // Blog / admin
  BLOG_REFINE_PROMPT: 'blog:refine-prompt',
  PAGE_SPOT_REFINE: 'page-spot:refine',

  // Chat
  CHAT_SUMMARIZE: 'chat:summarize',
} as const

export type AiFeatureValue = (typeof AiFeature)[keyof typeof AiFeature]
