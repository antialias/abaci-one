import type { MutableRefObject } from 'react'
import { CONSTANT_IDS, EXPLORATION_DISPLAY } from './talkToNumber/explorationRegistry'
import { NARRATION_CONFIGS } from './constants/demos/narrationConfigs'

const DEMO_DISPLAY = EXPLORATION_DISPLAY

interface Narration {
  reset: () => void
  stop: () => void
  resume: (constantId: string) => void
  markTriggered: (constantId: string) => void
  isNarrating: MutableRefObject<boolean>
}

interface CreateHandleExploreConstantOptions {
  audioManager: { stop: () => void }
  voiceStateRef: MutableRefObject<string>
  pendingTourRef: MutableRefObject<string | null>
  voiceExplorationSegmentRef: MutableRefObject<number>
  narration: Narration
  cancelDemo: () => void
  exitTour: () => void
  startTour: () => void
  startDemo: (id: string) => void
  restoreDemo: (id: string, progress: number) => void
  sendSystemMessage: (msg: string, force?: boolean) => void
  onSpeedReset: () => void
  setTappedConstantId: (v: string | null) => void
  setTappedIntValue: (v: number | null) => void
  setHoveredValue: (v: number | null) => void
  tooltipHoveredRef: MutableRefObject<boolean>
}

export function createHandleExploreConstant({
  audioManager,
  voiceStateRef,
  pendingTourRef,
  voiceExplorationSegmentRef,
  narration,
  cancelDemo,
  exitTour,
  startTour,
  startDemo,
  restoreDemo,
  sendSystemMessage,
  onSpeedReset,
  setTappedConstantId,
  setTappedIntValue,
  setHoveredValue,
  tooltipHoveredRef,
}: CreateHandleExploreConstantOptions) {
  return (explorationId: string) => {
    console.log('[NumberLine] handleExploreConstant — exploration:', explorationId)
    audioManager.stop()

    // Route tour explorations to the prime tour handler
    if (!CONSTANT_IDS.has(explorationId)) {
      const onCall = voiceStateRef.current === 'active'
      if (onCall) {
        // Queue the tour to launch after the call ends — the agent will
        // explain the tour, say goodbye, and hang up on its own.
        console.log('[NumberLine] queuing tour for after hangup:', explorationId)
        pendingTourRef.current = explorationId
      } else {
        // Not on a call — start the tour immediately
        cancelDemo()
        setTappedConstantId(null)
        setTappedIntValue(null)
        setHoveredValue(null)
        tooltipHoveredRef.current = false
        startTour()
      }
      return
    }

    // Constant exploration path
    exitTour()
    narration.reset()
    // Reset speed UI to match (narration.reset() resets the ref + audio rate)
    onSpeedReset()

    const onCall = voiceStateRef.current === 'active'
    console.log(
      '[exploration] handleExploreConstant — onCall:',
      onCall,
      'explorationId:',
      explorationId
    )

    if (onCall) {
      // Start paused at progress 0 — narrator introduces first, then calls resume
      console.log('[exploration] starting PAUSED (restoreDemo + markTriggered)')
      restoreDemo(explorationId, 0)
      narration.markTriggered(explorationId) // suppress narration auto-start
    } else {
      startDemo(explorationId)
    }

    // If on a voice call, send companion instructions for the exploration
    if (onCall) {
      const cfg = NARRATION_CONFIGS[explorationId]
      const display = DEMO_DISPLAY[explorationId]
      if (cfg && display) {
        const visualDesc = display.visualDesc
          ? `\n\nWHAT THE ANIMATION SHOWS (for YOUR reference only — do NOT describe this to the child): ${display.visualDesc}`
          : ''

        // Companion rules are in the start_exploration tool output (not here)
        // so the model won't treat them as a "user message" to recite.
        // This message provides constant-specific context only.
        console.log('[exploration] sending intro system message + response.create')
        sendSystemMessage(
          `An animated exploration of ${display.symbol} (${display.name}) is ready to play.` +
            `${visualDesc}\n\n` +
            `Give the child a brief intro — why this constant is special to you personally. Match the child's energy level. ` +
            `Do NOT describe or preview what the animation will show. The visuals should be a surprise. ` +
            `Something like "Oh, I've been wanting to show you this!" or "This is one of my favorite things about living near ${display.symbol}." ` +
            `Keep it to 1-2 sentences, then call resume_exploration.`,
          true // prompt a response so the agent introduces the constant
        )
      }
      voiceExplorationSegmentRef.current = -1
    }
  }
}
