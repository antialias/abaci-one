/**
 * Confetti Component
 *
 * CSS-animated confetti particles for celebration effects.
 * Uses pure CSS animations for performance - no canvas or heavy libraries.
 */

import { css } from '@styled/css'
import { useEffect, useMemo, useState } from 'react'
import type { CelebrationType } from '../Provider'
import { CONFETTI_CONFIG, CELEBRATION_TIMING } from '../utils/celebration'

interface ConfettiProps {
  type: CelebrationType
  origin: { x: number; y: number }
  onComplete: () => void
}

interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  angle: number // Direction in degrees
  distance: number // How far to travel
  rotation: number // Initial rotation
  rotationSpeed: number // Rotation during animation
  delay: number // Stagger start
}

// Generate random particles based on config
function generateParticles(type: CelebrationType, origin: { x: number; y: number }): Particle[] {
  const config = CONFETTI_CONFIG[type]
  const particles: Particle[] = []

  for (let i = 0; i < config.count; i++) {
    // Random angle within spread, centered upward (-90 deg)
    const spreadRad = (config.spread * Math.PI) / 180
    const baseAngle = -Math.PI / 2 // Upward
    const angle = baseAngle + (Math.random() - 0.5) * spreadRad

    particles.push({
      id: i,
      x: origin.x,
      y: origin.y,
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      size: 6 + Math.random() * 6, // 6-12px
      angle: (angle * 180) / Math.PI,
      distance: 80 + Math.random() * 120, // 80-200px
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 720, // -360 to +360 deg
      delay: Math.random() * 50, // 0-50ms stagger
    })
  }

  return particles
}

export function Confetti({ type, origin, onComplete }: ConfettiProps) {
  const [isComplete, setIsComplete] = useState(false)
  const particles = useMemo(() => generateParticles(type, origin), [type, origin])
  const timing = CELEBRATION_TIMING[type]

  // Call onComplete when animation finishes
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsComplete(true)
      onComplete()
    }, timing.confettiDuration)

    return () => clearTimeout(timer)
  }, [timing.confettiDuration, onComplete])

  if (isComplete) return null

  return (
    <div
      data-component="confetti"
      className={css({
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        overflow: 'hidden',
      })}
    >
      <style>
        {`
          @keyframes confettiFallback {
            0% {
              transform: translateY(0) rotate(0deg) scale(1);
              opacity: 1;
            }
            40% {
              transform: translateY(-80px) rotate(180deg) scale(1);
              opacity: 1;
            }
            100% {
              transform: translateY(30px) rotate(360deg) scale(0.3);
              opacity: 0;
            }
          }
        `}
      </style>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={css({
            position: 'absolute',
            borderRadius: '2px',
          })}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size * 0.6,
            backgroundColor: particle.color,
            animation: `confettiFallback ${timing.confettiDuration}ms ease-out forwards`,
            animationDelay: `${particle.delay}ms`,
            transform: `rotate(${particle.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

// Alternative implementation with proper burst effect
export function ConfettiBurst({ type, origin, onComplete }: ConfettiProps) {
  const [isComplete, setIsComplete] = useState(false)
  const particles = useMemo(() => generateParticles(type, origin), [type, origin])
  const timing = CELEBRATION_TIMING[type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsComplete(true)
      onComplete()
    }, timing.confettiDuration)

    return () => clearTimeout(timer)
  }, [timing.confettiDuration, onComplete])

  if (isComplete) return null

  return (
    <div
      data-component="confetti-burst"
      className={css({
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10000,
        overflow: 'hidden',
      })}
    >
      <style>
        {`
          @keyframes confettiMotion {
            0% {
              transform: translate(0, 0) rotate(0deg) scale(1);
              opacity: 1;
            }
            50% {
              opacity: 1;
            }
            100% {
              transform: translate(var(--offset-x), calc(var(--offset-y) + 60px)) rotate(360deg) scale(0.3);
              opacity: 0;
            }
          }
        `}
      </style>
      {particles.map((particle) => {
        const offsetX = Math.cos((particle.angle * Math.PI) / 180) * particle.distance
        const offsetY = Math.sin((particle.angle * Math.PI) / 180) * particle.distance

        return (
          <div
            key={particle.id}
            className={css({
              position: 'absolute',
              borderRadius: '2px',
            })}
            style={
              {
                left: particle.x,
                top: particle.y,
                width: particle.size,
                height: particle.size * 0.6,
                backgroundColor: particle.color,
                '--offset-x': `${offsetX}px`,
                '--offset-y': `${offsetY}px`,
                animation: `confettiMotion ${timing.confettiDuration}ms ease-out ${particle.delay}ms forwards`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
