'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from './components/ComplementRaceGame'
import { ComplementRaceProvider } from './context/ComplementRaceContext'

export default function ComplementRacePage() {
  return (
    <PageWithNav navTitle="Speed Complement Race" navEmoji="🏁" gameName="complement-race">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
