"use client";

/**
 * GameModeProviderWithHooks - Wrapper that wires up hooks to GameModeProvider
 *
 * This file exists to break the import chain for bundle splitting:
 * - GameModeContext.tsx has NO hook imports (small chunk, shared by default context)
 * - This file imports the hooks (only loaded by arcade pages)
 *
 * Practice pages don't import this file, so they don't pull in:
 * - useUserPlayers (and its dependencies)
 * - useRoomData (and socket.io client)
 * - useViewerId
 */

import type { ReactNode } from "react";
import { useRoomData } from "@/hooks/useRoomData";
import {
  useCreatePlayer,
  useDeletePlayer,
  useUpdatePlayer,
  useUserPlayers,
} from "@/hooks/useUserPlayers";
import { useViewerId } from "@/hooks/useViewerId";
import { GameModeProvider } from "./GameModeContext";

interface GameModeProviderWithHooksProps {
  children: ReactNode;
}

export function GameModeProviderWithHooks({
  children,
}: GameModeProviderWithHooksProps) {
  // All hooks are called here, keeping them out of GameModeContext.tsx
  const { data: dbPlayers = [], isLoading } = useUserPlayers();
  const { mutate: createPlayer } = useCreatePlayer();
  const { mutate: updatePlayerMutation } = useUpdatePlayer();
  const { mutate: deletePlayer } = useDeletePlayer();
  const { roomData, notifyRoomOfPlayerUpdate } = useRoomData();
  const { data: viewerId } = useViewerId();

  return (
    <GameModeProvider
      dbPlayers={dbPlayers}
      isLoading={isLoading}
      createPlayer={createPlayer}
      updatePlayerMutation={updatePlayerMutation}
      deletePlayer={deletePlayer}
      roomData={roomData}
      notifyRoomOfPlayerUpdate={notifyRoomOfPlayerUpdate}
      viewerId={viewerId}
    >
      {children}
    </GameModeProvider>
  );
}
