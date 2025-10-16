/**
 * Complement Race Game Component with Navigation
 * Wraps the existing ComplementRaceGame with PageWithNav for arcade play
 */

'use client'

import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from '@/app/arcade/complement-race/components/ComplementRaceGame'
import { useComplementRace } from '../Provider'

export function GameComponent() {
  const router = useRouter()
  const { state, exitSession, goToSetup } = useComplementRace()

  // Get display name based on style
  const getNavTitle = () => {
    switch (state.style) {
      case 'sprint':
        return 'Steam Sprint'
      case 'survival':
        return 'Endless Circuit'
      case 'practice':
      default:
        return 'Complement Race'
    }
  }

  // Get emoji based on style
  const getNavEmoji = () => {
    switch (state.style) {
      case 'sprint':
        return '🚂'
      case 'survival':
        return '♾️'
      case 'practice':
      default:
        return '🏁'
    }
  }

  return (
    <PageWithNav
      navTitle={getNavTitle()}
      navEmoji={getNavEmoji()}
      emphasizePlayerSelection={state.gamePhase === 'controls'}
      onExitSession={() => {
        exitSession()
        router.push('/arcade')
      }}
      onNewGame={() => {
        goToSetup()
      }}
    >
      <ComplementRaceGame />
    </PageWithNav>
  )
}
