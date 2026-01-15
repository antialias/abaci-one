/**
 * Continental Music Presets
 *
 * Layer 2 patterns that provide regional musical character.
 * ENERGETIC patterns with drums, bass, and melodic elements.
 * This is game music - it should be engaging, not sleep-inducing!
 *
 * @see https://strudel.cc/recipes/recipes/
 * @see https://strudel.cc/learn/tonal/
 */

export interface ContinentalPreset {
  /** Unique identifier */
  id: string
  /** Display name */
  name: string
  /** Strudel pattern for this continent */
  pattern: string
  /** Base gain level (0-1) */
  gain: number
}

/**
 * Responsive, evolving game music using advanced Strudel techniques:
 * - Euclidean rhythms: bd(3,8) for mathematically interesting beats
 * - Continuous signals: perlin, sine for filter automation
 * - Stereo effects: jux(rev) for width
 * - Harmonic movement: add() for transposition over time
 * - Spatial depth: delay, off() for echoes
 * - FM synthesis: fm() for richer timbres
 */
export const continentalPresets: Record<string, ContinentalPreset> = {
  europe: {
    id: 'europe',
    name: 'Europe',
    // Euro adventure - Euclidean drums, sweeping filters, stereo width
    pattern: `stack(
      s("bd(3,8), hh(5,8), cp(2,8,3)").gain(0.4),
      n("0 4 7 4".add("<0 2 5 2>"))
        .scale("D:dorian")
        .s("sawtooth")
        .fm(2)
        .lpf(sine.range(600,2000).slow(8))
        .gain(0.28)
        .room(0.3)
        .jux(rev),
      n("<0 2 4 5>")
        .scale("D2:dorian")
        .s("sawtooth")
        .lpf(perlin.range(200,500))
        .gain(0.22)
        .slow(4),
      n("~ 7 ~ 9")
        .scale("D:dorian")
        .s("triangle")
        .off("1/8", x => x.gain(0.4).lpf(1200))
        .delay(0.4)
        .delaytime("1/6")
        .gain(0.12)
        .slow(2)
    ).fast(1.2)`,
    gain: 0.5,
  },

  africa: {
    id: 'africa',
    name: 'Africa',
    // Afrobeat - polyrhythmic Euclidean, kalimba-style FM
    pattern: `stack(
      s("bd(5,8), hh(7,8), cp(3,8,2)").gain(0.4),
      n("0 4 7 9".add("<0 2 4 2>"))
        .scale("C:pentatonic")
        .s("triangle")
        .fm(3)
        .lpf(sine.range(800,2200).slow(6))
        .gain(0.3)
        .room(0.25)
        .jux(x => x.add(7)),
      n("<0 4 2 5>")
        .scale("C2:pentatonic")
        .s("sawtooth")
        .lpf(perlin.range(150,400))
        .gain(0.2)
        .slow(4),
      n("9 ~ 7 ~")
        .scale("C:pentatonic")
        .s("sine")
        .off("1/6", x => x.gain(0.5).add(4))
        .delay(0.35)
        .delaytime("1/8")
        .gain(0.15)
        .slow(2)
    ).fast(1.25)`,
    gain: 0.5,
  },

  asia: {
    id: 'asia',
    name: 'Asia',
    // Eastern mystery - sparse Euclidean, pentatonic with vibrato
    pattern: `stack(
      s("bd(3,8), hh(4,8,1), cp(2,8,4)").gain(0.35),
      n("0 4 7 9".add("<0 5 2 7>"))
        .scale("E:minPent")
        .s("triangle")
        .fm(1.5)
        .lpf(sine.range(500,1800).slow(10))
        .vib(4)
        .vibmod(0.3)
        .gain(0.28)
        .room(0.4)
        .jux(rev),
      n("<0 4 7 4>")
        .scale("E2:minPent")
        .s("triangle")
        .lpf(perlin.range(180,450))
        .gain(0.18)
        .slow(4),
      n("~ 12 ~ 9")
        .scale("E:minPent")
        .s("sine")
        .off("1/4", x => x.gain(0.4).add(5))
        .delay(0.5)
        .delaytime("1/4")
        .gain(0.12)
        .slow(3)
    ).fast(1.1)`,
    gain: 0.5,
  },

  middleEast: {
    id: 'middleEast',
    name: 'Middle East',
    // Exotic phrygian - complex Euclidean, quarter-tone feel
    pattern: `stack(
      s("bd(4,8,1), hh(6,8), cp(2,8,5)").gain(0.38),
      n("0 1 4 5".add("<0 4 1 5>"))
        .scale("E:phrygian")
        .s("sawtooth")
        .fm(2.5)
        .lpf(sine.range(400,1600).slow(7))
        .gain(0.28)
        .room(0.35)
        .jux(x => x.add(1)),
      n("<0 1 4 5>")
        .scale("E2:phrygian")
        .s("sawtooth")
        .lpf(perlin.range(150,400))
        .gain(0.2)
        .slow(4),
      n("8 ~ 5 ~")
        .scale("E:phrygian")
        .s("triangle")
        .off("1/8", x => x.gain(0.45).add(-1))
        .delay(0.45)
        .delaytime("3/16")
        .gain(0.14)
        .slow(2)
    ).fast(1.15)`,
    gain: 0.5,
  },

  northAmerica: {
    id: 'northAmerica',
    name: 'North America',
    // Rock energy - driving Euclidean, power chord feel
    pattern: `stack(
      s("bd(4,8), hh(8,8), sd(2,8,4)").gain(0.42).ply("<1 1 1 2>"),
      n("[0,4] [4,7] [7,9] [4,7]".add("<0 2 4 2>"))
        .scale("G:major")
        .s("sawtooth")
        .fm(1.5)
        .lpf(sine.range(700,2400).slow(6))
        .gain(0.26)
        .room(0.25)
        .jux(rev),
      n("<0 4 5 4>")
        .scale("G2:major")
        .s("sawtooth")
        .lpf(perlin.range(200,500))
        .gain(0.22)
        .slow(4),
      n("~ 11 ~ 9")
        .scale("G:major")
        .s("square")
        .off("1/8", x => x.gain(0.5).lpf(1500))
        .delay(0.35)
        .delaytime("1/8")
        .gain(0.12)
        .slow(2)
    ).fast(1.3)`,
    gain: 0.5,
  },

  southAmerica: {
    id: 'southAmerica',
    name: 'South America',
    // Latin groove - syncopated Euclidean, minor key passion
    pattern: `stack(
      s("bd(3,8), hh(7,8), cp(3,8,3)").gain(0.4),
      n("0 4 7 4".add("<0 2 4 5>"))
        .scale("A:minor")
        .s("sawtooth")
        .fm(2)
        .lpf(sine.range(600,1800).slow(8))
        .gain(0.28)
        .room(0.3)
        .jux(x => x.add(3)),
      n("<0 4 2 5>")
        .scale("A2:minor")
        .s("sawtooth")
        .lpf(perlin.range(180,450))
        .gain(0.2)
        .slow(4),
      n("9 ~ 7 ~")
        .scale("A:minor")
        .s("triangle")
        .off("1/6", x => x.gain(0.5).add(2))
        .delay(0.4)
        .delaytime("1/6")
        .gain(0.14)
        .slow(2)
    ).fast(1.25)`,
    gain: 0.5,
  },

  oceania: {
    id: 'oceania',
    name: 'Oceania',
    // Island vibes - relaxed Euclidean, bright major
    pattern: `stack(
      s("bd(3,8), hh(5,8,2), sd(2,8,4)").gain(0.38),
      n("0 4 7 4".add("<0 5 2 4>"))
        .scale("C:major")
        .s("triangle")
        .fm(1.5)
        .lpf(sine.range(700,2000).slow(10))
        .gain(0.28)
        .room(0.4)
        .jux(rev),
      n("<0 4 5 4>")
        .scale("C2:major")
        .s("sawtooth")
        .lpf(perlin.range(200,500))
        .gain(0.18)
        .slow(4),
      n("~ 9 ~ 7")
        .scale("C:major")
        .s("sine")
        .off("1/4", x => x.gain(0.4).add(5))
        .delay(0.5)
        .delaytime("1/4")
        .gain(0.12)
        .slow(3)
    ).fast(1.1)`,
    gain: 0.5,
  },

  default: {
    id: 'default',
    name: 'Default',
    // Adventure theme - balanced Euclidean, uplifting major
    pattern: `stack(
      s("bd(3,8), hh(5,8), cp(2,8,3)").gain(0.4),
      n("0 4 7 9".add("<0 2 4 2>"))
        .scale("C:major")
        .s("sawtooth")
        .fm(2)
        .lpf(sine.range(600,2000).slow(8))
        .gain(0.28)
        .room(0.3)
        .jux(rev),
      n("<0 4 5 3>")
        .scale("C2:major")
        .s("sawtooth")
        .lpf(perlin.range(200,500))
        .gain(0.2)
        .slow(4),
      n("~ 11 ~ 9")
        .scale("C:major")
        .s("triangle")
        .off("1/8", x => x.gain(0.45).lpf(1200))
        .delay(0.4)
        .delaytime("1/6")
        .gain(0.12)
        .slow(2)
    ).fast(1.2)`,
    gain: 0.5,
  },
}

/** Get a preset by ID, falling back to default */
export function getPreset(id: string): ContinentalPreset {
  return continentalPresets[id] || continentalPresets.default
}

/** Get all available preset IDs */
export function getPresetIds(): string[] {
  return Object.keys(continentalPresets)
}
