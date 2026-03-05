import { useRef, useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { ConstructionState } from '../types'
import { useHecklerTrigger } from '../agent/useHecklerTrigger'
import { DEFAULT_STALL_LINES } from '@/lib/voice/stallLines'
import type { AttitudeId } from '../agent/attitudes/types'

interface UseHecklerCallOptions {
  constructionRef: MutableRefObject<ConstructionState>
  playgroundMode: boolean | undefined
  isAuthorMode: boolean
  euclidVoice: {
    state: string
    dial: () => void
    hangUp: () => void
    stopRing: () => void
    activateSession: (stallText?: string) => void
    sendUserText: (text: string) => void
  }
  teacherConfig: { stallLines?: string[] }
  speakHecklerStallRef: MutableRefObject<(opts: { say: { en: string } }) => Promise<void>>
  stopAudio: () => void
  onAttitudeChange?: (attitudeId: AttitudeId) => void
  eventBusRef: MutableRefObject<{ subscribe: (cb: () => void) => () => void }>
}

/**
 * Manages the heckler call lifecycle:
 * - Watches for topology matches via useHecklerTrigger
 * - Pre-dials WebRTC on ringing
 * - Plays stall TTS while connecting
 * - Activates session when both WebRTC and stall are ready
 * - Cleans up on dismiss / match lost / call end
 */
export function useHecklerCall({
  constructionRef,
  playgroundMode,
  isAuthorMode,
  euclidVoice,
  teacherConfig,
  speakHecklerStallRef,
  stopAudio,
  onAttitudeChange,
  eventBusRef,
}: UseHecklerCallOptions) {
  const pendingActivateRef = useRef(false)
  const stallTextRef = useRef<string | null>(null)
  const stallDoneRef = useRef(true) // true = no stall playing (safe to activate)
  const hecklerPreDialRef = useRef(false)

  const heckler = useHecklerTrigger(constructionRef, !!playgroundMode && !isAuthorMode)

  /** Try to activate — only fires when BOTH session is ready AND stall TTS is done. */
  const tryActivateRef = useRef(() => {})
  tryActivateRef.current = () => {
    if (!pendingActivateRef.current) return
    if (euclidVoice.state !== 'preconnected') {
      console.log(
        '[heckler-activate] not yet — voiceState=%s, stallDone=%s',
        euclidVoice.state,
        stallDoneRef.current
      )
      return
    }
    if (!stallDoneRef.current) {
      console.log('[heckler-activate] not yet — session ready but stall TTS still playing')
      return
    }
    console.log('[heckler-activate] both ready — activating now')
    pendingActivateRef.current = false
    hecklerPreDialRef.current = false
    euclidVoice.activateSession(stallTextRef.current ?? undefined)
    stallTextRef.current = null
  }

  // Pre-dial when heckler enters 'ringing': switch attitude and start WebRTC
  useEffect(() => {
    console.log(
      '[heckler-predial] effect: stage=%s, voiceState=%s, preDialRef=%s',
      heckler.stage,
      euclidVoice.state,
      hecklerPreDialRef.current
    )
    if (heckler.stage !== 'ringing') return
    if (hecklerPreDialRef.current) {
      console.log('[heckler-predial] skipped — already initiated')
      return
    }
    if (euclidVoice.state !== 'idle' && euclidVoice.state !== 'error') {
      console.log('[heckler-predial] skipped — voice not idle (state=%s)', euclidVoice.state)
      return
    }
    console.log('[heckler-predial] initiating pre-dial')
    onAttitudeChange?.('heckler')
    hecklerPreDialRef.current = true
    pendingActivateRef.current = false
    stallTextRef.current = null
    stallDoneRef.current = true
    setTimeout(() => {
      console.log('[heckler-predial] setTimeout fired, calling dial()')
      euclidVoice.dial()
    }, 50)
  }, [heckler.stage, euclidVoice.state, euclidVoice.dial, onAttitudeChange])

  // When the user clicks "Answer": activate immediately or play stalling TTS
  const handleHecklerAnswer = useCallback(() => {
    console.log(
      '[heckler-answer] clicked: voiceState=%s, preDialRef=%s, stallDone=%s',
      euclidVoice.state,
      hecklerPreDialRef.current,
      stallDoneRef.current
    )
    euclidVoice.stopRing()
    heckler.answer()
    pendingActivateRef.current = true
    if (euclidVoice.state === 'preconnected') {
      console.log('[heckler-answer] preconnected — activating immediately')
      stallDoneRef.current = true
      hecklerPreDialRef.current = false
      pendingActivateRef.current = false
      euclidVoice.activateSession(stallTextRef.current ?? undefined)
      stallTextRef.current = null
    } else {
      console.log('[heckler-answer] not preconnected — stalling (voiceState=%s)', euclidVoice.state)
      const lines = teacherConfig.stallLines ?? DEFAULT_STALL_LINES
      const line = lines[Math.floor(Math.random() * lines.length)]
      stallTextRef.current = line
      stallDoneRef.current = false
      speakHecklerStallRef.current({ say: { en: line } }).then(() => {
        console.log('[heckler-stall] TTS finished')
        stallDoneRef.current = true
        tryActivateRef.current()
      })
      if (euclidVoice.state === 'idle' || euclidVoice.state === 'error') {
        console.log('[heckler-answer] voice still idle — kicking off dial')
        hecklerPreDialRef.current = true
        onAttitudeChange?.('heckler')
        setTimeout(() => euclidVoice.dial(), 50)
      }
    }
  }, [heckler, euclidVoice, teacherConfig.stallLines, onAttitudeChange])

  // When session reaches preconnected, try to activate
  useEffect(() => {
    if (euclidVoice.state === 'preconnected' && pendingActivateRef.current) {
      tryActivateRef.current()
    }
  }, [euclidVoice.state])

  // Clean up pre-dial if heckler match is lost
  useEffect(() => {
    if (heckler.stage === 'idle' && hecklerPreDialRef.current) {
      console.log(
        '[heckler-cleanup] match lost — hanging up pre-dial, voiceState=%s',
        euclidVoice.state
      )
      hecklerPreDialRef.current = false
      pendingActivateRef.current = false
      stallTextRef.current = null
      stallDoneRef.current = true
      stopAudio()
      if (euclidVoice.state !== 'idle') euclidVoice.hangUp()
      onAttitudeChange?.('teacher')
    }
  }, [heckler.stage, euclidVoice, onAttitudeChange, stopAudio])

  // Reset heckler overlay when the voice call ends while stage is 'answered'
  useEffect(() => {
    if (heckler.stage === 'answered' && euclidVoice.state === 'idle') {
      console.log('[heckler-reset] call ended, resetting stage to idle')
      heckler.dismiss()
      hecklerPreDialRef.current = false
      pendingActivateRef.current = false
      stallTextRef.current = null
      stallDoneRef.current = true
      onAttitudeChange?.('teacher')
    }
  }, [heckler, euclidVoice.state, onAttitudeChange])

  // Dismiss: clean up pre-connection and revert to teacher
  const handleHecklerDismiss = useCallback(() => {
    console.log('[heckler-dismiss] voiceState=%s', euclidVoice.state)
    heckler.dismiss()
    stopAudio()
    if (euclidVoice.state !== 'idle') euclidVoice.hangUp()
    hecklerPreDialRef.current = false
    pendingActivateRef.current = false
    stallTextRef.current = null
    stallDoneRef.current = true
    onAttitudeChange?.('teacher')
  }, [heckler, euclidVoice, onAttitudeChange, stopAudio])

  // Trigger heckler topology check whenever a construction event fires
  useEffect(() => {
    if (!playgroundMode) return
    return eventBusRef.current.subscribe(() => {
      heckler.notifyConstructionChange()
    })
  }, [playgroundMode, heckler.notifyConstructionChange])

  return {
    heckler,
    hecklerPreDialRef,
    handleHecklerAnswer,
    handleHecklerDismiss,
  }
}
