import { useState, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  ConstructionPoint,
  IntersectionCandidate,
  GhostLayer,
  PropositionDef,
  SerializedElement,
  SerializedEqualityFact,
} from '../types'
import type { ProofFact } from '../engine/facts'
import type { FactStore } from '../engine/factStore'
import type { PostCompletionAction, ReplayResult } from '../engine/replayConstruction'
import type { MacroAnimation } from '../engine/macroExecution'
import type { MacroCeremonyState } from '../types'
import type { ToolPhaseManager } from '../interaction/useToolPhaseManager'
import type { ActiveTool } from '../types'
import type { AttitudeId } from '../agent/attitudes/types'
import {
  initializeGiven,
  getAllPoints,
} from '../engine/constructionState'
import { replayConstruction } from '../engine/replayConstruction'
import { playgroundToProofJSON } from '../editor/playgroundToProofJSON'
import { exportPropositionDef, generateClaudePrompt } from '../editor/exportPropositionDef'
import type { ConstructionEventBus } from '../agent/ConstructionEventBus'

export interface PlaygroundOperationsReturn {
  // Creation state
  creationId: string | null
  setCreationId: (id: string | null) => void
  creationIsPublic: boolean
  creationTitle: string
  setCreationTitle: (title: string) => void
  saveState: 'idle' | 'saving' | 'saved'
  shareState: 'idle' | 'sharing' | 'copied'
  showCreationsPanel: boolean
  setShowCreationsPanel: (v: boolean) => void
  exportCopied: 'ts' | 'claude' | null

  // Handlers
  handleNewCanvas: () => void
  handleActivateGivenSetup: (
    existingElements?: SerializedElement[],
    existingFacts?: SerializedEqualityFact[]
  ) => void
  handleCancelGivenSetup: () => void
  handleStartGivenConstruction: () => void
  handleRevertToAction: (actionIndex: number) => { success: boolean; error?: string }
  handleRelocatePoint: (
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
  captureThumbnail: () => string | undefined
  collectCreationData: () => {
    givenPoints: Array<{ id: string; x: number; y: number }>
    actions: PostCompletionAction[]
    givenElements?: SerializedElement[]
    givenFacts?: SerializedEqualityFact[]
  }
  handleSave: () => Promise<void>
  handleShare: () => Promise<void>
  handleLoadCreation: (id: string) => Promise<void>
  handleExportTypeScript: () => Promise<void>
  handleExportClaudePrompt: () => Promise<void>
}

export interface UsePlaygroundOperationsOptions {
  proposition: PropositionDef
  propositionIdInput: number
  playerId?: string | null

  // Refs
  constructionRef: MutableRefObject<ConstructionState>
  candidatesRef: MutableRefObject<IntersectionCandidate[]>
  proofFactsRef: MutableRefObject<ProofFact[]>
  factStoreRef: MutableRefObject<FactStore>
  ghostLayersRef: MutableRefObject<GhostLayer[]>
  isCompleteRef: MutableRefObject<boolean>
  postCompletionActionsRef: MutableRefObject<PostCompletionAction[]>
  stepDataRef: MutableRefObject<Map<number, Record<string, unknown>>>
  resolvedStepOverridesRef: MutableRefObject<Map<number, unknown>>
  resolvedTutorialRef: MutableRefObject<Map<number, unknown>>
  macroAnimationRef: MutableRefObject<MacroAnimation | null>
  macroRevealRef: MutableRefObject<MacroCeremonyState | null>
  needsDrawRef: MutableRefObject<boolean>
  activeToolRef: MutableRefObject<ActiveTool>
  propositionRef: MutableRefObject<PropositionDef>
  dynamicPropositionRef: MutableRefObject<PropositionDef | null>
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
  eventBusRef: MutableRefObject<ConstructionEventBus>
  authorProofFactsRef: MutableRefObject<ProofFact[]>
  relocatePointAnimRef: MutableRefObject<{
    actionIndex: number
    fromX: number
    fromY: number
    toX: number
    toY: number
    startTime: number
    durationMs: number
    untrackedElements: ConstructionElement[]
  } | null>

  // Tool phases
  toolPhases: ToolPhaseManager

  // Given setup
  givenSetup: {
    isActive: boolean
    givenElements: SerializedElement[]
    activate: (
      existingElements?: SerializedElement[],
      existingFacts?: SerializedEqualityFact[]
    ) => void
    reset: () => void
    startConstruction: () => {
      givenElements: ConstructionElement[]
      givenFacts?: SerializedEqualityFact[]
      draggablePointIds: string[]
      proofFacts: ProofFact[]
    }
  }

  // State setters from composition root
  setActiveTool: (tool: ActiveTool) => void
  setIsComplete: (v: boolean) => void
  setProofFacts: (v: ProofFact[]) => void

  // Callbacks
  onAttitudeChange?: (attitudeId: AttitudeId) => void
}

export function usePlaygroundOperations(
  opts: UsePlaygroundOperationsOptions
): PlaygroundOperationsReturn {
  const {
    proposition,
    propositionIdInput,
    playerId,
    constructionRef,
    candidatesRef,
    proofFactsRef,
    factStoreRef,
    ghostLayersRef,
    isCompleteRef,
    postCompletionActionsRef,
    stepDataRef,
    resolvedStepOverridesRef,
    resolvedTutorialRef,
    macroAnimationRef,
    macroRevealRef,
    needsDrawRef,
    activeToolRef,
    propositionRef,
    dynamicPropositionRef,
    canvasRef,
    eventBusRef,
    authorProofFactsRef,
    relocatePointAnimRef,
    toolPhases,
    givenSetup,
    setActiveTool,
    setIsComplete,
    setProofFacts,
    onAttitudeChange,
  } = opts

  // ── Owned state ──
  const [creationId, setCreationId] = useState<string | null>(null)
  const [creationIsPublic, setCreationIsPublic] = useState(false)
  const [creationTitle, setCreationTitle] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle')
  const [showCreationsPanel, setShowCreationsPanel] = useState(false)
  const [exportCopied, setExportCopied] = useState<'ts' | 'claude' | null>(null)

  // ── Handlers ──

  const handleNewCanvas = useCallback(() => {
    constructionRef.current = initializeGiven(proposition.givenElements)
    candidatesRef.current = []
    postCompletionActionsRef.current = []
    stepDataRef.current = new Map()
    resolvedStepOverridesRef.current = new Map()
    resolvedTutorialRef.current = new Map()
    eventBusRef.current.emit({ action: 'reset', shouldPrompt: false, reset: true })
    ghostLayersRef.current = []
    proofFactsRef.current = []
    authorProofFactsRef.current = []
    toolPhases.resetAll()
    setCreationId(null)
    setCreationIsPublic(false)
    setCreationTitle('')
    setSaveState('idle')
    setShareState('idle')
    onAttitudeChange?.('teacher')
  }, [
    proposition.givenElements,
    constructionRef,
    candidatesRef,
    postCompletionActionsRef,
    stepDataRef,
    resolvedStepOverridesRef,
    resolvedTutorialRef,
    eventBusRef,
    ghostLayersRef,
    proofFactsRef,
    authorProofFactsRef,
    toolPhases,
    onAttitudeChange,
  ])

  const handleActivateGivenSetup = useCallback(
    (
      existingElements?: SerializedElement[],
      existingFacts?: SerializedEqualityFact[]
    ) => {
      givenSetup.activate(existingElements, existingFacts)
      dynamicPropositionRef.current = null
      toolPhases.resetAll()
      setActiveTool('point')
      activeToolRef.current = 'point'
      setCreationId(null)
      setCreationIsPublic(false)
      setCreationTitle('')
      setSaveState('idle')
      setShareState('idle')
      ghostLayersRef.current = []
      proofFactsRef.current = []
      authorProofFactsRef.current = []
      setProofFacts([])
      onAttitudeChange?.('author')
    },
    [
      givenSetup,
      dynamicPropositionRef,
      toolPhases,
      activeToolRef,
      ghostLayersRef,
      proofFactsRef,
      authorProofFactsRef,
      setActiveTool,
      setProofFacts,
      onAttitudeChange,
    ]
  )

  const handleCancelGivenSetup = useCallback(() => {
    givenSetup.reset()
    dynamicPropositionRef.current = null
    constructionRef.current = initializeGiven(proposition.givenElements)
    candidatesRef.current = []
    postCompletionActionsRef.current = []
    stepDataRef.current = new Map()
    resolvedStepOverridesRef.current = new Map()
    resolvedTutorialRef.current = new Map()
    toolPhases.resetAll()
    setActiveTool('move')
    activeToolRef.current = 'move'
    needsDrawRef.current = true
  }, [
    givenSetup,
    proposition.givenElements,
    constructionRef,
    candidatesRef,
    postCompletionActionsRef,
    stepDataRef,
    resolvedStepOverridesRef,
    resolvedTutorialRef,
    dynamicPropositionRef,
    toolPhases,
    activeToolRef,
    needsDrawRef,
    setActiveTool,
  ])

  const handleStartGivenConstruction = useCallback(() => {
    const result = givenSetup.startConstruction()

    // Create a dynamic proposition so exports use the custom givens
    dynamicPropositionRef.current = {
      id: propositionIdInput,
      title: creationTitle || 'Custom Construction',
      givenElements: result.givenElements,
      givenFacts: result.givenFacts,
      draggablePointIds: result.draggablePointIds,
      steps: [],
    }

    // Pre-load proof facts from given facts
    proofFactsRef.current = result.proofFacts
    setProofFacts(result.proofFacts)

    // Set isComplete so free construction tools work
    isCompleteRef.current = true
    setIsComplete(true)

    // Switch to move tool
    setActiveTool('move')
    activeToolRef.current = 'move'
    toolPhases.resetAll()
    needsDrawRef.current = true
  }, [
    givenSetup,
    propositionIdInput,
    creationTitle,
    dynamicPropositionRef,
    proofFactsRef,
    isCompleteRef,
    activeToolRef,
    needsDrawRef,
    toolPhases,
    setActiveTool,
    setIsComplete,
    setProofFacts,
  ])

  const handleRevertToAction = useCallback(
    (actionIndex: number) => {
      const prop = propositionRef.current
      // Truncate actions: keep [0..actionIndex] (the clicked step stays)
      postCompletionActionsRef.current = postCompletionActionsRef.current.slice(
        0,
        actionIndex + 1
      )

      // Replay the entire construction with the truncated action list
      const result = replayConstruction(
        prop.givenElements,
        prop.steps,
        prop,
        postCompletionActionsRef.current,
        stepDataRef.current
      )

      // Restore all state refs atomically
      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      ghostLayersRef.current = result.ghostLayers
      proofFactsRef.current = result.proofFacts
      setProofFacts(result.proofFacts)
      factStoreRef.current = result.factStore

      // Reset tool phases to idle
      toolPhases.resetAll()
      macroAnimationRef.current = null
      macroRevealRef.current = null

      // Notify ledger to re-derive entries
      eventBusRef.current.emit({ action: 'revert', shouldPrompt: false, reset: true })

      return { success: true }
    },
    [
      propositionRef,
      constructionRef,
      candidatesRef,
      ghostLayersRef,
      proofFactsRef,
      factStoreRef,
      postCompletionActionsRef,
      stepDataRef,
      macroAnimationRef,
      macroRevealRef,
      eventBusRef,
      toolPhases,
      setProofFacts,
    ]
  )

  const handleRelocatePoint = useCallback(
    (label: string, x: number, y: number, force?: boolean) => {
      const prop = propositionRef.current
      const actions = postCompletionActionsRef.current

      console.log('[relocate_point] label=%s, target=(%s,%s)', label, x, y)
      console.log(
        '[relocate_point] postCompletionActions:',
        JSON.stringify(actions, null, 2)
      )
      console.log(
        '[relocate_point] current elements:',
        constructionRef.current.elements.map((e) => ({
          id: e.id,
          kind: e.kind,
          ...('label' in e ? { label: e.label } : {}),
          ...('origin' in e ? { origin: e.origin } : {}),
        }))
      )
      console.log(
        '[relocate_point] prop.givenElements:',
        prop.givenElements.map((e) => ({
          id: e.id,
          kind: e.kind,
          ...('label' in e ? { label: e.label } : {}),
        }))
      )
      console.log('[relocate_point] prop.steps count:', prop.steps.length)

      // Find the free-point action by label
      const actionIndex = actions.findIndex(
        (a) => a.type === 'free-point' && a.label === label
      )
      if (actionIndex === -1) {
        console.log(
          '[relocate_point] free-point action NOT found for label=%s',
          label
        )
        // Distinguish "not found at all" vs "exists but not free"
        const pt = constructionRef.current.elements.find(
          (e): e is ConstructionPoint =>
            e.kind === 'point' && e.label === label
        )
        if (pt) {
          console.log(
            '[relocate_point] point exists but origin=%s',
            pt.origin
          )
          return {
            success: false,
            error: `Point ${label} exists but is not a free point (origin: ${pt.origin}). Only free points can be relocated.`,
          }
        }
        return {
          success: false,
          error: `Point "${label}" not found in the construction.`,
        }
      }

      console.log(
        '[relocate_point] found free-point action at index %d',
        actionIndex
      )

      // Create modified action list with updated coordinates
      const modifiedActions = actions.map((a, i) =>
        i === actionIndex && a.type === 'free-point' ? { ...a, x, y } : a
      )

      // Control replay — same actions, unmodified (baseline for comparison)
      const controlResult = replayConstruction(
        prop.givenElements,
        prop.steps,
        prop,
        actions,
        stepDataRef.current
      )

      // Trial replay — modified coordinates, no state mutation yet
      const trialResult = replayConstruction(
        prop.givenElements,
        prop.steps,
        prop,
        modifiedActions,
        stepDataRef.current
      )

      console.log(
        '[relocate_point] control result elements:',
        controlResult.state.elements.map((e) => ({
          id: e.id,
          kind: e.kind,
          ...('label' in e ? { label: e.label } : {}),
        }))
      )
      console.log(
        '[relocate_point] trial result elements:',
        trialResult.state.elements.map((e) => ({
          id: e.id,
          kind: e.kind,
          ...('label' in e ? { label: e.label } : {}),
        }))
      )
      console.log(
        '[relocate_point] control stepsCompleted:',
        controlResult.stepsCompleted
      )
      console.log(
        '[relocate_point] trial stepsCompleted:',
        trialResult.stepsCompleted
      )

      // Compare trial vs control — elements present in control but missing in trial are broken
      const controlIds = new Set(controlResult.state.elements.map((e) => e.id))
      const trialIds = new Set(trialResult.state.elements.map((e) => e.id))
      const missingIds = [...controlIds].filter((id) => !trialIds.has(id))

      console.log('[relocate_point] controlIds:', [...controlIds])
      console.log('[relocate_point] trialIds:', [...trialIds])
      console.log('[relocate_point] missingIds:', missingIds)

      // Check if trial completes fewer proposition steps than the control
      const brokenStepCount =
        trialResult.stepsCompleted < controlResult.stepsCompleted
          ? controlResult.stepsCompleted - trialResult.stepsCompleted
          : 0

      console.log(
        '[relocate_point] controlSteps=%d, trialSteps=%d, brokenStepCount=%d',
        controlResult.stepsCompleted,
        trialResult.stepsCompleted,
        brokenStepCount
      )

      if (missingIds.length > 0 || brokenStepCount > 0) {
        // Build broken elements info from the control replay (canonical source)
        const brokenElements = missingIds.map((id) => {
          const el = controlResult.state.elements.find((e) => e.id === id)
          return {
            id,
            label:
              el && 'label' in el ? (el.label as string) : undefined,
            kind: el?.kind ?? 'unknown',
          }
        })

        if (!force) {
          console.log(
            '[relocate_point] BROKEN — returning error. brokenElements:',
            brokenElements
          )
          return {
            success: false,
            error: `Moving ${label} to (${x}, ${y}) would break ${missingIds.length} element(s)${brokenStepCount > 0 ? ` and ${brokenStepCount} proposition step(s)` : ''}. No changes were made. Call again with force=true to proceed anyway.`,
            brokenElements,
            brokenStepCount,
          }
        }

        console.log(
          '[relocate_point] FORCE — committing despite breakage. Removed:',
          brokenElements
        )
      }

      console.log('[relocate_point] trial passed — committing with animation')

      // Capture "from" coordinates — use interpolated position if animation is already running
      const oldAction = actions[actionIndex]
      let fromX: number, fromY: number
      const ongoingAnim = relocatePointAnimRef.current
      if (ongoingAnim && ongoingAnim.actionIndex === actionIndex) {
        // Mid-animation: lerp from current visual position for smooth chaining
        const rawT = Math.min(
          1,
          (performance.now() - ongoingAnim.startTime) / ongoingAnim.durationMs
        )
        const easedT = 1 - (1 - rawT) * (1 - rawT)
        fromX =
          ongoingAnim.fromX +
          (ongoingAnim.toX - ongoingAnim.fromX) * easedT
        fromY =
          ongoingAnim.fromY +
          (ongoingAnim.toY - ongoingAnim.fromY) * easedT
      } else {
        fromX = oldAction.type === 'free-point' ? oldAction.x : x
        fromY = oldAction.type === 'free-point' ? oldAction.y : y
      }

      // Commit final actions (target state) — animation loop will interpolate toward this
      postCompletionActionsRef.current = modifiedActions

      // Capture untracked elements before animation overwrites constructionRef
      const trialIdSet = new Set(
        trialResult.state.elements.map((e) => e.id)
      )
      const untrackedElements =
        constructionRef.current.elements.filter(
          (e) => !trialIdSet.has(e.id)
        )

      // Start animation — RAF loop will replay construction each frame with interpolated coords
      relocatePointAnimRef.current = {
        actionIndex,
        fromX,
        fromY,
        toX: x,
        toY: y,
        startTime: performance.now(),
        durationMs: 400,
        untrackedElements,
      }

      // Reset tool phases to idle
      toolPhases.resetAll()
      macroAnimationRef.current = null
      macroRevealRef.current = null
      needsDrawRef.current = true

      return { success: true }
    },
    [
      propositionRef,
      constructionRef,
      postCompletionActionsRef,
      stepDataRef,
      relocatePointAnimRef,
      macroAnimationRef,
      macroRevealRef,
      needsDrawRef,
      toolPhases,
    ]
  )

  const captureThumbnail = useCallback((): string | undefined => {
    const srcCanvas = canvasRef.current
    if (!srcCanvas) return undefined
    const THUMB_W = 400
    const THUMB_H = 300
    const off = document.createElement('canvas')
    off.width = THUMB_W
    off.height = THUMB_H
    const ctx = off.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(srcCanvas, 0, 0, THUMB_W, THUMB_H)
    return off.toDataURL('image/jpeg', 0.75)
  }, [canvasRef])

  const collectCreationData = useCallback(() => {
    const givenPoints = getAllPoints(constructionRef.current)
      .filter((pt) => pt.origin === 'given')
      .map((pt) => ({ id: pt.id, x: pt.x, y: pt.y }))
    const data: {
      givenPoints: Array<{ id: string; x: number; y: number }>
      actions: PostCompletionAction[]
      givenElements?: SerializedElement[]
      givenFacts?: SerializedEqualityFact[]
    } = { givenPoints, actions: postCompletionActionsRef.current }
    // Include custom givens if this was a given-setup construction
    const dynProp = dynamicPropositionRef.current
    if (dynProp) {
      data.givenElements =
        givenSetup.givenElements.length > 0
          ? givenSetup.givenElements
          : dynProp.givenElements.map((el) => ({
              kind: el.kind,
              id: el.id,
              label: el.kind === 'point' ? el.label : undefined,
              x: el.kind === 'point' ? el.x : undefined,
              y: el.kind === 'point' ? el.y : undefined,
              fromId: el.kind === 'segment' ? el.fromId : undefined,
              toId: el.kind === 'segment' ? el.toId : undefined,
              centerId: el.kind === 'circle' ? el.centerId : undefined,
              radiusPointId:
                el.kind === 'circle' ? el.radiusPointId : undefined,
              color: el.color,
              origin: el.origin,
            }))
      if (dynProp.givenFacts && dynProp.givenFacts.length > 0) {
        data.givenFacts = dynProp.givenFacts
      }
    }
    return data
  }, [
    constructionRef,
    postCompletionActionsRef,
    dynamicPropositionRef,
    givenSetup.givenElements,
  ])

  const handleSave = useCallback(async () => {
    if (saveState === 'saving') return
    setSaveState('saving')

    const thumbnail = captureThumbnail()
    const data = collectCreationData()
    const title = creationTitle || null

    try {
      if (creationId) {
        // PATCH existing
        const res = await fetch(`/api/euclid/creations/${creationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, thumbnail, title }),
        })
        if (res.ok) {
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 1500)
        } else {
          setSaveState('idle')
        }
      } else {
        // POST new (private draft)
        const res = await fetch('/api/euclid/creations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data,
            thumbnail,
            isPublic: false,
            playerId: playerId ?? null,
            title,
          }),
        })
        const json = await res.json()
        if (res.ok) {
          setCreationId(json.id)
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 1500)
        } else {
          setSaveState('idle')
        }
      }
    } catch {
      setSaveState('idle')
    }
  }, [
    saveState,
    creationId,
    creationTitle,
    captureThumbnail,
    collectCreationData,
    playerId,
  ])

  const handleShare = useCallback(async () => {
    if (!creationId || shareState === 'sharing') return
    setShareState('sharing')

    try {
      if (!creationIsPublic) {
        // Make public
        const res = await fetch(`/api/euclid/creations/${creationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: true }),
        })
        if (!res.ok) {
          setShareState('idle')
          return
        }
        setCreationIsPublic(true)
      }

      // Copy link
      const url = `${window.location.origin}/toys/euclid/creations/${creationId}`
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      setShareState('idle')
    }
  }, [creationId, creationIsPublic, shareState])

  const handleLoadCreation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/euclid/creations/${id}`)
        if (!res.ok) return
        const json = await res.json()
        const creation = json.creation as {
          id: string
          data: {
            givenPoints: Array<{ id: string; x: number; y: number }>
            actions: PostCompletionAction[]
            givenElements?: SerializedElement[]
            givenFacts?: SerializedEqualityFact[]
          }
          title: string | null
          isPublic: boolean
        }

        // Check if this is a custom-givens creation
        if (
          creation.data.givenElements &&
          creation.data.givenElements.length > 0
        ) {
          // Restore as a given-setup construction (already completed)
          const customGivens = creation.data.givenElements
          const customFacts = creation.data.givenFacts ?? []

          // Convert serialized → construction elements
          const constructionElements: ConstructionElement[] =
            customGivens.map((el) => {
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

          const draggablePointIds = customGivens
            .filter((el) => el.kind === 'point')
            .map((el) => el.id!)

          // Store as dynamic proposition
          dynamicPropositionRef.current = {
            id: 0,
            title: creation.title || 'Custom Construction',
            givenElements: constructionElements,
            givenFacts: customFacts,
            draggablePointIds,
            steps: [],
          }

          // Replay with custom givens
          const actions = creation.data.actions ?? []
          postCompletionActionsRef.current = actions
          const dynProp = dynamicPropositionRef.current
          const result = replayConstruction(
            constructionElements,
            dynProp.steps,
            dynProp,
            actions
          )

          constructionRef.current = result.state
          candidatesRef.current = result.candidates
          ghostLayersRef.current = result.ghostLayers
          proofFactsRef.current = result.proofFacts

          // Make sure given-setup is not active (we loaded a completed construction)
          givenSetup.reset()
          isCompleteRef.current = true
          setIsComplete(true)
        } else {
          // Standard playground creation — reset using proposition givens
          let givenElements = proposition.givenElements
          if (creation.data.givenPoints?.length > 0) {
            givenElements = givenElements.map((el) => {
              if (el.kind === 'point') {
                const saved = creation.data.givenPoints.find(
                  (gp) => gp.id === el.id
                )
                if (saved) return { ...el, x: saved.x, y: saved.y }
              }
              return el
            })
          }
          dynamicPropositionRef.current = null

          // Replay actions
          const actions = creation.data.actions ?? []
          postCompletionActionsRef.current = actions
          const result = replayConstruction(
            givenElements,
            proposition.steps,
            proposition,
            actions
          )

          constructionRef.current = result.state
          candidatesRef.current = result.candidates
          ghostLayersRef.current = result.ghostLayers
          proofFactsRef.current = result.proofFacts
        }

        // Reset tool phases
        toolPhases.resetAll()
        macroAnimationRef.current = null
        macroRevealRef.current = null

        // Update creation tracking state
        setCreationId(creation.id)
        setCreationTitle(creation.title ?? '')
        setCreationIsPublic(creation.isPublic)
        setSaveState('idle')
        setShareState('idle')

        // Notify and redraw
        eventBusRef.current.emit({
          action: 'reset',
          shouldPrompt: false,
          reset: true,
        })
        needsDrawRef.current = true
        setShowCreationsPanel(false)
      } catch (err) {
        console.error('[EuclidCanvas] Failed to load creation:', err)
      }
    },
    [
      proposition,
      constructionRef,
      candidatesRef,
      ghostLayersRef,
      proofFactsRef,
      postCompletionActionsRef,
      isCompleteRef,
      dynamicPropositionRef,
      macroAnimationRef,
      macroRevealRef,
      needsDrawRef,
      eventBusRef,
      toolPhases,
      givenSetup,
      setIsComplete,
    ]
  )

  const handleExportTypeScript = useCallback(async () => {
    const dynProp = dynamicPropositionRef.current
    const givenEls = dynProp
      ? dynProp.givenElements
      : proposition.givenElements
    const proofJSON = playgroundToProofJSON(
      givenEls,
      postCompletionActionsRef.current,
      constructionRef.current,
      {
        id: propositionIdInput,
        title: creationTitle || 'Playground Construction',
        givenFacts: dynProp?.givenFacts,
      }
    )
    const code = exportPropositionDef(proofJSON)
    await navigator.clipboard.writeText(code)
    setExportCopied('ts')
    setTimeout(() => setExportCopied(null), 2000)
  }, [
    proposition.givenElements,
    constructionRef,
    postCompletionActionsRef,
    dynamicPropositionRef,
    creationTitle,
    propositionIdInput,
  ])

  const handleExportClaudePrompt = useCallback(async () => {
    const dynProp = dynamicPropositionRef.current
    const givenEls = dynProp
      ? dynProp.givenElements
      : proposition.givenElements
    const proofJSON = playgroundToProofJSON(
      givenEls,
      postCompletionActionsRef.current,
      constructionRef.current,
      {
        id: propositionIdInput,
        title: creationTitle || 'Playground Construction',
        givenFacts: dynProp?.givenFacts,
      }
    )
    const prompt = generateClaudePrompt(proofJSON)
    await navigator.clipboard.writeText(prompt)
    setExportCopied('claude')
    setTimeout(() => setExportCopied(null), 2000)
  }, [
    proposition.givenElements,
    constructionRef,
    postCompletionActionsRef,
    dynamicPropositionRef,
    creationTitle,
    propositionIdInput,
  ])

  return {
    creationId,
    setCreationId,
    creationIsPublic,
    creationTitle,
    setCreationTitle,
    saveState,
    shareState,
    showCreationsPanel,
    setShowCreationsPanel,
    exportCopied,
    handleNewCanvas,
    handleActivateGivenSetup,
    handleCancelGivenSetup,
    handleStartGivenConstruction,
    handleRevertToAction,
    handleRelocatePoint,
    captureThumbnail,
    collectCreationData,
    handleSave,
    handleShare,
    handleLoadCreation,
    handleExportTypeScript,
    handleExportClaudePrompt,
  }
}
