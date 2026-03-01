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
 * and injects construction events into the shared chat message history.
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
import type { ChatMessage } from '@/lib/character/types'
import { generateId } from '@/lib/character/useCharacterChat'
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
  /** When true, replace trailing event messages in chat instead of appending.
   *  Use for rapid-fire events (e.g. topology changes during drag) to avoid spam. */
  collapseInChat?: boolean
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
  notifyDragEnd(pointLabel?: string): void
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
  /** Inject a construction event into the shared chat message history */
  addMessage: (msg: ChatMessage) => void
  /** Replace trailing events with one message (or remove them if null) */
  setTrailingEvent: (msg: ChatMessage | null) => void
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
    addMessage,
    setTrailingEvent,
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
    /** Pass a pre-captured screenshot string, true to capture now, or false/null to skip */
    screenshotOrFlag: string | boolean | null,
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

    // Reuse pre-captured screenshot or capture fresh if true was passed
    const screenshot = typeof screenshotOrFlag === 'string'
      ? screenshotOrFlag
      : screenshotOrFlag && canvasRef.current
        ? captureScreenshot(canvasRef.current)
        : null

    // For prompted updates, include the full state dump so the model has
    // complete context when generating a response. For silent updates,
    // send only a compact note — repeated full dumps overwhelm the model
    // and it loses track of what's current vs. stale.
    let text: string
    if (shouldPrompt) {
      text = `[CONSTRUCTION CHANGED: ${action} — acknowledge briefly what the student did and guide them on what to do next. Keep it to 1-2 sentences.]\n\n${toolText}\n\n${graph}\n\n=== Proven Facts ===\n${factsText}`
    } else {
      text = `[SILENT STATE UPDATE — do not speak. ${action}]`
    }

    vc.sendContextUpdate(text, screenshot, shouldPrompt)
    return true
  }, [voiceCallRef, constructionRef, proofFactsRef, currentStepRef, steps, isComplete, canvasRef, readToolState])

  const notifyConstruction = useCallback((event: ConstructionEvent) => {
    // Cancel any pending tool timer — construction is more important
    if (toolTimerRef.current) {
      clearTimeout(toolTimerRef.current)
      toolTimerRef.current = null
    }

    // Capture screenshot for both chat and voice
    const screenshot = canvasRef.current
      ? captureScreenshot(canvasRef.current)
      : null

    // Inject event into shared chat history so the LLM sees it at the right temporal position.
    // collapseInChat replaces trailing events (for rapid-fire drag topology changes).
    const msg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: event.action,
      timestamp: Date.now(),
      isEvent: true,
      imageDataUrl: screenshot ?? undefined,
    }
    if (event.collapseInChat) {
      setTrailingEvent(msg)
    } else {
      addMessage(msg)
    }

    // Send to voice immediately (reuse captured screenshot)
    const delivered = sendToVoice(event.action, event.shouldPrompt, screenshot)
    addLogEntry('construction', event.action, delivered)

    console.log('[notifier] construction: %s (delivered=%s)', event.action, delivered)
  }, [sendToVoice, addMessage, setTrailingEvent, addLogEntry, canvasRef])

  const notifyToolState = useCallback(() => {
    if (toolTimerRef.current) clearTimeout(toolTimerRef.current)

    toolTimerRef.current = setTimeout(() => {
      toolTimerRef.current = null
      const delivered = sendToVoice('tool state change', false, false)
      addLogEntry('tool', 'tool state change', delivered)
      console.log('[notifier] tool state (delivered=%s)', delivered)
    }, 300)
  }, [sendToVoice, addLogEntry])

  const notifyDragEnd = useCallback((pointLabel?: string) => {
    if (dragTimerRef.current) clearTimeout(dragTimerRef.current)

    dragTimerRef.current = setTimeout(() => {
      dragTimerRef.current = null
      const action = pointLabel
        ? `Dragged point ${pointLabel} to a new position`
        : 'Dragged a point to a new position'
      const screenshot = canvasRef.current
        ? captureScreenshot(canvasRef.current)
        : null
      addMessage({
        id: generateId(),
        role: 'user',
        content: action,
        timestamp: Date.now(),
        isEvent: true,
        imageDataUrl: screenshot ?? undefined,
      })
      const delivered = sendToVoice(action, true, screenshot)
      addLogEntry('drag', 'drag end', delivered)
      console.log('[notifier] drag end (delivered=%s)', delivered)
    }, 600)
  }, [sendToVoice, addMessage, addLogEntry, canvasRef])

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
