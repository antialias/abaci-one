'use client'

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import type { Player as DBPlayer } from '@/db/schema/players'
import {
  useCreatePlayer,
  useDeletePlayer,
  useUpdatePlayer,
  useUserPlayers,
} from '@/hooks/useUserPlayers'
import { useRoomData } from '@/hooks/useRoomData'
import { useViewerId } from '@/hooks/useViewerId'
import { getNextPlayerColor } from '../types/player'

// Client-side Player type (compatible with old type)
export interface Player {
  id: string
  name: string
  emoji: string
  color: string
  createdAt: Date | number
  isActive?: boolean
  isLocal?: boolean
}

export type GameMode = 'single' | 'battle' | 'tournament'

export interface GameModeContextType {
  gameMode: GameMode // Computed from activePlayerCount
  players: Map<string, Player>
  activePlayers: Set<string>
  activePlayerCount: number
  addPlayer: (player?: Partial<Player>) => void
  updatePlayer: (id: string, updates: Partial<Player>) => void
  removePlayer: (id: string) => void
  setActive: (id: string, active: boolean) => void
  getActivePlayers: () => Player[]
  getPlayer: (id: string) => Player | undefined
  getAllPlayers: () => Player[]
  resetPlayers: () => void
  isLoading: boolean
}

const GameModeContext = createContext<GameModeContextType | null>(null)

// Default players to create if none exist
const DEFAULT_PLAYERS = [
  { name: 'Player 1', emoji: '😀', color: '#3b82f6' },
  { name: 'Player 2', emoji: '😎', color: '#8b5cf6' },
  { name: 'Player 3', emoji: '🤠', color: '#10b981' },
  { name: 'Player 4', emoji: '🚀', color: '#f59e0b' },
]

// Convert DB player to client Player type
function toClientPlayer(dbPlayer: DBPlayer): Player {
  return {
    id: dbPlayer.id,
    name: dbPlayer.name,
    emoji: dbPlayer.emoji,
    color: dbPlayer.color,
    createdAt: dbPlayer.createdAt,
    isActive: dbPlayer.isActive,
  }
}

export function GameModeProvider({ children }: { children: ReactNode }) {
  const { data: dbPlayers = [], isLoading } = useUserPlayers()
  const { mutate: createPlayer } = useCreatePlayer()
  const { mutate: updatePlayerMutation } = useUpdatePlayer()
  const { mutate: deletePlayer } = useDeletePlayer()
  const { roomData, notifyRoomOfPlayerUpdate } = useRoomData()
  const { data: viewerId } = useViewerId()

  const [isInitialized, setIsInitialized] = useState(false)

  // Convert DB players to Map (local players)
  const localPlayers = useMemo(() => {
    const map = new Map<string, Player>()
    dbPlayers.forEach((dbPlayer) => {
      map.set(dbPlayer.id, {
        ...toClientPlayer(dbPlayer),
        isLocal: true,
      })
    })
    return map
  }, [dbPlayers])

  // When in a room, merge all players from all room members
  const players = useMemo(() => {
    const map = new Map<string, Player>(localPlayers)

    if (roomData?.memberPlayers) {
      // Add players from other room members (marked as remote)
      Object.entries(roomData.memberPlayers).forEach(([userId, memberPlayers]) => {
        // Skip the current user's players (already in localPlayers)
        if (userId === viewerId) return

        memberPlayers.forEach((roomPlayer) => {
          map.set(roomPlayer.id, {
            id: roomPlayer.id,
            name: roomPlayer.name,
            emoji: roomPlayer.emoji,
            color: roomPlayer.color,
            createdAt: Date.now(),
            isActive: true, // Players in memberPlayers are active
            isLocal: false, // Remote player
          })
        })
      })
    }

    return map
  }, [localPlayers, roomData, viewerId])

  // Track active players (local + room members when in a room)
  const activePlayers = useMemo(() => {
    const set = new Set<string>()

    if (roomData?.memberPlayers) {
      // In room mode: all players from all members are active
      Object.values(roomData.memberPlayers).forEach((memberPlayers) => {
        memberPlayers.forEach((player) => {
          set.add(player.id)
        })
      })
    } else {
      // Solo mode: only local active players
      dbPlayers.forEach((player) => {
        if (player.isActive) {
          set.add(player.id)
        }
      })
    }

    return set
  }, [dbPlayers, roomData])

  // Initialize with default players if none exist
  useEffect(() => {
    if (!isLoading && !isInitialized) {
      if (dbPlayers.length === 0) {
        // Create default players
        DEFAULT_PLAYERS.forEach((data, index) => {
          createPlayer({
            ...data,
            isActive: index === 0, // First player active by default
          })
        })
        console.log('✅ Created default players via API')
      } else {
        console.log('✅ Loaded players from API', {
          playerCount: dbPlayers.length,
          activeCount: dbPlayers.filter((p) => p.isActive).length,
        })
      }
      setIsInitialized(true)
    }
  }, [dbPlayers, isLoading, isInitialized, createPlayer])

  const addPlayer = (playerData?: Partial<Player>) => {
    const playerList = Array.from(players.values())

    const newPlayer = {
      name: playerData?.name ?? `Player ${players.size + 1}`,
      emoji: playerData?.emoji ?? '🎮',
      color: playerData?.color ?? getNextPlayerColor(playerList),
      isActive: playerData?.isActive ?? false,
    }

    createPlayer(newPlayer, {
      onSuccess: () => {
        // Notify room members if in a room
        notifyRoomOfPlayerUpdate()
      },
    })
  }

  const updatePlayer = (id: string, updates: Partial<Player>) => {
    const player = players.get(id)
    // Only allow updating local players
    if (player?.isLocal) {
      updatePlayerMutation(
        { id, updates },
        {
          onSuccess: () => {
            // Notify room members if in a room
            notifyRoomOfPlayerUpdate()
          },
        }
      )
    } else {
      console.warn('[GameModeContext] Cannot update remote player:', id)
    }
  }

  const removePlayer = (id: string) => {
    const player = players.get(id)
    // Only allow removing local players
    if (player?.isLocal) {
      deletePlayer(id, {
        onSuccess: () => {
          // Notify room members if in a room
          notifyRoomOfPlayerUpdate()
        },
      })
    } else {
      console.warn('[GameModeContext] Cannot remove remote player:', id)
    }
  }

  const setActive = (id: string, active: boolean) => {
    const player = players.get(id)
    // Only allow changing active status of local players
    if (player?.isLocal) {
      updatePlayerMutation(
        { id, updates: { isActive: active } },
        {
          onSuccess: () => {
            // Notify room members if in a room
            notifyRoomOfPlayerUpdate()
          },
        }
      )
    } else {
      console.warn('[GameModeContext] Cannot change active status of remote player:', id)
    }
  }

  const getActivePlayers = (): Player[] => {
    return Array.from(activePlayers)
      .map((id) => players.get(id))
      .filter((p): p is Player => p !== undefined)
  }

  const getPlayer = (id: string): Player | undefined => {
    return players.get(id)
  }

  const getAllPlayers = (): Player[] => {
    return Array.from(players.values())
  }

  const resetPlayers = () => {
    // Delete all existing players
    dbPlayers.forEach((player) => {
      deletePlayer(player.id)
    })

    // Create default players
    DEFAULT_PLAYERS.forEach((data, index) => {
      createPlayer({
        ...data,
        isActive: index === 0,
      })
    })

    // Notify room members after reset (slight delay to ensure mutations complete)
    setTimeout(() => {
      notifyRoomOfPlayerUpdate()
    }, 100)
  }

  const activePlayerCount = activePlayers.size

  // Compute game mode from active player count
  const gameMode: GameMode =
    activePlayerCount === 1
      ? 'single'
      : activePlayerCount === 2
        ? 'battle'
        : activePlayerCount >= 3
          ? 'tournament'
          : 'single'

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
    isLoading,
  }

  return <GameModeContext.Provider value={contextValue}>{children}</GameModeContext.Provider>
}

export function useGameMode(): GameModeContextType {
  const context = useContext(GameModeContext)
  if (!context) {
    throw new Error('useGameMode must be used within a GameModeProvider')
  }
  return context
}
