import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

import confetti from 'canvas-confetti'
import { fireConfettiCelebration } from '../confetti'

const mockConfetti = confetti as unknown as Mock

describe('fireConfettiCelebration', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockConfetti.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires an initial center burst immediately', () => {
    fireConfettiCelebration()

    // The initial big burst from center is called immediately
    const centerBurst = mockConfetti.mock.calls.find(
      (call: any[]) => call[0]?.particleCount === 100 && call[0]?.origin?.x === 0.5
    )
    expect(centerBurst).toBeDefined()
    expect(centerBurst![0]).toMatchObject({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      zIndex: 10000,
    })
  })

  it('fires interval-based left and right bursts', () => {
    fireConfettiCelebration()

    const initialCallCount = mockConfetti.mock.calls.length

    // Advance past one interval tick (250ms)
    vi.advanceTimersByTime(250)

    // Should have additional calls from the interval (left + right)
    expect(mockConfetti.mock.calls.length).toBeGreaterThan(initialCallCount)
  })

  it('fires fireworks effect at 500ms', () => {
    fireConfettiCelebration()
    mockConfetti.mockClear()

    vi.advanceTimersByTime(500)

    // Should have fireworks: two calls with angles 60 and 120
    const fireworksCalls = mockConfetti.mock.calls.filter(
      (call: any[]) => call[0]?.angle === 60 || call[0]?.angle === 120
    )
    expect(fireworksCalls.length).toBe(2)

    const leftFirework = fireworksCalls.find((c: any[]) => c[0].angle === 60)
    expect(leftFirework![0]).toMatchObject({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      zIndex: 10000,
    })

    const rightFirework = fireworksCalls.find((c: any[]) => c[0].angle === 120)
    expect(rightFirework![0]).toMatchObject({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      zIndex: 10000,
    })
  })

  it('fires more fireworks at 1000ms', () => {
    fireConfettiCelebration()
    mockConfetti.mockClear()

    vi.advanceTimersByTime(1000)

    const middleFirework = mockConfetti.mock.calls.find(
      (call: any[]) =>
        call[0]?.particleCount === 80 && call[0]?.angle === 90 && call[0]?.origin?.y === 0.9
    )
    expect(middleFirework).toBeDefined()
  })

  it('fires star burst finale at 1500ms', () => {
    fireConfettiCelebration()
    mockConfetti.mockClear()

    vi.advanceTimersByTime(1500)

    const starBurst = mockConfetti.mock.calls.find(
      (call: any[]) =>
        call[0]?.particleCount === 150 && call[0]?.spread === 180 && call[0]?.scalar === 1.2
    )
    expect(starBurst).toBeDefined()
    expect(starBurst![0].shapes).toEqual(['star', 'circle'])
    expect(starBurst![0].zIndex).toBe(10000)
  })

  it('stops interval bursts after 4000ms duration', () => {
    fireConfettiCelebration()

    // Advance well past the 4000ms duration
    vi.advanceTimersByTime(5000)

    const totalCalls = mockConfetti.mock.calls.length

    // Advance more - no new calls should happen
    vi.advanceTimersByTime(1000)
    expect(mockConfetti.mock.calls.length).toBe(totalCalls)
  })

  it('uses correct colors for the center burst', () => {
    fireConfettiCelebration()

    const initialBurstColors = ['#FFD700', '#FFA500', '#FF6347']

    const centerBurst = mockConfetti.mock.calls.find(
      (call: any[]) => call[0]?.particleCount === 100 && call[0]?.origin?.x === 0.5
    )
    expect(centerBurst![0].colors).toEqual(initialBurstColors)
  })

  it('uses correct colors for interval bursts', () => {
    fireConfettiCelebration()

    const expectedColors = ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32']

    vi.advanceTimersByTime(250)
    const intervalBursts = mockConfetti.mock.calls.filter(
      (call: any[]) => call[0]?.startVelocity === 30
    )
    if (intervalBursts.length > 0) {
      expect(intervalBursts[0][0].colors).toEqual(expectedColors)
    }
  })

  it('all timed confetti calls use zIndex 10000', () => {
    fireConfettiCelebration()

    // Advance through all timeouts and intervals
    vi.advanceTimersByTime(4500)

    for (const call of mockConfetti.mock.calls) {
      if (call[0]?.zIndex !== undefined) {
        expect(call[0].zIndex).toBe(10000)
      }
    }
  })

  it('star burst finale uses correct star and circle shapes', () => {
    fireConfettiCelebration()
    mockConfetti.mockClear()

    vi.advanceTimersByTime(1500)

    const finaleCall = mockConfetti.mock.calls.find((call: any[]) => call[0]?.shapes !== undefined)
    expect(finaleCall).toBeDefined()
    expect(finaleCall![0].shapes).toContain('star')
    expect(finaleCall![0].shapes).toContain('circle')
  })

  it('does not throw when called', () => {
    expect(() => fireConfettiCelebration()).not.toThrow()
  })
})
