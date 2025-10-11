import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Passenger, Station } from '../../lib/gameTypes'
import type { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { usePassengerAnimations } from '../usePassengerAnimations'

describe('usePassengerAnimations', () => {
  let mockPathRef: React.RefObject<SVGPathElement>
  let mockTrackGenerator: RailroadTrackGenerator
  let mockStation1: Station
  let mockStation2: Station
  let mockPassenger1: Passenger
  let mockPassenger2: Passenger

  beforeEach(() => {
    // Create mock path element
    const mockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    mockPathRef = { current: mockPath }

    // Mock track generator
    mockTrackGenerator = {
      getTrainTransform: vi.fn((_path: SVGPathElement, position: number) => ({
        x: position * 10,
        y: 300,
        rotation: 0,
      })),
    } as unknown as RailroadTrackGenerator

    // Create mock stations
    mockStation1 = {
      id: 'station-1',
      name: 'Station 1',
      position: 20,
      icon: '🏭',
    }

    mockStation2 = {
      id: 'station-2',
      name: 'Station 2',
      position: 60,
      icon: '🏛️',
    }

    // Create mock passengers
    mockPassenger1 = {
      id: 'passenger-1',
      name: 'Passenger 1',
      avatar: '👨',
      originStationId: 'station-1',
      destinationStationId: 'station-2',
      isBoarded: false,
      isDelivered: false,
      isUrgent: false,
    }

    mockPassenger2 = {
      id: 'passenger-2',
      name: 'Passenger 2',
      avatar: '👩',
      originStationId: 'station-1',
      destinationStationId: 'station-2',
      isBoarded: false,
      isDelivered: false,
      isUrgent: true,
    }

    vi.clearAllMocks()
  })

  test('initializes with empty animation maps', () => {
    const { result } = renderHook(() =>
      usePassengerAnimations({
        passengers: [],
        stations: [mockStation1, mockStation2],
        stationPositions: [
          { x: 100, y: 300 },
          { x: 500, y: 300 },
        ],
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
      })
    )

    expect(result.current.boardingAnimations.size).toBe(0)
    expect(result.current.disembarkingAnimations.size).toBe(0)
  })

  test('creates boarding animation when passenger boards', () => {
    const { result, rerender } = renderHook(
      ({ passengers }) =>
        usePassengerAnimations({
          passengers,
          stations: [mockStation1, mockStation2],
          stationPositions: [
            { x: 100, y: 300 },
            { x: 500, y: 300 },
          ],
          trainPosition: 20,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
        }),
      {
        initialProps: {
          passengers: [mockPassenger1],
        },
      }
    )

    // Initially no boarding animations
    expect(result.current.boardingAnimations.size).toBe(0)

    // Passenger boards
    const boardedPassenger = { ...mockPassenger1, isBoarded: true }
    rerender({ passengers: [boardedPassenger] })

    // Should create boarding animation
    expect(result.current.boardingAnimations.size).toBe(1)
    expect(result.current.boardingAnimations.has('passenger-1')).toBe(true)

    const animation = result.current.boardingAnimations.get('passenger-1')
    expect(animation).toBeDefined()
    expect(animation?.passenger).toEqual(boardedPassenger)
    expect(animation?.fromX).toBe(100) // Station position
    expect(animation?.fromY).toBe(270) // Station position - 30
    expect(mockTrackGenerator.getTrainTransform).toHaveBeenCalled()
  })

  test('creates disembarking animation when passenger is delivered', () => {
    const boardedPassenger = { ...mockPassenger1, isBoarded: true }

    const { result, rerender } = renderHook(
      ({ passengers }) =>
        usePassengerAnimations({
          passengers,
          stations: [mockStation1, mockStation2],
          stationPositions: [
            { x: 100, y: 300 },
            { x: 500, y: 300 },
          ],
          trainPosition: 60,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
        }),
      {
        initialProps: {
          passengers: [boardedPassenger],
        },
      }
    )

    // Initially no disembarking animations
    expect(result.current.disembarkingAnimations.size).toBe(0)

    // Passenger is delivered
    const deliveredPassenger = { ...boardedPassenger, isDelivered: true }
    rerender({ passengers: [deliveredPassenger] })

    // Should create disembarking animation
    expect(result.current.disembarkingAnimations.size).toBe(1)
    expect(result.current.disembarkingAnimations.has('passenger-1')).toBe(true)

    const animation = result.current.disembarkingAnimations.get('passenger-1')
    expect(animation).toBeDefined()
    expect(animation?.passenger).toEqual(deliveredPassenger)
    expect(animation?.toX).toBe(500) // Destination station position
    expect(animation?.toY).toBe(270) // Station position - 30
  })

  test('handles multiple passengers boarding simultaneously', () => {
    const { result, rerender } = renderHook(
      ({ passengers }) =>
        usePassengerAnimations({
          passengers,
          stations: [mockStation1, mockStation2],
          stationPositions: [
            { x: 100, y: 300 },
            { x: 500, y: 300 },
          ],
          trainPosition: 20,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
        }),
      {
        initialProps: {
          passengers: [mockPassenger1, mockPassenger2],
        },
      }
    )

    // Both passengers board
    const boardedPassengers = [
      { ...mockPassenger1, isBoarded: true },
      { ...mockPassenger2, isBoarded: true },
    ]
    rerender({ passengers: boardedPassengers })

    // Should create boarding animations for both
    expect(result.current.boardingAnimations.size).toBe(2)
    expect(result.current.boardingAnimations.has('passenger-1')).toBe(true)
    expect(result.current.boardingAnimations.has('passenger-2')).toBe(true)
  })

  test('does not create animation if passenger already boarded in previous state', () => {
    const boardedPassenger = { ...mockPassenger1, isBoarded: true }

    const { result } = renderHook(() =>
      usePassengerAnimations({
        passengers: [boardedPassenger],
        stations: [mockStation1, mockStation2],
        stationPositions: [
          { x: 100, y: 300 },
          { x: 500, y: 300 },
        ],
        trainPosition: 20,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
      })
    )

    // No animation since passenger was already boarded
    expect(result.current.boardingAnimations.size).toBe(0)
  })

  test('returns empty animations when pathRef is null', () => {
    const nullPathRef: React.RefObject<SVGPathElement> = { current: null }

    const { result, rerender } = renderHook(
      ({ passengers }) =>
        usePassengerAnimations({
          passengers,
          stations: [mockStation1, mockStation2],
          stationPositions: [
            { x: 100, y: 300 },
            { x: 500, y: 300 },
          ],
          trainPosition: 20,
          trackGenerator: mockTrackGenerator,
          pathRef: nullPathRef,
        }),
      {
        initialProps: {
          passengers: [mockPassenger1],
        },
      }
    )

    // Passenger boards
    const boardedPassenger = { ...mockPassenger1, isBoarded: true }
    rerender({ passengers: [boardedPassenger] })

    // Should not create animation without path
    expect(result.current.boardingAnimations.size).toBe(0)
  })

  test('returns empty animations when stationPositions is empty', () => {
    const { result, rerender } = renderHook(
      ({ passengers }) =>
        usePassengerAnimations({
          passengers,
          stations: [mockStation1, mockStation2],
          stationPositions: [],
          trainPosition: 20,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
        }),
      {
        initialProps: {
          passengers: [mockPassenger1],
        },
      }
    )

    // Passenger boards
    const boardedPassenger = { ...mockPassenger1, isBoarded: true }
    rerender({ passengers: [boardedPassenger] })

    // Should not create animation without station positions
    expect(result.current.boardingAnimations.size).toBe(0)
  })
})
