import { AUDIO_MANIFEST_MAP } from './audioManifest'
import { getClipMeta } from './audioClipRegistry'
import { computeClipHash, resolveCanonicalText } from './clipHash'

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
 * - `string` -> explicit clip ID
 * - `{ clipId: string, ... }` -> explicit clip ID with per-segment config
 * - `{ say: TtsSay, tone?: string }` -> hash-based (clip ID computed from content)
 */
export type TtsSegment =
  | string
  | ({ clipId: string } & Partial<TtsConfig>)
  | { say: TtsSay; tone?: string }

function hasExplicitClipId(seg: object): seg is { clipId: string } & Partial<TtsConfig> {
  return 'clipId' in seg && typeof (seg as Record<string, unknown>).clipId === 'string'
}

export type TtsInput = TtsSegment | TtsSegment[]

export interface CollectedClip {
  clipId: string
  say: TtsSay
  tone: string
  playCount: number
  firstSeen: Date
  lastSeen: Date
}

export type VoiceSource = { type: 'pregenerated'; name: string } | { type: 'browser-tts' }

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
      let clipId: string
      let segSay: TtsSay | undefined
      let segTone: string | undefined

      if (typeof seg === 'string') {
        clipId = seg
        // Look up per-clip text from the static registry so it overrides
        // any sentence-level topSay (e.g. when an array of clip IDs is
        // registered alongside a full-sentence say map).
        const meta = getClipMeta(clipId)
        if (meta) {
          segSay = { en: meta.text }
        }
      } else if (hasExplicitClipId(seg)) {
        clipId = seg.clipId
        segSay = seg.say
        segTone = seg.tone
      } else {
        // Hash-based segment: compute clip ID from content
        segSay = seg.say
        segTone = seg.tone
        const effectiveSay: TtsSay = { ...topSay, ...segSay }
        const effectiveTone = segTone ?? topTone
        clipId = computeClipHash(effectiveSay, effectiveTone)
      }

      if (!clipId) continue

      const effectiveTone = segTone ?? topTone
      // Merge: top-level say, then segment say (segment wins)
      const effectiveSay: TtsSay = { ...topSay, ...segSay }

      const existing = this.collection.get(clipId)
      if (existing) {
        // Clobber detection for explicit IDs: warn if canonical text changed
        if (typeof seg === 'string' || (typeof seg === 'object' && hasExplicitClipId(seg))) {
          const oldCanonical = resolveCanonicalText(existing.say)
          const newCanonical = resolveCanonicalText(effectiveSay)
          if (oldCanonical && newCanonical && oldCanonical !== newCanonical) {
            console.warn(
              `[TTS] Clip "${clipId}" re-registered with different text: ` +
                `"${oldCanonical}" → "${newCanonical}". ` +
                `Consider using hash-based IDs: useTTS({ say: { en: '...' }, tone: '...' })`
            )
          }
        }
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

  /**
   * Flush played clips to the server.
   *
   * By default uses `sendBeacon` (fire-and-forget, safe during page unload).
   * Pass `{ awaitResponse: true }` to use `fetch` so the caller can await
   * the server's response before proceeding (e.g. before generation).
   */
  async flush(options?: { awaitResponse?: boolean }): Promise<void> {
    const clips = this.getCollection().filter((c) => c.playCount > 0)
    if (clips.length === 0) return

    const payload = clips.map((c) => ({
      clipId: c.clipId,
      say: c.say,
      tone: c.tone,
      playCount: c.playCount,
    }))

    const body = JSON.stringify({ clips: payload })

    if (options?.awaitResponse) {
      // Awaitable path — caller needs the data committed before continuing
      try {
        await fetch('/api/audio/collected-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      } catch {
        // Best-effort -- don't throw during cleanup
      }
      return
    }

    // Fire-and-forget path — safe during page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/audio/collected-clips',
        new Blob([body], { type: 'application/json' })
      )
    } else {
      try {
        await fetch('/api/audio/collected-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
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
    let clipId: string
    let segSay: TtsSay | undefined
    let segTone: string | undefined

    if (typeof seg === 'string') {
      clipId = seg
      const meta = getClipMeta(clipId)
      if (meta) {
        segSay = { en: meta.text }
      }
    } else if (hasExplicitClipId(seg)) {
      clipId = seg.clipId
      segSay = seg.say
      segTone = seg.tone
    } else {
      // Hash-based segment
      segSay = seg.say
      segTone = seg.tone
      const effectiveSay: TtsSay = { ...topConfig?.say, ...segSay }
      const effectiveTone = segTone ?? topConfig?.tone ?? ''
      clipId = computeClipHash(effectiveSay, effectiveTone)
    }

    const effectiveTone = segTone ?? topConfig?.tone ?? ''
    const effectiveSay: TtsSay = { ...topConfig?.say, ...segSay }

    // Resolve fallback text: manifest entry .text > resolveSay() > clipId
    const manifestEntry = AUDIO_MANIFEST_MAP[clipId]
    const fallbackText = manifestEntry?.text ?? this.resolveSay(effectiveSay) ?? clipId

    return { clipId, fallbackText, tone: effectiveTone }
  }

  /**
   * Try playing a single resolved segment via the voice chain.
   * Returns true if something played, false if chain exhausted.
   */
  private async playOneSegment(resolved: ResolvedSegment): Promise<boolean> {
    console.log('[TtsAudioManager] playOneSegment', {
      clipId: resolved.clipId,
      chainLength: this._voiceChain.length,
    })

    if (this._voiceChain.length > 0) {
      for (let i = 0; i < this._voiceChain.length; i++) {
        const source = this._voiceChain[i]
        if (source.type === 'pregenerated') {
          const clipIds = this._pregenClipIds.get(source.name)
          const hasClip = clipIds?.has(resolved.clipId) ?? false
          console.log(
            `[TtsAudioManager] chain[${i}] pregenerated "${source.name}": hasClip=${hasClip}`
          )
          if (hasClip) {
            const ok = await this.playMp3(`/api/audio/clips/${source.name}/${resolved.clipId}`)
            if (ok) return true
            // mp3 failed, try next in chain
          }
        } else if (source.type === 'browser-tts') {
          console.log(
            `[TtsAudioManager] chain[${i}] browser-tts: calling speakBrowserTts("${resolved.fallbackText.slice(0, 30)}")`
          )
          const ok = await this.speakBrowserTts(resolved.fallbackText)
          console.log(`[TtsAudioManager] chain[${i}] browser-tts result:`, ok)
          if (ok) return true
        }
      }
      // All chain entries exhausted
      console.log('[TtsAudioManager] voice chain exhausted, nothing played')
      return false
    }

    // No voice chain -- fall back to browser TTS
    console.log('[TtsAudioManager] no voice chain, falling back to browser TTS')
    const ok = await this.speakBrowserTts(resolved.fallbackText)
    console.log('[TtsAudioManager] fallback browser-tts result:', ok)
    return ok
  }

  /**
   * Play a sequence of resolved segments with inter-segment gaps.
   */
  private async playSequence(segments: ResolvedSegment[]): Promise<void> {
    // speak() already cancelled previous playback and waited a frame
    // if browser TTS was active, so we just reset the sequence flag.
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

    console.log('[TtsAudioManager] speak called', {
      isEnabled: this._isEnabled,
      input: typeof input === 'string' ? input : JSON.stringify(input).slice(0, 100),
    })

    if (!this._isEnabled) {
      console.log('[TtsAudioManager] speak: TTS disabled, returning early')
      return
    }

    const segments = Array.isArray(input) ? input : [input]
    if (segments.length === 0) return

    const resolved = segments.map((seg) => this.resolveSegment(seg, config))
    console.log(
      '[TtsAudioManager] speak resolved:',
      resolved.map((r) => ({ clipId: r.clipId, fallbackText: r.fallbackText.slice(0, 30) }))
    )

    // Increment play counts
    for (const r of resolved) {
      const entry = this.collection.get(r.clipId)
      if (entry) {
        entry.playCount++
        entry.lastSeen = new Date()
      }
    }

    // Cancel any in-flight playback before starting new speech.
    this._sequenceCancelled = true
    if (this._currentAudio) {
      this._currentAudio.pause()
      this._currentAudio = null
    }

    // If browser TTS is active from a previous speak() call, cancel it
    // and wait a frame. Chrome silently drops speechSynthesis.speak() if
    // cancel() was called in the same synchronous frame, so the delay is
    // required to ensure the subsequent speak() is not swallowed.
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      (speechSynthesis.speaking || speechSynthesis.pending)
    ) {
      console.log('[TtsAudioManager] cancelling in-flight browser TTS before new speak')
      speechSynthesis.cancel()
      this._activeUtterances.clear()
      await new Promise<void>((r) => setTimeout(r, 50))
    }

    if (resolved.length === 1) {
      this.setPlaying(true)
      console.log('[TtsAudioManager] playing single segment...')
      await this.playOneSegment(resolved[0])
      console.log('[TtsAudioManager] single segment done')
      this.setPlaying(false)
    } else {
      await this.playSequence(resolved)
    }
  }

  /**
   * Speak using browser SpeechSynthesis.
   * Returns true if successful, false if unavailable or errored.
   */
  private speakBrowserTts(text: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.log('[TtsAudioManager] speakBrowserTts: not available')
      return Promise.resolve(false)
    }

    const voices = speechSynthesis.getVoices()
    console.log('[TtsAudioManager] speakBrowserTts:', {
      text: text.slice(0, 40),
      volume: this._volume,
      speaking: speechSynthesis.speaking,
      pending: speechSynthesis.pending,
      paused: speechSynthesis.paused,
      voiceCount: voices.length,
    })

    return new Promise<boolean>((resolve) => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve(value)
      }

      // Safety timeout — if browser hangs, don't block the UI forever
      const timeout = setTimeout(() => {
        console.log('[TtsAudioManager] speakBrowserTts: safety timeout (10s)')
        speechSynthesis.cancel()
        this._activeUtterances.delete(utterance)
        settle(false)
      }, 10_000)

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = this._volume
      utterance.rate = 0.9
      utterance.onend = () => {
        console.log('[TtsAudioManager] speakBrowserTts: onend')
        this._activeUtterances.delete(utterance)
        settle(true)
      }
      utterance.onerror = (e) => {
        console.log(
          '[TtsAudioManager] speakBrowserTts: onerror',
          (e as SpeechSynthesisErrorEvent).error
        )
        this._activeUtterances.delete(utterance)
        settle(false)
      }

      // Keep a strong reference so the utterance isn't GC'd before it finishes.
      // Using a Set (not a single var) because concurrent speak() calls can
      // create multiple in-flight utterances queued in speechSynthesis.
      this._activeUtterances.add(utterance)

      // Speak synchronously — must stay in the user-gesture call stack
      speechSynthesis.speak(utterance)
      console.log(
        '[TtsAudioManager] speakBrowserTts: speak() called, speaking:',
        speechSynthesis.speaking,
        'pending:',
        speechSynthesis.pending
      )
    })
  }

  // Prevent GC of in-flight utterances — Chrome may corrupt the speech
  // queue if a queued SpeechSynthesisUtterance is garbage-collected.
  private _activeUtterances = new Set<SpeechSynthesisUtterance>()

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
    this._activeUtterances.clear()
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

  // -- Introspection (for admin tools) --

  /**
   * Return per-voice clip availability for the current voice chain.
   * Read-only — mirrors what `playOneSegment` checks internally.
   */
  getClipAvailability(clipId: string): Array<{ source: VoiceSource; hasClip: boolean }> {
    return this._voiceChain.map((source) => ({
      source,
      hasClip:
        source.type === 'browser-tts'
          ? true
          : (this._pregenClipIds.get(source.name)?.has(clipId) ?? false),
    }))
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
