'use client'

import { useEffect, useState } from 'react'
import { useComplementRace } from '../context/ComplementRaceContext'
import { useGameLoop } from '../hooks/useGameLoop'
import { useSoundEffects } from '../hooks/useSoundEffects'

export function GameCountdown() {
  const { dispatch } = useComplementRace()
  const { playSound } = useSoundEffects()
  const [count, setCount] = useState(3)
  const [showGo, setShowGo] = useState(false)

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCount(prevCount => {
        if (prevCount > 1) {
          // Play countdown beep (volume 0.4)
          playSound('countdown', 0.4)
          return prevCount - 1
        } else if (prevCount === 1) {
          // Show GO!
          setShowGo(true)
          // Play race start fanfare (volume 0.6)
          playSound('race_start', 0.6)
          return 0
        }
        return prevCount
      })
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [playSound])

  useEffect(() => {
    if (showGo) {
      // Hide countdown and start game after GO animation
      const timer = setTimeout(() => {
        dispatch({ type: 'BEGIN_GAME' })
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [showGo, dispatch])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.9)',
      zIndex: 1000
    }}>
      <div style={{
        fontSize: showGo ? '120px' : '160px',
        fontWeight: 'bold',
        color: showGo ? '#10b981' : 'white',
        textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        animation: showGo ? 'scaleUp 1s ease-out' : 'pulse 0.5s ease-in-out',
        transition: 'all 0.3s ease'
      }}>
        {showGo ? 'GO!' : count}
      </div>

      {!showGo && (
        <div style={{
          marginTop: '32px',
          fontSize: '24px',
          color: 'rgba(255, 255, 255, 0.8)',
          fontWeight: '500'
        }}>
          Get Ready!
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
          @keyframes scaleUp {
            0% { transform: scale(0.5); opacity: 0; }
            50% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `
      }} />
    </div>
  )
}