import { useEffect, useState } from 'react'
import {
  getAllGames,
  getAvailableGames,
  ensureAllGamesRegistered,
} from '@/lib/arcade/game-registry'
import type { GameDefinition } from '@/lib/arcade/game-sdk/types'

/**
 * Returns all registered games, including lazy-loaded heavy games.
 * Triggers a re-render once lazy games finish registering.
 */
export function useAllGames(): GameDefinition<any, any, any>[] {
  const [, setReady] = useState(false)

  useEffect(() => {
    ensureAllGamesRegistered().then(() => setReady(true))
  }, [])

  return getAllGames()
}

/**
 * Returns all available (available: true) games, including lazy-loaded ones.
 * Triggers a re-render once lazy games finish registering.
 */
export function useAvailableGames(): GameDefinition<any, any, any>[] {
  const [, setReady] = useState(false)

  useEffect(() => {
    ensureAllGamesRegistered().then(() => setReady(true))
  }, [])

  return getAvailableGames()
}
