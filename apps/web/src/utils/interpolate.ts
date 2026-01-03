/**
 * Interpolation utilities for smooth CSS property transitions
 *
 * Used by the celebration wind-down system to morph between
 * celebration and normal banner states over ~60 seconds.
 */

// =============================================================================
// Types
// =============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export interface GradientStop {
  color: RGBA;
  position: number; // percentage 0-100
}

export interface BoxShadow {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: RGBA;
  inset?: boolean;
}

// =============================================================================
// Basic Interpolation
// =============================================================================

/**
 * Linear interpolation between two numbers
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// =============================================================================
// Color Parsing & Interpolation
// =============================================================================

/**
 * Parse a hex color to RGB
 */
export function hexToRgb(hex: string): RGB {
  // Remove # if present
  const cleanHex = hex.replace("#", "");

  // Handle 3-char hex
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;

  const num = parseInt(fullHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Convert RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parse an rgba() or rgb() string to RGBA
 */
export function parseRgba(str: string): RGBA {
  // Handle rgba(r, g, b, a) or rgb(r, g, b)
  const match = str.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (match) {
    return {
      r: parseFloat(match[1]),
      g: parseFloat(match[2]),
      b: parseFloat(match[3]),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    };
  }

  // Handle hex
  if (str.startsWith("#")) {
    const rgb = hexToRgb(str);
    return { ...rgb, a: 1 };
  }

  // Default to black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Interpolate between two hex colors
 */
export function lerpColor(startHex: string, endHex: string, t: number): string {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  return rgbToHex(
    lerp(start.r, end.r, t),
    lerp(start.g, end.g, t),
    lerp(start.b, end.b, t),
  );
}

/**
 * Interpolate between two RGBA colors
 */
export function lerpRgba(start: RGBA, end: RGBA, t: number): RGBA {
  return {
    r: lerp(start.r, end.r, t),
    g: lerp(start.g, end.g, t),
    b: lerp(start.b, end.b, t),
    a: lerp(start.a, end.a, t),
  };
}

/**
 * Convert RGBA to CSS string
 */
export function rgbaToString(rgba: RGBA): string {
  return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(rgba.b)}, ${rgba.a.toFixed(3)})`;
}

/**
 * Interpolate between two RGBA colors and return CSS string
 */
export function lerpRgbaString(start: RGBA, end: RGBA, t: number): string {
  return rgbaToString(lerpRgba(start, end, t));
}

// =============================================================================
// Gradient Interpolation
// =============================================================================

/**
 * Create a gradient stop
 */
export function gradientStop(
  r: number,
  g: number,
  b: number,
  a: number,
  position: number,
): GradientStop {
  return { color: { r, g, b, a }, position };
}

/**
 * Interpolate between two gradient stop arrays
 * Both arrays must have the same number of stops
 */
export function lerpGradientStops(
  start: GradientStop[],
  end: GradientStop[],
  t: number,
): GradientStop[] {
  if (start.length !== end.length) {
    throw new Error("Gradient stop arrays must have the same length");
  }

  return start.map((startStop, i) => {
    const endStop = end[i];
    return {
      color: lerpRgba(startStop.color, endStop.color, t),
      position: lerp(startStop.position, endStop.position, t),
    };
  });
}

/**
 * Convert gradient stops to CSS linear-gradient string
 */
export function gradientToCss(angle: number, stops: GradientStop[]): string {
  const stopsStr = stops
    .map((s) => `${rgbaToString(s.color)} ${s.position}%`)
    .join(", ");
  return `linear-gradient(${angle}deg, ${stopsStr})`;
}

/**
 * Interpolate between two linear gradients
 */
export function lerpGradient(
  startAngle: number,
  startStops: GradientStop[],
  endAngle: number,
  endStops: GradientStop[],
  t: number,
): string {
  const angle = lerp(startAngle, endAngle, t);
  const stops = lerpGradientStops(startStops, endStops, t);
  return gradientToCss(angle, stops);
}

// =============================================================================
// Box Shadow Interpolation
// =============================================================================

/**
 * Create a box shadow
 */
export function boxShadow(
  x: number,
  y: number,
  blur: number,
  spread: number,
  r: number,
  g: number,
  b: number,
  a: number,
  inset = false,
): BoxShadow {
  return { x, y, blur, spread, color: { r, g, b, a }, inset };
}

/**
 * Create a transparent (invisible) shadow for padding arrays
 */
export function transparentShadow(): BoxShadow {
  return boxShadow(0, 0, 0, 0, 0, 0, 0, 0);
}

/**
 * Pad shadow array to target length with transparent shadows
 */
function padShadows(shadows: BoxShadow[], targetLength: number): BoxShadow[] {
  const result = [...shadows];
  while (result.length < targetLength) {
    result.push(transparentShadow());
  }
  return result;
}

/**
 * Interpolate between two box shadows
 */
export function lerpBoxShadowSingle(
  start: BoxShadow,
  end: BoxShadow,
  t: number,
): BoxShadow {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
    blur: lerp(start.blur, end.blur, t),
    spread: lerp(start.spread, end.spread, t),
    color: lerpRgba(start.color, end.color, t),
    inset: t < 0.5 ? start.inset : end.inset,
  };
}

/**
 * Interpolate between two box shadow arrays
 */
export function lerpBoxShadows(
  start: BoxShadow[],
  end: BoxShadow[],
  t: number,
): BoxShadow[] {
  const maxLen = Math.max(start.length, end.length);
  const paddedStart = padShadows(start, maxLen);
  const paddedEnd = padShadows(end, maxLen);

  return paddedStart.map((s, i) => lerpBoxShadowSingle(s, paddedEnd[i], t));
}

/**
 * Convert box shadow to CSS string
 */
export function boxShadowToCss(shadow: BoxShadow): string {
  const { x, y, blur, spread, color, inset } = shadow;
  const insetStr = inset ? "inset " : "";
  return `${insetStr}${x}px ${y}px ${blur}px ${spread}px ${rgbaToString(color)}`;
}

/**
 * Convert box shadow array to CSS string
 */
export function boxShadowsToCss(shadows: BoxShadow[]): string {
  // Filter out completely transparent shadows
  const visible = shadows.filter((s) => s.color.a > 0.001 || s.blur > 0);
  if (visible.length === 0) return "none";
  return visible.map(boxShadowToCss).join(", ");
}

/**
 * Interpolate between two box shadow arrays and return CSS string
 */
export function lerpBoxShadowString(
  start: BoxShadow[],
  end: BoxShadow[],
  t: number,
): string {
  return boxShadowsToCss(lerpBoxShadows(start, end, t));
}

// =============================================================================
// Timing Functions
// =============================================================================

/**
 * Quintic ease-out: starts extremely slow, accelerates toward end
 * Perfect for imperceptible transitions
 */
export function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}

/**
 * Quartic ease-out: slightly faster than quintic
 */
export function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}

/**
 * Calculate wind-down progress for celebration banner
 *
 * @param elapsedMs - milliseconds since celebration started
 * @returns progress from 0 (full celebration) to 1 (fully normal)
 */
export function windDownProgress(elapsedMs: number): number {
  const BURST_DURATION_MS = 5_000; // 5 seconds of full celebration
  const WIND_DOWN_DURATION_MS = 55_000; // 55 seconds to transition

  if (elapsedMs < BURST_DURATION_MS) {
    return 0; // Full celebration mode
  }

  const windDownElapsed = elapsedMs - BURST_DURATION_MS;
  if (windDownElapsed >= WIND_DOWN_DURATION_MS) {
    return 1; // Fully transitioned to normal
  }

  const linearProgress = windDownElapsed / WIND_DOWN_DURATION_MS;
  return easeOutQuint(linearProgress);
}
