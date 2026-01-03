'use client'

import type React from 'react'
import { createContext, useContext, useMemo, useState } from 'react'
import type { PedagogicalSegment } from './DecompositionWithReasons'

type HintFocus = 'none' | 'term' | 'bead'

interface TutorialUIState {
  showCoachBar: boolean
  setShowCoachBar: (v: boolean) => void
  canHideCoachBar: boolean

  // Single-owner tooltip gate (tutorial-only)
  hintFocus: HintFocus
  requestFocus: (who: HintFocus) => boolean // returns true if granted
  releaseFocus: (who: HintFocus) => void

  // Currently active segment for Coach Bar
  activeSegment: PedagogicalSegment | null
  setActiveSegment: (seg: PedagogicalSegment | null) => void
}

const TutorialUIContext = createContext<TutorialUIState | undefined>(undefined)

export function TutorialUIProvider({
  children,
  initialSegment = null,
  canHideCoachBar = true,
}: {
  children: React.ReactNode
  initialSegment?: PedagogicalSegment | null
  canHideCoachBar?: boolean
}) {
  const [showCoachBar, setShowCoachBar] = useState(true)
  const [hintFocus, setHintFocus] = useState<HintFocus>('none')
  const [activeSegment, setActiveSegment] = useState<PedagogicalSegment | null>(initialSegment)

  const value: TutorialUIState = useMemo(
    () => ({
      showCoachBar,
      setShowCoachBar,
      canHideCoachBar,
      hintFocus,
      requestFocus: (who: HintFocus) => {
        if (hintFocus === 'none' || hintFocus === who) {
          setHintFocus(who)
          return true
        }
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[tutorial-ui] focus denied: ${who}, owned by ${hintFocus}`)
        }
        return false
      },
      releaseFocus: (who: HintFocus) => {
        if (hintFocus === who) setHintFocus('none')
      },
      activeSegment,
      setActiveSegment,
    }),
    [showCoachBar, canHideCoachBar, hintFocus, activeSegment]
  )

  return <TutorialUIContext.Provider value={value}>{children}</TutorialUIContext.Provider>
}

export function useTutorialUI(): TutorialUIState {
  const ctx = useContext(TutorialUIContext)
  if (!ctx) {
    throw new Error('useTutorialUI must be used within <TutorialUIProvider> (tutorial routes)')
  }
  return ctx
}
