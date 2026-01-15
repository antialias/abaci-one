"use client";

import dynamic from "next/dynamic";

// Dynamic import breaks webpack's import chain, preventing useRoomData
// from being bundled with useUserPlayers in shared chunks
const GameModeProviderWithHooks = dynamic(
  () =>
    import("@/contexts/GameModeProviderWithHooks").then(
      (m) => m.GameModeProviderWithHooks,
    ),
  { ssr: false },
);

/**
 * Arcade Rooms Layout - wrapper for arcade room pages
 *
 * Uses GameModeProviderWithHooks which imports the player/room hooks.
 * This keeps those heavy imports out of GameModeContext.tsx, allowing
 * practice pages (which don't use this layout) to avoid loading them.
 */
export default function ArcadeRoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <GameModeProviderWithHooks>{children}</GameModeProviderWithHooks>;
}
