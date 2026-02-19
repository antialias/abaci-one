import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
  GhostLayer,
  SerializedStep,
  SerializedAction,
  SerializedElement,
  ProofJSON,
  ActiveTool,
} from '../types'
import { BYRNE } from '../types'
import { createInitialState, addPoint, addSegment, getPoint } from '../engine/constructionState'
import type { FactStore } from '../engine/factStore'
import { createFactStore, rebuildFactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { PROPOSITION_REFS } from './propositionReference'

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
  const captureSnapshot = useCallback((): EditorSnapshot => ({
    construction: constructionRef.current,
    candidates: [...candidatesRef.current],
    proofFacts: [...proofFactsRef.current],
    ghostLayers: [...ghostLayersRef.current],
    steps: [...steps],
  }), [constructionRef, candidatesRef, ghostLayersRef, steps])

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
    setGivenElements(prev => [...prev, el])
    setDirty(true)
    return el.id
  }, [])

  const addGivenSegment = useCallback((fromId: string, toId: string) => {
    const segCount = givenElements.filter(e => e.kind === 'segment').length
    const el: SerializedElement = {
      kind: 'segment',
      id: `seg-${segCount + 1}`,
      fromId,
      toId,
      color: BYRNE.given,
      origin: 'given',
    }
    setGivenElements(prev => [...prev, el])
    setDirty(true)
  }, [givenElements])

  const updateGivenPointPosition = useCallback((pointId: string, x: number, y: number) => {
    setGivenElements(prev =>
      prev.map(el => el.id === pointId ? { ...el, x, y } : el),
    )
    setDirty(true)
  }, [])

  const renameGivenPoint = useCallback((pointId: string, newLabel: string) => {
    const newId = `pt-${newLabel}`
    setGivenElements(prev => prev.map(el => {
      if (el.id === pointId) return { ...el, id: newId, label: newLabel }
      if (el.fromId === pointId) return { ...el, fromId: newId }
      if (el.toId === pointId) return { ...el, toId: newId }
      if (el.centerId === pointId) return { ...el, centerId: newId }
      if (el.radiusPointId === pointId) return { ...el, radiusPointId: newId }
      return el
    }))
    setDirty(true)
  }, [])

  // ── Initialize construction from given elements ──

  const initializeConstruction = useCallback(() => {
    const elements: ConstructionElement[] = givenElements.map(el => {
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
    proofFactsRef.current = []
    setProofFacts([])

    // Reset snapshot stack with initial state
    snapshotStackRef.current = [{
      construction: constructionRef.current,
      candidates: [],
      proofFacts: [],
      ghostLayers: [],
      steps: [],
    }]
  }, [givenElements, constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Start proof mode ──

  const startProof = useCallback(() => {
    initializeConstruction()
    setSteps([])
    setMode('authoring')
  }, [initializeConstruction])

  // ── Return to given setup ──

  const editGiven = useCallback(() => {
    setMode('given-setup')
    setSteps([])
    setActiveCitation(null)
    constructionRef.current = createInitialState()
    candidatesRef.current = []
    factStoreRef.current = createFactStore()
    ghostLayersRef.current = []
    proofFactsRef.current = []
    setProofFacts([])
    snapshotStackRef.current = []
  }, [constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Add step ──

  const addStep = useCallback((step: SerializedStep) => {
    // Capture snapshot before this step
    snapshotStackRef.current.push({
      construction: constructionRef.current,
      candidates: [...candidatesRef.current],
      proofFacts: [...proofFactsRef.current],
      ghostLayers: [...ghostLayersRef.current],
      steps: [...steps],
    })

    setSteps(prev => [...prev, step])
    setActiveCitation(null)
    setDirty(true)
  }, [constructionRef, candidatesRef, ghostLayersRef, steps])

  // ── Update step instruction / notes ──

  const updateStepInstruction = useCallback((index: number, instruction: string) => {
    setSteps(prev => {
      const next = [...prev]
      next[index] = { ...next[index], instruction }
      return next
    })
    setDirty(true)
  }, [])

  const updateStepNotes = useCallback((index: number, notes: string) => {
    setSteps(prev => {
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
      setSteps(prev => prev.slice(0, -1))
    }
    setActiveCitation(null)
    setDirty(true)
  }, [steps, constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Rewind to step ──

  const rewindToStep = useCallback((targetStep: number) => {
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
  }, [steps, constructionRef, candidatesRef, factStoreRef, ghostLayersRef])

  // ── Update proof facts ──

  const updateProofFacts = useCallback((newFacts: ProofFact[]) => {
    proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
    setProofFacts(proofFactsRef.current)
  }, [])

  // ── Generate default instruction from action ──

  const generateInstruction = useCallback((citation: string, action: SerializedAction): string => {
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
    }
  }, [constructionRef])

  // ── Serialize to ProofJSON ──

  const serialize = useCallback((): ProofJSON => {
    return {
      id: propositionId,
      title: ref?.title ?? `Proposition I.${propositionId}`,
      kind: ref?.type === 'C' ? 'construction' : 'theorem',
      givenElements,
      steps,
      authorNotes: authorNotes || undefined,
    }
  }, [propositionId, ref, givenElements, steps, authorNotes])

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
    addGivenSegment,
    updateGivenPointPosition,
    renameGivenPoint,

    // Construction
    initializeConstruction,
    startProof,
    editGiven,

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
