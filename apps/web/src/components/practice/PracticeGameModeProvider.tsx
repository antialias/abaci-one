'use client'

import type { ReactNode } from 'react'
import { useMemo, useCallback, useEffect, useRef } from 'react'
import { GameModeProvider, type RoomData } from '@/contexts/GameModeContext'
import type { Player as DBPlayer } from '@/db/schema/players'
import { useViewerId } from '@/hooks/useViewerId'
import { useArcadeSocket } from '@/hooks/useArcadeSocket'

interface StudentInfo {
  id: string
  name: string
  emoji: string
  color: string
}

interface PracticeGameModeProviderProps {
  student: StudentInfo
  roomData: RoomData | null
  children: ReactNode
  /**
   * Callback fired when the game transitions to 'results' phase.
   *
   * This enables the practice system to detect when a student finishes a game
   * and end the game break early (before the timer expires).
   *
   * Note: Not all games have a 'results' phase. Endless games (e.g., complement-race)
   * will only end via timeout or manual skip. This is expected behavior.
   *
   * @see docs in .claude/ARCADE_ROOM_ARCHITECTURE.md for the full protocol
   */
  onGameComplete?: () => void
}

/**
 * Wraps GameModeProvider with fake player data for practice game breaks.
 *
 * The arcade system normally loads players from the database via getRoomActivePlayers().
 * But practice students aren't real DB players - they're curriculum players.
 *
 * This provider:
 * 1. Creates a fake DBPlayer from the student info
 * 2. Injects that player into roomData.memberPlayers so GameModeContext sees them
 * 3. Provides no-op mutations (we don't want to modify player data during game breaks)
 * 4. Listens for game completion (transition to 'results' phase) to notify parent
 */
export function PracticeGameModeProvider({
  student,
  roomData,
  children,
  onGameComplete,
}: PracticeGameModeProviderProps) {
  const { data: viewerId } = useViewerId()

  // Track previous game phase to detect transitions
  const previousPhaseRef = useRef<string | null>(null)
  const hasNotifiedCompletionRef = useRef(false)
  const onGameCompleteRef = useRef(onGameComplete)
  onGameCompleteRef.current = onGameComplete

  // Listen for game state changes to detect completion
  // Note: We listen to BOTH session-state (initial join) and move-accepted (during gameplay)
  // because session-state is only sent on join, while move-accepted contains state updates
  const handleStateUpdate = useCallback((gameState: { gamePhase?: string } | null) => {
    const currentPhase = gameState?.gamePhase ?? null

    // Detect transition TO 'results' phase (not already in results)
    if (
      currentPhase === 'results' &&
      previousPhaseRef.current !== 'results' &&
      !hasNotifiedCompletionRef.current
    ) {
      hasNotifiedCompletionRef.current = true
      onGameCompleteRef.current?.()
    }

    previousPhaseRef.current = currentPhase
  }, [])

  const handleSessionState = useCallback(
    (data: { gameState: unknown }) => {
      handleStateUpdate(data.gameState as { gamePhase?: string } | null)
    },
    [handleStateUpdate]
  )

  const handleMoveAccepted = useCallback(
    (data: { gameState: unknown }) => {
      handleStateUpdate(data.gameState as { gamePhase?: string } | null)
    },
    [handleStateUpdate]
  )

  // Reset completion tracking when roomData changes (new game session)
  useEffect(() => {
    hasNotifiedCompletionRef.current = false
    previousPhaseRef.current = null
  }, [roomData?.id])

  // Connect to arcade socket to listen for game state updates
  const { joinSession, socket } = useArcadeSocket({
    onSessionState: handleSessionState,
    onMoveAccepted: handleMoveAccepted,
    // Suppress error toasts - we don't want arcade errors during practice
    suppressErrorToasts: true,
  })

  // Join the arcade session to receive state updates
  // The game's Provider also joins, but we need our socket to join too
  // to receive the session-state events for game completion detection
  useEffect(() => {
    if (viewerId && roomData?.id && socket) {
      joinSession(viewerId, roomData.id)
    }
  }, [viewerId, roomData?.id, socket, joinSession])

  // Create a fake DBPlayer from the practice student
  const dbPlayers: DBPlayer[] = useMemo(
    () => [
      {
        id: student.id,
        userId: viewerId ?? 'practice-user',
        name: student.name,
        emoji: student.emoji,
        color: student.color,
        isActive: true,
        createdAt: new Date(),
        helpSettings: null,
        notes: null,
        isArchived: false,
        familyCode: null,
      },
    ],
    [student, viewerId]
  )

  // Inject the fake player into roomData.memberPlayers
  // This is necessary because getRoomActivePlayers() queries the DB,
  // but our practice student isn't a real DB player.
  const enrichedRoomData: RoomData | null = useMemo(() => {
    if (!roomData || !viewerId) return roomData

    return {
      ...roomData,
      memberPlayers: {
        ...roomData.memberPlayers,
        [viewerId]: [
          {
            id: student.id,
            name: student.name,
            emoji: student.emoji,
            color: student.color,
          },
        ],
      },
    }
  }, [roomData, viewerId, student])

  // No-op mutations - we don't want to modify player data during game breaks
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
