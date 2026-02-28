'use client'

/**
 * Euclid voice call hook — "Call Euclid" feature.
 *
 * Built on the shared voice framework (useVoiceCall). Provides:
 *  - Construction screenshot capture for think_hard
 *  - Proof state serialization
 *  - Euclid character modes (greeting → conversing → thinking)
 *  - Async think_hard tool (GPT-5.2 via Responses API)
 */

import { useCallback, useRef, useMemo } from 'react'
import { useVoiceCall } from '@/lib/voice/useVoiceCall'
import type { VoiceSessionConfig, ToolCallResult, CallState, UseVoiceCallReturn } from '@/lib/voice/types'
import { sendSystemMessage } from '@/lib/voice/toolCallHelpers'
import { captureScreenshot } from '@/lib/character/captureScreenshot'
import type { ChatMessage } from '@/lib/character/types'
import type {
  ConstructionState,
  ActiveTool,
  CompassPhase,
  StraightedgePhase,
  ExtendPhase,
  MacroPhase,
  PropositionStep,
} from '../types'
import type { ProofFact } from '../engine/facts'
import type { GeometricEntityRef } from '../chat/parseGeometricEntities'
import type { FactStore } from '../engine/factStore'
import type { EuclidModeContext } from './types'
import { greetingMode } from './modes/greetingMode'
import { conversingMode } from './modes/conversingMode'
import { thinkingMode } from './modes/thinkingMode'
import { serializeFullProofState } from './serializeProofState'

interface UseEuclidVoiceOptions {
  /** Canvas ref for screenshot capture */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** Current construction state ref */
  constructionRef: React.RefObject<ConstructionState>
  /** Current fact store ref */
  factStoreRef: React.RefObject<FactStore>
  /** Current proof facts ref */
  proofFactsRef: React.RefObject<ProofFact[]>
  /** Current tutorial step ref */
  currentStepRef: React.RefObject<number>
  /** Proposition ID */
  propositionId: number
  /** Proposition title */
  propositionTitle: string
  /** Proposition kind */
  propositionKind: 'construction' | 'theorem'
  /** Total number of steps */
  totalSteps: number
  /** Whether the construction is complete */
  isComplete: boolean
  /** Whether the user is in playground/exploration mode */
  playgroundMode: boolean
  // ── Tool state refs (for live context updates) ──
  /** Currently active tool */
  activeToolRef: React.RefObject<ActiveTool>
  /** Compass gesture phase */
  compassPhaseRef: React.RefObject<CompassPhase>
  /** Straightedge gesture phase */
  straightedgePhaseRef: React.RefObject<StraightedgePhase>
  /** Extend gesture phase */
  extendPhaseRef: React.RefObject<ExtendPhase>
  /** Macro (proposition application) phase */
  macroPhaseRef: React.RefObject<MacroPhase>
  /** Point currently being dragged (move tool) */
  dragPointIdRef: React.RefObject<string | null>
  /** Proposition steps (for step context in tool state) */
  steps: PropositionStep[]
  /** Prior chat messages ref — injected into voice session for context continuity */
  chatMessagesRef: React.RefObject<ChatMessage[]>
  /** Called when the model produces a speech transcript */
  onModelSpeech?: (transcript: string) => void
  /** Called when the child produces a speech transcript */
  onChildSpeech?: (transcript: string) => void
}

export interface UseEuclidVoiceReturn {
  state: CallState
  error: string | null
  errorCode: string | null
  dial: () => void
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
  /** True while Euclid is consulting his scrolls (think_hard in progress) */
  isThinking: boolean
  /** Ref holding the currently voice-highlighted entity (or null) */
  voiceHighlightRef: React.RefObject<GeometricEntityRef | null>
  /** Send a user text message to the active voice session */
  sendUserText: (text: string) => void
  /** Ref to the underlying voice call — needed by the construction notifier */
  voiceCallRef: React.RefObject<UseVoiceCallReturn | null>
}

/**
 * Build a GeometricEntityRef from voice tool params (entity_type + labels).
 * Returns null if the combination is invalid.
 */
function buildEntityFromVoice(entityType: string, labels: string): GeometricEntityRef | null {
  switch (entityType) {
    case 'point':
      if (labels.length === 1) return { type: 'point', label: labels[0] }
      return null
    case 'segment':
      if (labels.length === 2) return { type: 'segment', from: labels[0], to: labels[1] }
      return null
    case 'triangle':
      if (labels.length === 3) return { type: 'triangle', vertices: [labels[0], labels[1], labels[2]] }
      return null
    case 'angle':
      if (labels.length === 3) return { type: 'angle', points: [labels[0], labels[1], labels[2]] }
      return null
    default:
      return null
  }
}

export function useEuclidVoice(options: UseEuclidVoiceOptions): UseEuclidVoiceReturn {
  const {
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    propositionTitle,
    propositionKind,
    totalSteps,
    isComplete,
    playgroundMode,
    steps,
  } = options

  // Track whether the child has spoken (for greeting → conversing transition)
  const childHasSpokenRef = useRef(false)

  // Voice highlight state — set by the highlight tool, auto-clears after 4s
  const voiceHighlightRef = useRef<GeometricEntityRef | null>(null)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildContext = useCallback((): EuclidModeContext => {
    const screenshot = canvasRef.current ? captureScreenshot(canvasRef.current) : null
    return {
      propositionId,
      propositionTitle,
      propositionKind,
      currentStep: currentStepRef.current ?? 0,
      totalSteps,
      isComplete,
      construction: constructionRef.current ?? { elements: [], nextLabelIndex: 0, nextColorIndex: 0 },
      proofFacts: proofFactsRef.current ?? [],
      screenshotDataUrl: screenshot,
      playgroundMode,
      steps,
    }
  }, [
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    propositionTitle,
    propositionKind,
    totalSteps,
    isComplete,
    playgroundMode,
    steps,
  ])

  const onToolCall = useCallback(
    (name: string, args: Record<string, unknown>, ctx: EuclidModeContext): ToolCallResult | null => {
      if (name === 'hang_up') {
        return { output: { success: true }, isHangUp: true }
      }

      if (name === 'highlight') {
        const entity = buildEntityFromVoice(String(args.entity_type), String(args.labels))
        if (!entity) return { output: { success: false, error: 'Invalid entity' }, promptResponse: false }

        voiceHighlightRef.current = entity
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = setTimeout(() => {
          voiceHighlightRef.current = null
        }, 4000)

        return { output: { success: true }, promptResponse: false }
      }

      if (name === 'think_hard') {
        const question = String(args.question || '')
        const effort = String(args.effort || 'medium')

        // Capture screenshot + proof state for the API call
        const screenshot = ctx.screenshotDataUrl
        const proofState = serializeFullProofState(ctx.construction, ctx.proofFacts)

        const asyncResult = fetch('/api/realtime/euclid/think-hard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            effort,
            screenshot,
            proofState,
            propositionId: ctx.propositionId,
            currentStep: ctx.currentStep,
          }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`Think hard API error: ${res.status}`)
            return res.json()
          })
          .then((data) => ({
            text: `[From your scrolls: ${data.answer}]`,
            exitMode: true,
          }))

        return {
          output: { success: true, message: 'Consulting my earlier writings...' },
          enterMode: 'thinking',
          asyncResult,
        }
      }

      return null
    },
    []
  )

  const onResponseDone = useCallback(
    (_ctx: EuclidModeContext, currentModeId: string): string | null => {
      // Transition from greeting to conversing after the student has spoken
      if (currentModeId === 'greeting' && childHasSpokenRef.current) {
        return 'conversing'
      }
      return null
    },
    []
  )

  const onChildSpeechInternal = useCallback((transcript: string) => {
    childHasSpokenRef.current = true
    options.onChildSpeech?.(transcript)
  }, [options.onChildSpeech])

  const config = useMemo((): VoiceSessionConfig<EuclidModeContext> => ({
    sessionEndpoint: '/api/realtime/euclid/session',
    buildContext,
    initialModeId: 'greeting',
    modes: {
      greeting: greetingMode,
      conversing: conversingMode,
      thinking: thinkingMode,
    },
    onToolCall,
    onResponseDone,
    onChildSpeech: onChildSpeechInternal,
    onModelSpeech: options.onModelSpeech,
    getSessionBody: () => ({
      propositionId,
      currentStep: currentStepRef.current ?? 0,
      isComplete,
      playgroundMode,
    }),
    onSessionEstablished: (dc) => {
      console.log('[euclid-voice] session established, dc readyState=%s', dc.readyState)
      const msgs = options.chatMessagesRef.current
      console.log('[euclid-voice] prior chat messages: %d', msgs?.length ?? 0)
      if (msgs && msgs.length > 0) {
        const lines = msgs.map((m) => `${m.role === 'user' ? 'Student' : 'Euclid'}: ${m.content}`).join('\n')
        sendSystemMessage(dc, `[Prior conversation with this student — you already discussed this, continue naturally without repeating yourself:]\n${lines}`)
      }
    },
    timer: {
      baseDurationMs: 3 * 60 * 1000, // 3 minutes for Euclid
      extensionMs: 2 * 60 * 1000,
      warningBeforeEndMs: 15 * 1000,
      hangUpDelayMs: 2000,
    },
    voice: 'ash',
    onTimeWarning: (dc, _remaining) => {
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[System: Only 15 seconds left. Wrap up the current point decisively — you have other students and scrolls that need your attention. Do NOT mention timers or countdowns. Stay in character as a busy, important scholar.]',
              },
            ],
          },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
    },
    onTimeExpired: (dc) => {
      dc.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[System: Time is up. End the lesson with authority — dismiss the student with a brief assignment or expectation for next time. e.g. "That is enough for today. Practice this construction until it is second nature. I expect progress when we next speak." Then call hang_up.]',
              },
            ],
          },
        })
      )
      dc.send(JSON.stringify({ type: 'response.create' }))
    },
  }), [
    buildContext,
    onToolCall,
    onResponseDone,
    onChildSpeechInternal,
    options.onModelSpeech,
    propositionId,
    currentStepRef,
    isComplete,
    playgroundMode,
  ])

  const voiceCall = useVoiceCall(config)

  // Keep a ref to voiceCall for use in effects (avoids stale closures)
  const voiceCallRef = useRef(voiceCall)
  voiceCallRef.current = voiceCall

  // Expose voiceCallRef for the construction notifier (created in EuclidCanvas)
  // Clear voice highlight when call ends
  if (voiceCall.state !== 'active') {
    voiceHighlightRef.current = null
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
      highlightTimerRef.current = null
    }
  }

  return {
    state: voiceCall.state,
    error: voiceCall.error,
    errorCode: voiceCall.errorCode,
    dial: voiceCall.dial,
    hangUp: voiceCall.hangUp,
    timeRemaining: voiceCall.timeRemaining,
    isSpeaking: voiceCall.isSpeaking,
    isThinking: voiceCall.modeDebug.current === 'thinking',
    voiceHighlightRef,
    sendUserText: voiceCall.sendUserText,
    voiceCallRef,
  }
}
