'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  TutorialHint,
  TutorialSubStep,
  ExpectedAction,
  GhostLayer,
  MacroCeremonyState,
} from './types'
import { needsExtendedSegments } from './types'
import { initializeGiven, getAllPoints } from './engine/constructionState'
import { getFriction } from './render/renderToolOverlay'
import type { StraightedgeDrawAnim } from './render/renderToolOverlay'
import { useEuclidTouch } from './interaction/useEuclidTouch'
import { useToolInteraction } from './interaction/useToolInteraction'
import { useToolPhaseManager } from './interaction/useToolPhaseManager'
import { useDragGivenPoints } from './interaction/useDragGivenPoints'
import type { PostCompletionAction } from './engine/replayConstruction'
import { useAuthorCallbacks } from './useAuthorCallbacks'
import { replayConstruction } from './engine/replayConstruction'
import { PROP_REGISTRY } from './propositions/registry'
import { PLAYGROUND_PROP } from './propositions/playground'
import { PlaygroundCreationsPanel } from './PlaygroundCreationsPanel'
import { ProofLedger } from './ledger/ProofLedger'
import type { LedgerEntryDescriptor } from './ledger/describeAction'
import { describeToolPhase } from './ledger/describeAction'
import { useAudioManager } from '@/hooks/useAudioManager'
import { useTTS } from '@/hooks/useTTS'
import { useEuclidAudioHelp } from './hooks/useEuclidAudioHelp'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useCharacterProfileImage } from '@/lib/character/useCharacterProfileImage'
import { createFactStore, addFact, addAngleFact } from './engine/factStore'
import type { FactStore } from './engine/factStore'
import type { ProofFact } from './engine/facts'
import { distancePair, angleMeasure } from './engine/facts'
import { MACRO_REGISTRY } from './engine/macros'
import type { MacroAnimation } from './engine/macroExecution'
import { getGhostFalloff, getGhostBaseOpacity } from './render/renderGhostGeometry'
import type { SuperpositionFlash } from './render/renderSuperpositionFlash'
import type { CitationFlash, CitationFlashInit } from './render/renderCitationFlash'
import { KeyboardShortcutsOverlay } from '../shared/KeyboardShortcutsOverlay'
import type { ShortcutEntry } from '../shared/KeyboardShortcutsOverlay'
import { useEuclidMusic } from './audio/useEuclidMusic'
import type { UseEuclidMusicReturn } from './audio/useEuclidMusic'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'
import { CitationPopover } from './foundations/CitationPopover'
import { MacroToolPanel } from './MacroToolPanel'
import { useGeometryVoice } from './agent/useGeometryVoice'
import { GeometryTeacherProvider, useGeometryTeacher } from './GeometryTeacherContext'
import { getTeacherConfig } from './characters/registry'
import { useConstructionNotifier } from './agent/useConstructionNotifier'
import { ConstructionEventBus } from './agent/ConstructionEventBus'
import type { AttitudeId } from './agent/attitudes/types'
import { EuclidContextDebugPanel } from './EuclidContextDebugPanel'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { useEuclidChat } from './chat/useEuclidChat'
import { DockedEuclidChat } from './chat/DockedEuclidChat'
import { GuidedProofPanel } from './proof/GuidedProofPanel'
import { latexToMarkers } from './chat/parseGeometricEntities'
import type {
  GeometricEntityRef,
  EuclidEntityRef,
  FoundationEntityRef,
} from './chat/parseGeometricEntities'
import { isGeometricEntity, foundationToCitationKey } from './chat/parseGeometricEntities'
import { useEuclidEntityRenderer } from './chat/useEuclidEntityRenderer'
import { generateId } from '@/lib/character/useCharacterChat'
import { useGivenSetup } from './interaction/useGivenSetup'
import { GivenSetupPanel } from './GivenSetupPanel'
import { computeInitialViewport } from './engine/viewportMath'
import { captureSnapshot, deriveCompletionResult } from './engine/snapshots'
import { HecklerCallOverlay } from './HecklerCallOverlay'
import type { RAFContext } from './engine/rafContext'
import { tickTutorialAdvancement } from './interaction/tickTutorialAdvancement'
import { tickAnimations } from './engine/tickAnimations'
import { useHecklerCall } from './hooks/useHecklerCall'
import { useCompletionFlow } from './hooks/useCompletionFlow'
import { useTutorialController } from './hooks/useTutorialController'
import { useConstructionCommands } from './hooks/useConstructionCommands'
import { usePlaygroundOperations } from './hooks/usePlaygroundOperations'
import { computeAutoFit } from './engine/computeAutoFit'
import { renderFrame } from './render/renderFrame'
import { useCitationPopover } from './hooks/useCitationPopover'
import { useQuadDrag } from './hooks/useQuadDrag'
import { useAutoComplete } from './hooks/useAutoComplete'
import { useDragTopologyTracking } from './hooks/useDragTopologyTracking'
import { useSuperpositionInteraction } from './interaction/useSuperpositionInteraction'
import { useChatModeManager } from './hooks/useChatModeManager'
import { EuclidDebugControls } from './EuclidDebugControls'
import { ToolDock } from './ToolDock'
import { PlaygroundControlsBar } from './PlaygroundControlsBar'
import { AdminExportBar } from './AdminExportBar'
import { EuclidAssemblyQuad } from './EuclidAssemblyQuad'

// ── Keyboard shortcuts ──

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'V', description: 'Toggle pan/zoom (disabled by default)' },
  { key: 'G', description: 'Include ghost geometry in auto-zoom bounds' },
  { key: '?', description: 'Toggle this help' },
]

const MOBILE_PROOF_PANEL_HEIGHT_RATIO = 0.35

interface EuclidCanvasProps {
  propositionId?: number
  /** Resolved proposition definition. If provided, takes precedence over propositionId lookup. */
  proposition?: import('./types').PropositionDef
  /** Called when the proposition is completed (all steps done + proven) */
  onComplete?: (propId: number) => void
  /** Hides proof panel for free-form playground mode */
  playgroundMode?: boolean
  /** Optional narration style (defaults to standard). */
  languageStyle?: KidLanguageStyle
  completionMeta?: {
    unlocked: number[]
    nextPropId: number | null
    onNavigateNext: (propId: number) => void
    onNavigateMap: () => void
  }
  /** Pre-populate playground with a saved creation's actions */
  initialActions?: import('./engine/replayConstruction').PostCompletionAction[]
  /** Override given point positions for loaded creations */
  initialGivenPoints?: Array<{ id: string; x: number; y: number }>
  /** Active player ID — stored with saved creations so they belong to the kid, not the account */
  playerId?: string | null
  /**
   * Start with audio disabled and manage it locally (independent of the global audio manager).
   * Useful when embedding the canvas in a context where auto-play narration would be disruptive
   * (e.g. a blog post). The user can still toggle audio on via the speaker button.
   */
  disableAudio?: boolean
  /** Whether the current user is an admin (enables export buttons in playground mode) */
  isAdmin?: boolean
}

/**
 * Public EuclidCanvas — wraps the inner canvas with the geometry teacher provider.
 * Manages dynamic attitude switching (teacher → heckler) for the heckler trigger.
 */
export function EuclidCanvas(props: EuclidCanvasProps) {
  const [attitudeId, setAttitudeId] = useState<AttitudeId>('teacher')
  const voiceConfig = useMemo(
    () => getTeacherConfig(props.proposition?.characterId, attitudeId),
    [props.proposition?.characterId, attitudeId]
  )
  return (
    <GeometryTeacherProvider config={voiceConfig}>
      <EuclidCanvasInner {...props} onAttitudeChange={setAttitudeId} />
    </GeometryTeacherProvider>
  )
}

function EuclidCanvasInner({
  propositionId = 1,
  proposition: propositionProp,
  onComplete,
  playgroundMode,
  languageStyle,
  completionMeta,
  initialActions,
  initialGivenPoints,
  playerId,
  disableAudio,
  isAdmin: isAdminProp,
  onAttitudeChange,
}: EuclidCanvasProps & { onAttitudeChange?: (attitudeId: AttitudeId) => void }) {
  const isMobile = useIsMobile()
  const isAdmin = isAdminProp === true
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const propositionBase =
    propositionProp ??
    (propositionId === 0 ? PLAYGROUND_PROP : PROP_REGISTRY[propositionId]) ??
    PROP_REGISTRY[1]
  const proposition = useMemo(() => {
    if (!initialGivenPoints || initialGivenPoints.length === 0) return propositionBase
    const overrideMap = new Map(initialGivenPoints.map((p) => [p.id, p]))
    return {
      ...propositionBase,
      givenElements: propositionBase.givenElements.map((el) => {
        if (el.kind === 'point' && overrideMap.has(el.id)) {
          const pos = overrideMap.get(el.id)!
          return { ...el, x: pos.x, y: pos.y }
        }
        return el
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propositionId])
  const stepInstructionOverrides = useMemo(() => {
    if (!languageStyle) return null
    return proposition.stepInstructionsByStyle?.[languageStyle] ?? null
  }, [languageStyle, proposition])
  const steps = useMemo(() => {
    if (!stepInstructionOverrides) return proposition.steps
    return proposition.steps.map((step, idx) => {
      const instruction = stepInstructionOverrides[idx]
      return instruction ? { ...step, instruction } : step
    })
  }, [proposition.steps, stepInstructionOverrides])
  const hasConstructionSteps = useMemo(
    () => steps.some((s) => s.expected.type !== 'observation'),
    [steps]
  )

  const extendSegments = useMemo(() => needsExtendedSegments(proposition), [proposition])
  const getTutorial = proposition.getTutorial ?? (() => [] as TutorialSubStep[][])
  // All prior propositions that have applicable macros
  const availableMacros = useMemo(() => {
    return Object.entries(MACRO_REGISTRY)
      .filter(([key]) => playgroundMode || Number(key) < propositionId)
      .map(([, def]) => ({
        propId: def.propId,
        def,
        title: PROP_REGISTRY[def.propId]?.title ?? '',
      }))
  }, [propositionId, playgroundMode])
  const explorationNarration = useMemo(() => {
    if (!languageStyle) return proposition.explorationNarration
    return (
      proposition.explorationNarrationByStyle?.[languageStyle] ?? proposition.explorationNarration
    )
  }, [languageStyle, proposition])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const toolDockRef = useRef<HTMLDivElement | null>(null)

  // Core refs (performance-critical, not React state)
  const viewportRef = useRef<EuclidViewportState>(computeInitialViewport(proposition.givenElements))
  const constructionRef = useRef<ConstructionState>(initializeGiven(proposition.givenElements))
  const toolPhases = useToolPhaseManager(
    steps[0]?.expected.type === 'observation' ? 'move' : (steps[0]?.tool ?? 'compass')
  )
  const {
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    snappedPointIdRef,
    activeToolRef,
    pointerCapturedRef,
    needsDrawRef,
  } = toolPhases
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const candidatesRef = useRef<IntersectionCandidate[]>([])
  const expectedActionRef = useRef<ExpectedAction | null>(steps[0]?.expected ?? null)
  const rafRef = useRef<number>(0)
  const extendPreviewRef = useRef<{ x: number; y: number } | null>(null)
  const [macroPhase, setMacroPhase] = useState<MacroPhase>({ tag: 'idle' })
  const macroAnimationRef = useRef<MacroAnimation | null>(null)
  const wiggleCancelRef = useRef<(() => void) | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(true)
  // Sync refs for values captured by the RAF loop (deps: [])
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const playgroundModeRef = useRef(playgroundMode)
  playgroundModeRef.current = playgroundMode
  const straightedgeDrawAnimRef = useRef<StraightedgeDrawAnim | null>(null)
  const superpositionFlashRef = useRef<SuperpositionFlash | null>(null)
  const superpositionPhaseRef = useRef<import('./types').SuperpositionPhase>({ tag: 'idle' })
  const onSuperpositionSettledRef = useRef<(() => void) | null>(null)
  const superpositionCascadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const citationFlashesRef = useRef<CitationFlash[]>([])
  const dragPointIdRef = useRef<string | null>(null)
  const dragLabelRef = useRef<string | null>(null)
  const isCompleteRef = useRef(false)
  const completionTimeRef = useRef<number>(0)
  const postCompletionActionsRef = useRef<PostCompletionAction[]>(initialActions ?? [])
  const eventBusRef = useRef(new ConstructionEventBus())
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const hoveredMacroStepRef = useRef<number | null>(null)
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const ghostBoundsEnabledRef = useRef(false)
  const macroPreviewAutoFitRef = useRef(true)
  const macroRevealRef = useRef<MacroCeremonyState | null>(null)
  const relocatePointAnimRef = useRef<{
    actionIndex: number
    fromX: number
    fromY: number
    toX: number
    toY: number
    startTime: number
    durationMs: number
    untrackedElements: ConstructionElement[]
  } | null>(null)
  const ceremonyDebugRef = useRef<{
    speedMultiplier: number
    paused: boolean
  }>({ speedMultiplier: 1, paused: false })
  const propositionRef = useRef(proposition)
  // Updated after dynamicPropositionRef is defined (line ~1063)
  const musicRef = useRef<UseEuclidMusicReturn | null>(null)
  const correctionRef = useRef<{
    active: boolean
    startTime: number
    duration: number
    center: { x: number; y: number }
    fromAngle: number
    toAngle: number
  } | null>(null)
  const correctionActiveRef = useRef(false)
  // Forward ref for notifier — populated after useConstructionNotifier returns.
  // Used by updateToolPreview (defined earlier than the notifier hook).
  const notifierForwardRef = useRef<{ notifyToolState: () => void }>({
    notifyToolState: () => {},
  })

  // ── Given-setup mode (admin only, playground) ──
  const givenSetup = useGivenSetup({
    constructionRef,
    candidatesRef,
    postCompletionActionsRef,
    factStoreRef,
    needsDrawRef,
  })
  const givenSetupActiveRef = useRef(false)
  givenSetupActiveRef.current = givenSetup.isActive
  // Ref to hold a dynamic proposition created from custom givens
  const dynamicPropositionRef = useRef<import('./types').PropositionDef | null>(null)
  // Use dynamic proposition (from given setup) when available, else static
  propositionRef.current = dynamicPropositionRef.current ?? proposition
  const [propositionIdInput, setPropositionIdInput] = useState(0)

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>(
    playgroundMode
      ? 'move'
      : steps[0]?.expected.type === 'observation'
        ? 'move'
        : (steps[0]?.tool ?? 'compass')
  )
  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0)
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(steps.map(() => false))
  const [isComplete, setIsComplete] = useState(playgroundMode ? true : false)
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ceremonyLabel, setCeremonyLabel] = useState<string | null>(null)
  const [proofFacts, setProofFacts] = useState<ProofFact[]>([])
  const proofFactsRef = useRef<ProofFact[]>([])
  /** Author-declared proof facts (from voice/chat tools). Survives replay. */
  const authorProofFactsRef = useRef<ProofFact[]>([])
  const snapshotStackRef = useRef<import('./engine/snapshots').ProofSnapshot[]>([
    captureSnapshot(constructionRef.current, candidatesRef.current, [], []),
  ])
  /** Per-step data recorded during construction (e.g. user-chosen extend distances) */
  const stepDataRef = useRef<Map<number, Record<string, unknown>>>(new Map())
  /** Resolved step overrides from PropositionDef.resolveStep for adaptive constructions */
  const resolvedStepOverridesRef = useRef<Map<number, Partial<import('./types').PropositionStep>>>(
    new Map()
  )
  /** Resolved tutorial sub-step overrides from PropositionDef.resolveTutorialStep */
  const resolvedTutorialRef = useRef<Map<number, import('./types').TutorialSubStep[]>>(new Map())

  // Steps with resolved instruction overrides applied (for proof panel display only).
  // Calls resolveStep synchronously so the instruction is correct on the same render
  // that currentStep changes (the useEffect that populates resolvedStepOverridesRef
  // runs post-render, which is too late for useMemo).
  const displaySteps = useMemo(() => {
    return steps.map((step, idx) => {
      // Try live resolveStep first (synchronous, uses current construction state)
      if (proposition.resolveStep && idx >= 2 && idx <= currentStep) {
        const resolved = proposition.resolveStep(idx, constructionRef.current, stepDataRef.current)
        if (resolved?.instruction) {
          return { ...step, instruction: resolved.instruction }
        }
      }
      // Fall back to previously cached overrides
      const override = resolvedStepOverridesRef.current.get(idx)
      if (override?.instruction) {
        return { ...step, instruction: override.instruction }
      }
      return step
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, currentStep, proposition])

  const [showShortcuts, setShowShortcuts] = useState(false)
  const [panZoomEnabled, setPanZoomEnabled] = useState(false)
  const [toolPreview, setToolPreview] = useState<LedgerEntryDescriptor | null>(null)
  const [isToolDockActive, setIsToolDockActive] = useState(false)
  const [isCorrectionActive, setIsCorrectionActive] = useState(false)
  const [frictionCoeff, setFrictionCoeff] = useState(getFriction)
  const [ghostBaseOpacityVal, setGhostBaseOpacityVal] = useState(getGhostBaseOpacity)
  const [ghostFalloffCoeff, setGhostFalloffCoeff] = useState(getGhostFalloff)
  const [ceremonySpeed, setCeremonySpeed] = useState(1)
  const [ceremonyPaused, setCeremonyPaused] = useState(false)
  const [ceremonyFocusMode, setCeremonyFocusMode] = useState(false)
  const [showContextDebug, setShowContextDebug] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('euclid-show-context-debug')
    return stored === null ? true : stored === '1'
  })
  // Tick counter to force re-render when ceremony state changes from step buttons
  const [ceremonyTick, setCeremonyTick] = useState(0)
  // Sync ceremony debug state → ref for RAF loop
  ceremonyDebugRef.current.speedMultiplier = ceremonySpeed
  ceremonyDebugRef.current.paused = ceremonyPaused
  const {
    activeCitation,
    setActiveCitation,
    popoverHoveredRef,
    citationShowTimerRef,
    citationHideTimerRef,
    handleCitationPointerEnter,
    handleCitationPointerLeave,
    handleCitationPointerDown,
  } = useCitationPopover({ isMobile })
  const lastSweepRef = useRef<number>(0)
  const lastSweepTimeRef = useRef<number>(0)
  const lastSweepCenterRef = useRef<string | null>(null)

  // ── Macro tool handlers ──

  /** propId required by the current guided step, or null if not a macro step */
  const guidedPropId = useMemo(() => {
    if (currentStep >= steps.length) return null
    const expected = steps[currentStep].expected
    return expected.type === 'macro' ? expected.propId : null
  }, [currentStep, steps])

  /** Recompute the ledger tool preview from current ref state (playground mode only).
   *  Also notifies voice of tool state changes (consolidates two callbacks). */
  const updateToolPreview = useCallback(() => {
    notifierForwardRef.current.notifyToolState()
    if (!playgroundMode) return
    setToolPreview(
      describeToolPhase(
        {
          compass: compassPhaseRef.current,
          straightedge: straightedgePhaseRef.current,
          extend: extendPhaseRef.current,
          macro: macroPhaseRef.current,
          snappedPointId: snappedPointIdRef.current,
        },
        constructionRef.current
      )
    )
  }, [playgroundMode])

  // Wire callback slots on the tool phase manager
  toolPhases.onMacroPhaseSync = setMacroPhase
  toolPhases.onActiveToolSync = setActiveTool
  toolPhases.onPhaseChange = updateToolPreview

  const handleMacroToolClick = useCallback(() => {
    toolPhases.selectTool('macro')
    // If there's only one macro available, skip the picker and go straight to selecting
    if (availableMacros.length === 1) {
      const { propId, def } = availableMacros[0]
      toolPhases.enterMacroSelecting(propId, def.inputs)
    } else {
      toolPhases.enterMacroChoosing()
    }
  }, [availableMacros, toolPhases])

  const handleMacroPropositionSelect = useCallback(
    (propId: number) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return
      toolPhases.enterMacroSelecting(propId, macroDef.inputs)
    },
    [toolPhases]
  )

  // ── Completion result derived from proof ──
  const effectiveResultSegments = useMemo(() => {
    if (!isComplete) return proposition.resultSegments
    return proposition.computeResultSegments
      ? proposition.computeResultSegments(constructionRef.current)
      : proposition.resultSegments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proposition])
  const effectiveResultSegmentsRef = useRef(effectiveResultSegments)
  effectiveResultSegmentsRef.current = effectiveResultSegments

  const completionResult = useMemo(() => {
    if (!isComplete) return null
    return deriveCompletionResult(
      factStoreRef.current,
      effectiveResultSegments,
      constructionRef.current
    )
    // proofFacts in deps so we re-derive after conclusion facts are added
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proofFacts, effectiveResultSegments])

  const showProofPanel = !playgroundMode

  const togglePanZoom = useCallback(() => {
    setPanZoomEnabled((prev) => {
      const next = !prev
      panZoomDisabledRef.current = !next
      return next
    })
  }, [])

  // Sync isCompleteRef with state + record completion time
  if (isComplete && !isCompleteRef.current) {
    completionTimeRef.current = performance.now()
  }
  isCompleteRef.current = isComplete

  // ── Input mode detection ──
  const [isTouch, setIsTouch] = useState(true) // mobile-first default
  const isTouchRef = useRef(isTouch)
  isTouchRef.current = isTouch
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Tutorial state ──
  const [tutorialSubStep, setTutorialSubStep] = useState(0)
  const tutorialSubStepRef = useRef(0)
  const prevCompassTagRef = useRef('idle')
  const prevStraightedgeTagRef = useRef('idle')
  const prevExtendTagRef = useRef('idle')

  const tutorialSubSteps = useMemo(
    () => getTutorial(isTouch, { languageStyle }),
    [isTouch, getTutorial, languageStyle]
  )
  const tutorialSubStepsRef = useRef(tutorialSubSteps)
  tutorialSubStepsRef.current = tutorialSubSteps

  // Derived: resolve tutorial sub-steps synchronously (same timing fix as displaySteps —
  // useEffect runs post-render, but we need the resolved speech available during render)
  const resolvedTutorial = useMemo(() => {
    if (proposition.resolveTutorialStep && currentStep >= 2) {
      const result = proposition.resolveTutorialStep(currentStep, constructionRef.current, isTouch)
      if (result) {
        // Also populate the ref so the RAF loop (tickTutorialAdvancement) can access it
        resolvedTutorialRef.current.set(currentStep, result)
        return result
      }
    }
    return resolvedTutorialRef.current.get(currentStep) ?? null
  }, [proposition, currentStep, isTouch])
  const currentSubStepDef =
    resolvedTutorial?.[tutorialSubStep] ?? tutorialSubSteps[currentStep]?.[tutorialSubStep]
  const currentInstruction = currentSubStepDef?.instruction ?? ''
  const currentSpeech = currentSubStepDef?.speech ?? ''
  const currentHint: TutorialHint = currentSubStepDef?.hint ?? { type: 'none' }
  const currentHintRef = useRef<TutorialHint>(currentHint)
  currentHintRef.current = currentHint

  // ── Group proof facts by step ──
  const factsByStep = useMemo(() => {
    const map = new Map<number, ProofFact[]>()
    for (const fact of proofFacts) {
      const existing = map.get(fact.atStep) ?? []
      existing.push(fact)
      map.set(fact.atStep, existing)
    }
    return map
  }, [proofFacts])

  // ── TTS integration ──
  const {
    isEnabled: globalAudioEnabled,
    setEnabled: setAudioEnabled,
    stop: stopAudio,
  } = useAudioManager()
  // When disableAudio is set, manage audio state locally so we don't auto-play on mount
  // (useful for blog embeds). The user can still toggle it on via the speaker button.
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false)
  const audioEnabled = disableAudio ? localAudioEnabled : globalAudioEnabled
  const audioEnabledRef = useRef(audioEnabled)
  audioEnabledRef.current = audioEnabled
  const currentSpeechRef = useRef(currentSpeech)
  currentSpeechRef.current = currentSpeech
  const sayCorrection = useTTS(
    {
      say: {
        en: 'You chose the lower intersection. I will rotate the triangle 180 degrees around the midpoint of AB. That swaps A and B, so I will relabel them so A stays on the left. Then we can explore.',
      },
      tone: 'tutorial-instruction',
    },
    {}
  )
  const sayMacroReveal = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const sayMacroRevealRef = useRef(sayMacroReveal)
  sayMacroRevealRef.current = sayMacroReveal
  // Generic correction speaker — called with dynamic text for wrong-move feedback
  const speakStepCorrection = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const speakStepCorrectionRef = useRef(speakStepCorrection)
  speakStepCorrectionRef.current = speakStepCorrection
  // Heckler stall speaker — plays a TTS line while WebRTC finishes connecting
  const speakHecklerStall = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const speakHecklerStallRef = useRef(speakHecklerStall)
  speakHecklerStallRef.current = speakHecklerStall
  // ── Pending action ref — shared between notifier, voice, and chat ──
  const pendingActionRef = useRef<string | null>(null)

  // ── Author tool callbacks (extracted to useAuthorCallbacks hook) ──
  const { callbacks: authorCallbacks, refs: authorRefs } = useAuthorCallbacks({
    constructionRef,
    postCompletionActionsRef,
    candidatesRef,
    currentStepRef,
    factStoreRef,
    proofFactsRef,
    authorProofFactsRef,
    setProofFacts,
    needsDrawRef,
  })

  // Current attitude from config — useGeometryTeacher is safe to call multiple times
  const teacherConfig = useGeometryTeacher()
  const currentAttitudeId = teacherConfig.attitudeId as
    | import('./agent/attitudes/types').AttitudeId
    | undefined
  const isAuthorMode = isAdmin && currentAttitudeId === 'author'
  /** Playground with author attitude active — show full chat/voice UI instead of heckler overlay */
  const isAuthorPlayground = playgroundMode && isAuthorMode

  // ── Text chat (must come before voice so transcript callbacks can reference addMessage) ──
  const euclidChat = useEuclidChat({
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    isComplete,
    playgroundMode: !!playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
    pendingActionRef,
    isMobile,
    attitudeId: currentAttitudeId,
    authorCallbacks: currentAttitudeId === 'author' ? authorCallbacks : undefined,
  })

  // Keep a ref to chat messages for voice session context injection
  const chatMessagesRef = useRef(euclidChat.messages)
  chatMessagesRef.current = euclidChat.messages

  // ── Transcript callbacks: inject voice transcripts into the shared chat history ──
  const handleModelSpeech = useCallback(
    (transcript: string) => {
      // Convert LaTeX notation from voice transcripts to our {seg:AB} marker syntax
      const converted = latexToMarkers(transcript)
      const msgId = generateId()
      // Insert before trailing events — speech started before events that arrived during it
      euclidChat.addMessageBeforeTrailingEvents({
        id: msgId,
        role: 'assistant',
        content: converted,
        timestamp: Date.now(),
        via: 'voice',
      })
      // Async: send to LLM for full entity markup (foundation refs, missed geometric refs)
      euclidChat.markupMessage(msgId, converted)
    },
    [euclidChat.addMessageBeforeTrailingEvents, euclidChat.markupMessage]
  )

  const handleChildSpeech = useCallback(
    (transcript: string) => {
      const msgId = generateId()
      euclidChat.addMessage({
        id: msgId,
        role: 'user',
        content: transcript,
        timestamp: Date.now(),
        via: 'voice',
      })
      // Async: markup user voice transcript with strict validation (preserves original text exactly)
      euclidChat.markupMessage(msgId, transcript, true)
    },
    [euclidChat.addMessage, euclidChat.markupMessage]
  )

  // ── Call Euclid voice (after chat so transcript callbacks are available) ──
  const euclidVoice = useGeometryVoice({
    canvasRef,
    constructionRef,
    factStoreRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    propositionTitle: proposition.title,
    propositionKind: proposition.kind ?? 'construction',
    totalSteps: steps.length,
    isComplete,
    playgroundMode: !!playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
    chatMessagesRef,
    compactForVoice: euclidChat.compaction.compactForVoice,
    onModelSpeech: handleModelSpeech,
    onChildSpeech: handleChildSpeech,
    authorCallbacks: currentAttitudeId === 'author' ? authorCallbacks : undefined,
  })

  // ── Speaking-aware profile image (needs euclidVoice.isSpeaking) ──
  const smProfileImage = useCharacterProfileImage(
    teacherConfig.definition.profileImage,
    'sm',
    euclidVoice.isSpeaking
  )
  const lgProfileImage = useCharacterProfileImage(
    teacherConfig.definition.profileImage,
    'lg',
    euclidVoice.isSpeaking
  )

  // ── Push-based construction notifier ──
  const notifierRef = useConstructionNotifier({
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
    voiceCallRef: euclidVoice.voiceCallRef,
    addMessage: euclidChat.addMessage,
    setTrailingEvent: euclidChat.setTrailingEvent,
    eventBus: eventBusRef.current,
  })

  // Wire the forward ref so updateToolPreview (defined before this hook) can call notifyToolState
  notifierForwardRef.current = notifierRef.current

  // ── Heckler trigger — watches construction in playground for proposition patterns ──
  const { heckler, hecklerPreDialRef, handleHecklerAnswer, handleHecklerDismiss } = useHecklerCall({
    constructionRef,
    playgroundMode,
    isAuthorMode,
    euclidVoice,
    teacherConfig,
    speakHecklerStallRef,
    stopAudio,
    onAttitudeChange,
    eventBusRef,
  })

  // ── Unified send handler: routes to voice session or SSE chat ──
  const handleChatSend = useCallback(
    (text: string) => {
      console.log(
        '[euclid] handleChatSend: voiceState=%s, text=%s',
        euclidVoice.state,
        text.slice(0, 50)
      )
      if (euclidVoice.state === 'active') {
        // Send to voice session + add to shared message history
        console.log('[euclid] routing to voice session')
        euclidVoice.sendUserText(text)
        const msgId = generateId()
        euclidChat.addMessage({
          id: msgId,
          role: 'user',
          content: text,
          timestamp: Date.now(),
          via: 'typed-during-call',
        })
        euclidChat.markupMessage(msgId, text, true)
      } else {
        // Normal SSE chat — sendMessage adds to history + streams response
        console.log('[euclid] routing to SSE chat')
        euclidChat.sendMessage(text)
      }
    },
    [euclidVoice.state, euclidVoice.sendUserText, euclidChat.addMessage, euclidChat.sendMessage]
  )

  // Chat highlight state — set when hovering geometric entities in chat
  const chatHighlightRef = useRef<GeometricEntityRef | null>(null)

  // Unified highlight handler for the old onHighlight prop (geometric only)
  const handleChatHighlight = useCallback((entity: EuclidEntityRef | null) => {
    if (entity && isGeometricEntity(entity)) {
      chatHighlightRef.current = entity
    } else {
      chatHighlightRef.current = null
    }
    needsDrawRef.current = true
  }, [])

  // Foundation highlight: reuses the same activeCitation state + CitationPopover
  const handleChatHighlightFoundation = useCallback(
    (entity: FoundationEntityRef, anchorRect: DOMRect) => {
      if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
      if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
      const key = foundationToCitationKey(entity)
      citationShowTimerRef.current = setTimeout(() => {
        setActiveCitation({ key, rect: anchorRect })
      }, 200)
    },
    []
  )

  const handleChatUnhighlightFoundation = useCallback(() => {
    if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
    citationHideTimerRef.current = setTimeout(() => {
      if (!popoverHoveredRef.current) setActiveCitation(null)
    }, 300)
  }, [])

  // Per-entity-type renderer for MarkedText — delegates to EuclidEntitySpan
  const renderEntity = useEuclidEntityRenderer({
    onHighlightGeometric: handleChatHighlight,
    onHighlightFoundation: handleChatHighlightFoundation,
    onUnhighlightFoundation: handleChatUnhighlightFoundation,
  })

  // Subtle renderer for tutorial guidance — interactive but visually muted
  const renderEntitySubtle = useEuclidEntityRenderer({
    onHighlightGeometric: handleChatHighlight,
    onHighlightFoundation: handleChatHighlightFoundation,
    onUnhighlightFoundation: handleChatUnhighlightFoundation,
    subtle: true,
  })

  // Mute TTS narration while a voice call is active, and stop any playing audio.
  // During heckler pre-dial (ringing/preconnected), the call is invisible to the user.
  const euclidCallVisible =
    euclidVoice.state === 'active' ||
    euclidVoice.state === 'ending' ||
    euclidVoice.state === 'error' ||
    (euclidVoice.state === 'ringing' && !hecklerPreDialRef.current)
  useEffect(() => {
    if (euclidCallVisible) stopAudio()
  }, [euclidCallVisible, stopAudio])
  const narrationEnabled = disableAudio ? audioEnabled : euclidCallVisible ? false : undefined

  // ── Chat mode manager (chat UI state + call state derivation) ──
  const {
    chatMode,
    setChatMode,
    mobileDockedExpanded,
    setMobileDockedExpanded,
    chatMounted,
    chatExpanded,
    chatCallState,
  } = useChatModeManager({
    euclidVoice,
    euclidCallVisible,
    hecklerPreDialRef,
    addMessage: euclidChat.addMessage,
  })

  const { handleDragStart, handleConstructionBreakdown } = useEuclidAudioHelp({
    instruction: currentSpeech,
    isComplete: playgroundMode ? false : isComplete,
    celebrationText:
      completionResult?.status === 'proven' && completionResult.statement
        ? completionResult.statement
        : 'Construction complete!',
    explorationNarration,
    enabledOverride: narrationEnabled,
  })

  const requestDraw = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  // ── Tutorial controller (step validation, corrections, rewind, snapshots) ──
  const tutorial = useTutorialController({
    steps,
    extendSegments,
    currentStepRef,
    snapshotStackRef,
    resolvedStepOverridesRef,
    resolvedTutorialRef,
    stepDataRef,
    constructionRef,
    candidatesRef,
    proofFactsRef,
    ghostLayersRef,
    factStoreRef,
    isCompleteRef,
    straightedgeDrawAnimRef,
    macroAnimationRef,
    macroRevealRef,
    superpositionFlashRef,
    citationFlashesRef,
    ghostOpacitiesRef,
    postCompletionActionsRef,
    correctionActiveRef,
    superpositionPhaseRef,
    superpositionCascadeTimersRef,
    toolPhases,
    audioEnabledRef,
    currentSpeechRef,
    speakStepCorrectionRef,
    proposition,
    tutorialSubStepRef,
    prevCompassTagRef,
    prevStraightedgeTagRef,
    setCurrentStep,
    setCompletedSteps,
    setIsComplete,
    setProofFacts,
    setTutorialSubStep,
    requestDraw,
  })

  const {
    checkStep,
    advanceObservation,
    triggerCorrection,
    handleRewindToStep: tutorialRewindToStep,
  } = tutorial

  // Wrap rewind with tool syncing (composition root concern)
  const handleRewindToStep = useCallback(
    (targetStep: number) => {
      tutorialRewindToStep(targetStep)
      // Sync tool/expected action refs for the new current step
      if (targetStep < steps.length) {
        const stepDef = steps[targetStep]
        const overrides = resolvedStepOverridesRef.current.get(targetStep)
        const effectiveExpected = overrides?.expected ?? stepDef.expected
        expectedActionRef.current = effectiveExpected
        if (stepDef.tool !== null) {
          toolPhases.selectTool(stepDef.tool)
          if (stepDef.tool === 'macro' && effectiveExpected.type === 'macro') {
            const macroDef = MACRO_REGISTRY[effectiveExpected.propId]
            if (macroDef) {
              toolPhases.enterMacroSelecting(effectiveExpected.propId, macroDef.inputs)
            }
          }
        }
      } else {
        expectedActionRef.current = null
      }
    },
    [tutorialRewindToStep, steps, resolvedStepOverridesRef, toolPhases]
  )

  // ── Citation flash helper ──

  const pushCitationFlash = useCallback(
    (init: CitationFlashInit) => {
      citationFlashesRef.current = [
        ...citationFlashesRef.current,
        { ...init, startTime: performance.now() } as CitationFlash,
      ]
      requestDraw()
    },
    [requestDraw]
  )

  // ── Construction commands (commit handlers) ──
  const {
    handleCommitCircle,
    handleCommitSegment,
    handleCommitExtend,
    handleMarkIntersection,
    handleCommitMacro,
    handlePlaceFreePoint,
  } = useConstructionCommands({
    steps,
    extendSegments,
    currentStepRef,
    resolvedStepOverridesRef,
    snapshotStackRef,
    stepDataRef,
    constructionRef,
    candidatesRef,
    proofFactsRef,
    factStoreRef,
    ghostLayersRef,
    isCompleteRef,
    postCompletionActionsRef,
    viewportRef,
    straightedgeDrawAnimRef,
    macroAnimationRef,
    macroRevealRef,
    ghostOpacitiesRef,
    correctionActiveRef,
    toolPhases,
    availableMacros,
    givenSetupActiveRef,
    givenSetup,
    audioEnabledRef,
    speakStepCorrectionRef,
    musicRef,
    notifierRef,
    checkStep,
    triggerCorrection,
    pushCitationFlash,
    requestDraw,
    setCeremonyLabel,
    setProofFacts,
    setCompletedSteps,
    setCurrentStep,
    setIsComplete,
    straightedgePhaseRef,
  })

  // ── Load given facts into the fact store (for theorems like I.4) ──
  useEffect(() => {
    const hasDistanceFacts = proposition.givenFacts && proposition.givenFacts.length > 0
    const hasAngleFacts = proposition.givenAngleFacts && proposition.givenAngleFacts.length > 0
    if (!hasDistanceFacts && !hasAngleFacts) return
    const store = factStoreRef.current
    const newFacts: ProofFact[] = []
    if (proposition.givenFacts) {
      for (const gf of proposition.givenFacts) {
        const left = distancePair(gf.left.a, gf.left.b)
        const right = distancePair(gf.right.a, gf.right.b)
        newFacts.push(
          ...addFact(
            store,
            left,
            right,
            { type: 'given' },
            gf.statement,
            'Given',
            -1 // before any step
          )
        )
      }
    }
    if (proposition.givenAngleFacts) {
      for (const gaf of proposition.givenAngleFacts) {
        const left = angleMeasure(gaf.left.vertex, gaf.left.ray1, gaf.left.ray2)
        const right = angleMeasure(gaf.right.vertex, gaf.right.ray1, gaf.right.ray2)
        newFacts.push(
          ...addAngleFact(store, left, right, { type: 'given' }, gaf.statement, 'Given', -1)
        )
      }
    }
    if (newFacts.length > 0) {
      proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
      setProofFacts(proofFactsRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Replay initial creation state (for loaded playground creations) ──
  useEffect(() => {
    if (!initialActions || initialActions.length === 0) return
    const result = replayConstruction(
      proposition.givenElements,
      proposition.steps,
      proposition,
      initialActions
    )
    constructionRef.current = result.state
    candidatesRef.current = result.candidates
    proofFactsRef.current = result.proofFacts
    ghostLayersRef.current = result.ghostLayers
    needsDrawRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync active tool to ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // ── Auto-select tool and sync expected action based on current step ──
  useEffect(() => {
    if (currentStep >= steps.length) {
      expectedActionRef.current = null
      return
    }

    // Apply resolveStep if the proposition defines it (for adaptive constructions)
    if (proposition.resolveStep && currentStep >= 2) {
      const override = proposition.resolveStep(
        currentStep,
        constructionRef.current,
        stepDataRef.current
      )
      if (override) {
        resolvedStepOverridesRef.current.set(
          currentStep,
          override as Partial<import('./types').PropositionStep>
        )
      }
    }

    // resolveTutorialStep is now computed synchronously in useMemo (above)
    // so the ref is already populated before this effect runs.

    // Use resolved override if available, else static step definition
    const overrides = resolvedStepOverridesRef.current.get(currentStep)
    const stepDef = steps[currentStep]
    const effectiveExpected = overrides?.expected ?? stepDef.expected
    const effectiveTool = stepDef.tool
    expectedActionRef.current = effectiveExpected

    // Observation steps need no tool — stay on move
    if (effectiveExpected.type === 'observation') {
      if (activeTool !== 'move') {
        toolPhases.selectTool('move')
      }
      return
    }

    // Superposition steps: initiate lifting phase and set up settled callback
    if (effectiveExpected.type === 'superposition') {
      superpositionPhaseRef.current = {
        tag: 'lifting',
        startTime: performance.now(),
        srcTriIds: effectiveExpected.src,
        tgtTriIds: effectiveExpected.tgt,
        mapping: effectiveExpected.mapping,
      }
      // Set up the settled callback for fact cascade + step advancement
      const establishes = effectiveExpected.establishes
      onSuperpositionSettledRef.current = () => {
        // Trigger superposition flash (celebratory coda)
        if (proposition.superpositionFlash) {
          superpositionFlashRef.current = {
            startTime: performance.now(),
            ...proposition.superpositionFlash,
          }
        }

        // Establish facts with 400ms spacing
        const timerIds: ReturnType<typeof setTimeout>[] = []
        establishes.cascade.forEach((fact, i) => {
          const timerId = setTimeout(
            () => {
              if (fact.kind === 'segment-equality') {
                const newFacts = addFact(
                  factStoreRef.current,
                  distancePair(fact.params.leftA, fact.params.leftB),
                  distancePair(fact.params.rightA, fact.params.rightB),
                  { type: 'cn4' },
                  fact.statement,
                  fact.justification,
                  currentStepRef.current
                )
                proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
              } else {
                const newFacts = addAngleFact(
                  factStoreRef.current,
                  angleMeasure(fact.params.leftVertex, fact.params.leftRay1, fact.params.leftRay2),
                  angleMeasure(
                    fact.params.rightVertex,
                    fact.params.rightRay1,
                    fact.params.rightRay2
                  ),
                  { type: 'cn4' },
                  fact.statement,
                  fact.justification,
                  currentStepRef.current
                )
                proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
              }
              setProofFacts([...proofFactsRef.current])
              needsDrawRef.current = true

              // After last fact: capture snapshot and advance step
              if (i === establishes.cascade.length - 1) {
                snapshotStackRef.current = [
                  ...snapshotStackRef.current,
                  captureSnapshot(
                    constructionRef.current,
                    candidatesRef.current,
                    proofFactsRef.current,
                    ghostLayersRef.current
                  ),
                ]
                setCompletedSteps((prev) => {
                  const next = [...prev]
                  next[currentStepRef.current] = true
                  return next
                })
                const nextStep = currentStepRef.current + 1
                currentStepRef.current = nextStep
                if (nextStep >= stepsRef.current.length) {
                  setIsComplete(true)
                }
                setCurrentStep(nextStep)
              }
            },
            (i + 1) * 400
          )
          timerIds.push(timerId)
        })
        superpositionCascadeTimersRef.current = timerIds
      }
      needsDrawRef.current = true
      return
    }

    if (effectiveTool === null) return

    // In guided mode, auto-select the required proposition so the user can
    // immediately tap canvas points. The panel will appear showing the
    // active proposition with point-selection progress.
    if (effectiveTool === 'macro' && effectiveExpected.type === 'macro') {
      const macroDef = MACRO_REGISTRY[effectiveExpected.propId]
      if (macroDef) {
        toolPhases.enterMacroSelecting(effectiveExpected.propId, macroDef.inputs)
      }
    }

    if (effectiveTool !== activeTool) {
      toolPhases.selectTool(effectiveTool)

      const toolLabels: Record<string, string> = {
        compass: 'Compass',
        straightedge: 'Straightedge',
        macro: 'Proposition',
      }
      const label = toolLabels[effectiveTool] ?? effectiveTool
      setToolToast(label)
      if (toolToastTimerRef.current) clearTimeout(toolToastTimerRef.current)
      toolToastTimerRef.current = setTimeout(() => setToolToast(null), 1800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // ── Reset tutorial sub-step when prop step changes ──
  useEffect(() => {
    tutorialSubStepRef.current = 0
    setTutorialSubStep(0)
  }, [currentStep])

  // ── Derive proposition conclusion facts when complete ──
  useEffect(() => {
    if (!isComplete) return
    const conclusionFn = proposition.deriveConclusion
    if (!conclusionFn) return
    const newFacts = conclusionFn(factStoreRef.current, constructionRef.current, steps.length)
    if (newFacts.length > 0) {
      proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
      setProofFacts(proofFactsRef.current)
    }

    // Trigger superposition flash for C.N.4 theorems
    if (proposition.superpositionFlash) {
      superpositionFlashRef.current = {
        startTime: performance.now(),
        ...proposition.superpositionFlash,
      }
      needsDrawRef.current = true
    }
  }, [isComplete, proposition.id, steps.length, proposition.superpositionFlash])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      } else if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        togglePanZoom()
      } else if ((e.key === 'g' || e.key === 'G') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        ghostBoundsEnabledRef.current = !ghostBoundsEnabledRef.current
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanZoom])

  // ── Playground operations (save/load/share, given-setup, revert, relocate, export) ──
  const playground = usePlaygroundOperations({
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
    resolvedStepOverridesRef: resolvedStepOverridesRef as React.MutableRefObject<
      Map<number, unknown>
    >,
    resolvedTutorialRef: resolvedTutorialRef as React.MutableRefObject<Map<number, unknown>>,
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
  })
  const {
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
  } = playground

  // Drag state for euclid-quad (draggable by avatar)
  const {
    quadRef,
    quadOffset,
    quadDragging,
    handleQuadPointerDown,
    handleQuadPointerMove,
    handleQuadPointerUp,
  } = useQuadDrag({ containerRef })
  const dockedInputRef = useRef<HTMLInputElement | null>(null)

  // ── Assign author tool callback refs (now that handlers are defined) ──
  authorRefs.handleCommitCircle.current = handleCommitCircle
  authorRefs.handleCommitSegment.current = handleCommitSegment
  authorRefs.handleCommitExtend.current = handleCommitExtend
  authorRefs.handleMarkIntersection.current = handleMarkIntersection
  authorRefs.handleCommitMacro.current = handleCommitMacro
  authorRefs.handleRevertToAction.current = handleRevertToAction
  authorRefs.handleRelocatePoint.current = handleRelocatePoint
  authorRefs.requestDraw.current = requestDraw

  // ── Auto-complete ──
  const { autoCompleting, setAutoCompleting } = useAutoComplete({
    steps,
    currentStepRef,
    resolvedStepOverridesRef,
    constructionRef,
    candidatesRef,
    handleCommitCircle,
    handleCommitSegment,
    handleCommitExtend,
    handleMarkIntersection,
    handleCommitMacro,
  })

  // ── Hook up pan/zoom ──
  useEuclidTouch({
    viewportRef,
    canvasRef,
    pointerCapturedRef,
    onViewportChange: requestDraw,
    panZoomDisabledRef,
  })

  // ── Hook up tool interaction ──
  useToolInteraction({
    canvasRef,
    viewportRef,
    constructionRef,
    pointerWorldRef,
    candidatesRef,
    toolPhases,
    onCommitCircle: handleCommitCircle,
    onCommitSegment: handleCommitSegment,
    onMarkIntersection: handleMarkIntersection,
    expectedActionRef,
    onCommitMacro: handleCommitMacro,
    onPlaceFreePoint: handlePlaceFreePoint,
    disabledRef: correctionActiveRef,
    extendPreviewRef,
    onCommitExtend: handleCommitExtend,
  })

  // ── Hook up drag interaction for post-completion play ──
  const {
    handleDragReplay,
    onDragStart: dragTopologyStart,
    onDragEnd: dragTopologyEnd,
  } = useDragTopologyTracking({
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
    setTrailingEvent: euclidChat.setTrailingEvent,
    setProofFacts,
  })

  useDragGivenPoints({
    canvasRef,
    propositionRef,
    constructionRef,
    factStoreRef,
    proofFactsRef,
    viewportRef,
    isCompleteRef,
    activeToolRef,
    needsDrawRef,
    pointerCapturedRef,
    candidatesRef,
    postCompletionActionsRef,
    stepDataRef,
    interactionLockedRef: correctionActiveRef,
    dragPointIdRef,
    onReplayResult: handleDragReplay,
    onDragStart: dragTopologyStart,
    onDragEnd: dragTopologyEnd,
  })

  // ── Superposition interaction (triangle drag/flip/snap) ──
  useSuperpositionInteraction({
    canvasRef,
    constructionRef,
    viewportRef,
    superpositionPhaseRef,
    needsDrawRef,
    isMobileRef,
  })

  // ── Construction music ──
  const music = useEuclidMusic({ constructionRef, factStoreRef, isComplete })
  musicRef.current = music

  // ── Canvas resize observer ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      requestDraw()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [requestDraw])

  // ── Build RAF context (stable ref bundle for extracted helpers) ──
  const rafCtx: RAFContext = useMemo(
    () => ({
      canvasRef,
      needsDrawRef,
      viewportRef,
      constructionRef,
      candidatesRef,
      factStoreRef,
      proofFactsRef,
      ghostLayersRef,
      currentStepRef,
      stepsRef,
      stepDataRef,
      tutorialSubStepRef,
      tutorialSubStepsRef,
      resolvedTutorialRef,
      prevCompassTagRef,
      prevStraightedgeTagRef,
      prevExtendTagRef,
      compassPhaseRef: compassPhaseRef as RAFContext['compassPhaseRef'],
      straightedgePhaseRef: straightedgePhaseRef as RAFContext['straightedgePhaseRef'],
      extendPhaseRef: extendPhaseRef as RAFContext['extendPhaseRef'],
      macroPhaseRef,
      activeToolRef,
      pointerWorldRef,
      pointerCapturedRef,
      snappedPointIdRef,
      panZoomDisabledRef,
      macroAnimationRef,
      macroRevealRef: macroRevealRef as RAFContext['macroRevealRef'],
      ceremonyDebugRef,
      relocatePointAnimRef: relocatePointAnimRef as RAFContext['relocatePointAnimRef'],
      correctionRef: correctionRef as RAFContext['correctionRef'],
      correctionActiveRef,
      straightedgeDrawAnimRef,
      superpositionFlashRef,
      citationFlashesRef,
      completionTimeRef,
      chatHighlightRef,
      extendPreviewRef,
      wiggleCancelRef,
      superpositionPhaseRef,
      onSuperpositionSettledRef,
      lastSweepRef,
      lastSweepTimeRef,
      lastSweepCenterRef,
      macroPreviewAutoFitRef,
      ghostBoundsEnabledRef,
      hoveredMacroStepRef,
      toolDockRef,
      ghostOpacitiesRef,
      currentHintRef,
      propositionRef,
      isCompleteRef,
      postCompletionActionsRef,
      isMobileRef,
      isTouchRef,
      playgroundModeRef,
      effectiveResultSegmentsRef,
      sayMacroRevealRef,
      eventBusRef,
      euclidVoiceHighlightRef: euclidVoice.voiceHighlightRef,
      rafRef,
      setTutorialSubStep,
      setIsCorrectionActive,
      setActiveTool,
      setProofFacts,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    []
  )

  // ── Completion lifecycle (onComplete, Prop 1 correction, wiggle) ──
  const { startWiggle } = useCompletionFlow({
    rafCtx,
    isComplete,
    playgroundMode,
    proposition,
    propositionId,
    onComplete,
    audioEnabled,
    sayCorrection,
    musicRef,
  })

  // ── RAF render loop ──
  useEffect(() => {
    let running = true

    function draw() {
      if (!running) return

      // ── Tick phase: tutorial advancement + animations ──
      tickTutorialAdvancement(rafCtx)
      const isAnimating = tickAnimations(rafCtx)
      if (isAnimating) needsDrawRef.current = true

      // ── Keep-alive flags for continuous animation ──
      if (currentHintRef.current.type !== 'none') needsDrawRef.current = true
      if (
        pointerWorldRef.current &&
        (activeToolRef.current !== 'macro' || macroPhaseRef.current.tag === 'selecting')
      ) {
        needsDrawRef.current = true
      }
      if (isCompleteRef.current && propositionRef.current.draggablePointIds) {
        needsDrawRef.current = true
      }

      // ── Render phase: auto-fit viewport + draw frame ──
      const canvas = canvasRef.current
      if (canvas && needsDrawRef.current) {
        needsDrawRef.current = false
        const dpr = window.devicePixelRatio || 1
        const cssWidth = canvas.width / dpr
        const cssHeight = canvas.height / dpr
        const ctx2d = canvas.getContext('2d')
        if (ctx2d) {
          ctx2d.save()
          ctx2d.scale(dpr, dpr)
          computeAutoFit(rafCtx, canvas, cssWidth, cssHeight)
          renderFrame(rafCtx, ctx2d, cssWidth, cssHeight)
          ctx2d.restore()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      data-component="euclid-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* ── Left pane: Canvas ── */}
      <div
        ref={containerRef}
        data-element="canvas-pane"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          touchAction: 'none',
          overflow: 'visible',
        }}
      >
        <canvas
          ref={canvasRef}
          data-element="euclid-canvas"
          onPointerDown={() => {
            if (isMobile) setIsToolDockActive(true)
          }}
          onPointerUp={() => {
            if (isMobile) setIsToolDockActive(false)
          }}
          onPointerCancel={() => {
            if (isMobile) setIsToolDockActive(false)
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor:
              activeTool === 'move'
                ? undefined // drag hook manages grab/grabbing cursor
                : activeTool === 'macro' && macroPhase.tag !== 'selecting'
                  ? undefined
                  : 'none',
          }}
        />

        {/* Tool auto-switch toast */}
        {toolToast && (
          <div
            data-element="tool-toast"
            style={{
              position: 'absolute',
              bottom: 84,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 14px',
              borderRadius: 8,
              background: 'rgba(78, 121, 167, 0.12)',
              color: '#4E79A7',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {toolToast} selected
          </div>
        )}

        {/* Macro reveal ceremony label */}
        {ceremonyLabel && (
          <div
            data-element="ceremony-label"
            style={{
              position: 'absolute',
              bottom: 84,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 14px',
              borderRadius: 8,
              background: 'rgba(240, 199, 94, 0.15)',
              color: '#b08a1a',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
            }}
          >
            {ceremonyLabel}
          </div>
        )}

        <ToolDock
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          playgroundMode={!!playgroundMode}
          isComplete={isComplete}
          isMobile={isMobile}
          isToolDockActive={isToolDockActive}
          setIsToolDockActive={setIsToolDockActive}
          hasConstructionSteps={hasConstructionSteps}
          hasDraggablePoints={!!proposition.draggablePointIds}
          availableMacros={availableMacros}
          macroPhase={macroPhase}
          handleMacroToolClick={handleMacroToolClick}
          startWiggle={startWiggle}
          givenSetupActive={givenSetup.isActive}
          activeToolRef={activeToolRef}
          toolDockRef={toolDockRef}
        />

        {/* Top-right bar — playground controls only */}
        {playgroundMode && (
          <PlaygroundControlsBar
            creationTitle={creationTitle}
            setCreationTitle={setCreationTitle}
            saveState={saveState}
            handleSave={handleSave}
            shareState={shareState}
            handleShare={handleShare}
            creationId={creationId}
            creationIsPublic={creationIsPublic}
            handleNewCanvas={handleNewCanvas}
            givenSetup={givenSetup}
            handleActivateGivenSetup={handleActivateGivenSetup}
            handleStartGivenConstruction={handleStartGivenConstruction}
            isAdmin={isAdmin}
            setShowCreationsPanel={setShowCreationsPanel}
            postCompletionActionsRef={postCompletionActionsRef}
          />
        )}

        {/* Admin-only export buttons */}
        {isAuthorPlayground && !givenSetup.isActive && (
          <AdminExportBar
            propositionIdInput={propositionIdInput}
            setPropositionIdInput={setPropositionIdInput}
            handleExportTypeScript={handleExportTypeScript}
            handleExportClaudePrompt={handleExportClaudePrompt}
            exportCopied={exportCopied}
            dynamicPropositionRef={dynamicPropositionRef}
            handleActivateGivenSetup={handleActivateGivenSetup}
            postCompletionActionsRef={postCompletionActionsRef}
          />
        )}

        {/* Euclid assembly — quad + floating chat, positioned at bottom-right */}
        {/* Hidden on mobile — controls live in the always-visible mobile chat strip */}
        {/* Also shown in playground mode when author attitude is active */}
        {(!playgroundMode || (isAdmin && currentAttitudeId === 'author')) && !isMobile && (
          <EuclidAssemblyQuad
            quadOffset={quadOffset}
            quadRef={quadRef}
            quadDragging={quadDragging}
            handleQuadPointerDown={handleQuadPointerDown}
            handleQuadPointerMove={handleQuadPointerMove}
            handleQuadPointerUp={handleQuadPointerUp}
            chatMounted={chatMounted}
            chatExpanded={chatExpanded}
            chatMode={chatMode}
            setChatMode={setChatMode}
            euclidChat={euclidChat}
            handleChatSend={handleChatSend}
            handleChatHighlight={handleChatHighlight}
            chatCallState={chatCallState}
            euclidVoice={euclidVoice}
            audioEnabled={audioEnabled}
            toggleAudio={() =>
              disableAudio ? setLocalAudioEnabled((v) => !v) : setAudioEnabled(!audioEnabled)
            }
            smProfileImage={smProfileImage}
            renderEntity={renderEntity}
            isVisualDebugEnabled={isVisualDebugEnabled}
            playgroundMode={!!playgroundMode}
            dockedInputRef={dockedInputRef}
          />
        )}

        {/* Voice call UI is now integrated into the chat panel via callState */}

        {showCreationsPanel && (
          <PlaygroundCreationsPanel
            onClose={() => setShowCreationsPanel(false)}
            onLoad={handleLoadCreation}
            currentId={creationId}
            playerId={playerId}
          />
        )}

        {/* Proposition picker panel — shown when macro tool is active */}
        {activeTool === 'macro' && macroPhase.tag !== 'idle' && (
          <MacroToolPanel
            macros={availableMacros}
            macroPhase={macroPhase}
            guidedPropId={guidedPropId}
            onSelect={handleMacroPropositionSelect}
            isMobile={isMobile}
          />
        )}

        {isCorrectionActive && (
          <div
            data-element="orientation-correction"
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.82)',
              color: '#f8fafc',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
              zIndex: 11,
            }}
          >
            Rotating to the standard orientation…
          </div>
        )}

        {!isMobile && (
          <div
            data-element="shortcuts-hint"
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              fontSize: 12,
              color: 'rgba(100, 116, 139, 0.5)',
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Press ? for shortcuts
          </div>
        )}

        {/* Keyboard shortcuts overlay */}
        {showShortcuts && (
          <KeyboardShortcutsOverlay
            shortcuts={SHORTCUTS}
            onClose={() => setShowShortcuts(false)}
            isDark={false}
          />
        )}

        {/* ── Heckler call overlay (watching → ringing → connecting → active) ── */}
        {/* Hidden in author mode — author uses the full chat/voice UI instead */}
        {playgroundMode &&
          !isAuthorPlayground &&
          (heckler.stage !== 'idle' || euclidCallVisible) && (
            <HecklerCallOverlay
              phase={
                euclidCallVisible
                  ? 'active'
                  : heckler.stage === 'answered'
                    ? 'connecting'
                    : heckler.stage === 'ringing'
                      ? 'ringing'
                      : 'watching'
              }
              profileImage={smProfileImage}
              lgProfileImage={lgProfileImage}
              characterName={
                teacherConfig.definition.nativeDisplayName ?? teacherConfig.definition.displayName
              }
              isSpeaking={euclidVoice.isSpeaking}
              isThinking={euclidVoice.isThinking}
              timeRemaining={euclidVoice.timeRemaining}
              onAnswer={handleHecklerAnswer}
              onDismiss={handleHecklerDismiss}
              onHangUp={euclidVoice.hangUp}
            />
          )}
      </div>

      {/* ── Right pane: Construction log (playground mode) ── */}
      {playgroundMode && (
        <div
          data-element="proof-ledger-panel"
          style={{
            width: isMobile ? '100%' : 340,
            minWidth: isMobile ? 0 : 340,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#FAFAF0',
            borderLeft: isMobile ? undefined : '1px solid rgba(203, 213, 225, 0.6)',
            borderTop: isMobile ? '1px solid rgba(203, 213, 225, 0.6)' : undefined,
            position: 'relative',
            height: isMobile ? `${MOBILE_PROOF_PANEL_HEIGHT_RATIO * 100}dvh` : '100%',
          }}
        >
          {givenSetup.isActive ? (
            <GivenSetupPanel
              givenElements={givenSetup.givenElements}
              givenFacts={givenSetup.givenFacts}
              onRenamePoint={givenSetup.renamePoint}
              onDeleteElement={givenSetup.deleteElement}
              onAddFact={givenSetup.addFact}
              onDeleteFact={givenSetup.deleteFact}
              onStartConstruction={handleStartGivenConstruction}
              onCancel={handleCancelGivenSetup}
            />
          ) : (
            <ProofLedger
              constructionState={constructionRef.current}
              actions={postCompletionActionsRef.current}
              givenElements={
                dynamicPropositionRef.current
                  ? dynamicPropositionRef.current.givenElements
                  : proposition.givenElements
              }
              proofFacts={proofFacts}
              eventBus={eventBusRef.current}
              pointLabels={getAllPoints(constructionRef.current).map((p) => p.label)}
              renderEntity={renderEntity}
              onRevertToAction={handleRevertToAction}
              onCitationPointerEnter={handleCitationPointerEnter}
              onCitationPointerLeave={handleCitationPointerLeave}
              onCitationPointerDown={handleCitationPointerDown}
              toolPreview={toolPreview}
              isMobile={isMobile}
            />
          )}
          {/* Docked chat — author mode in playground (desktop) */}
          {isAuthorPlayground && !isMobile && (
            <DockedEuclidChat
              messages={euclidChat.messages}
              isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
              onSend={handleChatSend}
              onHighlight={handleChatHighlight}
              renderEntity={renderEntity}
              callState={chatCallState}
              isMobile={false}
              collapsed={chatMode !== 'docked'}
              onUndock={() => setChatMode('floating')}
              inputRef={dockedInputRef}
              debugCompaction={
                isVisualDebugEnabled
                  ? {
                      coversUpTo: euclidChat.compaction.coversUpTo,
                      isSummarizing: !!euclidChat.compaction.isSummarizingRef.current,
                      onCompactUpTo: euclidChat.compaction.manualCompactUpTo,
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* ── Right pane: Proof panel (hidden in playground mode) ── */}
      {!playgroundMode && showProofPanel && (
        <div
          data-element="proof-panel"
          style={{
            width: isMobile ? '100%' : 340,
            minWidth: isMobile ? 0 : 340,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#FAFAF0',
            borderLeft: isMobile ? undefined : '1px solid rgba(203, 213, 225, 0.6)',
            borderTop: isMobile ? '1px solid rgba(203, 213, 225, 0.6)' : undefined,
            position: 'relative',
            height: isMobile
              ? mobileDockedExpanded
                ? 'calc(50dvh / 3)'
                : `${MOBILE_PROOF_PANEL_HEIGHT_RATIO * 100}dvh`
              : '100%',
            transition: isMobile ? 'height 0.25s ease' : undefined,
            boxShadow: isMobile ? '0 -10px 24px rgba(0,0,0,0.12)' : undefined,
          }}
        >
          <GuidedProofPanel
            proposition={proposition}
            steps={displaySteps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            isComplete={isComplete}
            proofFacts={proofFacts}
            factsByStep={factsByStep}
            completionResult={completionResult}
            completionMeta={completionMeta}
            currentInstruction={currentInstruction}
            constructionState={constructionRef.current}
            onRewindToStep={handleRewindToStep}
            advanceObservation={advanceObservation}
            onHoverMacroStep={(stepIdx) => {
              hoveredMacroStepRef.current = stepIdx
              needsDrawRef.current = true
            }}
            renderEntity={renderEntity}
            renderEntitySubtle={renderEntitySubtle}
            onHighlight={handleChatHighlight}
            onCitationPointerEnter={handleCitationPointerEnter}
            onCitationPointerLeave={handleCitationPointerLeave}
            onCitationPointerDown={handleCitationPointerDown}
            factStoreRef={factStoreRef}
            isMobile={isMobile}
          />
          {/* Docked chat — desktop: below proof steps in the right column */}
          {!isMobile && (
            <DockedEuclidChat
              messages={euclidChat.messages}
              isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
              onSend={handleChatSend}
              onHighlight={handleChatHighlight}
              renderEntity={renderEntity}
              callState={chatCallState}
              isMobile={false}
              collapsed={chatMode !== 'docked'}
              onUndock={() => setChatMode('floating')}
              inputRef={dockedInputRef}
              debugCompaction={
                isVisualDebugEnabled
                  ? {
                      coversUpTo: euclidChat.compaction.coversUpTo,
                      isSummarizing: !!euclidChat.compaction.isSummarizingRef.current,
                      onCompactUpTo: euclidChat.compaction.manualCompactUpTo,
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* Docked chat — mobile: compact strip below proof panel (also in author playground) */}
      {isMobile && (!playgroundMode || isAuthorPlayground) && (
        <DockedEuclidChat
          messages={euclidChat.messages}
          isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
          onSend={handleChatSend}
          onHighlight={handleChatHighlight}
          renderEntity={renderEntity}
          callState={chatCallState}
          isMobile={true}
          collapsed={false}
          inputRef={dockedInputRef}
          onCall={euclidVoice.state === 'idle' ? euclidVoice.dial : undefined}
          canCall={euclidVoice.state === 'idle'}
          onToggleAudio={() =>
            disableAudio ? setLocalAudioEnabled((v) => !v) : setAudioEnabled(!audioEnabled)
          }
          audioEnabled={audioEnabled}
          onExpandedChange={setMobileDockedExpanded}
          onColdStart={euclidChat.coldStart}
        />
      )}

      {/* Citation popover — rendered at root so position:fixed works cleanly */}
      {activeCitation && (
        <CitationPopover
          citationKey={activeCitation.key}
          anchorRect={activeCitation.rect}
          onClose={() => setActiveCitation(null)}
          onMouseEnter={() => {
            popoverHoveredRef.current = true
            if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
          }}
          onMouseLeave={() => {
            popoverHoveredRef.current = false
            setActiveCitation(null)
          }}
        />
      )}

      {showContextDebug && (
        <EuclidContextDebugPanel
          constructionRef={constructionRef}
          proofFactsRef={proofFactsRef}
          currentStepRef={currentStepRef}
          steps={steps}
          isComplete={isComplete}
          activeToolRef={activeToolRef}
          compassPhaseRef={compassPhaseRef}
          straightedgePhaseRef={straightedgePhaseRef}
          extendPhaseRef={extendPhaseRef}
          macroPhaseRef={macroPhaseRef}
          dragPointIdRef={dragPointIdRef}
          pendingActionRef={pendingActionRef}
          voiceState={euclidVoice.state}
          isSpeaking={euclidVoice.isSpeaking}
          notifierRef={notifierRef}
          chatMessageCount={euclidChat.messages.length}
          compaction={{
            headSummary: euclidChat.compaction.headSummary,
            coversUpTo: euclidChat.compaction.coversUpTo,
            isSummarizingRef: euclidChat.compaction.isSummarizingRef,
          }}
        />
      )}

      <EuclidDebugControls
        ceremonyFocusMode={ceremonyFocusMode}
        setCeremonyFocusMode={setCeremonyFocusMode}
        ceremonySpeed={ceremonySpeed}
        setCeremonySpeed={setCeremonySpeed}
        ceremonyPaused={ceremonyPaused}
        setCeremonyPaused={setCeremonyPaused}
        ceremonyTick={ceremonyTick}
        setCeremonyTick={setCeremonyTick}
        macroRevealRef={macroRevealRef}
        ghostLayersRef={ghostLayersRef}
        needsDrawRef={needsDrawRef}
        showContextDebug={showContextDebug}
        setShowContextDebug={setShowContextDebug}
        music={music}
        macroPreviewAutoFitRef={macroPreviewAutoFitRef}
        frictionCoeff={frictionCoeff}
        setFrictionCoeff={setFrictionCoeff}
        ghostBaseOpacityVal={ghostBaseOpacityVal}
        setGhostBaseOpacityVal={setGhostBaseOpacityVal}
        ghostFalloffCoeff={ghostFalloffCoeff}
        setGhostFalloffCoeff={setGhostFalloffCoeff}
        autoCompleting={autoCompleting}
        setAutoCompleting={setAutoCompleting}
        isComplete={isComplete}
        stepsLength={steps.length}
      />
    </div>
  )
}
