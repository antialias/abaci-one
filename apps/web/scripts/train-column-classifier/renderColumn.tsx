/**
 * Render single-column abacus SVGs for training data generation
 *
 * Uses AbacusStatic from @soroban/abacus-react for consistent rendering
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AbacusStatic } from "@soroban/abacus-react";
import type { AbacusStyleVariant } from "./types";

/**
 * Render a single column showing a digit (0-9)
 *
 * @param digit - The digit to display (0-9)
 * @param style - The visual style configuration
 * @returns SVG string
 */
export function renderColumnSVG(
  digit: number,
  style: AbacusStyleVariant,
): string {
  if (digit < 0 || digit > 9) {
    throw new Error(`Digit must be 0-9, got ${digit}`);
  }

  const element = (
    <AbacusStatic
      value={digit}
      columns={1}
      beadShape={style.beadShape}
      colorScheme={style.colorScheme}
      scaleFactor={style.scaleFactor}
      showNumbers={false}
      frameVisible={true}
      hideInactiveBeads={false}
    />
  );

  return renderToStaticMarkup(element);
}

/**
 * Generate all digit SVGs for a given style
 *
 * @param style - The visual style configuration
 * @returns Map of digit -> SVG string
 */
export function generateAllDigitSVGs(
  style: AbacusStyleVariant,
): Map<number, string> {
  const svgMap = new Map<number, string>();

  for (let digit = 0; digit <= 9; digit++) {
    svgMap.set(digit, renderColumnSVG(digit, style));
  }

  return svgMap;
}

/**
 * Calculate SVG dimensions for a single column
 *
 * @param scaleFactor - Scale factor to apply
 * @returns { width, height } in pixels
 */
export function getColumnDimensions(scaleFactor: number = 1): {
  width: number;
  height: number;
} {
  // Base dimensions for a single column (from calculateStandardDimensions)
  // These are approximate values; actual values come from the shared dimension calculator
  const baseRodSpacing = 50;
  const baseHeight = 180; // Approximate height for 1 heaven + 4 earth beads

  return {
    width: Math.round(baseRodSpacing * scaleFactor),
    height: Math.round(baseHeight * scaleFactor),
  };
}
