export const MARKER_RE = /\{(seg|tri|ang|pt|def|post|cn|prop):[A-Za-z0-9]+(?:\|[^}]*)?\}/g

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
 * Strict validation: markers expanded to display text must be a subsequence of
 * the original. This catches cases where a marker replaces non-matching text
 * (e.g., {pt:A} eating the word "point").
 *
 * Uses stripEntityMarkers from the shared marker system to expand markers to
 * their canonical display text, then verifies the result is a subsequence of
 * the original.
 *
 * Use for user-written text where we must preserve every word exactly.
 */
export function validateMarkupStrict(
  original: string,
  marked: string,
  expandMarkers: (text: string) => string
): boolean {
  let expanded = expandMarkers(marked)

  // Expanded text should be a significant portion of the original
  if (expanded.length < original.length * 0.5) return false

  // Strip trailing punctuation the model may have added (models love adding periods)
  expanded = expanded.replace(/[.!?]+$/, '')

  // Collapse runs of whitespace so marker expansion doesn't break the subsequence
  // check against the original's single spaces.
  expanded = expanded.replace(/ {2,}/g, ' ').trim()
  const normalizedOriginal = original.replace(/ {2,}/g, ' ').trim()

  // The expanded text should be a subsequence of the original.
  // This allows the original to have extra chars (like △ before ABD) that the
  // marker expansion doesn't reproduce, while catching cases where the marker
  // replaced unrelated text (e.g., "point" → {pt:A} expands to "A", and "A"
  // is not a subsequence continuation after "damn ").
  let oi = 0
  for (const ch of expanded) {
    while (oi < normalizedOriginal.length && normalizedOriginal[oi] !== ch) oi++
    if (oi >= normalizedOriginal.length) return false
    oi++
  }
  return true
}
