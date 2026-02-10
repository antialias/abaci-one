import type { TtsSay } from './TtsAudioManager'

/**
 * Resolve the canonical text from a say map.
 * Priority: say['en-US'] > say['en'] > first value > ''
 *
 * This deterministic resolution means adding lower-priority translations
 * (e.g. 'es', 'ja') does NOT change the canonical text.
 */
export function resolveCanonicalText(say: Record<string, string> | undefined | null): string {
  if (!say) return ''
  return say['en-US'] ?? say['en'] ?? Object.values(say)[0] ?? ''
}

/**
 * FNV-1a 32-bit hash. Synchronous, no crypto dependency.
 */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) // FNV prime
  }
  return hash >>> 0 // Ensure unsigned 32-bit
}

/**
 * Compute a deterministic clip ID from say text + tone.
 * Returns 'h-' + 8 hex chars, e.g. 'h-a3f2b1c0'
 *
 * Hash input: resolveCanonicalText(say) + '\0' + tone
 */
export function computeClipHash(say: TtsSay, tone: string): string {
  const canonical = resolveCanonicalText(say)
  const hashInput = canonical + '\0' + tone
  const hash = fnv1a32(hashInput)
  return 'h-' + hash.toString(16).padStart(8, '0')
}

const HASH_CLIP_ID_RE = /^h-[0-9a-f]{8}$/

/**
 * Returns true if clipId matches the hash-based format: 'h-' + 8 hex chars.
 */
export function isHashClipId(clipId: string): boolean {
  return HASH_CLIP_ID_RE.test(clipId)
}
