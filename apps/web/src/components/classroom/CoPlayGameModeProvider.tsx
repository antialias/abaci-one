'use client'

import type { ReactNode } from 'react'
import { useMemo, useCallback } from 'react'
import { GameModeProvider } from '@/contexts/GameModeContext'
import type { Player as DBPlayer } from '@/db/schema/players'
import { useRoomData } from '@/hooks/useRoomData'
import { useUserId } from '@/hooks/useUserId'

interface CoPlayPlayerInfo {
  name: string
  emoji: string
  color: string
}

interface CoPlayGameModeProviderProps {
  /** Observer's user ID — used as the player ID in game state */
  observerId: string
  /** Observer's co-play profile (name, emoji, color) */
  player: CoPlayPlayerInfo
  children: ReactNode
}

/**
 * Wraps GameModeProvider with a synthetic player for observer co-play.
 *
 * Similar to PracticeGameModeProvider, but for observers (teachers/parents)
 * joining a student's game break as a participant. Creates a fake DBPlayer
 * from the observer's co-play profile and injects it into the room data.
 *
 * Calls useRoomData() internally (like GameModeProviderWithHooks) so it
 * automatically picks up room state after the observer joins.
 */
export function CoPlayGameModeProvider({
  observerId,
  player,
  children,
}: CoPlayGameModeProviderProps) {
  const { data: viewerId } = useUserId()
  const { roomData } = useRoomData()

  // Use the observer's user ID as the player ID.
  // This must match the ID used in additionalPlayers for join-at-start games.
  const playerId = observerId

  // Create a synthetic DBPlayer from the co-play profile
  const dbPlayers: DBPlayer[] = useMemo(
    () => [
      {
        id: playerId,
        userId: playerId,
        name: player.name,
        emoji: player.emoji,
        color: player.color,
        isActive: true,
        createdAt: new Date(),
        helpSettings: null,
        notes: null,
        isArchived: false,
        isPracticeStudent: false,
        isExpungeable: false,
        birthday: null,
        familyCode: null,
        familyCodeGeneratedAt: null,
      },
    ],
    [player, playerId]
  )

  // Inject the synthetic player into roomData.memberPlayers
  const enrichedRoomData = useMemo(() => {
    if (!roomData) return roomData

    return {
      ...roomData,
      memberPlayers: {
        ...roomData.memberPlayers,
        [playerId]: [
          {
            id: playerId,
            name: player.name,
            emoji: player.emoji,
            color: player.color,
          },
        ],
      },
    }
  }, [roomData, playerId, player])

  // No-op mutations — observers can't modify player data
  const createPlayer = useCallback(() => {}, [])
  const updatePlayerMutation = useCallback(() => {}, [])
  const deletePlayer = useCallback(() => {}, [])
  const notifyRoomOfPlayerUpdate = useCallback(() => {}, [])

  return (
    <GameModeProvider
      dbPlayers={dbPlayers}
      isLoading={false}
      createPlayer={createPlayer}
      updatePlayerMutation={updatePlayerMutation}
      deletePlayer={deletePlayer}
      roomData={enrichedRoomData}
      notifyRoomOfPlayerUpdate={notifyRoomOfPlayerUpdate}
      viewerId={viewerId}
    >
      {children}
    </GameModeProvider>
  )
}
