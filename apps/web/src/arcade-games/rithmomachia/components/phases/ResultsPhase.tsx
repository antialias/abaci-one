"use client";

import { css } from "../../../../../styled-system/css";
import { useRithmomachia } from "../../Provider";

/**
 * Results phase: show winner and game summary.
 */
export function ResultsPhase() {
  const { state, resetGame, goToSetup, exitSession, lastError, clearError } =
    useRithmomachia();
  const winnerText = state.winner === "W" ? "White" : "Black";
  const totalMoves = state.history.length;

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        gap: "4",
      })}
    >
      {lastError && (
        <div
          className={css({
            width: "100%",
            maxWidth: "600px",
            p: "4",
            bg: "red.100",
            borderColor: "red.400",
            borderWidth: "2px",
            borderRadius: "md",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <span className={css({ color: "red.800", fontWeight: "semibold" })}>
            ⚠️ {lastError}
          </span>
          <button
            type="button"
            onClick={clearError}
            className={css({
              px: "3",
              py: "1",
              bg: "red.200",
              color: "red.800",
              borderRadius: "sm",
              fontWeight: "semibold",
              cursor: "pointer",
              _hover: { bg: "red.300" },
            })}
          >
            Dismiss
          </button>
        </div>
      )}

      <h1 className={css({ fontSize: "3xl", fontWeight: "bold" })}>
        Game Over
      </h1>

      {state.winner ? (
        <>
          <div
            className={css({
              fontSize: "2xl",
              color: "purple.600",
              fontWeight: "semibold",
            })}
          >
            {winnerText} Wins!
          </div>
          <div className={css({ fontSize: "lg", color: "gray.600" })}>
            Victory by {state.winCondition?.toLowerCase().replace("_", " ")}
          </div>
        </>
      ) : (
        <div className={css({ fontSize: "2xl", color: "gray.600" })}>Draw</div>
      )}

      <div className={css({ display: "flex", gap: "4", mt: "4" })}>
        <div className={css({ p: "4", bg: "gray.100", borderRadius: "md" })}>
          <div className={css({ fontWeight: "bold" })}>White Captured</div>
          <div>{state.capturedPieces.W.length} pieces</div>
        </div>
        <div className={css({ p: "4", bg: "gray.100", borderRadius: "md" })}>
          <div className={css({ fontWeight: "bold" })}>Black Captured</div>
          <div>{state.capturedPieces.B.length} pieces</div>
        </div>
      </div>

      {state.pointsCaptured && (
        <div className={css({ display: "flex", gap: "4" })}>
          <div
            className={css({ p: "4", bg: "purple.100", borderRadius: "md" })}
          >
            <div className={css({ fontWeight: "bold", color: "purple.700" })}>
              White Points
            </div>
            <div className={css({ fontSize: "lg", fontWeight: "semibold" })}>
              {state.pointsCaptured.W}
            </div>
          </div>
          <div
            className={css({ p: "4", bg: "purple.100", borderRadius: "md" })}
          >
            <div className={css({ fontWeight: "bold", color: "purple.700" })}>
              Black Points
            </div>
            <div className={css({ fontSize: "lg", fontWeight: "semibold" })}>
              {state.pointsCaptured.B}
            </div>
          </div>
        </div>
      )}

      <div className={css({ fontSize: "sm", color: "gray.500", mt: "4" })}>
        Total moves: {totalMoves}
      </div>

      {/* Action Buttons */}
      <div
        className={css({
          display: "flex",
          flexDirection: { base: "column", sm: "row" },
          gap: "3",
          mt: "6",
        })}
      >
        <button
          type="button"
          onClick={resetGame}
          className={css({
            px: "6",
            py: "3",
            bg: "purple.600",
            color: "white",
            borderRadius: "md",
            fontWeight: "semibold",
            cursor: "pointer",
            transition: "all 0.2s ease",
            _hover: {
              bg: "purple.700",
              transform: "translateY(-2px)",
            },
          })}
        >
          🎮 Play Again
        </button>

        <button
          type="button"
          onClick={goToSetup}
          className={css({
            px: "6",
            py: "3",
            bg: "white",
            color: "gray.700",
            border: "2px solid",
            borderColor: "gray.300",
            borderRadius: "md",
            fontWeight: "semibold",
            cursor: "pointer",
            transition: "all 0.2s ease",
            _hover: {
              borderColor: "gray.400",
              bg: "gray.50",
            },
          })}
        >
          ⚙️ Settings
        </button>

        <button
          type="button"
          onClick={exitSession}
          className={css({
            px: "6",
            py: "3",
            bg: "white",
            color: "red.700",
            border: "2px solid",
            borderColor: "red.300",
            borderRadius: "md",
            fontWeight: "semibold",
            cursor: "pointer",
            transition: "all 0.2s ease",
            _hover: {
              borderColor: "red.400",
              bg: "red.50",
            },
          })}
        >
          🚪 Exit
        </button>
      </div>
    </div>
  );
}
