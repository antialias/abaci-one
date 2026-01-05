import { AbacusReact } from "@soroban/abacus-react";
import type { MemoryQuizState } from "../types";

interface ResultsCardGridProps {
  state: MemoryQuizState;
}

export function ResultsCardGrid({ state }: ResultsCardGridProps) {
  if (state.quizCards.length === 0) return null;

  // Calculate optimal grid layout based on number of cards (same as CardGrid)
  const cardCount = state.quizCards.length;

  // Define static grid classes that Panda can generate (same as CardGrid)
  const getGridClass = (count: number) => {
    if (count <= 2) return "repeat(2, 1fr)";
    if (count <= 4) return "repeat(2, 1fr)";
    if (count <= 6) return "repeat(3, 1fr)";
    if (count <= 9) return "repeat(3, 1fr)";
    if (count <= 12) return "repeat(4, 1fr)";
    return "repeat(5, 1fr)";
  };

  const getCardSize = (count: number) => {
    if (count <= 2) return { minSize: "180px", cardHeight: "160px" };
    if (count <= 4) return { minSize: "160px", cardHeight: "150px" };
    if (count <= 6) return { minSize: "140px", cardHeight: "140px" };
    if (count <= 9) return { minSize: "120px", cardHeight: "130px" };
    if (count <= 12) return { minSize: "110px", cardHeight: "120px" };
    return { minSize: "100px", cardHeight: "110px" };
  };

  const gridClass = getGridClass(cardCount);
  const cardSize = getCardSize(cardCount);

  return (
    <div>
      <div
        style={{
          display: "grid",
          gap: "8px",
          padding: "6px",
          justifyContent: "center",
          maxWidth: "100%",
          margin: "0 auto",
          gridTemplateColumns: gridClass,
        }}
      >
        {state.quizCards.map((card, index) => {
          const isRevealed = true; // All cards revealed in results
          const wasFound = state.foundNumbers.includes(card.number);

          return (
            <div
              key={`${card.number}-${index}`}
              style={{
                perspective: "1000px",
                position: "relative",
                aspectRatio: "3/4",
                height: cardSize.cardHeight,
                minWidth: cardSize.minSize,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  textAlign: "center",
                  transition: "transform 0.8s",
                  transformStyle: "preserve-3d",
                  transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Card back (hidden state) - not visible in results */}
                <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    backfaceVisibility: "hidden",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    background: "linear-gradient(135deg, #6c5ce7, #a29bfe)",
                    color: "white",
                    fontSize: "24px",
                    fontWeight: "bold",
                    textShadow: "1px 1px 2px rgba(0, 0, 0, 0.3)",
                    border: "2px solid #5f3dc4",
                  }}
                >
                  <div style={{ opacity: 0.8 }}>?</div>
                </div>

                {/* Card front (revealed state) with success/failure indicators */}
                <div
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    backfaceVisibility: "hidden",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    background: "white",
                    border: "2px solid",
                    borderColor: wasFound ? "#10b981" : "#ef4444",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      padding: "4px",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <AbacusReact
                        value={card.number}
                        columns="auto"
                        beadShape="diamond"
                        colorScheme="place-value"
                        hideInactiveBeads={false}
                        scaleFactor={1.2}
                        interactive={false}
                        showNumbers={false}
                        animated={false}
                      />
                    </div>
                  </div>

                  {/* Player indicator overlay */}
                  <div
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      minWidth: wasFound ? "24px" : "20px",
                      minHeight: "20px",
                      maxHeight: "48px",
                      borderRadius: wasFound ? "8px" : "50%",
                      background: wasFound ? "#10b981" : "#ef4444",
                      color: "white",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: wasFound ? "14px" : "12px",
                      fontWeight: "bold",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
                      padding: wasFound ? "2px" : "0",
                      gap: "1px",
                      overflow: "hidden",
                    }}
                  >
                    {wasFound
                      ? (() => {
                          // Get the userId who found this number
                          const foundByUserId =
                            state.numberFoundBy?.[card.number];
                          if (!foundByUserId) return "✓";

                          // Get all players on that team
                          const teamPlayers = state.activePlayers
                            ?.filter((playerId) => {
                              const metadata = state.playerMetadata?.[playerId];
                              return metadata?.userId === foundByUserId;
                            })
                            .map((playerId) => state.playerMetadata?.[playerId])
                            .filter(Boolean);

                          if (!teamPlayers || teamPlayers.length === 0)
                            return "✓";

                          // Display emojis (stacked vertically if multiple)
                          return teamPlayers.map((player, idx) => (
                            <span
                              key={idx}
                              style={{
                                lineHeight: "1",
                                fontSize: "14px",
                              }}
                            >
                              {player?.emoji || "🎮"}
                            </span>
                          ));
                        })()
                      : "✗"}
                  </div>

                  {/* Number label overlay */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "4px",
                      left: "4px",
                      padding: "2px 4px",
                      borderRadius: "3px",
                      background: "rgba(0, 0, 0, 0.7)",
                      color: "white",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    {card.number}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row for large numbers of cards (same as CardGrid) */}
      {cardCount > 8 && (
        <div
          style={{
            marginTop: "8px",
            padding: "6px 8px",
            background: "#eff6ff",
            borderRadius: "6px",
            border: "1px solid #bfdbfe",
            textAlign: "center",
            fontSize: "12px",
            color: "#1d4ed8",
          }}
        >
          <strong>{state.foundNumbers.length}</strong> of{" "}
          <strong>{cardCount}</strong> cards found
          {state.foundNumbers.length > 0 && (
            <span style={{ marginLeft: "6px", fontWeight: "normal" }}>
              ({Math.round((state.foundNumbers.length / cardCount) * 100)}%
              complete)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
