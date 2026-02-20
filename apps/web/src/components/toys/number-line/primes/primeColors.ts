import { getPrimeOrdinal } from './sieve'

/**
 * Golden angle in degrees (~137.508).
 * Successive multiples produce maximally-spaced hues around the color wheel.
 */
const GOLDEN_ANGLE = 137.50776405003785

/**
 * Get the hue (0-360) for a given prime based on its ordinal index.
 * Uses golden-angle spacing for maximum perceptual distance between adjacent primes.
 */
function primeHue(prime: number): number {
  const ordinal = getPrimeOrdinal(prime)
  return (ordinal * GOLDEN_ANGLE) % 360
}

/**
 * Convert HSL to RGB values (each 0-255).
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/**
 * Get an RGBA color string for a prime's color.
 * Theme-aware: dark mode uses lighter/more saturated colors,
 * light mode uses deeper/muted colors.
 */
export function primeColorRgba(prime: number, alpha: number, isDark: boolean): string {
  const hue = primeHue(prime)
  const sat = isDark ? 0.7 : 0.65
  const lum = isDark ? 0.55 : 0.45
  const [r, g, b] = hslToRgb(hue, sat, lum)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Get an RGB color string (no alpha) for a prime's color.
 */
export function primeColorRgb(prime: number, isDark: boolean): string {
  const hue = primeHue(prime)
  const sat = isDark ? 0.7 : 0.65
  const lum = isDark ? 0.55 : 0.45
  const [r, g, b] = hslToRgb(hue, sat, lum)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Get the CSS hex color for a prime (for use in DOM elements like tooltip spans).
 */
export function primeColorHex(prime: number, isDark: boolean): string {
  const hue = primeHue(prime)
  const sat = isDark ? 0.7 : 0.65
  const lum = isDark ? 0.55 : 0.45
  const [r, g, b] = hslToRgb(hue, sat, lum)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
