'use client'

import { useEffect, useRef, useState } from 'react'
import { useSteamJourney } from '../../hooks/useSteamJourney'
import { useComplementRace } from '../../context/ComplementRaceContext'
import { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'
import { PassengerCard } from '../PassengerCard'
import { getRouteTheme } from '../../lib/routeThemes'
import { generateLandmarks, type Landmark } from '../../lib/landmarks'
import { PressureGauge } from '../PressureGauge'

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
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '250px',
      background: `linear-gradient(to bottom, ${skyGradient.top}, ${skyGradient.bottom})`,
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      marginTop: '10px',
      marginBottom: '10px',
      transition: 'background 2s ease-in-out',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Route and time of day indicator */}
      <div style={{
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
      <div style={{
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
        ref={svgRef}
        viewBox="0 0 800 600"
        style={{
          width: '100%',
          maxWidth: '1400px',
          height: 'auto',
          aspectRatio: '800 / 600'
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
            fontSize={(landmarks[index]?.size || 24) * 1.5}
            style={{
              pointerEvents: 'none',
              opacity: 0.7,
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))'
            }}
          >
            {landmarks[index]?.emoji}
          </text>
        ))}

        {/* Station markers */}
        {stationPositions.map((pos, index) => (
          <g key={`station-${index}`}>
            {/* Station platform */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r="12"
              fill="#8B4513"
              stroke="#654321"
              strokeWidth="3"
            />
            {/* Station icon */}
            <text
              x={pos.x}
              y={pos.y - 28}
              textAnchor="middle"
              fontSize="32"
              style={{ pointerEvents: 'none' }}
            >
              {state.stations[index]?.icon}
            </text>
            {/* Station name */}
            <text
              x={pos.x}
              y={pos.y + 40}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#1f2937"
              style={{ pointerEvents: 'none' }}
            >
              {state.stations[index]?.name}
            </text>
          </g>
        ))}

        {/* Train group with flip and rotation */}
        <g transform={`translate(${trainTransform.x}, ${trainTransform.y}) rotate(${trainTransform.rotation}) scale(-1, 1)`}>
          {/* Train locomotive */}
          <text
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

          {/* Coal shoveler - always visible behind the train */}
          <text
            x={45}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: '70px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
              pointerEvents: 'none'
            }}
          >
            👷
          </text>
        </g>

        {/* Steam puffs - animated */}
        {momentum > 10 && (
          <>
            {[0, 0.6, 1.2].map((delay, i) => (
              <circle
                key={`steam-${i}`}
                cx={trainTransform.x}
                cy={trainTransform.y - 20}
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
                cx={trainTransform.x - 25}
                cy={trainTransform.y}
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
      </svg>

      {/* Pressure gauge */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        zIndex: 10,
        width: '120px'
      }}>
        <PressureGauge pressure={pressure} />
      </div>

      {/* Distance traveled */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#1f2937',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 10
      }}>
        <div style={{ marginBottom: '4px' }}>
          🚩 {Math.round(trainPosition)}%
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          Total: {state.cumulativeDistance + Math.round(trainPosition)}%
        </div>
      </div>

      {/* Passenger cards */}
      {state.passengers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '130px',
          right: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 10
        }}>
          {state.passengers.map(passenger => (
            <PassengerCard
              key={passenger.id}
              passenger={passenger}
              destinationStation={state.stations.find(s => s.id === passenger.destinationStationId)}
            />
          ))}
        </div>
      )}

      {/* Question Display - centered at bottom */}
      {currentQuestion && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          zIndex: 10
        }}>
          {/* Question */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            textAlign: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280',
              marginBottom: '2px'
            }}>
              ? + {currentQuestion.number} = {currentQuestion.targetSum}
            </div>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#1f2937'
            }}>
              {currentQuestion.number}
            </div>
          </div>

          {/* Input */}
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '12px',
            padding: '12px 28px',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
            textAlign: 'center',
            minWidth: '120px'
          }}>
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              minHeight: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
            }}>
              {currentInput || '_'}
            </div>
            <div style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.9)',
              marginTop: '2px'
            }}>
              Type answer
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes steamPuffSVG {
          0% {
            opacity: 0.8;
            transform: scale(0.5) translateY(0);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.5) translateY(-30px);
          }
          100% {
            opacity: 0;
            transform: scale(2) translateY(-60px);
          }
        }

        @keyframes coalFallingSVG {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          50% {
            opacity: 0.7;
            transform: translateY(15px) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translateY(30px) scale(0.5);
          }
        }
      `}</style>
    </div>
  )
}