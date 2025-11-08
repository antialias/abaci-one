import { useMemo } from "react";
import type { RosterWarning } from "@/components/nav/GameContextNav";
import { useGameMode } from "@/contexts/GameModeContext";
import {
  useDeactivatePlayer,
  useKickUser,
  useRoomData,
} from "@/hooks/useRoomData";
import { useViewerId } from "@/hooks/useViewerId";
import { useRithmomachia } from "../Provider";

export function useRosterWarning(
  phase: "setup" | "playing",
): RosterWarning | undefined {
  const { rosterStatus, whitePlayerId, blackPlayerId } = useRithmomachia();
  const {
    players: playerMap,
    activePlayers: activePlayerIds,
    addPlayer,
    setActive,
  } = useGameMode();
  const { roomData } = useRoomData();
  const { data: viewerId } = useViewerId();
  const { mutate: kickUser } = useKickUser();
  const { mutate: deactivatePlayer } = useDeactivatePlayer();

  return useMemo(() => {
    // Don't show notice for 'ok' or 'noLocalControl' (observers are allowed)
    if (
      rosterStatus.status === "ok" ||
      rosterStatus.status === "noLocalControl"
    ) {
      return undefined;
    }

    const playersArray = Array.from(playerMap.values()).sort((a, b) => {
      const aTime =
        typeof a.createdAt === "number"
          ? a.createdAt
          : a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : 0;
      const bTime =
        typeof b.createdAt === "number"
          ? b.createdAt
          : b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : 0;
      return aTime - bTime;
    });

    const isHost =
      roomData && viewerId
        ? roomData.members.find((m) => m.userId === viewerId)?.isCreator ===
          true
        : false;

    const removableLocalPlayers = playersArray.filter(
      (player) =>
        player.isLocal !== false &&
        activePlayerIds.has(player.id) &&
        player.id !== whitePlayerId &&
        player.id !== blackPlayerId,
    );

    const kickablePlayers =
      isHost && roomData
        ? playersArray.filter(
            (player) =>
              player.isLocal === false &&
              activePlayerIds.has(player.id) &&
              player.id !== whitePlayerId &&
              player.id !== blackPlayerId,
          )
        : [];

    const inactiveLocalPlayer = playersArray.find(
      (player) => player.isLocal !== false && !activePlayerIds.has(player.id),
    );

    const handleKick = (player: any) => {
      if (!roomData) return;
      for (const [userId, players] of Object.entries(roomData.memberPlayers)) {
        if (players.some((p) => p.id === player.id)) {
          kickUser({ roomId: roomData.id, userId });
          break;
        }
      }
    };

    if (rosterStatus.status === "tooFew") {
      // During setup, don't show nav banner - SetupPlayerRequirement panel handles this
      if (phase === "setup") {
        return undefined;
      }

      // During playing phase, show nav warning banner
      const actions = [];
      if (inactiveLocalPlayer) {
        actions.push({
          label: `Activate ${inactiveLocalPlayer.name}`,
          onClick: () => setActive(inactiveLocalPlayer.id, true),
        });
      } else {
        actions.push({
          label: "Create local player",
          onClick: () => addPlayer({ isActive: true }),
        });
      }

      return {
        heading: "Need two active players",
        description: "Gameplay is paused until two players are active.",
        actions,
      };
    }

    return undefined;
  }, [
    rosterStatus.status,
    phase,
    playerMap,
    activePlayerIds,
    whitePlayerId,
    blackPlayerId,
    roomData,
    viewerId,
    addPlayer,
    setActive,
    kickUser,
    deactivatePlayer,
  ]);
}
