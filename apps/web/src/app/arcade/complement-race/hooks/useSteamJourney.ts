import { useEffect, useRef } from 'react'
import { useComplementRace } from '@/arcade-games/complement-race/Provider'
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
  expert: 13.0,
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
  const missedPassengersRef = useRef<Set<string>>(new Set()) // Track which passengers have been logged as missed
  const pendingBoardingRef = useRef<Set<string>>(new Set()) // Track passengers with pending boarding requests across frames
  const previousTrainPositionRef = useRef<number>(0) // Track previous position to detect threshold crossings

  // Initialize game start time
  useEffect(() => {
    if (state.isGameActive && state.style === 'sprint' && gameStartTimeRef.current === 0) {
      gameStartTimeRef.current = Date.now()
      lastUpdateRef.current = Date.now()
    }
  }, [state.isGameActive, state.style, state.stations, state.passengers])

  // Calculate exit threshold when route changes or config updates
  useEffect(() => {
    if (state.passengers.length > 0 && state.stations.length > 0) {
      const CAR_SPACING = 7
      // Use server-calculated maxConcurrentPassengers
      const maxCars = Math.max(1, state.maxConcurrentPassengers || 3)
      routeExitThresholdRef.current = 100 + maxCars * CAR_SPACING
    }
  }, [state.currentRoute, state.passengers, state.stations, state.maxConcurrentPassengers])

  // Clean up pendingBoardingRef when passengers are claimed/delivered or route changes
  useEffect(() => {
    // Remove passengers from pending set if they've been claimed or delivered
    state.passengers.forEach((passenger) => {
      if (passenger.claimedBy !== null || passenger.deliveredBy !== null) {
        pendingBoardingRef.current.delete(passenger.id)
      }
    })
  }, [state.passengers])

  // Clear all pending boarding requests when route changes
  useEffect(() => {
    pendingBoardingRef.current.clear()
    missedPassengersRef.current.clear()
    previousTrainPositionRef.current = 0 // Reset previous position for new route
  }, [state.currentRoute])

  // Momentum decay and position update loop
  useEffect(() => {
    if (!state.isGameActive || state.style !== 'sprint') return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - gameStartTimeRef.current
      const deltaTime = now - lastUpdateRef.current
      lastUpdateRef.current = now

      // Steam Sprint is infinite - no time limit

      // Train position, momentum, and pressure are all managed by the Provider's game loop
      // This hook only reads those values and handles game logic (boarding, delivery, route completion)
      const trainPosition = state.trainPosition

      // Check for passengers that should board
      // Passengers board when an EMPTY car reaches their station
      const CAR_SPACING = 7 // Must match SteamTrainJourney component
      // Use server-calculated maxConcurrentPassengers (updates per route based on passenger layout)
      const maxCars = Math.max(1, state.maxConcurrentPassengers || 3)

      // Debug: Log train configuration at start (only once per route)
      if (trainPosition < 1 && state.passengers.length > 0) {
        const lastLoggedRoute = (window as any).__lastLoggedRoute || 0
        if (lastLoggedRoute !== state.currentRoute) {
          console.log(
            `\n🚆 ROUTE ${state.currentRoute} START - Train has ${maxCars} cars (server maxConcurrentPassengers: ${state.maxConcurrentPassengers}) for ${state.passengers.length} passengers`
          )
          state.passengers.forEach((p) => {
            const origin = state.stations.find((s) => s.id === p.originStationId)
            const dest = state.stations.find((s) => s.id === p.destinationStationId)
            console.log(
              `  📍 ${p.name}: ${origin?.emoji} ${origin?.name} (${origin?.position}) → ${dest?.emoji} ${dest?.name} (${dest?.position}) ${p.isUrgent ? '⚡' : ''}`
            )
          })
          console.log('') // Blank line for readability
          ;(window as any).__lastLoggedRoute = state.currentRoute
        }
      }
      const currentBoardedPassengers = state.passengers.filter(
        (p) => p.claimedBy !== null && p.deliveredBy === null
      )

      // FIRST: Identify which passengers will be delivered in this frame
      const passengersToDeliver = new Set<string>()
      currentBoardedPassengers.forEach((passenger) => {
        if (!passenger || passenger.deliveredBy !== null || passenger.carIndex === null) return

        const station = state.stations.find((s) => s.id === passenger.destinationStationId)
        if (!station) return

        // Calculate this passenger's car position using PHYSICAL carIndex
        const carPosition = Math.max(0, trainPosition - (passenger.carIndex + 1) * CAR_SPACING)
        const distance = Math.abs(carPosition - station.position)

        // If this car is at the destination station (within 5% tolerance), mark for delivery
        if (distance < 5) {
          passengersToDeliver.add(passenger.id)
        }
      })

      // Build a map of which cars are occupied (using PHYSICAL car index, not array index!)
      // This is critical: passenger.carIndex stores the physical car (0-N) they're seated in
      const occupiedCars = new Map<number, (typeof currentBoardedPassengers)[0]>()
      currentBoardedPassengers.forEach((passenger) => {
        // Don't count a car as occupied if its passenger is being delivered this frame
        if (!passengersToDeliver.has(passenger.id) && passenger.carIndex !== null) {
          occupiedCars.set(passenger.carIndex, passenger) // Use physical carIndex, NOT array index!
        }
      })

      // PRIORITY 1: Process deliveries FIRST (dispatch DELIVER moves before BOARD moves)
      // This ensures the server frees up cars before processing new boarding requests
      currentBoardedPassengers.forEach((passenger) => {
        if (!passenger || passenger.deliveredBy !== null || passenger.carIndex === null) return

        const station = state.stations.find((s) => s.id === passenger.destinationStationId)
        if (!station) return

        // Calculate this passenger's car position using PHYSICAL carIndex
        const carPosition = Math.max(0, trainPosition - (passenger.carIndex + 1) * CAR_SPACING)
        const distance = Math.abs(carPosition - station.position)

        // If this car is at the destination station (within 5% tolerance), deliver
        if (distance < 5) {
          const points = passenger.isUrgent ? 20 : 10
          console.log(
            `🎯 DELIVERY: ${passenger.name} delivered from Car ${passenger.carIndex} to ${station.emoji} ${station.name} (+${points} pts) (trainPos=${trainPosition.toFixed(1)}, carPos=${carPosition.toFixed(1)}, stationPos=${station.position})`
          )
          dispatch({
            type: 'DELIVER_PASSENGER',
            passengerId: passenger.id,
            points,
          })
        }
      })

      // Debug: Log car states periodically at stations
      const isAtStation = state.stations.some((s) => Math.abs(trainPosition - s.position) < 3)
      if (isAtStation && Math.floor(trainPosition) !== Math.floor(state.trainPosition)) {
        const nearStation = state.stations.find((s) => Math.abs(trainPosition - s.position) < 3)
        console.log(
          `\n🚃 Train arriving at ${nearStation?.emoji} ${nearStation?.name} (trainPos=${trainPosition.toFixed(1)}) - ${maxCars} cars total:`
        )
        for (let i = 0; i < maxCars; i++) {
          const carPos = Math.max(0, trainPosition - (i + 1) * CAR_SPACING)
          const occupant = occupiedCars.get(i)
          if (occupant) {
            const dest = state.stations.find((s) => s.id === occupant.destinationStationId)
            console.log(
              `  Car ${i}: @ ${carPos.toFixed(1)}% - ${occupant.name} → ${dest?.emoji} ${dest?.name}`
            )
          } else {
            console.log(`  Car ${i}: @ ${carPos.toFixed(1)}% - EMPTY`)
          }
        }
      }

      // Track which cars are assigned in THIS frame to prevent double-boarding
      const carsAssignedThisFrame = new Set<number>()
      // Track which passengers are assigned in THIS frame to prevent same passenger boarding multiple cars
      const passengersAssignedThisFrame = new Set<string>()

      // PRIORITY 2: Process boardings AFTER deliveries

      // Find waiting passengers whose origin station has an empty car nearby
      state.passengers.forEach((passenger) => {
        // Skip if already claimed or delivered (optimistic update marks immediately)
        if (passenger.claimedBy !== null || passenger.deliveredBy !== null) return

        // Skip if already assigned in this frame OR has a pending boarding request from previous frames
        if (
          passengersAssignedThisFrame.has(passenger.id) ||
          pendingBoardingRef.current.has(passenger.id)
        )
          return

        const station = state.stations.find((s) => s.id === passenger.originStationId)
        if (!station) return

        // Don't allow boarding if locomotive has passed too far beyond this station
        // Station stays open until the LAST car has passed (accounting for train length)
        const STATION_CLOSURE_BUFFER = 10 // Extra buffer beyond the last car
        const lastCarOffset = maxCars * CAR_SPACING // Distance from locomotive to last car
        const stationClosureThreshold = lastCarOffset + STATION_CLOSURE_BUFFER

        if (trainPosition > station.position + stationClosureThreshold) {
          console.log(
            `❌ MISSED: ${passenger.name} at ${station.emoji} ${station.name} - train too far past (trainPos=${trainPosition.toFixed(1)}, station=${station.position}, threshold=${stationClosureThreshold})`
          )
          return
        }

        // Check if any empty car is at this station
        // Cars are at positions: trainPosition - 7, trainPosition - 14, etc.
        let closestCarDistance = 999
        let closestCarReason = ''

        for (let carIndex = 0; carIndex < maxCars; carIndex++) {
          const carPosition = Math.max(0, trainPosition - (carIndex + 1) * CAR_SPACING)
          const distance = Math.abs(carPosition - station.position)

          if (distance < closestCarDistance) {
            closestCarDistance = distance
            if (occupiedCars.has(carIndex)) {
              const occupant = occupiedCars.get(carIndex)
              closestCarReason = `Car ${carIndex} occupied by ${occupant?.name}`
            } else if (carsAssignedThisFrame.has(carIndex)) {
              closestCarReason = `Car ${carIndex} just assigned`
            } else if (distance >= 5) {
              closestCarReason = `Car ${carIndex} too far (dist=${distance.toFixed(1)})`
            } else {
              closestCarReason = 'available'
            }
          }

          // Skip if this car already has a passenger OR was assigned this frame
          if (occupiedCars.has(carIndex) || carsAssignedThisFrame.has(carIndex)) continue

          // If car is at or near station (within 5% tolerance for fast trains), board this passenger
          if (distance < 5) {
            console.log(
              `🚂 BOARDING: ${passenger.name} boarding Car ${carIndex} at ${station.emoji} ${station.name} (trainPos=${trainPosition.toFixed(1)}, carPos=${carPosition.toFixed(1)}, stationPos=${station.position})`
            )

            // Mark as pending BEFORE dispatch to prevent duplicate boarding attempts across frames
            pendingBoardingRef.current.add(passenger.id)

            dispatch({
              type: 'BOARD_PASSENGER',
              passengerId: passenger.id,
              carIndex, // Pass physical car index to server
            })
            // Mark this car and passenger as assigned in this frame
            carsAssignedThisFrame.add(carIndex)
            passengersAssignedThisFrame.add(passenger.id)
            return // Board this passenger and move on
          }
        }

        // If we get here, passenger wasn't boarded - log why
        if (closestCarDistance < 10) {
          // Only log if train is somewhat near
          console.log(
            `⏸️  WAITING: ${passenger.name} at ${station.emoji} ${station.name} - ${closestCarReason} (trainPos=${trainPosition.toFixed(1)}, maxCars=${maxCars})`
          )
        }
      })

      // Check for route completion (entire train exits tunnel)
      const ENTIRE_TRAIN_EXIT_THRESHOLD = routeExitThresholdRef.current
      const previousPosition = previousTrainPositionRef.current

      if (
        trainPosition >= ENTIRE_TRAIN_EXIT_THRESHOLD &&
        previousPosition < ENTIRE_TRAIN_EXIT_THRESHOLD
      ) {
        // Play celebration whistle
        playSound('train_whistle', 0.6)
        setTimeout(() => {
          playSound('celebration', 0.4)
        }, 800)

        // Auto-advance to next route
        const nextRoute = state.currentRoute + 1
        console.log(
          `🏁 ROUTE COMPLETE: Train crossed exit threshold (${trainPosition.toFixed(1)} >= ${ENTIRE_TRAIN_EXIT_THRESHOLD}). Advancing to Route ${nextRoute}`
        )
        dispatch({
          type: 'START_NEW_ROUTE',
          routeNumber: nextRoute,
          stations: state.stations,
        })

        // Note: New passengers will be generated by the server when it handles START_NEW_ROUTE
      }

      // Update previous position for next frame
      previousTrainPositionRef.current = trainPosition
    }, UPDATE_INTERVAL)

    return () => clearInterval(interval)
  }, [state.isGameActive, state.style, state.timeoutSetting, dispatch, playSound])

  // Add momentum on correct answer
  useEffect(() => {
    // Only for sprint mode
    if (state.style !== 'sprint') return

    // This effect triggers when correctAnswers increases
    // We use a ref to track previous value to detect changes
  }, [state.style])

  // Function to boost momentum (called when answer is correct)
  const boostMomentum = () => {
    if (state.style !== 'sprint') return

    const newMomentum = Math.min(100, state.momentum + MOMENTUM_GAIN_PER_CORRECT)
    dispatch({
      type: 'UPDATE_STEAM_JOURNEY',
      momentum: newMomentum,
      trainPosition: state.trainPosition, // Keep current position
      pressure: state.pressure,
      elapsedTime: state.elapsedTime,
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
      { top: '#1e1b4b', bottom: '#312e81' }, // Night - dark purple
    ]

    return gradients[period] || gradients[0]
  }

  return {
    boostMomentum,
    getTimeOfDayPeriod,
    getSkyGradient,
  }
}
