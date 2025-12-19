# Animation Patterns

## Spring-for-Speed, Manual-Integration-for-Angle Pattern

When animating continuous rotation where the **speed changes smoothly** but you need to **avoid position jumps**, use this pattern.

### The Problem

**CSS Animation approach fails because:**

- Changing `animation-duration` resets the animation phase, causing jumps
- `animation-delay` tricks don't reliably preserve position across speed changes

**Calling `spring.start()` 60fps fails because:**

- React-spring's internal batching can't keep up with 60fps updates
- Spring value lags 1000+ degrees behind, causing wild spinning
- React re-renders interfere with spring updates

### The Solution: Decouple Speed and Angle

```typescript
import { animated, useSpringValue } from '@react-spring/web'

// 1. Spring for SPEED (this is what transitions smoothly)
const rotationSpeed = useSpringValue(0, {
  config: { tension: 200, friction: 30 },
})

// 2. Spring value for ANGLE (we'll .set() this directly, no springing)
const rotationAngle = useSpringValue(0)

// 3. Update speed spring when target changes
useEffect(() => {
  rotationSpeed.start(targetSpeedDegPerSec)
}, [targetSpeedDegPerSec, rotationSpeed])

// 4. requestAnimationFrame loop integrates angle from speed
useEffect(() => {
  let lastTime = performance.now()
  let frameId: number

  const loop = (now: number) => {
    const dt = (now - lastTime) / 1000 // seconds
    lastTime = now

    const speed = rotationSpeed.get() // deg/s from the spring
    let angle = rotationAngle.get() + speed * dt // integrate

    // Keep angle in reasonable range (prevent overflow)
    if (angle >= 360000) angle -= 360000
    if (angle < 0) angle += 360

    // Direct set - no extra springing on angle itself
    rotationAngle.set(angle)

    frameId = requestAnimationFrame(loop)
  }

  frameId = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(frameId)
}, [rotationSpeed, rotationAngle])

// 5. Bind angle to animated element
<animated.svg
  style={{
    transform: rotationAngle.to((a) => `rotate(${a}deg)`),
  }}
>
  {/* SVG content */}
</animated.svg>
```

### Why This Works

1. **Speed spring handles smooth transitions**: When target speed changes, the spring smoothly interpolates. No jumps.

2. **Manual integration preserves continuity**: `angle += speed * dt` always adds to the current angle. The angle never resets or jumps.

3. **Direct `.set()` avoids lag**: We're not asking the spring to animate the angle - we're directly setting it 60 times per second. No batching issues.

4. **`useSpringValue` enables binding**: Unlike a plain ref, `useSpringValue` can be bound to animated elements via `.to()`.

### Key Insights

- **Spring the derivative, integrate the value**: Speed is the derivative of angle. Spring the speed, integrate to get angle.
- **Never spring something you're updating 60fps**: The spring can't keep up. Use `.set()` instead of `.start()`.
- **Keep integration in rAF, not React effects**: React effects can skip frames or batch. rAF is reliable.

### When to Use This Pattern

- Rotating elements where rotation speed changes based on state
- Scrolling effects where scroll speed should transition smoothly
- Any continuous animation where the RATE of change should animate, not the value itself

### Anti-Patterns to Avoid

```typescript
// BAD: Calling start() in rAF loop
const loop = () => {
  angle.start(currentAngle + speed * dt) // Will lag behind!
}

// BAD: CSS animation with dynamic duration
style={{
  animation: `spin ${1/speed}s linear infinite` // Jumps on speed change!
}}

// BAD: Changing animation-delay to preserve position
style={{
  animationDelay: `-${currentAngle / 360 * duration}s` // Unreliable!
}}
```
