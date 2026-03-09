'use client'

import { createContext, useContext } from 'react'

interface ArcadeSessionStateContextType {
  /** Whether authoritative server state has been received at least once */
  hasReceivedServerState: boolean
}

/**
 * Context for exposing arcade session state signals to parent components.
 *
 * Game Providers publish hasReceivedServerState here so that framework-level
 * components (like GameBreakSpectatorView) can show a loading gate until
 * the game has received its initial server state.
 *
 * Default value is true so that non-spectator usage (normal arcade play)
 * works without any wrapping Provider — the gate passes through immediately.
 */
export const ArcadeSessionStateContext = createContext<ArcadeSessionStateContextType>({
  hasReceivedServerState: true,
})

export function useArcadeSessionState() {
  return useContext(ArcadeSessionStateContext)
}
