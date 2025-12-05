'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { animated, useSpring } from '@react-spring/web'
import { css } from '@styled/css'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { UploadWorksheetModal } from '@/components/worksheets/UploadWorksheetModal'
import { useTheme } from '@/contexts/ThemeContext'
import { extractConfigFields } from '../utils/extractConfigFields'
import { FloatingPageIndicator } from './FloatingPageIndicator'
import { LoadShareCodeModal } from './LoadShareCodeModal'
import { ShareModal } from './ShareModal'
import { useWorksheetConfig } from './WorksheetConfigContext'
import { WorksheetPreview } from './WorksheetPreview'
import { DuplicateWarningBanner } from './worksheet-preview/DuplicateWarningBanner'
import { WorksheetPreviewProvider } from './worksheet-preview/WorksheetPreviewContext'

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
}: {
  className?: string
  rotateX: number
  rotateY: number
  rotateZ: number
  isDark: boolean
}) {
  const size = 22
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
  const faceBackground = isDark ? '#818cf8' : '#4f46e5' // indigo-400 dark, indigo-600 light
  const faceBorder = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.5)'
  const dotColor = isDark ? '#1e1b4b' : 'white' // indigo-950 dots on light bg in dark mode

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
        <div style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${halfSize}px)` }}>
          {renderDots(6)}
        </div>
        {/* Right face (2) */}
        <div style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${halfSize}px)` }}>
          {renderDots(2)}
        </div>
        {/* Left face (5) */}
        <div style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${halfSize}px)` }}>
          {renderDots(5)}
        </div>
        {/* Top face (3) */}
        <div style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${halfSize}px)` }}>
          {renderDots(3)}
        </div>
        {/* Bottom face (4) */}
        <div style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${halfSize}px)` }}>
          {renderDots(4)}
        </div>
      </animated.div>
    </div>
  )
}

interface PreviewCenterProps {
  formState: WorksheetFormState
  initialPreview?: string[]
  onGenerate: () => Promise<void>
  status: 'idle' | 'generating' | 'success' | 'error'
  isReadOnly?: boolean
  onShare?: () => Promise<void>
  onEdit?: () => void
}

export function PreviewCenter({
  formState,
  initialPreview,
  onGenerate,
  status,
  isReadOnly = false,
  onShare,
  onEdit,
}: PreviewCenterProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { onChange } = useWorksheetConfig()
  const isDark = resolvedTheme === 'dark'
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isLoadShareModalOpen, setIsLoadShareModalOpen] = useState(false)
  const [isGeneratingShare, setIsGeneratingShare] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  // Dice rotation state for react-spring animation
  // We track cumulative spins to add visual flair, then compute final rotation
  // to land on the correct face derived from the seed
  const [spinCount, setSpinCount] = useState(0)
  // Track which face we're showing (for ensuring consecutive rolls differ)
  const [currentFace, setCurrentFace] = useState(() => ((formState.seed ?? 0) % 5) + 2)

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
  })
  const lastPointerPos = useRef({ x: 0, y: 0, time: 0 })
  const animationFrameRef = useRef<number>()

  // Ref to the portal dice element for direct DOM manipulation during drag/flying (avoids re-renders)
  const portalDiceRef = useRef<HTMLDivElement>(null)

  // Physics simulation for thrown dice - uses direct DOM manipulation for performance
  useEffect(() => {
    if (!isFlying) return

    const GRAVITY_STRENGTH = 1.2 // Pull toward origin (spring-like)
    const BASE_FRICTION = 0.92 // Base velocity dampening
    const ROTATION_FACTOR = 0.5 // How much velocity affects rotation
    const STOP_THRESHOLD = 2 // Distance threshold to snap home
    const VELOCITY_THRESHOLD = 0.5 // Velocity threshold to snap home
    const CLOSE_RANGE = 30 // Distance at which extra damping kicks in

    const animate = () => {
      const p = dicePhysics.current
      const el = portalDiceRef.current
      if (!el) {
        animationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      // Calculate distance to origin
      const dist = Math.sqrt(p.x * p.x + p.y * p.y)

      // Apply spring force toward origin (proportional to distance)
      if (dist > 0) {
        const springForce = GRAVITY_STRENGTH
        p.vx += (-p.x / dist) * springForce * (dist / 50) // Stronger when further
        p.vy += (-p.y / dist) * springForce * (dist / 50)
      }

      // Apply friction - extra damping when close to prevent oscillation
      const friction = dist < CLOSE_RANGE ? 0.85 : BASE_FRICTION
      p.vx *= friction
      p.vy *= friction

      // Update position
      p.x += p.vx
      p.y += p.vy

      // Update rotation based on velocity (dice rolls as it moves)
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      p.rotationX += p.vy * ROTATION_FACTOR * 10
      p.rotationY -= p.vx * ROTATION_FACTOR * 10
      p.rotationZ += speed * ROTATION_FACTOR * 2

      // Update DOM directly - no React re-renders
      el.style.transform = `translate(${p.x}px, ${p.y}px)`

      // Update dice rotation via CSS custom properties (the DiceIcon reads these)
      const diceEl = el.querySelector('[data-dice-cube]') as HTMLElement | null
      if (diceEl) {
        diceEl.style.transform = `rotateX(${p.rotationX}deg) rotateY(${p.rotationY}deg) rotateZ(${p.rotationZ}deg)`
      }

      // Check if we should stop - snap to home when close and slow
      const totalVelocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
      if (dist < STOP_THRESHOLD && totalVelocity < VELOCITY_THRESHOLD) {
        // Dice has returned home
        setIsFlying(false)
        dicePhysics.current = { x: 0, y: 0, vx: 0, vy: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
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
  }, [isFlying])

  // Compute target rotation: add dramatic spins, then land on the face rotation
  const targetFaceRotation = DICE_FACE_ROTATIONS[currentFace] || { rotateX: 0, rotateY: 0 }
  const diceRotation = {
    rotateX: spinCount * 360 + targetFaceRotation.rotateX,
    rotateY: spinCount * 360 + targetFaceRotation.rotateY,
    rotateZ: spinCount * 180, // Z rotation for extra tumble effect
  }
  const isGenerating = status === 'generating'
  const [pageData, setPageData] = useState<{
    currentPage: number
    totalPages: number
    jumpToPage: (pageIndex: number) => void
  } | null>(null)

  // Shuffle problems by generating a new random seed
  const handleShuffle = useCallback(() => {
    // Generate a new random seed (use modulo to keep it in 32-bit int range)
    const newSeed = Date.now() % 2147483647
    onChange({ seed: newSeed })

    // Calculate target face from seed (2-6, excluding 1 so it's clearly a dice)
    // baseFace is deterministic based on seed
    const baseFace = (newSeed % 5) + 2

    // Ensure it's different from the current face
    const targetFace = baseFace === currentFace ? (baseFace === 6 ? 2 : baseFace + 1) : baseFace

    // Add 1-2 full spins for visual drama
    const extraSpins = Math.floor(Math.random() * 2) + 1

    setSpinCount((prev) => prev + extraSpins)
    setCurrentFace(targetFace)
  }, [onChange, currentFace])

  // Dice drag handlers for the easter egg - drag dice off and release to roll
  const handleDicePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isGenerating) return
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
      lastPointerPos.current = { x: e.clientX, y: e.clientY, time: performance.now() }
      dicePhysics.current = { x: 0, y: 0, vx: 0, vy: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
      setIsDragging(true)
    },
    [isGenerating]
  )

  const handleDicePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.preventDefault()

      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y

      // Update DOM directly to avoid React re-renders during drag
      if (portalDiceRef.current) {
        portalDiceRef.current.style.transform = `translate(${dx}px, ${dy}px)`
      }

      // Store position in ref for use when releasing
      dicePhysics.current.x = dx
      dicePhysics.current.y = dy

      // Track velocity for throw calculation
      lastPointerPos.current = { x: e.clientX, y: e.clientY, time: performance.now() }
    },
    [isDragging]
  )

  const handleDicePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      e.preventDefault()

      // Release the pointer
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // Calculate throw velocity from recent movement
      const now = performance.now()
      const dt = Math.max(now - lastPointerPos.current.time, 16) // At least 1 frame
      const vx = ((e.clientX - lastPointerPos.current.x) / dt) * 16 // Normalize to ~60fps
      const vy = ((e.clientY - lastPointerPos.current.y) / dt) * 16

      // Get position from physics ref (set during drag)
      const posX = dicePhysics.current.x
      const posY = dicePhysics.current.y

      // Calculate distance dragged
      const distance = Math.sqrt(posX ** 2 + posY ** 2)

      // If dragged more than 20px, trigger throw physics
      if (distance > 20) {
        // Initialize physics with current position and throw velocity
        dicePhysics.current = {
          x: posX,
          y: posY,
          vx: vx * 1.5, // Amplify throw velocity
          vy: vy * 1.5,
          rotationX: 0,
          rotationY: 0,
          rotationZ: 0,
        }
        setIsFlying(true)
        // Trigger shuffle when thrown
        handleShuffle()
      } else {
        // Not thrown far enough, snap back
        dicePhysics.current = { x: 0, y: 0, vx: 0, vy: 0, rotationX: 0, rotationY: 0, rotationZ: 0 }
      }

      setIsDragging(false)
    },
    [isDragging, handleShuffle]
  )

  // Detect scrolling in the scroll container
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrolling(true)

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Set new timeout to hide after 1 second of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false)
      }, 1000)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Upload complete handler
  const handleUploadComplete = (attemptId: string) => {
    router.push(`/worksheets/attempts/${attemptId}`)
  }

  // Quick share - copy link to clipboard without showing modal
  const handleQuickShare = async () => {
    setIsGeneratingShare(true)
    setJustCopied(false)

    try {
      const response = await fetch('/api/worksheets/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksheetType: 'addition',
          config: extractConfigFields(formState),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create share link')
      }

      const data = await response.json()
      await navigator.clipboard.writeText(data.url)

      setJustCopied(true)
      setTimeout(() => setJustCopied(false), 2000)
    } catch (err) {
      console.error('Failed to create share link:', err)
      // TODO: Show error toast
    } finally {
      setIsGeneratingShare(false)
    }
  }

  return (
    <div
      data-component="preview-center"
      className={css({
        h: 'full',
        w: 'full',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        position: 'relative',
      })}
    >
      {/* Floating Action Button - Top Right */}
      <div
        data-component="floating-action-button"
        className={css({
          position: 'fixed',
          top: '24',
          right: '4',
          zIndex: 1000,
          display: 'flex',
          borderRadius: 'lg',
          overflow: 'hidden',
          shadow: 'lg',
          border: '2px solid',
          borderColor: 'brand.700',
        })}
      >
        {/* Main Action Button - Edit in read-only mode, Download in edit mode */}
        <button
          type="button"
          data-action={isReadOnly ? 'edit-worksheet' : 'download-pdf'}
          onClick={isReadOnly ? onEdit : onGenerate}
          disabled={isGenerating}
          className={css({
            px: '4',
            py: '2.5',
            bg: 'brand.600',
            color: 'white',
            fontSize: 'sm',
            fontWeight: 'bold',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            opacity: isGenerating ? '0.7' : '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            transition: 'all 0.2s',
            _hover: isGenerating
              ? {}
              : {
                  bg: 'brand.700',
                },
          })}
        >
          {isReadOnly ? (
            <>
              <span className={css({ fontSize: 'lg' })}>✏️</span>
              <span>Edit</span>
            </>
          ) : isGenerating ? (
            <>
              <div
                className={css({
                  w: '4',
                  h: '4',
                  border: '2px solid',
                  borderColor: 'white',
                  borderTopColor: 'transparent',
                  rounded: 'full',
                  animation: 'spin 1s linear infinite',
                })}
              />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span className={css({ fontSize: 'lg' })}>⬇️</span>
              <span>Download</span>
            </>
          )}
        </button>

        {/* Shuffle Button - only in edit mode (1/3 split secondary action) */}
        {/* Easter egg: drag the dice off and release to roll it back! */}
        {!isReadOnly && (
          <button
            ref={diceButtonRef}
            type="button"
            data-action="shuffle-problems"
            onClick={handleShuffle}
            onPointerDown={handleDicePointerDown}
            onPointerMove={handleDicePointerMove}
            onPointerUp={handleDicePointerUp}
            onPointerCancel={handleDicePointerUp}
            disabled={isGenerating}
            title="Shuffle problems (drag or click to roll)"
            className={css({
              px: '3',
              py: '2.5',
              bg: 'brand.600',
              color: 'white',
              cursor: isDragging ? 'grabbing' : isGenerating ? 'not-allowed' : 'grab',
              opacity: isGenerating ? '0.7' : '1',
              borderLeft: '1px solid',
              borderColor: 'brand.700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              touchAction: 'none', // Prevent scroll on touch devices
              userSelect: 'none',
              _hover: isGenerating
                ? {}
                : {
                    bg: 'brand.700',
                  },
            })}
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
              />
            </div>
          </button>
        )}

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
              />
            </div>,
            document.body
          )}

        {/* Dropdown Trigger */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              data-action="open-actions-dropdown"
              disabled={isGenerating}
              className={css({
                px: '2',
                bg: 'brand.600',
                color: 'white',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? '0.7' : '1',
                borderLeft: '1px solid',
                borderColor: 'brand.700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                _hover: isGenerating
                  ? {}
                  : {
                      bg: 'brand.700',
                    },
              })}
            >
              <span className={css({ fontSize: 'xs' })}>▼</span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={css({
                bg: 'white',
                borderRadius: 'lg',
                shadow: 'lg',
                border: '1px solid',
                borderColor: 'gray.200',
                overflow: 'hidden',
                minW: '160px',
                zIndex: 10000,
              })}
            >
              {/* Read-only mode shows Download and Share */}
              {isReadOnly ? (
                <>
                  <DropdownMenu.Item
                    data-action="download-worksheet"
                    onClick={onGenerate}
                    className={css({
                      px: '4',
                      py: '2.5',
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'gray.700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                      outline: 'none',
                      _hover: {
                        bg: 'blue.50',
                        color: 'blue.700',
                      },
                      _focus: {
                        bg: 'blue.50',
                        color: 'blue.700',
                      },
                    })}
                  >
                    <span className={css({ fontSize: 'lg' })}>⬇️</span>
                    <span>Download</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="share-worksheet"
                    asChild
                    className={css({
                      outline: 'none',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        w: 'full',
                      })}
                    >
                      {/* Main share button - opens QR modal */}
                      <button
                        onClick={onShare}
                        className={css({
                          flex: '1',
                          px: '4',
                          py: '2.5',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          color: 'gray.700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2',
                          outline: 'none',
                          bg: 'transparent',
                          border: 'none',
                          _hover: {
                            bg: 'blue.50',
                            color: 'blue.700',
                          },
                        })}
                      >
                        <span className={css({ fontSize: 'lg' })}>📱</span>
                        <span>Share</span>
                      </button>

                      {/* Copy shortcut */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickShare()
                        }}
                        disabled={isGeneratingShare}
                        className={css({
                          px: '3',
                          py: '2.5',
                          fontSize: 'lg',
                          color: justCopied ? 'green.700' : 'gray.600',
                          cursor: isGeneratingShare ? 'wait' : 'pointer',
                          bg: justCopied ? 'green.50' : 'transparent',
                          border: 'none',
                          borderLeft: '1px solid',
                          borderColor: 'gray.200',
                          outline: 'none',
                          opacity: isGeneratingShare ? '0.6' : '1',
                          transition: 'all 0.2s',
                          _hover:
                            isGeneratingShare || justCopied
                              ? {}
                              : {
                                  bg: 'green.50',
                                  color: 'green.700',
                                },
                        })}
                        title={justCopied ? 'Copied!' : 'Copy share link'}
                      >
                        {isGeneratingShare ? '⏳' : justCopied ? '✓' : '📋'}
                      </button>
                    </div>
                  </DropdownMenu.Item>
                </>
              ) : (
                <>
                  <DropdownMenu.Item
                    data-action="share-worksheet"
                    asChild
                    className={css({
                      outline: 'none',
                    })}
                  >
                    <div
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        w: 'full',
                      })}
                    >
                      {/* Main share button - opens QR modal */}
                      <button
                        onClick={() => setIsShareModalOpen(true)}
                        className={css({
                          flex: '1',
                          px: '4',
                          py: '2.5',
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          color: 'gray.700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2',
                          outline: 'none',
                          bg: 'transparent',
                          border: 'none',
                          _hover: {
                            bg: 'blue.50',
                            color: 'blue.700',
                          },
                        })}
                      >
                        <span className={css({ fontSize: 'lg' })}>📱</span>
                        <span>Share</span>
                      </button>

                      {/* Copy shortcut */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleQuickShare()
                        }}
                        disabled={isGeneratingShare}
                        className={css({
                          px: '3',
                          py: '2.5',
                          fontSize: 'lg',
                          color: justCopied ? 'green.700' : 'gray.600',
                          cursor: isGeneratingShare ? 'wait' : 'pointer',
                          bg: justCopied ? 'green.50' : 'transparent',
                          border: 'none',
                          borderLeft: '1px solid',
                          borderColor: 'gray.200',
                          outline: 'none',
                          opacity: isGeneratingShare ? '0.6' : '1',
                          transition: 'all 0.2s',
                          _hover:
                            isGeneratingShare || justCopied
                              ? {}
                              : {
                                  bg: 'green.50',
                                  color: 'green.700',
                                },
                        })}
                        title={justCopied ? 'Copied!' : 'Copy share link'}
                      >
                        {isGeneratingShare ? '⏳' : justCopied ? '✓' : '📋'}
                      </button>
                    </div>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="upload-worksheet"
                    onClick={() => setIsUploadModalOpen(true)}
                    className={css({
                      px: '4',
                      py: '2.5',
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'gray.700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                      outline: 'none',
                      _hover: {
                        bg: 'purple.50',
                        color: 'purple.700',
                      },
                      _focus: {
                        bg: 'purple.50',
                        color: 'purple.700',
                      },
                    })}
                  >
                    <span className={css({ fontSize: 'lg' })}>⬆️</span>
                    <span>Upload</span>
                  </DropdownMenu.Item>

                  <DropdownMenu.Item
                    data-action="load-share-code"
                    onClick={() => setIsLoadShareModalOpen(true)}
                    className={css({
                      px: '4',
                      py: '2.5',
                      fontSize: 'sm',
                      fontWeight: 'medium',
                      color: 'gray.700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                      outline: 'none',
                      _hover: {
                        bg: 'amber.50',
                        color: 'amber.700',
                      },
                      _focus: {
                        bg: 'amber.50',
                        color: 'amber.700',
                      },
                    })}
                  >
                    <span className={css({ fontSize: 'lg' })}>🔗</span>
                    <span>Load Share Code</span>
                  </DropdownMenu.Item>
                </>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Share Modal and Upload Modal (only shown in edit mode) */}
      {!isReadOnly && (
        <>
          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            worksheetType="addition"
            config={formState}
            isDark={isDark}
          />

          <UploadWorksheetModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploadComplete={handleUploadComplete}
          />

          <LoadShareCodeModal
            isOpen={isLoadShareModalOpen}
            onClose={() => setIsLoadShareModalOpen(false)}
            isDark={isDark}
          />
        </>
      )}

      {/* Floating elements - positioned absolutely relative to preview-center */}
      <WorksheetPreviewProvider formState={formState}>
        {/* Dismissable warning banner */}
        <DuplicateWarningBanner />

        {/* Floating page indicator */}
        {pageData && pageData.totalPages > 1 && (
          <FloatingPageIndicator
            currentPage={pageData.currentPage}
            totalPages={pageData.totalPages}
            onJumpToPage={pageData.jumpToPage}
            isScrolling={isScrolling}
          />
        )}
      </WorksheetPreviewProvider>

      <div
        ref={scrollContainerRef}
        className={css({
          flex: '1',
          w: 'full',
          minH: 'full',
          h: 'full',
          overflow: 'auto',
        })}
      >
        <WorksheetPreview
          formState={formState}
          initialData={initialPreview}
          isScrolling={isScrolling}
          onPageDataReady={setPageData}
        />
      </div>
    </div>
  )
}
