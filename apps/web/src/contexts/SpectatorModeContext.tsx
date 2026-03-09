'use client'

import { createContext, useContext } from 'react'

/**
 * When true, the game is being rendered in read-only spectator mode.
 * Components should skip ALL interaction setup:
 * - No pointer lock requests
 * - No window/document-level keyboard listeners
 * - No mouse move handlers that dispatch state changes
 * - No sending moves or cursor updates
 */
const SpectatorModeContext = createContext(false)

export function SpectatorModeProvider({ children }: { children: React.ReactNode }) {
  return <SpectatorModeContext.Provider value={true}>{children}</SpectatorModeContext.Provider>
}

export function useIsSpectator(): boolean {
  return useContext(SpectatorModeContext)
}
