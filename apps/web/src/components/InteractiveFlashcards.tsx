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
  const [rotation] = useState(card.initialRotation)
  const [zIndex, setZIndex] = useState(card.zIndex)
  const [isDragging, setIsDragging] = useState(false)

  // Track drag state
  const dragStartRef = useRef<{ x: number; y: number; cardX: number; cardY: number } | null>(null)

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setZIndex(1000) // Bring to front

    // Capture the pointer
    e.currentTarget.setPointerCapture(e.pointerId)

    // Record where the drag started (pointer position and card position)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: position.x,
      cardY: position.y,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return

    // Calculate how far the pointer has moved since drag started
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    // Update card position
    setPosition({
      x: dragStartRef.current.cardX + deltaX,
      y: dragStartRef.current.cardY + deltaY,
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    dragStartRef.current = null

    // Release the pointer capture
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div
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
        className={css({
          bg: 'white',
          rounded: 'lg',
          p: '4',
          boxShadow: isDragging
            ? '0 16px 48px rgba(0, 0, 0, 0.5)'
            : '0 8px 24px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          minW: '120px',
          border: '2px solid rgba(0, 0, 0, 0.1)',
          transition: 'box-shadow 0.2s',
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
