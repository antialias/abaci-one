'use client'

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { CONSTANT_IDS } from '@/components/toys/number-line/talkToNumber/explorationRegistry'
import { useGameMode } from '@/contexts/GameModeContext'
import { usePlayerGameHistory } from '@/hooks/useGameResults'

/** All constant IDs that have demos + narration available */
const DEMO_CONSTANT_IDS = [...CONSTANT_IDS]

function pickRandomConstant(): string {
  return DEMO_CONSTANT_IDS[Math.floor(Math.random() * DEMO_CONSTANT_IDS.length)]
}

/**
 * Pick a constant the student has watched least.
 * Counts plays per constant from game history, then picks randomly
 * from the set with the lowest count (including 0 for never-watched).
 */
function pickBalancedConstant(
  history: Array<{ fullReport?: { leaderboardEntry?: { difficulty?: string } } | null }> | undefined
): string {
  // Count how many times each constant has been watched
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

  // Find the minimum count
  let minCount = Infinity
  for (const count of counts.values()) {
    if (count < minCount) minCount = count
  }

  // Collect all constants with that minimum count
  const leastWatched: string[] = []
  for (const [id, count] of counts) {
    if (count === minCount) leastWatched.push(id)
  }

  // Pick randomly from the least-watched set
  return leastWatched[Math.floor(Math.random() * leastWatched.length)]
}

function resolveConstantId(
  raw: unknown,
  history: Array<{ fullReport?: { leaderboardEntry?: { difficulty?: string } } | null }> | undefined
): string {
  if (typeof raw === 'string') {
    if (raw === 'balance') return pickBalancedConstant(history)
    if (raw !== 'random' && CONSTANT_IDS.has(raw)) return raw
  }
  return pickRandomConstant()
}

const ConstantExplorerContext = createContext<{ constantId: string }>({
  constantId: 'pi',
})

export function useConstantExplorerConfig() {
  return useContext(ConstantExplorerContext)
}

/**
 * Provider for the constant-explorer "game".
 *
 * Reads constantId from roomData.gameConfig (set by the teacher in the
 * start-practice modal), resolving 'random'/'balance' to a concrete constant.
 * For 'balance', queries the player's game history to find least-watched constants.
 */
export function ConstantExplorerProvider({ children }: { children: ReactNode }) {
  const { getActivePlayers, roomData } = useGameMode()

  // Get player ID for history query
  const playerId = useMemo(() => {
    const players = getActivePlayers()
    return players[0]?.id ?? null
  }, [getActivePlayers])

  // Query this player's constant-explorer history (for balance mode)
  const { data: historyData } = usePlayerGameHistory(playerId, {
    gameName: 'constant-explorer',
    limit: 200, // Enough to cover many sessions
  })

  const value = useMemo(() => {
    const gameConfig = roomData?.gameConfig as Record<string, unknown> | null | undefined
    const explorerConfig = gameConfig?.['constant-explorer'] as Record<string, unknown> | undefined
    const constantId = resolveConstantId(
      explorerConfig?.constantId,
      historyData?.history as
        | Array<{
            fullReport?: { leaderboardEntry?: { difficulty?: string } } | null
          }>
        | undefined
    )
    return { constantId }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once when history loads
  }, [roomData?.gameConfig, historyData])

  return (
    <ConstantExplorerContext.Provider value={value}>{children}</ConstantExplorerContext.Provider>
  )
}
