'use client'

/**
 * Euclid text chat hook — thin wrapper around useCharacterChat.
 *
 * Provides Euclid-specific context serialization (construction graph,
 * proof facts, tool state, step list) while delegating SSE streaming,
 * message state, and open/close to the generic hook.
 */

import { useCallback } from 'react'
import { useCharacterChat } from '@/lib/character/useCharacterChat'
import type { UseCharacterChatReturn } from '@/lib/character/useCharacterChat'
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
import {
  serializeConstructionGraph,
  serializeProofFacts,
  serializeToolState,
  type ToolStateInfo,
} from '../voice/serializeProofState'

// Re-export ChatMessage from the generic types for backward compatibility
export type { ChatMessage } from '@/lib/character/types'

export interface UseEuclidChatOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  constructionRef: React.RefObject<ConstructionState>
  proofFactsRef: React.RefObject<ProofFact[]>
  currentStepRef: React.RefObject<number>
  propositionId: number
  isComplete: boolean
  playgroundMode: boolean
  activeToolRef: React.RefObject<ActiveTool>
  compassPhaseRef: React.RefObject<CompassPhase>
  straightedgePhaseRef: React.RefObject<StraightedgePhase>
  extendPhaseRef: React.RefObject<ExtendPhase>
  macroPhaseRef: React.RefObject<MacroPhase>
  dragPointIdRef: React.RefObject<string | null>
  steps: PropositionStep[]
  /** Ref holding a pending action description (set by push notifier, consumed on send) */
  pendingActionRef?: React.RefObject<string | null>
}

export type UseEuclidChatReturn = UseCharacterChatReturn

export function useEuclidChat(options: UseEuclidChatOptions): UseEuclidChatReturn {
  const {
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    isComplete,
    playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
    pendingActionRef,
  } = options

  const readToolState = useCallback((): ToolStateInfo => ({
    activeTool: activeToolRef.current ?? 'compass',
    compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
    straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
    extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
    macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
    dragPointId: dragPointIdRef.current ?? null,
  }), [activeToolRef, compassPhaseRef, straightedgePhaseRef, extendPhaseRef, macroPhaseRef, dragPointIdRef])

  const buildRequestBody = useCallback(
    (
      messages: Array<{ role: string; content: string }>,
      screenshot: string | undefined,
    ): Record<string, unknown> => {
      const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
      const state = constructionRef.current ?? emptyState
      const facts = proofFactsRef.current ?? []
      const step = currentStepRef.current ?? 0
      const toolInfo = readToolState()

      const constructionGraph = serializeConstructionGraph(state)
      const proofFactsText = serializeProofFacts(facts)
      const toolState = serializeToolState(toolInfo, state, step, steps, isComplete)

      // Build step list
      let stepList: string
      if (isComplete) {
        stepList = 'Construction is COMPLETE. Student is exploring freely.'
      } else {
        const stepLines = steps.map((s, i) => {
          const marker = i === step ? '\u2192' : i < step ? '\u2713' : ' '
          const citation = s.citation ? ` [${s.citation}]` : ''
          return `  ${marker} Step ${i + 1}: ${s.instruction}${citation}`
        })
        stepList = `Step ${step + 1} of ${steps.length}:\n${stepLines.join('\n')}`
      }

      // Read pending action (not cleared — the notifier overwrites it on next event)
      const recentAction = pendingActionRef?.current ?? null

      const body = {
        messages,
        propositionId,
        currentStep: step,
        isComplete,
        playgroundMode,
        constructionGraph,
        toolState,
        proofFacts: proofFactsText,
        stepList,
        screenshot,
        ...(recentAction ? { recentAction } : {}),
      }
      console.log('[euclid-chat] buildRequestBody: step=%d, isComplete=%s, recentAction=%s, messageCount=%d', step, isComplete, recentAction, messages.length)
      return body
    },
    [constructionRef, proofFactsRef, currentStepRef, propositionId, isComplete, playgroundMode, steps, readToolState, pendingActionRef],
  )

  return useCharacterChat({
    chatEndpoint: '/api/realtime/euclid/chat',
    buildRequestBody,
    canvasRef,
  })
}
