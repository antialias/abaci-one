import type { Color, Piece, PieceType } from '../types'

/**
 * Zobrist hashing for efficient board state comparison and repetition detection.
 * Each combination of (piece type, color, square) gets a unique random number.
 * The hash of a position is the XOR of all piece hashes.
 */

// Zobrist hash table: [pieceType][color][square] => hash
type ZobristTable = Record<PieceType, Record<Color, Record<string, bigint>>>

// Single zobrist table instance (initialized lazily)
let zobristTable: ZobristTable | null = null

// Turn hash (XOR this when it's Black's turn)
let turnHash: bigint | null = null

/**
 * Simple seedable PRNG using xorshift128+
 */
class SeededRandom {
  private state0: bigint
  private state1: bigint

  constructor(seed: number) {
    // Initialize state from seed
    this.state0 = BigInt(seed)
    this.state1 = BigInt(seed * 2 + 1)
  }

  next(): bigint {
    let s1 = this.state0
    const s0 = this.state1
    this.state0 = s0
    s1 ^= s1 << 23n
    s1 ^= s1 >> 17n
    s1 ^= s0
    s1 ^= s0 >> 26n
    this.state1 = s1
    return (s0 + s1) & 0xffffffffffffffffn // 64-bit mask
  }
}

/**
 * Initialize the Zobrist hash table with deterministic random values.
 */
function initZobristTable(): ZobristTable {
  const rng = new SeededRandom(0x52495448) // "RITH" as seed

  const table: ZobristTable = {
    C: { W: {}, B: {} },
    T: { W: {}, B: {} },
    S: { W: {}, B: {} },
    P: { W: {}, B: {} },
  }

  const pieceTypes: PieceType[] = ['C', 'T', 'S', 'P']
  const colors: Color[] = ['W', 'B']

  // Generate hash for each (pieceType, color, square) combination
  for (const type of pieceTypes) {
    for (const color of colors) {
      for (let file = 0; file < 16; file++) {
        for (let rank = 1; rank <= 8; rank++) {
          const square = `${String.fromCharCode(65 + file)}${rank}`
          table[type][color][square] = rng.next()
        }
      }
    }
  }

  return table
}

/**
 * Get the Zobrist hash table (lazy initialization).
 */
function getZobristTable(): ZobristTable {
  if (!zobristTable) {
    zobristTable = initZobristTable()
    // Also initialize turn hash
    const rng = new SeededRandom(0x5455524e) // "TURN" as seed
    turnHash = rng.next()
  }
  return zobristTable
}

/**
 * Get the turn hash value.
 */
function getTurnHash(): bigint {
  if (turnHash === null) {
    getZobristTable() // This will also initialize turnHash
  }
  return turnHash!
}

/**
 * Compute the Zobrist hash for a board position.
 */
export function computeZobristHash(pieces: Record<string, Piece>, turn: Color): string {
  const table = getZobristTable()
  let hash = 0n

  // XOR all piece hashes
  for (const piece of Object.values(pieces)) {
    if (piece.captured) continue

    const pieceHash = table[piece.type][piece.color][piece.square]
    if (pieceHash) {
      hash ^= pieceHash
    }
  }

  // XOR turn hash if it's Black's turn
  if (turn === 'B') {
    hash ^= getTurnHash()
  }

  // Return as hex string
  return hash.toString(16).padStart(16, '0')
}

/**
 * Check if a hash appears N times in the history (for repetition detection).
 */
export function countHashOccurrences(hashes: string[], targetHash: string): number {
  return hashes.filter((h) => h === targetHash).length
}

/**
 * Check for threefold repetition (hash appears 3 times).
 */
export function isThreefoldRepetition(hashes: string[]): boolean {
  if (hashes.length < 3) return false

  const currentHash = hashes[hashes.length - 1]
  return countHashOccurrences(hashes, currentHash) >= 3
}

/**
 * Incrementally update a Zobrist hash after a move.
 * This is more efficient than recomputing from scratch.
 */
export function updateZobristHash(
  currentHash: string,
  movedPiece: Piece,
  fromSquare: string,
  toSquare: string,
  capturedPiece: Piece | null,
  newTurn: Color
): string {
  const table = getZobristTable()
  let hash = BigInt(`0x${currentHash}`)

  // Remove moved piece from old square
  const oldPieceHash = table[movedPiece.type][movedPiece.color][fromSquare]
  if (oldPieceHash) {
    hash ^= oldPieceHash
  }

  // Add moved piece to new square
  const newPieceHash = table[movedPiece.type][movedPiece.color][toSquare]
  if (newPieceHash) {
    hash ^= newPieceHash
  }

  // Remove captured piece (if any)
  if (capturedPiece) {
    const capturedHash = table[capturedPiece.type][capturedPiece.color][capturedPiece.square]
    if (capturedHash) {
      hash ^= capturedHash
    }
  }

  // Toggle turn (XOR turn hash twice = no change, once = change)
  hash ^= getTurnHash()

  return hash.toString(16).padStart(16, '0')
}
