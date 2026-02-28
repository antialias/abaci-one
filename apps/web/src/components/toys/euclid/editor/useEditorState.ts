import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
  GhostLayer,
  SerializedStep,
  SerializedAction,
  SerializedElement,
  SerializedEqualityFact,
  ProofJSON,
} from '../types'
import { BYRNE } from '../types'
import { getPoint } from '../engine/constructionState'
import type { FactStore } from '../engine/factStore'
import { createFactStore, rebuildFactStore } from '../engine/factStore'
import { addFact } from '../engine/factStore'
import { distancePair } from '../engine/facts'
import type { ProofFact } from '../engine/facts'
import { PROPOSITION_REFS } from './propositionReference'

// ── Constraint enforcement ──

/**
 * Enforce equality constraints by adjusting point positions.
 * Convention: the left side of each fact is the reference length;
 * the right side's second point (right.b) is moved along the ray
 * from right.a to match.  Multiple iterations handle chains.
 */
function enforceEqualityConstraints(
  elements: SerializedElement[],
  facts: SerializedEqualityFact[]
): SerializedElement[] {
  if (facts.length === 0) return elements

  // Build mutable position map
  const positions = new Map<string, { x: number; y: number }>()
  for (const el of elements) {
    if (el.kind === 'point' && el.id && el.x != null && el.y != null) {
      positions.set(el.id, { x: el.x, y: el.y })
    }
  }

  let anyChanged = false
  for (let iter = 0; iter < 3; iter++) {
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
  }

  if (!anyChanged) return elements

  return elements.map((el) => {
    if (el.kind === 'point' && el.id) {
      const pos = positions.get(el.id)
      if (pos && (pos.x !== el.x || pos.y !== el.y)) {
        return { ...el, x: pos.x, y: pos.y }
      }
    }
    return el
  })
}

// ── Editor mode ──

export type EditorMode = 'given-setup' | 'authoring'

// ── Proof snapshot for undo ──

interface EditorSnapshot {
  construction: ConstructionState
  candidates: IntersectionCandidate[]
  proofFacts: ProofFact[]
  ghostLayers: GhostLayer[]
  steps: SerializedStep[]
}

// ── State hook ──

interface UseEditorStateOptions {
  propositionId: number
  constructionRef: React.MutableRefObject<ConstructionState>
  candidatesRef: React.MutableRefObject<IntersectionCandidate[]>
  factStoreRef: React.MutableRefObject<FactStore>
  ghostLayersRef: React.MutableRefObject<GhostLayer[]>
}

export function useEditorState({
  propositionId,
  constructionRef,
  candidatesRef,
  factStoreRef,
  ghostLayersRef,
}: UseEditorStateOptions) {
  const ref = PROPOSITION_REFS[propositionId]
  const [mode, setMode] = useState<EditorMode>('given-setup')
  const [steps, setSteps] = useState<SerializedStep[]>([])
  const [givenElements, setGivenElements] = useState<SerializedElement[]>([])
  const [givenFacts, setGivenFacts] = useState<SerializedEqualityFact[]>([])
  const [authorNotes, setAuthorNotes] = useState('')
  const [activeCitation, setActiveCitation] = useState<string | null>(null)
  const [proofFacts, setProofFacts] = useState<ProofFact[]>([])
  const proofFactsRef = useRef<ProofFact[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Snapshot stack for undo
  const snapshotStackRef = useRef<EditorSnapshot[]>([])

  // ── Capture snapshot ──
  const captureSnapshot = useCallback(
    (): EditorSnapshot => ({
      construction: constructionRef.current,
      candidates: [...candidatesRef.current],
      proofFacts: [...proofFactsRef.current],
      ghostLayers: [...ghostLayersRef.current],
      steps: [...steps],
    }),
    [constructionRef, candidatesRef, ghostLayersRef, steps]
  )

  // ── Given element management ──

  const nextLabelRef = useRef(0)

  const addGivenPoint = useCallback((x: number, y: number): string => {
    const label = String.fromCharCode(65 + nextLabelRef.current)
    nextLabelRef.current++
    const el: SerializedElement = {
      kind: 'point',
      id: `pt-${label}`,
      label,
      x,
      y,
      color: BYRNE.given,
      origin: 'given',
    }
    setGivenElements((prev) => [...prev, el])
    setDirty(true)
    return el.id
  }, [])

  /** Add a given point that was already created in constructionState (unified point tool path) */
  const addGivenPointFromConstruction = useCallback(
    (pointId: string, label: string, x: number, y: number) => {
      const el: SerializedElement = {
        kind: 'point',
        id: pointId,
        label,
        x,
        y,
        color: BYRNE.given,
        origin: 'given',
      }
      setGivenElements((prev) => [...prev, el])
      // Keep nextLabelRef in sync
      const idx = label.charCodeAt(0) - 65
      if (idx >= nextLabelRef.current) {
        nextLabelRef.current = idx + 1
      }
      setDirty(true)
    },
    []
  )

  const addGivenSegment = useCallback(
    (fromId: string, toId: string) => {
      const segCount = givenElements.filter((e) => e.kind === 'segment').length
      const el: SerializedElement = {
        kind: 'segment',
        id: `seg-${segCount + 1}`,
        fromId,
        toId,
        color: BYRNE.given,
        origin: 'given',
      }
      setGivenElements((prev) => [...prev, el])
      setDirty(true)
    },
    [givenElements]
  )

  /** Sync point positions from givenElements into constructionRef */
  const syncPositionsToConstruction = useCallback(
    (elements: SerializedElement[]) => {
      const posMap = new Map<string, { x: number; y: number }>()
      for (const el of elements) {
        if (el.kind === 'point' && el.id && el.x != null && el.y != null) {
          posMap.set(el.id, { x: el.x, y: el.y })
        }
      }
      let changed = false
      const updatedEls = constructionRef.current.elements.map((cel) => {
        if (cel.kind === 'point') {
          const pos = posMap.get(cel.id)
          if (pos && (pos.x !== cel.x || pos.y !== cel.y)) {
            changed = true
            return { ...cel, x: pos.x, y: pos.y }
          }
        }
        return cel
      })
      if (changed) {
        constructionRef.current = { ...constructionRef.current, elements: updatedEls }
      }
    },
    [constructionRef]
  )

  const updateGivenPointPosition = useCallback(
    (pointId: string, x: number, y: number) => {
      let enforcedResult: SerializedElement[] | null = null
      setGivenElements((prev) => {
        const updated = prev.map((el) => (el.id === pointId ? { ...el, x, y } : el))
        const enforced = enforceEqualityConstraints(updated, givenFacts)
        enforcedResult = enforced
        return enforced
      })
      // Sync any constraint-adjusted positions back to constructionRef
      if (enforcedResult) {
        syncPositionsToConstruction(enforcedResult)
      }
      setDirty(true)
    },
    [givenFacts, syncPositionsToConstruction]
  )

  const deleteGivenElement = useCallback(
    (elementId: string) => {
      setGivenElements((prev) => {
        // If deleting a point, also remove segments that reference it
        const el = prev.find((e) => e.id === elementId)
        if (el?.kind === 'point') {
          return prev.filter(
            (e) => e.id !== elementId && e.fromId !== elementId && e.toId !== elementId
          )
        }
        return prev.filter((e) => e.id !== elementId)
      })
      // Also remove givenFacts that reference the deleted point
      setGivenFacts((prev) =>
        prev.filter(
          (f) =>
            f.left.a !== elementId &&
            f.left.b !== elementId &&
            f.right.a !== elementId &&
            f.right.b !== elementId
        )
      )
      // Also remove from construction state
      constructionRef.current = {
        ...constructionRef.current,
        elements: constructionRef.current.elements.filter((e) => {
          if (e.id === elementId) return false
          if (e.kind === 'segment' && (e.fromId === elementId || e.toId === elementId)) return false
          return true
        }),
      }
      setDirty(true)
    },
    [constructionRef]
  )

  const renameGivenPoint = useCallback((pointId: string, newLabel: string) => {
    const newId = `pt-${newLabel}`
    setGivenElements((prev) =>
      prev.map((el) => {
        if (el.id === pointId) return { ...el, id: newId, label: newLabel }
        if (el.fromId === pointId) return { ...el, fromId: newId }
        if (el.toId === pointId) return { ...el, toId: newId }
        if (el.centerId === pointId) return { ...el, centerId: newId }
        if (el.radiusPointId === pointId) return { ...el, radiusPointId: newId }
        return el
      })
    )
    // Also rename in givenFacts
    setGivenFacts((prev) =>
      prev.map((fact) => {
        const left = { ...fact.left }
        const right = { ...fact.right }
        let changed = false
        if (left.a === pointId) {
          left.a = newId
          changed = true
        }
        if (left.b === pointId) {
          left.b = newId
          changed = true
        }
        if (right.a === pointId) {
          right.a = newId
          changed = true
        }
        if (right.b === pointId) {
          right.b = newId
          changed = true
        }
        if (!changed) return fact
        // Regenerate statement from point IDs
        const lbl = (id: string) => id.replace('pt-', '')
        const statement = `${lbl(left.a)}${lbl(left.b)} = ${lbl(right.a)}${lbl(right.b)}`
        return { left, right, statement }
      })
    )
    setDirty(true)
  }, [])

  // ── Given fact (equality) management ──

  const addGivenFact = useCallback(
    (leftA: string, leftB: string, rightA: string, rightB: string) => {
      const labelFor = (id: string) => {
        const pt = givenElements.find((e) => e.id === id)
        return pt?.label ?? id.replace('pt-', '')
      }
      const statement = `${labelFor(leftA)}${labelFor(leftB)} = ${labelFor(rightA)}${labelFor(rightB)}`
      const fact: SerializedEqualityFact = {
        left: { a: leftA, b: leftB },
        right: { a: rightA, b: rightB },
        statement,
      }
      const newFacts = [...givenFacts, fact]
      setGivenFacts(newFacts)

      // Enforce constraint immediately — snap the right-side endpoint
      const enforced = enforceEqualityConstraints(givenElements, newFacts)
      if (enforced !== givenElements) {
        setGivenElements(enforced)
        syncPositionsToConstruction(enforced)
      }

      setDirty(true)
    },
    [givenElements, givenFacts, syncPositionsToConstruction]
  )

  const deleteGivenFact = useCallback((index: number) => {
    setGivenFacts((prev) => prev.filter((_, i) => i !== index))
    setDirty(true)
  }, [])

  // ── Initialize construction from given elements ──

  const initializeConstruction = useCallback(() => {
    const elements: ConstructionElement[] = givenElements.map((el) => {
      if (el.kind === 'point') {
        return {
          kind: 'point' as const,
          id: el.id!,
          x: el.x!,
          y: el.y!,
          label: el.label!,
          color: el.color,
          origin: el.origin as 'given',
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

    let maxLabelIndex = 0
    for (const el of elements) {
      if (el.kind === 'point') {
        const idx = el.label.charCodeAt(0) - 65
        if (idx >= 0 && idx < 26) {
          maxLabelIndex = Math.max(maxLabelIndex, idx + 1)
        }
      }
    }

    constructionRef.current = {
      elements,
      nextLabelIndex: maxLabelIndex,
      nextColorIndex: 0,
    }
    candidatesRef.current = []
    factStoreRef.current = createFactStore()
    ghostLayersRef.current = []

    // Pre-load given facts into the fact store
    const initialFacts: ProofFact[] = []
    for (const gf of givenFacts) {
      const left = distancePair(gf.left.a, gf.left.b)
      const right = distancePair(gf.right.a, gf.right.b)
      initialFacts.push(
        ...addFact(factStoreRef.current, left, right, { type: 'given' }, gf.statement, 'Given', -1)
      )
    }
    proofFactsRef.current = initialFacts
    setProofFacts(initialFacts)

    // Reset snapshot stack with initial state
    snapshotStackRef.current = [
      {
        construction: constructionRef.current,
        candidates: [],
        proofFacts: initialFacts,
        ghostLayers: [],
        steps: [],
      },
    ]
  }, [givenElements, givenFacts, constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Start proof mode ──

  const startProof = useCallback(() => {
    initializeConstruction()
    setSteps([])
    setMode('authoring')
  }, [initializeConstruction])

  // ── Return to given setup ──

  const editGiven = useCallback(() => {
    setSteps([])
    setActiveCitation(null)
    candidatesRef.current = []
    factStoreRef.current = createFactStore()
    ghostLayersRef.current = []
    proofFactsRef.current = []
    setProofFacts([])
    snapshotStackRef.current = []
    // Rebuild construction from given elements so the main RAF loop renders them
    initializeConstruction()
    setMode('given-setup')
  }, [candidatesRef, factStoreRef, ghostLayersRef, initializeConstruction])

  // ── Reset everything ──

  // ── Full-state snapshot for undo after reset ──

  interface FullSnapshot {
    mode: EditorMode
    steps: SerializedStep[]
    givenElements: SerializedElement[]
    givenFacts: SerializedEqualityFact[]
    authorNotes: string
    activeCitation: string | null
    proofFacts: ProofFact[]
    nextLabel: number
    candidates: IntersectionCandidate[]
    factStore: FactStore
    ghostLayers: GhostLayer[]
    snapshotStack: EditorSnapshot[]
    construction: ConstructionState
  }

  const captureFullState = useCallback(
    (): FullSnapshot => ({
      mode,
      steps,
      givenElements,
      givenFacts,
      authorNotes,
      activeCitation,
      proofFacts: [...proofFactsRef.current],
      nextLabel: nextLabelRef.current,
      candidates: [...candidatesRef.current],
      factStore: factStoreRef.current,
      ghostLayers: [...ghostLayersRef.current],
      snapshotStack: [...snapshotStackRef.current],
      construction: constructionRef.current,
    }),
    [
      mode,
      steps,
      givenElements,
      givenFacts,
      authorNotes,
      activeCitation,
      constructionRef,
      candidatesRef,
      factStoreRef,
      ghostLayersRef,
    ]
  )

  const restoreFullState = useCallback(
    (snap: FullSnapshot) => {
      setMode(snap.mode)
      setSteps(snap.steps)
      setGivenElements(snap.givenElements)
      setGivenFacts(snap.givenFacts)
      setAuthorNotes(snap.authorNotes)
      setActiveCitation(snap.activeCitation)
      proofFactsRef.current = snap.proofFacts
      setProofFacts(snap.proofFacts)
      nextLabelRef.current = snap.nextLabel
      candidatesRef.current = snap.candidates
      factStoreRef.current = snap.factStore
      ghostLayersRef.current = snap.ghostLayers
      snapshotStackRef.current = snap.snapshotStack
      constructionRef.current = snap.construction
      setDirty(true)
    },
    [constructionRef, candidatesRef, factStoreRef, ghostLayersRef]
  )

  const resetAll = useCallback(() => {
    setSteps([])
    setGivenElements([])
    setGivenFacts([])
    setActiveCitation(null)
    setAuthorNotes('')
    setProofFacts([])
    proofFactsRef.current = []
    nextLabelRef.current = 0
    candidatesRef.current = []
    factStoreRef.current = createFactStore()
    ghostLayersRef.current = []
    snapshotStackRef.current = []
    constructionRef.current = {
      elements: [],
      nextLabelIndex: 0,
      nextColorIndex: 0,
    }
    setMode('given-setup')
    setDirty(true)
  }, [constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Add step ──

  const addStep = useCallback(
    (step: SerializedStep) => {
      // Capture snapshot before this step
      snapshotStackRef.current.push({
        construction: constructionRef.current,
        candidates: [...candidatesRef.current],
        proofFacts: [...proofFactsRef.current],
        ghostLayers: [...ghostLayersRef.current],
        steps: [...steps],
      })

      setSteps((prev) => [...prev, step])
      setActiveCitation(null)
      setDirty(true)
    },
    [constructionRef, candidatesRef, ghostLayersRef, steps]
  )

  // ── Update step instruction / notes ──

  const updateStepInstruction = useCallback((index: number, instruction: string) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], instruction }
      return next
    })
    setDirty(true)
  }, [])

  const updateStepNotes = useCallback((index: number, notes: string) => {
    setSteps((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], notes }
      return next
    })
    setDirty(true)
  }, [])

  // ── Delete last step (undo) ──

  const deleteLastStep = useCallback(() => {
    if (steps.length === 0) return
    const snapshot = snapshotStackRef.current.pop()
    if (snapshot) {
      constructionRef.current = snapshot.construction
      candidatesRef.current = snapshot.candidates
      proofFactsRef.current = snapshot.proofFacts
      setProofFacts(snapshot.proofFacts)
      ghostLayersRef.current = snapshot.ghostLayers
      factStoreRef.current = rebuildFactStore(snapshot.proofFacts)
      setSteps(snapshot.steps)
    } else {
      setSteps((prev) => prev.slice(0, -1))
    }
    setActiveCitation(null)
    setDirty(true)
  }, [steps, constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Rewind to step ──

  const rewindToStep = useCallback(
    (targetStep: number) => {
      if (targetStep >= steps.length) return
      // We need to replay from the beginning
      const targetSnapshot = snapshotStackRef.current[targetStep]
      if (!targetSnapshot) return

      constructionRef.current = targetSnapshot.construction
      candidatesRef.current = targetSnapshot.candidates
      proofFactsRef.current = targetSnapshot.proofFacts
      setProofFacts(targetSnapshot.proofFacts)
      ghostLayersRef.current = targetSnapshot.ghostLayers
      factStoreRef.current = rebuildFactStore(targetSnapshot.proofFacts)
      snapshotStackRef.current = snapshotStackRef.current.slice(0, targetStep + 1)
      setSteps(targetSnapshot.steps)
      setActiveCitation(null)
      setDirty(true)
    },
    [steps, constructionRef, candidatesRef, factStoreRef, ghostLayersRef]
  )

  // ── Update proof facts ──

  const updateProofFacts = useCallback((newFacts: ProofFact[]) => {
    proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
    setProofFacts(proofFactsRef.current)
  }, [])

  // ── Generate default instruction from action ──

  const generateInstruction = useCallback(
    (citation: string, action: SerializedAction): string => {
      const state = constructionRef.current
      const label = (id: string) => getPoint(state, id)?.label ?? id.replace('pt-', '')

      switch (action.type) {
        case 'compass':
          return `Draw circle centered at ${label(action.centerId)} through ${label(action.radiusPointId)}.`
        case 'straightedge':
          return `Draw segment from ${label(action.fromId)} to ${label(action.toId)}.`
        case 'intersection':
          return `Mark intersection point ${action.label}.`
        case 'macro':
          return `Apply I.${action.propId}.`
        case 'fact-only':
          return `By ${citation}.`
        case 'extend':
          return `Extend ${label(action.baseId)}${label(action.throughId)} beyond ${label(action.throughId)} to ${action.label}.`
      }
    },
    [constructionRef]
  )

  // ── Serialize to ProofJSON ──

  const serialize = useCallback((): ProofJSON => {
    return {
      id: propositionId,
      title: ref?.title ?? `Proposition I.${propositionId}`,
      kind: ref?.type === 'C' ? 'construction' : 'theorem',
      givenElements,
      steps,
      givenFacts: givenFacts.length > 0 ? givenFacts : undefined,
      authorNotes: authorNotes || undefined,
    }
  }, [propositionId, ref, givenElements, steps, givenFacts, authorNotes])

  // ── Save to API ──

  const save = useCallback(async () => {
    setSaving(true)
    try {
      const body = serialize()
      const res = await fetch(`/api/admin/euclid/${propositionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setDirty(false)
      }
    } catch (err) {
      console.error('Failed to save proof:', err)
    } finally {
      setSaving(false)
    }
  }, [serialize, propositionId])

  // ── Load from API ──

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/euclid/${propositionId}`)
      if (res.status === 404) {
        setLoaded(true)
        return null
      }
      if (!res.ok) {
        setLoaded(true)
        return null
      }
      const data: ProofJSON = await res.json()
      setGivenElements(data.givenElements)
      setGivenFacts(data.givenFacts ?? [])
      setSteps(data.steps)
      setAuthorNotes(data.authorNotes ?? '')

      // Update nextLabelRef
      let maxLabel = 0
      for (const el of data.givenElements) {
        if (el.kind === 'point' && el.label) {
          const idx = el.label.charCodeAt(0) - 65
          if (idx >= 0) maxLabel = Math.max(maxLabel, idx + 1)
        }
      }
      nextLabelRef.current = maxLabel

      if (data.steps.length > 0) {
        setMode('authoring')
      }

      setLoaded(true)
      setDirty(false)
      return data
    } catch (err) {
      console.error('Failed to load proof:', err)
      setLoaded(true)
      return null
    }
  }, [propositionId])

  // ── Auto-save (debounced) ──

  useEffect(() => {
    if (!dirty || !loaded) return
    const timer = setTimeout(() => {
      save()
    }, 1000)
    return () => clearTimeout(timer)
  }, [dirty, loaded, save])

  return {
    mode,
    steps,
    givenElements,
    givenFacts,
    authorNotes,
    activeCitation,
    proofFacts,
    proofFactsRef,
    dirty,
    saving,
    loaded,
    ref,

    setMode,
    setActiveCitation,
    setAuthorNotes,
    setDirty,

    // Given element management
    addGivenPoint,
    addGivenPointFromConstruction,
    addGivenSegment,
    updateGivenPointPosition,
    renameGivenPoint,
    deleteGivenElement,

    // Given fact (equality) management
    addGivenFact,
    deleteGivenFact,

    // Construction
    initializeConstruction,
    startProof,
    editGiven,
    resetAll,
    captureFullState,
    restoreFullState,

    // Steps
    addStep,
    updateStepInstruction,
    updateStepNotes,
    deleteLastStep,
    rewindToStep,

    // Facts
    updateProofFacts,

    // Serialization
    generateInstruction,
    serialize,
    save,
    load,
  }
}
