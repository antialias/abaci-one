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
  gameMode: GameMode
  players: PlayerConfig[]
  activePlayerCount: number
  setGameMode: (mode: GameMode) => void
  setGameModeWithPlayers: (mode: GameMode) => void
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

const STORAGE_KEY = 'soroban-game-mode-config'

const GameModeContext = createContext<GameModeContextType | null>(null)

export function GameModeProvider({ children }: { children: ReactNode }) {
  const [gameMode, setGameModeState] = useState<GameMode>('single')
  const [players, setPlayers] = useState<PlayerConfig[]>(defaultPlayers)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load configuration from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const config = JSON.parse(stored)
          setGameModeState(config.gameMode || 'single')
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
        const config = { gameMode, players }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      } catch (error) {
        console.warn('Failed to save game mode config to localStorage:', error)
      }
    }
  }, [gameMode, players, isInitialized])

  const setGameMode = (mode: GameMode) => {
    setGameModeState(mode)
    // Note: Player activation is now handled by the ChampionArena component
    // to allow for drag-and-drop control
  }

  const setGameModeWithPlayers = (mode: GameMode) => {
    setGameModeState(mode)

    // Auto-configure active players based on mode (for non-arena usage)
    setPlayers(prevPlayers => prevPlayers.map(player => ({
      ...player,
      isActive: mode === 'single'
        ? player.id === 1
        : mode === 'battle'
        ? player.id <= 2
        : player.id <= 4 // tournament mode
    })))
  }

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
    setGameModeState('single')
  }

  const activePlayerCount = players.filter(player => player.isActive).length

  const contextValue: GameModeContextType = {
    gameMode,
    players,
    activePlayerCount,
    setGameMode,
    setGameModeWithPlayers,
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