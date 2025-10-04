'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { nanoid } from 'nanoid'
import { Player, PlayerStorageV2, getNextPlayerColor } from '../types/player'
import { loadPlayerStorage, savePlayerStorage } from '../lib/playerMigration'

export type GameMode = 'single' | 'battle' | 'tournament'

export interface GameModeContextType {
  gameMode: GameMode // Computed from activePlayerCount
  players: Map<string, Player>
  activePlayers: Set<string>
  activePlayerCount: number
  addPlayer: (player?: Partial<Player>) => string
  updatePlayer: (id: string, updates: Partial<Player>) => void
  removePlayer: (id: string) => void
  setActive: (id: string, active: boolean) => void
  getActivePlayers: () => Player[]
  getPlayer: (id: string) => Player | undefined
  getAllPlayers: () => Player[]
  resetPlayers: () => void
}

const GameModeContext = createContext<GameModeContextType | null>(null)

// Create initial default players
function createDefaultPlayers(): Map<string, Player> {
  const players = new Map<string, Player>()
  const defaultData = [
    { name: 'Player 1', emoji: '😀', color: '#3b82f6' },
    { name: 'Player 2', emoji: '😎', color: '#8b5cf6' },
    { name: 'Player 3', emoji: '🤠', color: '#10b981' },
    { name: 'Player 4', emoji: '🚀', color: '#f59e0b' },
  ]

  defaultData.forEach((data) => {
    const id = nanoid()
    players.set(id, {
      id,
      ...data,
      createdAt: Date.now(),
      isLocal: true,
    })
  })

  return players
}

export function GameModeProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Map<string, Player>>(new Map())
  const [activePlayers, setActivePlayers] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storage = loadPlayerStorage()

        if (storage) {
          // Load from V2 storage
          const playerMap = new Map<string, Player>()
          Object.values(storage.players).forEach(player => {
            playerMap.set(player.id, player)
          })

          setPlayers(playerMap)
          setActivePlayers(new Set(storage.activePlayerIds))
          console.log('✅ Loaded player storage (V2)', {
            playerCount: playerMap.size,
            activeCount: storage.activePlayerIds.length,
          })
        } else {
          // No storage, create defaults
          const defaultPlayers = createDefaultPlayers()
          const firstPlayerId = Array.from(defaultPlayers.keys())[0]

          setPlayers(defaultPlayers)
          setActivePlayers(new Set([firstPlayerId]))
          console.log('✅ Created default players', {
            playerCount: defaultPlayers.size,
          })
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to load player storage:', error)
        // Fallback to defaults
        const defaultPlayers = createDefaultPlayers()
        const firstPlayerId = Array.from(defaultPlayers.keys())[0]
        setPlayers(defaultPlayers)
        setActivePlayers(new Set([firstPlayerId]))
        setIsInitialized(true)
      }
    }
  }, [])

  // Save to storage whenever players or active players change
  useEffect(() => {
    if (typeof window !== 'undefined' && isInitialized) {
      try {
        const storage: PlayerStorageV2 = {
          version: 2,
          players: Object.fromEntries(players),
          activePlayerIds: Array.from(activePlayers),
          activationOrder: Object.fromEntries(
            Array.from(activePlayers).map((id, idx) => [id, idx])
          ),
        }

        savePlayerStorage(storage)
      } catch (error) {
        console.error('Failed to save player storage:', error)
      }
    }
  }, [players, activePlayers, isInitialized])

  const addPlayer = (playerData?: Partial<Player>): string => {
    const id = nanoid()
    const playerList = Array.from(players.values())

    const newPlayer: Player = {
      id,
      name: playerData?.name ?? `Player ${players.size + 1}`,
      emoji: playerData?.emoji ?? '🎮',
      color: playerData?.color ?? getNextPlayerColor(playerList),
      createdAt: playerData?.createdAt ?? Date.now(),
      isLocal: playerData?.isLocal ?? true,
      ...playerData,
    }

    setPlayers(prev => new Map(prev).set(id, newPlayer))
    return id
  }

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    setPlayers(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(id)
      if (existing) {
        newMap.set(id, { ...existing, ...updates })
      }
      return newMap
    })
  }

  const removePlayer = (id: string) => {
    setPlayers(prev => {
      const newMap = new Map(prev)
      newMap.delete(id)
      return newMap
    })

    // Also remove from active if was active
    setActivePlayers(prev => {
      const newSet = new Set(prev)
      newSet.delete(id)
      return newSet
    })
  }

  const setActive = (id: string, active: boolean) => {
    setActivePlayers(prev => {
      const newSet = new Set(prev)
      if (active) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }

  const getActivePlayers = (): Player[] => {
    return Array.from(activePlayers)
      .map(id => players.get(id))
      .filter((p): p is Player => p !== undefined)
  }

  const getPlayer = (id: string): Player | undefined => {
    return players.get(id)
  }

  const getAllPlayers = (): Player[] => {
    return Array.from(players.values())
  }

  const resetPlayers = () => {
    const defaultPlayers = createDefaultPlayers()
    const firstPlayerId = Array.from(defaultPlayers.keys())[0]

    setPlayers(defaultPlayers)
    setActivePlayers(new Set([firstPlayerId]))
  }

  const activePlayerCount = activePlayers.size

  // Compute game mode from active player count
  const gameMode: GameMode = activePlayerCount === 1 ? 'single' :
                             activePlayerCount === 2 ? 'battle' :
                             activePlayerCount >= 3 ? 'tournament' : 'single'

  const contextValue: GameModeContextType = {
    gameMode,
    players,
    activePlayers,
    activePlayerCount,
    addPlayer,
    updatePlayer,
    removePlayer,
    setActive,
    getActivePlayers,
    getPlayer,
    getAllPlayers,
    resetPlayers,
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
