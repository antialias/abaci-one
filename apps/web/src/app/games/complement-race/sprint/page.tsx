'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from '../components/ComplementRaceGame'
import { ComplementRaceProvider } from '../context/ComplementRaceContext'

export default function SprintModePage() {
  return (
    <PageWithNav navTitle="Steam Sprint" navEmoji="🚂" gameName="complement-race">
      <ComplementRaceProvider initialStyle="sprint">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
