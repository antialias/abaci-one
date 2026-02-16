/** Damped sinusoidal oscillation — used for spring snap-back and shake effects */
export function decayingSin(t: number, freq: number, decay: number): number {
  return Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * decay)
}
