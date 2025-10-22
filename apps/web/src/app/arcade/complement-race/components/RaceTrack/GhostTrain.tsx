'use client'

import { useMemo, useRef } from 'react'
import type { PlayerState } from '@/arcade-games/complement-race/types'
import type { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'

// Overlap threshold: if ghost car is within this distance of any local car, make it ghostly
const OVERLAP_THRESHOLD = 20 // % of track length
const GHOST_OPACITY = 0.35 // Opacity when overlapping
const SOLID_OPACITY = 1.0 // Opacity when separated

interface GhostTrainProps {
  player: PlayerState
  trainPosition: number
  localTrainCarPositions: number[] // [locomotive, car1, car2, car3]
  maxCars: number
  carSpacing: number
  trackGenerator: RailroadTrackGenerator
  pathRef: React.RefObject<SVGPathElement>
}

interface CarTransform {
  x: number
  y: number
  rotation: number
  opacity: number
  position: number
}

/**
 * Calculate opacity for a ghost car based on distance to nearest local car
 */
function calculateCarOpacity(ghostCarPosition: number, localCarPositions: number[]): number {
  // Find minimum distance to any local car
  const minDistance = Math.min(
    ...localCarPositions.map((localPos) => Math.abs(ghostCarPosition - localPos))
  )

  // If within threshold, use ghost opacity; otherwise solid
  return minDistance < OVERLAP_THRESHOLD ? GHOST_OPACITY : SOLID_OPACITY
}

/**
 * GhostTrain - Renders a semi-transparent train for other players in multiplayer
 * Uses per-car adaptive opacity: cars are ghostly when overlapping local train,
 * solid when separated
 */
export function GhostTrain({
  player,
  trainPosition,
  localTrainCarPositions,
  maxCars,
  carSpacing,
  trackGenerator,
  pathRef,
}: GhostTrainProps) {
  const ghostRef = useRef<SVGGElement>(null)

  // Calculate ghost train locomotive transform and opacity
  const locomotiveTransform = useMemo<CarTransform | null>(() => {
    if (!pathRef.current) {
      return null
    }

    const pathLength = pathRef.current.getTotalLength()
    const targetDistance = (trainPosition / 100) * pathLength
    const point = pathRef.current.getPointAtLength(targetDistance)

    // Calculate tangent for rotation
    const tangentDelta = 1
    const tangentDistance = Math.min(targetDistance + tangentDelta, pathLength)
    const tangentPoint = pathRef.current.getPointAtLength(tangentDistance)
    const rotation =
      (Math.atan2(tangentPoint.y - point.y, tangentPoint.x - point.x) * 180) / Math.PI

    return {
      x: point.x,
      y: point.y,
      rotation,
      position: trainPosition,
      opacity: calculateCarOpacity(trainPosition, localTrainCarPositions),
    }
  }, [trainPosition, localTrainCarPositions, pathRef])

  // Calculate ghost train car transforms (each car behind locomotive)
  const carTransforms = useMemo<CarTransform[]>(() => {
    if (!pathRef.current) {
      return []
    }

    const pathLength = pathRef.current.getTotalLength()
    const cars: CarTransform[] = []

    for (let i = 0; i < maxCars; i++) {
      const carPosition = Math.max(0, trainPosition - (i + 1) * carSpacing)
      const targetDistance = (carPosition / 100) * pathLength
      const point = pathRef.current.getPointAtLength(targetDistance)

      // Calculate tangent for rotation
      const tangentDelta = 1
      const tangentDistance = Math.min(targetDistance + tangentDelta, pathLength)
      const tangentPoint = pathRef.current.getPointAtLength(tangentDistance)
      const rotation =
        (Math.atan2(tangentPoint.y - point.y, tangentPoint.x - point.x) * 180) / Math.PI

      cars.push({
        x: point.x,
        y: point.y,
        rotation,
        position: carPosition,
        opacity: calculateCarOpacity(carPosition, localTrainCarPositions),
      })
    }

    return cars
  }, [trainPosition, maxCars, carSpacing, localTrainCarPositions, pathRef])

  // Don't render if position data isn't ready
  if (!locomotiveTransform) {
    return null
  }

  return (
    <g ref={ghostRef} data-component="ghost-train" data-player-id={player.id}>
      {/* Ghost locomotive */}
      <g
        transform={`translate(${locomotiveTransform.x}, ${locomotiveTransform.y}) rotate(${locomotiveTransform.rotation}) scale(-1, 1)`}
        opacity={locomotiveTransform.opacity}
        style={{
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        <text
          data-element="ghost-locomotive"
          x={0}
          y={0}
          textAnchor="middle"
          style={{
            fontSize: '100px',
            filter: `drop-shadow(0 2px 8px ${player.color || 'rgba(100, 100, 255, 0.6)'})`,
            pointerEvents: 'none',
          }}
        >
          🚂
        </text>

        {/* Player name label - positioned above locomotive */}
        <text
          data-element="ghost-label"
          x={0}
          y={-60}
          textAnchor="middle"
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            fill: player.color || '#6366f1',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
            pointerEvents: 'none',
            transform: 'scaleX(-1)', // Counter the parent's scaleX(-1)
          }}
        >
          {player.name || `Player ${player.id.slice(0, 4)}`}
        </text>

        {/* Score indicator - positioned below locomotive */}
        <text
          data-element="ghost-score"
          x={0}
          y={50}
          textAnchor="middle"
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            fill: 'rgba(255, 255, 255, 0.9)',
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5))',
            pointerEvents: 'none',
            transform: 'scaleX(-1)', // Counter the parent's scaleX(-1)
          }}
        >
          {player.score}
        </text>
      </g>

      {/* Ghost cars - each with individual opacity */}
      {carTransforms.map((car, index) => (
        <g
          key={`car-${index}`}
          transform={`translate(${car.x}, ${car.y}) rotate(${car.rotation}) scale(-1, 1)`}
          opacity={car.opacity}
          style={{
            transition: 'opacity 0.3s ease-in-out',
          }}
        >
          <text
            data-element={`ghost-car-${index}`}
            x={0}
            y={0}
            textAnchor="middle"
            style={{
              fontSize: '85px',
              filter: `drop-shadow(0 2px 6px ${player.color || 'rgba(100, 100, 255, 0.4)'})`,
              pointerEvents: 'none',
            }}
          >
            🚃
          </text>
        </g>
      ))}
    </g>
  )
}
