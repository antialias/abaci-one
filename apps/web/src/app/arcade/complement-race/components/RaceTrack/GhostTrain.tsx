'use client'

import { useMemo, useRef } from 'react'
import type { PlayerState } from '@/arcade-games/complement-race/types'
import type { RailroadTrackGenerator } from '../../lib/RailroadTrackGenerator'

interface GhostTrainProps {
  player: PlayerState
  trainPosition: number
  trackGenerator: RailroadTrackGenerator
  pathRef: React.RefObject<SVGPathElement>
}

/**
 * GhostTrain - Renders a semi-transparent train for other players in multiplayer
 * Shows opponent positions in real-time during steam sprint races
 */
export function GhostTrain({ player, trainPosition, trackGenerator, pathRef }: GhostTrainProps) {
  const ghostRef = useRef<SVGGElement>(null)

  console.log('[GhostTrain] Rendering ghost train for player:', {
    playerId: player.id,
    playerName: player.name,
    playerScore: player.score,
    playerColor: player.color,
    trainPosition,
  })

  // Calculate train transform using same logic as local player
  const trainTransform = useMemo(() => {
    if (!pathRef.current) {
      return { x: 0, y: 0, rotation: 0, opacity: 0 }
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
      opacity: 0.35, // Ghost effect - 35% opacity
    }
  }, [trainPosition, pathRef])

  // Don't render if position data isn't ready
  if (trainTransform.opacity === 0) {
    console.log('[GhostTrain] Not rendering - opacity is 0 (path not ready)', {
      playerId: player.id,
    })
    return null
  }

  console.log('[GhostTrain] Rendering visible ghost train:', {
    playerId: player.id,
    playerName: player.name,
    transform: trainTransform,
  })

  return (
    <g
      ref={ghostRef}
      data-component="ghost-train"
      data-player-id={player.id}
      transform={`translate(${trainTransform.x}, ${trainTransform.y}) rotate(${trainTransform.rotation}) scale(-1, 1)`}
      opacity={trainTransform.opacity}
      style={{
        transition: 'opacity 0.3s ease-in',
      }}
    >
      {/* Ghost locomotive */}
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

      {/* Player name label - positioned above train */}
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

      {/* Score indicator - positioned below train */}
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
  )
}
