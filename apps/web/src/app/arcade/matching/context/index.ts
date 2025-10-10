/**
 * Central export point for arcade matching game context
 * Re-exports the hook from the appropriate provider
 */

// Export the hook (works with both local and room providers)
export { useMemoryPairs } from "./MemoryPairsContext";

// Export the room provider (networked multiplayer)
export { RoomMemoryPairsProvider } from "./RoomMemoryPairsProvider";

// Export types
export type {
  GameCard,
  GameMode,
  GamePhase,
  GameType,
  MemoryPairsState,
  MemoryPairsContextValue,
} from "./types";
