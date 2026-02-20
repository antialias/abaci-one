/** Serializable plain-object form, used for DB storage, API wire format, and UI state. */
export type VoiceSourceData =
  | { type: 'pregenerated'; name: string }
  | { type: 'custom'; name: string }
  | { type: 'browser-tts' }
  | { type: 'subtitle' }
  | { type: 'generate' }

// ---------------------------------------------------------------------------
// Class hierarchy — hydrated instances used by TtsAudioManager for polymorphic
// behavior (e.g. on-demand clip generation).
// ---------------------------------------------------------------------------

export abstract class VoiceSource {
  abstract readonly type: string

  /** Serialize back to the plain-object form. */
  abstract toJSON(): VoiceSourceData

  /** Whether this voice can generate clips on-demand. */
  canGenerate(): boolean {
    return false
  }

  /**
   * Generate a clip on-demand and return the audio blob.
   * Returns null on failure. Only meaningful when `canGenerate()` is true.
   */
  async generate(_clipId: string, _text: string, _tone: string): Promise<Blob | null> {
    return null
  }
}

export class PregeneratedVoice extends VoiceSource {
  readonly type = 'pregenerated' as const
  constructor(readonly name: string) {
    super()
  }

  toJSON() {
    return { type: this.type, name: this.name } as const
  }

  canGenerate() {
    return true
  }

  async generate(clipId: string, text: string, tone: string): Promise<Blob | null> {
    try {
      const res = await fetch('/api/audio/generate-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: this.name, clipId, text, tone }),
      })
      if (!res.ok) return null
      return res.blob()
    } catch {
      return null
    }
  }
}

export class CustomVoice extends VoiceSource {
  readonly type = 'custom' as const
  constructor(readonly name: string) {
    super()
  }

  toJSON() {
    return { type: this.type, name: this.name } as const
  }

  // Custom voices can't generate yet — but the hook is here for future
  // integrations (e.g. Asterisk-based recording).
}

export class BrowserTtsVoice extends VoiceSource {
  readonly type = 'browser-tts' as const

  toJSON() {
    return { type: this.type } as const
  }
}

export class SubtitleVoice extends VoiceSource {
  readonly type = 'subtitle' as const

  toJSON() {
    return { type: this.type } as const
  }
}

export class GenerateVoice extends VoiceSource {
  readonly type = 'generate' as const

  toJSON() {
    return { type: this.type } as const
  }
}

/** Hydrate a single plain-object voice source into a class instance. */
export function hydrateVoiceSource(data: VoiceSourceData): VoiceSource {
  switch (data.type) {
    case 'pregenerated':
      return new PregeneratedVoice(data.name)
    case 'custom':
      return new CustomVoice(data.name)
    case 'browser-tts':
      return new BrowserTtsVoice()
    case 'subtitle':
      return new SubtitleVoice()
    case 'generate':
      return new GenerateVoice()
  }
}

/** Hydrate an entire voice chain from plain objects. */
export function hydrateVoiceChain(data: VoiceSourceData[]): VoiceSource[] {
  return data.map(hydrateVoiceSource)
}
