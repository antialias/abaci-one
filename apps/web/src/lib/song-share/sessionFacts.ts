/**
 * Shared session-fact extractors for song share surfaces.
 *
 * Factored out of `app/observe/[token]/opengraph-image.tsx` so the OG image,
 * the public `/song/[code]` page, and the lyric annotation engine all derive
 * session facts from one place (never fork).
 *
 * These are pure helpers over a session plan's `parts` and a session song's
 * `promptInput.currentSession` — safe to call from server components, route
 * handlers, and `next/og` images.
 */

/** Subset of `SongPromptInput.currentSession` used across share surfaces. */
export interface SessionStats {
  accuracy: number
  problemsDone: number
  problemsTotal: number
  bestCorrectStreak: number
  partTypes: string[]
  durationMinutes: number
  skillsPracticed: string[]
}

export interface SessionProblem {
  terms: number[]
  answer: number
}

/** Format a skill key like "basic.directAddition" into "Direct Addition". */
export function formatSkill(skill: string): string {
  const name = skill.includes('.') ? skill.split('.').pop()! : skill
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/^\+/, 'Plus ')
    .trim()
}

/** Extract sample problems from session plan `parts`. */
export function extractProblems(parts: unknown): SessionProblem[] {
  if (!Array.isArray(parts)) return []
  const problems: SessionProblem[] = []
  for (const part of parts) {
    if (part?.slots && Array.isArray(part.slots)) {
      for (const slot of part.slots) {
        if (slot?.problem?.terms && slot.problem.answer != null) {
          problems.push({ terms: slot.problem.terms, answer: slot.problem.answer })
        }
      }
    }
  }
  return problems
}

/** Format a problem as a string like "13 + 11 + 10 = 34". */
export function formatProblem(p: SessionProblem): string {
  return `${p.terms.join(' + ')} = ${p.answer}`
}
