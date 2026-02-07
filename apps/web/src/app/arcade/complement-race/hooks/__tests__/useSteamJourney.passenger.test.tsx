/**
 * Unit tests for passenger boarding/delivery logic in useSteamJourney
 *
 * These tests ensure that:
 * 1. Passengers always board when an empty car reaches their origin station
 * 2. Passengers are never left behind
 * 3. Multiple passengers can board at the same station on different cars
 * 4. Passengers are delivered to the correct destination
 *
 * These tests directly simulate the boarding/delivery algorithm from useSteamJourney
 * rather than rendering the hook, because the hook expects the multiplayer Passenger
 * type (with claimedBy/deliveredBy/carIndex) while the local context reducer uses
 * a simpler Passenger type (with isBoarded/isDelivered).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock sound effects
vi.mock('../useSoundEffects', () => ({
  useSoundEffects: () => ({
    playSound: vi.fn(),
  }),
}))

// Extended Passenger type matching what useSteamJourney actually operates on
interface Passenger {
  id: string
  name: string
  avatar: string
  originStationId: string
  destinationStationId: string
  isUrgent: boolean
  claimedBy: string | null
  deliveredBy: string | null
  carIndex: number | null
}

interface Station {
  id: string
  name: string
  position: number
  icon: string
  emoji: string
}

// Helper to create test passengers (matching the multiplayer Passenger shape)
const createPassenger = (
  id: string,
  originStationId: string,
  destinationStationId: string,
  claimedBy: string | null = null,
  deliveredBy: string | null = null,
  carIndex: number | null = null
): Passenger => ({
  id,
  name: `Passenger ${id}`,
  avatar: '👤',
  originStationId,
  destinationStationId,
  isUrgent: false,
  claimedBy,
  deliveredBy,
  carIndex,
})

// Test stations
const testStations: Station[] = [
  { id: 'station-0', name: 'Start', position: 0, icon: '🏁', emoji: '🏁' },
  { id: 'station-1', name: 'Middle', position: 50, icon: '🏢', emoji: '🏢' },
  { id: 'station-2', name: 'End', position: 100, icon: '🏁', emoji: '🏁' },
]

const CAR_SPACING = 7

/**
 * Simulate the boarding logic from useSteamJourney.
 * This mirrors the algorithm in the hook's setInterval callback.
 */
function simulateBoardingAndDelivery(
  trainPosition: number,
  passengers: Passenger[],
  stations: Station[],
  maxCars: number
): Passenger[] {
  const updatedPassengers = passengers.map((p) => ({ ...p }))

  const currentBoardedPassengers = updatedPassengers.filter(
    (p) => p.claimedBy !== null && p.deliveredBy === null
  )

  // FIRST: Identify which passengers will be delivered
  const passengersToDeliver = new Set<string>()
  currentBoardedPassengers.forEach((passenger) => {
    if (passenger.deliveredBy !== null || passenger.carIndex === null) return

    const station = stations.find((s) => s.id === passenger.destinationStationId)
    if (!station) return

    const carPosition = Math.max(0, trainPosition - (passenger.carIndex + 1) * CAR_SPACING)
    const distance = Math.abs(carPosition - station.position)

    if (distance < 5) {
      passengersToDeliver.add(passenger.id)
    }
  })

  // Build occupied cars map (excluding passengers being delivered)
  const occupiedCars = new Map<number, Passenger>()
  currentBoardedPassengers.forEach((passenger) => {
    if (!passengersToDeliver.has(passenger.id) && passenger.carIndex !== null) {
      occupiedCars.set(passenger.carIndex, passenger)
    }
  })

  // PRIORITY 1: Process deliveries
  currentBoardedPassengers.forEach((passenger) => {
    if (passenger.deliveredBy !== null || passenger.carIndex === null) return

    const station = stations.find((s) => s.id === passenger.destinationStationId)
    if (!station) return

    const carPosition = Math.max(0, trainPosition - (passenger.carIndex + 1) * CAR_SPACING)
    const distance = Math.abs(carPosition - station.position)

    if (distance < 5) {
      const idx = updatedPassengers.findIndex((p) => p.id === passenger.id)
      if (idx !== -1) {
        updatedPassengers[idx] = { ...updatedPassengers[idx], deliveredBy: 'player' }
      }
    }
  })

  // Track which cars are assigned in THIS frame
  const carsAssignedThisFrame = new Set<number>()
  const passengersAssignedThisFrame = new Set<string>()

  // PRIORITY 2: Process boardings
  updatedPassengers.forEach((passenger, passengerIndex) => {
    if (passenger.claimedBy !== null || passenger.deliveredBy !== null) return
    if (passengersAssignedThisFrame.has(passenger.id)) return

    const station = stations.find((s) => s.id === passenger.originStationId)
    if (!station) return

    // Don't allow boarding if train has passed too far
    const STATION_CLOSURE_BUFFER = 10
    const lastCarOffset = maxCars * CAR_SPACING
    const stationClosureThreshold = lastCarOffset + STATION_CLOSURE_BUFFER

    if (trainPosition > station.position + stationClosureThreshold) return

    for (let carIndex = 0; carIndex < maxCars; carIndex++) {
      if (occupiedCars.has(carIndex) || carsAssignedThisFrame.has(carIndex)) continue

      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * CAR_SPACING)
      const distance = Math.abs(carPosition - station.position)

      if (distance < 5) {
        updatedPassengers[passengerIndex] = {
          ...updatedPassengers[passengerIndex],
          claimedBy: 'player',
          carIndex,
        }
        carsAssignedThisFrame.add(carIndex)
        passengersAssignedThisFrame.add(passenger.id)
        return // Board this passenger and move to next
      }
    }
  })

  return updatedPassengers
}

describe('useSteamJourney - Passenger Boarding', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  test('passenger boards when train reaches their origin station', () => {
    const passengers = [createPassenger('p1', 'station-1', 'station-2')]

    // Train at position 40: car 0 at 33, car 1 at 26, car 2 at 19
    // Station-1 is at position 50 - no car is close enough
    let result = simulateBoardingAndDelivery(40, passengers, testStations, 3)
    expect(result[0].claimedBy).toBe(null) // Not yet boarded

    // Train at position 57: car 0 at 50, car 1 at 43, car 2 at 36
    // Car 0 is at station-1 (position 50)
    result = simulateBoardingAndDelivery(57, passengers, testStations, 3)
    expect(result[0].claimedBy).toBe('player') // Boarded!
    expect(result[0].carIndex).toBe(0)
  })

  test('multiple passengers can board at the same station on different cars', () => {
    const passengers = [
      createPassenger('p1', 'station-1', 'station-2'),
      createPassenger('p2', 'station-1', 'station-2'),
      createPassenger('p3', 'station-1', 'station-2'),
    ]

    // Train at position 57: cars at 50, 43, 36
    // Only car 0 (position 50) is at station-1 (position 50)
    let result = simulateBoardingAndDelivery(57, passengers, testStations, 3)
    const boardedCount1 = result.filter((p) => p.claimedBy !== null).length
    expect(boardedCount1).toBe(1) // Only car 0 at station

    // Advance train: position 64: cars at 57, 50, 43
    // Car 1 (position 50) now at station-1
    result = simulateBoardingAndDelivery(64, result, testStations, 3)
    const boardedCount2 = result.filter((p) => p.claimedBy !== null).length
    expect(boardedCount2).toBe(2)

    // Advance train: position 71: cars at 64, 57, 50
    // Car 2 (position 50) now at station-1
    result = simulateBoardingAndDelivery(71, result, testStations, 3)
    const boardedCount3 = result.filter((p) => p.claimedBy !== null).length
    expect(boardedCount3).toBe(3) // All three boarded!
  })

  test('passenger is not left behind when train passes quickly', () => {
    const passengers = [createPassenger('p1', 'station-1', 'station-2')]

    // Simulate train passing through station-1 (position 50) quickly
    // Each frame position changes by a few percent
    const positions = [40, 45, 50, 52, 54, 56, 58, 60, 65, 70]

    let result = passengers
    for (const pos of positions) {
      result = simulateBoardingAndDelivery(pos, result, testStations, 3)
      if (result[0].claimedBy !== null) {
        // Success! Passenger boarded during the pass
        break
      }
    }

    expect(result[0].claimedBy).toBe('player')
  })

  test('passenger boards on correct car based on availability', () => {
    // p1 already boarded on car 0, p2 waiting at station-1
    const passengers = [
      createPassenger('p1', 'station-0', 'station-2', 'player', null, 0), // Already on car 0
      createPassenger('p2', 'station-1', 'station-2'), // Waiting at station-1
    ]

    // Train at position 57: car 0 at 50 (occupied by p1), car 1 at 43, car 2 at 36
    // Car 0 is at station-1 but occupied. No empty car at station yet.
    let result = simulateBoardingAndDelivery(57, passengers, testStations, 3)
    // p2 might not board yet since car 0 is occupied and car 1 is at 43 (not close to 50)
    // Let's advance to when car 1 reaches station-1
    // Car 1 at position 50 when trainPosition = 64
    result = simulateBoardingAndDelivery(64, result, testStations, 3)

    const p2 = result.find((p) => p.id === 'p2')
    expect(p2?.claimedBy).toBe('player')
    expect(p2?.carIndex).toBe(1) // Boarded on car 1 since car 0 is occupied

    const p1 = result.find((p) => p.id === 'p1')
    expect(p1?.claimedBy).toBe('player')
    expect(p1?.deliveredBy).toBe(null) // Not yet delivered
  })

  test('passenger is delivered when their car reaches destination', () => {
    // Passenger already boarded on car 0, heading to station-2 (position 100)
    const passengers = [createPassenger('p1', 'station-0', 'station-2', 'player', null, 0)]

    // Train at position 107: car 0 at 100 (station-2 position)
    const result = simulateBoardingAndDelivery(107, passengers, testStations, 3)

    const deliveredPassenger = result.find((p) => p.id === 'p1')
    expect(deliveredPassenger?.deliveredBy).toBe('player')
  })
})
