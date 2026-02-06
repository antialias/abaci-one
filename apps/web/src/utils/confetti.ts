/**
 * Confetti celebration utility
 *
 * Shared confetti function for celebrations throughout the app.
 * Originally from CelebrationProgressionBanner, extracted for reuse.
 */

import type { Shape } from 'canvas-confetti'
import confetti from 'canvas-confetti'

/**
 * Fire a multi-burst confetti celebration.
 * Duration: ~4 seconds total with bursts, fireworks, and star finale.
 */
export function fireConfettiCelebration(): void {
  const duration = 4000
  const animationEnd = Date.now() + duration
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 }

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  // Multiple bursts of confetti
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }

    const particleCount = 50 * (timeLeft / duration)

    // Confetti from left side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32'],
    })

    // Confetti from right side
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32'],
    })
  }, 250)

  // Initial big burst from center
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#FFD700', '#FFA500', '#FF6347'],
    zIndex: 10000,
  })

  // Fireworks effect - shooting stars
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: ['#FFD700', '#FFFF00', '#FFA500'],
      zIndex: 10000,
    })
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: ['#FFD700', '#FFFF00', '#FFA500'],
      zIndex: 10000,
    })
  }, 500)

  // More fireworks
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 90,
      spread: 100,
      origin: { x: 0.5, y: 0.9 },
      colors: ['#FF1493', '#FF69B4', '#FFB6C1', '#FF6347'],
      zIndex: 10000,
    })
  }, 1000)

  // Star burst finale
  setTimeout(() => {
    const shapes: Shape[] = ['star', 'circle']
    confetti({
      particleCount: 150,
      spread: 180,
      origin: { x: 0.5, y: 0.4 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#9370DB'],
      shapes,
      scalar: 1.2,
      zIndex: 10000,
    })
  }, 1500)
}
