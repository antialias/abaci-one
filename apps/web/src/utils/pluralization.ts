import { en } from "make-plural";

// Use English pluralization rules from make-plural
const plural = en;

/**
 * Pluralize a word based on count using make-plural library
 * @param count - The number to base pluralization on
 * @param singular - The singular form of the word
 * @param plural - The plural form of the word (optional, will add 's' by default)
 * @returns The properly pluralized word
 */
export function pluralizeWord(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  const category = plural(count);
  if (category === "one") {
    return singular;
  }
  return pluralForm || `${singular}s`;
}

/**
 * Create a formatted string with count and properly pluralized word
 * @param count - The number to display
 * @param singular - The singular form of the word
 * @param plural - The plural form of the word (optional)
 * @returns Formatted string like "1 pair" or "3 pairs"
 */
export function pluralizeCount(
  count: number,
  singular: string,
  pluralForm?: string,
): string {
  return `${count} ${pluralizeWord(count, singular, pluralForm)}`;
}

/**
 * Common game-specific pluralization helpers using make-plural
 */
export const gamePlurals = {
  pair: (count: number) => pluralizeCount(count, "pair"),
  pairs: (count: number) => pluralizeCount(count, "pair"),
  move: (count: number) => pluralizeCount(count, "move"),
  moves: (count: number) => pluralizeCount(count, "move"),
  match: (count: number) => pluralizeCount(count, "match", "matches"),
  matches: (count: number) => pluralizeCount(count, "match", "matches"),
  player: (count: number) => pluralizeCount(count, "player"),
  players: (count: number) => pluralizeCount(count, "player"),
} as const;
