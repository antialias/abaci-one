'use client'

import type { AIRacer } from '../../lib/gameTypes'
import { SpeechBubble } from '../AISystem/SpeechBubble'
import { useComplementRace } from '../../context/ComplementRaceContext'
import { useGameMode } from '@/contexts/GameModeContext'
import { useUserProfile } from '@/contexts/UserProfileContext'

interface LinearTrackProps {
  playerProgress: number
  aiRacers: AIRacer[]
  raceGoal: number
  showFinishLine?: boolean
}

export function LinearTrack({ playerProgress, aiRacers, raceGoal, showFinishLine = true }: LinearTrackProps) {
  const { state, dispatch } = useComplementRace()
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

  // Position calculation: leftPercent = Math.min(98, (progress / raceGoal) * 96 + 2)
  // 2% minimum (start), 98% maximum (near finish), 96% range for race
  const getPosition = (progress: number) => {
    return Math.min(98, (progress / raceGoal) * 96 + 2)
  }

  const playerPosition = getPosition(playerProgress)

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '200px',
      background: 'linear-gradient(to bottom, #87ceeb 0%, #e0f2fe 50%, #90ee90 50%, #d4f1d4 100%)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      marginTop: '20px'
    }}>
      {/* Track lines */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: '2px',
        background: 'rgba(0, 0, 0, 0.1)',
        transform: 'translateY(-50%)'
      }} />

      <div style={{
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        height: '1px',
        background: 'rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-50%)'
      }} />

      <div style={{
        position: 'absolute',
        top: '60%',
        left: 0,
        right: 0,
        height: '1px',
        background: 'rgba(0, 0, 0, 0.05)',
        transform: 'translateY(-50%)'
      }} />

      {/* Finish line */}
      {showFinishLine && (
        <div style={{
          position: 'absolute',
          right: '2%',
          top: 0,
          bottom: 0,
          width: '4px',
          background: 'repeating-linear-gradient(0deg, black 0px, black 10px, white 10px, white 20px)',
          boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)'
        }} />
      )}

      {/* Player racer */}
      <div style={{
        position: 'absolute',
        left: `${playerPosition}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '32px',
        transition: 'left 0.3s ease-out',
        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
        zIndex: 10
      }}>
        {playerEmoji}
      </div>

      {/* AI racers */}
      {aiRacers.map((racer, index) => {
        const aiPosition = getPosition(racer.position)
        const activeBubble = state.activeSpeechBubbles.get(racer.id)

        return (
          <div
            key={racer.id}
            style={{
              position: 'absolute',
              left: `${aiPosition}%`,
              top: `${35 + (index * 15)}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: '28px',
              transition: 'left 0.2s linear',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
              zIndex: 5
            }}
          >
            {racer.icon}
            {activeBubble && (
              <SpeechBubble
                message={activeBubble}
                onHide={() => dispatch({ type: 'CLEAR_AI_COMMENT', racerId: racer.id })}
              />
            )}
          </div>
        )
      })}

      {/* Progress indicator */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        left: '10px',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '6px 12px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#1f2937',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {playerProgress} / {raceGoal}
      </div>
    </div>
  )
}