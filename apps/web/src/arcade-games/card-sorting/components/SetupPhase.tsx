"use client";

import { AbacusReact } from "@soroban/abacus-react";
import { css } from "../../../../styled-system/css";
import { useCardSorting } from "../Provider";

// Add animations
const animations = `
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

@keyframes shimmer {
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}
`;

// Inject animation styles
if (
  typeof document !== "undefined" &&
  !document.getElementById("card-sorting-animations")
) {
  const style = document.createElement("style");
  style.id = "card-sorting-animations";
  style.textContent = animations;
  document.head.appendChild(style);
}

export function SetupPhase() {
  const { state, setConfig, startGame, resumeGame, canResumeGame } =
    useCardSorting();

  const getButtonStyles = (isSelected: boolean) => {
    return css({
      border: "none",
      borderRadius: { base: "16px", md: "20px" },
      padding: { base: "16px", md: "20px" },
      fontSize: { base: "14px", md: "16px" },
      fontWeight: "bold",
      cursor: "pointer",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      textAlign: "center" as const,
      position: "relative" as const,
      overflow: "hidden" as const,
      background: isSelected
        ? "linear-gradient(135deg, #14b8a6, #0d9488, #0f766e)"
        : "linear-gradient(135deg, #ffffff, #f1f5f9)",
      color: isSelected ? "white" : "#334155",
      boxShadow: isSelected
        ? "0 10px 30px rgba(20, 184, 166, 0.4), inset 0 2px 0 rgba(255,255,255,0.2)"
        : "0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
      textShadow: isSelected ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
      _hover: {
        transform: "translateY(-4px) scale(1.03)",
        boxShadow: isSelected
          ? "0 15px 40px rgba(20, 184, 166, 0.6), inset 0 2px 0 rgba(255,255,255,0.2)"
          : "0 10px 30px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
      },
      _active: {
        transform: "translateY(-2px) scale(1.01)",
      },
    });
  };

  const cardCountInfo = {
    5: {
      icon: "🌱",
      label: "Gentle",
      description: "Perfect to start",
      emoji: "🟢",
      difficulty: "Easy",
    },
    8: {
      icon: "⚡",
      label: "Swift",
      description: "Nice challenge",
      emoji: "🟡",
      difficulty: "Medium",
    },
    12: {
      icon: "🔥",
      label: "Intense",
      description: "Test your memory",
      emoji: "🟠",
      difficulty: "Hard",
    },
    15: {
      icon: "💎",
      label: "Master",
      description: "Ultimate test",
      emoji: "🔴",
      difficulty: "Expert",
    },
  };

  return (
    <div
      className={css({
        textAlign: "center",
        padding: { base: "12px", md: "20px" },
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: { base: "16px", md: "24px" },
        minHeight: 0,
        overflow: "auto",
      })}
    >
      {/* Hero Section */}
      <div
        className={css({
          background: "linear-gradient(135deg, #0f766e, #14b8a6, #2dd4bf)",
          borderRadius: { base: "16px", md: "20px" },
          padding: { base: "20px 16px 28px", md: "24px 24px 36px" },
          boxShadow: "0 20px 60px rgba(20, 184, 166, 0.3)",
          position: "relative",
          overflow: "visible",
          minHeight: { base: "240px", md: "260px" },
        })}
      >
        {/* Animated background pattern */}
        <div
          className={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            background:
              "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
          })}
        />

        <div className={css({ position: "relative", zIndex: 1 })}>
          <h1
            className={css({
              fontSize: { base: "28px", sm: "32px", md: "40px" },
              fontWeight: "black",
              color: "white",
              marginBottom: "8px",
              textShadow: "0 4px 12px rgba(0,0,0,0.3)",
              letterSpacing: "-0.02em",
            })}
          >
            🎴 Card Sorting Challenge
          </h1>
          <p
            className={css({
              fontSize: { base: "14px", md: "16px" },
              color: "rgba(255,255,255,0.95)",
              maxWidth: "600px",
              margin: "0 auto",
              lineHeight: 1.5,
              fontWeight: 500,
            })}
          >
            Arrange abacus cards in order using{" "}
            <strong>only visual patterns</strong> — no numbers shown!
          </p>

          {/* Sample cards preview */}
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              gap: { base: "6px", md: "8px" },
              marginTop: "12px",
              flexWrap: "wrap",
            })}
          >
            {[3, 7, 12].map((value, idx) => (
              <div
                key={value}
                className={css({
                  background: "white",
                  borderRadius: "8px",
                  padding: { base: "6px", md: "8px" },
                  boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
                  transform: `rotate(${(idx - 1) * 3}deg)`,
                  animation: "float 3s ease-in-out infinite",
                  animationDelay: `${idx * 0.3}s`,
                  width: { base: "60px", md: "70px" },
                  height: { base: "75px", md: "85px" },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <div
                  className={css({
                    transform: "scale(0.35)",
                    transformOrigin: "center",
                  })}
                >
                  <AbacusReact value={value} columns={2} showNumbers={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card Count Selection */}
      <div>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: { base: "12px", md: "16px" },
          })}
        >
          <span
            className={css({
              fontSize: { base: "24px", md: "28px" },
            })}
          >
            🎯
          </span>
          <h2
            className={css({
              fontSize: { base: "20px", md: "24px" },
              fontWeight: "bold",
              color: "gray.800",
              margin: 0,
            })}
          >
            Choose Your Challenge
          </h2>
        </div>

        <div
          className={css({
            display: "grid",
            gridTemplateColumns: {
              base: "repeat(2, 1fr)",
              sm: "repeat(4, 1fr)",
            },
            gap: { base: "12px", md: "16px" },
          })}
        >
          {([5, 8, 12, 15] as const).map((count) => {
            const info = cardCountInfo[count];
            return (
              <button
                key={count}
                type="button"
                onClick={() => setConfig("cardCount", count)}
                className={getButtonStyles(state.cardCount === count)}
              >
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: { base: "6px", md: "8px" },
                  })}
                >
                  <div
                    className={css({
                      fontSize: { base: "36px", md: "44px" },
                      lineHeight: 1,
                    })}
                  >
                    {info.icon}
                  </div>
                  <div
                    className={css({
                      fontSize: { base: "24px", md: "28px" },
                      fontWeight: "black",
                      lineHeight: 1,
                    })}
                  >
                    {count}
                  </div>
                  <div
                    className={css({
                      fontSize: { base: "13px", md: "15px" },
                      fontWeight: "bold",
                      opacity: 0.9,
                    })}
                  >
                    {info.label}
                  </div>
                  <div
                    className={css({
                      fontSize: { base: "11px", md: "12px" },
                      opacity: 0.8,
                      display: { base: "none", sm: "block" },
                    })}
                  >
                    {info.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className={css({
            marginTop: "12px",
            padding: { base: "12px", md: "14px" },
            background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
            borderRadius: "10px",
            border: "2px solid",
            borderColor: "teal.200",
          })}
        >
          <p
            className={css({
              fontSize: { base: "13px", md: "15px" },
              color: "teal.800",
              margin: 0,
              fontWeight: 600,
            })}
          >
            {cardCountInfo[state.cardCount].emoji}{" "}
            <strong>{state.cardCount} cards</strong> •{" "}
            {cardCountInfo[state.cardCount].difficulty} difficulty •{" "}
            {cardCountInfo[state.cardCount].description}
          </p>
        </div>
      </div>

      {/* Start Button */}
      <div
        className={css({
          marginTop: "auto",
          paddingTop: { base: "8px", md: "12px" },
        })}
      >
        {canResumeGame && (
          <button
            type="button"
            onClick={resumeGame}
            className={css({
              width: "100%",
              background:
                "linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)",
              color: "white",
              border: "none",
              borderRadius: { base: "16px", md: "20px" },
              padding: { base: "16px", md: "20px" },
              fontSize: { base: "18px", md: "22px" },
              fontWeight: "black",
              cursor: "pointer",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow:
                "0 10px 30px rgba(16, 185, 129, 0.4), inset 0 2px 0 rgba(255,255,255,0.3)",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              marginBottom: "12px",
              _hover: {
                transform: "translateY(-4px) scale(1.02)",
                boxShadow:
                  "0 15px 40px rgba(16, 185, 129, 0.6), inset 0 2px 0 rgba(255,255,255,0.3)",
              },
              _active: {
                transform: "translateY(-2px) scale(1.01)",
              },
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "12px",
                justifyContent: "center",
              })}
            >
              <span
                className={css({
                  fontSize: { base: "24px", md: "28px" },
                  animation: "bounce 2s infinite",
                })}
              >
                ▶️
              </span>
              <span>RESUME GAME</span>
              <span
                className={css({
                  fontSize: { base: "24px", md: "28px" },
                  animation: "bounce 2s infinite",
                  animationDelay: "0.5s",
                })}
              >
                🎮
              </span>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={startGame}
          className={css({
            width: "100%",
            background: canResumeGame
              ? "linear-gradient(135deg, #64748b, #475569)"
              : "linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #5eead4 100%)",
            color: "white",
            border: "none",
            borderRadius: { base: "16px", md: "20px" },
            padding: { base: "14px", md: "18px" },
            fontSize: { base: "18px", md: "20px" },
            fontWeight: "black",
            cursor: "pointer",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: canResumeGame
              ? "0 8px 20px rgba(100, 116, 139, 0.4), inset 0 2px 0 rgba(255,255,255,0.2)"
              : "0 10px 30px rgba(20, 184, 166, 0.5), inset 0 2px 0 rgba(255,255,255,0.3)",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            position: "relative",
            overflow: "hidden",
            _before: {
              content: '""',
              position: "absolute",
              top: 0,
              left: "-200%",
              width: "200%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
              backgroundSize: "200% 100%",
            },
            _hover: {
              transform: "translateY(-4px) scale(1.02)",
              boxShadow: canResumeGame
                ? "0 12px 35px rgba(100, 116, 139, 0.6), inset 0 2px 0 rgba(255,255,255,0.2)"
                : "0 15px 40px rgba(20, 184, 166, 0.7), inset 0 2px 0 rgba(255,255,255,0.3)",
              _before: {
                animation: "shimmer 1.5s ease-in-out",
              },
            },
            _active: {
              transform: "translateY(-2px) scale(1.01)",
            },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: { base: "8px", md: "10px" },
              justifyContent: "center",
            })}
          >
            <span
              className={css({
                fontSize: { base: "22px", md: "26px" },
                animation: canResumeGame ? "none" : "bounce 2s infinite",
              })}
            >
              🚀
            </span>
            <span>{canResumeGame ? "START NEW GAME" : "START GAME"}</span>
            <span
              className={css({
                fontSize: { base: "22px", md: "26px" },
                animation: canResumeGame ? "none" : "bounce 2s infinite",
                animationDelay: "0.5s",
              })}
            >
              🎴
            </span>
          </div>
        </button>

        {!canResumeGame && (
          <p
            className={css({
              fontSize: { base: "12px", md: "13px" },
              color: "gray.500",
              marginTop: "8px",
              fontStyle: "italic",
            })}
          >
            💡 Tip: Look for patterns in the beads — focus on positions, not
            numbers!
          </p>
        )}
      </div>
    </div>
  );
}
