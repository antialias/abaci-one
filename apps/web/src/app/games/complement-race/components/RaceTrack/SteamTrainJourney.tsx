'use client'

import { useEffect, useRef, useState, useMemo, memo } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { useSteamJourney } from '../../hooks/useSteamJourney'
import { useComplementRace } from '../../context/ComplementRaceContext'
import { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { PassengerCard } from '../PassengerCard'
import { getRouteTheme } from '../../lib/routeThemes'
import { generateLandmarks, type Landmark } from '../../lib/landmarks'
import { PressureGauge } from '../PressureGauge'
import { useGameMode } from '@/contexts/GameModeContext'
import { useUserProfile } from '@/contexts/UserProfileContext'
import type { Passenger } from '../../lib/gameTypes'

interface BoardingAnimation {
  passenger: Passenger
  fromX: number
  fromY: number
  toX: number
  toY: number
  carIndex: number
  startTime: number
}

interface DisembarkingAnimation {
  passenger: Passenger
  fromX: number
  fromY: number
  toX: number
  toY: number
  startTime: number
}

const BoardingPassengerAnimation = memo(({ animation }: { animation: BoardingAnimation }) => {
  const spring = useSpring({
    from: { x: animation.fromX, y: animation.fromY, opacity: 1 },
    to: { x: animation.toX, y: animation.toY, opacity: 1 },
    config: { tension: 120, friction: 14 }
  })

  return (
    <animated.text
      x={spring.x}
      y={spring.y}
      textAnchor="middle"
      opacity={spring.opacity}
      style={{
        fontSize: '55px',
        pointerEvents: 'none',
        filter: animation.passenger.isUrgent
          ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))'
          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
      }}
    >
      {animation.passenger.avatar}
    </animated.text>
  )
})
BoardingPassengerAnimation.displayName = 'BoardingPassengerAnimation'

const DisembarkingPassengerAnimation = memo(({ animation }: { animation: DisembarkingAnimation }) => {
  const spring = useSpring({
    from: { x: animation.fromX, y: animation.fromY, opacity: 1 },
    to: { x: animation.toX, y: animation.toY, opacity: 1 },
    config: { tension: 120, friction: 14 }
  })

  return (
    <animated.text
      x={spring.x}
      y={spring.y}
      textAnchor="middle"
      opacity={spring.opacity}
      style={{
        fontSize: '55px',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))'
      }}
    >
      {animation.passenger.avatar}
    </animated.text>
  )
})
DisembarkingPassengerAnimation.displayName = 'DisembarkingPassengerAnimation'

interface SteamTrainJourneyProps {
  momentum: number
  trainPosition: number
  pressure: number
  elapsedTime: number
  currentQuestion: { number: number; targetSum: number; correctAnswer: number } | null
  currentInput: string
}

export function SteamTrainJourney({ momentum, trainPosition, pressure, elapsedTime, currentQuestion, currentInput }: SteamTrainJourneyProps) {
  const { state } = useComplementRace()
  const { getSkyGradient, getTimeOfDayPeriod } = useSteamJourney()
  const skyGradient = getSkyGradient()
  const period = getTimeOfDayPeriod()
  const { players } = useGameMode()
  const { profile } = useUserProfile()

  // Get the first active player's emoji from UserProfileContext (same as nav bar)
  const activePlayer = players.find(p => p.isActive)
  const playerEmoji = activePlayer
    ? (activePlayer.id === 1 ? profile.player1Emoji :
       activePlayer.id === 2 ? profile.player2Emoji :
       activePlayer.id === 3 ? profile.player3Emoji :
       activePlayer.id === 4 ? profile.player4Emoji : '👤')
    : '👤'

  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [trackGenerator] = useState(() => new RailroadTrackGenerator(800, 600))
  const [trackData, setTrackData] = useState<ReturnType<typeof trackGenerator.generateTrack> | null>(null)
  const [tiesAndRails, setTiesAndRails] = useState<{
    ties: Array<{ x1: number; y1: number; x2: number; y2: number }>
    leftRailPoints: string[]
    rightRailPoints: string[]
  } | null>(null)
  const [trainTransform, setTrainTransform] = useState({ x: 50, y: 300, rotation: 0 })
  const [stationPositions, setStationPositions] = useState<Array<{ x: number; y: number }>>([])
  const [landmarks, setLandmarks] = useState<Landmark[]>([])
  const [landmarkPositions, setLandmarkPositions] = useState<Array<{ x: number; y: number }>>([])
  const [boardingAnimations, setBoardingAnimations] = useState<Map<string, BoardingAnimation>>(new Map())
  const [disembarkingAnimations, setDisembarkingAnimations] = useState<Map<string, DisembarkingAnimation>>(new Map())
  const previousPassengersRef = useRef<Passenger[]>(state.passengers)

  // Generate landmarks when route changes
  useEffect(() => {
    const newLandmarks = generateLandmarks(state.currentRoute)
    setLandmarks(newLandmarks)
  }, [state.currentRoute])

  // Time remaining (60 seconds total)
  const timeRemaining = Math.max(0, 60 - Math.floor(elapsedTime / 1000))

  // Period names for display
  const periodNames = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Night']

  // Get current route theme
  const routeTheme = getRouteTheme(state.currentRoute)

  // Track previous route data to maintain visuals during transition
  const previousRouteRef = useRef(state.currentRoute)
  const [pendingTrackData, setPendingTrackData] = useState<ReturnType<typeof trackGenerator.generateTrack> | null>(null)

  // Preserve passengers during route transition
  const [displayPassengers, setDisplayPassengers] = useState(state.passengers)

  // Generate track on mount and when route changes
  useEffect(() => {
    const track = trackGenerator.generateTrack(state.currentRoute)

    // If we're in the middle of a route (position > 0), store as pending
    // Only apply new track when position resets to beginning (< 0)
    if (state.trainPosition > 0 && previousRouteRef.current !== state.currentRoute) {
      setPendingTrackData(track)
    } else {
      setTrackData(track)
      previousRouteRef.current = state.currentRoute
      setPendingTrackData(null)
    }
  }, [trackGenerator, state.currentRoute, state.trainPosition])

  // Apply pending track when train resets to beginning
  useEffect(() => {
    if (pendingTrackData && state.trainPosition < 0) {
      setTrackData(pendingTrackData)
      previousRouteRef.current = state.currentRoute
      setPendingTrackData(null)
    }
  }, [pendingTrackData, state.trainPosition, state.currentRoute])

  // Manage passenger display during route transitions
  useEffect(() => {
    // If we're starting a new route (position < 0) or passengers haven't changed, update immediately
    if (state.trainPosition < 0 || state.passengers === previousPassengersRef.current) {
      setDisplayPassengers(state.passengers)
      previousPassengersRef.current = state.passengers
    }
    // Otherwise, if we're mid-route and passengers changed, keep showing old passengers
    else if (state.trainPosition > 0 && state.passengers !== previousPassengersRef.current) {
      // Keep displaying old passengers until train exits
      // Don't update displayPassengers yet
    }

    // When train resets to beginning, switch to new passengers
    if (state.trainPosition < 0 && state.passengers !== previousPassengersRef.current) {
      setDisplayPassengers(state.passengers)
      previousPassengersRef.current = state.passengers
    }
  }, [state.passengers, state.trainPosition])

  // Update display passengers during gameplay (same route)
  useEffect(() => {
    // Only update if we're in the same route (not transitioning)
    if (previousRouteRef.current === state.currentRoute && state.trainPosition >= 0 && state.trainPosition < 100) {
      setDisplayPassengers(state.passengers)
    }
  }, [state.passengers, state.currentRoute, state.trainPosition])

  // Generate ties and rails when path is ready
  useEffect(() => {
    if (pathRef.current && trackData) {
      const result = trackGenerator.generateTiesAndRails(pathRef.current)
      setTiesAndRails(result)
    }
  }, [trackData, trackGenerator])

  // Calculate station positions when path is ready
  useEffect(() => {
    if (pathRef.current) {
      const positions = state.stations.map(station => {
        const pathLength = pathRef.current!.getTotalLength()
        const distance = (station.position / 100) * pathLength
        const point = pathRef.current!.getPointAtLength(distance)
        return { x: point.x, y: point.y }
      })
      setStationPositions(positions)
    }
  }, [trackData, state.stations])

  // Calculate landmark positions when path is ready
  useEffect(() => {
    if (pathRef.current && landmarks.length > 0) {
      const positions = landmarks.map(landmark => {
        const pathLength = pathRef.current!.getTotalLength()
        const distance = (landmark.position / 100) * pathLength
        const point = pathRef.current!.getPointAtLength(distance)
        return {
          x: point.x + landmark.offset.x,
          y: point.y + landmark.offset.y
        }
      })
      setLandmarkPositions(positions)
    }
  }, [trackData, landmarks])

  // Update train position and rotation
  useEffect(() => {
    if (pathRef.current) {
      const transform = trackGenerator.getTrainTransform(pathRef.current, trainPosition)
      setTrainTransform(transform)
    }
  }, [trainPosition, trackGenerator])

  // Detect passengers boarding/disembarking and start animations (consolidated for performance)
  useEffect(() => {
    if (!pathRef.current || stationPositions.length === 0) return

    const previousPassengers = previousPassengersRef.current
    const currentPassengers = state.passengers

    // Find newly boarded passengers
    const newlyBoarded = currentPassengers.filter(curr => {
      const prev = previousPassengers.find(p => p.id === curr.id)
      return curr.isBoarded && prev && !prev.isBoarded
    })

    // Find newly delivered passengers
    const newlyDelivered = currentPassengers.filter(curr => {
      const prev = previousPassengers.find(p => p.id === curr.id)
      return curr.isDelivered && prev && !prev.isDelivered
    })

    // Start animation for each newly boarded passenger
    newlyBoarded.forEach(passenger => {
      // Find origin station
      const originStation = state.stations.find(s => s.id === passenger.originStationId)
      if (!originStation) return

      const stationIndex = state.stations.indexOf(originStation)
      const stationPos = stationPositions[stationIndex]
      if (!stationPos) return

      // Find which car this passenger will be in
      const boardedPassengers = currentPassengers.filter(p => p.isBoarded && !p.isDelivered)
      const carIndex = boardedPassengers.indexOf(passenger)

      // Calculate train car position
      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * 7) // 7% spacing
      const carTransform = trackGenerator.getTrainTransform(pathRef.current!, carPosition)

      // Create boarding animation
      const animation: BoardingAnimation = {
        passenger,
        fromX: stationPos.x,
        fromY: stationPos.y - 30,
        toX: carTransform.x,
        toY: carTransform.y,
        carIndex,
        startTime: Date.now()
      }

      setBoardingAnimations(prev => {
        const next = new Map(prev)
        next.set(passenger.id, animation)
        return next
      })

      // Remove animation after 800ms
      setTimeout(() => {
        setBoardingAnimations(prev => {
          const next = new Map(prev)
          next.delete(passenger.id)
          return next
        })
      }, 800)
    })

    // Start animation for each newly delivered passenger
    newlyDelivered.forEach(passenger => {
      // Find destination station
      const destinationStation = state.stations.find(s => s.id === passenger.destinationStationId)
      if (!destinationStation) return

      const stationIndex = state.stations.indexOf(destinationStation)
      const stationPos = stationPositions[stationIndex]
      if (!stationPos) return

      // Find which car this passenger was in (before delivery)
      const prevBoardedPassengers = previousPassengers.filter(p => p.isBoarded && !p.isDelivered)
      const carIndex = prevBoardedPassengers.findIndex(p => p.id === passenger.id)
      if (carIndex === -1) return

      // Calculate train car position at time of disembarking
      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * 7) // 7% spacing
      const carTransform = trackGenerator.getTrainTransform(pathRef.current!, carPosition)

      // Create disembarking animation (from car to station)
      const animation: DisembarkingAnimation = {
        passenger,
        fromX: carTransform.x,
        fromY: carTransform.y,
        toX: stationPos.x,
        toY: stationPos.y - 30,
        startTime: Date.now()
      }

      setDisembarkingAnimations(prev => {
        const next = new Map(prev)
        next.set(passenger.id, animation)
        return next
      })

      // Remove animation after 800ms
      setTimeout(() => {
        setDisembarkingAnimations(prev => {
          const next = new Map(prev)
          next.delete(passenger.id)
          return next
        })
      }, 800)
    })

    // Update ref
    previousPassengersRef.current = currentPassengers
  }, [state.passengers, state.stations, stationPositions, trainPosition, trackGenerator, pathRef])

  // Calculate train car transforms (each car follows behind the locomotive)
  const maxCars = 5 // Maximum passengers per route
  const carSpacing = 7 // Percentage of track between cars
  const trainCars = useMemo(() => {
    if (!pathRef.current) {
      return Array.from({ length: maxCars }, () => ({ x: 0, y: 0, rotation: 0, position: 0, opacity: 0 }))
    }

    return Array.from({ length: maxCars }).map((_, carIndex) => {
      // Calculate position for this car (behind the locomotive)
      const carPosition = Math.max(0, trainPosition - (carIndex + 1) * carSpacing)

      // Calculate opacity: fade in at left tunnel (3-8%), fade out at right tunnel (92-97%)
      const fadeInStart = 3
      const fadeInEnd = 8
      const fadeOutStart = 92
      const fadeOutEnd = 97

      let opacity = 1 // Default to fully visible

      // Fade in from left tunnel
      if (carPosition <= fadeInStart) {
        opacity = 0
      } else if (carPosition < fadeInEnd) {
        opacity = (carPosition - fadeInStart) / (fadeInEnd - fadeInStart)
      }
      // Fade out into right tunnel
      else if (carPosition >= fadeOutEnd) {
        opacity = 0
      } else if (carPosition > fadeOutStart) {
        opacity = 1 - ((carPosition - fadeOutStart) / (fadeOutEnd - fadeOutStart))
      }

      return {
        ...trackGenerator.getTrainTransform(pathRef.current!, carPosition),
        position: carPosition,
        opacity
      }
    })
  }, [trainPosition, trackGenerator, maxCars, carSpacing])

  // Calculate locomotive opacity (fade in/out through tunnels)
  const locomotiveOpacity = useMemo(() => {
    const fadeInStart = 3
    const fadeInEnd = 8
    const fadeOutStart = 92
    const fadeOutEnd = 97

    // Fade in from left tunnel
    if (trainPosition <= fadeInStart) {
      return 0
    } else if (trainPosition < fadeInEnd) {
      return (trainPosition - fadeInStart) / (fadeInEnd - fadeInStart)
    }
    // Fade out into right tunnel
    else if (trainPosition >= fadeOutEnd) {
      return 0
    } else if (trainPosition > fadeOutStart) {
      return 1 - ((trainPosition - fadeOutStart) / (fadeOutEnd - fadeOutStart))
    }

    return 1 // Default to fully visible
  }, [trainPosition])

  // Memoize filtered passenger lists to avoid recalculating on every render
  const boardedPassengers = useMemo(() =>
    displayPassengers.filter(p => p.isBoarded && !p.isDelivered),
    [displayPassengers]
  )

  const nonDeliveredPassengers = useMemo(() =>
    displayPassengers.filter(p => !p.isDelivered),
    [displayPassengers]
  )

  // Memoize ground texture circles to avoid recreating on every render
  const groundTextureCircles = useMemo(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      key: `ground-texture-${i}`,
      cx: -30 + (i * 28) + (i % 3) * 10,
      cy: 140 + (i % 5) * 60,
      r: 2 + (i % 3)
    })),
    []
  )

  if (!trackData) return null

  return (
    <div data-component="steam-train-journey" style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'transparent',
      overflow: 'visible',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'stretch'
    }}>
      {/* Route and time of day indicator */}
      <div data-component="route-info" style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10
      }}>
        {/* Current Route */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '20px' }}>{routeTheme.emoji}</span>
          <div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>Route {state.currentRoute}</div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>{routeTheme.name}</div>
          </div>
        </div>

        {/* Time of Day */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.3)',
          color: 'white',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          backdropFilter: 'blur(4px)'
        }}>
          {periodNames[period]}
        </div>
      </div>

      {/* Time remaining */}
      <div data-component="time-remaining" style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.3)',
        color: 'white',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        backdropFilter: 'blur(4px)',
        zIndex: 10
      }}>
        ⏱️ {timeRemaining}s
      </div>

      {/* Railroad track SVG */}
      <svg
        data-component="railroad-track"
        ref={svgRef}
        viewBox="-50 -50 900 700"
        style={{
          width: '100%',
          height: 'auto',
          aspectRatio: '800 / 600',
          overflow: 'visible'
        }}
      >
        {/* Gradient definitions for mountain shading and ground */}
        <defs>
          <linearGradient id="mountainGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#a0a0a0', stopOpacity: 0.8 }} />
            <stop offset="50%" style={{ stopColor: '#7a7a7a', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#5a5a5a', stopOpacity: 0.4 }} />
          </linearGradient>
          <linearGradient id="mountainGradientRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#5a5a5a', stopOpacity: 0.4 }} />
            <stop offset="50%" style={{ stopColor: '#7a7a7a', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: '#a0a0a0', stopOpacity: 0.8 }} />
          </linearGradient>
          <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#6a8759', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#8B7355', stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        {/* Ground layer - extends full width and height to cover entire track area */}
        <rect
          x="-50"
          y="120"
          width="900"
          height="530"
          fill="#8B7355"
        />

        {/* Ground surface gradient for depth */}
        <rect
          x="-50"
          y="120"
          width="900"
          height="60"
          fill="url(#groundGradient)"
        />

        {/* Ground texture - scattered rocks/pebbles */}
        {groundTextureCircles.map((circle) => (
          <circle
            key={circle.key}
            cx={circle.cx}
            cy={circle.cy}
            r={circle.r}
            fill="#654321"
            opacity={0.3}
          />
        ))}

        {/* Railroad ballast (gravel bed) */}
        <path
          d={trackData.ballastPath}
          fill="none"
          stroke="#8B7355"
          strokeWidth="40"
          strokeLinecap="round"
        />

        {/* Left mountain and tunnel */}
        <g data-element="left-tunnel">
          {/* Mountain base - extends from left edge */}
          <rect
            x="-50"
            y="200"
            width="120"
            height="450"
            fill="#6b7280"
          />

          {/* Mountain peak - triangular slope */}
          <path
            d="M -50 200 L 70 200 L 20 -50 L -50 100 Z"
            fill="#8b8b8b"
          />

          {/* Mountain ridge shading */}
          <path
            d="M -50 200 L 70 200 L 20 -50 Z"
            fill="url(#mountainGradientLeft)"
          />


          {/* Tunnel depth/interior (dark entrance) */}
          <ellipse
            cx="20"
            cy="300"
            rx="50"
            ry="55"
            fill="#0a0a0a"
          />

          {/* Tunnel arch opening */}
          <path
            d="M 20 355 L -50 355 L -50 245 Q -50 235, 20 235 Q 70 235, 70 245 L 70 355 Z"
            fill="#1a1a1a"
            stroke="#4a4a4a"
            strokeWidth="3"
          />

          {/* Tunnel arch rim (stone bricks) */}
          <path
            d="M -50 245 Q -50 235, 20 235 Q 70 235, 70 245"
            fill="none"
            stroke="#8b7355"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Stone brick texture around arch */}
          <path
            d="M -50 245 Q -50 235, 20 235 Q 70 235, 70 245"
            fill="none"
            stroke="#654321"
            strokeWidth="2"
            strokeDasharray="15,10"
          />
        </g>

        {/* Right mountain and tunnel */}
        <g data-element="right-tunnel">
          {/* Mountain base - extends to right edge */}
          <rect
            x="680"
            y="200"
            width="170"
            height="450"
            fill="#6b7280"
          />

          {/* Mountain peak - triangular slope */}
          <path
            d="M 730 200 L 850 200 L 850 100 L 780 -50 Z"
            fill="#8b8b8b"
          />

          {/* Mountain ridge shading */}
          <path
            d="M 730 200 L 850 150 L 780 -50 Z"
            fill="url(#mountainGradientRight)"
          />


          {/* Tunnel depth/interior (dark entrance) */}
          <ellipse
            cx="780"
            cy="300"
            rx="50"
            ry="55"
            fill="#0a0a0a"
          />

          {/* Tunnel arch opening */}
          <path
            d="M 780 355 L 730 355 L 730 245 Q 730 235, 780 235 Q 850 235, 850 245 L 850 355 Z"
            fill="#1a1a1a"
            stroke="#4a4a4a"
            strokeWidth="3"
          />

          {/* Tunnel arch rim (stone bricks) */}
          <path
            d="M 730 245 Q 730 235, 780 235 Q 850 235, 850 245"
            fill="none"
            stroke="#8b7355"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Stone brick texture around arch */}
          <path
            d="M 730 245 Q 730 235, 780 235 Q 850 235, 850 245"
            fill="none"
            stroke="#654321"
            strokeWidth="2"
            strokeDasharray="15,10"
          />
        </g>

        {/* Railroad ties */}
        {tiesAndRails?.ties.map((tie, index) => (
          <line
            key={`tie-${index}`}
            x1={tie.x1}
            y1={tie.y1}
            x2={tie.x2}
            y2={tie.y2}
            stroke="#654321"
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.8"
          />
        ))}

        {/* Left rail */}
        {tiesAndRails && tiesAndRails.leftRailPoints.length > 1 && (
          <polyline
            points={tiesAndRails.leftRailPoints.join(' ')}
            fill="none"
            stroke="#C0C0C0"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}

        {/* Right rail */}
        {tiesAndRails && tiesAndRails.rightRailPoints.length > 1 && (
          <polyline
            points={tiesAndRails.rightRailPoints.join(' ')}
            fill="none"
            stroke="#C0C0C0"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}

        {/* Reference path (invisible, used for positioning) */}
        <path
          ref={pathRef}
          d={trackData.referencePath}
          fill="none"
          stroke="transparent"
          strokeWidth="2"
        />

        {/* Landmarks - background scenery */}
        {landmarkPositions.map((pos, index) => (
          <text
            key={`landmark-${index}`}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            style={{
              fontSize: `${(landmarks[index]?.size || 24) * 2.0}px`,
              pointerEvents: 'none',
              opacity: 0.7,
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))'
            }}
          >
            {landmarks[index]?.emoji}
          </text>
        ))}

        {/* Station markers */}
        {stationPositions.map((pos, index) => {
          const station = state.stations[index]
          // Find passengers waiting at this station (exclude currently boarding)
          const waitingPassengers = state.passengers.filter(p =>
            p.originStationId === station?.id && !p.isBoarded && !p.isDelivered && !boardingAnimations.has(p.id)
          )
          // Find passengers delivered at this station (exclude currently disembarking)
          const deliveredPassengers = state.passengers.filter(p =>
            p.destinationStationId === station?.id && p.isDelivered && !disembarkingAnimations.has(p.id)
          )

          return (
            <g key={`station-${index}`}>
              {/* Station platform */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r="18"
                fill="#8B4513"
                stroke="#654321"
                strokeWidth="4"
              />
              {/* Station icon */}
              <text
                x={pos.x}
                y={pos.y - 40}
                textAnchor="middle"
                fontSize="48"
                style={{ pointerEvents: 'none' }}
              >
                {station?.icon}
              </text>
              {/* Station name */}
              <text
                x={pos.x}
                y={pos.y + 50}
                textAnchor="middle"
                fontSize="20"
                fill="#1f2937"
                stroke="#f59e0b"
                strokeWidth="0.5"
                style={{
                  fontWeight: 900,
                  pointerEvents: 'none',
                  fontFamily: '"Comic Sans MS", "Chalkboard SE", "Bradley Hand", cursive',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  letterSpacing: '0.5px',
                  paintOrder: 'stroke fill'
                }}
              >
                {station?.name}
              </text>

              {/* Waiting passengers at this station */}
              {waitingPassengers.map((passenger, pIndex) => (
                <text
                  key={`waiting-${passenger.id}`}
                  x={pos.x + (pIndex - waitingPassengers.length / 2 + 0.5) * 28}
                  y={pos.y - 30}
                  textAnchor="middle"
                  style={{
                    fontSize: '55px',
                    pointerEvents: 'none',
                    filter: passenger.isUrgent ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))'
                  }}
                >
                  {passenger.avatar}
                </text>
              ))}

              {/* Delivered passengers at this station (celebrating) */}
              {deliveredPassengers.map((passenger, pIndex) => (
                <text
                  key={`delivered-${passenger.id}`}
                  x={pos.x + (pIndex - deliveredPassengers.length / 2 + 0.5) * 28}
                  y={pos.y - 30}
                  textAnchor="middle"
                  style={{
                    fontSize: '55px',
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))',
                    animation: 'celebrateDelivery 2s ease-out forwards'
                  }}
                >
                  {passenger.avatar}
                </text>
              ))}
            </g>
          )
        })}

        {/* Boarding animations - passengers moving from station to train car */}
        {Array.from(boardingAnimations.values()).map(animation => (
          <BoardingPassengerAnimation
            key={`boarding-${animation.passenger.id}`}
            animation={animation}
          />
        ))}

        {/* Disembarking animations - passengers moving from train car to station */}
        {Array.from(disembarkingAnimations.values()).map(animation => (
          <DisembarkingPassengerAnimation
            key={`disembarking-${animation.passenger.id}`}
            animation={animation}
          />
        ))}

        {/* Train cars - render in reverse order so locomotive appears on top */}
        {trainCars.map((carTransform, carIndex) => {
          // Assign passenger to this car (if one exists for this car index)
          const passenger = boardedPassengers[carIndex]

          return (
            <g
              key={`train-car-${carIndex}`}
              data-component="train-car"
              transform={`translate(${carTransform.x}, ${carTransform.y}) rotate(${carTransform.rotation}) scale(-1, 1)`}
              opacity={carTransform.opacity}
              style={{
                transition: 'opacity 0.5s ease-in'
              }}
            >
              {/* Train car */}
              <text
                data-element="train-car-body"
                x={0}
                y={0}
                textAnchor="middle"
                style={{
                  fontSize: '65px',
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                  pointerEvents: 'none'
                }}
              >
                🚃
              </text>

              {/* Passenger inside this car (hide if currently boarding) */}
              {passenger && !boardingAnimations.has(passenger.id) && (
                <text
                  data-element="car-passenger"
                  x={0}
                  y={0}
                  textAnchor="middle"
                  style={{
                    fontSize: '42px',
                    filter: passenger.isUrgent
                      ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))'
                      : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                    pointerEvents: 'none'
                  }}
                >
                  {passenger.avatar}
                </text>
              )}
            </g>
          )
        })}

        {/* Locomotive - rendered last so it appears on top */}
        <g
          data-component="locomotive-group"
          transform={`translate(${trainTransform.x}, ${trainTransform.y}) rotate(${trainTransform.rotation}) scale(-1, 1)`}
          opacity={locomotiveOpacity}
          style={{
            transition: 'opacity 0.5s ease-in'
          }}
        >
          {/* Train locomotive */}
          <text
            data-element="train-locomotive"
            x={0}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: '100px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              pointerEvents: 'none'
            }}
          >
            🚂
          </text>

          {/* Player engineer - layered over the train */}
          <text
            data-element="player-engineer"
            x={45}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: '70px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              pointerEvents: 'none'
            }}
          >
            {playerEmoji}
          </text>

          {/* Steam puffs - positioned at smokestack, layered over train */}
          {momentum > 10 && (
            <>
              {[0, 0.6, 1.2].map((delay, i) => (
                <circle
                  key={`steam-${i}`}
                  cx={-35}
                  cy={-35}
                  r="10"
                  fill="rgba(255, 255, 255, 0.6)"
                  style={{
                    filter: 'blur(4px)',
                    animation: `steamPuffSVG 2s ease-out infinite`,
                    animationDelay: `${delay}s`,
                    pointerEvents: 'none'
                  }}
                />
              ))}
            </>
          )}

          {/* Coal particles - animated when shoveling */}
          {momentum > 60 && (
            <>
              {[0, 0.3, 0.6].map((delay, i) => (
                <circle
                  key={`coal-${i}`}
                  cx={25}
                  cy={0}
                  r="3"
                  fill="#2c2c2c"
                  style={{
                    animation: 'coalFallingSVG 1.2s ease-out infinite',
                    animationDelay: `${delay}s`,
                    pointerEvents: 'none'
                  }}
                />
              ))}
            </>
          )}
        </g>
      </svg>

      {/* Pressure gauge */}
      <div data-component="pressure-gauge-container" style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        width: '120px'
      }}>
        <PressureGauge pressure={pressure} />
      </div>

      {/* Passenger cards - show all non-delivered passengers */}
      {nonDeliveredPassengers.length > 0 && (
        <div data-component="passenger-list" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: '8px',
          zIndex: 1000,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto'
        }}>
          {nonDeliveredPassengers.map(passenger => (
            <PassengerCard
              key={passenger.id}
              passenger={passenger}
              originStation={state.stations.find(s => s.id === passenger.originStationId)}
              destinationStation={state.stations.find(s => s.id === passenger.destinationStationId)}
            />
          ))}
        </div>
      )}

      {/* Question Display - centered at bottom, equation-focused */}
      {currentQuestion && (
        <div data-component="sprint-question-display" style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          padding: '28px 50px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 5px rgba(59, 130, 246, 0.4)',
          backdropFilter: 'blur(12px)',
          border: '4px solid rgba(255, 255, 255, 0.95)',
          zIndex: 1000
        }}>
          {/* Complement equation as main focus */}
          <div data-element="sprint-question-equation" style={{
            fontSize: '96px',
            fontWeight: 'bold',
            color: '#1f2937',
            lineHeight: '1.1',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            justifyContent: 'center'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              padding: '12px 32px',
              borderRadius: '16px',
              minWidth: '140px',
              display: 'inline-block',
              textShadow: '0 3px 10px rgba(0, 0, 0, 0.3)'
            }}>
              {currentInput || '?'}
            </span>
            <span style={{ color: '#6b7280' }}>+</span>
            <span>{currentQuestion.number}</span>
            <span style={{ color: '#6b7280' }}>=</span>
            <span style={{ color: '#10b981' }}>{currentQuestion.targetSum}</span>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes steamPuffSVG {
          0% {
            opacity: 0.8;
            transform: scale(0.5) translate(0, 0);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.5) translate(15px, -30px);
          }
          100% {
            opacity: 0;
            transform: scale(2) translate(25px, -60px);
          }
        }

        @keyframes coalFallingSVG {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: translate(5px, 15px) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translate(8px, 30px) scale(0.5);
          }
        }

        @keyframes celebrateDelivery {
          0% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          20% {
            transform: scale(1.3) translateY(-10px);
          }
          40% {
            transform: scale(1.2) translateY(-5px);
          }
          100% {
            opacity: 0;
            transform: scale(0.8) translateY(-20px);
          }
        }
      `}</style>
    </div>
  )
}