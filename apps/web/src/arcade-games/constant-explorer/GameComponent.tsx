'use client'

import { useCallback, useRef } from 'react'
import { NumberLine } from '@/components/toys/number-line/NumberLine'
import { useGameCompletionCallback } from '@/contexts/GameCompletionContext'
import { useGameMode } from '@/contexts/GameModeContext'
import { useConstantExplorerConfig } from './Provider'
import type { ConstantExplorerState } from './types'

/**
 * Renders the NumberLine in exploration-break mode.
 * Signals game completion when the demo narration finishes so that
 * results are persisted to the scoreboard (enabling "balance" selection).
 */
export function ConstantExplorerGame() {
  const { constantId } = useConstantExplorerConfig()
  const onGameComplete = useGameCompletionCallback()
  const { getActivePlayers } = useGameMode()
  const startedAtRef = useRef(Date.now())
  const hasFiredRef = useRef(false)

  const handleDemoComplete = useCallback(
    (completedConstantId: string) => {
      if (hasFiredRef.current || !onGameComplete) return
      hasFiredRef.current = true

      const players = getActivePlayers()
      const player = players[0]

      const gameState: ConstantExplorerState = {
        constantId: completedConstantId,
        phase: 'complete',
        playerId: player?.id,
        playerName: player?.name,
        startedAt: startedAtRef.current,
      }

      onGameComplete(gameState as unknown as Record<string, unknown>)
    },
    [onGameComplete, getActivePlayers]
  )

  return (
    <NumberLine
      mode="exploration-break"
      autoPlayDemo={constantId}
      onDemoComplete={handleDemoComplete}
    />
  )
}
