import { useCallback, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import {
  pickCombo,
  buildPartyCombo,
  emojiForStride,
  wouldExceedLcmLimit,
} from './lcmComboGenerator'
import { setActiveCombo, clearGuess } from './renderLcmHopperOverlay'
import { DYNAMIC_DEMO_VIEWPORTS } from '../constants/demos/useConstantDemo'
import { NARRATION_CONFIGS } from '../constants/demos/narrationConfigs'
import { buildLcmHopperNarration } from './lcmHopperNarration'
import type { PartyState } from '../primes/PrimeTooltip'

interface UseLcmHopperPartyOptions {
  demoStateRef: MutableRefObject<{ phase: string }>
  narration: { reset: () => void }
  startDemo: (id: string) => void
  cancelDemo: () => void
  onDismissTooltip: () => void
}

export function useLcmHopperParty({
  demoStateRef,
  narration,
  startDemo,
  cancelDemo,
  onDismissTooltip,
}: UseLcmHopperPartyOptions) {
  const lcmRoundRef = useRef(0)
  const [partyInvitees, setPartyInvitees] = useState<number[]>([])
  const partyInviteesRef = useRef<number[]>([])
  partyInviteesRef.current = partyInvitees

  const startLcmHopperDemo = useCallback(() => {
    const combo = pickCombo(lcmRoundRef.current)
    lcmRoundRef.current++
    setActiveCombo(combo)
    clearGuess()
    DYNAMIC_DEMO_VIEWPORTS.set('lcm_hopper', (cssWidth) => {
      const padding = Math.max(2, combo.lcm * 0.1)
      const range = combo.lcm + padding * 2
      const center = combo.lcm / 2
      const pixelsPerUnit = cssWidth / range
      return { center, pixelsPerUnit }
    })
    NARRATION_CONFIGS['lcm_hopper'] = buildLcmHopperNarration(combo)
    narration.reset()
    startDemo('lcm_hopper')
  }, [narration, startDemo])

  const handleToggleInvite = useCallback(
    (value: number) => {
      setPartyInvitees((prev) => {
        if (prev.includes(value)) {
          return prev.filter((v) => v !== value)
        }
        if (prev.length >= 3) return prev
        if (wouldExceedLcmLimit(prev, value)) return prev
        return [...prev, value]
      })
      onDismissTooltip()
    },
    [onDismissTooltip]
  )

  const startHoppingParty = useCallback(() => {
    if (partyInviteesRef.current.length < 2) return
    const combo = buildPartyCombo(partyInviteesRef.current)
    setActiveCombo(combo)
    clearGuess()
    DYNAMIC_DEMO_VIEWPORTS.set('lcm_hopper', (cssWidth) => {
      const padding = Math.max(2, combo.lcm * 0.1)
      const range = combo.lcm + padding * 2
      const center = combo.lcm / 2
      const pixelsPerUnit = cssWidth / range
      return { center, pixelsPerUnit }
    })
    NARRATION_CONFIGS['lcm_hopper'] = buildLcmHopperNarration(combo)
    narration.reset()
    startDemo('lcm_hopper')
  }, [narration, startDemo])

  const handleDismissPartyDemo = useCallback(() => {
    cancelDemo()
    setPartyInvitees([])
  }, [cancelDemo])

  const getPartyState = useCallback(
    (value: number): PartyState | undefined => {
      if (value < 2) return undefined
      const demoPhase = demoStateRef.current.phase
      if (demoPhase !== 'idle') return undefined
      const invited = partyInvitees.includes(value)
      const emoji = emojiForStride(value)
      if (invited) {
        return { invited: true, canInvite: true, emoji }
      }
      if (partyInvitees.length >= 3) {
        return { invited: false, canInvite: false, rejectReason: 'Party full (max 3)', emoji }
      }
      if (partyInvitees.length > 0 && wouldExceedLcmLimit(partyInvitees, value)) {
        return {
          invited: false,
          canInvite: false,
          rejectReason: 'LCM would be too large',
          emoji,
        }
      }
      return { invited: false, canInvite: true, emoji }
    },
    [partyInvitees, demoStateRef]
  )

  return {
    partyInvitees,
    setPartyInvitees,
    startLcmHopperDemo,
    handleToggleInvite,
    startHoppingParty,
    handleDismissPartyDemo,
    getPartyState,
  }
}
