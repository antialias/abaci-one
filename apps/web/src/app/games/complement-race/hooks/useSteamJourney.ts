import { useEffect, useRef } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { generatePassengers, findBoardablePassengers, findDeliverablePassengers } from '../lib/passengerGenerator'

/**
 * Steam Sprint momentum system
 *
 * Momentum mechanics:
 * - Each correct answer adds momentum (builds up steam pressure)
 * - Momentum decays over time based on skill level
 * - Train position = momentum * 0.4 (updated every 200ms)
 * - Game lasts 60 seconds
 *
 * Skill level decay rates (momentum lost per second):
 * - Preschool: 0.5/s (very slow decay)
 * - Kindergarten: 1.0/s
 * - Relaxed: 1.5/s
 * - Slow: 2.0/s
 * - Normal: 2.5/s
 * - Fast: 3.0/s
 * - Expert: 3.5/s (rapid decay)
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
  const gameStartTimeRef = useRef<number>(0)
  const lastUpdateRef = useRef<number>(0)

  // Initialize game start time and generate initial passengers
  useEffect(() => {
    if (state.isGameActive && state.style === 'sprint' && gameStartTimeRef.current === 0) {
      gameStartTimeRef.current = Date.now()
      lastUpdateRef.current = Date.now()

      // Generate initial passengers if none exist
      if (state.passengers.length === 0) {
        const newPassengers = generatePassengers(state.stations)
        dispatch({ type: 'GENERATE_PASSENGERS', passengers: newPassengers })
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

      // Check if 60 seconds elapsed
      if (elapsed >= GAME_DURATION) {
        dispatch({ type: 'END_RACE' })
        setTimeout(() => {
          dispatch({ type: 'SHOW_RESULTS' })
        }, 1000)
        return
      }

      // Get decay rate based on timeout setting (skill level)
      const decayRate = MOMENTUM_DECAY_RATES[state.timeoutSetting] || MOMENTUM_DECAY_RATES.normal

      // Calculate momentum decay for this frame
      const momentumLoss = (decayRate * deltaTime) / 1000

      // Update momentum (don't go below 0)
      const newMomentum = Math.max(0, state.momentum - momentumLoss)

      // Calculate speed from momentum (% per second)
      const speed = newMomentum * SPEED_MULTIPLIER

      // Update train position (accumulate, never go backward)
      const positionDelta = (speed * deltaTime) / 1000
      const trainPosition = Math.min(100, state.trainPosition + positionDelta)

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
      const boardable = findBoardablePassengers(
        state.passengers,
        state.stations,
        trainPosition
      )

      // Board passengers at their origin station
      boardable.forEach(passenger => {
        dispatch({
          type: 'BOARD_PASSENGER',
          passengerId: passenger.id
        })
      })

      // Check for deliverable passengers
      const deliverable = findDeliverablePassengers(
        state.passengers,
        state.stations,
        trainPosition
      )

      // Deliver passengers at stations
      deliverable.forEach(({ passenger, points }) => {
        dispatch({
          type: 'DELIVER_PASSENGER',
          passengerId: passenger.id,
          points
        })
      })

      // Check for route completion (train reaches 100%)
      if (trainPosition >= 100 && !state.showRouteCelebration) {
        dispatch({ type: 'COMPLETE_ROUTE' })
      }
    }, UPDATE_INTERVAL)

    return () => clearInterval(interval)
  }, [state.isGameActive, state.style, state.momentum, state.timeoutSetting, state.passengers, state.stations, state.showRouteCelebration, dispatch])

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

  // Calculate time of day period (0-5 for 6 periods over 60 seconds)
  const getTimeOfDayPeriod = (): number => {
    if (state.elapsedTime === 0) return 0
    const periodDuration = GAME_DURATION / 6
    return Math.min(5, Math.floor(state.elapsedTime / periodDuration))
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