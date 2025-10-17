'use client'

import { memo } from 'react'
import type { Passenger, Station } from '@/arcade-games/complement-race/types'
import type { Landmark } from '../../lib/landmarks'

interface RailroadTrackPathProps {
  tiesAndRails: {
    ties: Array<{ x1: number; y1: number; x2: number; y2: number }>
    leftRailPath: string
    rightRailPath: string
  } | null
  referencePath: string
  pathRef: React.RefObject<SVGPathElement>
  landmarkPositions: Array<{ x: number; y: number }>
  landmarks: Landmark[]
  stationPositions: Array<{ x: number; y: number }>
  stations: Station[]
  passengers: Passenger[]
  boardingAnimations: Map<string, unknown>
  disembarkingAnimations: Map<string, unknown>
}

export const RailroadTrackPath = memo(
  ({
    tiesAndRails,
    referencePath,
    pathRef,
    landmarkPositions,
    landmarks,
    stationPositions,
    stations,
    passengers,
    boardingAnimations,
    disembarkingAnimations,
  }: RailroadTrackPathProps) => {
    return (
      <>
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
        {tiesAndRails?.leftRailPath && (
          <path
            d={tiesAndRails.leftRailPath}
            fill="none"
            stroke="#C0C0C0"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Right rail */}
        {tiesAndRails?.rightRailPath && (
          <path
            d={tiesAndRails.rightRailPath}
            fill="none"
            stroke="#C0C0C0"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Reference path (invisible, used for positioning) */}
        <path ref={pathRef} d={referencePath} fill="none" stroke="transparent" strokeWidth="2" />

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
              filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2))',
            }}
          >
            {landmarks[index]?.emoji}
          </text>
        ))}

        {/* Station markers */}
        {stationPositions.map((pos, index) => {
          const station = stations[index]
          // Find passengers waiting at this station (exclude currently boarding)
          // Arcade room multiplayer uses claimedBy/deliveredBy instead of isBoarded/isDelivered
          const waitingPassengers = passengers.filter(
            (p) =>
              p.originStationId === station?.id &&
              p.claimedBy === null &&
              p.deliveredBy === null &&
              !boardingAnimations.has(p.id)
          )
          // Find passengers delivered at this station (exclude currently disembarking)
          const deliveredPassengers = passengers.filter(
            (p) =>
              p.destinationStationId === station?.id &&
              p.deliveredBy !== null &&
              !disembarkingAnimations.has(p.id)
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
                  paintOrder: 'stroke fill',
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
                    filter: passenger.isUrgent
                      ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))'
                      : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
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
                    animation: 'celebrateDelivery 2s ease-out forwards',
                  }}
                >
                  {passenger.avatar}
                </text>
              ))}
            </g>
          )
        })}
      </>
    )
  }
)

RailroadTrackPath.displayName = 'RailroadTrackPath'
