/**
 * Fun automatic player name generation system
 * Generates creative names by combining adjectives with nouns/roles
 *
 * Supports avatar-specific theming! Each emoji can have its own personality-matched words.
 * Falls back gracefully: emoji-specific → category → generic abacus theme
 */

import { EMOJI_SPECIFIC_WORDS, EMOJI_TO_THEME, THEMED_WORD_LISTS } from './themedWords'

// Generic abacus-themed words (used as ultimate fallback)
const ADJECTIVES = [
  // Abacus-themed adjectives
  'Ancient',
  'Wooden',
  'Sliding',
  'Decimal',
  'Binary',
  'Counting',
  'Soroban',
  'Chinese',
  'Japanese',
  'Nimble',
  'Clicking',
  'Beaded',
  'Columnar',
  'Vertical',
  'Horizontal',
  'Upper',
  'Lower',
  'Heaven',
  'Earth',
  'Golden',
  'Jade',
  'Bamboo',
  'Polished',
  'Skilled',
  'Master',
  // Arithmetic/calculation adjectives
  'Adding',
  'Subtracting',
  'Multiplying',
  'Dividing',
  'Calculating',
  'Computing',
  'Estimating',
  'Rounding',
  'Summing',
  'Tallying',
  'Decimal',
  'Fractional',
  'Exponential',
  'Algebraic',
  'Geometric',
  'Prime',
  'Composite',
  'Rational',
  'Digital',
  'Numeric',
  'Precise',
  'Accurate',
  'Lightning',
  'Rapid',
  'Mental',
]

const NOUNS = [
  // Abacus-themed nouns
  'Counter',
  'Abacist',
  'Calculator',
  'Bead',
  'Rod',
  'Frame',
  'Slider',
  'Merchant',
  'Trader',
  'Accountant',
  'Bookkeeper',
  'Clerk',
  'Scribe',
  'Master',
  'Apprentice',
  'Scholar',
  'Student',
  'Teacher',
  'Sensei',
  'Guru',
  'Expert',
  'Virtuoso',
  'Prodigy',
  'Wizard',
  'Sage',
  // Arithmetic/calculation nouns
  'Adder',
  'Multiplier',
  'Divider',
  'Solver',
  'Mathematician',
  'Arithmetician',
  'Analyst',
  'Computer',
  'Estimator',
  'Logician',
  'Statistician',
  'Numerologist',
  'Quantifier',
  'Tallier',
  'Sumner',
  'Keeper',
  'Reckoner',
  'Cipher',
  'Digit',
  'Figure',
  'Number',
  'Brain',
  'Thinker',
  'Genius',
  'Whiz',
]

/**
 * Select a word list tier using weighted random selection
 * Balanced mix: emoji-specific (50%), category (25%), global abacus (25%)
 */
function selectWordListTier(emoji: string, wordType: 'adjectives' | 'nouns'): string[] {
  // Collect available tiers
  const availableTiers: Array<{ weight: number; words: string[] }> = []

  // Emoji-specific tier (50% preference)
  const emojiSpecific = EMOJI_SPECIFIC_WORDS[emoji]
  if (emojiSpecific) {
    availableTiers.push({ weight: 50, words: emojiSpecific[wordType] })
  }

  // Category tier (25% preference)
  const category = EMOJI_TO_THEME[emoji]
  if (category) {
    const categoryTheme = THEMED_WORD_LISTS[category]
    if (categoryTheme) {
      availableTiers.push({ weight: 25, words: categoryTheme[wordType] })
    }
  }

  // Global abacus tier (25% preference)
  availableTiers.push({
    weight: 25,
    words: wordType === 'adjectives' ? ADJECTIVES : NOUNS,
  })

  // Weighted random selection
  const totalWeight = availableTiers.reduce((sum, tier) => sum + tier.weight, 0)
  let random = Math.random() * totalWeight

  for (const tier of availableTiers) {
    random -= tier.weight
    if (random <= 0) {
      return tier.words
    }
  }

  // Fallback (should never reach here)
  return wordType === 'adjectives' ? ADJECTIVES : NOUNS
}

/**
 * Generate a random player name by combining an adjective and noun
 * Optionally themed based on avatar emoji for ultra-personalized names!
 * Uses per-word-type probabilistic tier selection for natural variety
 *
 * @param emoji - Optional emoji avatar to theme the name around
 * @returns A creative player name like "Grinning Calculator" or "Lightning Smiler"
 */
export function generatePlayerName(emoji?: string): string {
  if (!emoji) {
    // No emoji provided, use pure abacus theme
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
    return `${adjective} ${noun}`
  }

  // Select tier independently for each word type
  // This creates natural mixing: adjective might be emoji-specific while noun is global
  const adjectiveList = selectWordListTier(emoji, 'adjectives')
  const nounList = selectWordListTier(emoji, 'nouns')

  const adjective = adjectiveList[Math.floor(Math.random() * adjectiveList.length)]
  const noun = nounList[Math.floor(Math.random() * nounList.length)]

  return `${adjective} ${noun}`
}

/**
 * Generate a unique player name that doesn't conflict with existing players
 * @param existingNames - Array of names already in use
 * @param emoji - Optional emoji avatar to theme the name around
 * @param maxAttempts - Maximum attempts to find a unique name (default: 50)
 * @returns A unique player name
 */
export function generateUniquePlayerName(
  existingNames: string[],
  emoji?: string,
  maxAttempts = 50
): string {
  const existingNamesSet = new Set(existingNames.map((name) => name.toLowerCase()))

  for (let i = 0; i < maxAttempts; i++) {
    const name = generatePlayerName(emoji)
    if (!existingNamesSet.has(name.toLowerCase())) {
      return name
    }
  }

  // Fallback: if we can't find a unique name, append a number
  const baseName = generatePlayerName(emoji)
  let counter = 1
  while (existingNamesSet.has(`${baseName} ${counter}`.toLowerCase())) {
    counter++
  }
  return `${baseName} ${counter}`
}

/**
 * Generate a batch of unique player names
 * @param count - Number of names to generate
 * @param emoji - Optional emoji avatar to theme the names around
 * @returns Array of unique player names
 */
export function generateUniquePlayerNames(count: number, emoji?: string): string[] {
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const name = generateUniquePlayerName(names, emoji)
    names.push(name)
  }
  return names
}
