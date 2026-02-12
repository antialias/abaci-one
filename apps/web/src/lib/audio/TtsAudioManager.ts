import { AUDIO_MANIFEST_MAP } from './audioManifest'
import { getClipMeta } from './audioClipRegistry'
import { computeClipHash, resolveCanonicalText } from './clipHash'

export type SubtitleAnchor = 'top' | 'bottom'

export interface TtsAudioManagerConfig {
  volume: number
  enabled: boolean
  subtitleDurationMultiplier: number
  /** Bottom offset in pixels for subtitle positioning (default 64). */
  subtitleBottomOffset: number
  /** Anchor subtitles to top or bottom of viewport (default 'bottom'). */
  subtitleAnchor: SubtitleAnchor
}

export interface ManagerSnapshot {
  isPlaying: boolean
  isEnabled: boolean
  volume: number
  subtitleText: string | null
  subtitleDurationMultiplier: number
  subtitleDurationMs: number
  /** Bottom offset in pixels for subtitle positioning. */
  subtitleBottomOffset: number
  /** Anchor subtitles to top or bottom of viewport. */
  subtitleAnchor: SubtitleAnchor
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

export type { VoiceSourceData } from './voiceSource'
import type { VoiceSourceData } from './voiceSource'
import {
  type VoiceSource,
  PregeneratedVoice,
  CustomVoice,
  hydrateVoiceChain,
} from './voiceSource'

type Listener = () => void

type ChainAttemptOutcome = 'no-clip' | 'play-error' | 'unavailable' | 'skipped'

interface ChainAttempt {
  source: VoiceSource
  outcome: ChainAttemptOutcome
}

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
  private _subtitleDurationMultiplier = 1
  private _currentSubtitleDurationMs = 0
  private _subtitleBottomOffset = 64
  private _subtitleAnchor: SubtitleAnchor = 'bottom'

  // Voice chain: ordered fallback list for playback
  private _voiceChain: VoiceSource[] = []

  // Pre-generated clip IDs: voice name -> set of clip IDs with mp3s on disk
  private _pregenClipIds = new Map<string, Set<string>>()

  // Currently playing Audio element (for mp3 playback)
  private _currentAudio: HTMLAudioElement | null = null

  // Duration (ms) of the currently playing audio clip, set from loadedmetadata
  private _currentAudioDurationMs: number | null = null

  // Sequence cancellation flag
  private _sequenceCancelled = false

  // Debug: monotonically increasing speak call ID for tracing concurrent calls
  private _speakSeq = 0
  private _activeSpeakId = 0

  // Subtitle display state
  private _subtitleText: string | null = null
  private _subtitleTimer: ReturnType<typeof setTimeout> | null = null
  private _subtitleResolve: (() => void) | null = null

  // Cached snapshot for useSyncExternalStore -- must be referentially stable
  private _cachedSnapshot: ManagerSnapshot = {
    isPlaying: false,
    isEnabled: false,
    volume: 0.8,
    subtitleText: null,
    subtitleDurationMultiplier: 1,
    subtitleDurationMs: 0,
    subtitleBottomOffset: 64,
    subtitleAnchor: 'bottom',
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
    if (config.subtitleDurationMultiplier !== undefined) {
      this._subtitleDurationMultiplier = config.subtitleDurationMultiplier
      changed = true
      // Restart the active subtitle timer so the new speed takes effect immediately
      if (this._subtitleText && this._subtitleResolve) {
        if (this._subtitleTimer) clearTimeout(this._subtitleTimer)
        const newMs = this.estimateReadingTimeMs(this._subtitleText)
        this._currentSubtitleDurationMs = newMs
        const resolve = this._subtitleResolve
        this._subtitleTimer = setTimeout(() => {
          this._subtitleResolve = null
          resolve()
        }, newMs)
      }
    }
    if (config.subtitleBottomOffset !== undefined) {
      this._subtitleBottomOffset = config.subtitleBottomOffset
      changed = true
    }
    if (config.subtitleAnchor !== undefined) {
      this._subtitleAnchor = config.subtitleAnchor
      changed = true
    }

    if (changed) this.notify()
  }

  // -- Voice Chain --

  /**
   * Load the pre-generated clip manifest for the given voice chain.
   * Fetches from the manifest endpoint to populate `_pregenClipIds`.
   */
  async loadPregenManifest(voiceChainData: VoiceSourceData[]): Promise<void> {
    this._voiceChain = hydrateVoiceChain(voiceChainData)

    const diskVoices = this._voiceChain
      .filter(
        (s): s is PregeneratedVoice | CustomVoice =>
          s instanceof PregeneratedVoice || s instanceof CustomVoice
      )
      .map((s) => s.name)

    if (diskVoices.length === 0) return

    try {
      const res = await fetch(
        `/api/audio/collected-clips/manifest?voices=${diskVoices.join(',')}`
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

  // -- Audio duration (for adaptive animation timing) --

  /**
   * Duration (ms) of the currently playing audio clip.
   * Set from the Audio element's `loadedmetadata` event during `playMp3()`.
   * Returns null when no audio is playing, duration is unknown, or playback
   * uses browser TTS / subtitle-only (which don't expose duration upfront).
   */
  getCurrentAudioDurationMs(): number | null {
    return this._currentAudioDurationMs
  }

  // -- Playback --

  /**
   * Play an mp3 file from a URL.
   * Returns true if playback completed, false on error.
   */
  private playMp3(url: string): Promise<boolean> {
    const speakId = this._activeSpeakId
    return new Promise<boolean>((resolve) => {
      // Pause any orphaned audio element before creating a new one
      if (this._currentAudio) {
        console.warn(`[TTS:mp3:${speakId}] ⚠️ ORPHANED AUDIO — pausing previous element before creating new one`, {
          previousSrc: this._currentAudio.src?.slice(-60),
          previousPaused: this._currentAudio.paused,
        })
        this._currentAudio.pause()
        this._currentAudio = null
      }
      const audio = new Audio(url)
      audio.volume = this._volume
      this._currentAudio = audio
      console.log(`[TTS:mp3:${speakId}] ▶ playMp3 START`, { url: url.slice(-60) })

      // Expose audio duration for adaptive animation timing
      audio.addEventListener('loadedmetadata', () => {
        if (this._currentAudio === audio) {
          this._currentAudioDurationMs = audio.duration * 1000
        }
      })

      // Only clear _currentAudio if it's still THIS element — a newer
      // speak() call may have already overwritten it with a different one.
      const clearIfOwned = () => {
        if (this._currentAudio === audio) this._currentAudio = null
      }

      audio.onended = () => {
        console.log(`[TTS:mp3:${speakId}] ✓ playMp3 ENDED`, { url: url.slice(-60) })
        clearIfOwned()
        resolve(true)
      }
      audio.onerror = (e) => {
        console.warn(`[TTS:mp3:${speakId}] ✗ playMp3 ERROR`, { url: url.slice(-60), error: e })
        clearIfOwned()
        resolve(false)
      }
      audio.play().catch((err) => {
        console.warn(`[TTS:mp3:${speakId}] ✗ playMp3 play() REJECTED`, { url: url.slice(-60), err })
        clearIfOwned()
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
  /** Check if this speak call has been superseded by a newer one. */
  private _isStale(speakId: number): boolean {
    return speakId !== this._activeSpeakId
  }

  private async playOneSegment(resolved: ResolvedSegment, speakId: number): Promise<boolean> {
    if (this._isStale(speakId)) return false

    console.log(`[TTS:chain:${speakId}] 🔗 playOneSegment START`, {
      clipId: resolved.clipId,
      chainLength: this._voiceChain.length,
      chain: this._voiceChain.map(s => s.toJSON()),
      pregenVoices: [...this._pregenClipIds.entries()].map(([v, ids]) => ({ voice: v, clipCount: ids.size, hasThisClip: ids.has(resolved.clipId) })),
    })

    const log: ChainAttempt[] = []

    if (this._voiceChain.length > 0) {
      for (let i = 0; i < this._voiceChain.length; i++) {
        if (this._isStale(speakId)) {
          console.log(`[TTS:chain:${speakId}] ⏹ STALE at chain[${i}] (active=${this._activeSpeakId})`)
          return false
        }

        const source = this._voiceChain[i]
        if (source instanceof PregeneratedVoice || source instanceof CustomVoice) {
          const clipIds = this._pregenClipIds.get(source.name)
          const hasClip = clipIds?.has(resolved.clipId) ?? false
          console.log(
            `[TTS:chain:${speakId}] chain[${i}] ${source.type} "${source.name}": hasClip=${hasClip}`
          )
          if (hasClip) {
            const url = `/api/audio/clips/${source.name}/${resolved.clipId}`
            console.log(`[TTS:chain:${speakId}] chain[${i}] → playMp3("${source.name}/${resolved.clipId}")`)
            const ok = await this.playMp3(url)
            if (this._isStale(speakId)) {
              console.log(`[TTS:chain:${speakId}] ⏹ STALE after playMp3 at chain[${i}] (active=${this._activeSpeakId})`)
              return false
            }
            console.log(`[TTS:chain:${speakId}] chain[${i}] playMp3 result: ok=${ok}`)
            if (ok) return true
            log.push({ source, outcome: 'play-error' })
          } else {
            log.push({ source, outcome: 'no-clip' })
          }
        } else if (source.type === 'browser-tts') {
          console.log(
            `[TTS:chain:${speakId}] chain[${i}] browser-tts: "${resolved.fallbackText.slice(0, 40)}"`
          )
          const ok = await this.speakBrowserTts(resolved.fallbackText)
          if (this._isStale(speakId)) return false
          console.log(`[TTS:chain:${speakId}] chain[${i}] browser-tts result: ok=${ok}`)
          if (ok) return true
          log.push({ source, outcome: 'unavailable' })
        } else if (source.type === 'subtitle') {
          console.log(
            `[TTS:chain:${speakId}] chain[${i}] subtitle: "${resolved.fallbackText.slice(0, 40)}"`
          )
          const readingMs = this.estimateReadingTimeMs(resolved.fallbackText)
          this._subtitleText = resolved.fallbackText
          this._currentSubtitleDurationMs = readingMs
          this.notify()

          await new Promise<void>((resolve) => {
            this._subtitleResolve = resolve
            this._subtitleTimer = setTimeout(() => {
              this._subtitleResolve = null
              resolve()
            }, readingMs)
          })

          this._subtitleText = null
          this._subtitleTimer = null
          this._subtitleResolve = null
          this._currentSubtitleDurationMs = 0
          this.notify()
          return !this._isStale(speakId)
        } else if (source.type === 'generate') {
          // Read the log to find voices that had no clip and can generate on-demand.
          // Each voice class decides for itself (e.g. PregeneratedVoice → yes, CustomVoice → not yet).
          const missed = log
            .filter((a) => a.outcome === 'no-clip' && a.source.canGenerate())
            .map((a) => a.source)

          console.log(
            `[TTS:chain:${speakId}] chain[${i}] generate: missed=${JSON.stringify(missed.map((s) => s.toJSON()))}`
          )

          if (missed.length > 0) {
            const [primary, ...others] = missed
            console.log(`[TTS:chain:${speakId}] chain[${i}] → generateAndPlay("${(primary as PregeneratedVoice).name ?? 'unknown'}")`)
            const ok = await this.generateAndPlay(primary, resolved, speakId)
            if (this._isStale(speakId)) return false
            console.log(`[TTS:chain:${speakId}] chain[${i}] generateAndPlay result: ok=${ok}`)
            if (ok) {
              if (others.length > 0) {
                console.log(`[TTS:chain:${speakId}] chain[${i}] → generateInBackground for ${others.length} other voices`)
                this.generateInBackground(others, resolved)
              }
              return true
            }
            log.push({ source, outcome: 'play-error' })
          } else {
            log.push({ source, outcome: 'skipped' })
          }
        }
      }
      // All chain entries exhausted
      console.warn(`[TTS:chain:${speakId}] ⚠️ voice chain EXHAUSTED — nothing played!`, {
        log: log.map(a => ({ source: a.source.toJSON(), outcome: a.outcome })),
      })
      return false
    }

    // No voice chain -- fall back to browser TTS
    if (this._isStale(speakId)) return false
    console.log(`[TTS:chain:${speakId}] no voice chain, falling back to browser TTS`)
    const ok = await this.speakBrowserTts(resolved.fallbackText)
    console.log(`[TTS:chain:${speakId}] fallback browser-tts result: ok=${ok}`)
    return ok
  }

  /**
   * Play a sequence of resolved segments with inter-segment gaps.
   */
  private async playSequence(segments: ResolvedSegment[], speakId: number): Promise<void> {
    // speak() already cancelled previous playback and waited a frame
    // if browser TTS was active, so we just reset the sequence flag.
    this._isPlaying = true
    this._sequenceCancelled = false
    this.notify()

    for (let i = 0; i < segments.length; i++) {
      if (this._isStale(speakId)) break

      await this.playOneSegment(segments[i], speakId)

      // Inter-segment gap (skip after last segment)
      if (i < segments.length - 1 && !this._isStale(speakId)) {
        await new Promise<void>((resolve) => setTimeout(resolve, INTER_SEGMENT_GAP_MS))
      }
    }

    this.setPlaying(false)
  }

  async speak(input: TtsInput, config?: TtsConfig): Promise<void> {
    this.register(input, config)

    const speakId = ++this._speakSeq
    const prevSpeakId = this._activeSpeakId
    this._activeSpeakId = speakId

    console.log(`[TTS:speak:${speakId}] 🎤 SPEAK CALLED (prev=${prevSpeakId})`, {
      isEnabled: this._isEnabled,
      input: typeof input === 'string' ? input : JSON.stringify(input).slice(0, 100),
      currentAudioSrc: this._currentAudio?.src?.slice(-60) ?? null,
      currentAudioPaused: this._currentAudio?.paused ?? null,
      voiceChain: this._voiceChain.map(s => s.toJSON()),
      stack: new Error().stack?.split('\n').slice(1, 5).map(l => l.trim()),
    })

    if (!this._isEnabled) {
      console.log(`[TTS:speak:${speakId}] ⏭ TTS disabled, returning early`)
      return
    }

    const segments = Array.isArray(input) ? input : [input]
    if (segments.length === 0) return

    const resolved = segments.map((seg) => this.resolveSegment(seg, config))
    console.log(
      `[TTS:speak:${speakId}] resolved:`,
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
    console.log(`[TTS:speak:${speakId}] 🛑 cancelling previous (currentAudio=${!!this._currentAudio})`)
    this._sequenceCancelled = true
    this._currentAudioDurationMs = null
    if (this._subtitleTimer) { clearTimeout(this._subtitleTimer); this._subtitleTimer = null }
    if (this._subtitleResolve) { this._subtitleResolve(); this._subtitleResolve = null }
    this._subtitleText = null
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
      console.log(`[TTS:speak:${speakId}] ▶ playing single segment...`)
      await this.playOneSegment(resolved[0], speakId)
      console.log(`[TTS:speak:${speakId}] ■ single segment done (activeSpeakId now=${this._activeSpeakId})`)
      if (!this._isStale(speakId)) this.setPlaying(false)
    } else {
      await this.playSequence(resolved, speakId)
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

    // Fast-fail when no active user gesture — speechSynthesis.speak() silently
    // no-ops without user activation on most browsers.
    if (navigator.userActivation && !navigator.userActivation.isActive) {
      console.log('[TtsAudioManager] speakBrowserTts: no user activation, skipping')
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

    // Fast-fail: no voices loaded means speak() will silently no-op
    if (voices.length === 0) {
      console.log('[TtsAudioManager] speakBrowserTts: no voices available, skipping')
      return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        clearTimeout(safetyTimeout)
        clearTimeout(startTimeout)
        resolve(value)
      }

      // Safety timeout — if browser hangs, don't block the UI forever
      const safetyTimeout = setTimeout(() => {
        console.log('[TtsAudioManager] speakBrowserTts: safety timeout (10s)')
        speechSynthesis.cancel()
        this._activeUtterances.delete(utterance)
        settle(false)
      }, 10_000)

      // Start detection — if speaking hasn't started after 1.5s, it silently failed
      const startTimeout = setTimeout(() => {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) {
          console.log('[TtsAudioManager] speakBrowserTts: speech never started (1.5s), bailing')
          speechSynthesis.cancel()
          this._activeUtterances.delete(utterance)
          settle(false)
        }
      }, 1500)

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

  /**
   * Generate a clip on-demand via the voice's `generate()` method and play it.
   * On success, also adds the clip to the pregen cache so future
   * playback hits the pregenerated path directly.
   */
  private async generateAndPlay(
    source: VoiceSource,
    resolved: ResolvedSegment,
    speakId: number
  ): Promise<boolean> {
    let blobUrl: string | null = null
    try {
      console.log(
        `[TTS:gen:${speakId}] generateAndPlay: source=${JSON.stringify(source.toJSON())} clipId="${resolved.clipId}"`
      )
      const blob = await source.generate(resolved.clipId, resolved.fallbackText, resolved.tone)
      if (this._isStale(speakId)) {
        console.log(`[TTS:gen:${speakId}] ⏹ STALE after generate()`)
        return false
      }
      if (!blob) {
        console.log(`[TTS:gen:${speakId}] generate returned null`)
        return false
      }
      console.log(`[TTS:gen:${speakId}] ✓ generated blob, size=${blob.size}, playing...`)
      blobUrl = URL.createObjectURL(blob)
      const ok = await this.playMp3(blobUrl)
      if (this._isStale(speakId)) {
        console.log(`[TTS:gen:${speakId}] ⏹ STALE after playMp3`)
        return false
      }
      if (ok && (source instanceof PregeneratedVoice || source instanceof CustomVoice)) {
        this.addToPregenCache(source.name, resolved.clipId)
      }
      return ok
    } catch (err) {
      console.error(`[TTS:gen:${speakId}] generateAndPlay error:`, err)
      return false
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }

  /**
   * Fire-and-forget generation for additional voices that were missed.
   * On success, adds the clip to the pregen cache for future playback.
   */
  private generateInBackground(sources: VoiceSource[], resolved: ResolvedSegment): void {
    for (const source of sources) {
      source
        .generate(resolved.clipId, resolved.fallbackText, resolved.tone)
        .then((blob) => {
          if (blob && (source instanceof PregeneratedVoice || source instanceof CustomVoice)) {
            this.addToPregenCache(source.name, resolved.clipId)
            console.log(
              `[TtsAudioManager] generateInBackground: cached "${source.name}/${resolved.clipId}"`
            )
          }
        })
        .catch(() => {
          // Silent — background generation is best-effort
        })
    }
  }

  private addToPregenCache(voice: string, clipId: string): void {
    let ids = this._pregenClipIds.get(voice)
    if (!ids) {
      ids = new Set()
      this._pregenClipIds.set(voice, ids)
    }
    ids.add(clipId)
  }

  stop(): void {
    console.log(`[TTS:stop] 🛑 STOP called (activeSpeakId=${this._activeSpeakId})`, {
      currentAudioSrc: this._currentAudio?.src?.slice(-60) ?? null,
      currentAudioPaused: this._currentAudio?.paused ?? null,
      isPlaying: this._isPlaying,
      stack: new Error().stack?.split('\n').slice(1, 4).map(l => l.trim()),
    })
    // Invalidate any in-flight speak call so its chain stops
    this._activeSpeakId = -1
    // Cancel any running sequence
    this._sequenceCancelled = true
    this._currentAudioDurationMs = null
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
    // Clear subtitle display
    if (this._subtitleTimer) { clearTimeout(this._subtitleTimer); this._subtitleTimer = null }
    if (this._subtitleResolve) { this._subtitleResolve(); this._subtitleResolve = null }
    this._subtitleText = null
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
  getClipAvailability(clipId: string): Array<{ source: VoiceSourceData; hasClip: boolean }> {
    return this._voiceChain.map((source) => ({
      source: source.toJSON(),
      hasClip:
        source instanceof PregeneratedVoice || source instanceof CustomVoice
          ? (this._pregenClipIds.get(source.name)?.has(clipId) ?? false)
          : true, // browser-tts, subtitle, generate are always "available"
    }))
  }

  /**
   * Dismiss the current subtitle early, advancing to the next segment.
   */
  dismissSubtitle(): void {
    if (this._subtitleTimer) {
      clearTimeout(this._subtitleTimer)
      this._subtitleTimer = null
    }
    if (this._subtitleResolve) {
      this._subtitleResolve()
      this._subtitleResolve = null
    }
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

  private estimateReadingTimeMs(text: string): number {
    const words = text.trim().split(/\s+/).length
    const baseMs = (words / 200) * 60_000
    return Math.max(1500, baseMs * this._subtitleDurationMultiplier)
  }

  private notify(): void {
    // Rebuild cached snapshot so useSyncExternalStore sees a new reference
    this._cachedSnapshot = {
      isPlaying: this._isPlaying,
      isEnabled: this._isEnabled,
      volume: this._volume,
      subtitleText: this._subtitleText,
      subtitleDurationMultiplier: this._subtitleDurationMultiplier,
      subtitleDurationMs: this._currentSubtitleDurationMs,
      subtitleBottomOffset: this._subtitleBottomOffset,
      subtitleAnchor: this._subtitleAnchor,
    }
    for (const listener of this.listeners) {
      listener()
    }
  }
}
