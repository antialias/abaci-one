export type VoiceSource =
  | { type: 'pregenerated'; name: string }
  | { type: 'custom'; name: string }
  | { type: 'browser-tts' }
  | { type: 'subtitle' }
