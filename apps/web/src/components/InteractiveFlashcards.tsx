'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useEffect, useRef, useState } from 'react'
import { css } from '../../styled-system/css'

interface Flashcard {
  id: number
  number: number
  initialX: number
  initialY: number
  initialRotation: number
  zIndex: number
}

/**
 * InteractiveFlashcards - A fun flashcard display where you can drag cards around
 * Cards stay where you drop them - simple and intuitive
 */
export function InteractiveFlashcards() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState<Flashcard[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    // Double rAF pattern - ensures layout is fully complete
    const frameId1 = requestAnimationFrame(() => {
      const frameId2 = requestAnimationFrame(() => {
        if (!containerRef.current) return

        const containerWidth = containerRef.current.offsetWidth
        const containerHeight = containerRef.current.offsetHeight

        // Only generate cards once we have proper dimensions
        if (containerWidth < 100 || containerHeight < 100) {
          return
        }

        const count = Math.floor(Math.random() * 8) + 8 // 8-15 cards
        const generated: Flashcard[] = []

        // Position cards within the actual container bounds
        const cardWidth = 120 // approximate card width
        const cardHeight = 200 // approximate card height

        for (let i = 0; i < count; i++) {
          const card = {
            id: i,
            number: Math.floor(Math.random() * 900) + 100, // 100-999
            initialX: Math.random() * (containerWidth - cardWidth - 40) + 20,
            initialY: Math.random() * (containerHeight - cardHeight - 40) + 20,
            initialRotation: Math.random() * 40 - 20, // -20 to 20 degrees
            zIndex: i,
          }
          generated.push(card)
        }

        setCards(generated)
      })
    })

    return () => {
      // Note: can't cancel nested rAF properly, but component cleanup will prevent state updates
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={css({
        position: 'relative',
        width: '100%',
        maxW: '1200px',
        mx: 'auto',
        height: { base: '400px', md: '500px' },
        overflow: 'visible',
        bg: 'rgba(0, 0, 0, 0.3)',
        rounded: 'xl',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      })}
    >
      {cards.map((card) => (
        <DraggableCard key={card.id} card={card} />
      ))}
    </div>
  )
}

interface DraggableCardProps {
  card: Flashcard
}

function DraggableCard({ card }: DraggableCardProps) {
  // Track position - starts at initial, updates when dragged
  const [position, setPosition] = useState({ x: card.initialX, y: card.initialY })
  const [rotation, setRotation] = useState(card.initialRotation) // Now dynamic!
  const [zIndex, setZIndex] = useState(card.zIndex)
  const [isDragging, setIsDragging] = useState(false)
  const [dragSpeed, setDragSpeed] = useState(0) // Speed for dynamic shadow

  // Track drag state
  const dragStartRef = useRef<{ x: number; y: number; cardX: number; cardY: number } | null>(null)
  const grabOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }) // Offset from card center where grabbed
  const baseRotationRef = useRef(card.initialRotation) // Starting rotation
  const lastMoveTimeRef = useRef<number>(0)
  const lastMovePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const lastLogTimeRef = useRef<number>(0) // Separate throttling for logging
  const cardRef = useRef<HTMLDivElement>(null) // Reference to card element

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setZIndex(1000) // Bring to front
    setDragSpeed(0)

    // Capture the pointer
    e.currentTarget.setPointerCapture(e.pointerId)

    // Record where the drag started (pointer position and card position)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: position.x,
      cardY: position.y,
    }

    // Calculate grab offset from card center
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const cardCenterX = rect.left + rect.width / 2
      const cardCenterY = rect.top + rect.height / 2
      grabOffsetRef.current = {
        x: e.clientX - cardCenterX,
        y: e.clientY - cardCenterY,
      }
      console.log(
        `[GrabPoint] Grabbed at offset: (${grabOffsetRef.current.x.toFixed(0)}, ${grabOffsetRef.current.y.toFixed(0)})px from center`
      )
    }

    // Store the current rotation as the base for this drag
    baseRotationRef.current = rotation

    // Initialize velocity tracking
    const now = Date.now()
    lastMoveTimeRef.current = now
    lastMovePositionRef.current = { x: e.clientX, y: e.clientY }
    lastLogTimeRef.current = now

    console.log('[Shadow] Drag started, speed reset to 0')
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return

    // Calculate how far the pointer has moved since drag started
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // Calculate velocity for dynamic shadow
    const now = Date.now()
    const timeDelta = now - lastMoveTimeRef.current

    if (timeDelta > 0) {
      // Distance moved since last frame
      const distX = e.clientX - lastMovePositionRef.current.x
      const distY = e.clientY - lastMovePositionRef.current.y
      const distance = Math.sqrt(distX * distX + distY * distY)

      // Speed in pixels per millisecond, then convert to reasonable scale
      const speed = distance / timeDelta
      const scaledSpeed = Math.min(speed * 100, 100) // Cap at 100 for reasonable shadow size

      setDragSpeed(scaledSpeed)

      // Log occasionally (every ~200ms) to avoid console spam
      const timeSinceLastLog = now - lastLogTimeRef.current
      if (timeSinceLastLog > 200) {
        console.log(
          `[Shadow] Speed: ${scaledSpeed.toFixed(1)}, distance: ${distance.toFixed(0)}px, timeDelta: ${timeDelta}ms`
        )
        lastLogTimeRef.current = now
      }

      lastMoveTimeRef.current = now
      lastMovePositionRef.current = { x: e.clientX, y: e.clientY }
    }

    // Calculate rotation based on grab point physics
    // Cross product of grab offset and drag direction determines rotation
    // If grabbed on left and dragged right → clockwise rotation
    // If grabbed on right and dragged left → counter-clockwise rotation
    const crossProduct = grabOffsetRef.current.x * deltaY - grabOffsetRef.current.y * deltaX
    const rotationInfluence = crossProduct / 5000 // Scale factor for reasonable rotation (adjust as needed)
    const newRotation = baseRotationRef.current + rotationInfluence

    // Clamp rotation to prevent excessive spinning
    const clampedRotation = Math.max(-45, Math.min(45, newRotation))
    setRotation(clampedRotation)

    // Update card position
    setPosition({
      x: dragStartRef.current.cardX + deltaX,
      y: dragStartRef.current.cardY + deltaY,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    dragStartRef.current = null

    console.log('[Shadow] Drag released, speed decaying to 0')
    console.log(
      `[GrabPoint] Final rotation: ${rotation.toFixed(1)}° (base was ${baseRotationRef.current.toFixed(1)}°)`
    )

    // Gradually decay speed back to 0 for smooth shadow transition
    const decayInterval = setInterval(() => {
      setDragSpeed((prev) => {
        const newSpeed = prev * 0.8 // Decay by 20% each frame
        if (newSpeed < 1) {
          clearInterval(decayInterval)
          return 0
        }
        return newSpeed
      })
    }, 50) // Update every 50ms

    // Release the pointer capture
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  // Calculate dynamic shadow based on drag speed
  // Base shadow: 0 8px 24px rgba(0, 0, 0, 0.3)
  // Fast drag: 0 32px 64px rgba(0, 0, 0, 0.6)
  const shadowY = 8 + (dragSpeed / 100) * 24 // 8px to 32px
  const shadowBlur = 24 + (dragSpeed / 100) * 40 // 24px to 64px
  const shadowOpacity = 0.3 + (dragSpeed / 100) * 0.3 // 0.3 to 0.6
  const boxShadow = `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})`

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${isDragging ? 1.05 : 1})`,
        zIndex,
        touchAction: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'transform 0.2s ease-out',
      }}
      className={css({
        userSelect: 'none',
      })}
    >
      <div
        style={{
          boxShadow, // Dynamic shadow based on drag speed
        }}
        className={css({
          bg: 'white',
          rounded: 'lg',
          p: '4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          minW: '120px',
          border: '2px solid rgba(0, 0, 0, 0.1)',
          transition: 'box-shadow 0.1s', // Quick transition for responsive feel
        })}
      >
        {/* Abacus visualization */}
        <div
          className={css({
            transform: 'scale(0.6)',
            transformOrigin: 'center',
          })}
        >
          <AbacusReact value={card.number} columns={3} beadShape="circle" />
        </div>

        {/* Number display */}
        <div
          className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'gray.800',
            fontFamily: 'mono',
          })}
        >
          {card.number}
        </div>
      </div>
    </div>
  )
}
