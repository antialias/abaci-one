"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { useGameMode } from "@/contexts/GameModeContext";
import { useMatching } from "../Provider";

// Add bounce animation for the start button
const bounceAnimation = `
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}
`;

// Inject animation styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("setup-animations")
) {
  const style = document.createElement("style");
  style.id = "setup-animations";
  style.textContent = bounceAnimation;
  document.head.appendChild(style);
}

export function SetupPhase() {
  const {
    state,
    setGameType,
    setDifficulty,
    setTurnTimer,
    startGame,
    resumeGame,
    canResumeGame,
    hasConfigChanged,
    activePlayers: _activePlayers,
  } = useMatching();

  const { activePlayerCount, gameMode: _globalGameMode } = useGameMode();

  // PAUSE/RESUME: Warning dialog state
  const [showConfigWarning, setShowConfigWarning] = useState(false);
  const [hasSeenWarning, setHasSeenWarning] = useState(false);
  const [pendingConfigChange, setPendingConfigChange] = useState<{
    type: "gameType" | "difficulty" | "turnTimer";
    value: any;
  } | null>(null);

  // Check if we should show warning when changing config
  const shouldShowWarning =
    state.pausedGamePhase && !hasSeenWarning && !hasConfigChanged;

  // Config change handlers that check for paused game
  const handleSetGameType = (value: typeof state.gameType) => {
    if (shouldShowWarning) {
      setPendingConfigChange({ type: "gameType", value });
      setShowConfigWarning(true);
    } else {
      setGameType(value);
    }
  };

  const handleSetDifficulty = (value: typeof state.difficulty) => {
    if (shouldShowWarning) {
      setPendingConfigChange({ type: "difficulty", value });
      setShowConfigWarning(true);
    } else {
      setDifficulty(value);
    }
  };

  const handleSetTurnTimer = (value: typeof state.turnTimer) => {
    if (shouldShowWarning) {
      setPendingConfigChange({ type: "turnTimer", value });
      setShowConfigWarning(true);
    } else {
      setTurnTimer(value);
    }
  };

  // Apply pending config change after warning
  const applyPendingChange = () => {
    if (pendingConfigChange) {
      switch (pendingConfigChange.type) {
        case "gameType":
          setGameType(pendingConfigChange.value);
          break;
        case "difficulty":
          setDifficulty(pendingConfigChange.value);
          break;
        case "turnTimer":
          setTurnTimer(pendingConfigChange.value);
          break;
      }
      setHasSeenWarning(true);
      setPendingConfigChange(null);
      setShowConfigWarning(false);
    }
  };

  // Cancel config change
  const cancelConfigChange = () => {
    setPendingConfigChange(null);
    setShowConfigWarning(false);
  };

  const handleStartOrResumeGame = () => {
    if (canResumeGame) {
      resumeGame();
    } else {
      startGame();
    }
  };

  const getButtonStyles = (
    isSelected: boolean,
    variant: "primary" | "secondary" | "difficulty" = "primary",
  ) => {
    const baseStyles = {
      border: "none",
      borderRadius: { base: "12px", md: "16px" },
      padding: { base: "12px 16px", sm: "14px 20px", md: "16px 24px" },
      fontSize: { base: "14px", sm: "15px", md: "16px" },
      fontWeight: "bold",
      cursor: "pointer",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      minWidth: { base: "120px", sm: "140px", md: "160px" },
      textAlign: "center" as const,
      position: "relative" as const,
      overflow: "hidden" as const,
      textShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
      transform: "translateZ(0)", // Enable GPU acceleration
    };

    if (variant === "difficulty") {
      return css({
        ...baseStyles,
        background: isSelected
          ? "linear-gradient(135deg, #ff6b6b, #ee5a24)"
          : "linear-gradient(135deg, #f8f9fa, #e9ecef)",
        color: isSelected ? "white" : "#495057",
        boxShadow: isSelected
          ? "0 8px 25px rgba(255, 107, 107, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
          : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
        _hover: {
          transform: "translateY(-3px) scale(1.02)",
          boxShadow: isSelected
            ? "0 12px 35px rgba(255, 107, 107, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)"
            : "0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
        },
        _active: {
          transform: "translateY(-1px) scale(1.01)",
        },
      });
    }

    if (variant === "secondary") {
      return css({
        ...baseStyles,
        background: isSelected
          ? "linear-gradient(135deg, #a78bfa, #8b5cf6)"
          : "linear-gradient(135deg, #f8fafc, #e2e8f0)",
        color: isSelected ? "white" : "#475569",
        boxShadow: isSelected
          ? "0 8px 25px rgba(167, 139, 250, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
          : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
        _hover: {
          transform: "translateY(-3px) scale(1.02)",
          boxShadow: isSelected
            ? "0 12px 35px rgba(167, 139, 250, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)"
            : "0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
        },
        _active: {
          transform: "translateY(-1px) scale(1.01)",
        },
      });
    }

    // Primary variant
    return css({
      ...baseStyles,
      background: isSelected
        ? "linear-gradient(135deg, #667eea, #764ba2)"
        : "linear-gradient(135deg, #ffffff, #f1f5f9)",
      color: isSelected ? "white" : "#334155",
      boxShadow: isSelected
        ? "0 8px 25px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)"
        : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
      _hover: {
        transform: "translateY(-3px) scale(1.02)",
        boxShadow: isSelected
          ? "0 12px 35px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)"
          : "0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
      },
      _active: {
        transform: "translateY(-1px) scale(1.01)",
      },
    });
  };

  return (
    <div
      className={css({
        textAlign: "center",
        padding: { base: "12px 16px", sm: "16px 20px", md: "20px" },
        maxWidth: "800px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        minHeight: 0, // Allow shrinking
        overflow: "auto", // Enable scrolling if needed
      })}
    >
      <div
        className={css({
          display: "grid",
          gap: { base: "8px", sm: "12px", md: "16px" },
          margin: "0 auto",
          flex: 1,
          minHeight: 0, // Allow shrinking
        })}
      >
        {/* PAUSE/RESUME: Config change warning */}
        {showConfigWarning && (
          <div
            className={css({
              p: "4",
              background:
                "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))",
              border: "2px solid",
              borderColor: "yellow.400",
              rounded: "xl",
              textAlign: "center",
              boxShadow: "0 4px 12px rgba(251, 191, 36, 0.2)",
            })}
          >
            <p
              className={css({
                color: "yellow.700",
                fontSize: { base: "15px", md: "17px" },
                fontWeight: "bold",
                marginBottom: "8px",
              })}
            >
              ⚠️ Warning: Changing Settings Will End Current Game
            </p>
            <p
              className={css({
                color: "gray.600",
                fontSize: { base: "13px", md: "14px" },
                marginBottom: "12px",
              })}
            >
              You have a paused game in progress. Changing any setting will end
              it and you won't be able to resume.
            </p>
            <div
              className={css({
                display: "flex",
                gap: "8px",
                justifyContent: "center",
                flexWrap: "wrap",
              })}
            >
              <button
                className={css({
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                  _hover: {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
                  },
                })}
                onClick={cancelConfigChange}
              >
                ✓ Keep Game & Cancel Change
              </button>
              <button
                className={css({
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                  _hover: {
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                  },
                })}
                onClick={applyPendingChange}
              >
                ✗ End Game & Apply Change
              </button>
            </div>
          </div>
        )}

        {/* Warning if no players */}
        {activePlayerCount === 0 && (
          <div
            className={css({
              p: "4",
              background: "rgba(239, 68, 68, 0.1)",
              border: "2px solid",
              borderColor: "red.300",
              rounded: "xl",
              textAlign: "center",
            })}
          >
            <p
              className={css({
                color: "red.700",
                fontSize: { base: "14px", md: "16px" },
                fontWeight: "bold",
              })}
            >
              ⚠️ Go back to the arcade to select players before starting the
              game
            </p>
          </div>
        )}

        {/* Game Type Selection */}
        <div>
          <label
            className={css({
              display: "block",
              fontSize: { base: "16px", sm: "18px", md: "20px" },
              fontWeight: "bold",
              marginBottom: { base: "12px", md: "16px" },
              color: "gray.700",
            })}
          >
            Game Type
          </label>
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: {
                base: "1fr",
                sm: "repeat(2, 1fr)",
              },
              gap: { base: "8px", sm: "10px", md: "12px" },
              justifyItems: "stretch",
            })}
          >
            <button
              className={getButtonStyles(
                state.gameType === "abacus-numeral",
                "secondary",
              )}
              onClick={() => handleSetGameType("abacus-numeral")}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: { base: "4px", md: "6px" },
                })}
              >
                <div
                  className={css({
                    fontSize: { base: "20px", sm: "24px", md: "28px" },
                    display: "flex",
                    alignItems: "center",
                    gap: { base: "4px", md: "8px" },
                  })}
                >
                  <span>🧮</span>
                  <span
                    className={css({ fontSize: { base: "16px", md: "20px" } })}
                  >
                    ↔️
                  </span>
                  <span>🔢</span>
                </div>
                <div
                  className={css({
                    fontWeight: "bold",
                    fontSize: { base: "12px", sm: "13px", md: "14px" },
                  })}
                >
                  Abacus-Numeral
                </div>
                <div
                  className={css({
                    fontSize: { base: "10px", sm: "11px", md: "12px" },
                    opacity: 0.8,
                    textAlign: "center",
                    display: { base: "none", sm: "block" },
                  })}
                >
                  Match visual patterns
                  <br />
                  with numbers
                </div>
              </div>
            </button>
            <button
              className={getButtonStyles(
                state.gameType === "complement-pairs",
                "secondary",
              )}
              onClick={() => handleSetGameType("complement-pairs")}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: { base: "4px", md: "6px" },
                })}
              >
                <div
                  className={css({
                    fontSize: { base: "20px", sm: "24px", md: "28px" },
                    display: "flex",
                    alignItems: "center",
                    gap: { base: "4px", md: "8px" },
                  })}
                >
                  <span>🤝</span>
                  <span
                    className={css({ fontSize: { base: "16px", md: "20px" } })}
                  >
                    ➕
                  </span>
                  <span>🔟</span>
                </div>
                <div
                  className={css({
                    fontWeight: "bold",
                    fontSize: { base: "12px", sm: "13px", md: "14px" },
                  })}
                >
                  Complement Pairs
                </div>
                <div
                  className={css({
                    fontSize: { base: "10px", sm: "11px", md: "12px" },
                    opacity: 0.8,
                    textAlign: "center",
                    display: { base: "none", sm: "block" },
                  })}
                >
                  Find number friends
                  <br />
                  that add to 5 or 10
                </div>
              </div>
            </button>
          </div>
          <p
            className={css({
              fontSize: { base: "12px", md: "14px" },
              color: "gray.500",
              marginTop: { base: "6px", md: "8px" },
              textAlign: "center",
              display: { base: "none", sm: "block" },
            })}
          >
            {state.gameType === "abacus-numeral"
              ? "Match abacus representations with their numerical values"
              : "Find pairs of numbers that add up to 5 or 10"}
          </p>
        </div>

        {/* Difficulty Selection */}
        <div>
          <label
            className={css({
              display: "block",
              fontSize: { base: "16px", sm: "18px", md: "20px" },
              fontWeight: "bold",
              marginBottom: { base: "12px", md: "16px" },
              color: "gray.700",
            })}
          >
            Difficulty ({state.difficulty} pairs)
          </label>
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: {
                base: "repeat(2, 1fr)",
                sm: "repeat(4, 1fr)",
              },
              gap: { base: "8px", sm: "10px", md: "12px" },
              justifyItems: "stretch",
            })}
          >
            {([6, 8, 12, 15] as const).map((difficulty) => {
              const difficultyInfo = {
                6: {
                  icon: "🌱",
                  label: "Beginner",
                  description: "Perfect to start!",
                },
                8: {
                  icon: "⚡",
                  label: "Medium",
                  description: "Getting spicy!",
                },
                12: {
                  icon: "🔥",
                  label: "Hard",
                  description: "Serious challenge!",
                },
                15: {
                  icon: "💀",
                  label: "Expert",
                  description: "Memory master!",
                },
              };

              return (
                <button
                  key={difficulty}
                  className={getButtonStyles(
                    state.difficulty === difficulty,
                    "difficulty",
                  )}
                  onClick={() => handleSetDifficulty(difficulty)}
                >
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                    })}
                  >
                    <div className={css({ fontSize: "32px" })}>
                      {difficultyInfo[difficulty].icon}
                    </div>
                    <div
                      className={css({ fontSize: "18px", fontWeight: "bold" })}
                    >
                      {difficulty} pairs
                    </div>
                    <div
                      className={css({ fontSize: "14px", fontWeight: "bold" })}
                    >
                      {difficultyInfo[difficulty].label}
                    </div>
                    <div
                      className={css({
                        fontSize: "11px",
                        opacity: 0.9,
                        textAlign: "center",
                      })}
                    >
                      {difficultyInfo[difficulty].description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p
            className={css({
              fontSize: "14px",
              color: "gray.500",
              marginTop: "8px",
            })}
          >
            {state.difficulty} pairs = {state.difficulty * 2} cards total
          </p>
        </div>

        {/* Multi-Player Timer Setting */}
        {activePlayerCount > 1 && (
          <div>
            <label
              className={css({
                display: "block",
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "gray.700",
              })}
            >
              Turn Timer
            </label>
            <div
              className={css({
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
              })}
            >
              {([15, 30, 45, 60] as const).map((timer) => {
                const timerInfo: Record<
                  15 | 30 | 45 | 60,
                  { icon: string; label: string }
                > = {
                  15: { icon: "💨", label: "Lightning" },
                  30: { icon: "⚡", label: "Quick" },
                  45: { icon: "🏃", label: "Standard" },
                  60: { icon: "🧘", label: "Relaxed" },
                };

                return (
                  <button
                    key={timer}
                    className={getButtonStyles(
                      state.turnTimer === timer,
                      "secondary",
                    )}
                    onClick={() => handleSetTurnTimer(timer)}
                  >
                    <div
                      className={css({
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                      })}
                    >
                      <span className={css({ fontSize: "24px" })}>
                        {timerInfo[timer].icon}
                      </span>
                      <span
                        className={css({
                          fontSize: "18px",
                          fontWeight: "bold",
                        })}
                      >
                        {timer}s
                      </span>
                      <span className={css({ fontSize: "12px", opacity: 0.8 })}>
                        {timerInfo[timer].label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p
              className={css({
                fontSize: "14px",
                color: "gray.500",
                marginTop: "8px",
              })}
            >
              Time limit for each player's turn
            </p>
          </div>
        )}

        {/* Start Game Button - Sticky at bottom */}
        <div
          className={css({
            marginTop: "auto", // Push to bottom
            paddingTop: { base: "12px", md: "16px" },
            position: "sticky",
            bottom: 0,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(0,0,0,0.1)",
            margin: "0 -16px -12px -16px", // Extend to edges
            padding: { base: "12px 16px", md: "16px" },
          })}
        >
          <button
            className={css({
              background: canResumeGame
                ? "linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)"
                : "linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff9ff3 100%)",
              color: "white",
              border: "none",
              borderRadius: { base: "16px", sm: "20px", md: "24px" },
              padding: { base: "14px 28px", sm: "16px 32px", md: "18px 36px" },
              fontSize: { base: "16px", sm: "18px", md: "20px" },
              fontWeight: "black",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: canResumeGame
                ? "0 8px 20px rgba(16, 185, 129, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)"
                : "0 8px 20px rgba(255, 107, 107, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              position: "relative",
              overflow: "hidden",
              width: "100%",
              _before: {
                content: '""',
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                transition: "left 0.6s ease",
              },
              _hover: {
                transform: {
                  base: "translateY(-2px)",
                  md: "translateY(-3px) scale(1.02)",
                },
                boxShadow: canResumeGame
                  ? "0 12px 30px rgba(16, 185, 129, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)"
                  : "0 12px 30px rgba(255, 107, 107, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)",
                background: canResumeGame
                  ? "linear-gradient(135deg, #059669 0%, #047857 50%, #10b981 100%)"
                  : "linear-gradient(135deg, #ff5252 0%, #dd2c00 50%, #e91e63 100%)",
                _before: {
                  left: "100%",
                },
              },
              _active: {
                transform: "translateY(-1px) scale(1.01)",
              },
            })}
            onClick={handleStartOrResumeGame}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: { base: "6px", md: "8px" },
                justifyContent: "center",
              })}
            >
              <span
                className={css({
                  fontSize: { base: "18px", sm: "20px", md: "24px" },
                  animation: "bounce 2s infinite",
                })}
              >
                {canResumeGame ? "▶️" : "🚀"}
              </span>
              <span>{canResumeGame ? "RESUME GAME" : "START GAME"}</span>
              <span
                className={css({
                  fontSize: { base: "18px", sm: "20px", md: "24px" },
                  animation: "bounce 2s infinite",
                  animationDelay: "0.5s",
                })}
              >
                {canResumeGame ? "🎮" : "🎮"}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
