/**
 * Room code generation utility
 * Generates short, memorable codes for joining rooms
 */

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars: 0,O,1,I
const CODE_LENGTH = 6;

/**
 * Generate a random 6-character room code
 * Format: ABC123 (uppercase letters + numbers, no ambiguous chars)
 */
export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARS.length);
    code += CHARS[randomIndex];
  }
  return code;
}

/**
 * Validate a room code format
 */
export function isValidRoomCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  return code.split("").every((char) => CHARS.includes(char));
}

/**
 * Normalize a room code (uppercase, remove spaces/dashes)
 */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}
