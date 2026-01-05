"use client";

import { useComplementRace } from "@/arcade-games/complement-race/Provider";

export function GameResults() {
  const { state, dispatch } = useComplementRace();

  // Determine race outcome
  const playerWon = state.aiRacers.every(
    (racer) => state.correctAnswers > racer.position,
  );
  const playerPosition =
    state.aiRacers.filter((racer) => racer.position >= state.correctAnswers)
      .length + 1;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 40px 40px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "24px",
          padding: "48px",
          maxWidth: "600px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          textAlign: "center",
        }}
      >
        {/* Result Header */}
        <div
          style={{
            fontSize: "64px",
            marginBottom: "16px",
          }}
        >
          {playerWon
            ? "🏆"
            : playerPosition === 2
              ? "🥈"
              : playerPosition === 3
                ? "🥉"
                : "🎯"}
        </div>

        <h1
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            color: "#1f2937",
            marginBottom: "8px",
          }}
        >
          {playerWon
            ? "Victory!"
            : `${playerPosition}${getOrdinalSuffix(playerPosition)} Place`}
        </h1>

        <p
          style={{
            fontSize: "18px",
            color: "#6b7280",
            marginBottom: "32px",
          }}
        >
          {playerWon ? "You beat all the AI racers!" : `You finished the race!`}
        </p>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              background: "#f3f4f6",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              Final Score
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#3b82f6" }}
            >
              {state.score}
            </div>
          </div>

          <div
            style={{
              background: "#f3f4f6",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              Best Streak
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#10b981" }}
            >
              {state.bestStreak} 🔥
            </div>
          </div>

          <div
            style={{
              background: "#f3f4f6",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              Total Questions
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#f59e0b" }}
            >
              {state.totalQuestions}
            </div>
          </div>

          <div
            style={{
              background: "#f3f4f6",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                color: "#6b7280",
                fontSize: "14px",
                marginBottom: "4px",
              }}
            >
              Accuracy
            </div>
            <div
              style={{ fontSize: "28px", fontWeight: "bold", color: "#8b5cf6" }}
            >
              {state.totalQuestions > 0
                ? Math.round(
                    (state.correctAnswers / state.totalQuestions) * 100,
                  )
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Final Standings */}
        <div
          style={{
            marginBottom: "32px",
            textAlign: "left",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: "#1f2937",
              marginBottom: "12px",
            }}
          >
            Final Standings
          </h3>

          {[
            { name: "You", position: state.correctAnswers, icon: "👤" },
            ...state.aiRacers.map((racer) => ({
              name: racer.name,
              position: racer.position,
              icon: racer.icon,
            })),
          ]
            .sort((a, b) => b.position - a.position)
            .map((racer, index) => (
              <div
                key={racer.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  background: racer.name === "You" ? "#eff6ff" : "#f9fafb",
                  borderRadius: "8px",
                  marginBottom: "8px",
                  border: racer.name === "You" ? "2px solid #3b82f6" : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: "bold",
                      color: "#9ca3af",
                      minWidth: "32px",
                    }}
                  >
                    #{index + 1}
                  </div>
                  <div style={{ fontSize: "20px" }}>{racer.icon}</div>
                  <div
                    style={{
                      fontWeight: racer.name === "You" ? "bold" : "normal",
                    }}
                  >
                    {racer.name}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#6b7280",
                  }}
                >
                  {Math.floor(racer.position)}
                </div>
              </div>
            ))}
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={() => dispatch({ type: "RESET_GAME" })}
            style={{
              flex: 1,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 32px",
              borderRadius: "12px",
              fontSize: "18px",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
              transition: "transform 0.2s",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Race Again
          </button>
        </div>
      </div>
    </div>
  );
}

function getOrdinalSuffix(num: number): string {
  if (num === 1) return "st";
  if (num === 2) return "nd";
  if (num === 3) return "rd";
  return "th";
}
