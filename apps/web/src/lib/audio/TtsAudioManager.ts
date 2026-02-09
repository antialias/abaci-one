export interface TtsAudioManagerConfig {
  volume: number
  enabled: boolean
}

export interface ManagerSnapshot {
  isPlaying: boolean
  isEnabled: boolean
  volume: number
}

export interface CollectedClip {
  text: string
  tone: string
  playCount: number
  firstSeen: Date
  lastSeen: Date
}

export type VoiceSource =
  | { type: 'pregenerated'; name: string }
  | { type: 'browser-tts' }

type Listener = () => void

function collectionKey(text: string, tone: string): string {
  return `${tone}::${text}`
}

/**
 * Compute a clip hash matching the server's `crypto.createHash('sha256')`.
 * Uses Web Crypto API (available in all modern browsers).
 * Returns the first 16 hex chars of sha256(`${tone}::${text}`).
 */
async function clipHash(text: string, tone: string): Promise<string> {
  const data = new TextEncoder().encode(`${tone}::${text}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hex.slice(0, 16)
}

export class TtsAudioManager {
  private listeners = new Set<Listener>()
  private collection = new Map<string, CollectedClip>()

  private _isPlaying = false
  private _isEnabled = false
  private _volume = 0.8

  // Voice chain: ordered fallback list for playback
  private _voiceChain: VoiceSource[] = []

  // Pre-generated clip IDs: voice name → set of clip IDs with mp3s on disk
  private _pregenClipIds = new Map<string, Set<string>>()

  // Cache of computed clip hashes (text+tone → hash)
  private _hashCache = new Map<string, string>()

  // Currently playing Audio element (for mp3 playback)
  private _currentAudio: HTMLAudioElement | null = null

  // Cached snapshot for useSyncExternalStore — must be referentially stable
  private _cachedSnapshot: ManagerSnapshot = {
    isPlaying: false,
    isEnabled: false,
    volume: 0.8,
  }

  // ── Configuration ──────────────────────────────────────────────

  configure(config: Partial<TtsAudioManagerConfig>): void {
    let changed = false

    if (config.volume !== undefined) {
      this._volume = Math.max(0, Math.min(1, config.volume))
      changed = true
    }
    if (config.enabled !== undefined) {
      const wasEnabled = this._isEnabled
      this._isEnabled = config.enabled
      changed = true
      if (wasEnabled && !config.enabled) {
        this.stop()
      }
    }

    if (changed) this.notify()
  }

  // ── Voice Chain ─────────────────────────────────────────────────

  /**
   * Load the pre-generated clip manifest for the given voice chain.
   * Fetches from the manifest endpoint to populate `_pregenClipIds`.
   */
  async loadPregenManifest(voiceChain: VoiceSource[]): Promise<void> {
    this._voiceChain = voiceChain

    const pregenVoices = voiceChain
      .filter((s): s is { type: 'pregenerated'; name: string } => s.type === 'pregenerated')
      .map((s) => s.name)

    if (pregenVoices.length === 0) return

    try {
      const res = await fetch(
        `/api/audio/collected-clips/manifest?voices=${pregenVoices.join(',')}`
      )
      if (!res.ok) return

      const data: { clipIdsByVoice: Record<string, string[]> } = await res.json()
      for (const [voice, ids] of Object.entries(data.clipIdsByVoice)) {
        this._pregenClipIds.set(voice, new Set(ids))
      }
    } catch {
      // Non-fatal — fall back to browser TTS
    }
  }

  // ── Runtime Collection ────────────────────────────────────────

  register(text: string, tone: string): void {
    if (!text) return
    const key = collectionKey(text, tone)
    if (!this.collection.has(key)) {
      this.collection.set(key, {
        text,
        tone,
        playCount: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
      })
    }
  }

  getCollection(): CollectedClip[] {
    return Array.from(this.collection.values())
  }

  async flush(): Promise<void> {
    const clips = this.getCollection().filter((c) => c.playCount > 0)
    if (clips.length === 0) return

    const payload = clips.map((c) => ({
      text: c.text,
      tone: c.tone,
      playCount: c.playCount,
    }))

    // Use sendBeacon for reliability during page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/audio/collected-clips',
        new Blob([JSON.stringify({ clips: payload })], {
          type: 'application/json',
        })
      )
    } else {
      try {
        await fetch('/api/audio/collected-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips: payload }),
        })
      } catch {
        // Best-effort — don't throw during cleanup
      }
    }
  }

  // ── Playback ───────────────────────────────────────────────────

  /**
   * Play an mp3 file from a URL.
   * Returns true if playback completed, false on error.
   */
  private playMp3(url: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const audio = new Audio(url)
      audio.volume = this._volume
      this._currentAudio = audio
      audio.onended = () => {
        this._currentAudio = null
        resolve(true)
      }
      audio.onerror = () => {
        this._currentAudio = null
        resolve(false)
      }
      audio.play().catch(() => {
        this._currentAudio = null
        resolve(false)
      })
    })
  }

  /**
   * Get or compute the clip hash for a (text, tone) pair.
   */
  private async getClipHash(text: string, tone: string): Promise<string> {
    const key = collectionKey(text, tone)
    let hash = this._hashCache.get(key)
    if (!hash) {
      hash = await clipHash(text, tone)
      this._hashCache.set(key, hash)
    }
    return hash
  }

  async speak(text: string, tone: string): Promise<void> {
    this.register(text, tone)

    if (!this._isEnabled || !text) return

    this.stop()
    this.setPlaying(true)

    // Increment play count
    const key = collectionKey(text, tone)
    const entry = this.collection.get(key)
    if (entry) {
      entry.playCount++
      entry.lastSeen = new Date()
    }

    // Try voice chain in order
    if (this._voiceChain.length > 0) {
      const hash = await this.getClipHash(text, tone)

      for (const source of this._voiceChain) {
        if (source.type === 'pregenerated') {
          const clipIds = this._pregenClipIds.get(source.name)
          if (clipIds?.has(hash)) {
            const ok = await this.playMp3(`/api/audio/clips/${source.name}/${hash}`)
            if (ok) {
              this.setPlaying(false)
              return
            }
            // mp3 failed, try next in chain
          }
        } else if (source.type === 'browser-tts') {
          const ok = await this.speakBrowserTts(text)
          if (ok) {
            this.setPlaying(false)
            return
          }
        }
      }

      // All chain entries exhausted — done
      this.setPlaying(false)
      return
    }

    // No voice chain — fall back to browser TTS
    await this.speakBrowserTts(text)
    this.setPlaying(false)
  }

  /**
   * Speak using browser SpeechSynthesis.
   * Returns true if successful, false if unavailable or errored.
   */
  private speakBrowserTts(text: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = this._volume
      utterance.rate = 0.9
      utterance.onend = () => resolve(true)
      utterance.onerror = () => resolve(false)
      speechSynthesis.speak(utterance)
    })
  }

  stop(): void {
    // Stop any playing mp3
    if (this._currentAudio) {
      this._currentAudio.pause()
      this._currentAudio = null
    }
    // Stop browser TTS
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel()
    }
    if (this._isPlaying) {
      this.setPlaying(false)
    }
  }

  // ── React integration: useSyncExternalStore ────────────────────

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): ManagerSnapshot => {
    return this._cachedSnapshot
  }

  // ── Cleanup ────────────────────────────────────────────────────

  dispose(): void {
    this.stop()
  }

  // ── Private ────────────────────────────────────────────────────

  private setPlaying(playing: boolean): void {
    if (this._isPlaying !== playing) {
      this._isPlaying = playing
      this.notify()
    }
  }

  private notify(): void {
    // Rebuild cached snapshot so useSyncExternalStore sees a new reference
    this._cachedSnapshot = {
      isPlaying: this._isPlaying,
      isEnabled: this._isEnabled,
      volume: this._volume,
    }
    for (const listener of this.listeners) {
      listener()
    }
  }
}
