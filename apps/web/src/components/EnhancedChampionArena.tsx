"use client";

import { css } from "../../styled-system/css";
import { GameSelector } from "./GameSelector";

interface EnhancedChampionArenaProps {
  onGameModeChange?: (mode: "single" | "battle" | "tournament") => void;
  onConfigurePlayer?: (playerId: number) => void;
  className?: string;
}

export function EnhancedChampionArena({
  className,
}: EnhancedChampionArenaProps) {
  return (
    <div
      className={
        css({
          rounded: { base: "xl", md: "2xl" },
          padding: { base: "2", sm: "3", md: "4" },
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }) + (className ? ` ${className}` : "")
      }
    >
      {/* Game Selector - takes full height */}
      <div
        className={css({
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        })}
      >
        <GameSelector variant="detailed" showHeader={true} />
      </div>
    </div>
  );
}
