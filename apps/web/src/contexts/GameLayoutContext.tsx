'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Context to control game layout behavior.
 *
 * In the arcade, games use StandardGameLayout which fills 100vh and calculates
 * nav padding. But in practice game breaks, the game is rendered inside a
 * pre-positioned container that already accounts for navs.
 *
 * This context tells StandardGameLayout whether to use:
 * - 'viewport' (default): height: 100vh, calculate nav padding
 * - 'container': height: 100%, no nav padding (parent handles positioning)
 */
type GameLayoutMode = 'viewport' | 'container'

const GameLayoutContext = createContext<GameLayoutMode>('viewport')

interface GameLayoutProviderProps {
  children: ReactNode
  /** Layout mode: 'viewport' for arcade, 'container' for practice game breaks */
  mode: GameLayoutMode
}

export function GameLayoutProvider({ children, mode }: GameLayoutProviderProps) {
  return <GameLayoutContext.Provider value={mode}>{children}</GameLayoutContext.Provider>
}

export function useGameLayoutMode(): GameLayoutMode {
  return useContext(GameLayoutContext)
}
