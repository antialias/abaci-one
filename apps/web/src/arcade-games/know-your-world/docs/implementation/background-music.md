# Know Your World - Background Music System Plan

## Vision

Subtle, ambient background music that enhances the geography learning experience without being distracting. The music should:
- Feel like a gentle companion, not the focus
- Subtly evoke the region being explored
- React to game state (searching, getting warmer, finding regions)
- Be completely optional (easy mute, respects user preferences)

## Technical Approach: Strudel

[Strudel](https://strudel.cc) is a browser-based live coding music environment that's perfect for this because:
- **Generative/algorithmic** - creates evolving, non-repetitive patterns
- **Lightweight** - runs entirely in browser via Web Audio API
- **Pattern-based** - easy to create looping ambient textures
- **Reactive** - patterns can be modified in real-time based on game state

### Key Packages
```
@strudel/core      - Pattern engine
@strudel/webaudio  - Web Audio integration
@strudel/mini      - Mini-notation parser (the DSL)
@strudel/tonal     - Scales, chords, progressions
```

## Musical Design Principles

### 1. Ambient, Not Melodic
- Focus on **textures and drones** rather than memorable melodies
- Use **pads, filtered noise, gentle percussive elements**
- Keep it **sparse** - silence is part of the composition
- Target **-18 to -24 LUFS** (quiet enough to be background)

### 2. Regional Flavoring (Subtle, Not Stereotypical)
The goal is **subtle evocation**, not cultural appropriation or cliches. We'll use:
- **Scale/mode choices** that loosely evoke regions
- **Rhythmic characteristics** (but very subtle)
- **Timbral colors** (instrument-like synth textures)

**NOT**: Playing "ethnic instruments" or obvious cultural signifiers

### 3. Non-Repetitive
Strudel's generative nature helps here:
- Use **probability** in patterns (`"c3 e3 g3 c4".sometimes(x => x.add(7))`)
- **Slowly evolving parameters** (filter sweeps, volume swells)
- **Long cycle times** (32-64 bars before any repeat)

## Three-Layer Music Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: HYPER-LOCAL (per-region, optional)               │
│  - Specific musical hint for the target region              │
│  - Very subtle, barely perceptible                          │
│  - Only ~20-30 regions get custom hints (notable ones)      │
│  - Example: France → faint accordion texture                │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: CONTINENTAL (based on map area)                   │
│  - Sets the overall musical character                       │
│  - Scales, modes, base textures                             │
│  - Changes when continent/region changes                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: AMBIENT BASE (always present)                     │
│  - Neutral drone/pad foundation                             │
│  - Consistent across all regions                            │
│  - Provides continuity during transitions                   │
└─────────────────────────────────────────────────────────────┘
```

### Volume Balance
- **Layer 1 (Base)**: 40% of total
- **Layer 2 (Continental)**: 45% of total
- **Layer 3 (Hyper-local)**: 15% of total (very subtle hint)

## Layer 2: Continental Presets

### World Map Regions

| Region/Continent | Musical Approach |
|------------------|------------------|
| **Europe** | Dorian/Mixolydian modes, gentle pads, subtle church-organ-like timbres |
| **Africa** | Pentatonic scales, gentle polyrhythmic undertones, warm bass |
| **Asia** | Pentatonic (different voicings), sparse, contemplative, bell-like tones |
| **Middle East** | Phrygian dominant hints, desert-wind textures, sparse |
| **Americas (North)** | Open fifths, spacious, subtle Americana folk modes |
| **Americas (South)** | Warm, flowing, subtle Latin rhythm hints |
| **Oceania** | Airy, oceanic textures, island vibes, relaxed |
| **Default/Unknown** | Neutral ambient, no regional coloring |

### USA Map
For US states, we could do regional variations:
- **Northeast**: Urban jazz hints, cool tones
- **South**: Warm, bluesy undertones
- **Midwest**: Open, pastoral
- **West**: Desert/mountain ambience
- **Pacific**: Oceanic, relaxed

## Layer 3: Hyper-Local Hints

These are **optional, very subtle** musical hints that play when searching for specific regions. Not every region needs one - only culturally distinctive ones where a tasteful hint enhances the experience.

### Design Principles for Hyper-Local
1. **Extremely subtle** - should barely be noticeable consciously
2. **Abstract, not literal** - evocative texture, not "playing the anthem"
3. **Tasteful** - avoid stereotypes, focus on musical traditions
4. **Sparse** - a single filtered element, not a full arrangement
5. **Optional** - graceful fallback to continental layer if not defined

### Example Hyper-Local Hints (World Map)

| Region | Hint Approach |
|--------|---------------|
| **France** | Faint musette accordion texture, filtered |
| **Spain** | Subtle flamenco-style rhythmic pattern, very quiet |
| **Brazil** | Gentle bossa nova rhythm hint |
| **Japan** | Sparse koto-like plucked texture |
| **India** | Filtered sitar-like drone, tanpura texture |
| **Ireland** | Celtic harp arpeggios, extremely soft |
| **Egypt** | Desert wind + subtle oud-like tone |
| **Argentina** | Hint of tango rhythm, bandoneon texture |
| **Jamaica** | Subtle reggae offbeat, very filtered |
| **Russia** | Deep balalaika-like plucks, sparse |
| **Greece** | Bouzouki-like texture, Aegean scales |
| **Mexico** | Gentle marimba-like tones |
| **China** | Erhu-like sustained tone, pentatonic |
| **Australia** | Didgeridoo-like drone (if tasteful) |
| **Scotland** | Bagpipe drone (heavily filtered) |
| **USA** | Subtle country/folk guitar texture |
| **Germany** | Subtle oom-pah bass hint (very gentle) |
| **Italy** | Mandolin-like arpeggios, filtered |
| **Nigeria** | Talking drum rhythm hint |
| **South Africa** | Township jazz hint, warm |

### Implementation: Region Hint Data Structure

```typescript
interface RegionMusicHint {
  // Strudel pattern fragment to layer on top
  pattern: string;
  // How loud relative to base (0.0 - 1.0, typically 0.1-0.3)
  gain: number;
  // Crossfade time when this region becomes active (ms)
  fadeIn: number;
  // Optional: only trigger after N seconds of searching
  delayStart?: number;
}

// Example mapping
const regionHints: Record<string, RegionMusicHint> = {
  'fr': {
    pattern: `note("c4 e4 g4").sound("accordion").lpf(400).gain(0.1).slow(8)`,
    gain: 0.15,
    fadeIn: 3000,
    delayStart: 2000, // Only start hint after 2s of searching
  },
  'jp': {
    pattern: `note("d4 f4 a4 c5").sound("pluck").lpf(600).gain(0.08).slow(12)`,
    gain: 0.12,
    fadeIn: 4000,
  },
  // ... more regions
};
```

### USA Hyper-Local Hints

| State | Hint Approach |
|-------|---------------|
| **Louisiana** | Jazz/blues hint, New Orleans feel |
| **Tennessee** | Country twang, Nashville texture |
| **New York** | Urban jazz, bebop hint |
| **California** | Surf/beach vibes, relaxed |
| **Texas** | Country/western hint |
| **Hawaii** | Slack-key guitar, ukulele texture |
| **Alaska** | Arctic ambient, sparse |
| **New Mexico** | Desert southwestern, Native flute hint |

### Graceful Degradation

```
If hyper-local hint exists → play all 3 layers
If no hyper-local hint → play layers 1 + 2 only
If continental unknown → play layer 1 only
If music disabled → play nothing
```

## Game State Reactivity

### Temperature Feedback (Hot/Cold)
| State | Musical Response |
|-------|------------------|
| **Freezing/Cold** | Sparse, quiet, slow filter cutoff, minor color |
| **Neutral** | Baseline ambient |
| **Warmer** | Slight energy increase, filter opens |
| **Hot/On Fire** | Fuller texture, brighter, subtle excitement |
| **Found It!** | Brief celebratory flourish, then return to ambient |

### Implementation Approach
- Use **Strudel's pattern modulation** to adjust parameters
- Crossfade between "cold" and "hot" pattern variations
- Keep changes **gradual** (over 2-4 seconds) to avoid jarring shifts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Component Tree                      │
├─────────────────────────────────────────────────────────────┤
│  KnowYourWorldProvider                                       │
│    ├── useMusicEngine() hook                                │
│    │     ├── Strudel initialization                         │
│    │     ├── Pattern management                             │
│    │     ├── Regional preset selection                      │
│    │     └── Game state reactivity                          │
│    │                                                        │
│    ├── MusicContext (provides controls to children)         │
│    │     ├── isPlaying: boolean                            │
│    │     ├── volume: number                                 │
│    │     ├── setVolume(v)                                   │
│    │     ├── mute() / unmute()                             │
│    │     └── currentPreset: RegionalPreset                  │
│    │                                                        │
│    └── Automatic reactivity:                                │
│          ├── Region changes → update preset                 │
│          ├── Hot/cold state → modulate parameters           │
│          └── Celebration → trigger flourish                 │
└─────────────────────────────────────────────────────────────┘
```

### File Structure
```
src/arcade-games/know-your-world/
├── music/
│   ├── useMusicEngine.ts        # Main Strudel hook
│   ├── MusicContext.tsx         # React context for controls
│   ├── layers/
│   │   ├── baseLayer.ts         # Layer 1: Ambient foundation
│   │   ├── continentalLayer.ts  # Layer 2: Continental presets
│   │   └── hyperLocalLayer.ts   # Layer 3: Per-region hints
│   ├── presets/
│   │   ├── index.ts             # Preset registry
│   │   ├── continental/
│   │   │   ├── europe.ts
│   │   │   ├── asia.ts
│   │   │   ├── africa.ts
│   │   │   ├── middleEast.ts
│   │   │   ├── northAmerica.ts
│   │   │   ├── southAmerica.ts
│   │   │   └── oceania.ts
│   │   └── hyperLocal/
│   │       ├── worldHints.ts    # ~20-30 world region hints
│   │       └── usaHints.ts      # ~10-15 US state hints
│   ├── regionMapping.ts         # Map region IDs to continental presets
│   ├── temperatureModulation.ts # Hot/cold pattern mods
│   └── utils/
│       ├── crossfade.ts         # Smooth transitions between layers
│       └── strudel.ts           # Strudel initialization helpers
├── components/
│   └── MusicControls.tsx        # UI for volume/mute
```

## User Controls

### Minimal UI
- **Single mute/unmute button** in settings panel
- **Volume slider** (optional, could omit for simplicity)
- **Remember preference** in localStorage

### Respecting User Preferences
- Check `prefers-reduced-motion` - disable reactive changes
- Default to **muted** on first visit (require explicit opt-in)
- Respect system-wide audio settings

## Implementation Phases

### Phase 1: Foundation
1. Install Strudel packages (`@strudel/core`, `@strudel/webaudio`, `@strudel/mini`)
2. Create `useMusicEngine` hook with basic playback
3. Create Layer 1: Base ambient drone
4. Add mute/unmute button to UI
5. Test basic playback works
6. Handle browser autoplay restrictions (require user interaction)

### Phase 2: Continental Layer
1. Create continental preset files (Layer 2)
2. Implement region-to-continent mapping
3. Add crossfade between continental presets
4. Test with various regions on world map
5. Balance volumes between Layer 1 and Layer 2

### Phase 3: Hyper-Local Layer
1. Create data structure for region hints
2. Implement ~20 world region hints (start with most distinctive)
3. Implement ~10 US state hints
4. Add delayed hint activation (only after searching 2+ seconds)
5. Implement smooth fade-in/out for hints
6. Test layering of all three layers together

### Phase 4: Game State Reactivity
1. Implement temperature modulation (affects all layers)
2. Add celebration flourish
3. Connect to existing hot/cold feedback system
4. Fine-tune transition timings
5. Ensure modulation feels musical, not jarring

### Phase 5: Polish
1. Add volume control slider
2. Persist music preferences in localStorage
3. Add prefers-reduced-motion support
4. Performance optimization (lazy loading patterns)
5. Accessibility audit
6. Mobile testing (iOS autoplay policies)
7. Final volume balancing pass

## Example Strudel Patterns

### Neutral Ambient Base
```javascript
// Slow, evolving pad
stack(
  note("c2 g2 c3").sound("sine").lpf(400).gain(0.1).slow(8),
  note("e3 g3").sound("triangle").lpf(800).gain(0.05).slow(16)
).room(0.8)
```

### European Variation
```javascript
// Dorian coloring, organ-like
stack(
  note("d2 a2 d3").sound("sine").lpf(500).gain(0.1).slow(8),
  note("f3 a3 c4").sound("sawtooth").lpf(600).gain(0.03).slow(12)
).room(0.9).delay(0.3)
```

### Hot/Warm Modulation
```javascript
// Add brightness and subtle rhythm
basePattern
  .lpf(sine.range(600, 1200).slow(4))  // Filter sweep
  .gain(sine.range(0.08, 0.12).slow(2)) // Volume pulse
```

### Cold Modulation
```javascript
// Sparse, dark, slow
basePattern
  .lpf(300)
  .gain(0.05)
  .slow(2)  // Half speed
  .sometimes(x => silence)  // Random dropouts
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Annoying users** | Default to muted, easy controls, subtle design |
| **Cultural insensitivity** | Avoid cliches, focus on abstract musical elements |
| **Performance issues** | Lazy load Strudel, use efficient patterns |
| **Browser compatibility** | Web Audio API is well-supported, graceful fallback |
| **Bundle size** | Consider dynamic imports for music module |

## Open Questions

1. **Should music auto-play after user opts in once?** Or require click each session?
2. **How to handle multiplayer?** Each player controls their own audio?
3. **Mobile considerations?** iOS has strict autoplay policies
4. **Should we pre-compose some patterns** and store as audio for fallback?

## Success Criteria

- [ ] Users who enable music report it enhances the experience
- [ ] No complaints about it being distracting or annoying
- [ ] Regional flavoring feels appropriate, not stereotypical
- [ ] Performance: no frame drops or audio glitches
- [ ] Bundle size increase < 100KB gzipped
