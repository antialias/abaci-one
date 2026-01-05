import { describe, expect, it } from "vitest";

import {
  calculateLabelOpacity,
  getArrowStartPoint,
  getRenderedViewport,
  LABEL_FADE_RADIUS,
  LABEL_MIN_OPACITY,
} from "../labelUtils";

describe("labelUtils", () => {
  describe("getRenderedViewport", () => {
    it("calculates viewport for landscape SVG with square viewBox", () => {
      const svgRect = { width: 800, height: 600 } as DOMRect;
      const result = getRenderedViewport(svgRect, 0, 0, 1000, 1000);

      // SVG is wider (800/600 = 1.33) than viewBox (1000/1000 = 1)
      // So letterboxing on sides
      expect(result.renderedHeight).toBe(600);
      expect(result.renderedWidth).toBe(600); // height * viewBoxAspect
      expect(result.letterboxX).toBe(100); // (800 - 600) / 2
      expect(result.letterboxY).toBe(0);
      expect(result.scale).toBe(0.6); // 600 / 1000
      expect(result.viewBoxX).toBe(0);
      expect(result.viewBoxY).toBe(0);
    });

    it("calculates viewport for portrait SVG with landscape viewBox", () => {
      const svgRect = { width: 400, height: 600 } as DOMRect;
      const result = getRenderedViewport(svgRect, 0, 0, 1000, 500);

      // SVG is portrait (400/600 = 0.67), viewBox is landscape (1000/500 = 2)
      // SVG is taller than needed, letterboxing top/bottom
      expect(result.renderedWidth).toBe(400);
      expect(result.renderedHeight).toBe(200); // width / viewBoxAspect
      expect(result.letterboxX).toBe(0);
      expect(result.letterboxY).toBe(200); // (600 - 200) / 2
      expect(result.scale).toBe(0.4); // 400 / 1000
    });

    it("handles viewBox offset", () => {
      const svgRect = { width: 500, height: 500 } as DOMRect;
      const result = getRenderedViewport(svgRect, 100, 200, 1000, 1000);

      // Offset doesn't affect viewport dimensions, only scale
      expect(result.renderedWidth).toBe(500);
      expect(result.renderedHeight).toBe(500);
      expect(result.scale).toBe(0.5);
      expect(result.viewBoxX).toBe(100);
      expect(result.viewBoxY).toBe(200);
    });
  });

  describe("calculateLabelOpacity", () => {
    const baseParams = {
      regionsFound: ["us", "ca", "mx"],
      isGiveUpAnimating: false,
    };

    it("returns 0 during give-up animation", () => {
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        { x: 50, y: 50 },
        null,
        ["us"],
        true,
      );

      expect(result).toBe(0);
    });

    it("returns full opacity when no cursor position", () => {
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        null,
        null,
        baseParams.regionsFound,
        false,
      );

      expect(result).toBe(1);
    });

    it("returns full opacity when hovering over found label region", () => {
      const result = calculateLabelOpacity(
        100,
        100,
        "us", // label region
        { x: 100, y: 100 }, // cursor at label
        "us", // hovering over same region
        baseParams.regionsFound,
        false,
      );

      expect(result).toBe(1);
    });

    it("returns full opacity when cursor is outside fade radius", () => {
      const farDistance = LABEL_FADE_RADIUS + 50;
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        { x: 100 + farDistance, y: 100 },
        null,
        baseParams.regionsFound,
        false,
      );

      expect(result).toBe(1);
    });

    it("returns minimum opacity when cursor is at label position", () => {
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        { x: 100, y: 100 }, // exactly at label
        null, // not hovering
        [], // not found, so no special treatment
        false,
      );

      expect(result).toBe(LABEL_MIN_OPACITY);
    });

    it("interpolates opacity based on distance", () => {
      const halfDistance = LABEL_FADE_RADIUS / 2;
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        { x: 100 + halfDistance, y: 100 },
        null,
        [],
        false,
      );

      // At half distance, opacity should be midway
      const expectedOpacity = LABEL_MIN_OPACITY + 0.5 * (1 - LABEL_MIN_OPACITY);
      expect(result).toBeCloseTo(expectedOpacity);
    });

    it("handles diagonal distance correctly", () => {
      // Create a point at 45 degrees where distance equals LABEL_FADE_RADIUS
      const diagonalComponent = LABEL_FADE_RADIUS / Math.sqrt(2);
      const result = calculateLabelOpacity(
        100,
        100,
        "us",
        { x: 100 + diagonalComponent, y: 100 + diagonalComponent },
        null,
        [],
        false,
      );

      // Should be at full opacity (at the boundary)
      expect(result).toBeCloseTo(1);
    });
  });

  describe("getArrowStartPoint", () => {
    const labelWidth = 100;
    const labelHeight = 30;

    it("finds intersection on right edge when target is to the right", () => {
      const result = getArrowStartPoint(
        100,
        100, // label center
        labelWidth,
        labelHeight,
        200,
        100, // target directly to the right
      );

      expect(result.x).toBe(150); // right edge (100 + 100/2)
      expect(result.y).toBe(100); // same y
    });

    it("finds intersection on left edge when target is to the left", () => {
      const result = getArrowStartPoint(
        100,
        100,
        labelWidth,
        labelHeight,
        0,
        100, // target directly to the left
      );

      expect(result.x).toBe(50); // left edge (100 - 100/2)
      expect(result.y).toBe(100);
    });

    it("finds intersection on bottom edge when target is below", () => {
      const result = getArrowStartPoint(
        100,
        100,
        labelWidth,
        labelHeight,
        100,
        200, // target directly below
      );

      expect(result.x).toBe(100);
      expect(result.y).toBe(115); // bottom edge (100 + 30/2)
    });

    it("finds intersection on top edge when target is above", () => {
      const result = getArrowStartPoint(
        100,
        100,
        labelWidth,
        labelHeight,
        100,
        0, // target directly above
      );

      expect(result.x).toBe(100);
      expect(result.y).toBe(85); // top edge (100 - 30/2)
    });

    it("finds corner intersection for diagonal targets", () => {
      const result = getArrowStartPoint(
        100,
        100,
        labelWidth,
        labelHeight,
        200,
        200, // target to lower-right
      );

      // With label 100x30, going diagonally at 45 degrees:
      // - Right edge at x=150 needs t=0.5, giving y=150 (outside ±15 from center)
      // - Bottom edge at y=115 needs t=0.15, giving x=115 (inside ±50 from center)
      // So it exits from the bottom edge, not the right edge
      expect(result.y).toBe(115); // bottom edge (100 + 30/2)
      expect(result.x).toBe(115); // x moves same amount as y
    });

    it("returns center when target is at center", () => {
      const result = getArrowStartPoint(
        100,
        100,
        labelWidth,
        labelHeight,
        100,
        100,
      );

      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });
  });
});
