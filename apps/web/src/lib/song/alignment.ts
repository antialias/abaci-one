/**
 * Word-alignment model and normalizer for ElevenLabs music generation.
 *
 * The detailed music endpoint returns a JSON blob with per-word timing data
 * for the sung vocals; this module normalizes that raw JSON against the
 * canonical lyrics we sent in the composition plan, producing a uniform
 * `SyncedLyricsModel` the player can render without caring about ElevenLabs'
 * exact response shape.
 *
 * Robustness goals:
 * - Try several plausible shapes for the raw alignment (parallel arrays,
 *   array-of-objects). The exact field names from `/v1/music/detailed` aren't
 *   pinned by public docs at the time of writing — we lean on shape sniffing.
 * - If alignment is missing or empty, fall back to a static-lyrics model with
 *   `words: null` per line so the UI can render plain text.
 * - Zip canonical words to aligned words sequentially. The model sings what we
 *   asked it to sing, so ordering is reliable; if counts diverge, the extras
 *   on either side just lose timing.
 */

import type { MusicAlignmentJson } from '../elevenlabs/music-client'

// ============================================================================
// Public types
// ============================================================================

/** Subset of the composition plan the player needs to render lyrics. */
export interface SongLyricsSection {
  name: string
  lines: string[]
  durationMs: number
  /** Stable short IDs of session moments this section references, if any. */
  momentRefs?: string[]
}

export interface SyncedWord {
  text: string
  startMs: number
  endMs: number
}

export interface SyncedLine {
  /** Per-word timing when alignment matched; null = render line as static text. */
  words: SyncedWord[] | null
  /** Canonical line text — always populated, used for fallback rendering. */
  rawText: string
  startMs: number | null
  endMs: number | null
}

export interface SyncedSection {
  name: string
  lines: SyncedLine[]
  startMs: number | null
  endMs: number | null
  /** From the composition plan — used when alignment is absent. */
  fallbackDurationMs: number
}

export interface SyncedLyricsModel {
  sections: SyncedSection[]
  /** Best-effort total duration in ms. Prefers alignment end; falls back to plan. */
  totalDurationMs: number
  /** True when at least one line has per-word timing data. */
  hasAlignment: boolean
}

// ============================================================================
// Helpers
// ============================================================================

interface FlatAlignedWord {
  text: string
  startMs: number
  endMs: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Normalize a numeric timing field to ms. Heuristic: small values (< 1000)
 * are assumed to be seconds; large values are assumed to be ms already.
 */
function toMs(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 1000 ? value * 1000 : value
}

/**
 * Split a line into words on whitespace. Punctuation stays attached to the
 * word it borders ("hero," is one token) so the rendered line preserves
 * the author's exact text.
 */
function tokenizeLine(line: string): string[] {
  return line.split(/\s+/).filter((w) => w.length > 0)
}

// ============================================================================
// Raw-alignment extractor
// ============================================================================

/**
 * Pull a flat list of `{text, startMs, endMs}` out of whatever ElevenLabs
 * returned. Tries shapes in rough order of likelihood:
 *
 *   1. Parallel arrays at top level (TTS style):
 *      { words: [...], word_start_times_seconds: [...], word_end_times_seconds: [...] }
 *   2. Array of objects at top level or under common keys:
 *      { words: [{ text|word, start|start_seconds|start_ms, end|... }] }
 *   3. Nested under `alignment` / `song_metadata` / `metadata`.
 *
 * Returns [] when none match.
 */
function extractFlatWords(raw: MusicAlignmentJson | null): FlatAlignedWord[] {
  if (!raw) return []

  const candidates: Array<Record<string, unknown>> = []
  const top = asRecord(raw)
  if (top) {
    candidates.push(top)
    for (const key of ['alignment', 'song_metadata', 'songMetadata', 'metadata']) {
      const nested = asRecord(top[key])
      if (nested) candidates.push(nested)
    }
  }

  for (const obj of candidates) {
    const flat = tryParallelArrays(obj) ?? tryObjectArray(obj)
    if (flat && flat.length > 0) return flat
  }

  return []
}

function tryParallelArrays(obj: Record<string, unknown>): FlatAlignedWord[] | null {
  const words = obj.words
  const starts =
    obj.word_start_times_seconds ?? obj.word_start_times ?? obj.starts ?? obj.start_times
  const ends = obj.word_end_times_seconds ?? obj.word_end_times ?? obj.ends ?? obj.end_times
  if (!Array.isArray(words) || !Array.isArray(starts) || !Array.isArray(ends)) return null

  const out: FlatAlignedWord[] = []
  const n = Math.min(words.length, starts.length, ends.length)
  for (let i = 0; i < n; i++) {
    const text = words[i]
    const start = starts[i]
    const end = ends[i]
    if (typeof text !== 'string' || typeof start !== 'number' || typeof end !== 'number') continue
    out.push({ text, startMs: toMs(start), endMs: toMs(end) })
  }
  return out
}

function tryObjectArray(obj: Record<string, unknown>): FlatAlignedWord[] | null {
  // Sweep likely keys for an array of word-objects.
  const arrayKeys = ['words', 'word_timestamps', 'lyrics', 'tokens']
  for (const key of arrayKeys) {
    const arr = obj[key]
    if (!Array.isArray(arr)) continue

    const out: FlatAlignedWord[] = []
    for (const entry of arr) {
      const e = asRecord(entry)
      if (!e) continue
      const text =
        typeof e.text === 'string'
          ? e.text
          : typeof e.word === 'string'
            ? e.word
            : typeof e.token === 'string'
              ? e.token
              : null
      const startRaw =
        e.start ?? e.start_time ?? e.start_seconds ?? e.startSeconds ?? e.start_ms ?? e.startMs
      const endRaw = e.end ?? e.end_time ?? e.end_seconds ?? e.endSeconds ?? e.end_ms ?? e.endMs
      if (!text || typeof startRaw !== 'number' || typeof endRaw !== 'number') continue
      out.push({ text, startMs: toMs(startRaw), endMs: toMs(endRaw) })
    }
    if (out.length > 0) return out
  }
  return null
}

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a renderable lyrics model from canonical sections + raw alignment.
 *
 * Always returns a valid model; when alignment is missing the model still
 * carries the lyrics as static text so the UI can render them.
 */
export function buildSyncedLyricsModel(
  sections: SongLyricsSection[],
  alignment: MusicAlignmentJson | null
): SyncedLyricsModel {
  const flat = extractFlatWords(alignment)
  const hasAlignment = flat.length > 0
  let alignedIdx = 0

  const syncedSections: SyncedSection[] = sections.map((section) => {
    const lines: SyncedLine[] = section.lines.map((rawLine) => {
      const wordTexts = tokenizeLine(rawLine)
      if (!hasAlignment || wordTexts.length === 0) {
        return { words: null, rawText: rawLine, startMs: null, endMs: null }
      }

      const syncedWords: SyncedWord[] = wordTexts.map((text) => {
        if (alignedIdx >= flat.length) {
          return { text, startMs: 0, endMs: 0 }
        }
        const a = flat[alignedIdx++]
        // Keep the canonical text (preserves punctuation/casing the author wrote)
        // but adopt the aligned timing.
        return { text, startMs: a.startMs, endMs: a.endMs }
      })

      const startMs = syncedWords[0]?.startMs ?? null
      const endMs = syncedWords[syncedWords.length - 1]?.endMs ?? null
      return { words: syncedWords, rawText: rawLine, startMs, endMs }
    })

    const firstWithStart = lines.find((l) => l.startMs !== null)
    const lastWithEnd = [...lines].reverse().find((l) => l.endMs !== null)
    return {
      name: section.name,
      lines,
      startMs: firstWithStart?.startMs ?? null,
      endMs: lastWithEnd?.endMs ?? null,
      fallbackDurationMs: section.durationMs,
    }
  })

  const totalFromAlignment = hasAlignment
    ? flat.reduce((max, w) => Math.max(max, w.endMs), 0)
    : 0
  const totalFromPlan = sections.reduce((sum, s) => sum + s.durationMs, 0)
  const totalDurationMs = totalFromAlignment > 0 ? totalFromAlignment : totalFromPlan

  return {
    sections: syncedSections,
    totalDurationMs,
    hasAlignment,
  }
}

// ============================================================================
// Active-word lookup
// ============================================================================

export interface ActiveLyricLocation {
  sectionIndex: number
  lineIndex: number
  /** -1 when the line has no per-word alignment (static fallback render). */
  wordIndex: number
}

/**
 * Find what's playing right now given the model and current ms.
 *
 * Picks the latest word whose `startMs <= currentMs`. Returns null when
 * `currentMs` is before any aligned word, or when the model has no alignment.
 */
export function findActiveLocation(
  model: SyncedLyricsModel,
  currentMs: number
): ActiveLyricLocation | null {
  if (!model.hasAlignment) return null

  let last: ActiveLyricLocation | null = null
  for (let si = 0; si < model.sections.length; si++) {
    const section = model.sections[si]
    for (let li = 0; li < section.lines.length; li++) {
      const line = section.lines[li]
      if (!line.words) continue
      for (let wi = 0; wi < line.words.length; wi++) {
        const w = line.words[wi]
        if (currentMs >= w.startMs) {
          last = { sectionIndex: si, lineIndex: li, wordIndex: wi }
        } else {
          return last
        }
      }
    }
  }
  return last
}
