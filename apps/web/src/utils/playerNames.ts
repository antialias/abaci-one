/**
 * Fun automatic player name generation system
 * Generates creative names by combining adjectives with nouns/roles
 */

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
 * Generate a random player name by combining an adjective and noun
 */
export function generatePlayerName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adjective} ${noun}`
}

/**
 * Generate a unique player name that doesn't conflict with existing players
 * @param existingNames - Array of names already in use
 * @param maxAttempts - Maximum attempts to find a unique name (default: 50)
 * @returns A unique player name
 */
export function generateUniquePlayerName(existingNames: string[], maxAttempts = 50): string {
  const existingNamesSet = new Set(existingNames.map((name) => name.toLowerCase()))

  for (let i = 0; i < maxAttempts; i++) {
    const name = generatePlayerName()
    if (!existingNamesSet.has(name.toLowerCase())) {
      return name
    }
  }

  // Fallback: if we can't find a unique name, append a number
  const baseName = generatePlayerName()
  let counter = 1
  while (existingNamesSet.has(`${baseName} ${counter}`.toLowerCase())) {
    counter++
  }
  return `${baseName} ${counter}`
}

/**
 * Generate a batch of unique player names
 * @param count - Number of names to generate
 * @returns Array of unique player names
 */
export function generateUniquePlayerNames(count: number): string[] {
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const name = generateUniquePlayerName(names)
    names.push(name)
  }
  return names
}
