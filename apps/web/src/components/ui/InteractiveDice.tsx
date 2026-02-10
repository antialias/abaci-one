'use client'

import { animated, useSpring } from '@react-spring/web'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/contexts/ThemeContext'

export interface DiceColorScheme {
  faceLight: string
  faceDark: string
  dotLight: string
  dotDark: string
}

// Dot patterns for each dice face (positions as fractions of face size)
const DICE_DOT_PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.2],
    [0.25, 0.5],
    [0.25, 0.8],
    [0.75, 0.2],
    [0.75, 0.5],
    [0.75, 0.8],
  ],
}

// Rotation needed to show each face
// Standard dice: 1 opposite 6, 2 opposite 5, 3 opposite 4
const DICE_FACE_ROTATIONS: Record<number, { rotateX: number; rotateY: number }> = {
  1: { rotateX: 0, rotateY: 0 }, // front
  2: { rotateX: 0, rotateY: -90 }, // right
  3: { rotateX: -90, rotateY: 0 }, // top
  4: { rotateX: 90, rotateY: 0 }, // bottom
  5: { rotateX: 0, rotateY: 90 }, // left
  6: { rotateX: 0, rotateY: 180 }, // back
}

/**
 * 3D Dice Icon using react-spring for smooth animations
 *
 * Creates a cube with 6 faces, each showing the appropriate dot pattern.
 * The cube rotates on all 3 axes when rolling, with physics-based easing.
 */
function DiceIcon({
  className,
  rotateX,
  rotateY,
  rotateZ,
  isDark,
  size = 22,
  colorScheme,
}: {
  className?: string
  rotateX: number
  rotateY: number
  rotateZ: number
  isDark: boolean
  size?: number
  colorScheme?: DiceColorScheme
}) {
  const halfSize = size / 2

  // Animate rotation with react-spring
  const springProps = useSpring({
    rotateX,
    rotateY,
    rotateZ,
    config: {
      tension: 120,
      friction: 14,
    },
  })

  // Theme-aware colors
  // Dark mode: lighter indigo with more contrast against dark backgrounds
  // Light mode: deeper indigo that stands out against light backgrounds
  const faceBackground = colorScheme
    ? (isDark ? colorScheme.faceDark : colorScheme.faceLight)
    : (isDark ? '#818cf8' : '#4f46e5') // indigo-400 dark, indigo-600 light
  const faceBorder = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.5)'
  const dotColor = colorScheme
    ? (isDark ? colorScheme.dotDark : colorScheme.dotLight)
    : (isDark ? '#1e1b4b' : 'white') // indigo-950 dots on light bg in dark mode

  // Render dots for a face
  const renderDots = (face: number) => {
    const dots = DICE_DOT_PATTERNS[face] || []
    return dots.map(([x, y], i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: '18%',
          height: '18%',
          backgroundColor: dotColor,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    ))
  }

  // Common face styles - opaque background to prevent artifacts during rotation
  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    backgroundColor: faceBackground,
    border: `1.5px solid ${faceBorder}`,
    borderRadius: 2,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        perspective: 100,
        perspectiveOrigin: 'center',
      }}
    >
      <animated.div
        data-dice-cube
        style={{
          width: size,
          height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: springProps.rotateX.to(
            (rx) =>
              `rotateX(${rx}deg) rotateY(${springProps.rotateY.get()}deg) rotateZ(${springProps.rotateZ.get()}deg)`
          ),
        }}
      >
        {/* Front face (1) */}
        <div style={{ ...faceStyle, transform: `translateZ(${halfSize}px)` }}>{renderDots(1)}</div>
        {/* Back face (6) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(180deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(6)}
        </div>
        {/* Right face (2) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(2)}
        </div>
        {/* Left face (5) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateY(-90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(5)}
        </div>
        {/* Top face (3) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateX(90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(3)}
        </div>
        {/* Bottom face (4) */}
        <div
          style={{
            ...faceStyle,
            transform: `rotateX(-90deg) translateZ(${halfSize}px)`,
          }}
        >
          {renderDots(4)}
        </div>
      </animated.div>
    </div>
  )
}

export interface InteractiveDiceProps {
  /** Called when the dice is rolled (clicked or thrown) - fires immediately */
  onRoll: () => void
  /** Called when dragging starts - useful for preloading/prefetching */
  onDragStart?: () => void
  /** Called when the dice animation completes and settles back home */
  onRollComplete?: () => void
  /** Called for instant roll (shift+click) - bypasses animation */
  onInstantRoll?: () => void
  /** Whether the dice is disabled */
  disabled?: boolean
  /** Size of the dice in pixels (default: 22) */
  size?: number
  /** Title/tooltip for the dice button */
  title?: string
  /** Additional CSS class for the button */
  className?: string
  /** Button style overrides */
  style?: React.CSSProperties
  /** Override the default indigo color scheme */
  colorScheme?: DiceColorScheme
  /** Reports the rolled face value (1-6). When present, enables face 1. */
  onRolledValue?: (value: number) => void
  /** Increment to trigger a roll programmatically (e.g. for "Roll All") */
  rollTrigger?: number
}

/**
 * Interactive 3D dice that can be clicked or dragged and thrown.
 *
 * Features:
 * - Click to roll
 * - Drag and release to throw (physics simulation)
 * - Bounces off viewport edges
 * - Grows when flying, shrinks when returning
 * - Smooth spring-based animations
 */
export function InteractiveDice({
  onRoll,
  onDragStart,
  onRollComplete,
  onInstantRoll,
  disabled = false,
  size = 22,
  title = 'Roll dice (drag or click)',
  className,
  style,
  colorScheme,
  onRolledValue,
  rollTrigger,
}: InteractiveDiceProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Dice rotation state for react-spring animation
  // We track cumulative spins to add visual flair, then compute final rotation
  // to land on the correct face derived from a random value
  const [spinCount, setSpinCount] = useState(0)
  // Track which face we're showing (for ensuring consecutive rolls differ)
  const minFace = onRolledValue ? 1 : 2
  const faceCount = onRolledValue ? 6 : 5
  const [currentFace, setCurrentFace] = useState(() => Math.floor(Math.random() * faceCount) + minFace)

  // Draggable dice state with physics simulation
  const [isDragging, setIsDragging] = useState(false)
  const [diceOrigin, setDiceOrigin] = useState({ x: 0, y: 0 })
  const diceButtonRef = useRef<HTMLButtonElement>(null)
  const diceContainerRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })

  // Physics state for thrown dice
  const [isFlying, setIsFlying] = useState(false)
  const dicePhysics = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scale: 1, // Grows to 3x when flying, shrinks back when settling
  })
  const lastPointerPos = useRef({ x: 0, y: 0, time: 0 })
  // Track velocity samples for smoother flick detection
  const velocitySamples = useRef<Array<{ vx: number; vy: number; time: number }>>([])
  const animationFrameRef = useRef<number>()
  // Timeout ref for click-only roll completion callback
  const rollCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  // Flag to prevent click from firing after a throw (pointerup + click both fire)
  const justThrewRef = useRef(false)

  // Ref to the portal dice element for direct DOM manipulation during drag/flying (avoids re-renders)
  const portalDiceRef = useRef<HTMLDivElement>(null)

  // Compute target rotation for the current face (needed by physics simulation)
  const targetFaceRotation = DICE_FACE_ROTATIONS[currentFace] || {
    rotateX: 0,
    rotateY: 0,
  }

  // Roll the dice - animate and call onRoll
  // isFromThrow: true if this roll is from a drag-throw (physics simulation will handle completion)
  const handleRoll = useCallback(
    (isFromThrow = false) => {
      // Clear any pending completion timeout from previous click roll
      if (rollCompleteTimeoutRef.current) {
        clearTimeout(rollCompleteTimeoutRef.current)
        rollCompleteTimeoutRef.current = undefined
      }

      // Calculate target face (1-6 if onRolledValue, 2-6 otherwise)
      const baseFace = Math.floor(Math.random() * faceCount) + minFace

      // Ensure it's different from the current face
      const maxFace = minFace + faceCount - 1
      const targetFace = baseFace === currentFace ? (baseFace === maxFace ? minFace : baseFace + 1) : baseFace

      // Add 1-2 full spins for visual drama
      const extraSpins = Math.floor(Math.random() * 2) + 1

      setSpinCount((prev) => prev + extraSpins)
      setCurrentFace(targetFace)
      onRolledValue?.(targetFace)
      onRoll()

      // For click-only rolls (not throws), schedule completion callback after spring animation
      // Spring config is tension: 120, friction: 14, which settles in ~600-700ms
      if (!isFromThrow && onRollComplete) {
        rollCompleteTimeoutRef.current = setTimeout(() => {
          onRollComplete()
          rollCompleteTimeoutRef.current = undefined
        }, 700)
      }
    },
    [currentFace, onRoll, onRollComplete, onRolledValue, minFace, faceCount]
  )

  // Physics simulation for thrown dice - uses direct DOM manipulation for performance
  useEffect(() => {
    if (!isFlying) return

    const BASE_GRAVITY = 0.8 // Base pull toward origin
    const BASE_FRICTION = 0.94 // Base velocity dampening (slightly less friction for longer flight)
    const ROTATION_FACTOR = 0.5 // How much velocity affects rotation
    const STOP_THRESHOLD = 2 // Distance threshold to snap home
    const VELOCITY_THRESHOLD = 0.5 // Velocity threshold to snap home
    const CLOSE_RANGE = 40 // Distance at which extra damping kicks in
    const MAX_SCALE = 3 // Maximum scale when flying
    const SCALE_GROW_SPEED = 0.2 // How fast to grow (faster)
    const SCALE_SHRINK_SPEED = 0.06 // How fast to shrink when close (slower for drama)
    const BOUNCE_DAMPING = 0.7 // How much velocity is retained on bounce (0-1)
    const DICE_SIZE = size // Size of the dice in pixels

    // Calculate initial throw power to adjust gravity (stronger throws = weaker initial gravity)
    const initialSpeed = Math.sqrt(
      dicePhysics.current.vx * dicePhysics.current.vx +
        dicePhysics.current.vy * dicePhysics.current.vy
    )
    const throwPower = Math.min(initialSpeed / 20, 1) // 0-1 based on throw strength

    let frameCount = 0

    const animate = () => {
      const p = dicePhysics.current
      const el = portalDiceRef.current
      if (!el) {
        animationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      frameCount++

      // Calculate distance to origin
      const dist = Math.sqrt(p.x * p.x + p.y * p.y)

      // Gravity ramps up over time (weak at first for strong throws, then strengthens)
      const gravityRampUp = Math.min(frameCount / 30, 1) // Full gravity after ~0.5s
      const effectiveGravity = BASE_GRAVITY * (0.3 + 0.7 * gravityRampUp) * (1 - throwPower * 0.5)

      // Apply spring force toward origin (proportional to distance)
      if (dist > 0) {
        // Quadratic falloff for more natural feel
        const pullStrength = effectiveGravity * (dist / 50) ** 1.2
        p.vx += (-p.x / dist) * pullStrength
        p.vy += (-p.y / dist) * pullStrength
      }

      // Apply friction - extra damping when close to prevent oscillation
      const friction = dist < CLOSE_RANGE ? 0.88 : BASE_FRICTION
      p.vx *= friction
      p.vy *= friction

      // Update position
      p.x += p.vx
      p.y += p.vy

      // Viewport edge bounce - calculate absolute position and check bounds
      const scaledSize = DICE_SIZE * p.scale
      const absoluteX = diceOrigin.x + p.x
      const absoluteY = diceOrigin.y + p.y
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Left edge bounce
      if (absoluteX < 0) {
        p.x = -diceOrigin.x // Position at left edge
        p.vx = Math.abs(p.vx) * BOUNCE_DAMPING // Reverse and dampen
        // Add extra spin on bounce
        p.rotationZ += p.vx * 5
      }
      // Right edge bounce
      if (absoluteX + scaledSize > viewportWidth) {
        p.x = viewportWidth - diceOrigin.x - scaledSize
        p.vx = -Math.abs(p.vx) * BOUNCE_DAMPING
        p.rotationZ -= p.vx * 5
      }
      // Top edge bounce
      if (absoluteY < 0) {
        p.y = -diceOrigin.y
        p.vy = Math.abs(p.vy) * BOUNCE_DAMPING
        p.rotationZ += p.vy * 5
      }
      // Bottom edge bounce
      if (absoluteY + scaledSize > viewportHeight) {
        p.y = viewportHeight - diceOrigin.y - scaledSize
        p.vy = -Math.abs(p.vy) * BOUNCE_DAMPING
        p.rotationZ -= p.vy * 5
      }

      // Update rotation based on velocity (dice rolls as it moves)
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)

      // As dice gets closer to home, gradually lerp rotation toward final face
      // settleProgress: 0 = far away (full physics rotation), 1 = at home (target rotation)
      const SETTLE_START_DIST = 150 // Start settling rotation at this distance
      const settleProgress = Math.max(0, 1 - dist / SETTLE_START_DIST)
      const settleFactor = settleProgress * settleProgress * settleProgress // Cubic easing for smooth settle

      // Physics rotation (tumbling)
      const physicsRotationDelta = {
        x: p.vy * ROTATION_FACTOR * 12,
        y: -p.vx * ROTATION_FACTOR * 12,
        z: speed * ROTATION_FACTOR * 3,
      }

      // Apply physics rotation, but reduced as we settle
      p.rotationX += physicsRotationDelta.x * (1 - settleFactor)
      p.rotationY += physicsRotationDelta.y * (1 - settleFactor)
      p.rotationZ += physicsRotationDelta.z * (1 - settleFactor)

      // Lerp toward target face rotation as we settle
      // Target rotation should show the correct face (from DICE_FACE_ROTATIONS)
      const lerpSpeed = 0.08 * settleFactor // Faster lerp as we get closer
      if (settleFactor > 0.01) {
        // Normalize rotations to find shortest path to target
        const targetX = targetFaceRotation.rotateX
        const targetY = targetFaceRotation.rotateY
        const targetZ = 0 // Final Z rotation should be 0 (flat)

        // Normalize current rotation to -180 to 180 range for smooth interpolation
        const normalizeAngle = (angle: number) => {
          let normalized = angle % 360
          if (normalized > 180) normalized -= 360
          if (normalized < -180) normalized += 360
          return normalized
        }

        const currentX = normalizeAngle(p.rotationX)
        const currentY = normalizeAngle(p.rotationY)
        const currentZ = normalizeAngle(p.rotationZ)

        // Lerp each axis toward target
        p.rotationX = currentX + (targetX - currentX) * lerpSpeed
        p.rotationY = currentY + (targetY - currentY) * lerpSpeed
        p.rotationZ = currentZ + (targetZ - currentZ) * lerpSpeed
      }

      // Update scale - grow when far/fast, shrink when close/slow
      const targetScale =
        dist > CLOSE_RANGE ? MAX_SCALE : 1 + ((MAX_SCALE - 1) * dist) / CLOSE_RANGE
      if (p.scale < targetScale) {
        p.scale = Math.min(p.scale + SCALE_GROW_SPEED, targetScale)
      } else if (p.scale > targetScale) {
        p.scale = Math.max(p.scale - SCALE_SHRINK_SPEED, targetScale)
      }

      // Update DOM directly - no React re-renders
      // Scale from center, offset position to keep visual center stable
      const scaleOffset = ((p.scale - 1) * DICE_SIZE) / 2
      el.style.transform = `translate(${p.x - scaleOffset}px, ${p.y - scaleOffset}px) scale(${p.scale})`

      // Dynamic shadow based on scale (larger = higher = bigger shadow)
      const shadowSize = (p.scale - 1) * 10
      const shadowOpacity = Math.min((p.scale - 1) * 0.2, 0.4)
      el.style.filter =
        shadowSize > 0
          ? `drop-shadow(0 ${shadowSize}px ${shadowSize * 1.5}px rgba(0,0,0,${shadowOpacity}))`
          : 'none'

      // Update dice rotation
      const diceEl = el.querySelector('[data-dice-cube]') as HTMLElement | null
      if (diceEl) {
        diceEl.style.transform = `rotateX(${p.rotationX}deg) rotateY(${p.rotationY}deg) rotateZ(${p.rotationZ}deg)`
      }

      // Check if we should stop - snap to home when close, slow, small, AND rotation is settled
      const totalVelocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      const rotationSettled =
        Math.abs(p.rotationX - targetFaceRotation.rotateX) < 5 &&
        Math.abs(p.rotationY - targetFaceRotation.rotateY) < 5 &&
        Math.abs(p.rotationZ) < 5

      if (
        dist < STOP_THRESHOLD &&
        totalVelocity < VELOCITY_THRESHOLD &&
        p.scale < 1.1 &&
        rotationSettled
      ) {
        // Dice has returned home - clear shadow
        el.style.filter = 'none'
        setIsFlying(false)
        dicePhysics.current = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          rotationX: targetFaceRotation.rotateX,
          rotationY: targetFaceRotation.rotateY,
          rotationZ: 0,
          scale: 1,
        }
        // Notify that roll animation is complete
        onRollComplete?.()
        return
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [
    isFlying,
    diceOrigin.x,
    diceOrigin.y,
    targetFaceRotation.rotateX,
    targetFaceRotation.rotateY,
    size,
    onRollComplete,
  ])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (rollCompleteTimeoutRef.current) {
        clearTimeout(rollCompleteTimeoutRef.current)
      }
    }
  }, [])

  // Programmatic roll trigger — when rollTrigger increments, fire a roll
  const prevRollTrigger = useRef(rollTrigger ?? 0)
  useEffect(() => {
    if (rollTrigger !== undefined && rollTrigger !== prevRollTrigger.current && rollTrigger > 0) {
      prevRollTrigger.current = rollTrigger
      handleRoll()
    }
  }, [rollTrigger, handleRoll])

  // Compute dice rotation for react-spring animation (used when not flying)
  const diceRotation = {
    rotateX: spinCount * 360 + targetFaceRotation.rotateX,
    rotateY: spinCount * 360 + targetFaceRotation.rotateY,
    rotateZ: spinCount * 180, // Z rotation for extra tumble effect
  }

  // Dice drag handlers for the easter egg - drag dice off and release to roll
  const handleDicePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()

      // Cancel any ongoing physics animation
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setIsFlying(false)

      // Capture the pointer
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      // Get the dice container's position for portal rendering
      if (diceContainerRef.current) {
        const rect = diceContainerRef.current.getBoundingClientRect()
        setDiceOrigin({ x: rect.left, y: rect.top })
      }

      dragStartPos.current = { x: e.clientX, y: e.clientY }
      lastPointerPos.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      }
      velocitySamples.current = [] // Reset velocity tracking
      dicePhysics.current = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      }
      setIsDragging(true)
      // Notify that drag started - useful for prefetching
      onDragStart?.()
    },
    [disabled, onDragStart]
  )

  const handleDicePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.preventDefault()

      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y

      // Calculate drag velocity for live rotation
      const now = performance.now()
      const dt = Math.max(now - lastPointerPos.current.time, 8)
      const vx = (e.clientX - lastPointerPos.current.x) / dt
      const vy = (e.clientY - lastPointerPos.current.y) / dt

      // Update rotation based on drag velocity (dice tumbles while being dragged)
      const p = dicePhysics.current
      p.rotationX += vy * 8
      p.rotationY -= vx * 8
      p.rotationZ += Math.sqrt(vx * vx + vy * vy) * 2

      // Scale up slightly based on distance (feels like pulling it out)
      const dist = Math.sqrt(dx * dx + dy * dy)
      p.scale = 1 + Math.min(dist / 150, 0.5) // Max 1.5x during drag

      // Update DOM directly to avoid React re-renders during drag
      if (portalDiceRef.current) {
        const scaleOffset = ((p.scale - 1) * size) / 2
        portalDiceRef.current.style.transform = `translate(${dx - scaleOffset}px, ${dy - scaleOffset}px) scale(${p.scale})`
        // Add shadow that grows with distance
        const shadowSize = Math.min(dist / 10, 20)
        const shadowOpacity = Math.min(dist / 200, 0.4)
        portalDiceRef.current.style.filter = `drop-shadow(0 ${shadowSize}px ${shadowSize * 1.5}px rgba(0,0,0,${shadowOpacity}))`

        // Update dice rotation
        const diceEl = portalDiceRef.current.querySelector('[data-dice-cube]') as HTMLElement | null
        if (diceEl) {
          diceEl.style.transform = `rotateX(${p.rotationX}deg) rotateY(${p.rotationY}deg) rotateZ(${p.rotationZ}deg)`
        }
      }

      // Store position in ref for use when releasing
      p.x = dx
      p.y = dy

      // Track velocity samples for flick detection (keep last 5 samples, ~80ms window)
      velocitySamples.current.push({ vx, vy, time: now })
      if (velocitySamples.current.length > 5) {
        velocitySamples.current.shift()
      }

      // Track velocity for throw calculation
      lastPointerPos.current = { x: e.clientX, y: e.clientY, time: now }
    },
    [isDragging, size]
  )

  const handleDicePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.preventDefault()

      // Release the pointer
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Calculate throw velocity from velocity samples (average of recent samples for smooth flick)
      const samples = velocitySamples.current
      let vx = 0
      let vy = 0

      if (samples.length > 0) {
        // Weight recent samples more heavily
        let totalWeight = 0
        for (let i = 0; i < samples.length; i++) {
          const weight = i + 1 // Later samples get higher weight
          vx += samples[i].vx * weight
          vy += samples[i].vy * weight
          totalWeight += weight
        }
        vx /= totalWeight
        vy /= totalWeight
      }

      // Get position from physics ref (set during drag)
      const posX = dicePhysics.current.x
      const posY = dicePhysics.current.y

      // Calculate distance dragged
      const distance = Math.sqrt(posX ** 2 + posY ** 2)

      // Calculate flick speed
      const flickSpeed = Math.sqrt(vx * vx + vy * vy)

      // If dragged more than 20px OR flicked fast enough, trigger throw physics
      if (distance > 20 || flickSpeed > 0.3) {
        // Amplify throw velocity significantly for satisfying flick
        const throwMultiplier = 25 // Much stronger throw!

        // Initialize physics with current position and throw velocity
        dicePhysics.current = {
          x: posX,
          y: posY,
          vx: vx * throwMultiplier,
          vy: vy * throwMultiplier,
          rotationX: dicePhysics.current.rotationX, // Keep current rotation
          rotationY: dicePhysics.current.rotationY,
          rotationZ: dicePhysics.current.rotationZ,
          scale: dicePhysics.current.scale, // Keep current scale
        }
        setIsFlying(true)
        // Mark that we just threw - prevents click event from also firing handleRoll
        justThrewRef.current = true
        // Trigger roll when thrown (pass true to indicate physics will handle completion)
        handleRoll(true)
      } else {
        // Not thrown far enough, snap back
        dicePhysics.current = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
          scale: 1,
        }
      }

      setIsDragging(false)
    },
    [isDragging, handleRoll]
  )

  return (
    <>
      <button
        ref={diceButtonRef}
        type="button"
        data-action="roll-dice"
        onClick={(e) => {
          // Skip if we just did a throw (pointerup already called handleRoll)
          if (justThrewRef.current) {
            justThrewRef.current = false
            return
          }
          // Shift+click = instant roll (bypass animation)
          if (e.shiftKey && onInstantRoll) {
            onInstantRoll()
            return
          }
          handleRoll()
        }}
        onPointerDown={handleDicePointerDown}
        onPointerMove={handleDicePointerMove}
        onPointerUp={handleDicePointerUp}
        onPointerCancel={handleDicePointerUp}
        disabled={disabled}
        title={title}
        className={className}
        style={{
          cursor: isDragging ? 'grabbing' : disabled ? 'not-allowed' : 'grab',
          opacity: disabled ? 0.7 : 1,
          touchAction: 'none', // Prevent scroll on touch devices
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {/* Dice container - hidden when dragging/flying since we show portal version */}
        <div
          ref={diceContainerRef}
          style={{
            opacity: isDragging || isFlying ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          <DiceIcon
            rotateX={diceRotation.rotateX}
            rotateY={diceRotation.rotateY}
            rotateZ={diceRotation.rotateZ}
            isDark={isDark}
            size={size}
            colorScheme={colorScheme}
          />
        </div>
      </button>

      {/* Portal-rendered dice when dragging/flying - renders outside button to avoid clipping */}
      {/* All transforms are applied directly via ref for performance - no React re-renders */}
      {(isDragging || isFlying) &&
        createPortal(
          <div
            ref={portalDiceRef}
            style={{
              position: 'fixed',
              left: diceOrigin.x,
              top: diceOrigin.y,
              // Transform is updated directly via ref during drag/flying
              transform: 'translate(0px, 0px)',
              pointerEvents: 'none',
              zIndex: 100000,
              cursor: isDragging ? 'grabbing' : 'default',
              willChange: 'transform', // Hint to browser for GPU acceleration
            }}
          >
            {/* During flying, rotation is updated directly on data-dice-cube element */}
            <DiceIcon
              rotateX={diceRotation.rotateX}
              rotateY={diceRotation.rotateY}
              rotateZ={diceRotation.rotateZ}
              isDark={isDark}
              size={size}
              colorScheme={colorScheme}
            />
          </div>,
          document.body
        )}
    </>
  )
}
