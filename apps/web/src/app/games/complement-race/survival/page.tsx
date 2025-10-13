'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceGame } from '../components/ComplementRaceGame'
import { ComplementRaceProvider } from '../context/ComplementRaceContext'

export default function SurvivalModePage() {
  return (
    <PageWithNav navTitle="Survival Mode" navEmoji="🔄" gameName="complement-race">
      <ComplementRaceProvider initialStyle="survival">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
