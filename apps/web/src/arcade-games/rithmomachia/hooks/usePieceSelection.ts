import { useCallback, useState } from "react";
import type { Color, Piece } from "../types";
import { validateMove } from "../utils/pathValidator";

/**
 * Callbacks for piece selection events
 */
export interface PieceSelectionCallbacks {
  onMove: (from: string, to: string, pieceId: string) => void;
  onCaptureAttempt: (from: string, to: string, pieceId: string) => void;
}

/**
 * Hook for managing piece selection state and logic
 */
export function usePieceSelection(
  pieces: Record<string, Piece>,
  playerColor: Color | null,
  isMyTurn: boolean,
  callbacks: PieceSelectionCallbacks,
) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const handleSquareClick = useCallback(
    (square: string, piece: Piece | undefined) => {
      if (!isMyTurn) return;

      // If no piece selected, select this piece if it's yours
      if (!selectedSquare) {
        if (piece && piece.color === playerColor) {
          setSelectedSquare(square);
        }
        return;
      }

      // If clicking the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      // If clicking another piece of yours, select that instead
      if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        return;
      }

      // Otherwise, attempt to move
      const selectedPiece = Object.values(pieces).find(
        (p) => p.square === selectedSquare && !p.captured,
      );
      if (selectedPiece) {
        // Validate the move is legal before proceeding
        const validation = validateMove(
          selectedPiece,
          selectedSquare,
          square,
          pieces,
        );

        if (!validation.valid) {
          // Invalid move - silently ignore
          return;
        }

        // If target square has an enemy piece, open capture dialog
        if (piece && piece.color !== playerColor) {
          callbacks.onCaptureAttempt(selectedSquare, square, selectedPiece.id);
        } else {
          // Simple move (no capture)
          callbacks.onMove(selectedSquare, square, selectedPiece.id);
          setSelectedSquare(null);
        }
      }
    },
    [selectedSquare, isMyTurn, playerColor, pieces, callbacks],
  );

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
  }, []);

  return {
    selectedSquare,
    handleSquareClick,
    clearSelection,
  };
}
