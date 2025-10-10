import React from "react";
import { PlayerTooltip } from "./PlayerTooltip";

interface Player {
  id: string;
  name: string;
  emoji: string;
  color?: string;
  createdAt?: Date | number;
  isLocal?: boolean;
}

interface ActivePlayersListProps {
  activePlayers: Player[];
  shouldEmphasize: boolean;
  onRemovePlayer: (playerId: string) => void;
  onConfigurePlayer: (playerId: string) => void;
}

export function ActivePlayersList({
  activePlayers,
  shouldEmphasize,
  onRemovePlayer,
  onConfigurePlayer,
}: ActivePlayersListProps) {
  const [hoveredPlayerId, setHoveredPlayerId] = React.useState<string | null>(
    null,
  );

  return (
    <>
      {activePlayers.map((player) => (
        <PlayerTooltip
          key={player.id}
          playerName={player.name}
          playerColor={player.color}
          isLocal={player.isLocal !== false}
          createdAt={player.createdAt}
        >
          <div
            style={{
              position: "relative",
              fontSize: shouldEmphasize ? "48px" : "20px",
              lineHeight: 1,
              transition:
                "font-size 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.4s ease",
              filter: shouldEmphasize
                ? "drop-shadow(0 4px 8px rgba(0,0,0,0.25))"
                : "none",
              cursor: shouldEmphasize ? "pointer" : "default",
            }}
            onClick={() => shouldEmphasize && onConfigurePlayer(player.id)}
            onMouseEnter={() =>
              shouldEmphasize && setHoveredPlayerId(player.id)
            }
            onMouseLeave={() => shouldEmphasize && setHoveredPlayerId(null)}
          >
            {player.emoji}
            {shouldEmphasize && hoveredPlayerId === player.id && (
              <>
                {/* Configure button - bottom left */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigurePlayer(player.id);
                  }}
                  style={{
                    position: "absolute",
                    bottom: "-4px",
                    left: "-4px",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: "2px solid white",
                    background: "#6b7280",
                    color: "white",
                    fontSize: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    transition: "all 0.2s ease",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#3b82f6";
                    e.currentTarget.style.transform = "scale(1.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#6b7280";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  aria-label={`Configure ${player.name}`}
                >
                  ⚙
                </button>

                {/* Remove button - top right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePlayer(player.id);
                  }}
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "2px solid white",
                    background: "#ef4444",
                    color: "white",
                    fontSize: "12px",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    transition: "all 0.2s ease",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dc2626";
                    e.currentTarget.style.transform = "scale(1.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ef4444";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  aria-label={`Remove ${player.name}`}
                >
                  ×
                </button>
              </>
            )}
          </div>
        </PlayerTooltip>
      ))}
    </>
  );
}
