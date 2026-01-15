/**
 * Hyper-Local Music Hints
 *
 * Layer 3: Distinctive musical hints for specific regions.
 * These layer on TOP of the continental preset to add regional character.
 *
 * DESIGN PRINCIPLES:
 * 1. SAME KEY as continental base (Europe = D dorian, etc.)
 * 2. RHYTHMIC CHARACTER - actual musical patterns, not drones
 * 3. HIGH REGISTER - octave 4-5 to sit above base melody
 * 4. DISTINCTIVE ARTICULATION - plucky, tremolo, legato as appropriate
 * 5. MODERATE GAIN - audible but not overpowering
 *
 * @see https://strudel.cc/learn/tonal/
 */

export interface RegionMusicHint {
  /** Strudel pattern fragment to layer on top of continental */
  pattern: string;
  /** How loud relative to base (0.0 - 1.0, typically 0.1-0.2) */
  gain: number;
  /** Crossfade time when this region becomes active (ms) */
  fadeIn: number;
  /** Only trigger after N seconds of searching */
  delayStart: number;
}

/**
 * World map region hints.
 * Country codes (ISO 3166-1 alpha-2, lowercase).
 *
 * EUROPE countries use D dorian (same as Europe continental base)
 * Available notes in D dorian: D E F G A B C
 * Scale degrees: 0=D, 1=E, 2=F, 3=G, 4=A, 5=B, 6=C
 */
export const worldHints: Record<string, RegionMusicHint> = {
  // ============================================
  // EUROPE - All in D dorian to match continental
  // ============================================

  fr: {
    // France - musette accordion: fast arpeggio runs, characteristic vibrato
    pattern: `n("[2 4 5 4]*2").scale("D5:dorian").s("sawtooth").lpf(1800).decay(0.1).sustain(0).gain(0.12).room(0.25)`,
    gain: 0.12,
    fadeIn: 1000,
    delayStart: 2000,
  },
  es: {
    // Spain - flamenco rasgueo: rapid strummed feel, dramatic
    pattern: `n("[1 4 5 4 1 0]*2").scale("D4:dorian").s("triangle").lpf(1600).decay(0.08).sustain(0).gain(0.12).room(0.2)`,
    gain: 0.12,
    fadeIn: 1000,
    delayStart: 2000,
  },
  it: {
    // Italy - mandolin tremolo: fast repeated notes
    pattern: `n("[4 4 4 4 5 5 5 5]*2").scale("D5:dorian").s("triangle").lpf(2000).decay(0.05).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ie: {
    // Ireland - celtic jig: fast ornamental runs
    pattern: `n("[3 4 3 0 2 3 4 3]*2").scale("D5:dorian").s("triangle").lpf(1800).decay(0.08).sustain(0).gain(0.1).delay(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  de: {
    // Germany - oompah: strong accented brass stabs
    pattern: `n("[0,4] ~ [2,5] ~").scale("D4:dorian").s("sawtooth").lpf(1200).decay(0.15).sustain(0.1).gain(0.12).room(0.2)`,
    gain: 0.12,
    fadeIn: 1000,
    delayStart: 2000,
  },
  gr: {
    // Greece - bouzouki: fast picked arpeggios
    pattern: `n("[1 4 6 4 1 4 6 4]*2").scale("D4:dorian").s("triangle").lpf(1600).decay(0.06).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ru: {
    // Russia - balalaika: rapid tremolo picking
    pattern: `n("[2 2 4 4 2 2 0 0]*2").scale("D5:dorian").s("triangle").lpf(1800).decay(0.05).sustain(0).gain(0.1).room(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  gb: {
    // UK - folk fiddle: quick ornamental phrases
    pattern: `n("[3 4 5 4 3 2 3 4]*2").scale("D5:dorian").s("triangle").lpf(1700).decay(0.08).sustain(0).gain(0.1).delay(0.15)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  pt: {
    // Portugal - fado guitar: melancholic arpeggios with expression
    pattern: `n("[2 0 4 2 0 4]*2").scale("D4:dorian").s("triangle").vib(4).vibmod(0.3).lpf(1400).decay(0.15).sustain(0.1).gain(0.11).room(0.35)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  nl: {
    // Netherlands - carillon bells: bright chiming patterns
    pattern: `n("[7 4 0 4 7 4]*2").scale("D5:dorian").s("sine").lpf(2500).decay(0.2).sustain(0.1).gain(0.08).room(0.5).delay(0.3)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  be: {
    // Belgium - chanson accordion: warm runs
    pattern: `n("[3 4 5 3 2 0]*2").scale("D5:dorian").s("sawtooth").lpf(1600).decay(0.1).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  at: {
    // Austria - waltz: lilting 3/4 feel
    pattern: `n("[4 ~ ~ 2 ~ ~ 4 ~ ~]*2").scale("D5:dorian").s("triangle").lpf(1500).decay(0.2).sustain(0.1).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ch: {
    // Switzerland - alphorn/yodel: wide leaping intervals
    pattern: `n("[0 ~ 4 ~ 7 ~ 4 ~]*2").scale("D4:dorian").s("sine").lpf(1400).decay(0.25).sustain(0.15).gain(0.09).room(0.5).delay(0.35)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  pl: {
    // Poland - mazurka: accented 2nd/3rd beat character
    pattern: `n("[~ 2 4 ~ 5 4 ~ 2]*2").scale("D4:dorian").s("triangle").lpf(1500).decay(0.1).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  se: {
    // Sweden - polska: triplet-based folk rhythm
    pattern: `n("[4 5 4 2 4 5]*2").scale("D5:dorian").s("triangle").lpf(1600).decay(0.1).sustain(0).gain(0.09).room(0.35)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  no: {
    // Norway - Hardanger fiddle: droning with ornaments
    pattern: `n("[[0,4] [0,4] [2,5] [0,4]]*2").scale("D4:dorian").s("triangle").lpf(1400).decay(0.15).sustain(0.1).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  dk: {
    // Denmark - Nordic folk: bright simple melodies
    pattern: `n("[4 5 4 2 0 2 4 5]*2").scale("D5:dorian").s("triangle").lpf(1700).decay(0.08).sustain(0).gain(0.09).room(0.3)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  fi: {
    // Finland - kantele: plucked harp-like
    pattern: `n("[0 2 4 0 3 4]*2").scale("D5:dorian").s("sine").lpf(1800).decay(0.2).sustain(0.05).gain(0.08).room(0.45)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  hu: {
    // Hungary - csardas: fast virtuosic runs with ornamentation
    pattern: `n("[1 2 4 5 4 2 1 0]*2").scale("D4:dorian").s("triangle").vib(5).vibmod(0.3).lpf(1600).decay(0.07).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  cz: {
    // Czech - polka: bouncy bright rhythm
    pattern: `n("[4 5 4 ~ 2 3 2 ~]*2").scale("D5:dorian").s("triangle").lpf(1800).decay(0.08).sustain(0).gain(0.1).room(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  sk: {
    // Slovakia - fujara: breathy overtone flute
    pattern: `n("[0 4 7 4 0 4]*2").scale("D4:dorian").s("sine").lpf(1200).decay(0.25).sustain(0.15).gain(0.09).room(0.45)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ro: {
    // Romania - violin doina: expressive with ornaments
    pattern: `n("[1 2 1 4 5 4 2 1]*2").scale("D4:dorian").s("triangle").vib(5).vibmod(0.35).lpf(1500).decay(0.1).sustain(0.05).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  bg: {
    // Bulgaria - gadulka: fast asymmetric rhythm (7/8 feel)
    pattern: `n("[1 4 5 1 4 5 4]*2").scale("D4:dorian").s("triangle").lpf(1500).decay(0.07).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  rs: {
    // Serbia - Balkan brass: punchy staccato
    pattern: `n("[[0,4] ~ [2,5] ~ [4,7] ~ [2,5] ~]*2").scale("D4:dorian").s("sawtooth").lpf(1400).decay(0.1).sustain(0).gain(0.11).room(0.2)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  hr: {
    // Croatia - tamburica: bright strummed strings
    pattern: `n("[4 5 4 2 4 5 4 0]*2").scale("D5:dorian").s("triangle").lpf(1700).decay(0.08).sustain(0).gain(0.1).delay(0.15)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  si: {
    // Slovenia - alpine accordion: polka-ish runs
    pattern: `n("[4 5 7 5 4 2 0 2]*2").scale("D5:dorian").s("sawtooth").lpf(1600).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ba: {
    // Bosnia - sevdalinka: emotional melodic phrases
    pattern: `n("[2 1 0 1 2 4 2 0]*2").scale("D4:dorian").s("triangle").vib(4).vibmod(0.4).lpf(1400).decay(0.15).sustain(0.1).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  al: {
    // Albania - iso-polyphony: parallel motion drones
    pattern: `n("[[0,3] [0,3] [2,5] [0,3]]*2").scale("D4:dorian").s("sine").lpf(1200).decay(0.2).sustain(0.15).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mk: {
    // North Macedonia - oro: dance rhythm with drive
    pattern: `n("[3 4 5 3 4 5 4 3]*2").scale("D4:dorian").s("triangle").lpf(1500).decay(0.08).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  me: {
    // Montenegro - gusle: dramatic melodic lines
    pattern: `n("[2 4 5 4 2 0 2 4]*2").scale("D4:dorian").s("triangle").vib(3).vibmod(0.3).lpf(1400).decay(0.12).sustain(0.05).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  xk: {
    // Kosovo - Albanian influence: parallel harmonies
    pattern: `n("[[0,3] [2,5] [0,3] [2,5]]*2").scale("D4:dorian").s("sine").lpf(1300).decay(0.15).sustain(0.1).gain(0.09).room(0.35)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ua: {
    // Ukraine - bandura: rapid plucked arpeggios
    pattern: `n("[4 2 0 2 4 5 4 2]*2").scale("D4:dorian").s("triangle").lpf(1700).decay(0.07).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  by: {
    // Belarus - duda bagpipe: droning with melody
    pattern: `n("[[0,4] 2 4 [0,4] 2 5]*2").scale("D4:dorian").s("sawtooth").lpf(1300).decay(0.12).sustain(0.08).gain(0.09).room(0.3)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  lt: {
    // Lithuania - sutartines: canon-like parallel patterns
    pattern: `n("[0 2 4 2 0 2 4 5]*2").scale("D4:dorian").s("sine").lpf(1400).decay(0.15).sustain(0.05).gain(0.08).room(0.4)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  lv: {
    // Latvia - kokle: plucked zither-like
    pattern: `n("[3 4 5 3 0 2 3 4]*2").scale("D5:dorian").s("sine").lpf(1600).decay(0.18).sustain(0.05).gain(0.08).room(0.4)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ee: {
    // Estonia - kannel: harp-like plucked
    pattern: `n("[0 3 4 3 0 2 4 3]*2").scale("D5:dorian").s("sine").lpf(1700).decay(0.2).sustain(0.05).gain(0.08).room(0.45)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  is: {
    // Iceland - langspil: drone-based with overtones
    pattern: `n("[[0,4,7] ~ [0,4,7] ~ [2,5,9] ~]*2").scale("D4:dorian").s("sine").lpf(1200).decay(0.3).sustain(0.2).gain(0.07).room(0.55).delay(0.4)`,
    gain: 0.07,
    fadeIn: 1500,
    delayStart: 2500,
  },
  cy: {
    // Cyprus - bouzouki: Greek-influenced picking
    pattern: `n("[1 4 5 4 1 4 6 4]*2").scale("D4:dorian").s("triangle").lpf(1600).decay(0.07).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mt: {
    // Malta - ghana folk: Mediterranean guitar
    pattern: `n("[3 4 5 4 3 2 0 2]*2").scale("D4:dorian").s("triangle").lpf(1500).decay(0.1).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  md: {
    // Moldova - Romanian influence: expressive runs
    pattern: `n("[1 2 4 5 4 2 1 0]*2").scale("D4:dorian").s("triangle").vib(4).vibmod(0.3).lpf(1500).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  lu: {
    // Luxembourg - central European blend
    pattern: `n("[3 4 5 4 2 0 2 4]*2").scale("D5:dorian").s("triangle").lpf(1600).decay(0.1).sustain(0).gain(0.09).room(0.25)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  li: {
    // Liechtenstein - alpine folk
    pattern: `n("[0 4 7 4 0 4 5 4]*2").scale("D5:dorian").s("sine").lpf(1500).decay(0.15).sustain(0.05).gain(0.08).room(0.4)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ad: {
    // Andorra - Catalan sardana: circle dance rhythm
    pattern: `n("[4 5 4 2 4 5 7 5]*2").scale("D5:dorian").s("triangle").lpf(1600).decay(0.08).sustain(0).gain(0.09).room(0.25)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mc: {
    // Monaco - elegant French riviera
    pattern: `n("[4 5 7 5 4 2 4 5]*2").scale("D5:dorian").s("sine").lpf(1800).decay(0.12).sustain(0.05).gain(0.08).room(0.35)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  sm: {
    // San Marino - Italian influence: bright
    pattern: `n("[4 5 4 2 4 5 7 5]*2").scale("D5:dorian").s("triangle").lpf(1700).decay(0.08).sustain(0).gain(0.09).room(0.3)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  va: {
    // Vatican - sacred chant: slow parallel motion
    pattern: `n("[[0,4] [2,5] [0,4] [3,6]]*2").scale("D4:dorian").s("sine").lpf(1000).decay(0.4).sustain(0.3).gain(0.07).room(0.6)`,
    gain: 0.07,
    fadeIn: 1500,
    delayStart: 2500,
  },

  // ============================================
  // ASIA - All in E minor pentatonic to match continental
  // Available: E F# A B D (0 1 2 3 4)
  // ============================================

  jp: {
    // Japan - koto: delicate rapid arpeggios with characteristic pluck
    pattern: `n("[2 3 4 3 2 0]*2").scale("E5:minPent").s("sine").lpf(1800).decay(0.1).sustain(0).gain(0.1).room(0.35).delay(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  cn: {
    // China - erhu: rapid ornamental runs with vibrato
    pattern: `n("[1 2 3 2 1 0 1 2]*2").scale("E4:minPent").s("triangle").vib(5).vibmod(0.4).lpf(1400).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  in: {
    // India - sitar: fast meend-like runs with heavy ornaments
    pattern: `n("[0 1 2 3 2 1 0 1]*2").scale("E4:minPent").s("triangle").vib(6).vibmod(0.5).lpf(1200).decay(0.12).sustain(0.05).gain(0.11).room(0.35)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  th: {
    // Thailand - ranat: bright xylophone-like rapid patterns
    pattern: `n("[3 4 3 2 3 4 3 2]*2").scale("E5:minPent").s("sine").lpf(2000).decay(0.06).sustain(0).gain(0.09).room(0.4).delay(0.25)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  kr: {
    // South Korea - gayageum: plucked arpeggios with slight vibrato
    pattern: `n("[2 3 4 2 0 2 3 4]*2").scale("E4:minPent").s("triangle").vib(3).vibmod(0.25).lpf(1500).decay(0.1).sustain(0).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  vn: {
    // Vietnam - dan bau: sliding ornamental phrases
    pattern: `n("[0 1 2 1 0 2 3 2]*2").scale("E4:minPent").s("triangle").vib(6).vibmod(0.5).lpf(1300).decay(0.1).sustain(0.05).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  id: {
    // Indonesia - gamelan: interlocking metallic patterns
    pattern: `n("[3 ~ 4 3 ~ 4 3 ~]*2").scale("E5:minPent").s("sine").lpf(2200).decay(0.15).sustain(0.05).gain(0.08).room(0.45).delay(0.35)`,
    gain: 0.08,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ph: {
    // Philippines - kulintang: gong ensemble rhythms
    pattern: `n("[2 3 2 ~ 3 4 3 ~]*2").scale("E5:minPent").s("sine").lpf(1800).decay(0.12).sustain(0.05).gain(0.09).room(0.4).delay(0.3)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  my: {
    // Malaysia - gamelan/angklung: bright cascading
    pattern: `n("[4 3 2 3 4 3 2 1]*2").scale("E5:minPent").s("sine").lpf(1900).decay(0.08).sustain(0).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mn: {
    // Mongolia - morin khuur: galloping horse rhythm with overtones
    pattern: `n("[[0,2] [0,2] 1 [0,2] [0,2] 1]*2").scale("E3:minPent").s("sawtooth").lpf(800).decay(0.15).sustain(0.1).gain(0.09).room(0.45)`,
    gain: 0.09,
    fadeIn: 1500,
    delayStart: 2500,
  },
  np: {
    // Nepal - sarangi: melancholic rapid ornaments
    pattern: `n("[1 2 3 2 1 0 1 2]*2").scale("E4:minPent").s("triangle").vib(4).vibmod(0.35).lpf(1200).decay(0.1).sustain(0.05).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1500,
    delayStart: 2500,
  },

  // ============================================
  // MIDDLE EAST - All in E phrygian to match continental
  // Available: E F G A B C D (0 1 2 3 4 5 6)
  // ============================================

  tr: {
    // Turkey - saz/baglama: fast tremolo picking with characteristic phrygian
    pattern: `n("[1 3 4 3 1 0 1 3]*2").scale("E4:phrygian").s("triangle").vib(4).vibmod(0.35).lpf(1400).decay(0.07).sustain(0).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ir: {
    // Iran - santur: rapid hammered dulcimer runs
    pattern: `n("[0 1 3 4 3 1 0 1]*2").scale("E4:phrygian").s("triangle").lpf(1600).decay(0.06).sustain(0).gain(0.1).room(0.35).delay(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  il: {
    // Israel - hora: driving dance rhythm
    pattern: `n("[3 4 3 1 3 4 5 4]*2").scale("E4:phrygian").s("triangle").lpf(1500).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  eg: {
    // Egypt - oud: rapid ornamental phrases with maqam character
    pattern: `n("[1 0 1 3 4 3 1 0]*2").scale("E4:phrygian").s("triangle").vib(4).vibmod(0.4).lpf(1300).decay(0.1).sustain(0.05).gain(0.11).room(0.35)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  sa: {
    // Saudi Arabia - oud tradition: flowing melodic lines
    pattern: `n("[0 1 3 1 0 3 4 3]*2").scale("E4:phrygian").s("triangle").vib(4).vibmod(0.4).lpf(1200).decay(0.1).sustain(0.05).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ae: {
    // UAE - khaleeji: ornamental runs
    pattern: `n("[1 3 4 3 1 3 4 5]*2").scale("E4:phrygian").s("triangle").vib(3).vibmod(0.3).lpf(1400).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  lb: {
    // Lebanon - dabke: energetic dance rhythm
    pattern: `n("[3 4 5 4 3 1 3 4]*2").scale("E4:phrygian").s("triangle").lpf(1500).decay(0.08).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  jo: {
    // Jordan - Bedouin rababa: expressive melodic phrases
    pattern: `n("[0 1 3 1 0 1 3 4]*2").scale("E4:phrygian").s("triangle").vib(5).vibmod(0.45).lpf(1100).decay(0.12).sustain(0.05).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1500,
    delayStart: 2500,
  },
  iq: {
    // Iraq - maqam: virtuosic ornamental runs
    pattern: `n("[0 1 3 4 5 4 3 1]*2").scale("E4:phrygian").s("triangle").vib(4).vibmod(0.4).lpf(1300).decay(0.08).sustain(0).gain(0.11).room(0.35)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },

  // ============================================
  // AFRICA - All in C pentatonic to match continental
  // Available: C D E G A (0 1 2 3 4)
  // ============================================

  ng: {
    // Nigeria - highlife: bright rhythmic guitar runs
    pattern: `n("[2 3 4 3 2 0 2 3]*2").scale("C4:pentatonic").s("triangle").lpf(1600).decay(0.08).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  za: {
    // South Africa - township jive: energetic keyboard riffs
    pattern: `n("[3 4 3 2 3 4 3 0]*2").scale("C5:pentatonic").s("triangle").lpf(1700).decay(0.06).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  et: {
    // Ethiopia - krar: distinctive scale patterns
    pattern: `n("[1 2 3 1 0 1 2 3]*2").scale("C4:pentatonic").s("triangle").lpf(1400).decay(0.1).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ke: {
    // Kenya - benga: bouncy guitar picking
    pattern: `n("[3 2 3 4 3 2 0 2]*2").scale("C4:pentatonic").s("triangle").lpf(1500).decay(0.07).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  gh: {
    // Ghana - highlife: classic guitar patterns
    pattern: `n("[2 3 4 2 0 2 3 4]*2").scale("C4:pentatonic").s("triangle").lpf(1550).decay(0.08).sustain(0).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  sn: {
    // Senegal - mbalax: rhythmic sabar-like patterns
    pattern: `n("[2 ~ 3 2 ~ 3 4 ~]*2").scale("C4:pentatonic").s("triangle").lpf(1500).decay(0.06).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ml: {
    // Mali - desert blues: kora arpeggios
    pattern: `n("[0 2 3 4 3 2 0 2]*2").scale("C4:pentatonic").s("sine").lpf(1300).decay(0.12).sustain(0.05).gain(0.1).room(0.4)`,
    gain: 0.1,
    fadeIn: 1500,
    delayStart: 2500,
  },
  tz: {
    // Tanzania - taarab: ornamental melodic runs
    pattern: `n("[2 3 4 3 2 3 4 2]*2").scale("C4:pentatonic").s("triangle").lpf(1400).decay(0.1).sustain(0.05).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },

  // ============================================
  // SOUTH AMERICA - All in A minor to match continental
  // Available: A B C D E F G (0 1 2 3 4 5 6)
  // ============================================

  br: {
    // Brazil - bossa nova: syncopated guitar with jazz voicings
    pattern: `n("[2 ~ 4 2 ~ 4 5 ~]*2").scale("A4:minor").s("triangle").lpf(1400).decay(0.12).sustain(0.05).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ar: {
    // Argentina - tango: dramatic bandoneon-style phrases
    pattern: `n("[5 4 2 0 2 4 5 6]*2").scale("A4:minor").s("sawtooth").vib(4).vibmod(0.35).lpf(1200).decay(0.1).sustain(0.05).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mx: {
    // Mexico - mariachi: bright trumpet-like runs
    pattern: `n("[4 5 6 5 4 2 4 5]*2").scale("A4:minor").s("sawtooth").lpf(1600).decay(0.08).sustain(0).gain(0.11).room(0.25)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  co: {
    // Colombia - cumbia: rhythmic accordion patterns
    pattern: `n("[2 4 5 4 2 4 5 4]*2").scale("A4:minor").s("sawtooth").lpf(1400).decay(0.08).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  pe: {
    // Peru - Andean: charango/quena melodic runs
    pattern: `n("[4 5 4 2 0 2 4 5]*2").scale("A5:minor").s("sine").lpf(1500).decay(0.1).sustain(0).gain(0.1).room(0.4).delay(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  cl: {
    // Chile - cueca: lively dance rhythm
    pattern: `n("[2 4 5 2 4 5 4 2]*2").scale("A4:minor").s("triangle").lpf(1400).decay(0.08).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ve: {
    // Venezuela - joropo: energetic harp arpeggios
    pattern: `n("[4 2 0 2 4 5 4 2]*2").scale("A4:minor").s("triangle").lpf(1500).decay(0.07).sustain(0).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  cu: {
    // Cuba - son montuno: syncopated piano tumbaos
    pattern: `n("[[0,4] ~ [2,5] ~ [0,4] ~ [2,5] ~]*2").scale("A4:minor").s("triangle").lpf(1400).decay(0.1).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  jm: {
    // Jamaica - reggae: skanking off-beat chops
    pattern: `n("[~ [2,4] ~ [2,4] ~ [0,4] ~ [2,4]]*2").scale("A4:minor").s("triangle").lpf(1200).decay(0.08).sustain(0).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  pr: {
    // Puerto Rico - salsa: bright piano montunos
    pattern: `n("[2 4 5 4 2 4 5 6]*2").scale("A4:minor").s("triangle").lpf(1500).decay(0.07).sustain(0).gain(0.1).room(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },

  // ============================================
  // NORTH AMERICA - All in G major to match continental
  // Available: G A B C D E F# (0 1 2 3 4 5 6)
  // ============================================

  // Note: Canada and USA use usa map, these are for world map

  // ============================================
  // OCEANIA - All in C major to match continental
  // Available: C D E F G A B (0 1 2 3 4 5 6)
  // ============================================

  au: {
    // Australia - didgeridoo: rhythmic drone with overtone character
    pattern: `n("[[0,4] [0,4] [0,2] [0,4] [0,4] [0,2]]*2").scale("C3:major").s("sawtooth").lpf(600).decay(0.2).sustain(0.15).gain(0.09).room(0.45)`,
    gain: 0.09,
    fadeIn: 1500,
    delayStart: 2500,
  },
  nz: {
    // New Zealand - Maori: poi/haka rhythmic chant patterns
    pattern: `n("[0 2 4 2 0 2 4 5]*2").scale("C4:major").s("triangle").lpf(1100).decay(0.15).sustain(0.1).gain(0.1).room(0.4)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  fj: {
    // Fiji - lali drums: bright rhythmic island patterns
    pattern: `n("[4 5 4 2 4 5 6 5]*2").scale("C5:major").s("triangle").lpf(1500).decay(0.08).sustain(0).gain(0.1).room(0.35).delay(0.2)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  pg: {
    // Papua New Guinea - kundu drum: driving tribal rhythms
    pattern: `n("[2 4 2 0 2 4 5 4]*2").scale("C4:major").s("triangle").lpf(1400).decay(0.07).sustain(0).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
};

/**
 * USA state hints.
 * State codes (USPS abbreviation, lowercase).
 *
 * USA states use G major (matches North America continental)
 * Available: G A B C D E F# (0 1 2 3 4 5 6)
 */
export const usaHints: Record<string, RegionMusicHint> = {
  la: {
    // Louisiana - New Orleans jazz: swinging blues licks
    pattern: `n("[2 4 5 4 2 0 2 4]*2").scale("G4:major").s("triangle").vib(3).vibmod(0.25).lpf(1300).decay(0.1).sustain(0.05).gain(0.11).room(0.35)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  tn: {
    // Tennessee - country: twangy pedal steel bends
    pattern: `n("[2 4 5 4 2 4 5 6]*2").scale("G4:major").s("triangle").vib(4).vibmod(0.3).lpf(1400).decay(0.1).sustain(0.05).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ny: {
    // New York - bebop jazz: fast chromatic runs
    pattern: `n("[4 5 6 5 4 2 4 5]*2").scale("G4:major").s("triangle").lpf(1500).decay(0.07).sustain(0).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ca: {
    // California - surf rock: bright reverbed arpeggios
    pattern: `n("[4 2 0 2 4 5 4 2]*2").scale("G5:major").s("triangle").lpf(1700).decay(0.08).sustain(0).gain(0.1).room(0.4).delay(0.25)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  tx: {
    // Texas - country/western swing: fiddle-like runs
    pattern: `n("[4 5 4 2 0 2 4 5]*2").scale("G4:major").s("triangle").vib(3).vibmod(0.25).lpf(1400).decay(0.08).sustain(0).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  hi: {
    // Hawaii - slack-key: open tuning arpeggios (uses C major to match Oceania)
    pattern: `n("[4 2 0 2 4 5 4 2]*2").scale("C4:major").s("sine").lpf(1400).decay(0.15).sustain(0.05).gain(0.1).room(0.45).delay(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ak: {
    // Alaska - northern atmospheric: sparse ethereal
    pattern: `n("[[0,4] ~ [2,5] ~ [0,4] ~ [4,6] ~]*2").scale("G4:major").s("sine").lpf(1000).decay(0.3).sustain(0.2).gain(0.08).room(0.55).delay(0.35)`,
    gain: 0.08,
    fadeIn: 1500,
    delayStart: 2500,
  },
  nm: {
    // New Mexico - southwestern: desert guitar with spanish influence
    pattern: `n("[2 4 5 4 2 0 2 4]*2").scale("G4:major").s("triangle").vib(3).vibmod(0.2).lpf(1200).decay(0.12).sustain(0.05).gain(0.1).room(0.4)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ma: {
    // Massachusetts - New England folk: sea shanty feel
    pattern: `n("[0 2 4 5 4 2 0 2]*2").scale("G4:major").s("triangle").lpf(1300).decay(0.1).sustain(0.05).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  il: {
    // Illinois - Chicago blues: gritty bent notes
    pattern: `n("[2 4 5 4 2 4 2 0]*2").scale("G4:major").s("sawtooth").vib(4).vibmod(0.35).lpf(1100).decay(0.1).sustain(0.05).gain(0.11).room(0.3)`,
    gain: 0.11,
    fadeIn: 1000,
    delayStart: 2000,
  },
  ga: {
    // Georgia - southern soul/R&B: smooth melodic runs
    pattern: `n("[2 4 5 4 2 0 2 4]*2").scale("G4:major").s("triangle").lpf(1200).decay(0.12).sustain(0.08).gain(0.1).room(0.35)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  mi: {
    // Michigan - Motown: smooth bass-like runs
    pattern: `n("[0 2 4 2 0 4 5 4]*2").scale("G3:major").s("triangle").lpf(1000).decay(0.1).sustain(0.05).gain(0.1).room(0.3)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  wa: {
    // Washington - grunge: distorted power chord feel
    pattern: `n("[[0,4] ~ [0,4] ~ [2,5] ~ [0,4] ~]*2").scale("G3:major").s("sawtooth").lpf(900).decay(0.15).sustain(0.1).gain(0.09).room(0.4)`,
    gain: 0.09,
    fadeIn: 1000,
    delayStart: 2000,
  },
  co: {
    // Colorado - mountain bluegrass: banjo-like rolls
    pattern: `n("[4 2 0 2 4 5 4 2]*2").scale("G5:major").s("triangle").lpf(1600).decay(0.06).sustain(0).gain(0.1).room(0.35).delay(0.15)`,
    gain: 0.1,
    fadeIn: 1000,
    delayStart: 2000,
  },
  az: {
    // Arizona - desert: sparse southwestern
    pattern: `n("[2 ~ 4 2 ~ 4 5 ~]*2").scale("G4:major").s("triangle").lpf(1200).decay(0.15).sustain(0.05).gain(0.09).room(0.45)`,
    gain: 0.09,
    fadeIn: 1500,
    delayStart: 2500,
  },
};

/**
 * Get the hyper-local hint for a region, if one exists.
 */
export function getHintForRegion(
  regionId: string | null | undefined,
  mapType: "world" | "usa",
): RegionMusicHint | null {
  if (!regionId) return null;

  const normalizedId = regionId.toLowerCase();

  if (mapType === "usa") {
    return usaHints[normalizedId] || null;
  }

  return worldHints[normalizedId] || null;
}

/**
 * Check if a region has a hyper-local hint.
 */
export function hasHintForRegion(
  regionId: string | null | undefined,
  mapType: "world" | "usa",
): boolean {
  return getHintForRegion(regionId, mapType) !== null;
}
