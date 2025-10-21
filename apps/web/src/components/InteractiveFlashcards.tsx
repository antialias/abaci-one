'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useDrag } from '@use-gesture/react'
import { useEffect, useRef, useState } from 'react'
import { animated, config, to, useSpring } from '@react-spring/web'
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
 * InteractiveFlashcards - A fun, physics-based flashcard display
 * Users can drag and throw flashcards around with realistic momentum
 */
export function InteractiveFlashcards() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Generate 8-15 random flashcards (client-side only to avoid hydration errors)
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
  // Track the card's current position in state (separate from the animation values)
  const currentPositionRef = useRef({
    x: card.initialX,
    y: card.initialY,
    rotation: card.initialRotation,
  })

  const [{ x, y, rotation, scale }, api] = useSpring(() => ({
    x: card.initialX,
    y: card.initialY,
    rotation: card.initialRotation,
    scale: 1,
    config: config.wobbly,
  }))

  const [zIndex, setZIndex] = useState(card.zIndex)
  const cardRef = useRef<HTMLDivElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const lastVelocityRef = useRef({ vx: 0, vy: 0 })
  const velocityHistoryRef = useRef<Array<{ vx: number; vy: number }>>([])
  const [transformOrigin, setTransformOrigin] = useState('center center')

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy], first, xy }) => {
      // Bring card to front when dragging
      if (down) {
        setZIndex(1000)

        // Calculate drag offset from card center on first touch
        if (first && cardRef.current) {
          const cardRect = cardRef.current.getBoundingClientRect()
          const cardWidth = cardRect.width
          const cardHeight = cardRect.height

          // xy is in viewport coordinates, convert to position relative to card
          const clickRelativeToCard = {
            x: xy[0] - cardRect.left,
            y: xy[1] - cardRect.top,
          }

          // Calculate offset from card center
          const cardCenterX = cardWidth / 2
          const cardCenterY = cardHeight / 2
          const offsetX = clickRelativeToCard.x - cardCenterX
          const offsetY = clickRelativeToCard.y - cardCenterY

          dragOffsetRef.current = { x: offsetX, y: offsetY }

          // Convert offset to transform-origin (50% + offset as percentage of card size)
          const originX = 50 + (offsetX / cardWidth) * 100
          const originY = 50 + (offsetY / cardHeight) * 100
          const transformOriginValue = `${originX}% ${originY}%`

          console.log(
            `Drag start: click at (${clickRelativeToCard.x.toFixed(0)}, ${clickRelativeToCard.y.toFixed(0)}) in card, offset from center: (${offsetX.toFixed(0)}, ${offsetY.toFixed(0)}), origin: ${transformOriginValue}`
          )

          setTransformOrigin(transformOriginValue)
          velocityHistoryRef.current = []
        }

        // Smooth velocity by averaging last 3 frames
        velocityHistoryRef.current.push({ vx, vy })
        if (velocityHistoryRef.current.length > 3) {
          velocityHistoryRef.current.shift()
        }

        const avgVx =
          velocityHistoryRef.current.reduce((sum, v) => sum + v.vx, 0) /
          velocityHistoryRef.current.length
        const avgVy =
          velocityHistoryRef.current.reduce((sum, v) => sum + v.vy, 0) /
          velocityHistoryRef.current.length

        // Calculate rotation based on smoothed velocity and drag offset
        const velocityAngle = Math.atan2(avgVy, avgVx) * (180 / Math.PI)
        const offsetAngle =
          Math.atan2(dragOffsetRef.current.y, dragOffsetRef.current.x) * (180 / Math.PI)

        // Card rotates to align with movement direction, offset by where we're grabbing
        const targetRotation = velocityAngle - offsetAngle + 90

        const speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy)

        // Store smoothed velocity for throw
        lastVelocityRef.current = { vx: avgVx, vy: avgVy }

        const finalRotation = speed > 0.01 ? targetRotation : currentPositionRef.current.rotation

        api.start({
          x: currentPositionRef.current.x + mx,
          y: currentPositionRef.current.y + my,
          scale: 1.1,
          rotation: finalRotation,
          immediate: (key) => key !== 'rotation', // Position immediate, rotation smooth
          config: { tension: 200, friction: 30 }, // Smoother rotation spring
        })
      } else {
        // On release, reset transform origin to center
        setTransformOrigin('center center')

        // Update current position to where the card was dropped
        currentPositionRef.current.x = currentPositionRef.current.x + mx
        currentPositionRef.current.y = currentPositionRef.current.y + my

        // First, snap the spring to the dropped position immediately
        api.set({
          x: currentPositionRef.current.x,
          y: currentPositionRef.current.y,
        })

        // On release, apply momentum with decay physics
        const throwVelocityX = lastVelocityRef.current.vx * 1000
        const throwVelocityY = lastVelocityRef.current.vy * 1000

        // Calculate final rotation based on throw direction
        const throwAngle = Math.atan2(throwVelocityY, throwVelocityX) * (180 / Math.PI)

        // Start position decay and rotation/scale animations
        api.start({
          x: {
            velocity: throwVelocityX,
            config: { decay: true },
          },
          y: {
            velocity: throwVelocityY,
            config: { decay: true },
          },
          scale: {
            value: 1,
            config: config.wobbly,
          },
          rotation: {
            value: throwAngle + 90, // Card aligns with throw direction
            config: config.wobbly,
          },
          onChange: (result) => {
            // Continue updating position as card settles with momentum
            if (result.value.x !== undefined) {
              currentPositionRef.current.x = result.value.x
            }
            if (result.value.y !== undefined) {
              currentPositionRef.current.y = result.value.y
            }
            if (result.value.rotation !== undefined) {
              currentPositionRef.current.rotation = result.value.rotation
            }
          },
        })
      }
    },
    {
      // Prevent scrolling when dragging
      preventDefault: true,
      filterTaps: true,
    }
  )

  return (
    <animated.div
      ref={cardRef}
      {...bind()}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: to(
          [x, y, rotation, scale],
          (x, y, r, s) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`
        ),
        transformOrigin,
        zIndex,
        touchAction: 'none',
        cursor: 'grab',
      }}
      className={css({
        userSelect: 'none',
        _active: {
          cursor: 'grabbing',
        },
      })}
    >
      <div
        className={css({
          bg: 'white',
          rounded: 'lg',
          p: '4',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          minW: '120px',
          border: '2px solid rgba(0, 0, 0, 0.1)',
          transition: 'box-shadow 0.2s',
          _hover: {
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          },
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
    </animated.div>
  )
}
