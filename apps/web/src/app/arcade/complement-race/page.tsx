'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from './components/ComplementRaceGame'
import { ComplementRaceProvider } from '@/arcade-games/complement-race/Provider'

export default function ComplementRacePage() {
  return (
    <PageWithNav navTitle="Speed Complement Race" navEmoji="🏁">
      <ComplementRaceProvider>
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
