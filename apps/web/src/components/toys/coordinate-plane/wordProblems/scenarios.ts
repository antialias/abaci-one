import type { Scenario } from './types'

/** All scenario definitions — story wrappers for rate pairs */
export const SCENARIOS: Scenario[] = [
  // ══════════════════════════════════════════════════════════════
  // slices-dollars-cost (acquired)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'pizza-shop',
    ratePairId: 'slices-dollars-cost',
    setupPhrases: [
      'At the pizza shop,',
      '{name} is ordering pizza.',
      'At lunch,',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A customer', conjugation: 'thirdPerson' },
    ],
    emoji: '🍕',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 5 },
    interceptRange: { min: 0, max: 10 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 60 },
  },
  {
    id: 'cake-sale',
    ratePairId: 'slices-dollars-cost',
    setupPhrases: [
      'At the school bake sale,',
      '{name} is selling cake slices.',
      'The bake sale is today!',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A buyer', conjugation: 'thirdPerson' },
    ],
    emoji: '🎂',
    xNoun: { singular: 'piece', plural: 'pieces' },
    xUnit: 'pieces',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 6 },
    interceptRange: { min: 0, max: 8 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 56 },
  },
  {
    id: 'pie-contest',
    ratePairId: 'slices-dollars-cost',
    setupPhrases: [
      'At the pie-eating contest,',
      '{name} entered a pie contest.',
      'The county fair has a pie stand.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each contestant', conjugation: 'thirdPerson' },
    ],
    emoji: '🥧',
    xNoun: { singular: 'pie', plural: 'pies' },
    xUnit: 'pies',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 4 },
    interceptRange: { min: 0, max: 5 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 45 },
  },

  // ══════════════════════════════════════════════════════════════
  // weeks-inches-grow (elapsed)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'plant-growth',
    ratePairId: 'weeks-inches-grow',
    setupPhrases: [
      '{name} planted a sunflower.',
      'In science class, {name} is tracking a plant.',
      '{name} is growing a bean plant.',
    ],
    subjects: [
      { phrase: 'The plant', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
      { phrase: 'The sunflower', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks will it take to grow that tall?',
      'How many weeks until the plant is tall enough?',
    ],
    emoji: '🌱',
    supportedLevels: [1, 2, 3, 4],
    slopeRange: { min: 1, max: 5 },
    interceptRange: { min: 1, max: 10 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 50 },
  },
  {
    id: 'garden-project',
    ratePairId: 'weeks-inches-grow',
    setupPhrases: [
      '{name} is tending {possessive} garden.',
      'The school garden is growing!',
      '{name} planted tomatoes in the garden.',
    ],
    subjects: [
      { phrase: 'The tomato plant', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
      { phrase: 'The vine', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks until it reaches that height?',
      'How many weeks will the vine need to grow?',
    ],
    emoji: '🍅',
    supportedLevels: [1, 2, 3, 4],
    slopeRange: { min: 2, max: 6 },
    interceptRange: { min: 1, max: 8 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 56 },
  },
  {
    id: 'tree-sapling',
    ratePairId: 'weeks-inches-grow',
    setupPhrases: [
      '{name} planted a tree sapling in the yard.',
      'The class is tracking a new tree.',
      'A small tree is growing outside the school.',
    ],
    subjects: [
      { phrase: 'The sapling', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
      { phrase: 'The tree', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks until the tree is that tall?',
      'How many weeks of growing will it need?',
    ],
    emoji: '🌳',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 3 },
    interceptRange: { min: 2, max: 12 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 42 },
  },

  // ══════════════════════════════════════════════════════════════
  // hours-miles-travel (elapsed)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'road-trip',
    ratePairId: 'hours-miles-travel',
    setupPhrases: [
      "{name}'s family is on a road trip.",
      'The family is driving to visit grandma.',
      "{name} is tracking the car's progress.",
    ],
    subjects: [
      { phrase: 'The car', conjugation: 'thirdPerson' },
      { phrase: 'They', conjugation: 'base' },
      { phrase: 'The family', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many hours of driving will that take?',
      'How many hours until they arrive?',
    ],
    emoji: '🚗',
    supportedLevels: [2, 3, 4],
    slopeRange: { min: 20, max: 65 },
    interceptRange: { min: 0, max: 50 },
    xRange: { min: 1, max: 6 },
    yRange: { min: 0, max: 400 },
  },
  {
    id: 'train-ride',
    ratePairId: 'hours-miles-travel',
    setupPhrases: [
      '{name} is riding the train to the city.',
      'The train is heading downtown.',
      "{name}'s family is taking the train.",
    ],
    subjects: [
      { phrase: 'The train', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
      { phrase: 'They', conjugation: 'base' },
    ],
    solveForXQuestions: [
      'How many hours until the train arrives?',
      'How many hours will the ride take?',
    ],
    emoji: '🚂',
    supportedLevels: [2, 3, 4],
    slopeRange: { min: 30, max: 65 },
    interceptRange: { min: 0, max: 40 },
    xRange: { min: 1, max: 5 },
    yRange: { min: 0, max: 350 },
  },
  {
    id: 'bike-ride',
    ratePairId: 'hours-miles-travel',
    setupPhrases: [
      '{name} is biking to the park.',
      '{name} is riding {possessive} bike after school.',
      'The bike club is on a ride.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'The group', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many hours of biking will that take?',
      'How many hours until {name} gets there?',
    ],
    emoji: '🚲',
    supportedLevels: [2, 3],
    slopeRange: { min: 8, max: 15 },
    interceptRange: { min: 0, max: 10 },
    xRange: { min: 1, max: 6 },
    yRange: { min: 0, max: 100 },
  },

  // ══════════════════════════════════════════════════════════════
  // weeks-dollars-save (elapsed)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'savings',
    ratePairId: 'weeks-dollars-save',
    setupPhrases: [
      '{name} is saving up for a new bike.',
      '{name} wants to buy a skateboard.',
      '{name} is saving {possessive} allowance.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks until {name} has enough money?',
      'How many weeks does {name} need to save?',
    ],
    emoji: '💰',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 5, max: 25 },
    interceptRange: { min: 0, max: 100 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 350 },
  },
  {
    id: 'birthday-fund',
    ratePairId: 'weeks-dollars-save',
    setupPhrases: [
      "{name} is saving for {possessive} friend's birthday present.",
      '{name} wants to buy a gift.',
      '{name} is putting money in {possessive} piggy bank.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks until {name} has enough?',
      'How many weeks of saving will it take?',
    ],
    emoji: '🎁',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 3, max: 15 },
    interceptRange: { min: 0, max: 50 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 200 },
  },
  {
    id: 'lemonade-earnings',
    ratePairId: 'weeks-dollars-save',
    setupPhrases: [
      '{name} runs a lemonade stand every weekend.',
      'The lemonade stand is open for business!',
      '{name} sells lemonade on Saturdays.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many weeks until {name} earns enough?',
      'How many weeks will it take to reach {possessive} goal?',
    ],
    emoji: '🍋',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 5, max: 20 },
    interceptRange: { min: 0, max: 30 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 230 },
  },

  // ══════════════════════════════════════════════════════════════
  // batches-cups-need (acquired)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'baking',
    ratePairId: 'batches-cups-need',
    setupPhrases: [
      '{name} is baking cookies for the school sale.',
      "It's time to bake cupcakes!",
      '{name} is making brownies for {possessive} class.',
    ],
    subjects: [
      { phrase: 'Each batch', conjugation: 'thirdPerson' },
      { phrase: 'The recipe', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    emoji: '🧁',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 4 },
    interceptRange: { min: 0, max: 3 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 35 },
  },
  {
    id: 'pancake-breakfast',
    ratePairId: 'batches-cups-need',
    setupPhrases: [
      '{name} is making pancakes for breakfast.',
      "It's pancake day!",
      'The family wants pancakes this morning.',
    ],
    subjects: [
      { phrase: 'Each batch', conjugation: 'thirdPerson' },
      { phrase: 'The recipe', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    emoji: '🥞',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 3 },
    interceptRange: { min: 0, max: 2 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 32 },
  },
  {
    id: 'soup-kitchen',
    ratePairId: 'batches-cups-need',
    setupPhrases: [
      '{name} is volunteering at a soup kitchen.',
      'The soup kitchen is making a big meal.',
      '{name} is helping cook for the community dinner.',
    ],
    subjects: [
      { phrase: 'Each batch', conjugation: 'thirdPerson' },
      { phrase: 'The recipe', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    emoji: '🍲',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 3, max: 5 },
    interceptRange: { min: 0, max: 4 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 44 },
  },

  // ══════════════════════════════════════════════════════════════
  // bracelets-beads-use (acquired)
  // ══════════════════════════════════════════════════════════════

  {
    id: 'bracelet-making',
    ratePairId: 'bracelets-beads-use',
    setupPhrases: [
      '{name} is making friendship bracelets.',
      'At craft time, {name} is stringing beads.',
      '{name} is making bracelets for {possessive} friends.',
    ],
    subjects: [
      { phrase: 'Each bracelet', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A bracelet', conjugation: 'thirdPerson' },
    ],
    emoji: '📿',
    supportedLevels: [1, 2, 3, 4],
    slopeRange: { min: 5, max: 12 },
    interceptRange: { min: 0, max: 10 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 100 },
  },
  {
    id: 'necklace-craft',
    ratePairId: 'bracelets-beads-use',
    setupPhrases: [
      '{name} is making bead necklaces.',
      'At art class, they are stringing necklaces.',
      '{name} is designing necklaces for the craft fair.',
    ],
    subjects: [
      { phrase: 'Each necklace', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A necklace', conjugation: 'thirdPerson' },
    ],
    emoji: '💎',
    xNoun: { singular: 'necklace', plural: 'necklaces' },
    xUnit: 'necklaces',
    supportedLevels: [1, 2, 3, 4],
    slopeRange: { min: 8, max: 15 },
    interceptRange: { min: 0, max: 12 },
    xRange: { min: 1, max: 6 },
    yRange: { min: 0, max: 102 },
  },
  {
    id: 'keychain-craft',
    ratePairId: 'bracelets-beads-use',
    setupPhrases: [
      '{name} is making beaded keychains.',
      'The craft club is making keychains today.',
      '{name} is decorating keychains with beads.',
    ],
    subjects: [
      { phrase: 'Each keychain', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A keychain', conjugation: 'thirdPerson' },
    ],
    emoji: '🔑',
    xNoun: { singular: 'keychain', plural: 'keychains' },
    xUnit: 'keychains',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 4, max: 8 },
    interceptRange: { min: 0, max: 6 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 86 },
  },

  // ══════════════════════════════════════════════════════════════
  // tickets-dollars-cost (acquired) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'movie-tickets',
    ratePairId: 'tickets-dollars-cost',
    setupPhrases: [
      '{name} is buying movie tickets.',
      'The family is going to the movies.',
      "It's movie night!",
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A ticket', conjugation: 'thirdPerson' },
    ],
    emoji: '🎬',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 8, max: 15 },
    interceptRange: { min: 0, max: 5 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 125 },
  },
  {
    id: 'carnival-rides',
    ratePairId: 'tickets-dollars-cost',
    setupPhrases: [
      'At the carnival,',
      '{name} is at the school carnival.',
      'The fair is in town!',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each ride', conjugation: 'thirdPerson' },
    ],
    emoji: '🎡',
    xNoun: { singular: 'ride', plural: 'rides' },
    xUnit: 'rides',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 5 },
    interceptRange: { min: 0, max: 10 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 60 },
  },
  {
    id: 'concert-tickets',
    ratePairId: 'tickets-dollars-cost',
    setupPhrases: [
      'The school band is having a concert.',
      '{name} is buying concert tickets.',
      "It's time for the spring concert!",
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A ticket', conjugation: 'thirdPerson' },
    ],
    emoji: '🎵',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 5, max: 12 },
    interceptRange: { min: 0, max: 8 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 104 },
  },

  // ══════════════════════════════════════════════════════════════
  // laps-meters-run (acquired) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'track-practice',
    ratePairId: 'laps-meters-run',
    setupPhrases: [
      'At track practice,',
      '{name} is at track and field practice.',
      'The team is running laps.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each runner', conjugation: 'thirdPerson' },
    ],
    emoji: '🏃',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 200, max: 400 },
    interceptRange: { min: 0, max: 100 },
    xRange: { min: 1, max: 6 },
    yRange: { min: 0, max: 2500 },
  },
  {
    id: 'swim-laps',
    ratePairId: 'laps-meters-run',
    setupPhrases: [
      '{name} is swimming laps at the pool.',
      'At swim practice,',
      'The swim team is in the pool.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each swimmer', conjugation: 'thirdPerson' },
    ],
    emoji: '🏊',
    rateVerb: { base: 'swim', thirdPerson: 'swims', pastTense: 'swam', gerund: 'swimming' },
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 50, max: 100 },
    interceptRange: { min: 0, max: 50 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 850 },
  },

  // ══════════════════════════════════════════════════════════════
  // days-pages-read (elapsed) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'summer-reading',
    ratePairId: 'days-pages-read',
    setupPhrases: [
      '{name} has a summer reading challenge.',
      '{name} is reading a new book.',
      "It's reading time!",
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many days will it take to read that many pages?',
      'How many days of reading is that?',
    ],
    emoji: '📚',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 10, max: 30 },
    interceptRange: { min: 0, max: 50 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 350 },
  },
  {
    id: 'library-challenge',
    ratePairId: 'days-pages-read',
    setupPhrases: [
      'The library is running a reading contest.',
      '{name} signed up for the library reading challenge.',
      'The class is having a read-a-thon.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many days will {name} need to read?',
      'How many days until {name} finishes?',
    ],
    emoji: '📖',
    supportedLevels: [1, 2, 3, 4],
    slopeRange: { min: 15, max: 40 },
    interceptRange: { min: 0, max: 30 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 350 },
  },
  {
    id: 'bedtime-reading',
    ratePairId: 'days-pages-read',
    setupPhrases: [
      '{name} reads before bed every night.',
      'Every evening, {name} reads {possessive} book.',
      "{name}'s bedtime routine includes reading.",
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many nights until {name} reaches that page?',
      'How many days of reading will that take?',
    ],
    emoji: '🌙',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 8, max: 20 },
    interceptRange: { min: 0, max: 40 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 240 },
  },

  // ══════════════════════════════════════════════════════════════
  // games-points-score (elapsed) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'basketball-season',
    ratePairId: 'games-points-score',
    setupPhrases: [
      '{name} is tracking {possessive} basketball stats.',
      "It's basketball season!",
      "{name}'s team is having a great season.",
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'The team', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many games until {name} reaches that score?',
      'How many games will it take?',
    ],
    emoji: '🏀',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 8, max: 20 },
    interceptRange: { min: 0, max: 30 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 230 },
  },
  {
    id: 'video-game-score',
    ratePairId: 'games-points-score',
    setupPhrases: [
      '{name} is playing {possessive} favorite video game.',
      '{name} is trying to beat {possessive} high score.',
      'The gaming tournament is this weekend!',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'The player', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many games until {name} reaches that score?',
      'How many rounds will it take?',
    ],
    emoji: '🎮',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 50, max: 150 },
    interceptRange: { min: 0, max: 100 },
    xRange: { min: 1, max: 6 },
    yRange: { min: 0, max: 1000 },
  },
  {
    id: 'soccer-goals',
    ratePairId: 'games-points-score',
    setupPhrases: [
      '{name} plays on the school soccer team.',
      "It's soccer season!",
      'The soccer team is tracking their goals.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'The team', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many games until they reach that score?',
      'How many games will it take?',
    ],
    emoji: '⚽',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 5 },
    interceptRange: { min: 0, max: 10 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 60 },
  },

  // ══════════════════════════════════════════════════════════════
  // stickers-dollars-cost (acquired) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'sticker-shop',
    ratePairId: 'stickers-dollars-cost',
    setupPhrases: [
      '{name} is buying stickers at the store.',
      'The sticker shop has a sale!',
      '{name} loves collecting stickers.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each sticker', conjugation: 'thirdPerson' },
    ],
    emoji: '⭐',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 3 },
    interceptRange: { min: 0, max: 5 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 35 },
  },
  {
    id: 'sticker-trade',
    ratePairId: 'stickers-dollars-cost',
    setupPhrases: [
      'At the sticker trading fair,',
      '{name} is trading stickers at school.',
      'The class is having a sticker swap.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'A pack', conjugation: 'thirdPerson' },
    ],
    emoji: '🌟',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 4 },
    interceptRange: { min: 0, max: 6 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 38 },
  },

  // ══════════════════════════════════════════════════════════════
  // days-centimeters-grow (elapsed) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'crystal-growing',
    ratePairId: 'days-centimeters-grow',
    setupPhrases: [
      '{name} is growing crystals for the science fair.',
      'The science project involves growing crystals.',
      "{name}'s crystal experiment is underway.",
    ],
    subjects: [
      { phrase: 'The crystal', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many days until the crystal is that big?',
      'How many days of growing will it take?',
    ],
    emoji: '💎',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 3 },
    interceptRange: { min: 0, max: 5 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 35 },
  },
  {
    id: 'hair-growth',
    ratePairId: 'days-centimeters-grow',
    setupPhrases: [
      '{name} is tracking how fast {possessive} hair grows.',
      '{name} is measuring {possessive} hair each day.',
      '{name} wants longer hair for the school play.',
    ],
    subjects: [
      { phrase: "{name}'s hair", conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many days until {possessive} hair is long enough?',
      'How many days of growing will it take?',
    ],
    emoji: '💇',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 2 },
    interceptRange: { min: 5, max: 20 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 40 },
  },
  {
    id: 'tadpole-growth',
    ratePairId: 'days-centimeters-grow',
    setupPhrases: [
      '{name} is watching a tadpole grow.',
      'The class pet tadpole is getting bigger!',
      "{name}'s tadpole is growing fast.",
    ],
    subjects: [
      { phrase: 'The tadpole', conjugation: 'thirdPerson' },
      { phrase: 'It', conjugation: 'thirdPerson' },
    ],
    solveForXQuestions: [
      'How many days until the tadpole is that big?',
      'How many days will it take to grow?',
    ],
    emoji: '🐸',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 3 },
    interceptRange: { min: 1, max: 5 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 35 },
  },

  // ══════════════════════════════════════════════════════════════
  // scoops-dollars-cost (acquired) — NEW
  // ══════════════════════════════════════════════════════════════

  {
    id: 'ice-cream-shop',
    ratePairId: 'scoops-dollars-cost',
    setupPhrases: [
      '{name} is at the ice cream shop.',
      "It's ice cream time!",
      'The family is getting ice cream.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each scoop', conjugation: 'thirdPerson' },
    ],
    emoji: '🍦',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 2, max: 5 },
    interceptRange: { min: 0, max: 3 },
    xRange: { min: 1, max: 8 },
    yRange: { min: 0, max: 43 },
  },
  {
    id: 'frozen-yogurt',
    ratePairId: 'scoops-dollars-cost',
    setupPhrases: [
      '{name} is at the frozen yogurt place.',
      "It's frozen yogurt Friday!",
      'The class is visiting the yogurt shop.',
    ],
    subjects: [
      { phrase: '{name}', conjugation: 'thirdPerson' },
      { phrase: '{Pronoun}', conjugation: 'thirdPerson' },
      { phrase: 'Each scoop', conjugation: 'thirdPerson' },
    ],
    emoji: '🍨',
    supportedLevels: [1, 2, 3],
    slopeRange: { min: 1, max: 4 },
    interceptRange: { min: 0, max: 4 },
    xRange: { min: 1, max: 10 },
    yRange: { min: 0, max: 44 },
  },
]
