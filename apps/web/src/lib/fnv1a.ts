/**
 * FNV-1a 32-bit — a small, fast, deterministic string hash.
 *
 * Synchronous and dependency-free, and unlike `crypto.subtle.digest` it needs no
 * secure context, so it works on a LAN devbox served over plain HTTP.
 *
 * NOT cryptographic. Use it for cache keys, content-identity discriminators and
 * seeds; never for anything security-bearing.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  return hash >>> 0 // Ensure unsigned 32-bit
}

/** `fnv1a32` rendered as exactly 8 lowercase hex characters, zero-padded. */
export function fnv1a32Hex(input: string): string {
  return fnv1a32(input).toString(16).padStart(8, '0')
}
