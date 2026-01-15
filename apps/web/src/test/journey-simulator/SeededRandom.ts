/**
 * Seeded Random Number Generator
 *
 * Uses the Mulberry32 algorithm - a fast, high-quality 32-bit PRNG.
 * This provides deterministic randomness for reproducible test runs.
 */

/**
 * Mulberry32 PRNG - fast, good distribution, seedable
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    // Ensure seed is a 32-bit integer
    this.state = seed >>> 0;
  }

  /**
   * Returns a float in [0, 1)
   * Uses the Mulberry32 algorithm
   */
  next(): number {
    // Mulberry32 algorithm
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns an integer in [min, max] inclusive
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns true with probability p
   */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /**
   * Shuffle an array in place using Fisher-Yates
   * Returns the same array for chaining
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error("Cannot pick from empty array");
    }
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Pick n random elements from an array (without replacement)
   */
  pickN<T>(array: T[], n: number): T[] {
    if (n > array.length) {
      throw new Error(
        `Cannot pick ${n} elements from array of length ${array.length}`,
      );
    }
    const copy = [...array];
    this.shuffle(copy);
    return copy.slice(0, n);
  }

  /**
   * Returns a random float in [min, max)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns a normally distributed random number using Box-Muller transform
   * @param mean - The mean of the distribution
   * @param stdDev - The standard deviation
   */
  nextGaussian(mean = 0, stdDev = 1): number {
    // Box-Muller transform
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Create a Math.random() replacement function that uses this RNG.
   * Used to mock Math.random during test execution.
   */
  createMathRandomMock(): () => number {
    return () => this.next();
  }

  /**
   * Get the current state (for debugging/serialization)
   */
  getState(): number {
    return this.state;
  }

  /**
   * Create a new SeededRandom with a derived seed
   * Useful for creating independent streams from a parent RNG
   */
  derive(label: string): SeededRandom {
    // Use a simple hash to derive a new seed from label
    let hash = this.state;
    for (let i = 0; i < label.length; i++) {
      hash = Math.imul(hash ^ label.charCodeAt(i), 0x5bd1e995);
      hash ^= hash >>> 15;
    }
    return new SeededRandom(hash >>> 0);
  }
}

/**
 * Mock Math.random with a seeded version during a function execution.
 * Automatically restores the original Math.random after completion.
 *
 * @param seed - The seed for the RNG
 * @param fn - The function to execute with mocked Math.random
 * @returns The result of fn
 */
export function withSeededRandom<T>(seed: number, fn: () => T): T {
  const originalRandom = Math.random;
  const rng = new SeededRandom(seed);
  Math.random = rng.createMathRandomMock();

  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

/**
 * Async version of withSeededRandom for async functions.
 *
 * @param seed - The seed for the RNG
 * @param fn - The async function to execute with mocked Math.random
 * @returns The result of fn
 */
export async function withSeededRandomAsync<T>(
  seed: number,
  fn: () => Promise<T>,
): Promise<T> {
  const originalRandom = Math.random;
  const rng = new SeededRandom(seed);
  Math.random = rng.createMathRandomMock();

  try {
    return await fn();
  } finally {
    Math.random = originalRandom;
  }
}
