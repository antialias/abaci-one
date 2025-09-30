'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { ComplementRaceProvider } from '../context/ComplementRaceContext'
import { ComplementRaceGame } from '../components/ComplementRaceGame'

export default function PracticeModePage() {
  return (
    <PageWithNav navTitle="Practice Mode" navEmoji="🏁">
      <ComplementRaceProvider initialStyle="practice">
        <ComplementRaceGame />
      </ComplementRaceProvider>
    </PageWithNav>
  )
}
