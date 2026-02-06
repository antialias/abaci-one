"use client";

import type { ReactNode } from "react";
import { useMemo, useCallback } from "react";
import { GameModeProvider, type RoomData } from "@/contexts/GameModeContext";
import { GameCompletionProvider } from "@/contexts/GameCompletionContext";
import type { Player as DBPlayer } from "@/db/schema/players";
import { useViewerId } from "@/hooks/useViewerId";

interface StudentInfo {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface PracticeGameModeProviderProps {
  student: StudentInfo;
  roomData: RoomData | null;
  children: ReactNode;
  /**
   * Callback fired when the game transitions to 'results' phase.
   *
   * This enables the practice system to detect when a student finishes a game
   * and end the game break early (before the timer expires).
   *
   * The callback receives the full game state so the caller can generate
   * a results report using the game's validator.getResultsReport() method.
   *
   * Note: Not all games have a 'results' phase. Endless games (e.g., complement-race)
   * will only end via timeout or manual skip. This is expected behavior.
   *
   * @param gameState The final game state when transitioning to 'results'
   * @see docs in .claude/ARCADE_ROOM_ARCHITECTURE.md for the full protocol
   */
  onGameComplete?: (gameState: Record<string, unknown>) => void;
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
  const { data: viewerId } = useViewerId();

  // Game completion is now detected via GameCompletionContext.
  // The matching Provider (or any game provider) calls the completion callback
  // when transitioning to 'results' phase, so we don't need our own socket.
  const handleGameComplete = useCallback(
    (gameState: Record<string, unknown>) => {
      onGameComplete?.(gameState);
    },
    [onGameComplete],
  );

  // Use viewerId as the player ID so it matches the server-side fallback.
  // The server creates sessions with roomPlayerIds = [userId] (viewerId) when no
  // DB players exist. Using viewerId here ensures client and server agree on the
  // player ID from the start, avoiding "player not found" warnings.
  const playerId = viewerId ?? "practice-user";

  // Create a fake DBPlayer from the practice student
  const dbPlayers: DBPlayer[] = useMemo(
    () => [
      {
        id: playerId,
        userId: playerId,
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
    [student, playerId],
  );

  // Inject the fake player into roomData.memberPlayers
  // This is necessary because getRoomActivePlayers() queries the DB,
  // but our practice student isn't a real DB player.
  const enrichedRoomData: RoomData | null = useMemo(() => {
    if (!roomData) return roomData;

    return {
      ...roomData,
      memberPlayers: {
        ...roomData.memberPlayers,
        [playerId]: [
          {
            id: playerId,
            name: student.name,
            emoji: student.emoji,
            color: student.color,
          },
        ],
      },
    };
  }, [roomData, playerId, student]);

  // No-op mutations - we don't want to modify player data during game breaks
  const createPlayer = useCallback(() => {}, []);
  const updatePlayerMutation = useCallback(() => {}, []);
  const deletePlayer = useCallback(() => {}, []);
  const notifyRoomOfPlayerUpdate = useCallback(() => {}, []);

  return (
    <GameCompletionProvider onGameComplete={handleGameComplete}>
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
    </GameCompletionProvider>
  );
}
