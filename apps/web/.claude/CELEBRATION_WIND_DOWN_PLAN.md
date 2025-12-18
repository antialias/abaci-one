# Celebration Wind-Down: The Proper Way

## Concept

Every single CSS property morphs individually from celebration state to normal state over ~60 seconds. No cheating with cross-fades. Pure interpolation madness.

## SIMPLIFICATION: Same Text Throughout

To make the transition truly seamless, the text content stays the same from start to finish:

- **Title**: "New Skill Unlocked: +5 − 3" (same throughout)
- **Subtitle**: "Ready to start the tutorial" (same throughout)
- **Button**: "Begin Tutorial →" (same throughout)

Only the *styling* of the text changes (size, color, shadow) - not the content.
This eliminates 6 properties that were doing text cross-fades.

## Properties to Interpolate

### Container
| Property | Celebration | Normal | Interpolation |
|----------|-------------|--------|---------------|
| background | `linear-gradient(135deg, rgba(234,179,8,0.25), rgba(251,191,36,0.15), rgba(234,179,8,0.25))` | `linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1))` | RGB channels per stop |
| border-width | `3px` | `1px` | numeric |
| border-color | `yellow.500` (#eab308) | `blue.500` (#3b82f6) | RGB |
| border-radius | `16px` | `12px` | numeric |
| padding | `1.5rem` (24px) | `0.75rem` (12px) | numeric |
| box-shadow | `0 0 20px rgba(234,179,8,0.4), 0 0 40px rgba(234,179,8,0.2)` | `0 2px 8px rgba(0,0,0,0.1)` | multiple shadows, each with color+blur+spread |
| text-align | `center` | `left` | discrete flip at 50%? Or use justify-content |
| flex-direction | `column` | `row` | discrete flip |

### Emoji/Icon
| Property | Celebration | Normal |
|----------|-------------|--------|
| font-size | `4rem` (64px) | `1.5rem` (24px) | numeric |
| opacity (🏆) | `1` | `0` | numeric |
| opacity (🎓) | `0` | `1` | numeric |
| transform | `rotate(-3deg)` to `rotate(3deg)` wiggle | `rotate(0)` | numeric (animation amplitude → 0) |
| margin-bottom | `0.5rem` | `0` | numeric |

### Title Text
| Property | Celebration | Normal |
|----------|-------------|--------|
| font-size | `1.75rem` (28px) | `1rem` (16px) | numeric |
| font-weight | `bold` (700) | `600` | numeric |
| color | `yellow.200` (#fef08a) | `blue.700` (#1d4ed8) | RGB |
| text-shadow | `0 0 20px rgba(234,179,8,0.5)` | `none` (0 0 0 transparent) | color+blur |
| margin-bottom | `0.5rem` | `0.25rem` | numeric |
| opacity ("New Skill Unlocked!") | `1` | `0` | numeric |
| opacity ("Ready to Learn") | `0` | `1` | numeric |

### Subtitle Text
| Property | Celebration | Normal |
|----------|-------------|--------|
| font-size | `1.25rem` (20px) | `0.875rem` (14px) | numeric |
| color | `gray.200` | `gray.600` | RGB |
| margin-bottom | `1rem` | `0` | numeric |
| opacity (celebration text) | `1` | `0` | numeric |
| opacity (normal text) | `0` | `1` | numeric |

### CTA Button
| Property | Celebration | Normal |
|----------|-------------|--------|
| padding-x | `2rem` (32px) | `1rem` (16px) | numeric |
| padding-y | `0.75rem` (12px) | `0.5rem` (8px) | numeric |
| font-size | `1.125rem` (18px) | `0.875rem` (14px) | numeric |
| background | `linear-gradient(135deg, #FCD34D, #F59E0B)` | `#3b82f6` | RGB gradient → solid |
| border-radius | `12px` | `8px` | numeric |
| box-shadow | `0 4px 15px rgba(245,158,11,0.4)` | `0 2px 4px rgba(0,0,0,0.1)` | color+offset+blur |
| color | `gray.900` (#111827) | `white` (#ffffff) | RGB |
| transform (hover) | `scale(1.05)` | `scale(1.02)` | numeric |

### Shimmer Overlay
| Property | Celebration | Normal |
|----------|-------------|--------|
| opacity | `1` | `0` | numeric |
| animation-duration | `2s` | `10s` (slow to imperceptible stop) | numeric |

### Glow Animation
| Property | Celebration | Normal |
|----------|-------------|--------|
| box-shadow intensity | `1` | `0` | multiplier on shadow alpha |
| animation amplitude | full | `0` | numeric |

## Interpolation Utilities

```typescript
// Basic linear interpolation
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

// Color interpolation (RGB)
function lerpColor(startHex: string, endHex: string, t: number): string {
  const start = hexToRgb(startHex)
  const end = hexToRgb(endHex)
  return `rgb(${lerp(start.r, end.r, t)}, ${lerp(start.g, end.g, t)}, ${lerp(start.b, end.b, t)})`
}

// RGBA interpolation
function lerpRgba(start: RGBA, end: RGBA, t: number): string {
  return `rgba(${lerp(start.r, end.r, t)}, ${lerp(start.g, end.g, t)}, ${lerp(start.b, end.b, t)}, ${lerp(start.a, end.a, t)})`
}

// Gradient interpolation (same number of stops)
function lerpGradient(startStops: GradientStop[], endStops: GradientStop[], t: number): string {
  const interpolatedStops = startStops.map((start, i) => {
    const end = endStops[i]
    return {
      color: lerpRgba(start.color, end.color, t),
      position: lerp(start.position, end.position, t)
    }
  })
  return `linear-gradient(135deg, ${interpolatedStops.map(s => `${s.color} ${s.position}%`).join(', ')})`
}

// Box shadow interpolation
function lerpBoxShadow(start: BoxShadow[], end: BoxShadow[], t: number): string {
  // Pad shorter array with transparent shadows
  const maxLen = Math.max(start.length, end.length)
  const paddedStart = padShadows(start, maxLen)
  const paddedEnd = padShadows(end, maxLen)

  return paddedStart.map((s, i) => {
    const e = paddedEnd[i]
    return `${lerp(s.x, e.x, t)}px ${lerp(s.y, e.y, t)}px ${lerp(s.blur, e.blur, t)}px ${lerp(s.spread, e.spread, t)}px ${lerpRgba(s.color, e.color, t)}`
  }).join(', ')
}
```

## Timing Function

Ultra-slow ease-out that feels imperceptible:

```typescript
function windDownProgress(elapsedMs: number): number {
  const BURST_DURATION = 5_000      // 5s full celebration
  const WIND_DOWN_DURATION = 55_000 // 55s transition

  if (elapsedMs < BURST_DURATION) return 0

  const windDownElapsed = elapsedMs - BURST_DURATION
  if (windDownElapsed >= WIND_DOWN_DURATION) return 1

  const t = windDownElapsed / WIND_DOWN_DURATION

  // Attempt: Start EXTREMELY slow, accelerate near end
  // Using quartic ease-out: 1 - (1-t)^4
  // But even slower: quintic ease-out: 1 - (1-t)^5
  return 1 - Math.pow(1 - t, 5)
}
```

Progress over time with quintic ease-out:
- 10s: 0.03% transitioned (imperceptible)
- 20s: 0.8% transitioned (still imperceptible)
- 30s: 4% transitioned (barely noticeable if you squint)
- 40s: 13% transitioned (hmm, something's different?)
- 50s: 33% transitioned (ok it's changing)
- 55s: 52% transitioned
- 58s: 75% transitioned
- 60s: 100% done

## Animation Amplitude Wind-Down

For the wiggle animation on the trophy:

```typescript
// Current wiggle: rotate between -3deg and +3deg
// Wind down: amplitude goes from 3 → 0

function getWiggleAmplitude(t: number): number {
  // Inverse of progress - starts at 3, ends at 0
  return 3 * (1 - t)
}

// In CSS/style:
const wiggleAmplitude = getWiggleAmplitude(progress)
// Use CSS custom property or inline keyframes
style={{
  animation: wiggleAmplitude > 0.1
    ? `wiggle-${Math.round(wiggleAmplitude * 10)} 0.5s ease-in-out infinite`
    : 'none'
}}
```

Actually, for smooth wiggle wind-down, we should use a spring-based approach or just interpolate the transform directly:

```typescript
// Wiggle is a sine wave with decreasing amplitude
const time = Date.now() / 500 // oscillation period
const amplitude = 3 * (1 - progress)
const rotation = Math.sin(time) * amplitude
// transform: `rotate(${rotation}deg)`
```

## Component Structure

```typescript
interface CelebrationStyles {
  // Container
  containerBackground: string
  containerBorderWidth: number
  containerBorderColor: string
  containerBorderRadius: number
  containerPadding: number
  containerBoxShadow: string
  containerFlexDirection: 'column' | 'row'
  containerAlignItems: 'center' | 'flex-start'
  containerTextAlign: 'center' | 'left'

  // Emoji
  trophyOpacity: number
  graduationCapOpacity: number
  emojiSize: number
  emojiRotation: number
  emojiMarginBottom: number

  // Title
  titleFontSize: number
  titleColor: string
  titleTextShadow: string
  titleMarginBottom: number
  celebrationTitleOpacity: number
  normalTitleOpacity: number

  // Subtitle
  subtitleFontSize: number
  subtitleColor: string
  subtitleMarginBottom: number
  celebrationSubtitleOpacity: number
  normalSubtitleOpacity: number

  // Button
  buttonPaddingX: number
  buttonPaddingY: number
  buttonFontSize: number
  buttonBackground: string
  buttonBorderRadius: number
  buttonBoxShadow: string
  buttonColor: string

  // Shimmer
  shimmerOpacity: number

  // Glow
  glowIntensity: number
}

function calculateStyles(progress: number, isDark: boolean): CelebrationStyles {
  const t = progress // 0 = celebration, 1 = normal

  return {
    // Container
    containerBackground: lerpGradient(
      isDark ? DARK_CELEBRATION_BG : LIGHT_CELEBRATION_BG,
      isDark ? DARK_NORMAL_BG : LIGHT_NORMAL_BG,
      t
    ),
    containerBorderWidth: lerp(3, 1, t),
    containerBorderColor: lerpColor('#eab308', '#3b82f6', t),
    containerBorderRadius: lerp(16, 12, t),
    containerPadding: lerp(24, 12, t),
    containerBoxShadow: lerpBoxShadow(CELEBRATION_SHADOWS, NORMAL_SHADOWS, t),
    containerFlexDirection: t < 0.5 ? 'column' : 'row',
    containerAlignItems: t < 0.5 ? 'center' : 'flex-start',
    containerTextAlign: t < 0.5 ? 'center' : 'left',

    // Emoji - cross-fade between trophy and graduation cap
    trophyOpacity: 1 - t,
    graduationCapOpacity: t,
    emojiSize: lerp(64, 24, t),
    emojiRotation: Math.sin(Date.now() / 500) * 3 * (1 - t),
    emojiMarginBottom: lerp(8, 0, t),

    // Title
    titleFontSize: lerp(28, 16, t),
    titleColor: lerpColor(isDark ? '#fef08a' : '#a16207', isDark ? '#93c5fd' : '#1d4ed8', t),
    titleTextShadow: `0 0 ${lerp(20, 0, t)}px rgba(234,179,8,${lerp(0.5, 0, t)})`,
    titleMarginBottom: lerp(8, 4, t),
    celebrationTitleOpacity: 1 - t,
    normalTitleOpacity: t,

    // Subtitle
    subtitleFontSize: lerp(20, 14, t),
    subtitleColor: lerpColor(isDark ? '#e5e7eb' : '#374151', isDark ? '#9ca3af' : '#4b5563', t),
    subtitleMarginBottom: lerp(16, 0, t),
    celebrationSubtitleOpacity: 1 - t,
    normalSubtitleOpacity: t,

    // Button
    buttonPaddingX: lerp(32, 16, t),
    buttonPaddingY: lerp(12, 8, t),
    buttonFontSize: lerp(18, 14, t),
    buttonBackground: lerpGradient(CELEBRATION_BUTTON_BG, NORMAL_BUTTON_BG, t),
    buttonBorderRadius: lerp(12, 8, t),
    buttonBoxShadow: lerpBoxShadow(CELEBRATION_BUTTON_SHADOW, NORMAL_BUTTON_SHADOW, t),
    buttonColor: lerpColor('#111827', '#ffffff', t),

    // Effects
    shimmerOpacity: 1 - t,
    glowIntensity: 1 - t,
  }
}
```

## Render Logic

```tsx
function CelebrationProgressionBanner({ sessionMode, onAction, variant, isDark }: Props) {
  const skillId = sessionMode.nextSkill.skillId
  const { progress, shouldFireConfetti, oscillation } = useCelebrationWindDown(skillId)

  // Fire confetti once
  useEffect(() => {
    if (shouldFireConfetti) {
      fireConfettiCelebration()
    }
  }, [shouldFireConfetti])

  // Calculate all interpolated styles
  const styles = calculateStyles(progress, isDark)

  // For layout transition (column → row), we need to handle this carefully
  // Use flexbox with animated flex-direction doesn't work well
  // Instead: use a wrapper that morphs via width/height constraints

  return (
    <div
      data-element="session-mode-banner"
      data-celebration-progress={progress}
      style={{
        position: 'relative',
        background: styles.containerBackground,
        borderWidth: `${styles.containerBorderWidth}px`,
        borderStyle: 'solid',
        borderColor: styles.containerBorderColor,
        borderRadius: `${styles.containerBorderRadius}px`,
        padding: `${styles.containerPadding}px`,
        boxShadow: styles.containerBoxShadow,
        display: 'flex',
        flexDirection: styles.containerFlexDirection,
        alignItems: styles.containerAlignItems,
        textAlign: styles.containerTextAlign,
        overflow: 'hidden',
      }}
    >
      {/* Shimmer overlay - fades out */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
          opacity: styles.shimmerOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Emoji container - both emojis positioned, cross-fading */}
      <div style={{
        position: 'relative',
        fontSize: `${styles.emojiSize}px`,
        marginBottom: `${styles.emojiMarginBottom}px`,
        marginRight: styles.containerFlexDirection === 'row' ? '12px' : 0,
      }}>
        {/* Trophy - fades out, wiggles */}
        <span style={{
          opacity: styles.trophyOpacity,
          transform: `rotate(${styles.emojiRotation}deg)`,
          position: styles.trophyOpacity < 0.5 ? 'absolute' : 'relative',
        }}>
          🏆
        </span>
        {/* Graduation cap - fades in */}
        <span style={{
          opacity: styles.graduationCapOpacity,
          position: styles.graduationCapOpacity < 0.5 ? 'absolute' : 'relative',
        }}>
          🎓
        </span>
      </div>

      {/* Text content area */}
      <div style={{ flex: 1 }}>
        {/* Title - both versions, cross-fading */}
        <div style={{
          position: 'relative',
          fontSize: `${styles.titleFontSize}px`,
          fontWeight: 'bold',
          color: styles.titleColor,
          textShadow: styles.titleTextShadow,
          marginBottom: `${styles.titleMarginBottom}px`,
        }}>
          <span style={{ opacity: styles.celebrationTitleOpacity }}>
            New Skill Unlocked!
          </span>
          <span style={{
            opacity: styles.normalTitleOpacity,
            position: 'absolute',
            left: 0,
            top: 0,
          }}>
            Ready to Learn New Skill
          </span>
        </div>

        {/* Subtitle - both versions, cross-fading */}
        <div style={{
          position: 'relative',
          fontSize: `${styles.subtitleFontSize}px`,
          color: styles.subtitleColor,
          marginBottom: `${styles.subtitleMarginBottom}px`,
        }}>
          <span style={{ opacity: styles.celebrationSubtitleOpacity }}>
            You're ready to learn <strong>{sessionMode.nextSkill.displayName}</strong>
          </span>
          <span style={{
            opacity: styles.normalSubtitleOpacity,
            position: 'absolute',
            left: 0,
            top: 0,
          }}>
            {sessionMode.nextSkill.displayName} — Start the tutorial to begin
          </span>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={onAction}
        style={{
          padding: `${styles.buttonPaddingY}px ${styles.buttonPaddingX}px`,
          fontSize: `${styles.buttonFontSize}px`,
          fontWeight: 'bold',
          background: styles.buttonBackground,
          color: styles.buttonColor,
          borderRadius: `${styles.buttonBorderRadius}px`,
          border: 'none',
          boxShadow: styles.buttonBoxShadow,
          cursor: 'pointer',
        }}
      >
        {/* Button text also cross-fades */}
        <span style={{ opacity: styles.celebrationTitleOpacity }}>Start Learning!</span>
        <span style={{ opacity: styles.normalTitleOpacity, position: 'absolute' }}>
          Start Tutorial
        </span>
      </button>
    </div>
  )
}
```

## Animation Frame Loop

The wind-down needs to run on requestAnimationFrame for smooth updates:

```typescript
function useCelebrationWindDown(skillId: string) {
  const [progress, setProgress] = useState(0)
  const [shouldFireConfetti, setShouldFireConfetti] = useState(false)
  const [oscillation, setOscillation] = useState(0)

  useEffect(() => {
    const state = getCelebrationState(skillId)

    if (!state) {
      // First time seeing this skill unlock
      setCelebrationState(skillId, { startedAt: Date.now(), confettiFired: false })
      setShouldFireConfetti(true)
    }

    let rafId: number
    const animate = () => {
      const state = getCelebrationState(skillId)
      if (!state) return

      const elapsed = Date.now() - state.startedAt
      const newProgress = windDownProgress(elapsed)

      setProgress(newProgress)
      setOscillation(Math.sin(Date.now() / 500)) // For wiggle

      if (newProgress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [skillId])

  return { progress, shouldFireConfetti, oscillation }
}
```

## Implementation Order

1. **Create interpolation utilities** (`src/utils/interpolate.ts`)
   - `lerp(start, end, t)`
   - `hexToRgb(hex)`, `rgbToHex(r, g, b)`
   - `lerpColor(startHex, endHex, t)`
   - `lerpRgba(start, end, t)`
   - `parseGradient(css)`, `lerpGradient(start, end, t)`
   - `parseBoxShadow(css)`, `lerpBoxShadow(start, end, t)`

2. **Create wind-down hook** (`src/hooks/useCelebrationWindDown.ts`)
   - localStorage state management
   - requestAnimationFrame loop
   - Progress calculation with quintic ease-out
   - Confetti trigger flag

3. **Create style calculation** (in SessionModeBanner or separate file)
   - Define start/end values for all properties
   - `calculateCelebrationStyles(progress, isDark)`

4. **Update SessionModeBanner**
   - Add CelebrationProgressionBanner sub-component
   - Integrate wind-down when progression + tutorialRequired
   - Move confetti firing into banner

5. **Clean up Dashboard/Summary**
   - Remove SkillUnlockBanner conditionals
   - Let SessionModeBanner handle everything

6. **Consider: SkillUnlockBanner**
   - Deprecate or keep for other uses?
   - Could extract confetti logic to shared util

## Total Property Count

We're interpolating:

**Container:** 6 properties (background, border-width, border-color, border-radius, padding, box-shadow)
**Emoji:** 5 properties (trophy opacity, star opacity, size, rotation, margin)
**Title:** 3 properties (font-size, color, text-shadow)
**Subtitle:** 3 properties (font-size, color, margin-top)
**Button:** 7 properties (padding-y, padding-x, font-size, background, border-radius, box-shadow, color)
**Effects:** 1 property (shimmer opacity)
**Layout:** 1 property (flex-direction/alignment switch at 70%)

**Total: 26 interpolated properties**

Plus the oscillation for the wiggle animation running independently at 60fps.

This is properly ridiculous. The text stays the same throughout, making the transition truly imperceptible.
