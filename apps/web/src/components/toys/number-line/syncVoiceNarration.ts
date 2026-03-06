/**
 * Feed narration segment updates to the voice agent during active calls.
 *
 * Uses the sequencer's actual segment index (not revealProgress) to gate
 * cues — prevents premature firing when animation finishes a segment
 * before the voice agent does.
 *
 * Extracted from NumberLine.tsx draw().
 */

import type { DemoNarrationConfig } from './constants/demos/useConstantDemoNarration'
import {
  EXPLORATION_DISPLAY,
  EXPLORATION_RECOMMENDATIONS,
} from './talkToNumber/explorationRegistry'

export interface VoiceNarrationSyncState {
  voiceState: string
  demoPhase: string
  constantId: string | null
  revealProgress: number
  isNarrating: boolean
  segmentIndex: number
  lastReportedSegment: number
}

export interface VoiceNarrationSyncActions {
  sendSystemMessage: (message: string, promptResponse: boolean) => void
  setNarrationPlaying: (playing: boolean) => void
  updateLastReportedSegment: (index: number) => void
}

/**
 * Sync narration state to voice agent. Call once per draw frame.
 * Returns the new lastReportedSegment value.
 */
export function syncVoiceNarration(
  state: VoiceNarrationSyncState,
  actions: VoiceNarrationSyncActions,
  narrationConfig: DemoNarrationConfig | undefined
): void {
  if (state.voiceState !== 'active') return
  if (state.demoPhase === 'idle' || !state.constantId) return
  if (!narrationConfig) return

  const segIdx = state.isNarrating ? state.segmentIndex : -1

  // Send context-only cue when the sequencer advances to a new segment
  if (segIdx >= 0 && segIdx !== state.lastReportedSegment) {
    actions.updateLastReportedSegment(segIdx)
    const seg = narrationConfig.segments[segIdx]
    actions.sendSystemMessage(
      `[Narration playing — DO NOT speak this. The narrator is saying: "${seg.ttsText}"]`,
      false
    )
  }

  // Notify when exploration completes
  if (state.revealProgress >= 1 && state.lastReportedSegment !== narrationConfig.segments.length) {
    actions.updateLastReportedSegment(narrationConfig.segments.length)
    actions.setNarrationPlaying(false)
    const display = EXPLORATION_DISPLAY[state.constantId]
    const recs = EXPLORATION_RECOMMENDATIONS[state.constantId] ?? []
    const recText =
      recs.length > 0
        ? ` If the child seems into it, casually suggest one of these: ${recs
            .map((r) => {
              const d = EXPLORATION_DISPLAY[r.id]
              return `${d?.name ?? r.id} (${r.reason})`
            })
            .join(
              '; '
            )}. Don't list them all — just pick whichever feels most natural for the conversation and mention it casually.`
        : ''
    actions.sendSystemMessage(
      `[The ${display?.name ?? state.constantId} exploration finished. Ask the child what they thought — ` +
        `brief check-in, then move on.${recText}]`,
      true
    )
  }
}
