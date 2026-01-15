/**
 * Parse the Rithmomachia board setup CSV and generate piece setup.
 *
 * CSV Format:
 * - Portrait orientation: black at top, white at bottom
 * - 8 columns (CSV horizontal) = 8 rows in game (1-8)
 * - 16 ranks (CSV vertical, triplets) = 16 columns in game (A-P)
 * - Each rank is 3 CSV rows: [color, shape, number]
 *
 * Game Rotation:
 * - Board is rotated 90° counterclockwise from CSV
 * - CSV column 0 → game row 1 (bottom)
 * - CSV column 7 → game row 8 (top)
 * - CSV rank 0 → game column A (leftmost, black side)
 * - CSV rank 15 → game column P (rightmost, white side)
 */

import type { Color, Piece, PieceType } from "../types";

interface CSVPiece {
  color: Color;
  type: PieceType;
  value?: number;
  pyramidFaces?: number[];
  square: string;
}

/**
 * Parse CSV content into structured board layout.
 */
export function parseCSV(csvContent: string): CSVPiece[] {
  const lines = csvContent.trim().split("\n");
  const pieces: CSVPiece[] = [];

  // Process in triplets (color, shape, number)
  for (let rankIndex = 0; rankIndex < 16; rankIndex++) {
    const colorRowIndex = rankIndex * 3;
    const shapeRowIndex = rankIndex * 3 + 1;
    const numberRowIndex = rankIndex * 3 + 2;

    if (numberRowIndex >= lines.length) break;

    const colorRow = lines[colorRowIndex].split(",");
    const shapeRow = lines[shapeRowIndex].split(",");
    const numberRow = lines[numberRowIndex].split(",");

    // Process each column (8 total)
    for (let colIndex = 0; colIndex < 8; colIndex++) {
      const color = colorRow[colIndex]?.trim();
      const shape = shapeRow[colIndex]?.trim();
      const numberStr = numberRow[colIndex]?.trim();

      // Skip empty cells
      if (!color || !shape || !numberStr) continue;

      // Map CSV position to game square
      // CSV column → game row (1-8)
      // CSV rank → game column (A-P)
      const gameRow = colIndex + 1; // CSV col 0 → row 1, col 7 → row 8
      const gameCol = String.fromCharCode(65 + rankIndex); // rank 0 → A, rank 15 → P
      const square = `${gameCol}${gameRow}`;

      // Parse color
      const pieceColor: Color = color.toLowerCase() === "black" ? "B" : "W";

      // Parse type
      let pieceType: PieceType;
      const shapeLower = shape.toLowerCase();
      if (shapeLower === "circle") pieceType = "C";
      else if (shapeLower === "triangle" || shapeLower === "traingle")
        pieceType = "T"; // Handle typo
      else if (shapeLower === "square") pieceType = "S";
      else if (shapeLower === "pyramid") pieceType = "P";
      else {
        console.warn(`Unknown shape "${shape}" at ${square}`);
        continue;
      }

      // Parse value/pyramid faces
      if (pieceType === "P") {
        // Pyramid - for now use default faces, we'll need to determine these
        pieces.push({
          color: pieceColor,
          type: pieceType,
          pyramidFaces: pieceColor === "B" ? [36, 25, 16, 4] : [64, 49, 36, 25],
          square,
        });
      } else {
        const value = parseInt(numberStr, 10);
        if (isNaN(value)) {
          console.warn(`Invalid number "${numberStr}" at ${square}`);
          continue;
        }

        pieces.push({
          color: pieceColor,
          type: pieceType,
          value,
          square,
        });
      }
    }
  }

  return pieces;
}

/**
 * Convert CSV pieces to full Piece objects with IDs.
 */
export function createBoardFromCSV(
  csvPieces: CSVPiece[],
): Record<string, Piece> {
  const pieces: Record<string, Piece> = {};

  // Count pieces by color and type for ID generation
  const counts = {
    B: { C: 0, T: 0, S: 0, P: 0 },
    W: { C: 0, T: 0, S: 0, P: 0 },
  };

  for (const csvPiece of csvPieces) {
    const color = csvPiece.color;
    const type = csvPiece.type;

    // Generate piece ID
    const count = ++counts[color][type];
    const id = `${color}_${type}_${String(count).padStart(2, "0")}`;

    // Create full piece
    const piece: Piece = {
      id,
      color,
      type,
      square: csvPiece.square,
      captured: false,
    };

    if (type === "P") {
      piece.pyramidFaces = csvPiece.pyramidFaces;
      piece.activePyramidFace = null;
    } else {
      piece.value = csvPiece.value;
    }

    pieces[id] = piece;
  }

  return pieces;
}

/**
 * Main entry point: read CSV and generate board.
 */
export async function loadBoardFromCSV(
  csvPath: string,
): Promise<Record<string, Piece>> {
  const fs = await import("fs");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const csvPieces = parseCSV(csvContent);
  return createBoardFromCSV(csvPieces);
}

/**
 * Generate board layout summary for verification.
 */
export function generateBoardSummary(pieces: Record<string, Piece>): string {
  const lines: string[] = [];

  // Generate grid view (A-P columns, 1-8 rows)
  lines.push("\n=== Board Layout (Game Orientation) ===\n");
  lines.push(
    "   A    B    C    D    E    F    G    H    I    J    K    L    M    N    O    P",
  );

  for (let row = 8; row >= 1; row--) {
    let line = `${row} `;
    for (let colCode = 65; colCode <= 80; colCode++) {
      const col = String.fromCharCode(colCode);
      const square = `${col}${row}`;
      const piece = Object.values(pieces).find((p) => p.square === square);

      if (piece) {
        const colorChar = piece.color;
        const typeChar = piece.type;
        const value =
          piece.type === "P" ? "P" : piece.value?.toString().padStart(3, " ");
        line += ` ${colorChar}${typeChar}${value}`;
      } else {
        line += "  ---";
      }
    }
    lines.push(line);
  }

  // Piece counts
  lines.push("\n=== Piece Counts ===");
  const blackPieces = Object.values(pieces).filter((p) => p.color === "B");
  const whitePieces = Object.values(pieces).filter((p) => p.color === "W");

  const countByType = (pieces: Piece[]) => {
    const counts = { C: 0, T: 0, S: 0, P: 0 };
    for (const p of pieces) counts[p.type]++;
    return counts;
  };

  const blackCounts = countByType(blackPieces);
  const whiteCounts = countByType(whitePieces);

  lines.push(
    `Black: ${blackPieces.length} total (C:${blackCounts.C}, T:${blackCounts.T}, S:${blackCounts.S}, P:${blackCounts.P})`,
  );
  lines.push(
    `White: ${whitePieces.length} total (C:${whiteCounts.C}, T:${whiteCounts.T}, S:${whiteCounts.S}, P:${whiteCounts.P})`,
  );

  return lines.join("\n");
}
