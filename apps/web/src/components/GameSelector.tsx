"use client";

import { css } from "../../styled-system/css";
import { useGameMode } from "../contexts/GameModeContext";
import { GameCard } from "./GameCard";

// Game configuration defining player limits
export const GAMES_CONFIG = {
  "memory-lightning": {
    name: "Memory Lightning",
    fullName: "Memory Lightning ⚡",
    maxPlayers: 1,
    description: "Test your memory speed with rapid-fire abacus calculations",
    longDescription:
      "Challenge yourself with lightning-fast memory tests. Perfect your mental math skills with this intense solo experience.",
    url: "/arcade/memory-quiz",
    icon: "⚡",
    chips: ["⭐ Beginner Friendly", "🔥 Speed Challenge", "🧮 Abacus Focus"],
    color: "green",
    gradient: "linear-gradient(135deg, #dcfce7, #bbf7d0)",
    borderColor: "green.200",
    difficulty: "Beginner",
  },
  "battle-arena": {
    name: "Matching Pairs Battle",
    fullName: "Matching Pairs Battle ⚔️",
    maxPlayers: 4,
    description: "Multiplayer memory battle with friends",
    longDescription:
      "Battle friends in epic memory challenges. Match pairs faster than your opponents in this exciting multiplayer experience.",
    url: "/arcade/matching",
    icon: "⚔️",
    chips: ["👥 Multiplayer", "🎯 Strategic", "🏆 Competitive"],
    color: "purple",
    gradient: "linear-gradient(135deg, #e9d5ff, #ddd6fe)",
    borderColor: "purple.200",
    difficulty: "Intermediate",
  },
  "complement-race": {
    name: "Speed Complement Race",
    fullName: "Speed Complement Race 🏁",
    maxPlayers: 1,
    description: "Race against AI opponents while solving complement problems",
    longDescription:
      "Battle Swift AI and Math Bot in an epic race! Find complement numbers to speed ahead. Choose your mode and difficulty to begin the ultimate math challenge.",
    url: "/arcade/complement-race",
    icon: "🏁",
    chips: ["🤖 AI Opponents", "🔥 Speed Challenge", "🏆 Three Game Modes"],
    color: "blue",
    gradient: "linear-gradient(135deg, #dbeafe, #bfdbfe)",
    borderColor: "blue.200",
    difficulty: "Intermediate",
    available: true,
  },
  "master-organizer": {
    name: "Master Organizer",
    fullName: "Master Organizer 🎴",
    maxPlayers: 3,
    description: "Sort scattered cards into perfect harmony",
    longDescription:
      "Chaos to order! Drag and sort scattered number cards into perfect harmony. Can you organize the mathematical mayhem?",
    url: "/arcade/master-organizer",
    icon: "🎴",
    chips: ["🛠️ In Development", "🧩 Sorting & Logic", "📈 Intermediate"],
    color: "indigo",
    gradient: "linear-gradient(135deg, #e0e7ff, #c7d2fe)",
    borderColor: "indigo.200",
    difficulty: "Intermediate",
    available: false,
  },
} as const;

export type GameType = keyof typeof GAMES_CONFIG;

interface GameSelectorProps {
  variant?: "compact" | "detailed";
  showHeader?: boolean;
  emptyStateMessage?: string;
  className?: string;
}

export function GameSelector({
  variant = "detailed",
  showHeader = true,
  emptyStateMessage = "Select champions to see available games",
  className,
}: GameSelectorProps) {
  const { activePlayerCount } = useGameMode();

  return (
    <div
      className={css(
        {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        className,
      )}
    >
      {showHeader && (
        <h3
          className={css({
            fontSize: variant === "compact" ? "lg" : { base: "lg", md: "xl" },
            fontWeight: "bold",
            color: "gray.800",
            mb: { base: "2", md: "3" },
            textAlign: "center",
            flexShrink: 0,
          })}
        >
          🎮 Available Games
        </h3>
      )}

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)" },
          gridTemplateRows: { base: "repeat(4, 1fr)", md: "repeat(2, 1fr)" },
          gap: variant === "compact" ? "2" : { base: "2", md: "3" },
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        })}
      >
        {Object.entries(GAMES_CONFIG).map(([gameType, config]) => (
          <GameCard
            key={gameType}
            gameType={gameType as GameType}
            config={config}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
