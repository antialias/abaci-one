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

import { useCallback, useEffect, useRef, useMemo } from 'react'
import { useVoiceCall } from '@/lib/voice/useVoiceCall'
import type { VoiceSessionConfig, ToolCallResult, CallState } from '@/lib/voice/types'
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
import type { FactStore } from '../engine/factStore'
import type { EuclidModeContext } from './types'
import { greetingMode } from './modes/greetingMode'
import { conversingMode } from './modes/conversingMode'
import { thinkingMode } from './modes/thinkingMode'
import {
  serializeFullProofState,
  serializeConstructionGraph,
  serializeProofFacts,
  serializeToolState,
  toolStateFingerprint,
  type ToolStateInfo,
} from './serializeProofState'

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
}

export interface UseEuclidVoiceReturn {
  state: CallState
  error: string | null
  errorCode: string | null
  dial: () => void
  hangUp: () => void
  timeRemaining: number | null
  isSpeaking: boolean
}

/**
 * Capture a screenshot from the canvas, scaled down for transmission.
 */
function captureScreenshot(canvas: HTMLCanvasElement): string | null {
  try {
    const targetWidth = 512
    const targetHeight = 384
    const offscreen = document.createElement('canvas')
    offscreen.width = targetWidth
    offscreen.height = targetHeight
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
    return offscreen.toDataURL('image/png')
  } catch {
    return null
  }
}

export function useEuclidVoice(options: UseEuclidVoiceOptions): UseEuclidVoiceReturn {
  const {
    canvasRef,
    constructionRef,
    factStoreRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    propositionTitle,
    propositionKind,
    totalSteps,
    isComplete,
    playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
  } = options

  // Track whether the child has spoken (for greeting → conversing transition)
  const childHasSpokenRef = useRef(false)

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
  ])

  const onToolCall = useCallback(
    (name: string, args: Record<string, unknown>, ctx: EuclidModeContext): ToolCallResult | null => {
      if (name === 'hang_up') {
        return { output: { success: true }, isHangUp: true }
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
            text: `[Oracle's answer: ${data.answer}]`,
            exitMode: true,
          }))

        return {
          output: { success: true, message: 'Consulting the oracle...' },
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

  const onChildSpeech = useCallback(() => {
    childHasSpokenRef.current = true
  }, [])

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
    onChildSpeech,
    getSessionBody: () => ({
      propositionId,
      currentStep: currentStepRef.current ?? 0,
      isComplete,
      playgroundMode,
    }),
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
    onChildSpeech,
    propositionId,
    currentStepRef,
    isComplete,
    playgroundMode,
  ])

  const voiceCall = useVoiceCall(config)

  // Keep a ref to voiceCall for use in effects (avoids stale closures)
  const voiceCallRef = useRef(voiceCall)
  voiceCallRef.current = voiceCall

  // ── Live context update polling (construction + tool state) ──
  const lastConstructionFpRef = useRef<string>('')
  const lastToolFpRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Read current tool state from refs */
  const readToolState = useCallback((): ToolStateInfo => ({
    activeTool: activeToolRef.current ?? 'compass',
    compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
    straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
    extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
    macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
    dragPointId: dragPointIdRef.current ?? null,
  }), [activeToolRef, compassPhaseRef, straightedgePhaseRef, extendPhaseRef, macroPhaseRef, dragPointIdRef])

  useEffect(() => {
    if (voiceCall.state !== 'active') {
      // Reset on call end
      lastConstructionFpRef.current = ''
      lastToolFpRef.current = ''
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      return
    }

    // Initialize fingerprints to current state (skip update on call start)
    if (!lastConstructionFpRef.current) {
      const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
      lastConstructionFpRef.current = constructionFingerprint(constructionRef.current ?? emptyState)
      lastToolFpRef.current = toolStateFingerprint(readToolState())
    }

    const interval = setInterval(() => {
      const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
      const current = constructionRef.current ?? emptyState
      const cFp = constructionFingerprint(current)
      const tInfo = readToolState()
      const tFp = toolStateFingerprint(tInfo)

      const constructionChanged = cFp !== lastConstructionFpRef.current
      const toolChanged = tFp !== lastToolFpRef.current

      if (!constructionChanged && !toolChanged) return

      // Debounce: tool-only changes fire fast (300ms), construction changes need 1.5s
      const debounceMs = constructionChanged ? 1500 : 300
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        const state = constructionRef.current ?? emptyState
        const facts = proofFactsRef.current ?? []
        const toolInfo = readToolState()
        const step = currentStepRef.current ?? 0

        const graph = serializeConstructionGraph(state)
        const factsText = serializeProofFacts(facts)
        const toolText = serializeToolState(toolInfo, state, step, steps, isComplete)

        // Only capture screenshot for construction changes (expensive)
        const includeScreenshot = cFp !== lastConstructionFpRef.current
        const screenshot = includeScreenshot && canvasRef.current
          ? captureScreenshot(canvasRef.current)
          : null

        const text = `[CONSTRUCTION UPDATE — do not read back, just update your understanding]\n\n${toolText}\n\n${graph}\n\n=== Proven Facts ===\n${factsText}`
        voiceCallRef.current.sendContextUpdate(text, screenshot)

        lastConstructionFpRef.current = constructionFingerprint(state)
        lastToolFpRef.current = toolStateFingerprint(toolInfo)

        console.log('[euclid-voice] sent context update (construction=%s, tool=%s)',
          includeScreenshot ? 'changed' : 'same',
          tFp !== lastToolFpRef.current ? 'changed' : 'same'
        )
      }, debounceMs)
    }, 500)

    return () => {
      clearInterval(interval)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [voiceCall.state, constructionRef, proofFactsRef, canvasRef, currentStepRef, steps, isComplete, readToolState])

  return {
    state: voiceCall.state,
    error: voiceCall.error,
    errorCode: voiceCall.errorCode,
    dial: voiceCall.dial,
    hangUp: voiceCall.hangUp,
    timeRemaining: voiceCall.timeRemaining,
    isSpeaking: voiceCall.isSpeaking,
  }
}

/**
 * Fingerprint a construction state for change detection.
 * Encodes element counts + point coordinates.
 */
function constructionFingerprint(state: ConstructionState): string {
  let pts = 0
  let segs = 0
  let circs = 0
  const coords: string[] = []
  for (const el of state.elements) {
    if (el.kind === 'point') {
      pts++
      coords.push(`${el.x.toFixed(3)},${el.y.toFixed(3)}`)
    } else if (el.kind === 'segment') {
      segs++
    } else if (el.kind === 'circle') {
      circs++
    }
  }
  return `${pts}p${segs}s${circs}c:${coords.join(';')}`
}
