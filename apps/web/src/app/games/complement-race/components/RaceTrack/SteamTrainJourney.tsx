'use client'

import { useEffect, useRef, useState } from 'react'
import { useSteamJourney } from '../../hooks/useSteamJourney'
import { useComplementRace } from '../../context/ComplementRaceContext'
import { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { PassengerCard } from '../PassengerCard'
import { getRouteTheme } from '../../lib/routeThemes'
import { generateLandmarks, type Landmark } from '../../lib/landmarks'
import { PressureGauge } from '../PressureGauge'
import { useGameMode } from '@/contexts/GameModeContext'
import { useUserProfile } from '@/contexts/UserProfileContext'

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

  // Generate track on mount and when route changes
  useEffect(() => {
    const track = trackGenerator.generateTrack(state.currentRoute)
    setTrackData(track)
  }, [trackGenerator, state.currentRoute])

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
        {/* Railroad ballast (gravel bed) */}
        <path
          d={trackData.ballastPath}
          fill="none"
          stroke="#8B7355"
          strokeWidth="40"
          strokeLinecap="round"
        />

        {/* Left tunnel - at absolute left edge of viewBox (x = -50) */}
        <g data-element="left-tunnel">
          {/* Mountain face - extends from left edge */}
          <rect
            x="-50"
            y="-50"
            width="70"
            height="700"
            fill="#5a5a5a"
            stroke="#4a4a4a"
            strokeWidth="2"
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
          {/* Tunnel arch rim (stone) */}
          <path
            d="M -50 245 Q -50 235, 20 235 Q 70 235, 70 245"
            fill="none"
            stroke="#6a6a6a"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>

        {/* Right tunnel - at absolute right edge of viewBox (x = 850) */}
        <g data-element="right-tunnel">
          {/* Mountain face - extends to right edge */}
          <rect
            x="780"
            y="-50"
            width="70"
            height="700"
            fill="#5a5a5a"
            stroke="#4a4a4a"
            strokeWidth="2"
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
          {/* Tunnel arch rim (stone) */}
          <path
            d="M 730 245 Q 730 235, 780 235 Q 850 235, 850 245"
            fill="none"
            stroke="#6a6a6a"
            strokeWidth="6"
            strokeLinecap="round"
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
          // Find passengers waiting at this station
          const waitingPassengers = state.passengers.filter(p =>
            p.originStationId === station?.id && !p.isBoarded && !p.isDelivered
          )
          // Find passengers delivered at this station
          const deliveredPassengers = state.passengers.filter(p =>
            p.destinationStationId === station?.id && p.isDelivered
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
                  x={pos.x + (pIndex - waitingPassengers.length / 2 + 0.5) * 90}
                  y={pos.y - 100}
                  textAnchor="middle"
                  fontSize="80"
                  style={{
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
                  x={pos.x + (pIndex - deliveredPassengers.length / 2 + 0.5) * 90}
                  y={pos.y - 100}
                  textAnchor="middle"
                  fontSize="80"
                  style={{
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

        {/* Train group with flip and rotation */}
        <g data-component="train-group" transform={`translate(${trainTransform.x}, ${trainTransform.y}) rotate(${trainTransform.rotation}) scale(-1, 1)`}>
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

          {/* Boarded passengers riding on the train */}
          {state.passengers.filter(p => p.isBoarded && !p.isDelivered).map((passenger, index) => (
            <text
              key={`train-passenger-${passenger.id}`}
              x={90 + (index * 35)}
              y={5}
              textAnchor="middle"
              fontSize="28"
              style={{
                filter: passenger.isUrgent
                  ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.8))'
                  : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                pointerEvents: 'none'
              }}
            >
              {passenger.avatar}
            </text>
          ))}

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
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: 10,
        width: '120px'
      }}>
        <PressureGauge pressure={pressure} />
      </div>

      {/* Passenger cards - show all non-delivered passengers */}
      {state.passengers.filter(p => !p.isDelivered).length > 0 && (
        <div data-component="passenger-list" style={{
          position: 'absolute',
          bottom: '130px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 10,
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }}>
          {state.passengers.filter(p => !p.isDelivered).map(passenger => (
            <PassengerCard
              key={passenger.id}
              passenger={passenger}
              destinationStation={state.stations.find(s => s.id === passenger.destinationStationId)}
            />
          ))}
        </div>
      )}

      {/* Question Display - centered at bottom, equation-focused */}
      {currentQuestion && (
        <div data-component="sprint-question-display" style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '24px',
          padding: '28px 50px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5), 0 0 0 5px rgba(59, 130, 246, 0.4)',
          backdropFilter: 'blur(12px)',
          border: '4px solid rgba(255, 255, 255, 0.95)'
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