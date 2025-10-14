/**
 * Fun automatic player name generation system
 * Generates creative names by combining adjectives with nouns/roles
 */

const ADJECTIVES = [
  'Swift',
  'Cosmic',
  'Radiant',
  'Mighty',
  'Clever',
  'Bold',
  'Epic',
  'Mystic',
  'Stellar',
  'Fierce',
  'Nimble',
  'Wild',
  'Brave',
  'Daring',
  'Slick',
  'Blazing',
  'Thunder',
  'Crystal',
  'Shadow',
  'Golden',
  'Silver',
  'Royal',
  'Ancient',
  'Turbo',
  'Mega',
  'Ultra',
  'Super',
  'Hyper',
  'Flash',
  'Quantum',
  'Atomic',
  'Electric',
  'Neon',
  'Cyber',
  'Digital',
  'Pixel',
  'Glitch',
  'Retro',
  'Ninja',
  'Stealth',
  'Phantom',
  'Speedy',
  'Lucky',
  'Magic',
  'Wonder',
  'Power',
  'Master',
  'Legend',
  'Champion',
  'Titan',
]

const NOUNS = [
  'Ninja',
  'Wizard',
  'Dragon',
  'Phoenix',
  'Knight',
  'Warrior',
  'Hunter',
  'Ranger',
  'Mage',
  'Rogue',
  'Paladin',
  'Samurai',
  'Viking',
  'Pirate',
  'Tiger',
  'Wolf',
  'Eagle',
  'Falcon',
  'Bear',
  'Lion',
  'Panda',
  'Fox',
  'Hawk',
  'Cobra',
  'Shark',
  'Raptor',
  'Viper',
  'Lynx',
  'Panther',
  'Jaguar',
  'Racer',
  'Pilot',
  'Captain',
  'Commander',
  'Hero',
  'Guardian',
  'Defender',
  'Striker',
  'Blaster',
  'Crusher',
  'Smasher',
  'Blitzer',
  'Rider',
  'Surfer',
  'Skater',
  'Gamer',
  'Player',
  'Champion',
  'Legend',
  'Star',
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
