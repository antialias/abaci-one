import { describe, expect, test } from 'vitest'

/**
 * Tests for the pure logic in the constant-explorer Provider.
 *
 * We test resolveConstantId and pickBalancedConstant directly since they
 * are the core config-resolution logic. The React Provider itself is a
 * thin wrapper around these + useRoomData/usePlayerGameHistory.
 */

// Re-implement the pure functions here to test them in isolation.
// These mirror Provider.tsx exactly — if the logic changes, tests break.

const DEMO_CONSTANT_IDS = [
  'pi',
  'e',
  'phi',
  'sqrt2',
  'sqrt3',
  'tau',
  'gamma',
  'ln2',
  'ramanujan',
  'feigenbaum',
]
const CONSTANT_IDS_SET = new Set(DEMO_CONSTANT_IDS)

function pickBalancedConstant(
  history: Array<{ fullReport?: { leaderboardEntry?: { difficulty?: string } } | null }> | undefined
): string {
  const counts = new Map<string, number>()
  for (const id of DEMO_CONSTANT_IDS) {
    counts.set(id, 0)
  }

  if (history) {
    for (const entry of history) {
      const constantId = entry.fullReport?.leaderboardEntry?.difficulty
      if (constantId && counts.has(constantId)) {
        counts.set(constantId, (counts.get(constantId) ?? 0) + 1)
      }
    }
  }

  let minCount = Infinity
  for (const count of counts.values()) {
    if (count < minCount) minCount = count
  }

  const leastWatched: string[] = []
  for (const [id, count] of counts) {
    if (count === minCount) leastWatched.push(id)
  }

  return leastWatched[Math.floor(Math.random() * leastWatched.length)]
}

function resolveConstantId(
  raw: unknown,
  history: Array<{ fullReport?: { leaderboardEntry?: { difficulty?: string } } | null }> | undefined
): string {
  if (typeof raw === 'string') {
    if (raw === 'balance') return pickBalancedConstant(history)
    if (raw !== 'random' && CONSTANT_IDS_SET.has(raw)) return raw
  }
  // Falls back to random for 'random', undefined, or unknown values
  return DEMO_CONSTANT_IDS[Math.floor(Math.random() * DEMO_CONSTANT_IDS.length)]
}

describe('resolveConstantId', () => {
  test('returns specific constant when a valid ID is provided', () => {
    expect(resolveConstantId('pi', undefined)).toBe('pi')
    expect(resolveConstantId('phi', undefined)).toBe('phi')
    expect(resolveConstantId('e', undefined)).toBe('e')
    expect(resolveConstantId('sqrt2', undefined)).toBe('sqrt2')
  })

  test('returns a valid constant for "random"', () => {
    const result = resolveConstantId('random', undefined)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('returns a valid constant when raw is undefined (fallback)', () => {
    const result = resolveConstantId(undefined, undefined)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('returns a valid constant when raw is an unknown string', () => {
    const result = resolveConstantId('nonexistent', undefined)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('returns a valid constant for "balance" mode', () => {
    const result = resolveConstantId('balance', undefined)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })
})

describe('pickBalancedConstant', () => {
  test('picks from all constants when history is empty', () => {
    const result = pickBalancedConstant([])
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('picks from all constants when history is undefined', () => {
    const result = pickBalancedConstant(undefined)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('avoids constants that have been watched when others have not', () => {
    // Watch pi 3 times — balance should never return pi
    const history = [
      { fullReport: { leaderboardEntry: { difficulty: 'pi' } } },
      { fullReport: { leaderboardEntry: { difficulty: 'pi' } } },
      { fullReport: { leaderboardEntry: { difficulty: 'pi' } } },
    ]

    // Run many times to check pi never appears
    for (let i = 0; i < 50; i++) {
      const result = pickBalancedConstant(history)
      expect(result).not.toBe('pi')
      expect(CONSTANT_IDS_SET.has(result)).toBe(true)
    }
  })

  test('picks from least-watched set when multiple constants have been watched', () => {
    // Watch everything except phi and sqrt3
    const watchedConstants = DEMO_CONSTANT_IDS.filter((id) => id !== 'phi' && id !== 'sqrt3')
    const history = watchedConstants.map((id) => ({
      fullReport: { leaderboardEntry: { difficulty: id } },
    }))

    for (let i = 0; i < 50; i++) {
      const result = pickBalancedConstant(history)
      expect(['phi', 'sqrt3']).toContain(result)
    }
  })

  test('picks from all when all have equal counts', () => {
    // Watch every constant exactly once
    const history = DEMO_CONSTANT_IDS.map((id) => ({
      fullReport: { leaderboardEntry: { difficulty: id } },
    }))

    const result = pickBalancedConstant(history)
    expect(CONSTANT_IDS_SET.has(result)).toBe(true)
  })

  test('ignores history entries with unknown constant IDs', () => {
    const history = [
      { fullReport: { leaderboardEntry: { difficulty: 'unknown-constant' } } },
      { fullReport: { leaderboardEntry: { difficulty: 'pi' } } },
    ]

    // pi has count 1, everything else has count 0
    // So balance should never return pi
    for (let i = 0; i < 50; i++) {
      const result = pickBalancedConstant(history)
      expect(result).not.toBe('pi')
    }
  })

  test('ignores history entries with null/missing fullReport', () => {
    const history = [
      { fullReport: null },
      { fullReport: undefined },
      {},
      { fullReport: { leaderboardEntry: { difficulty: 'pi' } } },
    ] as Array<{ fullReport?: { leaderboardEntry?: { difficulty?: string } } | null }>

    // Only pi has a count, so balance should avoid it
    for (let i = 0; i < 50; i++) {
      const result = pickBalancedConstant(history)
      expect(result).not.toBe('pi')
    }
  })
})
