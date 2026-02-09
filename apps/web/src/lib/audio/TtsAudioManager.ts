import { AUDIO_MANIFEST_MAP } from './audioManifest'

export interface TtsAudioManagerConfig {
  volume: number
  enabled: boolean
}

export interface ManagerSnapshot {
  isPlaying: boolean
  isEnabled: boolean
  volume: number
}

/** Locale -> fallback text map (BCP 47 keys). */
export type TtsSay = Record<string, string>

export interface TtsConfig {
  tone?: string
  say?: TtsSay
}

/**
 * A segment in a TTS sequence.
 * - `string` -> clip ID (text resolved from AUDIO_MANIFEST_MAP or config.say)
 * - `object` -> explicit clip ID with per-segment config overrides
 */
export type TtsSegment =
  | string
  | ({ clipId: string } & Partial<TtsConfig>)

export type TtsInput = TtsSegment | TtsSegment[]

export interface CollectedClip {
  clipId: string
  say: TtsSay
  tone: string
  playCount: number
  firstSeen: Date
  lastSeen: Date
}

export type VoiceSource =
  | { type: 'pregenerated'; name: string }
  | { type: 'browser-tts' }

type Listener = () => void

/** Resolved segment ready for playback. */
interface ResolvedSegment {
  clipId: string
  fallbackText: string
  tone: string
}

const INTER_SEGMENT_GAP_MS = 80

export class TtsAudioManager {
  private listeners = new Set<Listener>()
  private collection = new Map<string, CollectedClip>()

  private _isPlaying = false
  private _isEnabled = false
  private _volume = 0.8

  // Voice chain: ordered fallback list for playback
  private _voiceChain: VoiceSource[] = []

  // Pre-generated clip IDs: voice name -> set of clip IDs with mp3s on disk
  private _pregenClipIds = new Map<string, Set<string>>()

  // Currently playing Audio element (for mp3 playback)
  private _currentAudio: HTMLAudioElement | null = null

  // Sequence cancellation flag
  private _sequenceCancelled = false

  // Cached snapshot for useSyncExternalStore -- must be referentially stable
  private _cachedSnapshot: ManagerSnapshot = {
    isPlaying: false,
    isEnabled: false,
    volume: 0.8,
  }

  // -- Configuration --

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

  // -- Voice Chain --

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
      // Non-fatal -- fall back to browser TTS
    }
  }

  // -- Runtime Collection --

  register(input: TtsInput, config?: TtsConfig): void {
    const segments = Array.isArray(input) ? input : [input]
    const topTone = config?.tone ?? ''
    const topSay = config?.say

    for (const seg of segments) {
      const clipId = typeof seg === 'string' ? seg : seg.clipId
      if (!clipId) continue

      const segSay = typeof seg === 'object' ? seg.say : undefined
      const segTone = typeof seg === 'object' ? seg.tone : undefined

      const effectiveTone = segTone ?? topTone
      // Merge: top-level say, then segment say (segment wins)
      const effectiveSay: TtsSay = { ...topSay, ...segSay }

      const existing = this.collection.get(clipId)
      if (existing) {
        // Merge say maps across calls
        Object.assign(existing.say, effectiveSay)
        if (effectiveTone && !existing.tone) {
          existing.tone = effectiveTone
        }
      } else {
        this.collection.set(clipId, {
          clipId,
          say: effectiveSay,
          tone: effectiveTone,
          playCount: 0,
          firstSeen: new Date(),
          lastSeen: new Date(),
        })
      }
    }
  }

  getCollection(): CollectedClip[] {
    return Array.from(this.collection.values())
  }

  async flush(): Promise<void> {
    const clips = this.getCollection().filter((c) => c.playCount > 0)
    if (clips.length === 0) return

    const payload = clips.map((c) => ({
      clipId: c.clipId,
      say: c.say,
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
        // Best-effort -- don't throw during cleanup
      }
    }
  }

  // -- Playback --

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
   * Resolve BCP 47 locale from a TtsSay map using navigator.languages.
   */
  private resolveSay(say: TtsSay | undefined): string | undefined {
    if (!say) return undefined
    const keys = Object.keys(say)
    if (keys.length === 0) return undefined

    if (typeof navigator !== 'undefined' && navigator.languages) {
      for (const locale of navigator.languages) {
        // Exact match
        if (say[locale] !== undefined) return say[locale]
        // Language-only prefix: en-US -> en
        const langOnly = locale.split('-')[0]
        if (say[langOnly] !== undefined) return say[langOnly]
      }
    }

    // Fall back to first available key
    return say[keys[0]]
  }

  /**
   * Resolve a single segment into playback-ready form.
   */
  private resolveSegment(seg: TtsSegment, topConfig?: TtsConfig): ResolvedSegment {
    const clipId = typeof seg === 'string' ? seg : seg.clipId
    const segTone = typeof seg === 'object' ? seg.tone : undefined
    const segSay = typeof seg === 'object' ? seg.say : undefined

    const effectiveTone = segTone ?? topConfig?.tone ?? ''
    const effectiveSay: TtsSay = { ...topConfig?.say, ...segSay }

    // Resolve fallback text: manifest entry .text > resolveSay() > clipId
    const manifestEntry = AUDIO_MANIFEST_MAP[clipId]
    const fallbackText = manifestEntry?.text
      ?? this.resolveSay(effectiveSay)
      ?? clipId

    return { clipId, fallbackText, tone: effectiveTone }
  }

  /**
   * Try playing a single resolved segment via the voice chain.
   * Returns true if something played, false if chain exhausted.
   */
  private async playOneSegment(resolved: ResolvedSegment): Promise<boolean> {
    if (this._voiceChain.length > 0) {
      for (const source of this._voiceChain) {
        if (source.type === 'pregenerated') {
          const clipIds = this._pregenClipIds.get(source.name)
          if (clipIds?.has(resolved.clipId)) {
            const ok = await this.playMp3(`/api/audio/clips/${source.name}/${resolved.clipId}`)
            if (ok) return true
            // mp3 failed, try next in chain
          }
        } else if (source.type === 'browser-tts') {
          const ok = await this.speakBrowserTts(resolved.fallbackText)
          if (ok) return true
        }
      }
      // All chain entries exhausted
      return false
    }

    // No voice chain -- fall back to browser TTS
    return this.speakBrowserTts(resolved.fallbackText)
  }

  /**
   * Play a sequence of resolved segments with inter-segment gaps.
   */
  private async playSequence(segments: ResolvedSegment[]): Promise<void> {
    this.stop()
    this._isPlaying = true
    this._sequenceCancelled = false
    this.notify()

    for (let i = 0; i < segments.length; i++) {
      if (this._sequenceCancelled) break

      await this.playOneSegment(segments[i])

      // Inter-segment gap (skip after last segment)
      if (i < segments.length - 1 && !this._sequenceCancelled) {
        await new Promise<void>((resolve) => setTimeout(resolve, INTER_SEGMENT_GAP_MS))
      }
    }

    this.setPlaying(false)
  }

  async speak(input: TtsInput, config?: TtsConfig): Promise<void> {
    this.register(input, config)

    if (!this._isEnabled) return

    const segments = Array.isArray(input) ? input : [input]
    if (segments.length === 0) return

    const resolved = segments.map((seg) => this.resolveSegment(seg, config))

    // Increment play counts
    for (const r of resolved) {
      const entry = this.collection.get(r.clipId)
      if (entry) {
        entry.playCount++
        entry.lastSeen = new Date()
      }
    }

    if (resolved.length === 1) {
      // Single segment: simple path
      this.stop()
      this.setPlaying(true)
      await this.playOneSegment(resolved[0])
      this.setPlaying(false)
    } else {
      // Multi-segment: sequence path
      await this.playSequence(resolved)
    }
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
    // Cancel any running sequence
    this._sequenceCancelled = true
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

  // -- React integration: useSyncExternalStore --

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): ManagerSnapshot => {
    return this._cachedSnapshot
  }

  // -- Cleanup --

  dispose(): void {
    this.stop()
  }

  // -- Private --

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
