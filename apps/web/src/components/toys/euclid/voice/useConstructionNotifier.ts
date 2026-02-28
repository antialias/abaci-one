'use client'

/**
 * Push-based construction notifier — replaces polling in useEuclidVoice.
 *
 * Three notification methods with different debounce strategies:
 * - notifyConstruction: immediate, cancels pending tool timer
 * - notifyToolState: 300ms debounce
 * - notifyDragEnd: 600ms debounce with screenshot
 *
 * Each call serializes current state and pushes to the active voice session
 * and/or stores in pendingActionRef for the text chat.
 */

import { useCallback, useRef } from 'react'
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
import type { UseVoiceCallReturn } from '@/lib/voice/types'
import { captureScreenshot } from '@/lib/character/captureScreenshot'
import {
  serializeConstructionGraph,
  serializeProofFacts,
  serializeToolState,
  type ToolStateInfo,
} from './serializeProofState'

export interface ConstructionEvent {
  /** Human-readable description of what the user did */
  action: string
  /** true = voice Euclid responds, false = silent update */
  shouldPrompt: boolean
}

export interface NotifierLogEntry {
  timestamp: number
  type: 'construction' | 'tool' | 'drag'
  action: string
  delivered: boolean
}

const MAX_LOG_ENTRIES = 20

export interface ConstructionNotifier {
  notifyConstruction(event: ConstructionEvent): void
  notifyToolState(): void
  notifyDragEnd(): void
  /** Recent push log for debug panel */
  recentEvents: NotifierLogEntry[]
}

interface UseConstructionNotifierOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  constructionRef: React.RefObject<ConstructionState>
  proofFactsRef: React.RefObject<ProofFact[]>
  currentStepRef: React.RefObject<number>
  steps: PropositionStep[]
  isComplete: boolean
  activeToolRef: React.RefObject<ActiveTool>
  compassPhaseRef: React.RefObject<CompassPhase>
  straightedgePhaseRef: React.RefObject<StraightedgePhase>
  extendPhaseRef: React.RefObject<ExtendPhase>
  macroPhaseRef: React.RefObject<MacroPhase>
  dragPointIdRef: React.RefObject<string | null>
  voiceCallRef: React.RefObject<UseVoiceCallReturn | null>
  pendingActionRef: React.MutableRefObject<string | null>
}

export function useConstructionNotifier(
  options: UseConstructionNotifierOptions,
): React.MutableRefObject<ConstructionNotifier> {
  const {
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    steps,
    isComplete,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    voiceCallRef,
    pendingActionRef,
  } = options

  const toolTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logRef = useRef<NotifierLogEntry[]>([])

  const readToolState = useCallback((): ToolStateInfo => ({
    activeTool: activeToolRef.current ?? 'compass',
    compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
    straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
    extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
    macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
    dragPointId: dragPointIdRef.current ?? null,
  }), [activeToolRef, compassPhaseRef, straightedgePhaseRef, extendPhaseRef, macroPhaseRef, dragPointIdRef])

  const addLogEntry = useCallback((type: NotifierLogEntry['type'], action: string, delivered: boolean) => {
    logRef.current = [
      ...logRef.current.slice(-(MAX_LOG_ENTRIES - 1)),
      { timestamp: Date.now(), type, action, delivered },
    ]
  }, [])

  const sendToVoice = useCallback((
    action: string,
    shouldPrompt: boolean,
    includeScreenshot: boolean,
  ) => {
    const vc = voiceCallRef.current
    console.log('[notifier] sendToVoice: vc=%s, state=%s, action=%s', vc ? 'exists' : 'null', vc?.state ?? 'N/A', action)
    if (!vc || vc.state !== 'active') return false

    const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
    const state = constructionRef.current ?? emptyState
    const facts = proofFactsRef.current ?? []
    const step = currentStepRef.current ?? 0
    const toolInfo = readToolState()

    const graph = serializeConstructionGraph(state)
    const factsText = serializeProofFacts(facts)
    const toolText = serializeToolState(toolInfo, state, step, steps, isComplete)

    const screenshot = includeScreenshot && canvasRef.current
      ? captureScreenshot(canvasRef.current)
      : null

    const prefix = shouldPrompt
      ? `[CONSTRUCTION CHANGED: ${action} — acknowledge briefly what the student did and guide them on what to do next. Keep it to 1-2 sentences.]`
      : '[TOOL STATE UPDATE — do not speak, just update your understanding silently]'
    const text = `${prefix}\n\n${toolText}\n\n${graph}\n\n=== Proven Facts ===\n${factsText}`

    vc.sendContextUpdate(text, screenshot, shouldPrompt)
    return true
  }, [voiceCallRef, constructionRef, proofFactsRef, currentStepRef, steps, isComplete, canvasRef, readToolState])

  const notifyConstruction = useCallback((event: ConstructionEvent) => {
    // Cancel any pending tool timer — construction is more important
    if (toolTimerRef.current) {
      clearTimeout(toolTimerRef.current)
      toolTimerRef.current = null
    }

    // Set pending action for text chat
    pendingActionRef.current = event.action

    // Send to voice immediately
    const delivered = sendToVoice(event.action, event.shouldPrompt, true)
    addLogEntry('construction', event.action, delivered)

    console.log('[notifier] construction: %s (delivered=%s)', event.action, delivered)
  }, [sendToVoice, pendingActionRef, addLogEntry])

  const notifyToolState = useCallback(() => {
    if (toolTimerRef.current) clearTimeout(toolTimerRef.current)

    toolTimerRef.current = setTimeout(() => {
      toolTimerRef.current = null
      const delivered = sendToVoice('tool state change', false, false)
      addLogEntry('tool', 'tool state change', delivered)
      console.log('[notifier] tool state (delivered=%s)', delivered)
    }, 300)
  }, [sendToVoice, addLogEntry])

  const notifyDragEnd = useCallback(() => {
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current)

    dragTimerRef.current = setTimeout(() => {
      dragTimerRef.current = null
      pendingActionRef.current = 'Dragged a point to a new position'
      const delivered = sendToVoice('Dragged a point to a new position', true, true)
      addLogEntry('drag', 'drag end', delivered)
      console.log('[notifier] drag end (delivered=%s)', delivered)
    }, 600)
  }, [sendToVoice, pendingActionRef, addLogEntry])

  const notifierRef = useRef<ConstructionNotifier>({
    notifyConstruction,
    notifyToolState,
    notifyDragEnd,
    recentEvents: logRef.current,
  })

  // Keep the ref up to date
  notifierRef.current = {
    notifyConstruction,
    notifyToolState,
    notifyDragEnd,
    recentEvents: logRef.current,
  }

  return notifierRef
}
