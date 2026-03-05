/**
 * Hook for managing "given-setup" mode in the playground.
 *
 * Lets admins place given points, segments, and equality constraints
 * before starting a construction — replicating the editor's capability
 * without the editor's 800-line state machine.
 */

import { useState, useRef, useCallback } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  SerializedElement,
  SerializedEqualityFact,
  IntersectionCandidate,
} from '../types'
import { BYRNE } from '../types'
import { initializeGiven } from '../engine/constructionState'
import type { PostCompletionAction } from '../engine/replayConstruction'
import type { FactStore } from '../engine/factStore'
import { createFactStore, addFact } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ProofFact } from '../engine/facts'

// ── Label generation ──

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function labelAt(index: number): string {
  if (index < LABELS.length) return LABELS[index]
  const cycle = Math.floor(index / LABELS.length) + 1
  const ch = LABELS[index % LABELS.length]
  return `${ch}${cycle}`
}

// ── Constraint enforcement ──

function enforceEqualityConstraints(
  elements: SerializedElement[],
  facts: SerializedEqualityFact[]
): SerializedElement[] {
  if (facts.length === 0) return elements

  const positions = new Map<string, { x: number; y: number }>()
  for (const el of elements) {
    if (el.kind === 'point' && el.id && el.x != null && el.y != null) {
      positions.set(el.id, { x: el.x, y: el.y })
    }
  }

  for (let iter = 0; iter < 3; iter++) {
    let anyChanged = false
    for (const fact of facts) {
      const pLA = positions.get(fact.left.a)
      const pLB = positions.get(fact.left.b)
      const pRA = positions.get(fact.right.a)
      const pRB = positions.get(fact.right.b)
      if (!pLA || !pLB || !pRA || !pRB) continue

      const targetLen = Math.hypot(pLB.x - pLA.x, pLB.y - pLA.y)
      const dx = pRB.x - pRA.x
      const dy = pRB.y - pRA.y
      const currentLen = Math.hypot(dx, dy)
      if (currentLen < 0.001) continue
      if (Math.abs(currentLen - targetLen) < 0.001) continue

      const scale = targetLen / currentLen
      pRB.x = pRA.x + dx * scale
      pRB.y = pRA.y + dy * scale
      anyChanged = true
    }
    if (!anyChanged) break
  }

  return elements.map((el) => {
    if (el.kind === 'point' && el.id) {
      const pos = positions.get(el.id)
      if (pos) return { ...el, x: pos.x, y: pos.y }
    }
    return el
  })
}

// ── Hook ──

interface UseGivenSetupOptions {
  constructionRef: React.MutableRefObject<ConstructionState>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  postCompletionActionsRef: React.MutableRefObject<PostCompletionAction[]>
  factStoreRef: React.MutableRefObject<FactStore>
  needsDrawRef: React.MutableRefObject<boolean>
}

export interface GivenSetupState {
  isActive: boolean
  givenElements: SerializedElement[]
  givenFacts: SerializedEqualityFact[]

  activate: (
    existingElements?: SerializedElement[],
    existingFacts?: SerializedEqualityFact[]
  ) => void
  reset: () => void

  addPoint: (x: number, y: number) => string
  addSegment: (fromId: string, toId: string) => void
  movePoint: (id: string, x: number, y: number) => void
  renamePoint: (id: string, newLabel: string) => void
  deleteElement: (id: string) => void

  addFact: (leftA: string, leftB: string, rightA: string, rightB: string) => void
  deleteFact: (index: number) => void

  /** Exit given-setup mode and initialize construction with givens. */
  startConstruction: () => {
    givenElements: ConstructionElement[]
    givenFacts: SerializedEqualityFact[]
    draggablePointIds: string[]
    proofFacts: ProofFact[]
  }
}

export function useGivenSetup({
  constructionRef,
  candidatesRef,
  postCompletionActionsRef,
  factStoreRef,
  needsDrawRef,
}: UseGivenSetupOptions): GivenSetupState {
  const [isActive, setIsActive] = useState(false)
  const [givenElements, setGivenElements] = useState<SerializedElement[]>([])
  const [givenFacts, setGivenFacts] = useState<SerializedEqualityFact[]>([])
  const nextLabelRef = useRef(0)
  // Keep a ref to givenFacts for use in callbacks that need current value
  const givenFactsRef = useRef<SerializedEqualityFact[]>([])
  givenFactsRef.current = givenFacts
  const givenElementsRef = useRef<SerializedElement[]>([])
  givenElementsRef.current = givenElements

  /** Sync serialized given elements → constructionRef so they render. */
  const syncToConstruction = useCallback(
    (elements: SerializedElement[]) => {
      const constructionElements: ConstructionElement[] = elements.map((el) => {
        if (el.kind === 'point') {
          return {
            kind: 'point' as const,
            id: el.id!,
            x: el.x!,
            y: el.y!,
            label: el.label!,
            color: el.color,
            origin: 'given' as const,
          }
        }
        if (el.kind === 'segment') {
          return {
            kind: 'segment' as const,
            id: el.id!,
            fromId: el.fromId!,
            toId: el.toId!,
            color: el.color,
            origin: 'given' as const,
          }
        }
        // circle (unlikely during given-setup but handle it)
        return {
          kind: 'circle' as const,
          id: el.id!,
          centerId: el.centerId!,
          radiusPointId: el.radiusPointId!,
          color: el.color,
          origin: 'compass' as const,
        }
      })
      constructionRef.current = initializeGiven(constructionElements)
      needsDrawRef.current = true
    },
    [constructionRef, needsDrawRef]
  )

  const activate = useCallback(
    (existingElements?: SerializedElement[], existingFacts?: SerializedEqualityFact[]) => {
      const elements = existingElements ?? []
      const facts = existingFacts ?? []
      setGivenElements(elements)
      setGivenFacts(facts)
      setIsActive(true)

      // Compute next label index from existing points
      let maxLabel = 0
      for (const el of elements) {
        if (el.kind === 'point' && el.label) {
          const idx = LABELS.indexOf(el.label)
          if (idx >= 0) maxLabel = Math.max(maxLabel, idx + 1)
        }
      }
      nextLabelRef.current = maxLabel

      // Clear post-completion actions and candidates
      postCompletionActionsRef.current = []
      candidatesRef.current = []

      // Initialize construction from existing elements (or empty)
      syncToConstruction(elements)
    },
    [postCompletionActionsRef, candidatesRef, syncToConstruction]
  )

  const resetState = useCallback(() => {
    setGivenElements([])
    setGivenFacts([])
    setIsActive(false)
    nextLabelRef.current = 0
  }, [])

  const addPointFn = useCallback(
    (x: number, y: number): string => {
      const snappedX = Math.round(x * 2) / 2
      const snappedY = Math.round(y * 2) / 2
      const label = labelAt(nextLabelRef.current)
      const id = `pt-${label}`
      nextLabelRef.current++

      const point: SerializedElement = {
        kind: 'point',
        id,
        label,
        x: snappedX,
        y: snappedY,
        color: BYRNE.given,
        origin: 'given',
      }

      setGivenElements((prev) => {
        const updated = [...prev, point]
        syncToConstruction(updated)
        return updated
      })

      return id
    },
    [syncToConstruction]
  )

  const addSegmentFn = useCallback(
    (fromId: string, toId: string) => {
      const segId = `seg-${fromId.replace('pt-', '')}-${toId.replace('pt-', '')}`
      const segment: SerializedElement = {
        kind: 'segment',
        id: segId,
        fromId,
        toId,
        color: BYRNE.given,
        origin: 'given',
      }

      setGivenElements((prev) => {
        const updated = [...prev, segment]
        syncToConstruction(updated)
        return updated
      })
    },
    [syncToConstruction]
  )

  const movePointFn = useCallback(
    (id: string, x: number, y: number) => {
      const snappedX = Math.round(x * 2) / 2
      const snappedY = Math.round(y * 2) / 2

      setGivenElements((prev) => {
        const updated = prev.map((el) => (el.id === id ? { ...el, x: snappedX, y: snappedY } : el))
        const enforced = enforceEqualityConstraints(updated, givenFactsRef.current)
        syncToConstruction(enforced)
        return enforced
      })
    },
    [syncToConstruction]
  )

  const renamePointFn = useCallback((id: string, newLabel: string) => {
    const newId = `pt-${newLabel}`

    setGivenElements((prev) =>
      prev.map((el) => {
        // Rename the point itself
        if (el.id === id && el.kind === 'point') {
          return { ...el, id: newId, label: newLabel }
        }
        // Update segment references
        if (el.kind === 'segment') {
          let changed = false
          let fromId = el.fromId!
          let toId = el.toId!
          if (fromId === id) {
            fromId = newId
            changed = true
          }
          if (toId === id) {
            toId = newId
            changed = true
          }
          if (changed) {
            const segId = `seg-${fromId.replace('pt-', '')}-${toId.replace('pt-', '')}`
            return { ...el, id: segId, fromId, toId }
          }
        }
        return el
      })
    )

    // Update facts that reference the old ID
    setGivenFacts((prev) =>
      prev.map((fact) => {
        const left = { ...fact.left }
        const right = { ...fact.right }
        let changed = false
        if (left.a === id) {
          left.a = newId
          changed = true
        }
        if (left.b === id) {
          left.b = newId
          changed = true
        }
        if (right.a === id) {
          right.a = newId
          changed = true
        }
        if (right.b === id) {
          right.b = newId
          changed = true
        }
        if (!changed) return fact
        const lbl = (ptId: string) => ptId.replace('pt-', '')
        const statement = `${lbl(left.a)}${lbl(left.b)} = ${lbl(right.a)}${lbl(right.b)}`
        return { left, right, statement }
      })
    )

    // Keep nextLabelRef in sync
    const charIdx = LABELS.indexOf(newLabel)
    if (charIdx >= 0 && charIdx >= nextLabelRef.current) {
      nextLabelRef.current = charIdx + 1
    }
  }, [])

  const deleteElementFn = useCallback(
    (elementId: string) => {
      setGivenElements((prev) => {
        const el = prev.find((e) => e.id === elementId)
        let filtered: SerializedElement[]
        if (el?.kind === 'point') {
          // Cascade: remove segments that reference this point
          filtered = prev.filter(
            (e) => e.id !== elementId && e.fromId !== elementId && e.toId !== elementId
          )
        } else {
          filtered = prev.filter((e) => e.id !== elementId)
        }
        syncToConstruction(filtered)
        return filtered
      })

      // Remove facts referencing this element
      setGivenFacts((prev) =>
        prev.filter(
          (f) =>
            f.left.a !== elementId &&
            f.left.b !== elementId &&
            f.right.a !== elementId &&
            f.right.b !== elementId
        )
      )
    },
    [syncToConstruction]
  )

  const addFactFn = useCallback(
    (leftA: string, leftB: string, rightA: string, rightB: string) => {
      const labelFor = (id: string) => {
        const pt = givenElementsRef.current.find((e) => e.id === id)
        return pt?.label ?? id.replace('pt-', '')
      }
      const statement = `${labelFor(leftA)}${labelFor(leftB)} = ${labelFor(rightA)}${labelFor(rightB)}`
      const fact: SerializedEqualityFact = {
        left: { a: leftA, b: leftB },
        right: { a: rightA, b: rightB },
        statement,
      }

      setGivenFacts((prev) => {
        const newFacts = [...prev, fact]

        // Enforce constraint immediately
        setGivenElements((prevEls) => {
          const enforced = enforceEqualityConstraints(prevEls, newFacts)
          syncToConstruction(enforced)
          return enforced
        })

        return newFacts
      })
    },
    [syncToConstruction]
  )

  const deleteFactFn = useCallback((index: number) => {
    setGivenFacts((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const startConstruction = useCallback((): {
    givenElements: ConstructionElement[]
    givenFacts: SerializedEqualityFact[]
    draggablePointIds: string[]
    proofFacts: ProofFact[]
  } => {
    const elements = givenElementsRef.current
    const facts = givenFactsRef.current

    // Convert serialized → construction elements
    const constructionElements: ConstructionElement[] = elements.map((el) => {
      if (el.kind === 'point') {
        return {
          kind: 'point' as const,
          id: el.id!,
          x: el.x!,
          y: el.y!,
          label: el.label!,
          color: el.color,
          origin: 'given' as const,
        }
      }
      if (el.kind === 'segment') {
        return {
          kind: 'segment' as const,
          id: el.id!,
          fromId: el.fromId!,
          toId: el.toId!,
          color: el.color,
          origin: 'given' as const,
        }
      }
      return {
        kind: 'circle' as const,
        id: el.id!,
        centerId: el.centerId!,
        radiusPointId: el.radiusPointId!,
        color: el.color,
        origin: 'compass' as const,
      }
    })

    // Initialize construction with given elements
    constructionRef.current = initializeGiven(constructionElements)
    candidatesRef.current = []
    postCompletionActionsRef.current = []

    // Pre-load given facts into fact store
    const factStore = createFactStore()
    const proofFacts: ProofFact[] = []
    for (const gf of facts) {
      const left = distancePair(gf.left.a, gf.left.b)
      const right = distancePair(gf.right.a, gf.right.b)
      const newFacts = addFact(factStore, left, right, { type: 'given' }, gf.statement, 'Given', -1)
      proofFacts.push(...newFacts)
    }
    factStoreRef.current = factStore

    // All given points are draggable
    const draggablePointIds = elements.filter((el) => el.kind === 'point').map((el) => el.id!)

    setIsActive(false)
    needsDrawRef.current = true

    return { givenElements: constructionElements, givenFacts: facts, draggablePointIds, proofFacts }
  }, [constructionRef, candidatesRef, postCompletionActionsRef, factStoreRef, needsDrawRef])

  return {
    isActive,
    givenElements,
    givenFacts,
    activate,
    reset: resetState,
    addPoint: addPointFn,
    addSegment: addSegmentFn,
    movePoint: movePointFn,
    renamePoint: renamePointFn,
    deleteElement: deleteElementFn,
    addFact: addFactFn,
    deleteFact: deleteFactFn,
    startConstruction,
  }
}
