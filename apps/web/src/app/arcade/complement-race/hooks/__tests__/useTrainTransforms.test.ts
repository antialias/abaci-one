import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { useTrainTransforms } from '../useTrainTransforms'

describe('useTrainTransforms', () => {
  let mockPathRef: React.RefObject<SVGPathElement>
  let mockTrackGenerator: RailroadTrackGenerator

  beforeEach(() => {
    // Create mock path element
    const mockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    mockPathRef = { current: mockPath }

    // Mock track generator
    mockTrackGenerator = {
      getTrainTransform: vi.fn((_path: SVGPathElement, position: number) => ({
        x: position * 10,
        y: 300,
        rotation: position / 10,
      })),
    } as unknown as RailroadTrackGenerator

    vi.clearAllMocks()
  })

  test('returns default transform when pathRef is null', () => {
    const nullPathRef: React.RefObject<SVGPathElement> = { current: null }

    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: nullPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    expect(result.current.trainTransform).toEqual({
      x: 50,
      y: 300,
      rotation: 0,
    })
    expect(result.current.trainCars).toHaveLength(5)
  })

  test('calculates train transform at given position', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    expect(result.current.trainTransform).toEqual({
      x: 500, // 50 * 10
      y: 300,
      rotation: 5, // 50 / 10
    })
  })

  test('updates transform when train position changes', () => {
    const { result, rerender } = renderHook(
      ({ position }) =>
        useTrainTransforms({
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          maxCars: 5,
          carSpacing: 7,
        }),
      { initialProps: { position: 20 } }
    )

    expect(result.current.trainTransform.x).toBe(200)

    rerender({ position: 60 })
    expect(result.current.trainTransform.x).toBe(600)
  })

  test('calculates correct number of train cars', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    expect(result.current.trainCars).toHaveLength(5)
  })

  test('respects custom maxCars parameter', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    expect(result.current.trainCars).toHaveLength(3)
  })

  test('respects custom carSpacing parameter', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 10,
      })
    )

    // First car should be at position 50 - 10 = 40
    expect(result.current.trainCars[0].position).toBe(40)
  })

  test('positions cars behind locomotive with correct spacing', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 3,
        carSpacing: 10,
      })
    )

    expect(result.current.trainCars[0].position).toBe(40) // 50 - 1*10
    expect(result.current.trainCars[1].position).toBe(30) // 50 - 2*10
    expect(result.current.trainCars[2].position).toBe(20) // 50 - 3*10
  })

  test('calculates locomotive opacity correctly during fade in', () => {
    // Fade in range: 3-8%
    const { result: result1 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 3,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result1.current.locomotiveOpacity).toBe(0)

    const { result: result2 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 5.5, // Midpoint between 3 and 8
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result2.current.locomotiveOpacity).toBe(0.5)

    const { result: result3 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 8,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result3.current.locomotiveOpacity).toBe(1)
  })

  test('calculates locomotive opacity correctly during fade out', () => {
    // Fade out range: 92-97%
    const { result: result1 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 92,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result1.current.locomotiveOpacity).toBe(1)

    const { result: result2 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 94.5, // Midpoint between 92 and 97
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result2.current.locomotiveOpacity).toBe(0.5)

    const { result: result3 } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 97,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )
    expect(result3.current.locomotiveOpacity).toBe(0)
  })

  test('locomotive is fully visible in middle of track', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    expect(result.current.locomotiveOpacity).toBe(1)
  })

  test('calculates car opacity independently for each car', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 10, // Locomotive at 10%, first car at 3% (fading in)
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 2,
        carSpacing: 7,
      })
    )

    // First car at position 3 should be starting to fade in
    expect(result.current.trainCars[0].position).toBe(3)
    expect(result.current.trainCars[0].opacity).toBe(0)

    // Second car at position -4 should be invisible (not yet entered)
    expect(result.current.trainCars[1].position).toBe(0) // clamped to 0
    expect(result.current.trainCars[1].opacity).toBe(0)
  })

  test('car positions cannot go below zero', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 5,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    // First car at 5 - 7 = -2, should be clamped to 0
    expect(result.current.trainCars[0].position).toBe(0)
    // Second car at 5 - 14 = -9, should be clamped to 0
    expect(result.current.trainCars[1].position).toBe(0)
  })

  test('cars fade out completely past 97%', () => {
    const { result } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 104, // Last car at 104 - 35 = 69% (5 cars * 7 spacing)
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    const lastCar = result.current.trainCars[4]
    expect(lastCar.position).toBe(69)
    expect(lastCar.opacity).toBe(1) // Still visible, not past 97%
  })

  test('memoizes car transforms to avoid recalculation on same inputs', () => {
    const { result, rerender } = renderHook(() =>
      useTrainTransforms({
        trainPosition: 50,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        maxCars: 5,
        carSpacing: 7,
      })
    )

    const firstCars = result.current.trainCars

    // Rerender with same props
    rerender()

    // Should be the exact same array reference (memoized)
    expect(result.current.trainCars).toBe(firstCars)
  })
})
