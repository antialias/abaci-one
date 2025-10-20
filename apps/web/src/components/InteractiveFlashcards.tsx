'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useDrag } from '@use-gesture/react'
import { useEffect, useState } from 'react'
import { animated, config, useSpring } from '@react-spring/web'
import { css } from '../../styled-system/css'

interface Flashcard {
  id: number
  number: number
  initialX: number
  initialY: number
  initialRotation: number
  zIndex: number
}

const CONTAINER_WIDTH = 800
const CONTAINER_HEIGHT = 500

/**
 * InteractiveFlashcards - A fun, physics-based flashcard display
 * Users can drag and throw flashcards around with realistic momentum
 */
export function InteractiveFlashcards() {
  // Generate 8-15 random flashcards (client-side only to avoid hydration errors)
  const [cards, setCards] = useState<Flashcard[]>([])

  useEffect(() => {
    const count = Math.floor(Math.random() * 8) + 8 // 8-15 cards
    const generated: Flashcard[] = []

    for (let i = 0; i < count; i++) {
      generated.push({
        id: i,
        number: Math.floor(Math.random() * 900) + 100, // 100-999
        initialX: Math.random() * (CONTAINER_WIDTH - 200) + 100,
        initialY: Math.random() * (CONTAINER_HEIGHT - 200) + 100,
        initialRotation: Math.random() * 40 - 20, // -20 to 20 degrees
        zIndex: i,
      })
    }

    setCards(generated)
  }, [])

  return (
    <div
      className={css({
        position: 'relative',
        width: '100%',
        height: { base: '400px', md: '500px' },
        overflow: 'hidden',
        bg: 'rgba(0, 0, 0, 0.3)',
        rounded: 'xl',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      })}
    >
      {/* Hint text */}
      <div
        className={css({
          position: 'absolute',
          top: '4',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'white',
          opacity: '0.6',
          fontSize: 'sm',
          fontWeight: 'medium',
          zIndex: 1000,
          pointerEvents: 'none',
        })}
      >
        Drag and throw the flashcards!
      </div>

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
  const [{ x, y, rotation, scale }, api] = useSpring(() => ({
    x: card.initialX,
    y: card.initialY,
    rotation: card.initialRotation,
    scale: 1,
    config: config.wobbly,
  }))

  const [zIndex, setZIndex] = useState(card.zIndex)

  const bind = useDrag(
    ({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy] }) => {
      // Bring card to front when dragging
      if (down) {
        setZIndex(1000)
      }

      api.start({
        x: down ? card.initialX + mx : card.initialX + mx + vx * 100 * dx,
        y: down ? card.initialY + my : card.initialY + my + vy * 100 * dy,
        scale: down ? 1.1 : 1,
        rotation: down ? card.initialRotation + mx / 20 : card.initialRotation + vx * 10,
        immediate: down,
        config: down ? config.stiff : config.wobbly,
      })

      // Update initial position after release for next drag
      if (!down) {
        card.initialX = card.initialX + mx + vx * 100 * dx
        card.initialY = card.initialY + my + vy * 100 * dy
        card.initialRotation = card.initialRotation + vx * 10
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
      {...bind()}
      style={{
        x,
        y,
        rotation,
        scale,
        zIndex,
        position: 'absolute',
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
