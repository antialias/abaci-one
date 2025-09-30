'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceProvider } from '../context/ComplementRaceContext'
import { ComplementRaceGame } from '../components/ComplementRaceGame'

export default function SprintModePage() {
  return (
    <PageWithNav navTitle="Steam Sprint" navEmoji="🚂">
      <ComplementRaceProvider initialStyle="sprint">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
