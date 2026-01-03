/**
 * Unit tests for passenger boarding/delivery logic in useSteamJourney
 *
 * These tests ensure that:
 * 1. Passengers always board when an empty car reaches their origin station
 * 2. Passengers are never left behind
 * 3. Multiple passengers can board at the same station on different cars
 * 4. Passengers are delivered to the correct destination
 */

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ComplementRaceProvider, useComplementRace } from '../../context/ComplementRaceContext'
import type { Passenger, Station } from '../../lib/gameTypes'
import { useSteamJourney } from '../useSteamJourney'

// Mock sound effects
vi.mock('../useSoundEffects', () => ({
  useSoundEffects: () => ({
    playSound: vi.fn(),
  }),
}))

// Wrapper component
const wrapper = ({ children }: { children: ReactNode }) => (
  <ComplementRaceProvider initialStyle="sprint">{children}</ComplementRaceProvider>
)

// Helper to create test passengers
const createPassenger = (
  id: string,
  originStationId: string,
  destinationStationId: string,
  isBoarded = false,
  isDelivered = false
): Passenger => ({
  id,
  name: `Passenger ${id}`,
  avatar: '👤',
  originStationId,
  destinationStationId,
  isUrgent: false,
  isBoarded,
  isDelivered,
})

// Test stations
const _testStations: Station[] = [
  { id: 'station-0', name: 'Start', position: 0, icon: '🏁', emoji: '🏁' },
  { id: 'station-1', name: 'Middle', position: 50, icon: '🏢', emoji: '🏢' },
  { id: 'station-2', name: 'End', position: 100, icon: '🏁', emoji: '🏁' },
]

describe('useSteamJourney - Passenger Boarding', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  test('passenger boards when train reaches their origin station', () => {
    const { result } = renderHook(
      () => {
        const journey = useSteamJourney()
        const race = useComplementRace()
        return { journey, race }
      },
      { wrapper }
    )

    // Setup: Add passenger waiting at station-1 (position 50)
    const passenger = createPassenger('p1', 'station-1', 'station-2')

    act(() => {
      result.current.race.dispatch({ type: 'BEGIN_GAME' })
      result.current.race.dispatch({
        type: 'GENERATE_PASSENGERS',
        passengers: [passenger],
      })
      // Set train position just before station-1
      result.current.race.dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: 50,
        trainPosition: 40, // First car will be at ~33 (40 - 7)
        pressure: 75,
        elapsedTime: 1000,
      })
    })

    // Verify passenger is waiting
    expect(result.current.race.state.passengers[0].isBoarded).toBe(false)

    // Move train to station-1 position
    act(() => {
      result.current.race.dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: 50,
        trainPosition: 57, // First car at position 50 (57 - 7)
        pressure: 75,
        elapsedTime: 2000,
      })
    })

    // Advance timers to trigger the interval
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Verify passenger boarded
    const boardedPassenger = result.current.race.state.passengers.find((p) => p.id === 'p1')
    expect(boardedPassenger?.isBoarded).toBe(true)
  })

  test('multiple passengers can board at the same station on different cars', () => {
    const { result } = renderHook(
      () => {
        const journey = useSteamJourney()
        const race = useComplementRace()
        return { journey, race }
      },
      { wrapper }
    )

    // Setup: Three passengers waiting at station-1
    const passengers = [
      createPassenger('p1', 'station-1', 'station-2'),
      createPassenger('p2', 'station-1', 'station-2'),
      createPassenger('p3', 'station-1', 'station-2'),
    ]

    act(() => {
      result.current.race.dispatch({ type: 'BEGIN_GAME' })
      result.current.race.dispatch({
        type: 'GENERATE_PASSENGERS',
        passengers,
      })
      // Set train with 3 empty cars approaching station-1 (position 50)
      // Cars at: 50 (57-7), 43 (57-14), 36 (57-21)
      result.current.race.dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: 60,
        trainPosition: 57,
        pressure: 90,
        elapsedTime: 1000,
      })
    })

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // All three passengers should board (one per car)
    const boardedCount = result.current.race.state.passengers.filter((p) => p.isBoarded).length
    expect(boardedCount).toBe(3)
  })

  test('passenger is not left behind when train passes quickly', () => {
    const { result } = renderHook(
      () => {
        const journey = useSteamJourney()
        const race = useComplementRace()
        return { journey, race }
      },
      { wrapper }
    )

    const passenger = createPassenger('p1', 'station-1', 'station-2')

    act(() => {
      result.current.race.dispatch({ type: 'BEGIN_GAME' })
      result.current.race.dispatch({
        type: 'GENERATE_PASSENGERS',
        passengers: [passenger],
      })
    })

    // Simulate train passing through station quickly
    const positions = [40, 45, 50, 52, 54, 56, 58, 60, 65, 70]

    for (const pos of positions) {
      act(() => {
        result.current.race.dispatch({
          type: 'UPDATE_STEAM_JOURNEY',
          momentum: 80,
          trainPosition: pos,
          pressure: 120,
          elapsedTime: 1000 + pos * 50,
        })
        vi.advanceTimersByTime(50)
      })

      // Check if passenger boarded
      const boardedPassenger = result.current.race.state.passengers.find((p) => p.id === 'p1')
      if (boardedPassenger?.isBoarded) {
        // Success! Passenger boarded during the pass
        return
      }
    }

    // If we get here, passenger was left behind
    const boardedPassenger = result.current.race.state.passengers.find((p) => p.id === 'p1')
    expect(boardedPassenger?.isBoarded).toBe(true)
  })

  test('passenger boards on correct car based on availability', () => {
    const { result } = renderHook(
      () => {
        const journey = useSteamJourney()
        const race = useComplementRace()
        return { journey, race }
      },
      { wrapper }
    )

    // Setup: One passenger already on car 0, another waiting
    const passengers = [
      createPassenger('p1', 'station-0', 'station-2', true, false), // Already boarded on car 0
      createPassenger('p2', 'station-1', 'station-2'), // Waiting at station-1
    ]

    act(() => {
      result.current.race.dispatch({ type: 'BEGIN_GAME' })
      result.current.race.dispatch({
        type: 'GENERATE_PASSENGERS',
        passengers,
      })
      // Train at station-1, car 0 occupied, car 1 empty
      result.current.race.dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: 50,
        trainPosition: 57, // Car 0 at 50, Car 1 at 43
        pressure: 75,
        elapsedTime: 2000,
      })
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // p2 should board (on car 1 since car 0 is occupied)
    const p2 = result.current.race.state.passengers.find((p) => p.id === 'p2')
    expect(p2?.isBoarded).toBe(true)

    // p1 should still be boarded
    const p1 = result.current.race.state.passengers.find((p) => p.id === 'p1')
    expect(p1?.isBoarded).toBe(true)
    expect(p1?.isDelivered).toBe(false)
  })

  test('passenger is delivered when their car reaches destination', () => {
    const { result } = renderHook(
      () => {
        const journey = useSteamJourney()
        const race = useComplementRace()
        return { journey, race }
      },
      { wrapper }
    )

    // Setup: Passenger already boarded, heading to station-2 (position 100)
    const passenger = createPassenger('p1', 'station-0', 'station-2', true, false)

    act(() => {
      result.current.race.dispatch({ type: 'BEGIN_GAME' })
      result.current.race.dispatch({
        type: 'GENERATE_PASSENGERS',
        passengers: [passenger],
      })
      // Move train so car 0 reaches station-2
      result.current.race.dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: 50,
        trainPosition: 107, // Car 0 at position 100 (107 - 7)
        pressure: 75,
        elapsedTime: 5000,
      })
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Passenger should be delivered
    const deliveredPassenger = result.current.race.state.passengers.find((p) => p.id === 'p1')
    expect(deliveredPassenger?.isDelivered).toBe(true)
  })
})
