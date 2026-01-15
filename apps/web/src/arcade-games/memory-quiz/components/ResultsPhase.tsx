import { useAbacusConfig } from "@soroban/abacus-react";
import { useMemoryQuiz } from "../Provider";
import {
  DIFFICULTY_LEVELS,
  type DifficultyLevel,
  type QuizCard,
} from "../types";
import { ResultsCardGrid } from "./ResultsCardGrid";

// Generate quiz cards with difficulty-based number ranges
const generateQuizCards = (
  count: number,
  difficulty: DifficultyLevel,
  appConfig: any,
): QuizCard[] => {
  const { min, max } = DIFFICULTY_LEVELS[difficulty].range;

  // Generate unique numbers - no duplicates allowed
  const numbers: number[] = [];
  const maxAttempts = (max - min + 1) * 10; // Prevent infinite loops
  let attempts = 0;

  while (numbers.length < count && attempts < maxAttempts) {
    const newNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!numbers.includes(newNumber)) {
      numbers.push(newNumber);
    }
    attempts++;
  }

  // If we couldn't generate enough unique numbers, fill with sequential numbers
  if (numbers.length < count) {
    for (let i = min; i <= max && numbers.length < count; i++) {
      if (!numbers.includes(i)) {
        numbers.push(i);
      }
    }
  }

  return numbers.map((number) => ({
    number,
    svgComponent: <div />, // Placeholder - not used in results phase
    element: null,
  }));
};

export function ResultsPhase() {
  const { state, resetGame, startQuiz } = useMemoryQuiz();
  const appConfig = useAbacusConfig();
  const correct = state.foundNumbers.length;
  const total = state.correctAnswers.length;
  const percentage = Math.round((correct / total) * 100);

  return (
    <div
      style={{
        textAlign: "center",
        padding: "12px",
        maxWidth: "800px",
        margin: "0 auto",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
    >
      <h3
        style={{
          marginBottom: "20px",
          color: "#1f2937",
          fontSize: "18px",
          fontWeight: 600,
        }}
      >
        Quiz Results
      </h3>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          marginBottom: "20px",
          padding: "16px",
          background: "#f9fafb",
          borderRadius: "8px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(45deg, #3b82f6, #2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "18px",
            fontWeight: "bold",
          }}
        >
          <span>{percentage}%</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "16px",
            }}
          >
            <span style={{ fontWeight: 500, color: "#6b7280" }}>Correct:</span>
            <span style={{ fontWeight: "bold" }}>{correct}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              fontSize: "16px",
            }}
          >
            <span style={{ fontWeight: 500, color: "#6b7280" }}>Total:</span>
            <span style={{ fontWeight: "bold" }}>{total}</span>
          </div>
        </div>
      </div>

      {/* Multiplayer Leaderboard - Competitive Mode */}
      {state.playMode === "competitive" &&
        state.activePlayers &&
        state.activePlayers.length > 1 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "16px",
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              borderRadius: "12px",
              border: "2px solid #f59e0b",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#92400e",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              🏆 FINAL LEADERBOARD
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {(() => {
                // Group players by userId
                const userTeams = new Map<
                  string,
                  {
                    userId: string;
                    players: any[];
                    score: { correct: number; incorrect: number };
                  }
                >();

                console.log("🏆 [ResultsPhase] Building leaderboard:", {
                  activePlayers: state.activePlayers,
                  playerMetadata: state.playerMetadata,
                  playerScores: state.playerScores,
                });

                for (const playerId of state.activePlayers) {
                  const metadata = state.playerMetadata?.[playerId];
                  const userId = metadata?.userId;
                  console.log(
                    "🏆 [ResultsPhase] Processing player for leaderboard:",
                    {
                      playerId,
                      metadata,
                      userId,
                    },
                  );
                  if (!userId) continue;

                  if (!userTeams.has(userId)) {
                    userTeams.set(userId, {
                      userId,
                      players: [],
                      score: state.playerScores?.[userId] || {
                        correct: 0,
                        incorrect: 0,
                      },
                    });
                  }
                  userTeams.get(userId)!.players.push(metadata);
                }

                console.log("🏆 [ResultsPhase] UserTeams created:", {
                  count: userTeams.size,
                  teams: Array.from(userTeams.entries()),
                });

                // Sort teams by score
                return Array.from(userTeams.values())
                  .sort((a, b) => {
                    const aScore = a.score.correct - a.score.incorrect * 0.5;
                    const bScore = b.score.correct - b.score.incorrect * 0.5;
                    return bScore - aScore;
                  })
                  .map((team, index) => {
                    const netScore =
                      team.score.correct - team.score.incorrect * 0.5;
                    return (
                      <div
                        key={team.userId}
                        style={{
                          padding: "14px 16px",
                          background:
                            index === 0
                              ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 50%)"
                              : "white",
                          borderRadius: "10px",
                          border:
                            index === 0
                              ? "3px solid #f59e0b"
                              : "1px solid #e5e7eb",
                          boxShadow:
                            index === 0
                              ? "0 4px 12px rgba(245, 158, 11, 0.3)"
                              : "none",
                        }}
                      >
                        {/* Team header with rank and stats */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span
                              style={{ fontSize: "24px", minWidth: "32px" }}
                            >
                              {index === 0
                                ? "🏆"
                                : index === 1
                                  ? "🥈"
                                  : index === 2
                                    ? "🥉"
                                    : `${index + 1}.`}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: "bold",
                                  fontSize: index === 0 ? "20px" : "18px",
                                  color: index === 0 ? "#f59e0b" : "#1f2937",
                                }}
                              >
                                {netScore.toFixed(1)}
                              </span>
                              {index === 0 && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "#92400e",
                                    fontWeight: "bold",
                                  }}
                                >
                                  CHAMPION
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  color: "#10b981",
                                  fontWeight: "bold",
                                  fontSize: "16px",
                                }}
                              >
                                ✓{team.score.correct}
                              </span>
                              <span
                                style={{ fontSize: "10px", color: "#6b7280" }}
                              >
                                correct
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  color: "#ef4444",
                                  fontWeight: "bold",
                                  fontSize: "16px",
                                }}
                              >
                                ✗{team.score.incorrect}
                              </span>
                              <span
                                style={{ fontSize: "10px", color: "#6b7280" }}
                              >
                                wrong
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Players list */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            paddingLeft: "42px",
                          }}
                        >
                          {team.players.map((player, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ fontSize: "18px" }}>
                                {player?.emoji || "🎮"}
                              </span>
                              <span
                                style={{
                                  color: "#1f2937",
                                  fontWeight: 500,
                                  fontSize: "14px",
                                }}
                              >
                                {player?.name || `Player ${i + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        )}

      {/* Multiplayer Stats - Cooperative Mode */}
      {state.playMode === "cooperative" &&
        state.activePlayers &&
        state.activePlayers.length > 1 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "16px",
              background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
              borderRadius: "12px",
              border: "2px solid #3b82f6",
            }}
          >
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                color: "#1e3a8a",
                marginBottom: "12px",
                textAlign: "center",
              }}
            >
              🤝 TEAM CONTRIBUTIONS
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {(() => {
                // Group players by userId
                const userTeams = new Map<
                  string,
                  {
                    userId: string;
                    players: any[];
                    score: { correct: number; incorrect: number };
                  }
                >();

                console.log("🤝 [ResultsPhase] Building team contributions:", {
                  activePlayers: state.activePlayers,
                  playerMetadata: state.playerMetadata,
                  playerScores: state.playerScores,
                });

                for (const playerId of state.activePlayers) {
                  const metadata = state.playerMetadata?.[playerId];
                  const userId = metadata?.userId;
                  console.log(
                    "🤝 [ResultsPhase] Processing player for contributions:",
                    {
                      playerId,
                      metadata,
                      userId,
                    },
                  );
                  if (!userId) continue;

                  if (!userTeams.has(userId)) {
                    userTeams.set(userId, {
                      userId,
                      players: [],
                      score: state.playerScores?.[userId] || {
                        correct: 0,
                        incorrect: 0,
                      },
                    });
                  }
                  userTeams.get(userId)!.players.push(metadata);
                }

                console.log(
                  "🤝 [ResultsPhase] UserTeams created for contributions:",
                  {
                    count: userTeams.size,
                    teams: Array.from(userTeams.entries()),
                  },
                );

                // Sort teams by correct answers
                return Array.from(userTeams.values())
                  .sort((a, b) => b.score.correct - a.score.correct)
                  .map((team, index) => (
                    <div
                      key={team.userId}
                      style={{
                        padding: "12px 14px",
                        background: "white",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {/* Team header with stats */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              color: "#6b7280",
                            }}
                          >
                            Team {index + 1}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            fontSize: "14px",
                          }}
                        >
                          <span
                            style={{ color: "#10b981", fontWeight: "bold" }}
                          >
                            ✓ {team.score.correct}
                          </span>
                          <span
                            style={{ color: "#ef4444", fontWeight: "bold" }}
                          >
                            ✗ {team.score.incorrect}
                          </span>
                        </div>
                      </div>
                      {/* Players list */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          paddingLeft: "8px",
                        }}
                      >
                        {team.players.map((player, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "13px",
                            }}
                          >
                            <span style={{ fontSize: "18px" }}>
                              {player?.emoji || "🎮"}
                            </span>
                            <span
                              style={{
                                color: "#1f2937",
                                fontWeight: 500,
                              }}
                            >
                              {player?.name || `Player ${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
              })()}
            </div>
          </div>
        )}

      {/* Results card grid - reuse CardGrid but with all cards revealed and status indicators */}
      <div style={{ marginTop: "12px", flex: 1, overflow: "auto" }}>
        <ResultsCardGrid state={state} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          style={{
            padding: "10px 20px",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: "#10b981",
            color: "white",
            minWidth: "120px",
          }}
          onClick={() => {
            resetGame?.();
            const quizCards = generateQuizCards(
              state.selectedCount,
              state.selectedDifficulty,
              appConfig,
            );
            startQuiz?.(quizCards);
          }}
        >
          Try Again
        </button>
        <button
          style={{
            padding: "10px 20px",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: "#6b7280",
            color: "white",
            minWidth: "120px",
          }}
          onClick={() => resetGame?.()}
        >
          Back to Cards
        </button>
      </div>
    </div>
  );
}
