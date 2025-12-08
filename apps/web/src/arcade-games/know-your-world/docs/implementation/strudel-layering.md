# Strudel Layering Techniques for Know Your World

Notes on creating compelling layered music tracks with Strudel.

## CRITICAL: Musical Compatibility Rules

When layering hints on continental bases, you MUST follow these rules:

### 1. Same Key/Scale

- **Europe base uses D dorian** → All European hints use `scale("D4:dorian")`
- **Asia base uses E minor pentatonic** → All Asian hints use `scale("E4:minPent")`
- **Africa base uses C pentatonic** → All African hints use `scale("C4:pentatonic")`
- **Middle East base uses E phrygian** → All Middle East hints use `scale("E4:phrygian")`
- **South America base uses A minor** → All SA hints use `scale("A4:minor")`
- **North America base uses G major** → All NA/USA hints use `scale("G4:major")`
- **Oceania base uses C major** → All Oceania hints use `scale("C4:major")`

### 2. Sparse Patterns (Don't Compete!)

**Bad:** `n("0 4 7 4")` - 4 notes per cycle, competing with base
**Good:** `n("~ 4 ~ ~")` - 1 note per cycle, adds color only

### 3. Different Register

- Base melody is octave 2-3
- Hints should be octave 4-5 (sit above, don't clash)

### 4. Soft Timbres

- Base uses sawtooth (rich harmonics)
- Hints should use sine/soft triangle (pure, non-competing)

### 5. Slow Movement

- Base moves fast with `.fast(1.2)`
- Hints should use `.slow(8)` or slower - evolving atmosphere

### 6. Low Gain

- Base is 0.2-0.3 gain
- Hints should be 0.05-0.08 gain (subtle color)

## Core Layering Concept

Use `stack()` to layer multiple patterns that play simultaneously:

```javascript
stack(
  continentalBasePattern, // Background ambient
  hyperLocalHintPattern, // Regional character on top
);
```

## Synthesis Options

### Built-in Waveforms

- `sine` - Pure, soft tone (good for drones, pads)
- `triangle` - Brighter than sine, still soft (good for melodies)
- `sawtooth` - Rich harmonics (good for string-like tones, brass)
- `square` - Hollow, reedy (good for wind instruments)

### FM Synthesis

- `fm(index)` - Modulation index, defines brightness (higher = more harmonics)
- `fmh(ratio)` - Harmonicity ratio
  - Whole numbers: natural, harmonic sounds
  - Decimals: metallic, inharmonic sounds

### Expression

- `vib(hz)` - Vibrato frequency in Hz
- `vibmod(semitones)` - Vibrato depth

## Effects Chain (order matters)

Filter effects apply in sequence: `lpf → hpf → bpf → vowel → coarse → crush → distort → tremolo → compressor → pan → phaser → postgain`

### Filters

- `lpf(freq)` - Low-pass filter (cutoff frequency)
- `hpf(freq)` - High-pass filter
- `bpf(freq)` - Band-pass filter
- `vowel("a/e/i/o/u")` - Formant filter for vocal-like character

### Modulation

- `sine.range(min, max).slow(n)` - LFO for filter sweeps
- `perlin.range(min, max)` - Perlin noise for organic variation

### Spatial Effects

- `delay(send)` - Delay send (0-1)
- `room(send)` - Reverb send (0-1)
- `pan(position)` - Stereo position (0=left, 1=right)

### Rhythmic Techniques

- `off(time, fn)` - Create rhythmic echoes/doubling
  - Example: `.off("1/8", x => x.gain(0.3))` - echo at 1/8 note
- `jux(fn)` - Apply function to right channel only (stereo width)

## Scale/Mode Selection

Use scale function for regional character:

```javascript
n("0 2 4 5").scale("C:dorian"); // Jazz/modal
n("0 1 4 5").scale("E:phrygian"); // Spanish/Middle Eastern
n("0 2 4 7").scale("D:minPent"); // Asian
n("0 2 4 5").scale("G:major"); // Bright/Western
n("0 3 4 7").scale("C:blues"); // Blues/Jazz
```

### Key Scales for Regional Character

| Region         | Scales/Modes          | Character           |
| -------------- | --------------------- | ------------------- |
| Western Europe | Major, Mixolydian     | Bright, optimistic  |
| Eastern Europe | Minor, Dorian         | Melancholic, modal  |
| Balkans        | Phrygian, odd meters  | Exotic, dramatic    |
| Nordic         | Dorian, Minor         | Haunting, modal     |
| Celtic         | Dorian, Mixolydian    | Dance-like, modal   |
| Mediterranean  | Phrygian              | Exotic, flamenco    |
| Slavic         | Minor, Harmonic minor | Dramatic, emotional |

## Pattern Design Principles

### For Hyper-Local Hints

1. **Subtlety**: Keep gain low (0.12-0.18) to layer under continental
2. **Movement**: Use `sine.range()` for evolving filter sweeps
3. **Echoes**: Use `off()` for rhythmic interest without busy patterns
4. **Delay**: Add spatial depth with `delay(0.3-0.5)`
5. **Timing**: Use `delayStart: 1500` so hints fade in after player settles

### Pattern Template

```javascript
{
  // Example: French accordion
  pattern: `n("0 4 7 4".add("<0 2>"))  // Melodic sequence with variation
    .scale("C:mixolydian")             // Mode for character
    .s("sawtooth")                     // Tone quality
    .fm(1.5)                           // Slight brightness
    .vib(5)                            // Expression
    .vibmod(0.4)                       // Vibrato depth
    .lpf(sine.range(600,1400).slow(4)) // Moving filter
    .off("1/8", x => x.gain(0.3))      // Rhythmic echo
    .delay(0.3)                        // Spatial depth
    .gain(0.18)`,                      // Final level
  gain: 0.18,
  fadeIn: 1000,
  delayStart: 1500,
}
```

## Chords in Mini-Notation

```javascript
note("[c3,e3,g3]"); // C major chord
note("[g3,b3,e4]"); // G major, first inversion
note("<[c3,e3,g3] [f3,a3,c4]>"); // Alternating chords
```

## Rhythmic Patterns

```javascript
"0 4 7 4"; // Straight quarter notes
"0 ~ 4 5"; // Rest on beat 2
"[0,4,7] ~ [2,5] ~"; // Chords with rests (oompah)
"0 ~ [2,5] 7"; // Syncopated
```

## Speed Control

```javascript
.fast(1.15)  // Speed up 15%
.slow(1.5)   // Slow down 50%
.slow(32)    // Very slow (for drones)
```

## Current European Hints (7 countries)

1. **fr** (France) - Accordion, mixolydian, sawtooth, vibrato
2. **es** (Spain) - Flamenco, phrygian, triangle, FM
3. **it** (Italy) - Tarantella, major, fast, bright
4. **ie** (Ireland) - Celtic jig, dorian, fast
5. **de** (Germany) - Oompah, major, brass-like
6. **gr** (Greece) - Sirtaki, phrygian, modal
7. **ru** (Russia) - Balalaika, minor, fast, bright

## Target European Countries to Add

Major countries needing hints:

- gb (UK) - British folk/rock
- pt (Portugal) - Fado, melancholic
- nl (Netherlands) - Organ/folk
- be (Belgium) - Chanson
- at (Austria) - Waltz
- ch (Switzerland) - Alpine
- pl (Poland) - Mazurka
- se (Sweden) - Swedish folk
- no (Norway) - Nordic folk
- dk (Denmark) - Nordic
- fi (Finland) - Finnish folk
- hu (Hungary) - Csardas
- cz (Czech) - Polka
- sk (Slovakia) - Folk
- ro (Romania) - Hora
- bg (Bulgaria) - Odd meters
- rs (Serbia) - Balkan
- hr (Croatia) - Tamburica
- si (Slovenia) - Alpine
- ba (Bosnia) - Sevdalinka
- al (Albania) - Balkan
- mk (North Macedonia) - Oro
- ua (Ukraine) - Hopak
- by (Belarus) - Slavic folk
- lt/lv/ee (Baltic) - Baltic folk
- is (Iceland) - Nordic/epic
- cy (Cyprus) - Greek/Turkish
- mt (Malta) - Mediterranean

## Musical Character by Sub-Region

### Western Europe

- **UK/Ireland**: Celtic modes, jig rhythms, bright
- **France**: Accordion, musette, chanson
- **Benelux**: Organ, carillon, cheerful

### Central Europe

- **Germany/Austria**: Oompah, waltz, brass
- **Switzerland**: Alpine, yodel character
- **Poland**: Mazurka, dramatic minor

### Nordic

- **Sweden/Norway/Denmark**: Haunting, modal, sparse
- **Finland**: Kalevala modes, melancholic
- **Iceland**: Epic, atmospheric

### Eastern Europe

- **Ukraine/Belarus/Russia**: Dramatic minor, balalaika
- **Baltic states**: Kannel, choir-like

### Southern Europe

- **Portugal**: Fado, saudade, minor
- **Spain**: Flamenco, phrygian
- **Italy**: Tarantella, mandolin

### Balkans

- **Greece**: Sirtaki, phrygian
- **Bulgaria**: Odd meters (7/8, 11/8)
- **Serbia/Croatia/Bosnia**: Turbo folk, emotional
- **Romania**: Hora, violin-like

### Mediterranean Islands

- **Cyprus**: Greek/Turkish blend
- **Malta**: Unique Mediterranean
