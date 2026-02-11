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
  /** Prompt suffix for generating a whimsical metaphor illustration (flat vector style) */
  metaphorPrompt: string
  /** Prompt suffix for generating a technical math illustration (neon blueprint style) */
  mathPrompt: string
  /** Path to metaphor illustration (populated after generation) */
  metaphorImage?: string
  /** Path to math/blueprint illustration (populated after generation) */
  mathImage?: string
}

/** Shared prompt prefix for metaphor-style illustrations */
export const METAPHOR_PROMPT_PREFIX =
  'Clean flat vector illustration, bold colors, simple geometric shapes, no text, no labels, square 1:1 composition, white background.'

/** Shared prompt prefix for math/blueprint-style illustrations */
export const MATH_PROMPT_PREFIX =
  'Technical blueprint diagram, glowing cyan/teal neon lines on dark navy background, no text, no labels, square 1:1 composition, precise geometric construction.'

/** Theme-specific prompt modifiers appended during generation */
export const THEME_MODIFIERS = {
  light: {
    metaphor:
      'IMPORTANT: Use a clean white (#ffffff) background. Ensure all colors are vibrant and visible against the light background. Same subject and composition.',
    math: 'IMPORTANT: Use a clean white (#ffffff) background instead of cream parchment. Use bold primary colors (red, blue, gold) that stand out crisply against white. Same geometric construction and composition.',
  },
  dark: {
    metaphor:
      'IMPORTANT: Use a dark navy background (#1e1e28). Use bright, saturated colors with high contrast against the dark background. Same subject and composition.',
    math: 'IMPORTANT: Use a dark slate background (#1a1a2e) resembling aged dark vellum. Use bright vivid primary colors (vermillion, electric blue, bright gold) with high contrast against the dark ground. Same geometric construction and composition.',
  },
} as const

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
    description: 'If you walk straight across a round pond, that is one step, but walking all the way around the edge takes a little more than three steps. No matter how giant the pond is or how tiny a raindrop is, the walk around the outside is always exactly that many times longer than the walk across. This number is the universal rule that locks every circle into its perfect shape, connecting the edge to the center. It is the secret recipe that tells nature exactly how to make things round.',
    ttsExplanation:
      'This is pi! If you wrap a string around any circle, it will be pi times as long as the distance across. Pi starts with 3.14159 and goes on forever without repeating.',
    category: 'math',
    mathml: '<math><mi>π</mi></math>',
    metaphorPrompt:
      'A tiny person walking straight across a perfectly round pond in one step, then the same person walking all the way around the edge of the pond taking a little more than three steps. Show the diameter path and the circumference path with different colors.',
    mathPrompt:
      'A perfect circle with a highlighted diameter line and the circumference unrolled into a straight line below it, showing the ratio is slightly more than 3. Glowing arcs and measurement marks.',
    metaphorImage: '/images/constants/pi-metaphor.png',
    mathImage: '/images/constants/pi-math.png',
  },
  {
    id: 'e',
    symbol: 'e',
    name: "Euler's Number",
    value: Math.E,
    revealPrecision: 2,
    description: 'Imagine a magic vine where every tiny new leaf immediately starts growing its own baby leaves the very moment it appears. Because every new speck of green adds to the growth instantly without waiting for a turn, the plant pushes to become almost three times as big as it started. This specific size is nature\'s limit for how much something can expand when every single part of it is growing continuously. It is the universe\'s secret number for perfectly smooth, non-stop change.',
    ttsExplanation:
      "This is e, Euler's number! It's about 2.718. If you put one dollar in a bank that doubles your money continuously, after one year you'd have e dollars. It shows up everywhere in nature — in spirals, in how things grow, and even in music.",
    category: 'math',
    mathml: '<math><mi>e</mi></math>',
    metaphorPrompt:
      'A magic vine growing from a single stem, with each tiny leaf sprouting its own baby leaves instantly. The vine is lush and fractal-like, almost tripling from its original size. Warm greens with golden highlights.',
    mathPrompt:
      'The exponential curve y=eˣ rising steeply, with compound interest stepping functions converging toward the smooth curve. Show the limit of (1+1/n)ⁿ as stacked rectangular approximations approaching the curve.',
    metaphorImage: '/images/constants/e-metaphor.png',
    mathImage: '/images/constants/e-math.png',
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
    metaphorPrompt:
      'A sunflower viewed from above with spiral seed patterns radiating from the center. Golden petals arranged in a fibonacci spiral. Warm yellows and oranges.',
    mathPrompt:
      'A golden rectangle subdivided into successively smaller golden rectangles, with a logarithmic spiral (golden spiral) traced through their corners. Precise proportional construction lines.',
    metaphorImage: '/images/constants/phi-metaphor.png',
    mathImage: '/images/constants/phi-math.png',
  },
  {
    id: 'sqrt2',
    symbol: '√2',
    name: 'Square Root of 2',
    value: Math.SQRT2,
    revealPrecision: 2,
    description: 'If you have a square garden tile, walking straight through the middle is a secret shortcut compared to walking along the sides. This path is longer than one side but shorter than two, and it is a special distance that regular counting numbers can never measure perfectly. It teaches us that cutting diagonally across a shape creates a new kind of number that goes on forever. This number is the hidden key that turns a square into two perfect triangles.',
    ttsExplanation:
      "This is the square root of 2! It's about 1.414. If you draw a perfect square where each side is 1, the diagonal corner-to-corner distance is exactly this number. Ancient Greeks discovered it can't be written as a simple fraction — that blew their minds!",
    category: 'math',
    mathml: '<math><msqrt><mn>2</mn></msqrt></math>',
    metaphorPrompt:
      'A square garden tile viewed from above with a glowing diagonal line cutting across it as a shortcut. Two tiny people — one walking along two sides, one cutting diagonally. The diagonal splits the square into two perfect triangles.',
    mathPrompt:
      'A unit square with side length 1, its diagonal highlighted, and the Pythagorean theorem shown geometrically: two small squares on the sides and one larger square on the hypotenuse. Construction lines and right-angle marks.',
    metaphorImage: '/images/constants/sqrt2-metaphor.png',
    mathImage: '/images/constants/sqrt2-math.png',
  },
  {
    id: 'sqrt3',
    symbol: '√3',
    name: 'Square Root of 3',
    value: Math.sqrt(3),
    revealPrecision: 2,
    description: 'Imagine you are inside a square box and you stretch a string from the bottom corner all the way through the air to the top opposite corner. This distance is longer than the floor and longer than the wall; it is the longest reach possible inside that space. It shows us exactly how much "deeper" the world is when you move from flat drawings to solid blocks. This number defines the structural shape of honeycomb cells and how bubbles stack together in a pile.',
    ttsExplanation:
      "This is the square root of 3! It's about 1.732. If you make a perfect triangle where all three sides are the same length of 2, the height from base to tip is exactly this number.",
    category: 'math',
    mathml: '<math><msqrt><mn>3</mn></msqrt></math>',
    metaphorPrompt:
      'A transparent cube/box viewed in 3D perspective with a glowing string stretched from the bottom-front-left corner to the top-back-right corner — the space diagonal. Honeycomb cells and stacked bubbles nearby.',
    mathPrompt:
      'A cube with edge length 1, showing the face diagonal (√2) and the space diagonal (√3) as glowing lines. An equilateral triangle cross-section highlighted inside the cube.',
    metaphorImage: '/images/constants/sqrt3-metaphor.png',
    mathImage: '/images/constants/sqrt3-math.png',
  },
  {
    id: 'tau',
    symbol: 'τ',
    name: 'Tau',
    value: 2 * Math.PI,
    revealPrecision: 2,
    description: 'While the number Pi is like walking only halfway around a circle, this number represents one whole, perfect spin around the center. It compares the path all the way around the edge to the short stick from the center, making it the number of one complete turn. Instead of stopping halfway, it describes the full journey of a spinning wheel returning to where it started. It is the true heartbeat of a circle, representing one entire revolution.',
    ttsExplanation:
      "This is tau! It equals 2 times pi, about 6.283. Some mathematicians think tau is more natural than pi because it represents one full turn around a circle. Instead of saying a half turn is pi, a full turn is simply tau!",
    category: 'math',
    mathml: '<math><mi>τ</mi></math>',
    metaphorPrompt:
      'A spinning wheel or merry-go-round completing one full revolution, with a trail showing the complete circular path. A stick figure riding it all the way around back to the start. Bright, dynamic, sense of motion.',
    mathPrompt:
      'A unit circle with the full circumference highlighted (not just half). A radius line sweeping through a complete 360° rotation, with radians marked. The full arc glowing brightly compared to a dimmer half-arc (π).',
    metaphorImage: '/images/constants/tau-metaphor.png',
    mathImage: '/images/constants/tau-math.png',
  },
  {
    id: 'ln2',
    symbol: 'ln 2',
    name: 'Natural Log of 2',
    value: Math.LN2,
    revealPrecision: 2,
    description: 'If our magic vine grows smoothly, this number tells you the exact moment on the clock when the vine becomes double its size. It acts as a bridge, converting the smooth, continuous growth of nature into the simple idea of doubling. It marks the specific time when "one" leaf turns into "two" leaves in a world of perfect, non-stop growth. This number is the universal "waiting time" required for nature to reach the next level.',
    ttsExplanation:
      "This is the natural logarithm of 2! It's about 0.693. It tells you how long it takes for something to double when it's growing continuously. If bacteria double every hour, this number connects the doubling to the growth rate.",
    category: 'math',
    mathml: '<math><mrow><mi>ln</mi><mo>\u2061</mo><mn>2</mn></mrow></math>',
    metaphorPrompt:
      'The same magic vine from e, but now with a clock or hourglass beside it showing the exact moment when one leaf becomes two leaves. The vine at the halfway-point of its growth journey. A bridge connecting "1" to "2".',
    mathPrompt:
      'The curve y=eˣ with a horizontal line at y=2 intersecting it. A vertical drop-line from the intersection to x=ln(2)≈0.693 on the x-axis. The area under the curve 1/x from 1 to 2 shaded.',
    metaphorImage: '/images/constants/ln2-metaphor.png',
    mathImage: '/images/constants/ln2-math.png',
  },
  {
    id: 'gamma',
    symbol: 'γ',
    name: 'Euler-Mascheroni Constant',
    value: EULER_MASCHERONI,
    revealPrecision: 2,
    description: 'If you build a smooth slide out of square blocks, a tiny jagged edge will always stick out. This number is the size of that stubborn gap that refuses to disappear, no matter how small you make the blocks. It is the permanent "error code" nature gets when it tries to turn smooth flows into counting numbers.',
    ttsExplanation:
      "This is gamma, the Euler-Mascheroni constant! It's about 0.577. If you add up one half plus one third plus one quarter and keep going, it grows like a logarithm but always a little bit more. That little bit extra is gamma. Nobody knows if it's rational or irrational!",
    category: 'math',
    mathml: '<math><mi>γ</mi></math>',
    metaphorPrompt:
      'A smooth curved slide built from tiny square blocks, with a small jagged gap visible between the smooth curve and the stepped blocks. The gap is highlighted in a contrasting color, stubbornly present no matter how small the blocks get.',
    mathPrompt:
      'A smooth ln(x) curve with a staircase function (harmonic series partial sums) stepping above it. The persistent gap between the staircase and the curve highlighted as a glowing strip of constant width γ≈0.577.',
    metaphorImage: '/images/constants/gamma-metaphor.png',
    mathImage: '/images/constants/gamma-math.png',
  },
  {
    id: 'feigenbaum',
    symbol: 'δ',
    name: 'Feigenbaum Constant',
    value: FEIGENBAUM_DELTA,
    revealPrecision: 2,
    description: 'When a dripping tap speeds up, the rhythm splits into two beats, then four, rushing toward a crash. This number is the stopwatch that tells the drops exactly when to split again as they zoom into chaos. It is the universal speed limit for how fast simple order turns into a storm.',
    ttsExplanation:
      "This is delta, the Feigenbaum constant! It's about 4.669. It appears in chaos theory — when simple rules create complex patterns, this number keeps showing up. It's the same whether you're looking at dripping faucets, animal populations, or electronic circuits.",
    category: 'math',
    mathml: '<math><mi>δ</mi></math>',
    metaphorPrompt:
      'A dripping faucet where drops split into two streams, then four, then eight, rushing toward chaotic splashing. The rhythm of splitting visualized as branching paths. Blues and silvers.',
    mathPrompt:
      'A bifurcation diagram (logistic map) showing period-doubling cascade. The parameter axis horizontal, population vertical. Branches splitting at accelerating intervals, converging to chaos. The ratio between successive bifurcation points highlighted.',
    metaphorImage: '/images/constants/feigenbaum-metaphor.png',
    mathImage: '/images/constants/feigenbaum-math.png',
  },
  {
    id: 'alpha',
    symbol: 'α',
    name: 'Fine-Structure Constant',
    value: FINE_STRUCTURE,
    revealPrecision: 4,
    description: 'This number tells us how "sticky" light is, acting like the strength of the velcro holding atoms together. If this number were even a tiny bit different, the sun would not shine and the solid ground would crumble apart like dust. It is the specific strength setting of the universe that allows light to grab onto matter. It acts as the cosmic volume knob for electricity.',
    ttsExplanation:
      "This is alpha, the fine-structure constant! It's roughly 1 divided by 137. It controls how strongly light interacts with matter. If this number were even slightly different, atoms wouldn't work, chemistry wouldn't exist, and neither would we! Physicist Richard Feynman called it one of the greatest mysteries in physics.",
    category: 'physics',
    mathml: '<math><mi>α</mi></math>',
    metaphorPrompt:
      'Beams of light sticking to atoms like velcro, with a cosmic volume/dial knob controlling how strongly light grabs matter. A sun shining, solid ground stable. Cosmic purple and gold tones.',
    mathPrompt:
      'A Feynman diagram showing a photon (wavy line) coupling to an electron (straight line) at a vertex. The coupling constant α≈1/137 visualized as the vertex strength. Particle physics interaction diagram.',
    metaphorImage: '/images/constants/alpha-metaphor.png',
    mathImage: '/images/constants/alpha-math.png',
  },
  {
    id: 'ramanujan',
    symbol: '−1⁄12',
    name: 'Ramanujan Summation',
    value: -1 / 12,
    revealPrecision: 2,
    description: 'If you trap infinite waves between two walls, they don\'t push them apart\u2014they suck them together. The math shows that adding up all that pushing creates a tiny, negative weight pulling backward. It is the secret suction holding empty space together.',
    ttsExplanation:
      "This is negative one twelfth! The brilliant mathematician Ramanujan showed that if you add up 1 plus 2 plus 3 plus 4 and keep going forever, in a special mathematical sense, you get negative one twelfth. It sounds impossible, but physicists actually use this result in string theory!",
    category: 'fun',
    mathml: '<math><mrow><mo>−</mo><mfrac><mn>1</mn><mn>12</mn></mfrac></mrow></math>',
    metaphorPrompt:
      'Two parallel walls with invisible waves trapped between them, the walls being sucked together instead of pushed apart. A tiny vacuum force pulling inward. Dark space between the plates with subtle wave patterns.',
    mathPrompt:
      'The Casimir effect diagram: two parallel conducting plates with standing electromagnetic waves between them (discrete modes) and continuous wave spectrum outside. Arrows showing the net inward force. Quantum vacuum energy visualization.',
    metaphorImage: '/images/constants/ramanujan-metaphor.png',
    mathImage: '/images/constants/ramanujan-math.png',
  },
]
