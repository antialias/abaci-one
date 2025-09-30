'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceProvider } from '../context/ComplementRaceContext'
import { ComplementRaceGame } from '../components/ComplementRaceGame'

export default function SurvivalModePage() {
  return (
    <PageWithNav navTitle="Survival Mode" navEmoji="🔄">
      <ComplementRaceProvider initialStyle="survival">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
