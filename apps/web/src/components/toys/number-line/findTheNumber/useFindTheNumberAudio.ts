'use client'

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'
import type { ProximityZone, ProximityResult } from './computeProximity'

const HINT_COOLDOWN_MS = 15_000
const INACTIVITY_MS = 8_000

/**
 * Audio feedback for the "Find the Number" game.
 *
 * Plays TTS clips when the zone changes (warmer/colder/found) and
 * gives contextual voice hints when the child is stuck, reading live
 * proximity data from a ref to avoid stale state.
 */
export function useFindTheNumberAudio(
  zone: ProximityZone | null,
  proximityRef: RefObject<ProximityResult | null>,
  muted = false,
): void {
  const { isEnabled } = useAudioManager()
  const shouldPlay = isEnabled && !muted

  // --- Zone transition clips ---
  const speakWarmer = useTTS('find-warmer', {
    tone: 'encouragement',
    say: { en: 'Getting warmer!' },
  })
  const speakVeryClose = useTTS('find-very-close', {
    tone: 'encouragement',
    say: { en: 'Very close!' },
  })
  const speakFound = useTTS('find-found', {
    tone: 'celebration',
    say: { en: 'You found it! Great job!' },
  })
  const speakColder = useTTS('find-colder', {
    tone: 'corrective',
    say: { en: 'Getting colder!' },
  })

  // --- Hint clips ---
  const speakZoomIn = useTTS('find-hint-zoom-in', {
    tone: 'tutorial-instruction',
    say: { en: "You're in the right area! Try zooming in." },
  })
  const speakZoomOut = useTTS('find-hint-zoom-out', {
    tone: 'tutorial-instruction',
    say: { en: 'Try zooming out to see more of the number line.' },
  })
  const speakScrollLeft = useTTS('find-hint-scroll-left', {
    tone: 'tutorial-instruction',
    say: { en: 'The number is to the left. Try scrolling that way!' },
  })
  const speakScrollRight = useTTS('find-hint-scroll-right', {
    tone: 'tutorial-instruction',
    say: { en: 'The number is to the right. Try scrolling that way!' },
  })
  const speakClose = useTTS('find-hint-close', {
    tone: 'encouragement',
    say: { en: 'So close! Keep looking right around here.' },
  })

  const prevZoneRef = useRef<ProximityZone | null>(null)
  const lastZoneChangeRef = useRef(Date.now())
  const lastHintRef = useRef(0)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zone transition audio
  useEffect(() => {
    if (!shouldPlay || zone === null) {
      prevZoneRef.current = zone
      return
    }

    const prev = prevZoneRef.current
    prevZoneRef.current = zone

    if (prev === zone) return

    lastZoneChangeRef.current = Date.now()

    // Warmer transitions (improving)
    if (zone === 'warm' && (prev === 'far' || prev === null)) {
      speakWarmer()
    } else if (zone === 'hot' && prev !== 'found') {
      speakVeryClose()
    } else if (zone === 'found') {
      speakFound()
    }
    // Colder transitions (getting worse)
    else if (prev !== null) {
      const zoneOrder: Record<ProximityZone, number> = { far: 0, warm: 1, hot: 2, found: 3 }
      if (zoneOrder[zone] < zoneOrder[prev]) {
        speakColder()
      }
    }
  }, [zone, shouldPlay, speakWarmer, speakVeryClose, speakFound, speakColder])

  // Inactivity hint timer
  useEffect(() => {
    if (!shouldPlay || zone === null || zone === 'found') {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
      return
    }

    const scheduleHint = () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)

      hintTimerRef.current = setTimeout(() => {
        const now = Date.now()
        // Respect cooldown
        if (now - lastHintRef.current < HINT_COOLDOWN_MS) {
          const remaining = HINT_COOLDOWN_MS - (now - lastHintRef.current)
          hintTimerRef.current = setTimeout(scheduleHint, remaining)
          return
        }
        // Check zone hasn't changed recently (still stuck)
        if (now - lastZoneChangeRef.current < INACTIVITY_MS) {
          scheduleHint()
          return
        }

        lastHintRef.current = now

        // Read live proximity data from the ref
        const prox = proximityRef.current

        if (prox) {
          // Hint decision matrix — order matters!
          if (!prox.isOnScreen && prox.zoomFactor > 2) {
            // Over-zoomed on wrong area: zooming in would make it worse
            speakZoomOut()
          } else if (prox.targetDirection === 'left') {
            // Target off-screen left
            speakScrollLeft()
          } else if (prox.targetDirection === 'right') {
            // Target off-screen right
            speakScrollRight()
          } else if (prox.isOnScreen && prox.needsMoreZoom) {
            // Right area but needs more zoom — the ONLY "zoom in" scenario
            speakZoomIn()
          } else {
            // On screen, zoom adequate — very close
            speakClose()
          }
        }

        // Schedule next check
        scheduleHint()
      }, INACTIVITY_MS)
    }

    scheduleHint()

    return () => {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [zone, shouldPlay, proximityRef, speakZoomIn, speakZoomOut, speakScrollLeft, speakScrollRight, speakClose])

  // Reset on game end
  useEffect(() => {
    if (zone === null) {
      prevZoneRef.current = null
      lastZoneChangeRef.current = Date.now()
      lastHintRef.current = 0
    }
  }, [zone])
}
