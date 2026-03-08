'use client'

/**
 * Geometry teacher voice call hook — "Call [Teacher]" feature.
 *
 * Built on the shared voice framework (useVoiceCall). Reads character
 * config from GeometryTeacherContext. Provides:
 *  - Construction screenshot capture for think_hard
 *  - Proof state serialization
 *  - Character modes (greeting → conversing → thinking)
 *  - Async think_hard tool (GPT-5.2 via Responses API)
 */

import { useCallback, useRef, useMemo } from 'react'
import { useVoiceCall } from '@/lib/voice/useVoiceCall'
import type {
  VoiceSessionConfig,
  ToolCallResult,
  CallState,
  UseVoiceCallReturn,
} from '@/lib/voice/types'
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
import type { GeometryModeContext } from './types'
import { serializeFullProofState } from './serializeProofState'
import { useGeometryTeacher } from '../GeometryTeacherContext'
import type { AuthorToolCallbacks } from '../authorToolCallbacks'
import { dispatchAuthorTool, AUTHOR_TOOL_NAMES } from './dispatchAuthorTool'

interface UseGeometryVoiceOptions {
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
  /** Compact conversation for voice injection (uses head summary if available) */
  compactForVoice?: (messages: ChatMessage[]) => string
  /** Called when the model produces a speech transcript */
  onModelSpeech?: (transcript: string) => void
  /** Called when the child produces a speech transcript */
  onChildSpeech?: (transcript: string) => void
  /** Author-mode tool callbacks for construction mutation + fact store */
  authorCallbacks?: AuthorToolCallbacks
}

export interface UseGeometryVoiceReturn {
  state: CallState
  error: string | null
  errorCode: string | null
  dial: () => void
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
  /** True while the teacher is consulting their scrolls (think_hard in progress) */
  isThinking: boolean
  /** Ref holding the currently voice-highlighted entity (or null) */
  voiceHighlightRef: React.RefObject<GeometricEntityRef | null>
  /** Send a user text message to the active voice session */
  sendUserText: (text: string) => void
  /** Ref to the underlying voice call — needed by the construction notifier */
  voiceCallRef: React.RefObject<UseVoiceCallReturn | null>
  /** Unmute mic and trigger initial model response (use with deferGreeting). */
  activateSession: (priorAssistantText?: string) => void
  /** Stop ring tone immediately. */
  stopRing: () => void
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
      if (labels.length === 3)
        return { type: 'triangle', vertices: [labels[0], labels[1], labels[2]] }
      return null
    case 'angle':
      if (labels.length === 3) return { type: 'angle', points: [labels[0], labels[1], labels[2]] }
      return null
    default:
      return null
  }
}

export function useGeometryVoice(options: UseGeometryVoiceOptions): UseGeometryVoiceReturn {
  const teacherConfig = useGeometryTeacher()

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

  const buildContext = useCallback((): GeometryModeContext => {
    const screenshot = canvasRef.current ? captureScreenshot(canvasRef.current) : null
    return {
      propositionId,
      propositionTitle,
      propositionKind,
      currentStep: currentStepRef.current ?? 0,
      totalSteps,
      isComplete,
      construction: constructionRef.current ?? {
        elements: [],
        nextLabelIndex: 0,
        nextColorIndex: 0,
      },
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

  // Stable ref for authorCallbacks to avoid stale closures
  const authorCallbacksRef = useRef(options.authorCallbacks)
  authorCallbacksRef.current = options.authorCallbacks

  const onToolCall = useCallback(
    (
      name: string,
      args: Record<string, unknown>,
      ctx: GeometryModeContext
    ): ToolCallResult | null => {
      if (name === 'hang_up') {
        return { output: { success: true }, isHangUp: true }
      }

      if (name === 'highlight') {
        const entity = buildEntityFromVoice(String(args.entity_type), String(args.labels))
        if (!entity)
          return { output: { success: false, error: 'Invalid entity' }, promptResponse: false }

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

        const asyncResult = fetch(teacherConfig.voice.thinkHardEndpoint, {
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
            text: `[${teacherConfig.messages.thinkingResultPrefix}: ${data.answer}]`,
            exitMode: true,
          }))

        return {
          output: { success: true, message: teacherConfig.messages.thinkingFeedback },
          enterMode: 'thinking',
          asyncResult,
        }
      }

      // ── Author-mode construction + fact store tools ──
      const cb = authorCallbacksRef.current
      if (cb && (AUTHOR_TOOL_NAMES as readonly string[]).includes(name)) {
        // Fire and forget — the construction mutation happens immediately.
        dispatchAuthorTool(name, args, cb).catch((err) =>
          console.error('[voice-tool] author tool error:', err)
        )
        return { output: { success: true, tool: name }, promptResponse: true }
      }

      return null
    },
    [teacherConfig]
  )

  const onResponseDone = useCallback(
    (_ctx: GeometryModeContext, currentModeId: string): string | null => {
      // Transition from greeting to conversing after the student has spoken
      if (currentModeId === 'greeting' && childHasSpokenRef.current) {
        return 'conversing'
      }
      return null
    },
    []
  )

  const onChildSpeechInternal = useCallback(
    (transcript: string) => {
      childHasSpokenRef.current = true
      options.onChildSpeech?.(transcript)
    },
    [options.onChildSpeech]
  )

  const config = useMemo(
    (): VoiceSessionConfig<GeometryModeContext> => ({
      sessionEndpoint: teacherConfig.voice.sessionEndpoint,
      deferGreeting: teacherConfig.deferGreeting,
      buildContext,
      initialModeId: 'greeting',
      modes: {
        greeting: teacherConfig.modes.greeting,
        conversing: teacherConfig.modes.conversing,
        thinking: teacherConfig.modes.thinking,
      },
      onToolCall,
      onResponseDone,
      onChildSpeech: onChildSpeechInternal,
      onModelSpeech: options.onModelSpeech,
      getSessionBody: () => ({
        propositionId,
        characterId: teacherConfig.definition.id,
        attitudeId: teacherConfig.attitudeId,
        currentStep: currentStepRef.current ?? 0,
        isComplete,
        playgroundMode,
      }),
      onSessionEstablished: (dc) => {
        console.log('[geometry-voice] session established, dc readyState=%s', dc.readyState)
        const msgs = options.chatMessagesRef.current
        console.log('[geometry-voice] prior chat messages: %d', msgs?.length ?? 0)
        if (msgs && msgs.length > 0) {
          // Use compacted history if available (head summary + recent tail),
          // otherwise fall back to formatting all messages verbatim
          const historyText = options.compactForVoice
            ? options.compactForVoice(msgs)
            : msgs
                .filter((m) => !m.isError)
                .map((m) => {
                  if (m.isEvent) return `[Event: ${m.content}]`
                  return `${m.role === 'user' ? 'Student' : teacherConfig.messages.historyLabel}: ${m.content}`
                })
                .join('\n')
          if (historyText) {
            sendSystemMessage(
              dc,
              `[Prior conversation with this student — you already discussed this, continue naturally without repeating yourself:]\n${historyText}`
            )
          }
        }
      },
      timer: {
        baseDurationMs: teacherConfig.voice.baseDurationMs,
        extensionMs: teacherConfig.voice.extensionMs,
        warningBeforeEndMs: 15 * 1000,
        hangUpDelayMs: 2000,
      },
      voice: teacherConfig.voice.id,
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
                  text: teacherConfig.messages.timeWarning,
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
                  text: teacherConfig.messages.timeExpired,
                },
              ],
            },
          })
        )
        dc.send(JSON.stringify({ type: 'response.create' }))
      },
      usageFeature: 'euclid:voice',
    }),
    [
      teacherConfig,
      buildContext,
      onToolCall,
      onResponseDone,
      onChildSpeechInternal,
      options.onModelSpeech,
      propositionId,
      currentStepRef,
      isComplete,
      playgroundMode,
    ]
  )

  const voiceCall = useVoiceCall(config)

  // Keep a ref to voiceCall for use in effects (avoids stale closures)
  const voiceCallRef = useRef(voiceCall)
  voiceCallRef.current = voiceCall

  // Clear voice highlight when call is not actively conversing
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
    activateSession: voiceCall.activateSession,
    stopRing: voiceCall.stopRing,
  }
}
