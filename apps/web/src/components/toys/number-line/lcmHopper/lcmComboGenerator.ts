/**
 * Curated LCM combo pool and selection logic.
 *
 * Pure functions — no React, no side effects.
 */

// ── Types ──────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface LcmCombo {
  strides: number[]
  lcm: number
  difficulty: Difficulty
}

export interface ActiveCombo extends LcmCombo {
  /** Emoji assigned to each hopper (parallel to strides) */
  emojis: string[]
  /** HSL color for each hopper's trail/arc */
  colors: string[]
}

// ── LCM math ───────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function lcm2(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

export function lcm(nums: number[]): number {
  return nums.reduce((acc, n) => lcm2(acc, n), 1)
}

// ── Emoji pool ─────────────────────────────────────────────────────────

const EMOJI_POOL = ['🐸', '🐰', '🦘', '🐿️', '🦊', '🐛', '🐝', '🦗']

/** Deterministic emoji for a stride value — same integer always maps to the same animal. */
export function emojiForStride(n: number): string {
  return EMOJI_POOL[((n % EMOJI_POOL.length) + EMOJI_POOL.length) % EMOJI_POOL.length]
}

/** Hopper-count-indexed color palettes (saturated, visible on both themes) */
const COLOR_PALETTES: Record<number, string[]> = {
  2: ['hsl(150, 75%, 50%)', 'hsl(280, 75%, 55%)'],
  3: ['hsl(150, 75%, 50%)', 'hsl(35, 90%, 55%)', 'hsl(280, 75%, 55%)'],
}

/** Indexed palette for deterministic per-stride colors. */
const STRIDE_COLOR_PALETTE = [
  'hsl(150, 75%, 50%)',
  'hsl(280, 75%, 55%)',
  'hsl(35, 90%, 55%)',
  'hsl(200, 80%, 50%)',
  'hsl(340, 75%, 55%)',
  'hsl(60, 85%, 45%)',
  'hsl(170, 70%, 45%)',
  'hsl(310, 70%, 55%)',
]

/** Deterministic color for a stride value. */
export function colorForStride(n: number): string {
  return STRIDE_COLOR_PALETTE[
    ((n % STRIDE_COLOR_PALETTE.length) + STRIDE_COLOR_PALETTE.length) % STRIDE_COLOR_PALETTE.length
  ]
}

/** Build an ActiveCombo from user-chosen strides (for party invitations). */
export function buildPartyCombo(strides: number[]): ActiveCombo {
  const lcmVal = lcm(strides)
  // Assign deterministic emojis — deduplicate if two strides map to the same emoji
  const emojis: string[] = []
  const usedEmojis = new Set<string>()
  for (const s of strides) {
    let emoji = emojiForStride(s)
    if (usedEmojis.has(emoji)) {
      // Find next unused emoji
      for (const e of EMOJI_POOL) {
        if (!usedEmojis.has(e)) {
          emoji = e
          break
        }
      }
    }
    usedEmojis.add(emoji)
    emojis.push(emoji)
  }
  const colors = strides.map((s) => colorForStride(s))
  const difficulty: Difficulty =
    lcmVal <= 24 ? 'easy' : lcmVal <= 60 ? 'medium' : 'hard'
  return { strides, lcm: lcmVal, difficulty, emojis, colors }
}

/** Check whether adding a new stride would push the LCM over the limit. */
export function wouldExceedLcmLimit(
  existing: number[],
  newStride: number,
  limit = 120
): boolean {
  return lcm([...existing, newStride]) > limit
}

// ── Curated combo pool ─────────────────────────────────────────────────

function combo(strides: number[], difficulty: Difficulty): LcmCombo {
  return { strides, lcm: lcm(strides), difficulty }
}

const COMBO_POOL: LcmCombo[] = [
  // Easy (2 hoppers, LCM ≤ 24)
  combo([2, 3], 'easy'),
  combo([2, 5], 'easy'),
  combo([3, 4], 'easy'),
  combo([3, 5], 'easy'),
  combo([4, 6], 'easy'),
  combo([2, 7], 'easy'),
  combo([3, 7], 'easy'),
  combo([4, 5], 'easy'),

  // Medium (2-3 hoppers, LCM ≤ 60)
  combo([2, 3, 4], 'medium'),
  combo([2, 3, 5], 'medium'),
  combo([2, 5, 6], 'medium'),
  combo([3, 4, 5], 'medium'),
  combo([3, 4, 6], 'medium'),
  combo([2, 3, 7], 'medium'),
  combo([4, 5, 6], 'medium'),
  combo([2, 4, 5], 'medium'),

  // Hard (3 hoppers, LCM ≤ 120)
  combo([3, 4, 7], 'hard'),
  combo([3, 5, 7], 'hard'),
  combo([4, 5, 7], 'hard'),
  combo([3, 5, 8], 'hard'),
  combo([4, 6, 7], 'hard'),
  combo([5, 6, 7], 'hard'),
  combo([3, 7, 8], 'hard'),
  combo([2, 5, 7], 'hard'),
]

// ── Selection ──────────────────────────────────────────────────────────

/**
 * Pick the next combo, cycling through the pool. Difficulty auto-escalates:
 * first few rounds are easy, then medium, then hard.
 */
export function pickCombo(roundIndex: number): ActiveCombo {
  let difficulty: Difficulty
  if (roundIndex < 3) difficulty = 'easy'
  else if (roundIndex < 7) difficulty = 'medium'
  else difficulty = 'hard'

  const pool = COMBO_POOL.filter((c) => c.difficulty === difficulty)
  const chosen = pool[roundIndex % pool.length]

  // Assign random emojis (no duplicates)
  const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5)
  const emojis = shuffled.slice(0, chosen.strides.length)

  const colors = COLOR_PALETTES[chosen.strides.length] ?? COLOR_PALETTES[3]

  return { ...chosen, emojis, colors }
}

/**
 * Return the shared landing positions (where 2+ hoppers coincide)
 * before the LCM, useful for narration about "partial overlaps".
 */
export function sharedLandings(combo: LcmCombo): number[] {
  const { strides, lcm: lcmVal } = combo
  // Count how many hoppers land at each position
  const counts = new Map<number, number>()
  for (const stride of strides) {
    for (let pos = stride; pos < lcmVal; pos += stride) {
      counts.set(pos, (counts.get(pos) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([pos]) => pos)
    .sort((a, b) => a - b)
}
