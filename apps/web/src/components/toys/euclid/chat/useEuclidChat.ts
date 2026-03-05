'use client'

/**
 * Euclid text chat hook — thin wrapper around useCharacterChat.
 *
 * Provides Euclid-specific context serialization (construction graph,
 * proof facts, tool state, step list) while delegating SSE streaming,
 * message state, and open/close to the generic hook.
 *
 * In author mode, includes axiom-framed tools and dispatches tool calls
 * to construction mutation + fact store callbacks.
 */

import { useCallback, useRef, useMemo } from 'react'
import { useGeometryTeacher } from '../GeometryTeacherContext'
import { useCharacterChat } from '@/lib/character/useCharacterChat'
import type { UseCharacterChatReturn } from '@/lib/character/useCharacterChat'
import type {
  ConstructionState,
  ConstructionPoint,
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
import { getAttitude } from '../voice/attitudes'
import type { AttitudeId } from '../voice/attitudes/types'

// Re-export ChatMessage from the generic types for backward compatibility
export type { ChatMessage } from '@/lib/character/types'

// Re-export AuthorToolCallbacks from shared location
import type { AuthorToolCallbacks } from '../authorToolCallbacks'
export type { AuthorToolCallbacks } from '../authorToolCallbacks'

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
  /** Whether the user is on a mobile device — triggers concise response mode */
  isMobile?: boolean
  /** Current attitude ID — when 'author', includes tools in chat */
  attitudeId?: AttitudeId
  /** Callbacks for author-mode tool dispatch */
  authorCallbacks?: AuthorToolCallbacks
}

export interface UseEuclidChatReturn extends UseCharacterChatReturn {
  /** Async-markup a message with entity markers. Pass the content to avoid stale closure issues. */
  markupMessage: (messageId: string, content: string, strict?: boolean) => void
}

export function useEuclidChat(options: UseEuclidChatOptions): UseEuclidChatReturn {
  const teacherConfig = useGeometryTeacher()

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
    isMobile,
    attitudeId,
    authorCallbacks,
  } = options

  // Look up attitude tools
  const attitude = attitudeId ? getAttitude(attitudeId) : undefined
  const chatTools = attitude?.chatTools

  const readToolState = useCallback(
    (): ToolStateInfo => ({
      activeTool: activeToolRef.current ?? 'compass',
      compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
      straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
      extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
      macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
      dragPointId: dragPointIdRef.current ?? null,
    }),
    [
      activeToolRef,
      compassPhaseRef,
      straightedgePhaseRef,
      extendPhaseRef,
      macroPhaseRef,
      dragPointIdRef,
    ]
  )

  // Stable ref for authorCallbacks to avoid stale closures in onToolCall
  const authorCallbacksRef = useRef(authorCallbacks)
  authorCallbacksRef.current = authorCallbacks

  const buildRequestBody = useCallback(
    (
      messages: Array<{ role: string; content: string; toolCallId?: string }>,
      screenshot: string | undefined
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

      const body: Record<string, unknown> = {
        messages,
        propositionId,
        characterId: teacherConfig.definition.id,
        currentStep: step,
        isComplete,
        playgroundMode,
        constructionGraph,
        toolState,
        proofFacts: proofFactsText,
        stepList,
        screenshot,
        ...(recentAction ? { recentAction } : {}),
        ...(isMobile ? { isMobile: true } : {}),
      }

      // Include attitude and tools for author mode
      if (attitudeId) {
        body.attitudeId = attitudeId
      }
      if (chatTools) {
        body.tools = chatTools
      }

      console.log(
        '[euclid-chat] buildRequestBody: step=%d, isComplete=%s, recentAction=%s, messageCount=%d, attitude=%s',
        step,
        isComplete,
        recentAction,
        messages.length,
        attitudeId ?? 'default'
      )
      return body
    },
    [
      constructionRef,
      proofFactsRef,
      currentStepRef,
      propositionId,
      teacherConfig,
      isComplete,
      playgroundMode,
      steps,
      readToolState,
      pendingActionRef,
      isMobile,
      attitudeId,
      chatTools,
    ]
  )

  // Tool call handler for author mode
  const onToolCall = useMemo(() => {
    if (!chatTools) return undefined

    return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      const cb = authorCallbacksRef.current
      if (!cb) return { success: false, error: 'No author callbacks available' }

      switch (name) {
        case 'place_point':
          return cb.placePoint(
            Number(args.x),
            Number(args.y),
            args.label ? String(args.label) : undefined
          )
        case 'postulate_1':
          return cb.commitSegment(String(args.from_label), String(args.to_label))
        case 'postulate_2':
          return cb.commitExtend(
            String(args.base_label),
            String(args.through_label),
            args.distance != null ? Number(args.distance) : undefined
          )
        case 'postulate_3':
          return cb.commitCircle(String(args.center_label), String(args.radius_point_label))
        case 'mark_intersection':
          return cb.markIntersection(
            String(args.of_a),
            String(args.of_b),
            args.which ? String(args.which) : undefined
          )
        case 'apply_proposition':
          return cb.commitMacro(
            Number(args.prop_id),
            String(args.input_labels)
              .split(',')
              .map((s) => s.trim())
          )
        case 'declare_equality':
          return cb.addFact(
            String(args.left_a),
            String(args.left_b),
            String(args.right_a),
            String(args.right_b),
            String(args.citation_type),
            args.citation_detail ? String(args.citation_detail) : undefined,
            String(args.statement),
            String(args.justification)
          )
        case 'declare_angle_equality':
          return cb.addAngleFact(
            String(args.left_vertex),
            String(args.left_ray1),
            String(args.left_ray2),
            String(args.right_vertex),
            String(args.right_ray1),
            String(args.right_ray2),
            String(args.citation_type),
            args.citation_detail ? String(args.citation_detail) : undefined,
            String(args.statement),
            String(args.justification)
          )
        case 'relocate_point':
          return cb.relocatePoint(
            String(args.label),
            Number(args.x),
            Number(args.y),
            args.force === true
          )
        case 'undo_last':
          return cb.undoLast()
        case 'highlight':
          return cb.highlight(String(args.entity_type), String(args.labels))
        default:
          return { success: false, error: `Unknown tool: ${name}` }
      }
    }
  }, [chatTools])

  const markupMessageImpl = useCallback(
    (
      messageId: string,
      content: string,
      strict?: boolean,
      updateFn?: (id: string, content: string) => void
    ) => {
      if (!content) return
      // Skip if already has markers
      if (/\{(seg|tri|ang|pt|def|post|cn|prop):/.test(content)) return

      // Gather point labels from the construction
      const state = constructionRef.current
      const pointLabels = state
        ? state.elements
            .filter((e): e is ConstructionPoint => e.kind === 'point' && !!e.label)
            .map((e) => e.label)
        : []

      fetch('/api/realtime/euclid/markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          propositionId,
          pointLabels,
          ...(strict ? { strict: true } : {}),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.markedText && data.markedText !== content) {
            updateFn?.(messageId, data.markedText)
          }
        })
        .catch(() => {
          // Silently fail — original text remains
        })
    },
    [constructionRef, propositionId]
  )

  // Ref to access chat.updateMessageContent in the onUserMessageAdded callback without circular deps
  const chatRef = useRef<UseCharacterChatReturn | null>(null)

  // Callback for typed user messages — markup with strict validation
  const onUserMessageAdded = useCallback(
    (messageId: string, content: string) => {
      markupMessageImpl(messageId, content, true, chatRef.current?.updateMessageContent)
    },
    [markupMessageImpl]
  )

  const chat = useCharacterChat({
    chatEndpoint: teacherConfig.voice.chatEndpoint,
    buildRequestBody,
    canvasRef,
    onUserMessageAdded,
    tools: chatTools,
    onToolCall,
  })

  chatRef.current = chat

  const markupMessage = useCallback(
    (messageId: string, content: string, strict?: boolean) => {
      markupMessageImpl(messageId, content, strict, chat.updateMessageContent)
    },
    [markupMessageImpl, chat.updateMessageContent]
  )

  return { ...chat, markupMessage }
}
