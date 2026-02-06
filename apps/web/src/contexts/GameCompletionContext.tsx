'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'

type GameCompleteCallback = (gameState: Record<string, unknown>) => void

const GameCompletionContext = createContext<GameCompleteCallback | null>(null)

/**
 * Provides a game completion callback that game providers can call
 * when transitioning to the 'results' phase.
 *
 * Used by PracticeGameModeProvider to detect game completion
 * without needing a separate socket connection.
 */
export function GameCompletionProvider({
  onGameComplete,
  children,
}: {
  onGameComplete: GameCompleteCallback
  children: ReactNode
}) {
  // Use ref to avoid re-renders when callback identity changes
  const callbackRef = useRef(onGameComplete)
  callbackRef.current = onGameComplete

  // Stable callback that reads from ref
  const stableCallback = useRef<GameCompleteCallback>((gameState) => {
    callbackRef.current(gameState)
  }).current

  return (
    <GameCompletionContext.Provider value={stableCallback}>
      {children}
    </GameCompletionContext.Provider>
  )
}

/**
 * Returns the game completion callback if available (i.e., inside a GameCompletionProvider).
 * Returns null if not in a practice/game-break context.
 */
export function useGameCompletionCallback(): GameCompleteCallback | null {
  return useContext(GameCompletionContext)
}
