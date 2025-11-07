/**
 * Utility functions for 3D abacus effects
 * Includes gradient generation, color manipulation, and material definitions
 */

import type { BeadMaterial, LightingStyle } from "./AbacusReact";

/**
 * Darken a hex color by a given amount (0-1)
 */
export function darkenColor(hex: string, amount: number): string {
  // Remove # if present
  const color = hex.replace("#", "");

  // Parse RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Darken
  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

/**
 * Lighten a hex color by a given amount (0-1)
 */
export function lightenColor(hex: string, amount: number): string {
  // Remove # if present
  const color = hex.replace("#", "");

  // Parse RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Lighten
  const newR = Math.min(255, Math.floor(r + (255 - r) * amount));
  const newG = Math.min(255, Math.floor(g + (255 - g) * amount));
  const newB = Math.min(255, Math.floor(b + (255 - b) * amount));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

/**
 * Generate an SVG radial gradient for a bead based on material type
 */
export function getBeadGradient(
  id: string,
  color: string,
  material: BeadMaterial = "satin",
  active: boolean = true,
): string {
  const baseColor = active ? color : "rgb(211, 211, 211)";

  switch (material) {
    case "glossy":
      // High shine with strong highlight
      return `
        <radialGradient id="${id}" cx="30%" cy="30%">
          <stop offset="0%" stop-color="${lightenColor(baseColor, 0.6)}" stop-opacity="0.8" />
          <stop offset="20%" stop-color="${lightenColor(baseColor, 0.3)}" />
          <stop offset="50%" stop-color="${baseColor}" />
          <stop offset="100%" stop-color="${darkenColor(baseColor, 0.4)}" />
        </radialGradient>
      `;

    case "matte":
      // Subtle, no shine
      return `
        <radialGradient id="${id}" cx="50%" cy="50%">
          <stop offset="0%" stop-color="${lightenColor(baseColor, 0.1)}" />
          <stop offset="80%" stop-color="${baseColor}" />
          <stop offset="100%" stop-color="${darkenColor(baseColor, 0.15)}" />
        </radialGradient>
      `;

    case "satin":
    default:
      // Medium shine, balanced
      return `
        <radialGradient id="${id}" cx="35%" cy="35%">
          <stop offset="0%" stop-color="${lightenColor(baseColor, 0.4)}" stop-opacity="0.9" />
          <stop offset="35%" stop-color="${lightenColor(baseColor, 0.15)}" />
          <stop offset="70%" stop-color="${baseColor}" />
          <stop offset="100%" stop-color="${darkenColor(baseColor, 0.25)}" />
        </radialGradient>
      `;
  }
}

/**
 * Generate shadow definition based on lighting style
 */
export function getLightingFilter(
  lighting: LightingStyle = "top-down",
): string {
  switch (lighting) {
    case "dramatic":
      return `
        drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))
        drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))
      `;

    case "ambient":
      return `
        drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))
      `;

    case "top-down":
    default:
      return `
        drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3))
        drop-shadow(0 3px 6px rgba(0, 0, 0, 0.2))
      `;
  }
}

/**
 * Calculate Z-depth for a bead based on enhancement level and state
 */
export function getBeadZDepth(
  enhanced3d: boolean | "subtle" | "realistic",
  active: boolean,
): number {
  if (!enhanced3d || enhanced3d === true) return 0;

  if (!active) return 0;

  switch (enhanced3d) {
    case "subtle":
      return 6;
    case "realistic":
      return 10;
    default:
      return 0;
  }
}

/**
 * Generate wood grain texture SVG pattern
 */
export function getWoodGrainPattern(id: string): string {
  return `
    <pattern id="${id}" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="#8B5A2B" opacity="0.5"/>
      <!-- Grain lines - more visible -->
      <path d="M 0 10 Q 25 8 50 10 T 100 10" stroke="#654321" stroke-width="1" fill="none" opacity="0.6"/>
      <path d="M 0 30 Q 25 28 50 30 T 100 30" stroke="#654321" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M 0 50 Q 25 48 50 50 T 100 50" stroke="#654321" stroke-width="1" fill="none" opacity="0.6"/>
      <path d="M 0 70 Q 25 68 50 70 T 100 70" stroke="#654321" stroke-width="1" fill="none" opacity="0.5"/>
      <path d="M 0 90 Q 25 88 50 90 T 100 90" stroke="#654321" stroke-width="1" fill="none" opacity="0.6"/>
      <!-- Knots - more prominent -->
      <ellipse cx="20" cy="25" rx="8" ry="6" fill="#654321" opacity="0.35"/>
      <ellipse cx="75" cy="65" rx="6" ry="8" fill="#654321" opacity="0.35"/>
      <ellipse cx="45" cy="82" rx="5" ry="7" fill="#654321" opacity="0.3"/>
    </pattern>
  `;
}

/**
 * Get container class names for 3D enhancement level
 */
export function get3DContainerClasses(
  enhanced3d: boolean | "subtle" | "realistic" | undefined,
  lighting?: LightingStyle,
): string {
  const classes: string[] = ["abacus-3d-container"];

  if (!enhanced3d) return classes.join(" ");

  // Add enhancement level
  if (enhanced3d === true || enhanced3d === "subtle") {
    classes.push("enhanced-subtle");
  } else if (enhanced3d === "realistic") {
    classes.push("enhanced-realistic");
  }

  // Add lighting class
  if (lighting && enhanced3d !== "subtle") {
    classes.push(`lighting-${lighting}`);
  }

  return classes.join(" ");
}

/**
 * Generate unique gradient ID for a bead
 */
export function getBeadGradientId(
  columnIndex: number,
  beadType: "heaven" | "earth",
  position: number,
  material: BeadMaterial,
): string {
  return `bead-gradient-${columnIndex}-${beadType}-${position}-${material}`;
}

/**
 * Physics config for different enhancement levels
 */
export function getPhysicsConfig(enhanced3d: boolean | "subtle" | "realistic") {
  const base = {
    tension: 300,
    friction: 22,
    mass: 0.5,
    clamp: false,
  };

  if (!enhanced3d || enhanced3d === "subtle") {
    return { ...base, clamp: true };
  }

  // realistic
  return {
    tension: 320,
    friction: 24,
    mass: 0.6,
    clamp: false,
  };
}
