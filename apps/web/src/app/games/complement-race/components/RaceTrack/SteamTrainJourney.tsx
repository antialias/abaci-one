'use client'

import { useRef, useState, useMemo, memo } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { useSteamJourney } from '../../hooks/useSteamJourney'
import { usePassengerAnimations, type BoardingAnimation, type DisembarkingAnimation } from '../../hooks/usePassengerAnimations'
import { useTrainTransforms } from '../../hooks/useTrainTransforms'
import { useTrackManagement } from '../../hooks/useTrackManagement'
import { useComplementRace } from '../../context/ComplementRaceContext'
import { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { PassengerCard } from '../PassengerCard'
import { getRouteTheme } from '../../lib/routeThemes'
import { PressureGauge } from '../PressureGauge'
import { useGameMode } from '@/contexts/GameModeContext'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { TrainTerrainBackground } from './TrainTerrainBackground'
import { RailroadTrackPath } from './RailroadTrackPath'
import { TrainAndCars } from './TrainAndCars'

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

  // Track management (extracted to hook)
  const { trackData, tiesAndRails, stationPositions, landmarks, landmarkPositions, displayPassengers } = useTrackManagement({
    currentRoute: state.currentRoute,
    trainPosition,
    trackGenerator,
    pathRef,
    stations: state.stations,
    passengers: state.passengers
  })

  // Train transforms (extracted to hook)
  const { trainTransform, trainCars, locomotiveOpacity, maxCars, carSpacing } = useTrainTransforms({
    trainPosition,
    trackGenerator,
    pathRef
  })

  // Passenger animations (extracted to hook)
  const { boardingAnimations, disembarkingAnimations } = usePassengerAnimations({
    passengers: state.passengers,
    stations: state.stations,
    stationPositions,
    trainPosition,
    trackGenerator,
    pathRef
  })

  // Time remaining (60 seconds total)
  const timeRemaining = Math.max(0, 60 - Math.floor(elapsedTime / 1000))

  // Period names for display
  const periodNames = ['Dawn', 'Morning', 'Midday', 'Afternoon', 'Dusk', 'Night']

  // Get current route theme
  const routeTheme = getRouteTheme(state.currentRoute)


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
        {/* Terrain background - ground, mountains, and tunnels */}
        <TrainTerrainBackground
          ballastPath={trackData.ballastPath}
          groundTextureCircles={groundTextureCircles}
        />

        {/* Railroad track, landmarks, and stations */}
        <RailroadTrackPath
          tiesAndRails={tiesAndRails}
          referencePath={trackData.referencePath}
          pathRef={pathRef}
          landmarkPositions={landmarkPositions}
          landmarks={landmarks}
          stationPositions={stationPositions}
          stations={state.stations}
          passengers={state.passengers}
          boardingAnimations={boardingAnimations}
          disembarkingAnimations={disembarkingAnimations}
        />

        {/* Train, cars, and passenger animations */}
        <TrainAndCars
          boardingAnimations={boardingAnimations}
          disembarkingAnimations={disembarkingAnimations}
          BoardingPassengerAnimation={BoardingPassengerAnimation}
          DisembarkingPassengerAnimation={DisembarkingPassengerAnimation}
          trainCars={trainCars}
          boardedPassengers={boardedPassengers}
          trainTransform={trainTransform}
          locomotiveOpacity={locomotiveOpacity}
          playerEmoji={playerEmoji}
          momentum={momentum}
        />
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