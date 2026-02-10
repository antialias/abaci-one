export interface VoiceProviderConfig {
  id: string
  name: string
  models: VoiceModelConfig[]
}

export interface VoiceModelConfig {
  id: string
  name: string
  /** File format clips are persisted as, e.g. "mp3". Omit for non-persisted sources. */
  format: string
  voices: readonly string[]
}

export const VOICE_PROVIDERS: readonly VoiceProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      {
        id: "tts-1",
        name: "tts-1",
        format: "mp3",
        voices: [
          "alloy",
          "ash",
          "ballad",
          "coral",
          "echo",
          "fable",
          "nova",
          "onyx",
          "sage",
          "shimmer",
        ],
      },
    ],
  },
] as const

/** Flat list of all voice names across all providers/models */
export const ALL_VOICES = VOICE_PROVIDERS.flatMap((p) =>
  p.models.flatMap((m) => m.voices),
)

export type VoiceName = (typeof ALL_VOICES)[number]

/** Look up provider + model metadata for a voice name */
export function getVoiceMeta(voiceName: string): {
  provider: VoiceProviderConfig
  model: VoiceModelConfig
} | null {
  for (const provider of VOICE_PROVIDERS) {
    for (const model of provider.models) {
      if (model.voices.includes(voiceName)) {
        return { provider, model }
      }
    }
  }
  return null
}
