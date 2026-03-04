export const MARKER_RE =
  /\{(seg|tri|ang|pt|def|post|cn|prop):[A-Za-z0-9]+(?:\|[^}]*)?\}/g

/** Tokenize text into lowercase words (letters/digits/apostrophes). */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z\d']+/g) ?? []
}

/**
 * Word overlap ratio: fraction of original words that appear in the stripped output.
 * Returns 0–1. High values mean the model preserved most of the original prose.
 */
export function wordOverlapRatio(original: string, stripped: string): number {
  const origWords = words(original)
  if (origWords.length === 0) return 1

  // Build a bag (multiset) of stripped words so each can only match once
  const bag = new Map<string, number>()
  for (const w of words(stripped)) {
    bag.set(w, (bag.get(w) ?? 0) + 1)
  }

  let matched = 0
  for (const w of origWords) {
    const count = bag.get(w) ?? 0
    if (count > 0) {
      matched++
      bag.set(w, count - 1)
    }
  }

  return matched / origWords.length
}

/**
 * Strict validation: remaining text (markers stripped) must be a subsequence of
 * the original, and at least 50% of the original length. Use for user-written text.
 */
export function validateMarkupStrict(
  original: string,
  marked: string
): boolean {
  let remaining = marked.replace(MARKER_RE, '')

  // Remaining text should be a significant portion of the original
  if (remaining.length < original.length * 0.5) return false

  // Strip trailing punctuation the model may have added (models love adding periods)
  remaining = remaining.replace(/[.!?]+$/, '')

  // Collapse runs of whitespace so stripped markers don't leave double spaces that
  // break the subsequence check against the original's single spaces.
  remaining = remaining.replace(/ {2,}/g, ' ').trim()
  const normalizedOriginal = original.replace(/ {2,}/g, ' ').trim()

  // The remaining characters should be a subsequence of the original
  let oi = 0
  for (const ch of remaining) {
    while (oi < normalizedOriginal.length && normalizedOriginal[oi] !== ch) oi++
    if (oi >= normalizedOriginal.length) return false
    oi++
  }
  return true
}
