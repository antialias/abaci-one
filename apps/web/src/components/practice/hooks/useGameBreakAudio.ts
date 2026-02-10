'use client'

import { useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { GAME_BREAK_ANNOUNCEMENT_CLIPS, PICK_A_GAME } from '@/lib/audio/clips/practice'

type GameBreakPhase = 'initializing' | 'auto-starting' | 'selecting' | 'playing' | 'completed'

interface UseGameBreakAudioOptions {
  phase: GameBreakPhase
  isVisible: boolean
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Speaks game break cues on phase transitions.
 *
 * - initializing → auto-starting: random game break announcement
 * - initializing → selecting: announcement + "Pick a game!" after delay
 */
export function useGameBreakAudio({ phase, isVisible }: UseGameBreakAudioOptions) {
  const prevPhaseRef = useRef<GameBreakPhase>(phase)

  const sayAnnouncement = useTTS(pickRandom(GAME_BREAK_ANNOUNCEMENT_CLIPS), {
    tone: 'celebration',
  })
  const sayPickAGame = useTTS(PICK_A_GAME, {
    tone: 'tutorial-instruction',
  })

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = phase

    if (!isVisible) return

    // initializing → auto-starting: announce the game break
    if (prevPhase === 'initializing' && phase === 'auto-starting') {
      sayAnnouncement(pickRandom(GAME_BREAK_ANNOUNCEMENT_CLIPS))
      return
    }

    // initializing → selecting: announce + pick a game after a short delay
    if (prevPhase === 'initializing' && phase === 'selecting') {
      sayAnnouncement(pickRandom(GAME_BREAK_ANNOUNCEMENT_CLIPS)).then(() => {
        sayPickAGame()
      })
      return
    }
  }, [phase, isVisible, sayAnnouncement, sayPickAGame])
}
