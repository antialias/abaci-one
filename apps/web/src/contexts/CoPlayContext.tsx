'use client'

import { createContext, useContext } from 'react'

/**
 * Context for co-play mode (observer joining a game as a participant).
 *
 * When present, game Providers that support drop-in co-play should
 * auto-send a JOIN_GAME move for the observer when the session loads.
 */
export interface CoPlayInfo {
  /** Observer's player ID (their user ID) */
  playerId: string
  /** Observer's display name */
  playerName: string
  /** Observer's emoji */
  emoji: string
  /** Observer's color */
  color: string
}

const CoPlayContext = createContext<CoPlayInfo | null>(null)

export function CoPlayProvider({
  info,
  children,
}: {
  info: CoPlayInfo
  children: React.ReactNode
}) {
  return <CoPlayContext.Provider value={info}>{children}</CoPlayContext.Provider>
}

/**
 * Returns co-play info if the current viewer is a co-play participant.
 * Returns null if in normal play or spectator mode.
 */
export function useCoPlayInfo(): CoPlayInfo | null {
  return useContext(CoPlayContext)
}
