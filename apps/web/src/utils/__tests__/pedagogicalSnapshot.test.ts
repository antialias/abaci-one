import { describe, expect, it } from "vitest";
import { generateUnifiedInstructionSequence } from "../unifiedStepGenerator";

/**
 * LEGACY: Comprehensive snapshot tests (292 tests, ~40k lines of snapshots)
 *
 * ⚠️  DEPRECATED: This massive snapshot suite is brittle and slow.
 *     Use pedagogicalCore.test.ts instead for focused validation with lean snapshots.
 *
 * This suite is now gated behind LEGACY_SNAPSHOTS=1 environment variable.
 * Run with: LEGACY_SNAPSHOTS=1 pnpm test pedagogicalSnapshot.test.ts
 */
const runLegacySnapshots = process.env.LEGACY_SNAPSHOTS === "1";

describe.skipIf(!runLegacySnapshots)(
  "Pedagogical Algorithm Snapshot Tests (Legacy)",
  () => {
    describe("Direct Entry Cases (No Complements)", () => {
      const directCases = [
        // Single digits
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [1, 2],
        [1, 3],
        [1, 4],
        [2, 3],
        [2, 4],
        [3, 4],
        [5, 6],
        [5, 7],
        [5, 8],
        [5, 9],
        // Tens place
        [0, 10],
        [0, 20],
        [0, 30],
        [0, 40],
        [0, 50],
        [10, 20],
        [20, 30],
        [30, 40],
        [40, 50],
        // Hundreds place
        [0, 100],
        [0, 200],
        [0, 300],
        [100, 200],
        // Multi-place without complements
        [11, 22],
        [22, 33],
        [123, 234],
      ];

      directCases.forEach(([start, target]) => {
        it(`should handle direct entry: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Five-Complement Cases", () => {
      const fiveComplementCases = [
        // Basic five-complements (ones place)
        [4, 7],
        [3, 6],
        [2, 5],
        [1, 4],
        [4, 8],
        [3, 7],
        [2, 6],
        [1, 5],
        [4, 9],
        [3, 8],
        [2, 7],
        [1, 6],
        // Multi-place with five-complements
        [14, 17],
        [23, 26],
        [31, 34],
        [42, 45],
        [54, 57],
        [134, 137],
        [223, 226],
        [314, 317],
        [425, 428],
        // Complex multi-place five-complements
        [1234, 1237],
        [2341, 2344],
        [3452, 3455],
        // Five-complements in different places
        [40, 70],
        [400, 700],
        [1400, 1700],
        [24000, 27000],
      ];

      fiveComplementCases.forEach(([start, target]) => {
        it(`should handle five-complement: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Ten-Complement Cases", () => {
      const tenComplementCases = [
        // Basic ten-complements (ones place)
        [4, 11],
        [6, 13],
        [7, 14],
        [8, 15],
        [9, 16],
        [3, 12],
        [2, 11],
        [1, 10],
        [8, 17],
        [7, 16],
        // Ten-complements crossing places
        [19, 26],
        [28, 35],
        [37, 44],
        [46, 53],
        [55, 62],
        [64, 71],
        [73, 80],
        [82, 89],
        [91, 98],
        // Multi-place ten-complements
        [94, 101],
        [193, 200],
        [294, 301],
        [395, 402],
        [496, 503],
        [597, 604],
        [698, 705],
        [799, 806],
        // Complex ten-complements
        [1294, 1301],
        [2395, 2402],
        [3496, 3503],
        [4597, 4604],
      ];

      tenComplementCases.forEach(([start, target]) => {
        it(`should handle ten-complement: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Cascading Complement Cases", () => {
      const cascadingCases = [
        // Single 9 cascades
        [99, 107],
        [199, 207],
        [299, 307],
        [399, 407],
        [499, 507],
        [599, 607],
        [699, 707],
        [799, 807],
        // Double 9 cascades
        [999, 1007],
        [1999, 2007],
        [2999, 3007],
        // Triple 9 cascades
        [9999, 10007],
        [19999, 20007],
        // Complex cascading with different digits
        [89, 97],
        [189, 197],
        [289, 297],
        [389, 397],
        [98, 105],
        [198, 205],
        [298, 305],
        [398, 405],
        [979, 986],
        [1979, 1986],
        [2979, 2986],
        [989, 996],
        [1989, 1996],
        [2989, 2996],
        // Mixed place cascading
        [1899, 1907],
        [2899, 2907],
        [12899, 12907],
        [9899, 9907],
        [19899, 19907],
      ];

      cascadingCases.forEach(([start, target]) => {
        it(`should handle cascading complement: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Mixed Operation Cases", () => {
      const mixedCases = [
        // Five + ten complement combinations
        [43, 51],
        [134, 142],
        [243, 251],
        [352, 360],
        // Multi-place with various complements
        [1234, 1279],
        [2345, 2383],
        [3456, 3497],
        [4567, 4605],
        [5678, 5719],
        [6789, 6827],
        // Complex mixed operations
        [12345, 12389],
        [23456, 23497],
        [34567, 34605],
        [45678, 45719],
        [56789, 56827],
        [67890, 67935],
        // Large number operations
        [123456, 123497],
        [234567, 234605],
        [345678, 345719],
        [456789, 456827],
        [567890, 567935],
        [678901, 678943],
      ];

      mixedCases.forEach(([start, target]) => {
        it(`should handle mixed operations: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Edge Cases and Boundary Conditions", () => {
      const edgeCases = [
        // Zero operations
        [0, 0],
        [5, 5],
        [10, 10],
        [123, 123],
        // Single unit additions
        [0, 1],
        [1, 2],
        [9, 10],
        [99, 100],
        [999, 1000],
        // Maximum single-place values
        [0, 9],
        [10, 19],
        [90, 99],
        [900, 909],
        // Place value boundaries
        [9, 10],
        [99, 100],
        [999, 1000],
        [9999, 10000],
        [19, 20],
        [199, 200],
        [1999, 2000],
        [19999, 20000],
        // All 9s patterns
        [9, 18],
        [99, 108],
        [999, 1008],
        [9999, 10008],
        // Alternating patterns
        [1357, 1369],
        [2468, 2479],
        [13579, 13591],
        // Repeated digit patterns
        [1111, 1123],
        [2222, 2234],
        [3333, 3345],
        [11111, 11123],
        [22222, 22234],
      ];

      edgeCases.forEach(([start, target]) => {
        it(`should handle edge case: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Large Number Operations", () => {
      const largeNumberCases = [
        // Five-digit operations
        [12345, 12378],
        [23456, 23489],
        [34567, 34599],
        [45678, 45711],
        [56789, 56822],
        [67890, 67923],
        // Six-digit operations
        [123456, 123489],
        [234567, 234599],
        [345678, 345711],
        [456789, 456822],
        [567890, 567923],
        [678901, 678934],
        // Seven-digit operations (millions)
        [1234567, 1234599],
        [2345678, 2345711],
        [3456789, 3456822],
      ];

      largeNumberCases.forEach(([start, target]) => {
        it(`should handle large numbers: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Systematic Coverage by Difference", () => {
      const systematicCases = [
        // Difference of 1-9 (various starting points)
        [0, 1],
        [5, 6],
        [9, 10],
        [15, 16],
        [99, 100],
        [0, 2],
        [3, 5],
        [8, 10],
        [14, 16],
        [98, 100],
        [0, 3],
        [2, 5],
        [7, 10],
        [13, 16],
        [97, 100],
        [0, 4],
        [1, 5],
        [6, 10],
        [12, 16],
        [96, 100],
        [0, 5],
        [0, 6],
        [0, 7],
        [0, 8],
        [0, 9],

        // Difference of 10-19
        [0, 10],
        [5, 15],
        [90, 100],
        [195, 205],
        [0, 11],
        [4, 15],
        [89, 100],
        [194, 205],
        [0, 12],
        [3, 15],
        [88, 100],
        [193, 205],
        [0, 13],
        [2, 15],
        [87, 100],
        [192, 205],
        [0, 14],
        [1, 15],
        [86, 100],
        [191, 205],
        [0, 15],
        [0, 16],
        [0, 17],
        [0, 18],
        [0, 19],

        // Difference of 20-29
        [0, 20],
        [5, 25],
        [80, 100],
        [185, 205],
        [0, 25],
        [0, 27],
        [0, 29],
        [75, 100],
        [180, 205],

        // Difference of larger amounts
        [0, 50],
        [50, 100],
        [0, 100],
        [900, 1000],
        [0, 123],
        [100, 223],
        [877, 1000],
        [1877, 2000],
      ];

      systematicCases.forEach(([start, target]) => {
        it(`should handle systematic case: ${start} → ${target} (diff: ${target - start})`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Stress Test Cases", () => {
      const stressCases = [
        // Maximum complexity cascades
        [99999, 100008],
        [199999, 200008],
        [999999, 1000008],
        // Multiple cascade triggers
        [9999, 10017],
        [99999, 100026],
        [999999, 1000035],
        // Complex multi-place with all complement types
        [49999, 50034],
        [149999, 150034],
        [249999, 250034],
        // Alternating complement patterns
        [4949, 4983],
        [14949, 14983],
        [24949, 24983],
      ];

      stressCases.forEach(([start, target]) => {
        it(`should handle stress test: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });

    describe("Regression Prevention Cases", () => {
      // These are the exact cases from the original pedagogical tests
      // to ensure we never regress from the current perfect state
      const regressionCases = [
        [0, 1],
        [1, 3],
        [0, 4],
        [0, 5],
        [5, 7],
        [0, 10],
        [4, 7],
        [3, 5],
        [2, 3],
        [0, 6],
        [1, 5],
        [4, 11],
        [6, 15],
        [7, 15],
        [5, 9],
        [9, 18],
        [12, 34],
        [23, 47],
        [34, 78],
        [89, 97],
        [99, 107],
      ];

      regressionCases.forEach(([start, target]) => {
        it(`should maintain regression case: ${start} → ${target}`, () => {
          const result = generateUnifiedInstructionSequence(start, target);
          expect(result).toMatchSnapshot();
        });
      });
    });
  },
);
