import { useRef, useCallback } from 'react'
import type { ConstructionState, ConstructionElement, GhostLayer, PropositionDef } from '../types'
import type { ProofFact } from '../engine/facts'
import type { ReplayResult } from '../engine/replayConstruction'
import { deriveCompletionResult } from '../engine/snapshots'
import { mergeProofFacts } from '../engine/factStore'
import type { FactStore } from '../engine/factStore'
import type { UseEuclidMusicReturn } from '../audio/useEuclidMusic'

interface UseDragTopologyTrackingOptions {
  authorProofFactsRef: React.MutableRefObject<ProofFact[]>
  proofFactsRef: React.MutableRefObject<ProofFact[]>
  ghostLayersRef: React.MutableRefObject<GhostLayer[]>
  propositionRef: React.MutableRefObject<PropositionDef>
  musicRef: React.MutableRefObject<UseEuclidMusicReturn | null>
  notifierRef: React.MutableRefObject<{
    notifyConstruction: (opts: {
      action: string
      shouldPrompt: boolean
      collapseInChat?: boolean
    }) => void
    notifyDragEnd: (label?: string) => void
  }>
  constructionRef: React.MutableRefObject<ConstructionState>
  dragLabelRef: React.MutableRefObject<string | null>
  wiggleCancelRef: React.MutableRefObject<(() => void) | null>
  factStoreRef: React.MutableRefObject<FactStore>
  handleConstructionBreakdown: () => void
  handleDragStart: (pointId: string) => void
  setTrailingEvent: (event: null) => void
  setProofFacts: (facts: ProofFact[]) => void
}

/** Build a human-readable name for a construction element. */
function describeElement(el: ConstructionElement, state: ConstructionState): string {
  if (el.kind === 'point') return `point ${el.label}`
  if (el.kind === 'circle') {
    const center = state.elements.find((e) => e.id === el.centerId)
    const radius = state.elements.find((e) => e.id === el.radiusPointId)
    const cLabel = center && 'label' in center ? center.label : '?'
    const rLabel = radius && 'label' in radius ? radius.label : '?'
    return `circle centered at ${cLabel} through ${rLabel}`
  }
  // el.kind === 'segment'
  const from = state.elements.find((e) => e.id === el.fromId)
  const to = state.elements.find((e) => e.id === el.toId)
  const fLabel = from && 'label' in from ? from.label : '?'
  const tLabel = to && 'label' in to ? to.label : '?'
  return `segment ${fLabel}${tLabel}`
}

export function useDragTopologyTracking({
  authorProofFactsRef,
  proofFactsRef,
  ghostLayersRef,
  propositionRef,
  musicRef,
  notifierRef,
  constructionRef,
  dragLabelRef,
  wiggleCancelRef,
  factStoreRef,
  handleConstructionBreakdown,
  handleDragStart,
  setTrailingEvent,
  setProofFacts,
}: UseDragTopologyTrackingOptions) {
  const constructionIntactRef = useRef(true)
  /** Baseline from drag start — never updated during drag */
  const topologyBaselineRef = useRef<{
    map: Map<string, string>
    steps: number
    factCount: number
  } | null>(null)
  /** Current frame's map — used to describe elements that may disappear next frame */
  const topologyCurrentRef = useRef<Map<string, string>>(new Map())
  const topologyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDragReplay = useCallback(
    (result: ReplayResult) => {
      // Combine replay-derived facts with author-declared facts that survive replay
      const combined =
        authorProofFactsRef.current.length > 0
          ? [...result.proofFacts, ...authorProofFactsRef.current]
          : result.proofFacts
      proofFactsRef.current = combined
      setProofFacts(combined)
      // Re-merge author facts into the (already-rebuilt) fact store so queries work
      if (authorProofFactsRef.current.length > 0) {
        mergeProofFacts(factStoreRef.current, authorProofFactsRef.current)
      }
      ghostLayersRef.current = result.ghostLayers
      musicRef.current?.notifyChange()

      // Detect construction breakdown: was intact, now incomplete
      const intact = result.stepsCompleted >= propositionRef.current.steps.length
      if (constructionIntactRef.current && !intact) {
        handleConstructionBreakdown()
      }
      constructionIntactRef.current = intact

      // Build current element map (need this every frame so we can name
      // elements that might disappear in a future frame)
      const currMap = new Map<string, string>()
      for (const el of result.state.elements) {
        currMap.set(el.id, describeElement(el, result.state))
      }

      // Set baseline on first frame (drag start)
      if (!topologyBaselineRef.current) {
        topologyBaselineRef.current = {
          map: new Map(currMap),
          steps: result.stepsCompleted,
          factCount: result.proofFacts.length,
        }
        topologyCurrentRef.current = currMap
        return
      }

      topologyCurrentRef.current = currMap

      // Compute NET diff from drag-start baseline (not frame-to-frame).
      // This resolves oscillations: if F disappears then reappears, net = nothing.
      const baseline = topologyBaselineRef.current
      const baseIds = new Set(baseline.map.keys())
      const currIds = new Set(currMap.keys())
      const appeared = [...currIds].filter((id) => !baseIds.has(id))
      const disappeared = [...baseIds].filter((id) => !currIds.has(id))
      const stepsChanged = result.stepsCompleted !== baseline.steps
      const parts: string[] = []

      if (appeared.length > 0) {
        parts.push(`${appeared.map((id) => currMap.get(id)!).join(', ')} appeared`)
      }
      if (disappeared.length > 0) {
        // Use current map first (for elements that existed recently), fall back to baseline
        parts.push(
          `${disappeared.map((id) => topologyCurrentRef.current.get(id) ?? baseline.map.get(id)!).join(', ')} disappeared`
        )
      }
      if (stepsChanged) {
        if (result.stepsCompleted < baseline.steps) {
          // Use the proof engine to describe what broke
          const cr = deriveCompletionResult(
            result.factStore,
            propositionRef.current.resultSegments,
            result.state
          )
          const failedStep = propositionRef.current.steps[result.stepsCompleted]
          let breakdown = `construction broke down at step ${result.stepsCompleted + 1}`
          if (failedStep) breakdown += `: "${failedStep.instruction}"`
          if (cr.status === 'unproven' && cr.statement) {
            breakdown += ` — cannot prove ${cr.statement}`
          }
          parts.push(breakdown)
        } else if (result.stepsCompleted > baseline.steps) {
          const cr = deriveCompletionResult(
            result.factStore,
            propositionRef.current.resultSegments,
            result.state
          )
          let restored = `construction restored through step ${result.stepsCompleted}`
          if (cr.status === 'proven' && cr.statement) {
            restored += ` — ${cr.statement} proven`
          }
          parts.push(restored)
        }
      }

      // Note proof fact count changes (tells Euclid about proof chain health)
      const factDelta = result.proofFacts.length - baseline.factCount
      if (factDelta < 0) {
        parts.push(`${Math.abs(factDelta)} proven fact${Math.abs(factDelta) > 1 ? 's' : ''} lost`)
      } else if (factDelta > 0) {
        parts.push(`${factDelta} new fact${factDelta > 1 ? 's' : ''} proven`)
      }

      // Debounce + collapse: replace the single trailing event in chat
      if (topologyTimerRef.current) clearTimeout(topologyTimerRef.current)
      topologyTimerRef.current = setTimeout(() => {
        topologyTimerRef.current = null
        if (parts.length > 0) {
          const action = `While dragging: ${parts.join('; ')}`
          notifierRef.current.notifyConstruction({
            action,
            shouldPrompt: false,
            collapseInChat: true,
          })
        } else {
          // Net change resolved to nothing — remove any trailing event
          setTrailingEvent(null)
        }
      }, 400)
    },
    [handleConstructionBreakdown, setTrailingEvent]
  )

  const onDragStart = useCallback(
    (pointId: string) => {
      wiggleCancelRef.current?.()
      wiggleCancelRef.current = null
      // Capture label for the drag-end notifier (dragPointIdRef is cleared before onDragEnd fires)
      const pt = constructionRef.current.elements.find(
        (e) => e.kind === 'point' && e.id === pointId
      )
      dragLabelRef.current = pt && 'label' in pt ? pt.label : null
      // Reset topology tracking so first replay frame sets the baseline
      topologyBaselineRef.current = null
      handleDragStart(pointId)
    },
    [handleDragStart]
  )

  const onDragEnd = useCallback(() => {
    notifierRef.current.notifyDragEnd(dragLabelRef.current ?? undefined)
    dragLabelRef.current = null
  }, [])

  return { handleDragReplay, onDragStart, onDragEnd }
}
