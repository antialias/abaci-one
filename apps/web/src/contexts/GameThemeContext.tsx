'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export interface GameTheme {
  gameName: string
  backgroundColor: string
}

interface GameThemeContextType {
  theme: GameTheme | null
  setTheme: (theme: GameTheme | null) => void
}

const GameThemeContext = createContext<GameThemeContextType | undefined>(undefined)

export function GameThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<GameTheme | null>(null)

  return (
    <GameThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </GameThemeContext.Provider>
  )
}

export function useGameTheme() {
  const context = useContext(GameThemeContext)
  if (context === undefined) {
    throw new Error('useGameTheme must be used within a GameThemeProvider')
  }
  return context
}