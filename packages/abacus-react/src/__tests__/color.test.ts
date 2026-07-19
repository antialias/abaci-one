import { describe, expect, it } from "vitest";
import { BEAD_COLOR_PALETTES, beadColorActive } from "../color";

// Regression guard for the ONE canonical bead-color resolver (Abacus Studio #7).
// The on-screen abacus (AbacusReact.getBeadColor) and the 3D print path both call
// beadColorActive now, so any drift here is a visible change to BOTH. The expected
// values below are LITERALS on purpose — deriving them from BEAD_COLOR_PALETTES
// would make the test circular and blind to a palette edit.

const heaven = (placeValue: number) => ({ placeValue, type: "heaven" as const });
const earth = (placeValue: number) => ({ placeValue, type: "earth" as const });

describe("BEAD_COLOR_PALETTES", () => {
  it("is the frozen 5×5 named-palette table", () => {
    expect(BEAD_COLOR_PALETTES).toEqual({
      default: ["#2E86AB", "#A23B72", "#F18F01", "#6A994E", "#BC4B51"],
      colorblind: ["#0173B2", "#DE8F05", "#CC78BC", "#029E73", "#D55E00"],
      mnemonic: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"],
      grayscale: ["#000000", "#404040", "#808080", "#b0b0b0", "#d0d0d0"],
      nature: ["#4E79A7", "#F28E2C", "#E15759", "#76B7B2", "#59A14F"],
    });
  });

  it("gives every palette exactly 5 slots (the place-value wrap invariant)", () => {
    for (const colors of Object.values(BEAD_COLOR_PALETTES)) {
      expect(colors).toHaveLength(5);
    }
  });
});

describe("beadColorActive", () => {
  describe("monochrome (and unknown schemes) → black, always", () => {
    it.each([0, 1, 2, 5, 20])("placeValue %i, both bead types", (pv) => {
      expect(beadColorActive(heaven(pv), "monochrome", "default")).toBe("#000000");
      expect(beadColorActive(earth(pv), "monochrome", "default")).toBe("#000000");
    });

    it("falls through unknown scheme names to black", () => {
      expect(beadColorActive(earth(0), "not-a-scheme", "default")).toBe("#000000");
    });
  });

  describe("heaven-earth → fixed Typst pair, palette- and place-value-independent", () => {
    it.each(["default", "colorblind", "mnemonic", "grayscale", "nature"])(
      "palette %s",
      (pal) => {
        expect(beadColorActive(heaven(0), "heaven-earth", pal)).toBe("#F18F01");
        expect(beadColorActive(earth(0), "heaven-earth", pal)).toBe("#2E86AB");
        // place value never enters the heaven-earth branch
        expect(beadColorActive(heaven(7), "heaven-earth", pal)).toBe("#F18F01");
        expect(beadColorActive(earth(7), "heaven-earth", pal)).toBe("#2E86AB");
      },
    );
  });

  describe("alternating → even/odd column, bead-type-independent", () => {
    it.each([
      [0, "#1E88E5"],
      [1, "#43A047"],
      [2, "#1E88E5"],
      [3, "#43A047"],
      [20, "#1E88E5"],
    ] as const)("placeValue %i → %s for both bead types", (pv, hex) => {
      expect(beadColorActive(heaven(pv), "alternating", "default")).toBe(hex);
      expect(beadColorActive(earth(pv), "alternating", "default")).toBe(hex);
    });
  });

  describe("place-value → palette indexed by place value, bead-type-independent", () => {
    const cases: Array<[string, string[]]> = [
      ["default", ["#2E86AB", "#A23B72", "#F18F01", "#6A994E", "#BC4B51"]],
      ["colorblind", ["#0173B2", "#DE8F05", "#CC78BC", "#029E73", "#D55E00"]],
      ["mnemonic", ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"]],
      ["grayscale", ["#000000", "#404040", "#808080", "#b0b0b0", "#d0d0d0"]],
      ["nature", ["#4E79A7", "#F28E2C", "#E15759", "#76B7B2", "#59A14F"]],
    ];

    it.each(cases)("palette %s: place values 0..4 map to the 5 slots", (pal, colors) => {
      for (let pv = 0; pv < 5; pv++) {
        expect(beadColorActive(heaven(pv), "place-value", pal)).toBe(colors[pv]);
        expect(beadColorActive(earth(pv), "place-value", pal)).toBe(colors[pv]);
      }
    });

    it("wraps by palette length for wide abacuses (pv 5/10/20 → slot 0)", () => {
      expect(beadColorActive(earth(5), "place-value", "default")).toBe("#2E86AB");
      expect(beadColorActive(earth(10), "place-value", "default")).toBe("#2E86AB");
      expect(beadColorActive(earth(20), "place-value", "default")).toBe("#2E86AB");
      expect(beadColorActive(earth(6), "place-value", "default")).toBe("#A23B72");
    });

    it("falls back to the default palette for an unknown palette name", () => {
      expect(beadColorActive(earth(0), "place-value", "no-such-palette")).toBe("#2E86AB");
      expect(beadColorActive(earth(2), "place-value", "no-such-palette")).toBe("#F18F01");
    });

    it("never throws for the full 1–21 column place-value range", () => {
      for (let pv = 0; pv <= 20; pv++) {
        expect(() => beadColorActive(earth(pv), "place-value", "default")).not.toThrow();
      }
    });
  });
});
