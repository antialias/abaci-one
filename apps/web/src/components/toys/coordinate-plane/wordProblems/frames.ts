import type { SemanticFrame } from './types'

const pizzaShop: SemanticFrame = {
  id: 'pizza-shop',
  category: 'money',
  xNoun: { singular: 'slice', plural: 'slices' },
  yNoun: { singular: 'dollar', plural: 'dollars' },
  rateVerb: { base: 'cost', thirdPerson: 'costs', pastTense: 'cost', gerund: 'costing' },
  yUnit: '$',
  xUnit: 'slices',
  yUnitPosition: 'prefix',
  xUnitPosition: 'suffix',
  xRole: 'acquired',
  slopeRange: { min: 1, max: 5 },
  interceptRange: { min: 0, max: 10 },
  xRange: { min: 1, max: 10 },
  yRange: { min: 0, max: 60 },
  setupPhrases: [
    'At the pizza shop,',
    'Sonia is ordering pizza.',
    'At lunch,',
  ],
  subjects: [
    { phrase: 'Sonia', conjugation: 'thirdPerson' },
    { phrase: 'She', conjugation: 'thirdPerson' },
    { phrase: 'A customer', conjugation: 'thirdPerson' },
  ],
  emoji: '🍕',
  supportedLevels: [1, 2, 3],
}

const plantGrowth: SemanticFrame = {
  id: 'plant-growth',
  category: 'growth',
  xNoun: { singular: 'week', plural: 'weeks' },
  yNoun: { singular: 'inch', plural: 'inches' },
  rateVerb: { base: 'grow', thirdPerson: 'grows', pastTense: 'grew', gerund: 'growing' },
  yUnit: 'inches',
  xUnit: 'weeks',
  yUnitPosition: 'suffix',
  xUnitPosition: 'suffix',
  xRole: 'elapsed',
  slopeRange: { min: 1, max: 5 },
  interceptRange: { min: 1, max: 10 },
  xRange: { min: 1, max: 8 },
  yRange: { min: 0, max: 50 },
  setupPhrases: [
    'Sonia planted a sunflower.',
    'In science class, Sonia is tracking a plant.',
    'Sonia is growing a bean plant.',
  ],
  subjects: [
    { phrase: 'The plant', conjugation: 'thirdPerson' },
    { phrase: 'It', conjugation: 'thirdPerson' },
    { phrase: 'The sunflower', conjugation: 'thirdPerson' },
  ],
  emoji: '🌱',
  supportedLevels: [1, 2, 3, 4],
}

const roadTrip: SemanticFrame = {
  id: 'road-trip',
  category: 'distance',
  xNoun: { singular: 'hour', plural: 'hours' },
  yNoun: { singular: 'mile', plural: 'miles' },
  rateVerb: { base: 'travel', thirdPerson: 'travels', pastTense: 'traveled', gerund: 'traveling' },
  yUnit: 'miles',
  xUnit: 'hours',
  yUnitPosition: 'suffix',
  xUnitPosition: 'suffix',
  xRole: 'elapsed',
  slopeRange: { min: 20, max: 65 },
  interceptRange: { min: 0, max: 50 },
  xRange: { min: 1, max: 6 },
  yRange: { min: 0, max: 400 },
  setupPhrases: [
    'Sonia\'s family is on a road trip.',
    'The family is driving to visit grandma.',
    'Sonia is tracking the car\'s progress.',
  ],
  subjects: [
    { phrase: 'The car', conjugation: 'thirdPerson' },
    { phrase: 'They', conjugation: 'base' },
    { phrase: 'The family', conjugation: 'thirdPerson' },
  ],
  emoji: '🚗',
  supportedLevels: [2, 3, 4],
}

const savings: SemanticFrame = {
  id: 'savings',
  category: 'money',
  xNoun: { singular: 'week', plural: 'weeks' },
  yNoun: { singular: 'dollar', plural: 'dollars' },
  rateVerb: { base: 'save', thirdPerson: 'saves', pastTense: 'saved', gerund: 'saving' },
  yUnit: '$',
  xUnit: 'weeks',
  yUnitPosition: 'prefix',
  xUnitPosition: 'suffix',
  xRole: 'elapsed',
  slopeRange: { min: 5, max: 25 },
  interceptRange: { min: 0, max: 100 },
  xRange: { min: 1, max: 10 },
  yRange: { min: 0, max: 350 },
  setupPhrases: [
    'Sonia is saving up for a new bike.',
    'Sonia wants to buy a skateboard.',
    'Sonia is saving her allowance.',
  ],
  subjects: [
    { phrase: 'Sonia', conjugation: 'thirdPerson' },
    { phrase: 'She', conjugation: 'thirdPerson' },
  ],
  emoji: '💰',
  supportedLevels: [1, 2, 3],
}

const baking: SemanticFrame = {
  id: 'baking',
  category: 'cooking',
  xNoun: { singular: 'batch', plural: 'batches' },
  yNoun: { singular: 'cup', plural: 'cups' },
  rateVerb: { base: 'need', thirdPerson: 'needs', pastTense: 'needed', gerund: 'needing' },
  yUnit: 'cups',
  xUnit: 'batches',
  yUnitPosition: 'suffix',
  xUnitPosition: 'suffix',
  xRole: 'acquired',
  slopeRange: { min: 2, max: 4 },
  interceptRange: { min: 0, max: 3 },
  xRange: { min: 1, max: 8 },
  yRange: { min: 0, max: 35 },
  setupPhrases: [
    'Sonia is baking cookies for the school sale.',
    'It\'s time to bake cupcakes!',
    'Sonia is making brownies for her class.',
  ],
  subjects: [
    { phrase: 'Each batch', conjugation: 'thirdPerson' },
    { phrase: 'The recipe', conjugation: 'thirdPerson' },
    { phrase: 'She', conjugation: 'thirdPerson' },
  ],
  emoji: '🧁',
  supportedLevels: [1, 2, 3],
}

const braceletMaking: SemanticFrame = {
  id: 'bracelet-making',
  category: 'crafts',
  xNoun: { singular: 'bracelet', plural: 'bracelets' },
  yNoun: { singular: 'bead', plural: 'beads' },
  rateVerb: { base: 'use', thirdPerson: 'uses', pastTense: 'used', gerund: 'using' },
  yUnit: 'beads',
  xUnit: 'bracelets',
  yUnitPosition: 'suffix',
  xUnitPosition: 'suffix',
  xRole: 'acquired',
  slopeRange: { min: 5, max: 12 },
  interceptRange: { min: 0, max: 10 },
  xRange: { min: 1, max: 8 },
  yRange: { min: 0, max: 100 },
  setupPhrases: [
    'Sonia is making friendship bracelets.',
    'At craft time, Sonia is stringing beads.',
    'Sonia is making bracelets for her friends.',
  ],
  subjects: [
    { phrase: 'Each bracelet', conjugation: 'thirdPerson' },
    { phrase: 'She', conjugation: 'thirdPerson' },
    { phrase: 'A bracelet', conjugation: 'thirdPerson' },
  ],
  emoji: '📿',
  supportedLevels: [1, 2, 3, 4],
}

/** All available semantic frames */
export const FRAMES: SemanticFrame[] = [
  pizzaShop,
  plantGrowth,
  roadTrip,
  savings,
  baking,
  braceletMaking,
]

/** Registry: look up a frame by id */
export const FRAME_REGISTRY = new Map<string, SemanticFrame>(
  FRAMES.map(f => [f.id, f])
)

/** Get frames that support a given difficulty level */
export function framesForLevel(level: number): SemanticFrame[] {
  const frames = FRAMES.filter(f => f.supportedLevels.includes(level as 1 | 2 | 3 | 4 | 5))
  // Level 5 falls back to level 3 frames if none explicitly support it
  if (frames.length === 0 && level === 5) {
    return FRAMES.filter(f => f.supportedLevels.includes(3))
  }
  return frames
}
