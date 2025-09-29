'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type GameMode = 'single' | 'battle' | 'tournament'

export interface PlayerConfig {
  id: number
  name: string
  emoji: string
  color: string
  isActive: boolean
}

export interface GameModeContextType {
  gameMode: GameMode // Computed from activePlayerCount
  players: PlayerConfig[]
  activePlayerCount: number
  updatePlayer: (id: number, config: Partial<PlayerConfig>) => void
  getActivePlayer: (id: number) => PlayerConfig | undefined
  resetPlayers: () => void
}

const defaultPlayers: PlayerConfig[] = [
  {
    id: 1,
    name: 'Player 1',
    emoji: '😀',
    color: '#3b82f6', // Blue
    isActive: true
  },
  {
    id: 2,
    name: 'Player 2',
    emoji: '😎',
    color: '#8b5cf6', // Purple
    isActive: false
  },
  {
    id: 3,
    name: 'Player 3',
    emoji: '🤠',
    color: '#10b981', // Green
    isActive: false
  },
  {
    id: 4,
    name: 'Player 4',
    emoji: '🚀',
    color: '#f59e0b', // Orange
    isActive: false
  }
]

const STORAGE_KEY = 'soroban-game-mode-players'

const GameModeContext = createContext<GameModeContextType | null>(null)

export function GameModeProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<PlayerConfig[]>(defaultPlayers)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const config = JSON.parse(stored)
          setPlayers(config.players || defaultPlayers)
        }
        setIsInitialized(true)
      } catch (error) {
        console.warn('Failed to load game mode config from localStorage:', error)
        setIsInitialized(true)
      }
    }
  }, [])

  // Save configuration to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      try {
        const config = { players }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      } catch (error) {
        console.warn('Failed to save game mode config to localStorage:', error)
      }
    }
  }, [players, isInitialized])

  const updatePlayer = (id: number, config: Partial<PlayerConfig>) => {
    setPlayers(prevPlayers =>
      prevPlayers.map(player =>
        player.id === id ? { ...player, ...config } : player
      )
    )
  }

  const getActivePlayer = (id: number) => {
    return players.find(player => player.id === id && player.isActive)
  }

  const resetPlayers = () => {
    setPlayers(defaultPlayers)
  }

  const activePlayerCount = players.filter(player => player.isActive).length

  // Compute game mode from active player count
  const gameMode: GameMode = activePlayerCount === 1 ? 'single' :
                             activePlayerCount === 2 ? 'battle' :
                             activePlayerCount >= 3 ? 'tournament' : 'single'

  const contextValue: GameModeContextType = {
    gameMode,
    players,
    activePlayerCount,
    updatePlayer,
    getActivePlayer,
    resetPlayers
  }

  return (
    <GameModeContext.Provider value={contextValue}>
      {children}
    </GameModeContext.Provider>
  )
}

export function useGameMode(): GameModeContextType {
  const context = useContext(GameModeContext)
  if (!context) {
    throw new Error('useGameMode must be used within a GameModeProvider')
  }
  return context
}