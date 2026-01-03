/**
 * Generate a short, URL-safe ID for worksheet shares
 *
 * Uses base62 encoding (0-9, a-z, A-Z) for maximum readability
 * 7 characters = 62^7 = ~3.5 trillion possible IDs
 *
 * Format: abc123X (lowercase, uppercase, numbers)
 * Example: k7mP2qR
 */

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ID_LENGTH = 7

/**
 * Generate a random base62 string of specified length
 */
export function generateShareId(length: number = ID_LENGTH): string {
  let result = ''

  // Use crypto.getRandomValues for cryptographically secure randomness
  const randomBytes = new Uint8Array(length)
  crypto.getRandomValues(randomBytes)

  for (let i = 0; i < length; i++) {
    // Map random byte to base62 character
    result += BASE62_CHARS[randomBytes[i] % BASE62_CHARS.length]
  }

  return result
}

/**
 * Check if a share ID has valid format
 */
export function isValidShareId(id: string): boolean {
  if (id.length !== ID_LENGTH) return false

  // Check all characters are in base62 alphabet
  for (let i = 0; i < id.length; i++) {
    if (!BASE62_CHARS.includes(id[i])) {
      return false
    }
  }

  return true
}
