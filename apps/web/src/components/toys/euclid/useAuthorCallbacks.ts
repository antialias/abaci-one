/**
 * Hook that builds AuthorToolCallbacks for AI-driven construction + fact store mutations.
 *
 * Extracted from EuclidCanvas to keep the 6000-line component focused on rendering.
 * Handles the forward-reference problem internally: accepts refs to handlers that
 * are defined later in the render, and consumers assign them after creation.
 */

import { useCallback, useRef, useMemo } from 'react'
import type { ConstructionState, ConstructionPoint, IntersectionCandidate } from './types'
import type { ProofFact, Citation } from './engine/facts'
import { distancePair, angleMeasure } from './engine/facts'
import { addPoint, getPoint } from './engine/constructionState'
import { addFact, addAngleFact, type FactStore } from './engine/factStore'
import type { PostCompletionAction } from './engine/replayConstruction'
import type { AuthorToolCallbacks } from './authorToolCallbacks'

/** Mutable ref — used for refs that are written to (construction state, actions, etc.) */
type MutRef<T> = { current: T }

export interface UseAuthorCallbacksOptions {
  constructionRef: MutRef<ConstructionState>
  postCompletionActionsRef: MutRef<PostCompletionAction[]>
  candidatesRef: MutRef<IntersectionCandidate[]>
  currentStepRef: MutRef<number>
  factStoreRef: MutRef<FactStore>
  proofFactsRef: MutRef<ProofFact[]>
  /** Author-declared facts only — survives construction replay */
  authorProofFactsRef: MutRef<ProofFact[]>
  setProofFacts: (facts: ProofFact[]) => void
  needsDrawRef: MutRef<boolean>
}

export interface UseAuthorCallbacksReturn {
  callbacks: AuthorToolCallbacks
  /** Assign after handler is defined: `refs.handleCommitSegment.current = handleCommitSegment` */
  refs: {
    handleCommitCircle: MutRef<(centerId: string, radiusPointId: string) => void>
    handleCommitSegment: MutRef<(fromId: string, toId: string) => void>
    handleCommitExtend: MutRef<
      (baseId: string, throughId: string, projX: number, projY: number) => void
    >
    handleMarkIntersection: MutRef<(candidate: IntersectionCandidate) => void>
    handleCommitMacro: MutRef<(propId: number, inputPointIds: string[]) => void>
    handleRevertToAction: MutRef<(actionIndex: number) => void>
    handleRelocatePoint: MutRef<
      (
        label: string,
        x: number,
        y: number,
        force?: boolean
      ) => {
        success: boolean
        error?: string
        brokenElements?: Array<{ id: string; label?: string; kind: string }>
        brokenStepCount?: number
      }
    >
    requestDraw: MutRef<() => void>
  }
}

export function useAuthorCallbacks(opts: UseAuthorCallbacksOptions): UseAuthorCallbacksReturn {
  const {
    constructionRef,
    postCompletionActionsRef,
    candidatesRef,
    currentStepRef,
    factStoreRef,
    proofFactsRef,
    authorProofFactsRef,
    setProofFacts,
    needsDrawRef,
  } = opts

  // Forward-reference refs — consumers assign these after handlers are defined
  const handleCommitCircleRef = useRef<(centerId: string, radiusPointId: string) => void>(() => {})
  const handleCommitSegmentRef = useRef<(fromId: string, toId: string) => void>(() => {})
  const handleCommitExtendRef = useRef<
    (baseId: string, throughId: string, projX: number, projY: number) => void
  >(() => {})
  const handleMarkIntersectionRef = useRef<(candidate: IntersectionCandidate) => void>(() => {})
  const handleCommitMacroRef = useRef<(propId: number, inputPointIds: string[]) => void>(() => {})
  const handleRevertToActionRef = useRef<(actionIndex: number) => void>(() => {})
  const handleRelocatePointRef = useRef<
    (
      label: string,
      x: number,
      y: number,
      force?: boolean
    ) => {
      success: boolean
      error?: string
      brokenElements?: Array<{ id: string; label?: string; kind: string }>
      brokenStepCount?: number
    }
  >(() => ({ success: false, error: 'Not initialized' }))
  const requestDrawRef = useRef<() => void>(() => {})

  const resolvePointLabel = useCallback(
    (label: string): string | null => {
      const state = constructionRef.current
      const pt = state.elements.find(
        (e): e is ConstructionPoint => e.kind === 'point' && e.label === label
      )
      return pt?.id ?? null
    },
    [constructionRef]
  )

  const callbacks = useMemo(
    (): AuthorToolCallbacks => ({
      placePoint: async (x, y, label) => {
        const result = addPoint(constructionRef.current, x, y, 'free', label)
        constructionRef.current = result.state
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          {
            type: 'free-point' as const,
            id: result.point.id,
            label: result.point.label,
            x,
            y,
          },
        ]
        requestDrawRef.current()
        return { success: true, label: result.point.label, id: result.point.id }
      },
      commitSegment: async (fromLabel, toLabel) => {
        const fromId = resolvePointLabel(fromLabel)
        const toId = resolvePointLabel(toLabel)
        if (!fromId || !toId)
          return { success: false, error: `Point not found: ${!fromId ? fromLabel : toLabel}` }
        handleCommitSegmentRef.current(fromId, toId)
        return { success: true }
      },
      commitCircle: async (centerLabel, radiusPointLabel) => {
        const centerId = resolvePointLabel(centerLabel)
        const radiusPointId = resolvePointLabel(radiusPointLabel)
        if (!centerId || !radiusPointId)
          return {
            success: false,
            error: `Point not found: ${!centerId ? centerLabel : radiusPointLabel}`,
          }
        handleCommitCircleRef.current(centerId, radiusPointId)
        return { success: true }
      },
      commitExtend: async (baseLabel, throughLabel, distance) => {
        const baseId = resolvePointLabel(baseLabel)
        const throughId = resolvePointLabel(throughLabel)
        if (!baseId || !throughId)
          return { success: false, error: `Point not found: ${!baseId ? baseLabel : throughLabel}` }
        const basePt = getPoint(constructionRef.current, baseId)
        const throughPt = getPoint(constructionRef.current, throughId)
        if (!basePt || !throughPt) return { success: false, error: 'Point coordinates not found' }
        const dx = throughPt.x - basePt.x
        const dy = throughPt.y - basePt.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 0.001) return { success: false, error: 'Points are too close' }
        const dirX = dx / len
        const dirY = dy / len
        // Default to extending by the segment's own length (doubling it)
        if (distance != null && distance < 0.001) {
          return { success: false, error: 'Distance must be positive. Omit the distance parameter to extend by the segment\'s own length.' }
        }
        const ext = distance ?? len
        const projX = throughPt.x + dirX * ext
        const projY = throughPt.y + dirY * ext
        handleCommitExtendRef.current(baseId, throughId, projX, projY)
        return { success: true }
      },
      markIntersection: async (ofA, ofB, which) => {
        const candidates = candidatesRef.current
        const matching = candidates.filter(
          (c) => (c.ofA === ofA && c.ofB === ofB) || (c.ofA === ofB && c.ofB === ofA)
        )
        if (matching.length === 0)
          return { success: false, error: `No intersection found between ${ofA} and ${ofB}` }
        const idx = which === 'second' ? 1 : 0
        const candidate = matching[idx] ?? matching[0]
        handleMarkIntersectionRef.current(candidate)
        return { success: true, pointLabel: candidate.which }
      },
      commitMacro: async (propId, inputLabels) => {
        const inputPointIds = inputLabels
          .map((l) => resolvePointLabel(l))
          .filter(Boolean) as string[]
        if (inputPointIds.length !== inputLabels.length) {
          const missing = inputLabels.filter((l) => !resolvePointLabel(l))
          return { success: false, error: `Points not found: ${missing.join(', ')}` }
        }
        handleCommitMacroRef.current(propId, inputPointIds)
        return { success: true }
      },
      addFact: async (
        leftA,
        leftB,
        rightA,
        rightB,
        citationType,
        citationDetail,
        statement,
        justification
      ) => {
        const laId = resolvePointLabel(leftA)
        const lbId = resolvePointLabel(leftB)
        const raId = resolvePointLabel(rightA)
        const rbId = resolvePointLabel(rightB)
        if (!laId || !lbId || !raId || !rbId)
          return { success: false, error: 'Point not found for fact' }

        let citation: Citation
        switch (citationType) {
          case 'def15':
            citation = { type: 'def15', circleId: citationDetail ?? '' }
            break
          case 'cn1': {
            const parts = (citationDetail ?? '').split(',').map((s) => s.trim())
            const viaA = resolvePointLabel(parts[0] ?? '')
            const viaB = resolvePointLabel(parts[1] ?? '')
            citation = { type: 'cn1', via: distancePair(viaA ?? parts[0], viaB ?? parts[1]) }
            break
          }
          case 'cn2':
            citation = { type: 'cn2' }
            break
          case 'cn3': {
            const parts = (citationDetail ?? '').split(',').map((s) => s.trim())
            const wA = resolvePointLabel(parts[0] ?? '') ?? parts[0]
            const wB = resolvePointLabel(parts[1] ?? '') ?? parts[1]
            const pA = resolvePointLabel(parts[2] ?? '') ?? parts[2]
            const pB = resolvePointLabel(parts[3] ?? '') ?? parts[3]
            citation = { type: 'cn3', whole: distancePair(wA, wB), part: distancePair(pA, pB) }
            break
          }
          case 'cn4':
            citation = { type: 'cn4' }
            break
          case 'given':
            citation = { type: 'given' }
            break
          case 'prop':
            citation = { type: 'prop', propId: Number(citationDetail) || 0 }
            break
          default:
            citation = { type: 'given' }
        }

        const left = distancePair(laId, lbId)
        const right = distancePair(raId, rbId)
        const step = currentStepRef.current ?? 0
        const newFacts = addFact(
          factStoreRef.current,
          left,
          right,
          citation,
          statement,
          justification,
          step
        )
        if (newFacts.length > 0) {
          authorProofFactsRef.current = [...authorProofFactsRef.current, ...newFacts]
          proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
          setProofFacts(proofFactsRef.current)
          needsDrawRef.current = true
        }
        return { success: true, factCount: newFacts.length }
      },
      addAngleFact: async (
        leftVertex,
        leftRay1,
        leftRay2,
        rightVertex,
        rightRay1,
        rightRay2,
        citationType,
        citationDetail,
        statement,
        justification
      ) => {
        const lvId = resolvePointLabel(leftVertex)
        const lr1Id = resolvePointLabel(leftRay1)
        const lr2Id = resolvePointLabel(leftRay2)
        const rvId = resolvePointLabel(rightVertex)
        const rr1Id = resolvePointLabel(rightRay1)
        const rr2Id = resolvePointLabel(rightRay2)
        if (!lvId || !lr1Id || !lr2Id || !rvId || !rr1Id || !rr2Id)
          return { success: false, error: 'Point not found for angle fact' }

        let citation: Citation
        switch (citationType) {
          case 'cn1': {
            const parts = (citationDetail ?? '').split(',').map((s) => s.trim())
            const viaA = resolvePointLabel(parts[0] ?? '') ?? parts[0]
            const viaB = resolvePointLabel(parts[1] ?? '') ?? parts[1]
            citation = { type: 'cn1', via: distancePair(viaA, viaB) }
            break
          }
          case 'cn4':
            citation = { type: 'cn4' }
            break
          case 'given':
            citation = { type: 'given' }
            break
          case 'prop':
            citation = { type: 'prop', propId: Number(citationDetail) || 0 }
            break
          default:
            citation = { type: 'given' }
        }

        const left = angleMeasure(lvId, lr1Id, lr2Id)
        const right = angleMeasure(rvId, rr1Id, rr2Id)
        const step = currentStepRef.current ?? 0
        const newFacts = addAngleFact(
          factStoreRef.current,
          left,
          right,
          citation,
          statement,
          justification,
          step
        )
        if (newFacts.length > 0) {
          authorProofFactsRef.current = [...authorProofFactsRef.current, ...newFacts]
          proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
          setProofFacts(proofFactsRef.current)
          needsDrawRef.current = true
        }
        return { success: true, factCount: newFacts.length }
      },
      relocatePoint: async (label, x, y, force) => {
        return handleRelocatePointRef.current(label, x, y, force)
      },
      undoLast: async () => {
        const actions = postCompletionActionsRef.current
        if (actions.length === 0) return { success: false, error: 'Nothing to undo' }
        handleRevertToActionRef.current(actions.length - 2)
        return { success: true }
      },
      highlight: async (entityType, labels) => {
        const entity = (() => {
          switch (entityType) {
            case 'point':
              return labels.length === 1 ? { type: 'point' as const, label: labels[0] } : null
            case 'segment':
              return labels.length === 2
                ? { type: 'segment' as const, from: labels[0], to: labels[1] }
                : null
            case 'triangle':
              return labels.length === 3
                ? { type: 'triangle' as const, vertices: [labels[0], labels[1], labels[2]] }
                : null
            case 'angle':
              return labels.length === 3
                ? { type: 'angle' as const, points: [labels[0], labels[1], labels[2]] }
                : null
            default:
              return null
          }
        })()
        if (!entity) return { success: false, error: 'Invalid entity' }
        return { success: true }
      },
    }),
    [resolvePointLabel, constructionRef, currentStepRef, factStoreRef, proofFactsRef, setProofFacts]
  )

  const refs = useMemo(
    () => ({
      handleCommitCircle: handleCommitCircleRef,
      handleCommitSegment: handleCommitSegmentRef,
      handleCommitExtend: handleCommitExtendRef,
      handleMarkIntersection: handleMarkIntersectionRef,
      handleCommitMacro: handleCommitMacroRef,
      handleRevertToAction: handleRevertToActionRef,
      handleRelocatePoint: handleRelocatePointRef,
      requestDraw: requestDrawRef,
    }),
    []
  )

  return { callbacks, refs }
}
