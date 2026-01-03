import type { Piece, PieceType } from "../types";
import { makeSquare, parseSquare } from "../types";

/**
 * Path validation for Rithmomachia piece movement.
 * Checks if a move is geometrically legal and the path is clear.
 */

export interface PathValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Check if a move is geometrically legal for a given piece type.
 * Does NOT check if the path is clear (that's done separately).
 */
export function isGeometryLegal(
  pieceType: PieceType,
  from: string,
  to: string,
): PathValidationResult {
  if (from === to) {
    return { valid: false, reason: "Cannot move to the same square" };
  }

  const fromCoords = parseSquare(from);
  const toCoords = parseSquare(to);

  const deltaFile = toCoords.file - fromCoords.file;
  const deltaRank = toCoords.rank - fromCoords.rank;

  const absDeltaFile = Math.abs(deltaFile);
  const absDeltaRank = Math.abs(deltaRank);

  switch (pieceType) {
    case "C": {
      // Circle: diagonal only (like bishop)
      if (absDeltaFile === absDeltaRank && absDeltaFile > 0) {
        return { valid: true };
      }
      return { valid: false, reason: "Circles move diagonally" };
    }

    case "T": {
      // Triangle: orthogonal only (like rook)
      if (
        (deltaFile === 0 && deltaRank !== 0) ||
        (deltaRank === 0 && deltaFile !== 0)
      ) {
        return { valid: true };
      }
      return { valid: false, reason: "Triangles move orthogonally" };
    }

    case "S": {
      // Square: queen-like (orthogonal or diagonal)
      const isDiagonal = absDeltaFile === absDeltaRank && absDeltaFile > 0;
      const isOrthogonal =
        (deltaFile === 0 && deltaRank !== 0) ||
        (deltaRank === 0 && deltaFile !== 0);
      if (isDiagonal || isOrthogonal) {
        return { valid: true };
      }
      return {
        valid: false,
        reason: "Squares move orthogonally or diagonally",
      };
    }

    case "P": {
      // Pyramid: king-like (1 step in any direction)
      if (
        absDeltaFile <= 1 &&
        absDeltaRank <= 1 &&
        (absDeltaFile > 0 || absDeltaRank > 0)
      ) {
        return { valid: true };
      }
      return { valid: false, reason: "Pyramids move 1 step in any direction" };
    }

    default:
      return { valid: false, reason: "Unknown piece type" };
  }
}

/**
 * Check if the path from 'from' to 'to' is clear (no pieces in between).
 * Assumes the geometry is already validated.
 */
export function isPathClear(
  pieces: Record<string, Piece>,
  from: string,
  to: string,
): PathValidationResult {
  const fromCoords = parseSquare(from);
  const toCoords = parseSquare(to);

  const deltaFile = toCoords.file - fromCoords.file;
  const deltaRank = toCoords.rank - fromCoords.rank;

  // Calculate step direction
  const stepFile = deltaFile === 0 ? 0 : deltaFile > 0 ? 1 : -1;
  const stepRank = deltaRank === 0 ? 0 : deltaRank > 0 ? 1 : -1;

  // Calculate number of steps (excluding start and end)
  const steps = Math.max(Math.abs(deltaFile), Math.abs(deltaRank)) - 1;

  // Check each intermediate square
  let currentFile = fromCoords.file + stepFile;
  let currentRank = fromCoords.rank + stepRank;

  for (let i = 0; i < steps; i++) {
    const square = makeSquare(currentFile, currentRank);
    const pieceAtSquare = Object.values(pieces).find(
      (p) => p.square === square && !p.captured,
    );

    if (pieceAtSquare) {
      return {
        valid: false,
        reason: `Path blocked by ${pieceAtSquare.id} at ${square}`,
      };
    }

    currentFile += stepFile;
    currentRank += stepRank;
  }

  return { valid: true };
}

/**
 * Validate a complete move (geometry + path clearance).
 */
export function validateMove(
  piece: Piece,
  from: string,
  to: string,
  pieces: Record<string, Piece>,
): PathValidationResult {
  // Check geometry
  const geometryCheck = isGeometryLegal(piece.type, from, to);
  if (!geometryCheck.valid) {
    return geometryCheck;
  }

  // Check path clearance
  const pathCheck = isPathClear(pieces, from, to);
  if (!pathCheck.valid) {
    return pathCheck;
  }

  return { valid: true };
}

/**
 * Get all legal move destinations for a piece (ignoring captures/relations).
 * Returns an array of square notations.
 */
export function getLegalMoves(
  piece: Piece,
  pieces: Record<string, Piece>,
): string[] {
  const legalMoves: string[] = [];

  // Generate all possible squares on the board
  for (let file = 0; file < 16; file++) {
    for (let rank = 1; rank <= 8; rank++) {
      const targetSquare = makeSquare(file, rank);

      // Skip if same square
      if (targetSquare === piece.square) continue;

      // Check if move is legal
      const validation = validateMove(
        piece,
        piece.square,
        targetSquare,
        pieces,
      );
      if (validation.valid) {
        legalMoves.push(targetSquare);
      }
    }
  }

  return legalMoves;
}

/**
 * Check if a square is within board bounds.
 */
export function isSquareValid(square: string): boolean {
  if (square.length !== 2) return false;

  const file = square.charCodeAt(0) - 65; // A=0, B=1, ..., P=15
  const rank = Number.parseInt(square[1], 10);

  return file >= 0 && file <= 15 && rank >= 1 && rank <= 8;
}

/**
 * Get the direction of movement (for UI purposes).
 */
export function getDirection(
  from: string,
  to: string,
): {
  horizontal: "left" | "right" | "none";
  vertical: "up" | "down" | "none";
} {
  const fromCoords = parseSquare(from);
  const toCoords = parseSquare(to);

  const deltaFile = toCoords.file - fromCoords.file;
  const deltaRank = toCoords.rank - fromCoords.rank;

  return {
    horizontal: deltaFile < 0 ? "left" : deltaFile > 0 ? "right" : "none",
    vertical: deltaRank < 0 ? "down" : deltaRank > 0 ? "up" : "none",
  };
}
