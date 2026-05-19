/**
 * "Behind the song" lyric annotation engine for the public share page.
 *
 * Pure and deterministic — no I/O, no DB, no randomness. Given parsed lyric
 * sections and an *already privacy-gated* set of session facts, it attaches a
 * few warm, adult-readable notes to the sections whose lyrics actually
 * reference those facts.
 *
 * Matching is intentionally strict: a problem-moment is attached only when the
 * lyric line literally contains that problem's *full expression* (e.g. the
 * line "Boss mix: 23 + 1 + 10 + 10 = 44—won!" attaches the moment whose
 * problem is "23 + 1 + 10 + 10 = 44"). Bare-answer or single-term overlap is
 * NOT enough — answers and small terms collide across unrelated problems and
 * produced misleading notes. At most one problem-moment note per section, and
 * the note does not echo the equation (it's already on the line, and in the
 * "highlights" strip) — it adds the human story instead.
 *
 * This runs *inside* `getSharedSong` after the visibility gate, so it only
 * ever sees the facts the share's toggles permit. A section with no match is
 * returned unchanged (it renders as plain lyrics — `SongLyrics` already
 * supports the absent-annotations case). Absent/empty facts (default share, or
 * pre-`practiceDrama` rows) → sections returned untouched.
 *
 * Owns `AnnotatedSongSection` (consumed by `SongLyrics`) so the presentational
 * component never has to import the engine.
 */

import type {
  SongProblemMoment,
  SongSkillSpotlight,
} from '@/lib/session-song/extract-session-stats'
import { formatSkill } from '@/lib/song-share/sessionFacts'
import type { ParsedSongSection } from '@/lib/song-share/songPlan'

export interface AnnotatedSongSection extends ParsedSongSection {
  /** Optional "behind the line" notes derived from session metadata. */
  annotations?: string[]
}

/**
 * Already-gated facts: a field is present only when the share's corresponding
 * visibility toggle allowed it (the gating happens in `getSharedSong`, not
 * here). This type makes the privacy contract explicit at the call site.
 */
export interface AnnotateFacts {
  playerName: string
  /** Gated by `showProblemDetail`. */
  problemMoments?: SongProblemMoment[]
  /** Gated by `showProblemDetail`. */
  storyAngle?: string
  /** Gated by `showProblemDetail` — game name only, no scores. */
  gameBreak?: { gameName?: string | null; headline?: string | null }
  /** Gated by `showStreakSkills`. */
  skillSpotlights?: SongSkillSpotlight[]
  /** Gated by `showStreakSkills`. */
  skills?: string[]
}

/** At most this many notes per section — keep it tasteful, not a wall of text. */
const MAX_PER_SECTION = 2

/** A whole, distinct number with >= 2 digits, not embedded in a longer run. */
const MULTI_DIGIT = /(?<!\d)(\d{2,})(?!\d)/g

function digitsIn(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(MULTI_DIGIT)) out.add(m[1])
  return out
}

function lc(s: string): string {
  return s.toLowerCase()
}

/**
 * Collapse an arithmetic expression to a canonical, whitespace-free form so a
 * lyric line and a stored `problem` compare equal regardless of spacing or
 * which dash/minus glyph the lyricist used: "23 + 1 + 10 + 10 = 44" and
 * "Boss mix: 23+1+10+10=44—won!" both contain "23+1+10+10=44".
 */
function canonicalMath(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‐-―−]/g, '-') // unicode hyphens/minus → '-'
    .replace(/\s+/g, '')
}

/** A warm, non-redundant note for a matched problem moment (no equation echo). */
function momentNote(name: string, kind: SongProblemMoment['kind']): string {
  switch (kind) {
    case 'comeback':
      return `${name} bounced back on this one.`
    case 'help_breakthrough':
      return `It clicked for ${name} right here.`
    case 'hard_problem':
      return `The session's toughest problem — and ${name} got it.`
    case 'streak_peak':
      return `${name} was mid hot-streak right here.`
    case 'finale':
      return `${name} closed the session out strong here.`
    case 'slow_burn':
      return `${name} stuck with this one and got there.`
    default:
      return `${name} nailed this one.`
  }
}

/** Significant leading words of a game name, e.g. "Type Racer Jr." → "type racer". */
function gameNameStem(gameName: string): string {
  return lc(gameName)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ')
}

/**
 * Attach "behind the song" notes to the sections that reference gated facts.
 * Each distinct fact is emitted at most once across the whole song (the first
 * matching section wins) so a repeated chorus doesn't repeat the same aside.
 */
export function annotateSections(
  sections: ParsedSongSection[],
  facts: AnnotateFacts
): AnnotatedSongSection[] {
  if (!Array.isArray(sections) || sections.length === 0) return sections

  const name = facts.playerName?.trim() || 'They'
  const nameLc = lc(name)
  const moments = Array.isArray(facts.problemMoments) ? facts.problemMoments : []
  const spotlights = Array.isArray(facts.skillSpotlights) ? facts.skillSpotlights : []
  const skills = Array.isArray(facts.skills) ? facts.skills : []
  const gameName = facts.gameBreak?.gameName?.trim() || ''
  const storyAngle = facts.storyAngle?.trim() || ''

  // Nothing gated in → return the input untouched (default share / old row).
  if (
    moments.length === 0 &&
    spotlights.length === 0 &&
    skills.length === 0 &&
    !gameName &&
    !storyAngle
  ) {
    return sections
  }

  // Pre-canonicalize each moment's expression once. Only moments that look
  // like a real "a + b … = c" expression are eligible (>= 5 chars, has '=').
  const momentExprs = moments.map((m) => {
    const canon = canonicalMath(String(m.problem ?? ''))
    return canon.includes('=') && canon.length >= 5 ? canon : ''
  })

  const storyNumbers = storyAngle ? digitsIn(storyAngle) : new Set<string>()
  const gameStem = gameName ? gameNameStem(gameName) : ''
  const usedKeys = new Set<string>() // a given fact annotates the song only once
  let storyUsed = false

  return sections.map((section) => {
    // Build the searchable text from the section, with the player's name/handle
    // removed first — otherwise a numeric handle (e.g. "Debug-1772926925699")
    // leaks digits into number matching.
    const rawText = lc(`${section.name}\n${section.lines.join('\n')}`)
    const text = nameLc ? rawText.split(nameLc).join(' ') : rawText
    const canonText = canonicalMath(text)
    const sectionDigits = digitsIn(text)
    const notes: string[] = []

    const push = (key: string, note: string) => {
      if (notes.length >= MAX_PER_SECTION) return
      if (usedKeys.has(key)) return
      usedKeys.add(key)
      notes.push(note)
    }

    // 1. Problem moment — STRICT: the lyric must contain the moment's full
    //    expression. At most one moment note per section (first match wins).
    for (let i = 0; i < moments.length; i++) {
      const expr = momentExprs[i]
      if (!expr || usedKeys.has(`moment:${i}`)) continue
      if (canonText.includes(expr)) {
        push(`moment:${i}`, momentNote(name, moments[i].kind))
        break
      }
    }

    // 2. Game-break shout-out (section name often is "… Side Quest").
    if (gameStem && (text.includes(lc(gameName)) || text.includes(gameStem))) {
      push('game', `A shout-out to the ${gameName} break ${name} earned.`)
    }

    // 3. The story's signature number (e.g. the "313" comeback) — once, total.
    if (!storyUsed && storyAngle && [...storyNumbers].some((n) => sectionDigits.has(n))) {
      storyUsed = true
      push('story', `The whole song is built around ${name}'s ${storyAngle}.`)
    }

    // 4. Skill reference — skill display names rarely appear verbatim in lyrics
    //    (they're abacus notation), so this is best-effort and usually a no-op.
    const skillPool = [...spotlights.map((s) => s.skill), ...skills].filter(
      (s): s is string => typeof s === 'string' && s.length > 0
    )
    for (const raw of skillPool) {
      if (notes.length >= MAX_PER_SECTION) break
      // Already-spaced display names ("Direct Addition (1-4)") are kept as-is;
      // only dotted keys ("basic.directAddition") go through formatSkill.
      const pretty = raw.includes(' ') ? raw : formatSkill(raw)
      const lastWord = pretty.split(/\s+/).pop() ?? ''
      if (
        (raw.length >= 4 && text.includes(lc(raw))) ||
        (pretty.length >= 4 && text.includes(lc(pretty))) ||
        (lastWord.length >= 4 && text.includes(lc(lastWord)))
      ) {
        push(`skill:${lc(raw)}`, `This part leans on ${pretty}.`)
      }
    }

    return notes.length > 0 ? { ...section, annotations: notes } : section
  })
}
