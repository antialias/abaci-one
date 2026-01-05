"use client";

import { css } from "@styled/css";
import { useTheme } from "@/contexts/ThemeContext";
import { useKnowYourWorld } from "../Provider";
import { WORLD_MAP, USA_MAP } from "../maps";

export function ResultsPhase() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { state, nextRound } = useKnowYourWorld();

  const mapData = state.selectedMap === "world" ? WORLD_MAP : USA_MAP;
  const totalRegions = mapData.regions.length;
  const elapsedTime = state.endTime ? state.endTime - state.startTime : 0;
  const minutes = Math.floor(elapsedTime / 60000);
  const seconds = Math.floor((elapsedTime % 60000) / 1000);

  // Sort players by score
  const sortedPlayers = state.activePlayers
    .map((playerId) => ({
      playerId,
      name: state.playerMetadata[playerId]?.name || playerId,
      emoji: state.playerMetadata[playerId]?.emoji || "👤",
      score: state.scores[playerId] || 0,
      attempts: state.attempts[playerId] || 0,
    }))
    .sort((a, b) => b.score - a.score);

  const winner = sortedPlayers[0];

  return (
    <div
      data-component="results-phase"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "6",
        maxWidth: "800px",
        margin: "0 auto",
        paddingTop: "20",
        paddingX: "6",
        paddingBottom: "6",
      })}
    >
      {/* Victory Banner */}
      <div
        data-section="victory-banner"
        className={css({
          textAlign: "center",
          padding: "8",
          bg: "linear-gradient(135deg, #fbbf24, #f59e0b)",
          rounded: "xl",
          shadow: "xl",
        })}
      >
        <div className={css({ fontSize: "6xl", marginBottom: "4" })}>🎉</div>
        <div
          className={css({
            fontSize: "3xl",
            fontWeight: "bold",
            color: "white",
          })}
        >
          {state.gameMode === "cooperative" ? "Great Teamwork!" : "Winner!"}
        </div>
        {state.gameMode !== "cooperative" && winner && (
          <div
            className={css({ fontSize: "2xl", color: "white", marginTop: "2" })}
          >
            {winner.emoji} {winner.name}
          </div>
        )}
      </div>

      {/* Stats */}
      <div
        data-section="game-stats"
        className={css({
          bg: isDark ? "gray.800" : "white",
          rounded: "xl",
          padding: "6",
          shadow: "lg",
        })}
      >
        <h2
          className={css({
            fontSize: "2xl",
            fontWeight: "bold",
            marginBottom: "4",
            color: isDark ? "gray.100" : "gray.900",
          })}
        >
          Game Statistics
        </h2>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "4",
          })}
        >
          <div>
            <div
              className={css({
                fontSize: "sm",
                color: isDark ? "gray.400" : "gray.600",
              })}
            >
              Regions Found
            </div>
            <div
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "green.500",
              })}
            >
              {totalRegions} / {totalRegions}
            </div>
          </div>
          <div>
            <div
              className={css({
                fontSize: "sm",
                color: isDark ? "gray.400" : "gray.600",
              })}
            >
              Time
            </div>
            <div
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "blue.500",
              })}
            >
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
          </div>
        </div>
      </div>

      {/* Player Scores */}
      <div
        data-section="player-scores"
        className={css({
          bg: isDark ? "gray.800" : "white",
          rounded: "xl",
          padding: "6",
          shadow: "lg",
        })}
      >
        <h2
          className={css({
            fontSize: "2xl",
            fontWeight: "bold",
            marginBottom: "4",
            color: isDark ? "gray.100" : "gray.900",
          })}
        >
          {state.gameMode === "cooperative" ? "Team Score" : "Leaderboard"}
        </h2>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3",
          })}
        >
          {sortedPlayers.map((player, index) => (
            <div
              key={player.playerId}
              data-element="player-score"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "4",
                padding: "4",
                bg:
                  index === 0
                    ? isDark
                      ? "yellow.900"
                      : "yellow.50"
                    : isDark
                      ? "gray.700"
                      : "gray.100",
                rounded: "lg",
                border: "2px solid",
                borderColor: index === 0 ? "yellow.500" : "transparent",
              })}
            >
              <div className={css({ fontSize: "3xl" })}>{player.emoji}</div>
              <div className={css({ flex: "1" })}>
                <div
                  className={css({
                    fontWeight: "bold",
                    fontSize: "lg",
                    color: isDark ? "gray.100" : "gray.900",
                  })}
                >
                  {player.name}
                </div>
                <div
                  className={css({
                    fontSize: "sm",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  {player.attempts} wrong clicks
                </div>
              </div>
              <div
                className={css({
                  fontSize: "2xl",
                  fontWeight: "bold",
                  color: "green.500",
                })}
              >
                {player.score} pts
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "repeat(1, 1fr)",
          gap: "4",
        })}
      >
        <button
          data-action="play-again"
          onClick={nextRound}
          className={css({
            padding: "4",
            rounded: "xl",
            bg: "blue.600",
            color: "white",
            fontSize: "xl",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s",
            _hover: {
              bg: "blue.700",
              transform: "translateY(-2px)",
              shadow: "lg",
            },
          })}
        >
          🔄 Play Again
        </button>
      </div>
    </div>
  );
}
