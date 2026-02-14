"use client";

import { useCallback, useMemo } from "react";
import { css } from "../../../../../styled-system/css";
import {
  usePlayerSessionPreferences,
  useSavePlayerSessionPreferences,
} from "@/hooks/usePlayerSessionPreferences";
import { getPracticeApprovedGames } from "@/lib/arcade/practice-approved-games";
import { DEFAULT_SESSION_PREFERENCES } from "@/db/schema/player-session-preferences";

// ============================================================================
// Types
// ============================================================================

interface SettingsTabProps {
  studentId: string;
  studentName: string;
  isDark: boolean;
  onManageSkills: () => void;
}

// ============================================================================
// SettingsTab
// ============================================================================

export function SettingsTab({
  studentId,
  studentName,
  isDark,
  onManageSkills,
}: SettingsTabProps) {
  const { data: preferences, isLoading } =
    usePlayerSessionPreferences(studentId);
  const saveMutation = useSavePlayerSessionPreferences(studentId);

  const allApprovedGames = useMemo(() => getPracticeApprovedGames(), []);

  const enabledGames: string[] = useMemo(
    () =>
      preferences?.gameBreakEnabledGames ??
      DEFAULT_SESSION_PREFERENCES.gameBreakEnabledGames ??
      [],
    [preferences?.gameBreakEnabledGames],
  );

  const handleToggleGame = useCallback(
    (gameName: string) => {
      const current = preferences?.gameBreakEnabledGames ?? [];
      const isEnabled = current.includes(gameName);
      const updated = isEnabled
        ? current.filter((g) => g !== gameName)
        : [...current, gameName];

      saveMutation.mutate({
        ...(preferences ?? DEFAULT_SESSION_PREFERENCES),
        gameBreakEnabledGames: updated,
      });
    },
    [preferences, saveMutation],
  );

  const enabledCount = enabledGames.length;

  return (
    <div data-component="settings-tab">
      {/* Game Break Games Pane */}
      <section
        data-section="game-break-games"
        className={css({
          marginBottom: "2rem",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          })}
        >
          <h3
            className={css({
              fontSize: "1.125rem",
              fontWeight: "700",
              color: isDark ? "gray.100" : "gray.800",
            })}
          >
            Game Break Games
          </h3>
          <span
            className={css({
              fontSize: "0.75rem",
              fontWeight: "500",
              padding: "0.25rem 0.5rem",
              borderRadius: "6px",
            })}
            style={{
              backgroundColor:
                enabledCount > 0
                  ? isDark
                    ? "rgba(34, 197, 94, 0.15)"
                    : "rgba(34, 197, 94, 0.1)"
                  : isDark
                    ? "rgba(234, 179, 8, 0.15)"
                    : "rgba(234, 179, 8, 0.1)",
              color:
                enabledCount > 0
                  ? isDark
                    ? "#86efac"
                    : "#16a34a"
                  : isDark
                    ? "#fde047"
                    : "#ca8a04",
            }}
          >
            {enabledCount} of {allApprovedGames.length} enabled
          </span>
        </div>

        <p
          className={css({
            fontSize: "0.8125rem",
            color: isDark ? "gray.400" : "gray.600",
            marginBottom: "1rem",
            lineHeight: "1.5",
          })}
        >
          Choose which games {studentName} can play during practice breaks.
        </p>

        {enabledCount === 0 && (
          <div
            data-element="no-games-warning"
            className={css({
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              fontSize: "0.8125rem",
              fontWeight: "500",
            })}
            style={{
              backgroundColor: isDark
                ? "rgba(234, 179, 8, 0.12)"
                : "rgba(234, 179, 8, 0.08)",
              color: isDark ? "#fde047" : "#a16207",
              border: `1px solid ${isDark ? "rgba(234, 179, 8, 0.25)" : "rgba(234, 179, 8, 0.2)"}`,
            }}
          >
            Enable at least one game to use game breaks during practice.
          </div>
        )}

        {isLoading ? (
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              padding: "2rem",
              color: isDark ? "gray.500" : "gray.400",
              fontSize: "0.875rem",
            })}
          >
            Loading preferences...
          </div>
        ) : (
          <div
            data-element="game-grid"
            className={css({
              display: "grid",
              gridTemplateColumns: {
                base: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: "0.75rem",
            })}
          >
            {allApprovedGames.map((game) => {
              const isEnabled = enabledGames.includes(game.manifest.name);
              return (
                <button
                  key={game.manifest.name}
                  type="button"
                  data-game={game.manifest.name}
                  data-enabled={isEnabled}
                  data-action="toggle-game"
                  onClick={() => handleToggleGame(game.manifest.name)}
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1rem",
                    borderRadius: "12px",
                    border: "2px solid",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "left",
                    width: "100%",
                    _hover: {
                      transform: "translateY(-1px)",
                    },
                  })}
                  style={{
                    borderColor: isEnabled
                      ? isDark
                        ? "rgba(139, 92, 246, 0.4)"
                        : "rgba(139, 92, 246, 0.3)"
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.08)",
                    backgroundColor: isEnabled
                      ? isDark
                        ? "rgba(139, 92, 246, 0.12)"
                        : "rgba(139, 92, 246, 0.06)"
                      : isDark
                        ? "rgba(255,255,255,0.03)"
                        : "rgba(0,0,0,0.02)",
                    boxShadow: isEnabled
                      ? isDark
                        ? "0 0 12px rgba(139, 92, 246, 0.2)"
                        : "0 0 12px rgba(139, 92, 246, 0.1)"
                      : "none",
                    opacity: isEnabled ? 1 : 0.6,
                  }}
                >
                  <span
                    className={css({
                      fontSize: "1.75rem",
                      flexShrink: 0,
                    })}
                  >
                    {game.manifest.icon}
                  </span>
                  <div className={css({ flex: 1, minWidth: 0 })}>
                    <div
                      className={css({
                        fontSize: "0.875rem",
                        fontWeight: "600",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      })}
                      style={{
                        color: isEnabled
                          ? isDark
                            ? "#e5e7eb"
                            : "#374151"
                          : isDark
                            ? "#9ca3af"
                            : "#6b7280",
                      }}
                    >
                      {game.manifest.displayName}
                    </div>
                  </div>
                  {/* Toggle indicator */}
                  <div
                    className={css({
                      width: "40px",
                      height: "22px",
                      borderRadius: "11px",
                      position: "relative",
                      flexShrink: 0,
                      transition: "background-color 0.15s ease",
                    })}
                    style={{
                      backgroundColor: isEnabled
                        ? isDark
                          ? "#8b5cf6"
                          : "#7c3aed"
                        : isDark
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(0,0,0,0.12)",
                    }}
                  >
                    <div
                      className={css({
                        position: "absolute",
                        top: "2px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        transition: "left 0.15s ease",
                        backgroundColor: "white",
                      })}
                      style={{
                        left: isEnabled ? "20px" : "2px",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Skills Pane */}
      <section data-section="skills-shortcut">
        <h3
          className={css({
            fontSize: "1.125rem",
            fontWeight: "700",
            color: isDark ? "gray.100" : "gray.800",
            marginBottom: "0.75rem",
          })}
        >
          Skills
        </h3>
        <p
          className={css({
            fontSize: "0.8125rem",
            color: isDark ? "gray.400" : "gray.600",
            marginBottom: "1rem",
            lineHeight: "1.5",
          })}
        >
          Manage which skills {studentName} is practicing.
        </p>
        <button
          type="button"
          data-action="manage-skills"
          onClick={onManageSkills}
          className={css({
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: "600",
            borderRadius: "10px",
            border: "1px solid",
            cursor: "pointer",
            transition: "all 0.15s ease",
            _hover: {
              transform: "translateY(-1px)",
            },
          })}
          style={{
            backgroundColor: isDark
              ? "rgba(59, 130, 246, 0.12)"
              : "rgba(59, 130, 246, 0.06)",
            borderColor: isDark
              ? "rgba(59, 130, 246, 0.3)"
              : "rgba(59, 130, 246, 0.2)",
            color: isDark ? "#93c5fd" : "#2563eb",
          }}
        >
          <span>Manage Skills</span>
        </button>
      </section>
    </div>
  );
}
