'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceProvider } from './context/ComplementRaceContext'
import { ComplementRaceGame } from './components/ComplementRaceGame'

export default function ComplementRacePage() {
  return (
    <PageWithNav navTitle="Speed Complement Race" navEmoji="🏁">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}