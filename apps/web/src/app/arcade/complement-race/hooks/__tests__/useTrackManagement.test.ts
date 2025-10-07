import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Passenger, Station } from '../../lib/gameTypes'
import type { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { useTrackManagement } from '../useTrackManagement'

// Mock the landmarks module
vi.mock('../../lib/landmarks', () => ({
  generateLandmarks: vi.fn((_route: number) => [
    { emoji: '🌲', position: 30, offset: { x: 0, y: -50 }, size: 24 },
    { emoji: '🏔️', position: 70, offset: { x: 0, y: -80 }, size: 32 },
  ]),
}))

describe('useTrackManagement', () => {
  let mockPathRef: React.RefObject<SVGPathElement>
  let mockTrackGenerator: RailroadTrackGenerator
  let mockStations: Station[]
  let mockPassengers: Passenger[]

  beforeEach(() => {
    // Create mock path element
    const mockPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    mockPath.getTotalLength = vi.fn(() => 1000)
    mockPath.getPointAtLength = vi.fn((distance: number) => ({
      x: distance,
      y: 300,
      w: 1,
      z: 0,
      matrixTransform: () => new DOMPoint(),
      toJSON: () => ({ x: distance, y: 300, w: 1, z: 0 }),
    })) as any
    mockPathRef = { current: mockPath }

    // Mock track generator
    mockTrackGenerator = {
      generateTrack: vi.fn((route: number) => ({
        referencePath: `M 0 300 L ${route * 100} 300`,
        ballastPath: `M 0 300 L ${route * 100} 300`,
      })),
      generateTiesAndRails: vi.fn(() => ({
        ties: [
          { x1: 0, y1: 300, x2: 10, y2: 300 },
          { x1: 20, y1: 300, x2: 30, y2: 300 },
        ],
        leftRailPoints: ['0,295', '100,295'],
        rightRailPoints: ['0,305', '100,305'],
      })),
    } as unknown as RailroadTrackGenerator

    mockStations = [
      { id: 'station-1', name: 'Station 1', position: 20, icon: '🏭' },
      { id: 'station-2', name: 'Station 2', position: 60, icon: '🏛️' },
    ]

    mockPassengers = [
      {
        id: 'passenger-1',
        name: 'Passenger 1',
        avatar: '👨',
        originStationId: 'station-1',
        destinationStationId: 'station-2',
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ]

    vi.clearAllMocks()
  })

  test('initializes with null trackData', () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    // Track data should be generated
    expect(result.current.trackData).toBeDefined()
    expect(mockTrackGenerator.generateTrack).toHaveBeenCalledWith(1)
  })

  test('generates landmarks for current route', () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    expect(result.current.landmarks).toHaveLength(2)
    expect(result.current.landmarks[0].emoji).toBe('🌲')
    expect(result.current.landmarks[1].emoji).toBe('🏔️')
  })

  test('generates ties and rails when path is ready', () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    expect(result.current.tiesAndRails).toBeDefined()
    expect(result.current.tiesAndRails?.ties).toHaveLength(2)
  })

  test('calculates station positions along path', () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
        maxCars: 3,
        carSpacing: 7,
      })
    )

    expect(result.current.stationPositions).toHaveLength(2)
    // Station 1 at 20% of 1000 = 200
    expect(result.current.stationPositions[0].x).toBe(200)
    // Station 2 at 60% of 1000 = 600
    expect(result.current.stationPositions[1].x).toBe(600)
  })

  test('calculates landmark positions along path', () => {
    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: mockTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
      })
    )

    expect(result.current.landmarkPositions).toHaveLength(2)
    // First landmark at 30% + offset
    expect(result.current.landmarkPositions[0].x).toBe(300) // 30% of 1000
    expect(result.current.landmarkPositions[0].y).toBe(250) // 300 + (-50)
  })

  test('delays track update when changing routes mid-journey', () => {
    const { result, rerender } = renderHook(
      ({ route, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers: mockPassengers,
        }),
      {
        initialProps: { route: 1, position: 0 },
      }
    )

    const initialTrackData = result.current.trackData

    // Change route while train is mid-journey (position > 0)
    rerender({ route: 2, position: 50 })

    // Track should NOT update yet (pending)
    expect(result.current.trackData).toBe(initialTrackData)
    expect(mockTrackGenerator.generateTrack).toHaveBeenCalledWith(2)
  })

  test('applies pending track when train resets to beginning', () => {
    const { result, rerender } = renderHook(
      ({ route, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers: mockPassengers,
        }),
      {
        initialProps: { route: 1, position: 0 },
      }
    )

    // Change route while train is mid-journey
    rerender({ route: 2, position: 50 })
    const trackDataBeforeReset = result.current.trackData

    // Train resets to beginning (position < 0)
    rerender({ route: 2, position: -5 })

    // Track should now update
    expect(result.current.trackData).not.toBe(trackDataBeforeReset)
  })

  test('immediately applies new track when train is at start', () => {
    const { result, rerender } = renderHook(
      ({ route, position }) =>
        useTrackManagement({
          currentRoute: route,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers: mockPassengers,
        }),
      {
        initialProps: { route: 1, position: -5 },
      }
    )

    const initialTrackData = result.current.trackData

    // Change route while train is at start (position < 0)
    rerender({ route: 2, position: -5 })

    // Track should update immediately
    expect(result.current.trackData).not.toBe(initialTrackData)
  })

  test('delays passenger display update until all cars exit', () => {
    const newPassengers: Passenger[] = [
      {
        id: 'passenger-2',
        name: 'Passenger 2',
        avatar: '👩',
        originStationId: 'station-1',
        destinationStationId: 'station-2',
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ]

    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 5,
          carSpacing: 7,
        }),
      {
        initialProps: { passengers: mockPassengers, position: 50 },
      }
    )

    expect(result.current.displayPassengers).toBe(mockPassengers)

    // Change passengers while train is mid-journey
    // Locomotive at 100%, but last car at 100 - (5*7) = 65%
    rerender({ passengers: newPassengers, position: 100 })

    // Display passengers should NOT update yet (last car hasn't exited)
    expect(result.current.displayPassengers).toBe(mockPassengers)
  })

  test('does not update passenger display until train resets', () => {
    const newPassengers: Passenger[] = [
      {
        id: 'passenger-2',
        avatar: '👩',
        originStationId: 'station-1',
        destinationStationId: 'station-2',
        isBoarded: false,
        isDelivered: false,
        isUrgent: false,
      },
    ]

    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 5,
          carSpacing: 7,
        }),
      {
        initialProps: { passengers: mockPassengers, position: 50 },
      }
    )

    // Change passengers, locomotive at position where all cars have exited
    // Last car exits at position 97%, so locomotive at 132%
    rerender({ passengers: newPassengers, position: 132 })

    // Display passengers should NOT update yet (waiting for train reset)
    expect(result.current.displayPassengers).toBe(mockPassengers)

    // Now train resets to beginning
    rerender({ passengers: newPassengers, position: -5 })

    // Display passengers should update now (train reset)
    expect(result.current.displayPassengers).toBe(newPassengers)
  })

  test('updates passengers immediately during same route', () => {
    const updatedPassengers: Passenger[] = [{ ...mockPassengers[0], isBoarded: true }]

    const { result, rerender } = renderHook(
      ({ passengers, position }) =>
        useTrackManagement({
          currentRoute: 1,
          trainPosition: position,
          trackGenerator: mockTrackGenerator,
          pathRef: mockPathRef,
          stations: mockStations,
          passengers,
          maxCars: 5,
          carSpacing: 7,
        }),
      {
        initialProps: { passengers: mockPassengers, position: 50 },
      }
    )

    // Update passengers (boarding) during same route
    rerender({ passengers: updatedPassengers, position: 55 })

    // Display passengers should update immediately (same route, gameplay update)
    expect(result.current.displayPassengers).toBe(updatedPassengers)
  })

  test('returns null when no track data', () => {
    // Create a hook where trackGenerator returns null
    const nullTrackGenerator = {
      generateTrack: vi.fn(() => null),
    } as unknown as RailroadTrackGenerator

    const { result } = renderHook(() =>
      useTrackManagement({
        currentRoute: 1,
        trainPosition: 0,
        trackGenerator: nullTrackGenerator,
        pathRef: mockPathRef,
        stations: mockStations,
        passengers: mockPassengers,
      })
    )

    expect(result.current.trackData).toBeNull()
  })
})
