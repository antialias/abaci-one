export interface MathConstant {
  id: string
  symbol: string
  name: string
  value: number
  /** Decimal places needed to distinguish this constant from nearby integers/fractions */
  revealPrecision: number
  description: string
  ttsExplanation: string
  category: 'math' | 'physics' | 'fun'
  /** MathML markup for proper mathematical typesetting (rendered as DOM overlay) */
  mathml: string
}

/** Euler-Mascheroni constant */
const EULER_MASCHERONI = 0.5772156649

/** Feigenbaum constant (first) */
const FEIGENBAUM_DELTA = 4.6692016091

/** Fine-structure constant */
const FINE_STRUCTURE = 1 / 137.035999084

export const MATH_CONSTANTS: MathConstant[] = [
  {
    id: 'pi',
    symbol: 'π',
    name: 'Pi',
    value: Math.PI,
    revealPrecision: 2,
    description: 'The ratio of a circle\'s circumference to its diameter.',
    ttsExplanation:
      'This is pi! If you wrap a string around any circle, it will be pi times as long as the distance across. Pi starts with 3.14159 and goes on forever without repeating.',
    category: 'math',
    mathml: '<math><mi>π</mi></math>',
  },
  {
    id: 'e',
    symbol: 'e',
    name: "Euler's Number",
    value: Math.E,
    revealPrecision: 2,
    description: 'The base of natural logarithms, fundamental to growth and change.',
    ttsExplanation:
      "This is e, Euler's number! It's about 2.718. If you put one dollar in a bank that doubles your money continuously, after one year you'd have e dollars. It shows up everywhere in nature — in spirals, in how things grow, and even in music.",
    category: 'math',
    mathml: '<math><mi>e</mi></math>',
  },
  {
    id: 'phi',
    symbol: 'φ',
    name: 'Golden Ratio',
    value: (1 + Math.sqrt(5)) / 2,
    revealPrecision: 2,
    description: 'The golden ratio, found in art, architecture, and nature.',
    ttsExplanation:
      'This is phi, the golden ratio! It\'s about 1.618. Sunflower seeds spiral in patterns based on this number. Artists and architects have used it for thousands of years because shapes built with it look naturally beautiful.',
    category: 'math',
    mathml: '<math><mi>φ</mi></math>',
  },
  {
    id: 'sqrt2',
    symbol: '√2',
    name: 'Square Root of 2',
    value: Math.SQRT2,
    revealPrecision: 2,
    description: 'The diagonal of a unit square. The first known irrational number.',
    ttsExplanation:
      "This is the square root of 2! It's about 1.414. If you draw a perfect square where each side is 1, the diagonal corner-to-corner distance is exactly this number. Ancient Greeks discovered it can't be written as a simple fraction — that blew their minds!",
    category: 'math',
    mathml: '<math><msqrt><mn>2</mn></msqrt></math>',
  },
  {
    id: 'sqrt3',
    symbol: '√3',
    name: 'Square Root of 3',
    value: Math.sqrt(3),
    revealPrecision: 2,
    description: 'The height of an equilateral triangle with side length 2.',
    ttsExplanation:
      "This is the square root of 3! It's about 1.732. If you make a perfect triangle where all three sides are the same length of 2, the height from base to tip is exactly this number.",
    category: 'math',
    mathml: '<math><msqrt><mn>3</mn></msqrt></math>',
  },
  {
    id: 'tau',
    symbol: 'τ',
    name: 'Tau',
    value: 2 * Math.PI,
    revealPrecision: 2,
    description: 'Two pi — a full turn in radians.',
    ttsExplanation:
      "This is tau! It equals 2 times pi, about 6.283. Some mathematicians think tau is more natural than pi because it represents one full turn around a circle. Instead of saying a half turn is pi, a full turn is simply tau!",
    category: 'math',
    mathml: '<math><mi>τ</mi></math>',
  },
  {
    id: 'ln2',
    symbol: 'ln 2',
    name: 'Natural Log of 2',
    value: Math.LN2,
    revealPrecision: 2,
    description: 'How long it takes to double at continuous 100% growth.',
    ttsExplanation:
      "This is the natural logarithm of 2! It's about 0.693. It tells you how long it takes for something to double when it's growing continuously. If bacteria double every hour, this number connects the doubling to the growth rate.",
    category: 'math',
    mathml: '<math><mrow><mi>ln</mi><mo>\u2061</mo><mn>2</mn></mrow></math>',
  },
  {
    id: 'gamma',
    symbol: 'γ',
    name: 'Euler-Mascheroni Constant',
    value: EULER_MASCHERONI,
    revealPrecision: 2,
    description: 'The gap between the harmonic series and the natural logarithm.',
    ttsExplanation:
      "This is gamma, the Euler-Mascheroni constant! It's about 0.577. If you add up one half plus one third plus one quarter and keep going, it grows like a logarithm but always a little bit more. That little bit extra is gamma. Nobody knows if it's rational or irrational!",
    category: 'math',
    mathml: '<math><mi>γ</mi></math>',
  },
  {
    id: 'feigenbaum',
    symbol: 'δ',
    name: 'Feigenbaum Constant',
    value: FEIGENBAUM_DELTA,
    revealPrecision: 2,
    description: 'A universal constant in chaos theory and bifurcation diagrams.',
    ttsExplanation:
      "This is delta, the Feigenbaum constant! It's about 4.669. It appears in chaos theory — when simple rules create complex patterns, this number keeps showing up. It's the same whether you're looking at dripping faucets, animal populations, or electronic circuits.",
    category: 'math',
    mathml: '<math><mi>δ</mi></math>',
  },
  {
    id: 'alpha',
    symbol: 'α',
    name: 'Fine-Structure Constant',
    value: FINE_STRUCTURE,
    revealPrecision: 4,
    description: 'Roughly 1/137 — governs the strength of electromagnetism.',
    ttsExplanation:
      "This is alpha, the fine-structure constant! It's roughly 1 divided by 137. It controls how strongly light interacts with matter. If this number were even slightly different, atoms wouldn't work, chemistry wouldn't exist, and neither would we! Physicist Richard Feynman called it one of the greatest mysteries in physics.",
    category: 'physics',
    mathml: '<math><mi>α</mi></math>',
  },
  {
    id: 'ramanujan',
    symbol: '−1⁄12',
    name: 'Ramanujan Summation',
    value: -1 / 12,
    revealPrecision: 2,
    description: 'The surprising "sum" of all positive integers, used in string theory.',
    ttsExplanation:
      "This is negative one twelfth! The brilliant mathematician Ramanujan showed that if you add up 1 plus 2 plus 3 plus 4 and keep going forever, in a special mathematical sense, you get negative one twelfth. It sounds impossible, but physicists actually use this result in string theory!",
    category: 'fun',
    mathml: '<math><mrow><mo>−</mo><mfrac><mn>1</mn><mn>12</mn></mfrac></mrow></math>',
  },
]
