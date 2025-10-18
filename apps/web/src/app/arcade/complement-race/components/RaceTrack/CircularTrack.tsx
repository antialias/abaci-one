'use client'

import { useEffect, useState } from 'react'
import { useGameMode } from '@/contexts/GameModeContext'
import { useUserProfile } from '@/contexts/UserProfileContext'
import { useComplementRace } from '@/arcade-games/complement-race/Provider'
import { useSoundEffects } from '../../hooks/useSoundEffects'
import type { AIRacer } from '../../lib/gameTypes'
import { SpeechBubble } from '../AISystem/SpeechBubble'

interface CircularTrackProps {
  playerProgress: number
  playerLap: number
  aiRacers: AIRacer[]
  aiLaps: Map<string, number>
}

export function CircularTrack({ playerProgress, playerLap, aiRacers, aiLaps }: CircularTrackProps) {
  const { state, dispatch } = useComplementRace()
  const { players, activePlayers } = useGameMode()
  const { profile: _profile } = useUserProfile()
  const { playSound } = useSoundEffects()
  const [celebrationCooldown, setCelebrationCooldown] = useState<Set<string>>(new Set())

  // Get the current user's active local players (consistent with navbar pattern)
  const activeLocalPlayers = Array.from(activePlayers)
    .map((id) => players.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined && p.isLocal !== false)
  const playerEmoji = activeLocalPlayers[0]?.emoji ?? '👤'
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 })

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const isLandscape = vw > vh

      if (isLandscape) {
        // Landscape: wider track (emphasize horizontal straights)
        const width = Math.min(vw * 0.75, 800)
        const height = Math.min(vh * 0.5, 350)
        setDimensions({ width, height })
      } else {
        // Portrait: taller track (emphasize vertical straights)
        const width = Math.min(vw * 0.85, 350)
        const height = Math.min(vh * 0.5, 550)
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const padding = 40
  const trackWidth = dimensions.width - padding * 2
  const trackHeight = dimensions.height - padding * 2

  // For a rounded rectangle track, we have straight sections and curved ends
  const straightLength = Math.max(trackWidth, trackHeight) - Math.min(trackWidth, trackHeight)
  const radius = Math.min(trackWidth, trackHeight) / 2
  const isHorizontal = trackWidth > trackHeight

  // Calculate position on rounded rectangle track
  const getCircularPosition = (progress: number) => {
    const progressPerLap = 50
    const normalizedProgress = (progress % progressPerLap) / progressPerLap

    // Track perimeter consists of: 2 straights + 2 semicircles
    const straightPerim = straightLength
    const curvePerim = Math.PI * radius
    const totalPerim = 2 * straightPerim + 2 * curvePerim

    const distanceAlongTrack = normalizedProgress * totalPerim

    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2

    let x: number, y: number, angle: number

    if (isHorizontal) {
      // Horizontal track: straight sections on top/bottom, curves on left/right
      const topStraightEnd = straightPerim
      const rightCurveEnd = topStraightEnd + curvePerim
      const bottomStraightEnd = rightCurveEnd + straightPerim
      const _leftCurveEnd = bottomStraightEnd + curvePerim

      if (distanceAlongTrack < topStraightEnd) {
        // Top straight (moving right)
        const t = distanceAlongTrack / straightPerim
        x = centerX - straightLength / 2 + t * straightLength
        y = centerY - radius
        angle = 90
      } else if (distanceAlongTrack < rightCurveEnd) {
        // Right curve
        const curveProgress = (distanceAlongTrack - topStraightEnd) / curvePerim
        const curveAngle = curveProgress * Math.PI - Math.PI / 2
        x = centerX + straightLength / 2 + radius * Math.cos(curveAngle)
        y = centerY + radius * Math.sin(curveAngle)
        angle = curveProgress * 180 + 90
      } else if (distanceAlongTrack < bottomStraightEnd) {
        // Bottom straight (moving left)
        const t = (distanceAlongTrack - rightCurveEnd) / straightPerim
        x = centerX + straightLength / 2 - t * straightLength
        y = centerY + radius
        angle = 270
      } else {
        // Left curve
        const curveProgress = (distanceAlongTrack - bottomStraightEnd) / curvePerim
        const curveAngle = curveProgress * Math.PI + Math.PI / 2
        x = centerX - straightLength / 2 + radius * Math.cos(curveAngle)
        y = centerY + radius * Math.sin(curveAngle)
        angle = curveProgress * 180 + 270
      }
    } else {
      // Vertical track: straight sections on left/right, curves on top/bottom
      const leftStraightEnd = straightPerim
      const bottomCurveEnd = leftStraightEnd + curvePerim
      const rightStraightEnd = bottomCurveEnd + straightPerim
      const _topCurveEnd = rightStraightEnd + curvePerim

      if (distanceAlongTrack < leftStraightEnd) {
        // Left straight (moving down)
        const t = distanceAlongTrack / straightPerim
        x = centerX - radius
        y = centerY - straightLength / 2 + t * straightLength
        angle = 180
      } else if (distanceAlongTrack < bottomCurveEnd) {
        // Bottom curve
        const curveProgress = (distanceAlongTrack - leftStraightEnd) / curvePerim
        const curveAngle = curveProgress * Math.PI
        x = centerX + radius * Math.cos(curveAngle)
        y = centerY + straightLength / 2 + radius * Math.sin(curveAngle)
        angle = curveProgress * 180 + 180
      } else if (distanceAlongTrack < rightStraightEnd) {
        // Right straight (moving up)
        const t = (distanceAlongTrack - bottomCurveEnd) / straightPerim
        x = centerX + radius
        y = centerY + straightLength / 2 - t * straightLength
        angle = 0
      } else {
        // Top curve
        const curveProgress = (distanceAlongTrack - rightStraightEnd) / curvePerim
        const curveAngle = curveProgress * Math.PI + Math.PI
        x = centerX + radius * Math.cos(curveAngle)
        y = centerY - straightLength / 2 + radius * Math.sin(curveAngle)
        angle = curveProgress * 180
      }
    }

    return { x, y, angle }
  }

  // Check for lap completions and show celebrations
  useEffect(() => {
    // Check player lap
    const playerCurrentLap = Math.floor(playerProgress / 50)
    if (playerCurrentLap > playerLap && !celebrationCooldown.has('player')) {
      dispatch({ type: 'COMPLETE_LAP', racerId: 'player' })
      // Play celebration sound (line 12801)
      playSound('lap_celebration', 0.6)
      setCelebrationCooldown((prev) => new Set(prev).add('player'))
      setTimeout(() => {
        setCelebrationCooldown((prev) => {
          const next = new Set(prev)
          next.delete('player')
          return next
        })
      }, 2000)
    }

    // Check AI laps
    aiRacers.forEach((racer) => {
      const aiCurrentLap = Math.floor(racer.position / 50)
      const aiPreviousLap = aiLaps.get(racer.id) || 0
      if (aiCurrentLap > aiPreviousLap && !celebrationCooldown.has(racer.id)) {
        dispatch({ type: 'COMPLETE_LAP', racerId: racer.id })
        setCelebrationCooldown((prev) => new Set(prev).add(racer.id))
        setTimeout(() => {
          setCelebrationCooldown((prev) => {
            const next = new Set(prev)
            next.delete(racer.id)
            return next
          })
        }, 2000)
      }
    })
  }, [
    playerProgress,
    playerLap,
    aiRacers,
    aiLaps,
    celebrationCooldown,
    dispatch, // Play celebration sound (line 12801)
    playSound,
  ])

  const playerPos = getCircularPosition(playerProgress)

  // Create rounded rectangle path with wider curves (banking effect)
  const createRoundedRectPath = (radiusOffset: number, isOuter: boolean = false) => {
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2

    // Make curves wider by increasing radius more on outer edges
    const curveWidthBonus = isOuter ? radiusOffset * 0.15 : radiusOffset * -0.1
    const r = radius + radiusOffset + curveWidthBonus

    if (isHorizontal) {
      // Horizontal track - curved ends on left/right
      const leftCenterX = centerX - straightLength / 2
      const rightCenterX = centerX + straightLength / 2
      const curveTopY = centerY - r
      const curveBottomY = centerY + r

      return `
        M ${leftCenterX} ${curveTopY}
        L ${rightCenterX} ${curveTopY}
        A ${r} ${r} 0 0 1 ${rightCenterX} ${curveBottomY}
        L ${leftCenterX} ${curveBottomY}
        A ${r} ${r} 0 0 1 ${leftCenterX} ${curveTopY}
        Z
      `
    } else {
      // Vertical track - curved ends on top/bottom
      const topCenterY = centerY - straightLength / 2
      const bottomCenterY = centerY + straightLength / 2
      const curveLeftX = centerX - r
      const curveRightX = centerX + r

      return `
        M ${curveLeftX} ${topCenterY}
        L ${curveLeftX} ${bottomCenterY}
        A ${r} ${r} 0 0 0 ${curveRightX} ${bottomCenterY}
        L ${curveRightX} ${topCenterY}
        A ${r} ${r} 0 0 0 ${curveLeftX} ${topCenterY}
        Z
      `
    }
  }

  return (
    <div
      data-component="circular-track"
      style={{
        position: 'relative',
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        margin: '0 auto',
      }}
    >
      {/* SVG Track */}
      <svg
        data-component="track-svg"
        width={dimensions.width}
        height={dimensions.height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {/* Infield grass */}
        <path d={createRoundedRectPath(15, false)} fill="#7cb342" stroke="none" />

        {/* Track background - reddish clay color */}
        <path d={createRoundedRectPath(-10, true)} fill="#d97757" stroke="none" />

        {/* Track outer edge - white boundary */}
        <path d={createRoundedRectPath(-15, true)} fill="none" stroke="white" strokeWidth="3" />

        {/* Track inner edge - white boundary */}
        <path d={createRoundedRectPath(15, false)} fill="none" stroke="white" strokeWidth="3" />

        {/* Lane markers - dashed white lines */}
        {[-5, 0, 5].map((offset) => (
          <path
            key={offset}
            d={createRoundedRectPath(offset, offset < 0)}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="8 8"
            opacity="0.6"
          />
        ))}

        {/* Start/Finish line - checkered flag pattern */}
        {(() => {
          const centerX = dimensions.width / 2
          const centerY = dimensions.height / 2
          const trackThickness = 35 // Track width from inner to outer edge

          if (isHorizontal) {
            // Horizontal track: vertical finish line crossing the top straight
            const x = centerX
            const yStart = centerY - radius - 18 // Outer edge
            const squareSize = trackThickness / 6
            const lineWidth = 12
            return (
              <g>
                {/* Checkered pattern - vertical line */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <rect
                    key={i}
                    x={x - lineWidth / 2}
                    y={yStart + squareSize * i}
                    width={lineWidth}
                    height={squareSize}
                    fill={i % 2 === 0 ? 'black' : 'white'}
                  />
                ))}
              </g>
            )
          } else {
            // Vertical track: horizontal finish line crossing the left straight
            const xStart = centerX - radius - 18 // Outer edge
            const y = centerY
            const squareSize = trackThickness / 6
            const lineWidth = 12
            return (
              <g>
                {/* Checkered pattern - horizontal line */}
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <rect
                    key={i}
                    x={xStart + squareSize * i}
                    y={y - lineWidth / 2}
                    width={squareSize}
                    height={lineWidth}
                    fill={i % 2 === 0 ? 'black' : 'white'}
                  />
                ))}
              </g>
            )
          }
        })()}

        {/* Distance markers (quarter points) */}
        {[0.25, 0.5, 0.75].map((fraction) => {
          const pos = getCircularPosition(fraction * 50)
          const markerLength = 12
          const perpAngle = (pos.angle + 90) * (Math.PI / 180)
          const x1 = pos.x - markerLength * Math.cos(perpAngle)
          const y1 = pos.y - markerLength * Math.sin(perpAngle)
          const x2 = pos.x + markerLength * Math.cos(perpAngle)
          const y2 = pos.y + markerLength * Math.sin(perpAngle)
          return (
            <line
              key={fraction}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )
        })}
      </svg>

      {/* Player racer */}
      <div
        style={{
          position: 'absolute',
          left: `${playerPos.x}px`,
          top: `${playerPos.y}px`,
          transform: `translate(-50%, -50%) rotate(${playerPos.angle}deg)`,
          fontSize: '32px',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
          zIndex: 10,
          transition: 'left 0.3s ease-out, top 0.3s ease-out',
        }}
      >
        {playerEmoji}
      </div>

      {/* AI racers */}
      {aiRacers.map((racer, _index) => {
        const aiPos = getCircularPosition(racer.position)
        const activeBubble = state.activeSpeechBubbles.get(racer.id)

        return (
          <div
            key={racer.id}
            style={{
              position: 'absolute',
              left: `${aiPos.x}px`,
              top: `${aiPos.y}px`,
              transform: `translate(-50%, -50%) rotate(${aiPos.angle}deg)`,
              fontSize: '28px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              zIndex: 5,
              transition: 'left 0.2s linear, top 0.2s linear',
            }}
          >
            {racer.icon}
            {activeBubble && (
              <div
                style={{
                  transform: `rotate(${-aiPos.angle}deg)`, // Counter-rotate bubble
                }}
              >
                <SpeechBubble
                  message={activeBubble}
                  onHide={() => dispatch({ type: 'CLEAR_AI_COMMENT', racerId: racer.id })}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Lap counter */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '50%',
          width: '120px',
          height: '120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '3px solid #3b82f6',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '4px',
            fontWeight: 'bold',
          }}
        >
          Lap
        </div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: '#3b82f6',
          }}
        >
          {playerLap + 1}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginTop: '4px',
          }}
        >
          {Math.floor(((playerProgress % 50) / 50) * 100)}%
        </div>
      </div>

      {/* Lap celebration */}
      {celebrationCooldown.has('player') && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 'bold',
            boxShadow: '0 4px 20px rgba(251, 191, 36, 0.4)',
            animation: 'bounce 0.5s ease',
            zIndex: 100,
          }}
        >
          🎉 Lap {playerLap + 1} Complete! 🎉
        </div>
      )}
    </div>
  )
}
