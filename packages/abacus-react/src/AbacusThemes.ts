/**
 * Pre-defined theme presets for AbacusReact component
 * These eliminate the need for manual style object creation
 */

import type { AbacusCustomStyles } from "./AbacusReact";

export const ABACUS_THEMES = {
  /**
   * Light theme - solid white frame with subtle gray accents
   * Best for: Clean, minimalist designs on light backgrounds
   */
  light: {
    columnPosts: {
      fill: "rgb(255, 255, 255)",
      stroke: "rgb(200, 200, 200)",
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: "rgb(255, 255, 255)",
      stroke: "rgb(200, 200, 200)",
      strokeWidth: 3,
    },
  } as AbacusCustomStyles,

  /**
   * Dark theme - translucent white with subtle glow
   * Best for: Dark backgrounds, hero sections, dramatic presentations
   */
  dark: {
    columnPosts: {
      fill: "rgba(255, 255, 255, 0.3)",
      stroke: "rgba(255, 255, 255, 0.2)",
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: "rgba(255, 255, 255, 0.4)",
      stroke: "rgba(255, 255, 255, 0.25)",
      strokeWidth: 3,
    },
  } as AbacusCustomStyles,

  /**
   * Trophy/Premium theme - golden frame with warm tones
   * Best for: Achievements, rewards, celebration contexts
   */
  trophy: {
    columnPosts: {
      fill: "#fbbf24",
      stroke: "#f59e0b",
      strokeWidth: 3,
    },
    reckoningBar: {
      fill: "#fbbf24",
      stroke: "#f59e0b",
      strokeWidth: 4,
    },
  } as AbacusCustomStyles,

  /**
   * Translucent theme - subtle, nearly invisible frame
   * Best for: Inline displays, minimal UI, focus on beads
   */
  translucent: {
    columnPosts: {
      fill: "rgba(0, 0, 0, 0.05)",
      stroke: "rgba(0, 0, 0, 0.1)",
      strokeWidth: 1,
    },
    reckoningBar: {
      fill: "rgba(0, 0, 0, 0.1)",
      stroke: "none",
      strokeWidth: 0,
    },
  } as AbacusCustomStyles,

  /**
   * Solid/High-contrast theme - black frame for maximum visibility
   * Best for: Educational contexts, high visibility requirements
   */
  solid: {
    columnPosts: {
      fill: "rgb(0, 0, 0)",
      stroke: "rgb(0, 0, 0)",
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: "rgb(0, 0, 0)",
      stroke: "none",
      strokeWidth: 0,
    },
  } as AbacusCustomStyles,

  /**
   * Traditional/Natural theme - brown wooden appearance
   * Best for: Traditional soroban aesthetic, cultural contexts
   */
  traditional: {
    columnPosts: {
      fill: "#8B5A2B",
      stroke: "#654321",
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: "#8B5A2B",
      stroke: "#654321",
      strokeWidth: 3,
    },
  } as AbacusCustomStyles,
} as const;

/**
 * Theme names type for TypeScript autocomplete
 */
export type AbacusThemeName = keyof typeof ABACUS_THEMES;
