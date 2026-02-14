/**
 * Unified exploration registry — single source of truth for all explorations
 * (constant demos + tours).  Imported by both client (NumberLine) and server
 * (route.ts, generateScenario).
 *
 * Adding a new exploration = adding one entry to EXPLORATIONS below.
 */

// ── Types ────────────────────────────────────────────────────────────

export type ExplorationType = 'constant' | 'tour'

interface ExplorationBase {
  id: string
  type: ExplorationType
  name: string
  shortDesc: string
  /** For the phone agent's tool description — what the animation looks like */
  visualDesc?: string
}

export interface ConstantExploration extends ExplorationBase {
  type: 'constant'
  symbol: string
  value: number
}

export interface TourExploration extends ExplorationBase {
  type: 'tour'
  /** Total number of stops (for agent context) */
  stopCount: number
}

export type ExplorationEntry = ConstantExploration | TourExploration

/**
 * Backward-compatible alias — consumed by generateScenario.ts which only
 * needs id/name/shortDesc for prompt building.
 */
export type ExplorationDescriptor = Pick<ExplorationEntry, 'id' | 'name' | 'shortDesc'>

// ── Data ─────────────────────────────────────────────────────────────

export const EXPLORATIONS: ExplorationEntry[] = [
  {
    id: 'phi', type: 'constant', name: 'Golden Ratio', symbol: 'φ', value: 1.618033988749895,
    shortDesc: 'spirals and the golden rectangle',
    visualDesc: 'A compass arm draws a Fibonacci golden-rectangle spiral on the number line. It spins 90-degree arcs, adding progressively larger colored squares that build outward. The rectangle\'s aspect ratio visibly converges toward phi (~1.618). It does NOT show phi growing larger — it shows the SHAPE settling into the golden ratio.',
  },
  {
    id: 'pi', type: 'constant', name: 'Pi', symbol: 'π', value: Math.PI,
    shortDesc: 'circles and circumference',
    visualDesc: 'A circle rolls along the number line. The distance it travels in one full rotation marks out pi (~3.14159). Then the view zooms into pi\'s position on the number line, revealing more and more decimal digits as we zoom deeper.',
  },
  {
    id: 'tau', type: 'constant', name: 'Tau', symbol: 'τ', value: 2 * Math.PI,
    shortDesc: 'full turns (2π)',
    visualDesc: 'Similar to the pi demo but showing tau (2π ≈ 6.283). A full turn of a circle traces out tau on the number line. The view zooms into tau\'s position, revealing its decimal expansion.',
  },
  {
    id: 'e', type: 'constant', name: "Euler's Number", symbol: 'e', value: Math.E,
    shortDesc: 'compound interest and growth',
    visualDesc: 'Shows compound interest growth on the number line. Starts with simple doubling, then splits into more and more compounding intervals. The result converges toward e (~2.718). The view zooms into e\'s position to reveal its decimal digits.',
  },
  {
    id: 'gamma', type: 'constant', name: 'Euler-Mascheroni', symbol: 'γ', value: 0.5772156649,
    shortDesc: 'the harmonic series gap',
    visualDesc: 'Shows the gap between the harmonic series (1 + 1/2 + 1/3 + ...) and the natural logarithm. Bars represent harmonic terms stacking up on the number line. The gap between the staircase and the smooth curve converges to gamma (~0.577).',
  },
  {
    id: 'sqrt2', type: 'constant', name: 'Root 2', symbol: '√2', value: Math.SQRT2,
    shortDesc: 'the diagonal of a square',
    visualDesc: 'Shows a unit square on the number line with its diagonal. The diagonal length is √2. The view zooms into √2\'s position (~1.41421), revealing more decimal digits and showing it never terminates or repeats — it\'s irrational.',
  },
  {
    id: 'sqrt3', type: 'constant', name: 'Root 3', symbol: '√3', value: Math.sqrt(3),
    shortDesc: 'the height of a perfect triangle',
    visualDesc: 'Shows an equilateral triangle (all sides equal) built on the number line with base from −1 to 1. The height drops from the apex, then a compass swing rotates it onto the number line, landing at √3. The triangle is split to show the Pythagorean proof: 1² + h² = 2², so h = √3. The view zooms into √3\'s position (~1.73205), revealing its never-ending decimal expansion.',
  },
  {
    id: 'ramanujan', type: 'constant', name: 'Ramanujan Summation', symbol: '−1⁄12', value: -1 / 12,
    shortDesc: 'the surprising −1/12',
    visualDesc: 'Shows the surprising Ramanujan summation: 1+2+3+4+... = −1/12. Partial sums grow on the number line (getting bigger and bigger), but the animation reveals how a special mathematical technique (analytic continuation) assigns the value −1/12 to the divergent series.',
  },
  {
    id: 'primes', type: 'tour', name: 'Prime Numbers', stopCount: 9,
    shortDesc: 'skip counting and the sieve of Eratosthenes',
    visualDesc: 'A guided tour of prime numbers on the number line. Walks through the Sieve of Eratosthenes — crossing out multiples of 2, 3, 5, and 7 step by step to reveal the primes that remain. Highlights twin primes, prime gaps, and surprising patterns in prime distribution.',
  },
]

// ── Derived helpers ──────────────────────────────────────────────────

/** Set of all valid exploration IDs (for fast lookups). */
export const EXPLORATION_IDS = new Set(EXPLORATIONS.map(e => e.id))

/** Only constant-type explorations. */
export const CONSTANT_EXPLORATIONS = EXPLORATIONS.filter(
  (e): e is ConstantExploration => e.type === 'constant',
)

/** Only tour-type explorations. */
export const TOUR_EXPLORATIONS = EXPLORATIONS.filter(
  (e): e is TourExploration => e.type === 'tour',
)

/** Set of constant IDs that have demos available (backward compat). */
export const CONSTANT_IDS = new Set(CONSTANT_EXPLORATIONS.map(e => e.id))

/** Backward-compatible alias used by route.ts and generateScenario. */
export const AVAILABLE_EXPLORATIONS: ExplorationDescriptor[] = EXPLORATIONS

/** Display metadata keyed by ID — symbol, name, value, visualDesc. */
export const EXPLORATION_DISPLAY: Record<string, { symbol: string; name: string; value?: number; visualDesc?: string }> =
  Object.fromEntries(
    EXPLORATIONS.map(e => [
      e.id,
      {
        symbol: e.type === 'constant' ? e.symbol : '🔢',
        name: e.name,
        value: e.type === 'constant' ? e.value : undefined,
        visualDesc: e.visualDesc,
      },
    ]),
  )

// ── Recommendation graphs ────────────────────────────────────────────

/**
 * After finishing an exploration, suggest one of these related explorations.
 * Each entry has a reason to display to the child / feed to the agent.
 */
export const EXPLORATION_RECOMMENDATIONS: Record<string, { id: string; reason: string }[]> = {
  pi:        [{ id: 'tau',   reason: 'tau is 2π — the "full turn" version of pi' },
              { id: 'e',     reason: "Euler's number shows up in the famous equation e^(iπ)+1=0" },
              { id: 'phi',   reason: 'phi is another famous irrational number from geometry' }],
  tau:       [{ id: 'pi',    reason: 'pi is the more famous half of tau' },
              { id: 'sqrt2', reason: 'another irrational number hiding in simple geometry' }],
  e:         [{ id: 'pi',    reason: 'e and π are connected by the beautiful equation e^(iπ)+1=0' },
              { id: 'gamma', reason: 'the Euler-Mascheroni constant is e\'s mysterious little sibling' }],
  phi:       [{ id: 'sqrt2', reason: 'another irrational number you can find with just a square' },
              { id: 'pi',    reason: 'the two most famous numbers in geometry' }],
  gamma:     [{ id: 'e',     reason: 'gamma is deeply connected to Euler\'s number e' },
              { id: 'ramanujan', reason: 'both are surprising results that feel impossible at first' }],
  sqrt2:     [{ id: 'sqrt3', reason: '√3 is the height of a perfect triangle — another geometric irrational' },
              { id: 'phi',   reason: 'both are irrational numbers discovered by the ancient Greeks' },
              { id: 'pi',    reason: 'another irrational number, but from circles instead of squares' }],
  sqrt3:     [{ id: 'sqrt2', reason: '√2 is the diagonal of a square — another Pythagorean irrational' },
              { id: 'phi',   reason: 'the golden ratio is another irrational from geometry' }],
  ramanujan: [{ id: 'gamma', reason: 'another constant that makes you go "wait, really?"' },
              { id: 'e',     reason: 'Euler\'s number — Ramanujan loved working with it' }],
  primes:    [{ id: 'phi',   reason: 'the golden ratio is another pattern hiding in numbers' },
              { id: 'ramanujan', reason: 'Ramanujan discovered incredible formulas involving primes' }],
}

/**
 * Lightweight recommendation graph (just IDs, no reasons) — used by
 * getVisibleRecommendations to pass to the API route.
 */
export const DEMO_RECOMMENDATIONS: Record<string, string[]> = {
  phi:       ['sqrt2', 'pi',       'e'],
  pi:        ['tau',   'phi',      'ramanujan'],
  tau:       ['pi',    'e',        'gamma'],
  e:         ['gamma', 'pi',       'phi'],
  gamma:     ['e',     'ramanujan', 'sqrt2'],
  sqrt2:     ['sqrt3', 'phi',      'tau'],
  sqrt3:     ['sqrt2', 'phi',      'gamma'],
  ramanujan: ['pi',    'e',        'sqrt2'],
}
