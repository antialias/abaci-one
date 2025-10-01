import { useEffect, useRef, useMemo } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { generatePassengers, calculateMaxConcurrentPassengers } from '../lib/passengerGenerator'
import { useSoundEffects } from './useSoundEffects'

/**
 * Steam Sprint momentum system (Infinite Mode)
 *
 * Momentum mechanics:
 * - Each correct answer adds momentum (builds up steam pressure)
 * - Momentum decays over time based on skill level
 * - Train automatically advances to next route upon completion
 * - Game continues indefinitely until player quits
 * - Time-of-day cycle repeats every 60 seconds
 *
 * Skill level decay rates (momentum lost per second):
 * - Preschool: 2.0/s (very slow decay)
 * - Kindergarten: 3.5/s
 * - Relaxed: 5.0/s
 * - Slow: 7.0/s
 * - Normal: 9.0/s
 * - Fast: 11.0/s
 * - Expert: 13.0/s (rapid decay)
 */

const MOMENTUM_DECAY_RATES = {
  preschool: 2.0,
  kindergarten: 3.5,
  relaxed: 5.0,
  slow: 7.0,
  normal: 9.0,
  fast: 11.0,
  expert: 13.0
}

const MOMENTUM_GAIN_PER_CORRECT = 15 // Momentum added for each correct answer
const SPEED_MULTIPLIER = 0.15 // Convert momentum to speed (% per second at momentum=100)
const UPDATE_INTERVAL = 50 // Update every 50ms (~20 fps)
const GAME_DURATION = 60000 // 60 seconds in milliseconds

export function useSteamJourney() {
  const { state, dispatch } = useComplementRace()
  const { playSound } = useSoundEffects()
  const gameStartTimeRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)
  const routeExitThresholdRef = useRef<number>(107) // Default for 1 car: 100 + 7

  // Initialize game start time and generate initial passengers
  useEffect(() => {
    if (state.isGameActive && state.style === 'sprint' && gameStartTimeRef.current === 0) {
      gameStartTimeRef.current = Date.now()
      lastUpdateRef.current = Date.now()

      // Generate initial passengers if none exist
      if (state.passengers.length === 0) {
        const newPassengers = generatePassengers(state.stations)
        dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })

        // Calculate and store exit threshold for this route
        const CAR_SPACING = 7
        const maxPassengers = calculateMaxConcurrentPassengers(newPassengers, state.stations)
        const maxCars = Math.max(1, maxPassengers)
        routeExitThresholdRef.current = 100 + (maxCars * CAR_SPACING)
      }
    }
  }, [state.isGameActive, state.style, state.stations, state.passengers.length, dispatch])

  // Momentum decay and position update loop
  useEffect(() => {
    if (!state.isGameActive || state.style !== 'sprint') return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - gameStartTimeRef.current
      const deltaTime = now - lastUpdateRef.current
      lastUpdateRef.current = now

      // Steam Sprint is infinite - no time limit

      // Get decay rate based on timeout setting (skill level)
      const decayRate = MOMENTUM_DECAY_RATES[state.timeoutSetting] || MOMENTUM_DECAY_RATES.normal

      // Calculate momentum decay for this frame
      const momentumLoss = (decayRate * deltaTime) / 1000

      // Update momentum (don't go below 0)
      const newMomentum = Math.max(0, state.momentum - momentumLoss)

      // Calculate speed from momentum (% per second)
      const speed = newMomentum * SPEED_MULTIPLIER

      // Update train position (accumulate, never go backward)
      // Allow position to go past 100% so entire train (including cars) can exit tunnel
      const positionDelta = (speed * deltaTime) / 1000
      const trainPosition = state.trainPosition + positionDelta

      // Calculate pressure (0-150 PSI) - based on momentum as percentage of max
      const maxMomentum = 100 // Theoretical max momentum
      const pressure = Math.min(150, (newMomentum / maxMomentum) * 150)

      // Update state
      dispatch({
        type: 'UPDATE_STEAM_JOURNEY',
        momentum: newMomentum,
        trainPosition,
        pressure,
        elapsedTime: elapsed
      })

      // Check for passengers that should board
      // Passengers board when an EMPTY car reaches their station
      const CAR_SPACING = 7 // Must match SteamTrainJourney component
      const maxPassengers = calculateMaxConcurrentPassengers(state.passengers, state.stations)
      const maxCars = Math.max(1, maxPassengers)
      const currentBoardedPassengers = state.passengers.filter(p => p.isBoarded && !p.isDelivered)

      // FIRST: Identify which passengers will be delivered in this frame
      const passengersToDeliver = new Set<string>()
      currentBoardedPassengers.forEach((passenger, carIndex) => {
        if (!passenger || passenger.isDelivered) return

        const station = state.stations.find(s => s.id === passenger.destinationStationId)
        if (!station) return

        // Calculate this passenger's car position
        const carPosition = Math.max(0, trainPosition - (carIndex + 1) * CAR_SPACING)
        const distance = Math.abs(carPosition - station.position)

        // If this car is at the destination station (within 5% tolerance), mark for delivery
        if (distance < 5) {
          passengersToDeliver.add(passenger.id)
        }
      })

      // Build a map of which cars are occupied (excluding passengers being delivered this frame)
      const occupiedCars = new Map<number, typeof currentBoardedPassengers[0]>()
      currentBoardedPassengers.forEach((passenger, arrayIndex) => {
        // Don't count a car as occupied if its passenger is being delivered this frame
        if (!passengersToDeliver.has(passenger.id)) {
          occupiedCars.set(arrayIndex, passenger)
        }
      })

      // Track which cars are assigned in THIS frame to prevent double-boarding
      const carsAssignedThisFrame = new Set<number>()

      // Find waiting passengers whose origin station has an empty car nearby
      state.passengers.forEach(passenger => {
        if (passenger.isBoarded || passenger.isDelivered) return

        const station = state.stations.find(s => s.id === passenger.originStationId)
        if (!station) return

        // Check if any empty car is at this station
        // Cars are at positions: trainPosition - 7, trainPosition - 14, etc.
        for (let carIndex = 0; carIndex < maxCars; carIndex++) {
          // Skip if this car already has a passenger OR was assigned this frame
          if (occupiedCars.has(carIndex) || carsAssignedThisFrame.has(carIndex)) continue

          const carPosition = Math.max(0, trainPosition - (carIndex + 1) * CAR_SPACING)
          const distance = Math.abs(carPosition - station.position)

          // If car is at or near station (within 5% tolerance for fast trains), board this passenger
          // Increased tolerance to ensure fast-moving trains don't miss passengers
          if (distance < 5) {
            dispatch({
              type: 'BOARD_PASSENGER',
              passengerId: passenger.id
            })
            // Mark this car as assigned in this frame
            carsAssignedThisFrame.add(carIndex)
            return // Board this passenger and move on
          }
        }
      })

      // Check for deliverable passengers
      // Passengers disembark when THEIR car reaches their destination
      currentBoardedPassengers.forEach((passenger, carIndex) => {
        if (!passenger || passenger.isDelivered) return

        const station = state.stations.find(s => s.id === passenger.destinationStationId)
        if (!station) return

        // Calculate this passenger's car position
        const carPosition = Math.max(0, trainPosition - (carIndex + 1) * CAR_SPACING)
        const distance = Math.abs(carPosition - station.position)

        // If this car is at the destination station (within 5% tolerance), deliver
        if (distance < 5) {
          const points = passenger.isUrgent ? 20 : 10
          dispatch({
            type: 'DELIVER_PASSENGER',
            passengerId: passenger.id,
            points
          })
        }
      })

      // Check for route completion (entire train exits tunnel)
      // Use stored threshold (stable for entire route)
      const ENTIRE_TRAIN_EXIT_THRESHOLD = routeExitThresholdRef.current

      if (trainPosition >= ENTIRE_TRAIN_EXIT_THRESHOLD && state.trainPosition < ENTIRE_TRAIN_EXIT_THRESHOLD) {
        // Play celebration whistle
        playSound('train_whistle', 0.6)
        setTimeout(() => {
          playSound('celebration', 0.4)
        }, 800)

        // Auto-advance to next route
        const nextRoute = state.currentRoute + 1
        dispatch({
          type: 'START_NEW_ROUTE',
          routeNumber: nextRoute,
          stations: state.stations
        })

        // Generate new passengers
        const newPassengers = generatePassengers(state.stations)
        dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })

        // Calculate and store new exit threshold for next route
        const newMaxPassengers = calculateMaxConcurrentPassengers(newPassengers, state.stations)
        const newMaxCars = Math.max(1, newMaxPassengers)
        routeExitThresholdRef.current = 100 + (newMaxCars * CAR_SPACING)
      }
    }, UPDATE_INTERVAL)

    return () => clearInterval(interval)
  }, [state.isGameActive, state.style, state.momentum, state.trainPosition, state.pressure, state.elapsedTime, state.timeoutSetting, state.passengers, state.stations, state.currentRoute, dispatch, playSound])

  // Auto-regenerate passengers when all are delivered
  useEffect(() => {
    if (!state.isGameActive || state.style !== 'sprint') return

    // Check if all passengers are delivered
    const allDelivered = state.passengers.length > 0 &&
      state.passengers.every(p => p.isDelivered)

    if (allDelivered) {
      // Generate new passengers after a short delay
      setTimeout(() => {
        const newPassengers = generatePassengers(state.stations)
        dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })
      }, 1000)
    }
  }, [state.isGameActive, state.style, state.passengers, state.stations, dispatch])

  // Add momentum on correct answer
  useEffect(() => {
    // Only for sprint mode
    if (state.style !== 'sprint') return

    // This effect triggers when correctAnswers increases
    // We use a ref to track previous value to detect changes
  }, [state.correctAnswers, state.style])

  // Function to boost momentum (called when answer is correct)
  const boostMomentum = () => {
    if (state.style !== 'sprint') return

    const newMomentum = Math.min(100, state.momentum + MOMENTUM_GAIN_PER_CORRECT)
    dispatch({
      type: 'UPDATE_STEAM_JOURNEY',
      momentum: newMomentum,
      trainPosition: state.trainPosition, // Keep current position
      pressure: state.pressure,
      elapsedTime: state.elapsedTime
    })
  }

  // Calculate time of day period (0-5 for 6 periods, cycles infinitely)
  const getTimeOfDayPeriod = (): number => {
    if (state.elapsedTime === 0) return 0
    const periodDuration = GAME_DURATION / 6
    return Math.floor(state.elapsedTime / periodDuration) % 6
  }

  // Get sky gradient colors based on time of day
  const getSkyGradient = (): { top: string; bottom: string } => {
    const period = getTimeOfDayPeriod()

    // 6 periods over 60 seconds: dawn → morning → midday → afternoon → dusk → night
    const gradients = [
      { top: '#1e3a8a', bottom: '#f59e0b' }, // Dawn - deep blue to orange
      { top: '#3b82f6', bottom: '#fbbf24' }, // Morning - blue to yellow
      { top: '#60a5fa', bottom: '#93c5fd' }, // Midday - bright blue
      { top: '#3b82f6', bottom: '#f59e0b' }, // Afternoon - blue to orange
      { top: '#7c3aed', bottom: '#f97316' }, // Dusk - purple to orange
      { top: '#1e1b4b', bottom: '#312e81' }  // Night - dark purple
    ]

    return gradients[period] || gradients[0]
  }

  return {
    boostMomentum,
    getTimeOfDayPeriod,
    getSkyGradient
  }
}