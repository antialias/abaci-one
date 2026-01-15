"use client";

import * as Select from "@radix-ui/react-select";
import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../../styled-system/css";
import { useStartPracticeModal } from "../StartPracticeModalContext";
import { GameBreakDifficultyPresets } from "./GameBreakDifficultyPresets";
import { GameBreakCustomConfig } from "./GameBreakCustomConfig";

export function GameBreakSettings() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const {
    showGameBreakSettings,
    gameBreakEnabled,
    setGameBreakEnabled,
    gameBreakMinutes,
    setGameBreakMinutes,
    gameBreakSelectionMode,
    setGameBreakSelectionMode,
    gameBreakSelectedGame,
    setGameBreakSelectedGame,
    practiceApprovedGames,
    hasSingleGame,
    singleGame,
  } = useStartPracticeModal();

  if (!showGameBreakSettings) {
    return null;
  }

  // Game-like panel styling
  const panelStyle = {
    background: gameBreakEnabled
      ? isDark
        ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 50%, rgba(6, 182, 212, 0.15) 100%)"
        : "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.05) 50%, rgba(6, 182, 212, 0.08) 100%)"
      : isDark
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.02)",
    border: `1px solid ${
      gameBreakEnabled
        ? isDark
          ? "rgba(139, 92, 246, 0.3)"
          : "rgba(139, 92, 246, 0.2)"
        : isDark
          ? "rgba(255,255,255,0.08)"
          : "rgba(0,0,0,0.06)"
    }`,
    boxShadow: gameBreakEnabled
      ? isDark
        ? "0 0 20px rgba(139, 92, 246, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
        : "0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.5)"
      : "none",
  };

  // Simplified UI for single-game scenario
  if (hasSingleGame && singleGame) {
    return (
      <div
        data-setting="game-break"
        data-mode="single-game"
        className={css({
          padding: "0.625rem",
          borderRadius: "10px",
          transition: "all 0.2s ease",
          "@media (max-width: 480px), (max-height: 700px)": {
            padding: "0.5rem",
            borderRadius: "8px",
          },
        })}
        style={panelStyle}
      >
        {/* Combined label + toggle button */}
        <button
          type="button"
          data-action="toggle-game-break"
          onClick={() => setGameBreakEnabled(!gameBreakEnabled)}
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "0.375rem 0.5rem",
            marginBottom: gameBreakEnabled ? "0.5rem" : "0",
            fontSize: "0.6875rem",
            fontWeight: "700",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            "@media (max-width: 480px), (max-height: 700px)": {
              padding: "0.25rem 0.375rem",
              marginBottom: gameBreakEnabled ? "0.25rem" : "0",
              fontSize: "0.625rem",
            },
          })}
          style={{
            backgroundColor: gameBreakEnabled
              ? isDark
                ? "rgba(139, 92, 246, 0.25)"
                : "rgba(139, 92, 246, 0.15)"
              : isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.05)",
          }}
        >
          <span
            className={css({
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            })}
            style={{
              color: gameBreakEnabled
                ? isDark
                  ? "#c4b5fd"
                  : "#7c3aed"
                : isDark
                  ? "#9ca3af"
                  : "#6b7280",
            }}
          >
            Game Breaks
          </span>
          <span
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontWeight: "600",
            })}
            style={{
              color: gameBreakEnabled
                ? isDark
                  ? "#a5f3fc"
                  : "#0891b2"
                : isDark
                  ? "#9ca3af"
                  : "#6b7280",
            }}
          >
            <span>{gameBreakEnabled ? "🎮" : "⏸️"}</span>
            <span>{gameBreakEnabled ? "On" : "Off"}</span>
          </span>
        </button>

        {gameBreakEnabled && (
          <>
            {/* Game info + duration in one row */}
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                marginBottom: "0.375rem",
                "@media (max-width: 480px), (max-height: 700px)": {
                  padding: "0.375rem 0.5rem",
                  gap: "0.5rem",
                },
              })}
              style={{
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              }}
            >
              {/* Game icon and name */}
              <div
                data-element="single-game-info"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  flex: 1,
                  minWidth: 0,
                })}
              >
                <span className={css({ fontSize: "1.25rem", flexShrink: 0 })}>
                  {singleGame.manifest.icon}
                </span>
                <span
                  className={css({
                    fontSize: "0.8125rem",
                    fontWeight: "600",
                    color: isDark ? "gray.200" : "gray.700",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    "@media (max-width: 480px), (max-height: 700px)": {
                      fontSize: "0.75rem",
                    },
                  })}
                >
                  {singleGame.manifest.shortName ||
                    singleGame.manifest.displayName}
                </span>
              </div>

              {/* Duration selector - time continuum slider */}
              {(() => {
                const durations = [2, 3, 5];
                const selectedIdx = durations.indexOf(gameBreakMinutes);
                // Fill percentage: 0%, 50%, 100% for 3 items
                const fillPercent =
                  selectedIdx >= 0
                    ? (selectedIdx / (durations.length - 1)) * 100
                    : 0;
                // Typography progression - dramatic increase
                const fontSizes = ["0.6875rem", "0.8125rem", "0.9375rem"];
                const fontWeights = [500, 600, 700];

                return (
                  <div
                    data-element="game-break-duration"
                    className={css({
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                      padding: "0.25rem 0.375rem",
                      borderRadius: "8px",
                    })}
                    style={{
                      background: isDark
                        ? "rgba(139, 92, 246, 0.08)"
                        : "rgba(139, 92, 246, 0.05)",
                    }}
                  >
                    {/* Track background (unfilled portion) - positioned at bottom */}
                    <div
                      className={css({
                        position: "absolute",
                        left: "1rem",
                        right: "1rem",
                        bottom: "0.25rem",
                        height: "3px",
                        borderRadius: "2px",
                        zIndex: 0,
                      })}
                      style={{
                        background: isDark
                          ? "rgba(139, 92, 246, 0.25)"
                          : "rgba(139, 92, 246, 0.18)",
                      }}
                    />
                    {/* Track fill (filled portion up to selection) */}
                    <div
                      className={css({
                        position: "absolute",
                        left: "1rem",
                        bottom: "0.25rem",
                        height: "3px",
                        borderRadius: "2px",
                        zIndex: 0,
                        transition: "width 0.2s ease",
                      })}
                      style={{
                        width: `calc((100% - 2rem) * ${fillPercent / 100})`,
                        background: isDark
                          ? "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 100%)"
                          : "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)",
                      }}
                    />
                    {durations.map((mins, index) => {
                      const isSelected = gameBreakMinutes === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          data-option={`game-break-${mins}`}
                          data-selected={isSelected}
                          onClick={() => setGameBreakMinutes(mins)}
                          className={css({
                            position: "relative",
                            zIndex: 1,
                            flex: 1,
                            padding: "0.1875rem 0",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            "@media (max-width: 480px), (max-height: 700px)": {
                              padding: "0.125rem 0",
                            },
                          })}
                          style={{
                            fontSize: fontSizes[index],
                            fontWeight: fontWeights[index],
                            backgroundColor: isSelected
                              ? isDark
                                ? "#8b5cf6"
                                : "#7c3aed"
                              : "transparent",
                            color: isSelected
                              ? "white"
                              : isDark
                                ? `rgba(196, 181, 253, ${0.55 + index * 0.2})`
                                : `rgba(124, 58, 237, ${0.45 + index * 0.25})`,
                            boxShadow: isSelected
                              ? "0 0 12px rgba(139, 92, 246, 0.6)"
                              : "none",
                            transform: isSelected ? "scale(1.1)" : "scale(1)",
                          }}
                        >
                          {mins}m
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Difficulty presets and customize (for single game) */}
            <GameBreakDifficultyPresets />
            <GameBreakCustomConfig />

            {/* Helper text + coming soon */}
            <div
              data-element="game-break-hint"
              className={css({
                fontSize: "0.625rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginTop: "0.25rem",
                "@media (max-width: 480px), (max-height: 700px)": {
                  fontSize: "0.5625rem",
                },
              })}
            >
              <span
                className={css({ fontStyle: "italic" })}
                style={{ color: isDark ? "#a5b4fc" : "#818cf8" }}
              >
                Starts automatically between parts
              </span>
              <span
                className={css({
                  fontWeight: "600",
                  letterSpacing: "0.02em",
                })}
                style={{ color: isDark ? "#67e8f9" : "#0891b2" }}
              >
                More games coming soon!
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full UI for multiple games
  return (
    <div
      data-setting="game-break"
      data-mode="multi-game"
      className={css({
        padding: "0.625rem",
        borderRadius: "10px",
        transition: "all 0.2s ease",
        "@media (max-width: 480px), (max-height: 700px)": {
          padding: "0.5rem",
          borderRadius: "8px",
        },
      })}
      style={panelStyle}
    >
      {/* Combined label + toggle button */}
      <button
        type="button"
        data-action="toggle-game-break"
        onClick={() => setGameBreakEnabled(!gameBreakEnabled)}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.375rem 0.5rem",
          marginBottom: gameBreakEnabled ? "0.5rem" : "0",
          fontSize: "0.6875rem",
          fontWeight: "700",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          "@media (max-width: 480px), (max-height: 700px)": {
            padding: "0.25rem 0.375rem",
            marginBottom: gameBreakEnabled ? "0.25rem" : "0",
            fontSize: "0.625rem",
          },
        })}
        style={{
          backgroundColor: gameBreakEnabled
            ? isDark
              ? "rgba(139, 92, 246, 0.25)"
              : "rgba(139, 92, 246, 0.15)"
            : isDark
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.05)",
        }}
      >
        <span
          className={css({
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          })}
          style={{
            color: gameBreakEnabled
              ? isDark
                ? "#c4b5fd"
                : "#7c3aed"
              : isDark
                ? "#9ca3af"
                : "#6b7280",
          }}
        >
          Game Breaks
        </span>
        <span
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontWeight: "600",
          })}
          style={{
            color: gameBreakEnabled
              ? isDark
                ? "#a5f3fc"
                : "#0891b2"
              : isDark
                ? "#9ca3af"
                : "#6b7280",
          }}
        >
          <span>{gameBreakEnabled ? "🎮" : "⏸️"}</span>
          <span>{gameBreakEnabled ? "On" : "Off"}</span>
        </span>
      </button>

      {/* Duration options - time continuum slider */}
      {gameBreakEnabled &&
        (() => {
          const durations = [2, 3, 5, 10];
          const selectedIdx = durations.indexOf(gameBreakMinutes);
          // Fill percentage based on position in array
          const fillPercent =
            selectedIdx >= 0 ? (selectedIdx / (durations.length - 1)) * 100 : 0;
          // Typography progression - dramatic increase in size and weight
          const fontSizes = ["0.6875rem", "0.75rem", "0.875rem", "1rem"];
          const fontWeights = [400, 500, 600, 700];

          return (
            <div
              data-element="game-break-duration"
              className={css({
                position: "relative",
                display: "flex",
                alignItems: "center",
                padding: "0.375rem 0.5rem",
                borderRadius: "10px",
                "@media (max-width: 480px), (max-height: 700px)": {
                  padding: "0.25rem 0.375rem",
                  borderRadius: "8px",
                },
              })}
              style={{
                background: isDark
                  ? "rgba(139, 92, 246, 0.08)"
                  : "rgba(139, 92, 246, 0.05)",
              }}
            >
              {/* Track background (unfilled portion) - positioned at bottom */}
              <div
                className={css({
                  position: "absolute",
                  left: "1.25rem",
                  right: "1.25rem",
                  bottom: "0.375rem",
                  height: "4px",
                  borderRadius: "2px",
                  zIndex: 0,
                })}
                style={{
                  background: isDark
                    ? "rgba(139, 92, 246, 0.25)"
                    : "rgba(139, 92, 246, 0.15)",
                }}
              />
              {/* Track fill (filled portion up to selection) */}
              <div
                className={css({
                  position: "absolute",
                  left: "1.25rem",
                  bottom: "0.375rem",
                  height: "4px",
                  borderRadius: "2px",
                  zIndex: 0,
                  transition: "width 0.25s ease",
                })}
                style={{
                  width: `calc((100% - 2.5rem) * ${fillPercent / 100})`,
                  background: isDark
                    ? "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 100%)"
                    : "linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)",
                }}
              />
              {durations.map((mins, index) => {
                const isSelected = gameBreakMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    data-option={`game-break-${mins}`}
                    data-selected={isSelected}
                    onClick={() => setGameBreakMinutes(mins)}
                    className={css({
                      position: "relative",
                      zIndex: 1,
                      flex: 1,
                      padding: "0.25rem 0",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      "@media (max-width: 480px), (max-height: 700px)": {
                        padding: "0.1875rem 0",
                        borderRadius: "4px",
                      },
                    })}
                    style={{
                      fontSize: fontSizes[index],
                      fontWeight: fontWeights[index],
                      backgroundColor: isSelected
                        ? isDark
                          ? "#8b5cf6"
                          : "#7c3aed"
                        : "transparent",
                      color: isSelected
                        ? "white"
                        : isDark
                          ? `rgba(196, 181, 253, ${0.5 + index * 0.15})`
                          : `rgba(124, 58, 237, ${0.4 + index * 0.18})`,
                      boxShadow: isSelected
                        ? "0 0 14px rgba(139, 92, 246, 0.6)"
                        : "none",
                      transform: isSelected ? "scale(1.12)" : "scale(1)",
                    }}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          );
        })()}

      {/* Selection Mode Toggle */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-mode"
          className={css({
            display: "flex",
            gap: "0.25rem",
            marginTop: "0.5rem",
          })}
        >
          {[
            { mode: "auto-start" as const, emoji: "🚀", label: "Auto-start" },
            { mode: "kid-chooses" as const, emoji: "🎯", label: "Kid picks" },
          ].map(({ mode, emoji, label }) => {
            const isSelected = gameBreakSelectionMode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-option={`mode-${mode}`}
                data-selected={isSelected}
                onClick={() => setGameBreakSelectionMode(mode)}
                className={css({
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  padding: "0.375rem 0.5rem",
                  fontSize: "0.6875rem",
                  fontWeight: "600",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  "@media (max-width: 480px), (max-height: 700px)": {
                    padding: "0.25rem 0.375rem",
                    fontSize: "0.5625rem",
                    gap: "0.125rem",
                  },
                })}
                style={{
                  backgroundColor: isSelected
                    ? isDark
                      ? "rgba(6, 182, 212, 0.25)"
                      : "rgba(6, 182, 212, 0.15)"
                    : isDark
                      ? "rgba(6, 182, 212, 0.1)"
                      : "rgba(6, 182, 212, 0.08)",
                  color: isSelected
                    ? isDark
                      ? "#a5f3fc"
                      : "#0891b2"
                    : isDark
                      ? "#67e8f9"
                      : "#0e7490",
                  boxShadow: isSelected
                    ? isDark
                      ? "0 0 10px rgba(6, 182, 212, 0.3)"
                      : "0 0 10px rgba(6, 182, 212, 0.2)"
                    : "none",
                }}
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Game Selection Dropdown */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-game"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            marginTop: "0.5rem",
          })}
        >
          <div
            className={css({
              fontSize: "0.625rem",
              fontWeight: "600",
              color: isDark ? "#a5b4fc" : "#6366f1",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              "@media (max-width: 480px), (max-height: 700px)": {
                fontSize: "0.5625rem",
              },
            })}
          >
            {gameBreakSelectionMode === "auto-start" ? "Game" : "Default"}
          </div>
          <Select.Root
            value={gameBreakSelectedGame ?? "__none__"}
            onValueChange={(value) =>
              setGameBreakSelectedGame(
                value === "__none__" ? null : (value as string | "random"),
              )
            }
          >
            <Select.Trigger
              data-element="game-select-trigger"
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                fontWeight: "600",
                borderRadius: "8px",
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s ease",
                width: "100%",
                "@media (max-width: 480px), (max-height: 700px)": {
                  padding: "0.375rem 0.5rem",
                  fontSize: "0.6875rem",
                },
              })}
              style={{
                backgroundColor: isDark
                  ? "rgba(139, 92, 246, 0.1)"
                  : "rgba(139, 92, 246, 0.06)",
                borderColor: isDark
                  ? "rgba(139, 92, 246, 0.3)"
                  : "rgba(139, 92, 246, 0.2)",
                color: isDark ? "#e5e7eb" : "#374151",
              }}
            >
              <Select.Value>
                {(() => {
                  if (gameBreakSelectedGame === "random") return "🎲 Random";
                  if (gameBreakSelectedGame === null) return "✨ No default";
                  const game = practiceApprovedGames.find(
                    (g) => g.manifest.name === gameBreakSelectedGame,
                  );
                  return game
                    ? `${game.manifest.icon} ${game.manifest.shortName || game.manifest.displayName}`
                    : "Select game";
                })()}
              </Select.Value>
              <Select.Icon>
                <span
                  className={css({
                    fontSize: "0.625rem",
                    color: isDark ? "gray.400" : "gray.500",
                  })}
                >
                  ▼
                </span>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                data-element="game-select-content"
                position="popper"
                sideOffset={4}
                className={css({
                  backgroundColor: isDark ? "#1f2937" : "white",
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  overflow: "hidden",
                  zIndex: 10001,
                  minWidth: "180px",
                })}
              >
                <Select.Viewport className={css({ padding: "0.25rem" })}>
                  {/* Random option */}
                  <Select.Item
                    value="random"
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      borderRadius: "6px",
                      cursor: "pointer",
                      outline: "none",
                      color: isDark ? "#e5e7eb" : "#374151",
                      _hover: {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.05)",
                      },
                      "&[data-highlighted]": {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.05)",
                      },
                    })}
                  >
                    <Select.ItemText>🎲 Random</Select.ItemText>
                  </Select.Item>
                  {/* Practice-approved games */}
                  {practiceApprovedGames.map((game) => (
                    <Select.Item
                      key={game.manifest.name}
                      value={game.manifest.name}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: "500",
                        borderRadius: "6px",
                        cursor: "pointer",
                        outline: "none",
                        color: isDark ? "#e5e7eb" : "#374151",
                        _hover: {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                        },
                        "&[data-highlighted]": {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                        },
                      })}
                    >
                      <Select.ItemText>
                        {game.manifest.icon}{" "}
                        {game.manifest.shortName || game.manifest.displayName}
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                  {/* "No default" option for kid-chooses mode only */}
                  {gameBreakSelectionMode === "kid-chooses" && (
                    <Select.Item
                      value="__none__"
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.75rem",
                        fontWeight: "500",
                        borderRadius: "6px",
                        cursor: "pointer",
                        outline: "none",
                        color: isDark ? "#9ca3af" : "#6b7280",
                        _hover: {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                        },
                        "&[data-highlighted]": {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.05)",
                        },
                      })}
                    >
                      <Select.ItemText>✨ No default</Select.ItemText>
                    </Select.Item>
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      )}

      {/* Difficulty presets and customize (for multi-game) */}
      {gameBreakEnabled && (
        <>
          <GameBreakDifficultyPresets />
          <GameBreakCustomConfig />
        </>
      )}

      {/* Helper text */}
      {gameBreakEnabled && (
        <div
          data-element="game-break-hint"
          className={css({
            fontSize: "0.625rem",
            color: isDark ? "#a5b4fc" : "#818cf8",
            marginTop: "0.375rem",
            fontStyle: "italic",
            "@media (max-width: 480px), (max-height: 700px)": {
              fontSize: "0.5625rem",
              marginTop: "0.25rem",
            },
          })}
        >
          {gameBreakSelectionMode === "auto-start"
            ? gameBreakSelectedGame === "random"
              ? "A random game will start automatically"
              : "This game will start automatically (kid can skip)"
            : gameBreakSelectedGame === null
              ? "Kid chooses from full list"
              : "This game will be highlighted as suggested"}
        </div>
      )}
    </div>
  );
}
