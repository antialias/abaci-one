/**
 * Type Racer Jr. - Curated Word Lists
 *
 * ~200 words organized by difficulty level, each with an emoji.
 * Designed for young learners (5+ years old).
 */

export interface TypeWord {
  word: string
  emoji: string
}

/** Level 1: 2-3 letter words */
export const LEVEL_1_WORDS: TypeWord[] = [
  { word: 'cat', emoji: '🐱' },
  { word: 'dog', emoji: '🐶' },
  { word: 'sun', emoji: '☀️' },
  { word: 'hat', emoji: '🎩' },
  { word: 'bus', emoji: '🚌' },
  { word: 'ant', emoji: '🐜' },
  { word: 'bee', emoji: '🐝' },
  { word: 'key', emoji: '🔑' },
  { word: 'owl', emoji: '🦉' },
  { word: 'pig', emoji: '🐷' },
  { word: 'cup', emoji: '🍵' },
  { word: 'fox', emoji: '🦊' },
  { word: 'bat', emoji: '🦇' },
  { word: 'egg', emoji: '🥚' },
  { word: 'jam', emoji: '🍯' },
  { word: 'map', emoji: '🗺️' },
  { word: 'van', emoji: '🚐' },
  { word: 'bed', emoji: '🛏️' },
  { word: 'red', emoji: '🔴' },
  { word: 'ice', emoji: '🧊' },
  { word: 'pie', emoji: '🥧' },
  { word: 'cow', emoji: '🐮' },
  { word: 'jet', emoji: '✈️' },
  { word: 'bug', emoji: '🐛' },
  { word: 'nut', emoji: '🥜' },
  { word: 'pen', emoji: '🖊️' },
  { word: 'box', emoji: '📦' },
  { word: 'leg', emoji: '🦵' },
  { word: 'ear', emoji: '👂' },
  { word: 'eye', emoji: '👁️' },
  { word: 'car', emoji: '🚗' },
  { word: 'fan', emoji: '🌀' },
  { word: 'hen', emoji: '🐔' },
  { word: 'log', emoji: '🪵' },
  { word: 'mop', emoji: '🧹' },
  { word: 'net', emoji: '🥅' },
  { word: 'pot', emoji: '🍲' },
  { word: 'rug', emoji: '🧶' },
  { word: 'top', emoji: '🔝' },
  { word: 'web', emoji: '🕸️' },
  { word: 'yak', emoji: '🐂' },
  { word: 'zip', emoji: '🤐' },
  { word: 'bow', emoji: '🎀' },
  { word: 'gem', emoji: '💎' },
  { word: 'ink', emoji: '🖋️' },
  { word: 'jug', emoji: '🏺' },
  { word: 'lid', emoji: '🫙' },
  { word: 'mud', emoji: '🟤' },
  { word: 'oar', emoji: '🚣' },
  { word: 'paw', emoji: '🐾' },
  { word: 'ray', emoji: '🌟' },
  { word: 'saw', emoji: '🪚' },
  { word: 'toy', emoji: '🧸' },
  { word: 'vet', emoji: '👨‍⚕️' },
  { word: 'wax', emoji: '🕯️' },
  { word: 'axe', emoji: '🪓' },
  { word: 'dip', emoji: '🫕' },
  { word: 'fin', emoji: '🦈' },
  { word: 'gum', emoji: '🫧' },
  { word: 'hop', emoji: '🐇' },
  { word: 'kit', emoji: '🧰' },
  { word: 'lap', emoji: '🏁' },
  { word: 'nap', emoji: '😴' },
  { word: 'ram', emoji: '🐏' },
  { word: 'tab', emoji: '📑' },
  { word: 'wig', emoji: '💇' },
  { word: 'zoo', emoji: '🦁' },
  { word: 'dad', emoji: '👨' },
  { word: 'mom', emoji: '👩' },
]

/** Level 2: 4 letter words */
export const LEVEL_2_WORDS: TypeWord[] = [
  { word: 'fish', emoji: '🐟' },
  { word: 'star', emoji: '⭐' },
  { word: 'cake', emoji: '🎂' },
  { word: 'moon', emoji: '🌙' },
  { word: 'bear', emoji: '🐻' },
  { word: 'bird', emoji: '🐦' },
  { word: 'boat', emoji: '⛵' },
  { word: 'fire', emoji: '🔥' },
  { word: 'rain', emoji: '🌧️' },
  { word: 'frog', emoji: '🐸' },
  { word: 'bell', emoji: '🔔' },
  { word: 'book', emoji: '📖' },
  { word: 'drum', emoji: '🥁' },
  { word: 'duck', emoji: '🦆' },
  { word: 'flag', emoji: '🚩' },
  { word: 'gift', emoji: '🎁' },
  { word: 'hand', emoji: '✋' },
  { word: 'king', emoji: '🤴' },
  { word: 'lamp', emoji: '💡' },
  { word: 'leaf', emoji: '🍃' },
  { word: 'lock', emoji: '🔒' },
  { word: 'milk', emoji: '🥛' },
  { word: 'nest', emoji: '🪺' },
  { word: 'pear', emoji: '🍐' },
  { word: 'ring', emoji: '💍' },
  { word: 'rose', emoji: '🌹' },
  { word: 'shoe', emoji: '👟' },
  { word: 'snow', emoji: '❄️' },
  { word: 'sock', emoji: '🧦' },
  { word: 'tree', emoji: '🌳' },
  { word: 'wind', emoji: '💨' },
  { word: 'wolf', emoji: '🐺' },
  { word: 'worm', emoji: '🪱' },
  { word: 'ball', emoji: '⚽' },
  { word: 'bone', emoji: '🦴' },
  { word: 'crab', emoji: '🦀' },
  { word: 'corn', emoji: '🌽' },
  { word: 'door', emoji: '🚪' },
  { word: 'face', emoji: '😊' },
  { word: 'goat', emoji: '🐐' },
  { word: 'harp', emoji: '🎵' },
  { word: 'kite', emoji: '🪁' },
  { word: 'lion', emoji: '🦁' },
  { word: 'nail', emoji: '🔨' },
  { word: 'nose', emoji: '👃' },
  { word: 'park', emoji: '🏞️' },
  { word: 'plum', emoji: '🫐' },
  { word: 'road', emoji: '🛣️' },
  { word: 'seed', emoji: '🌱' },
  { word: 'ship', emoji: '🚢' },
  { word: 'tent', emoji: '⛺' },
  { word: 'toad', emoji: '🐸' },
  { word: 'vest', emoji: '🦺' },
  { word: 'well', emoji: '⛲' },
  { word: 'yarn', emoji: '🧶' },
  { word: 'coin', emoji: '🪙' },
  { word: 'dice', emoji: '🎲' },
  { word: 'flop', emoji: '🐠' },
  { word: 'glow', emoji: '✨' },
  { word: 'hive', emoji: '🐝' },
  { word: 'lime', emoji: '🍋' },
  { word: 'maze', emoji: '🔀' },
  { word: 'pony', emoji: '🐴' },
  { word: 'seal', emoji: '🦭' },
  { word: 'swan', emoji: '🦢' },
  { word: 'taco', emoji: '🌮' },
  { word: 'vine', emoji: '🌿' },
  { word: 'wave', emoji: '🌊' },
  { word: 'yawn', emoji: '🥱' },
  { word: 'claw', emoji: '🦞' },
]

/** Level 3: 5-6 letter words */
export const LEVEL_3_WORDS: TypeWord[] = [
  { word: 'apple', emoji: '🍎' },
  { word: 'robot', emoji: '🤖' },
  { word: 'zebra', emoji: '🦓' },
  { word: 'panda', emoji: '🐼' },
  { word: 'ocean', emoji: '🌊' },
  { word: 'candy', emoji: '🍬' },
  { word: 'horse', emoji: '🐴' },
  { word: 'train', emoji: '🚂' },
  { word: 'mouse', emoji: '🐭' },
  { word: 'cloud', emoji: '☁️' },
  { word: 'happy', emoji: '😄' },
  { word: 'tiger', emoji: '🐯' },
  { word: 'pizza', emoji: '🍕' },
  { word: 'shark', emoji: '🦈' },
  { word: 'grape', emoji: '🍇' },
  { word: 'house', emoji: '🏠' },
  { word: 'crown', emoji: '👑' },
  { word: 'whale', emoji: '🐳' },
  { word: 'snake', emoji: '🐍' },
  { word: 'lemon', emoji: '🍋' },
  { word: 'beach', emoji: '🏖️' },
  { word: 'bread', emoji: '🍞' },
  { word: 'chair', emoji: '🪑' },
  { word: 'dance', emoji: '💃' },
  { word: 'eagle', emoji: '🦅' },
  { word: 'flame', emoji: '🔥' },
  { word: 'ghost', emoji: '👻' },
  { word: 'heart', emoji: '❤️' },
  { word: 'juice', emoji: '🧃' },
  { word: 'koala', emoji: '🐨' },
  { word: 'magic', emoji: '🪄' },
  { word: 'night', emoji: '🌙' },
  { word: 'otter', emoji: '🦦' },
  { word: 'peach', emoji: '🍑' },
  { word: 'queen', emoji: '👸' },
  { word: 'river', emoji: '🏞️' },
  { word: 'smile', emoji: '😊' },
  { word: 'truck', emoji: '🚚' },
  { word: 'water', emoji: '💧' },
  { word: 'yacht', emoji: '🛥️' },
  { word: 'bunny', emoji: '🐰' },
  { word: 'melon', emoji: '🍈' },
  { word: 'puppy', emoji: '🐕' },
  { word: 'teeth', emoji: '🦷' },
  { word: 'tower', emoji: '🏰' },
  { word: 'piano', emoji: '🎹' },
  { word: 'bacon', emoji: '🥓' },
  { word: 'daisy', emoji: '🌼' },
  { word: 'fairy', emoji: '🧚' },
  { word: 'igloo', emoji: '🏔️' },
  { word: 'jelly', emoji: '🍮' },
  { word: 'mango', emoji: '🥭' },
  { word: 'olive', emoji: '🫒' },
  { word: 'pasta', emoji: '🍝' },
  { word: 'tulip', emoji: '🌷' },
  { word: 'acorn', emoji: '🌰' },
  { word: 'berry', emoji: '🫐' },
  { word: 'donut', emoji: '🍩' },
  { word: 'kayak', emoji: '🛶' },
  { word: 'llama', emoji: '🦙' },
]

/** All words grouped by level */
export const WORDS_BY_LEVEL = {
  level1: LEVEL_1_WORDS,
  level2: LEVEL_2_WORDS,
  level3: LEVEL_3_WORDS,
} as const

export type DifficultyLevel = keyof typeof WORDS_BY_LEVEL

/**
 * Pick random words from a level, avoiding already-used words.
 * Falls back to re-using words if the pool is exhausted.
 */
export function pickWords(
  level: DifficultyLevel,
  count: number,
  alreadyUsed: Set<string> = new Set()
): TypeWord[] {
  const pool = WORDS_BY_LEVEL[level]
  const available = pool.filter((w) => !alreadyUsed.has(w.word))

  // If not enough available, supplement with already-used words
  const source = available.length >= count ? available : [...available, ...pool]

  // Fisher-Yates shuffle on a copy
  const shuffled = [...source]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, count)
}
