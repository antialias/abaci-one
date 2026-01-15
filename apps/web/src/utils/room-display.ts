/**
 * Utility for displaying room names consistently across the codebase
 */

export interface RoomDisplayData {
  /**
   * The room's custom name if provided
   */
  name: string | null
  /**
   * The room's unique code (e.g., "ABC123")
   */
  code: string
  /**
   * The game type (optional, for emoji selection)
   */
  gameName?: string
}

export interface RoomDisplay {
  /**
   * Plain text representation - ALWAYS available
   * Use this for: document titles, logs, notifications, plaintext contexts
   */
  plaintext: string

  /**
   * Primary display text (without emoji)
   */
  primary: string

  /**
   * Secondary/subtitle text (optional)
   */
  secondary?: string

  /**
   * Emoji/icon for the room (optional)
   */
  emoji?: string

  /**
   * Whether the name was auto-generated (vs. custom)
   */
  isGenerated: boolean
}

const GAME_EMOJIS: Record<string, string> = {
  matching: '🃏',
  'memory-quiz': '🧠',
  'complement-race': '⚡',
}

const DEFAULT_EMOJI = '🎮'

/**
 * Get structured room display information
 *
 * @example
 * // Custom named room
 * const display = getRoomDisplay({ name: "Alice's Room", code: "ABC123" })
 * // => { plaintext: "Alice's Room", primary: "Alice's Room", secondary: "ABC123", emoji: undefined, isGenerated: false }
 *
 * @example
 * // Auto-generated (no name)
 * const display = getRoomDisplay({ name: null, code: "ABC123", gameName: "matching" })
 * // => { plaintext: "Room ABC123", primary: "ABC123", secondary: undefined, emoji: "🃏", isGenerated: true }
 */
export function getRoomDisplay(room: RoomDisplayData): RoomDisplay {
  if (room.name) {
    // Custom name provided
    return {
      plaintext: room.name,
      primary: room.name,
      secondary: room.code,
      emoji: undefined,
      isGenerated: false,
    }
  }

  // Auto-generate display
  const emoji = GAME_EMOJIS[room.gameName || ''] || DEFAULT_EMOJI

  return {
    plaintext: `Room ${room.code}`, // Always plaintext fallback
    primary: room.code,
    secondary: undefined,
    emoji,
    isGenerated: true,
  }
}

/**
 * Get plaintext room name (shorthand)
 * Use this when you just need a string representation
 *
 * @example
 * getRoomDisplayName({ name: "Alice's Room", code: "ABC123" })
 * // => "Alice's Room"
 *
 * @example
 * getRoomDisplayName({ name: null, code: "ABC123" })
 * // => "Room ABC123"
 */
export function getRoomDisplayName(room: RoomDisplayData): string {
  return getRoomDisplay(room).plaintext
}

/**
 * Get room display with emoji (for rich contexts)
 *
 * @example
 * getRoomDisplayWithEmoji({ name: "Alice's Room", code: "ABC123" })
 * // => "Alice's Room"
 *
 * @example
 * getRoomDisplayWithEmoji({ name: null, code: "ABC123", gameName: "matching" })
 * // => "🃏 ABC123"
 */
export function getRoomDisplayWithEmoji(room: RoomDisplayData): string {
  const display = getRoomDisplay(room)
  if (display.emoji) {
    return `${display.emoji} ${display.primary}`
  }
  return display.primary
}
