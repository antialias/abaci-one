'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
  CompassPhase,
  StraightedgePhase,
  RulerPhase,
  MacroPhase,
  Measurement,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  TutorialHint,
  PropositionDef,
  TutorialSubStep,
  ExpectedAction,
} from './types'
import { initializeGiven, addPoint, addCircle, addSegment, removeLastElement, getPoint, getAllSegments } from './engine/constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from './engine/intersections'
import { renderConstruction } from './render/renderConstruction'
import { renderTutorialHint } from './render/renderTutorialHint'
import { renderMeasurements } from './render/renderMeasurements'
import { renderEqualityMarks } from './render/renderEqualityMarks'
import { useEuclidTouch } from './interaction/useEuclidTouch'
import { useToolInteraction } from './interaction/useToolInteraction'
import { validateStep } from './propositions/validation'
import { PROP_1 } from './propositions/prop1'
import { PROP_2 } from './propositions/prop2'
import { getProp1Tutorial } from './propositions/prop1Tutorial'
import { getProp2Tutorial } from './propositions/prop2Tutorial'
import { useEuclidAudioHelp } from './hooks/useEuclidAudioHelp'
import { createFactStore, queryEquality, getEqualDistances } from './engine/factStore'
import type { FactStore } from './engine/factStore'
import type { EqualityFact } from './engine/facts'
import { distancePair, distancePairKey } from './engine/facts'
import type { DistancePair } from './engine/facts'
import { deriveDef15Facts } from './engine/factDerivation'
import { MACRO_REGISTRY } from './engine/macros'
import { resolveSelector } from './engine/selectors'
import type { MacroAnimation } from './engine/macroExecution'
import { createMacroAnimation, tickMacroAnimation, getHiddenElementIds } from './engine/macroExecution'
import { PROP_CONCLUSIONS } from './propositions/prop2Facts'
import { CITATIONS, citationDefFromFact } from './engine/citations'
import { KeyboardShortcutsOverlay } from '../shared/KeyboardShortcutsOverlay'
import type { ShortcutEntry } from '../shared/KeyboardShortcutsOverlay'

// ── Keyboard shortcuts ──

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'V', description: 'Toggle pan/zoom (disabled by default)' },
  { key: '?', description: 'Toggle this help' },
]

// ── Viewport centering ──

/** Compute a good initial viewport center for a proposition's given elements. */
function computeInitialViewport(givenElements: readonly { kind: string; x?: number; y?: number }[]): EuclidViewportState {
  const points = givenElements.filter(e => e.kind === 'point' && e.x !== undefined && e.y !== undefined) as { x: number; y: number }[]
  if (points.length === 0) return { center: { x: 0, y: 0 }, pixelsPerUnit: 60 }

  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))

  // Center on given points, shifted up a bit to leave room for construction above
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2 + 1.5

  return { center: { x: cx, y: cy }, pixelsPerUnit: 50 }
}

interface CompletionSegment {
  label: string
  dp: DistancePair
}

interface CompletionResult {
  /** 'proven' when the fact store confirms the result, 'unproven' if it doesn't */
  status: 'proven' | 'unproven'
  /** The equality statement, e.g. "AF = BC" */
  statement: string | null
  /** Individual segments in the equality chain, for hover provenance */
  segments: CompletionSegment[]
}

/**
 * Derive the completion result from the fact store's proven equalities
 * on the proposition's result segments. Returns the proven equality
 * (e.g. "AF = BC") or flags it as unproven if the engine couldn't establish it.
 */
function deriveCompletionResult(
  factStore: FactStore,
  resultSegments: Array<{ fromId: string; toId: string }> | undefined,
  state: ConstructionState,
): CompletionResult {
  if (!resultSegments || resultSegments.length === 0) {
    return { status: 'proven', statement: null, segments: [] }
  }

  const label = (id: string) => getPoint(state, id)?.label ?? id
  const segLabel = (fromId: string, toId: string) => `${label(fromId)}${label(toId)}`

  // Collect all result segment distance pairs
  const resultDps = resultSegments.map(rs => distancePair(rs.fromId, rs.toId))

  // Build an ordered list of equal segments, starting with result segments
  // then adding any construction segment that's in the same equality class
  const equalSegs: CompletionSegment[] = []
  const seen = new Set<string>()

  for (const rs of resultSegments) {
    const lbl = segLabel(rs.fromId, rs.toId)
    if (!seen.has(lbl)) {
      seen.add(lbl)
      equalSegs.push({ label: lbl, dp: distancePair(rs.fromId, rs.toId) })
    }
  }

  // Check all construction segments for matches
  for (const seg of getAllSegments(state)) {
    const segDp = distancePair(seg.fromId, seg.toId)
    const lbl = segLabel(seg.fromId, seg.toId)
    if (seen.has(lbl)) continue

    for (const rDp of resultDps) {
      if (queryEquality(factStore, rDp, segDp)) {
        seen.add(lbl)
        equalSegs.push({ label: lbl, dp: segDp })
        break
      }
    }
  }

  if (equalSegs.length >= 2) {
    return {
      status: 'proven',
      statement: equalSegs.map(s => s.label).join(' = '),
      segments: equalSegs,
    }
  }

  // If we have result segments but couldn't find proven equalities,
  // the proof chain is incomplete
  return {
    status: 'unproven',
    statement: resultSegments.map(rs => segLabel(rs.fromId, rs.toId)).join(', '),
    segments: resultSegments.map(rs => ({
      label: segLabel(rs.fromId, rs.toId),
      dp: distancePair(rs.fromId, rs.toId),
    })),
  }
}

// ── Proposition registry ──

const PROPOSITIONS: Record<number, PropositionDef> = {
  1: PROP_1,
  2: PROP_2,
}

const TUTORIAL_GENERATORS: Record<number, (isTouch: boolean) => TutorialSubStep[][]> = {
  1: getProp1Tutorial,
  2: getProp2Tutorial,
}

interface EuclidCanvasProps {
  propositionId?: number
}

export function EuclidCanvas({ propositionId = 1 }: EuclidCanvasProps) {
  const proposition = PROPOSITIONS[propositionId] ?? PROP_1
  const getTutorial = TUTORIAL_GENERATORS[propositionId] ?? getProp1Tutorial

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Core refs (performance-critical, not React state)
  const viewportRef = useRef<EuclidViewportState>(computeInitialViewport(proposition.givenElements))
  const constructionRef = useRef<ConstructionState>(initializeGiven(proposition.givenElements))
  const compassPhaseRef = useRef<CompassPhase>({ tag: 'idle' })
  const straightedgePhaseRef = useRef<StraightedgePhase>({ tag: 'idle' })
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const snappedPointIdRef = useRef<string | null>(null)
  const candidatesRef = useRef<IntersectionCandidate[]>([])
  const pointerCapturedRef = useRef(false)
  const activeToolRef = useRef<ActiveTool>(proposition.steps[0]?.tool ?? 'compass')
  const rulerPhaseRef = useRef<RulerPhase>({ tag: 'idle' })
  const measurementsRef = useRef<Measurement[]>([])
  const preRulerToolRef = useRef<'compass' | 'straightedge'>(proposition.steps[0]?.tool === 'straightedge' ? 'straightedge' : 'compass')
  const expectedActionRef = useRef<ExpectedAction | null>(proposition.steps[0]?.expected ?? null)
  const needsDrawRef = useRef(true)
  const rafRef = useRef<number>(0)
  const macroPhaseRef = useRef<MacroPhase>({ tag: 'idle' })
  const macroAnimationRef = useRef<MacroAnimation | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(true)

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>(proposition.steps[0]?.tool ?? 'compass')
  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0)
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(
    proposition.steps.map(() => false),
  )
  const [isComplete, setIsComplete] = useState(false)
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [proofFacts, setProofFacts] = useState<EqualityFact[]>([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [panZoomEnabled, setPanZoomEnabled] = useState(false)
  const [hoveredProofDp, setHoveredProofDp] = useState<DistancePair | null>(null)

  // Full equivalence class for the hovered dp — follow transitive chain
  const hoveredDpKeys = useMemo(() => {
    if (!hoveredProofDp) return null
    const eqDps = getEqualDistances(factStoreRef.current, hoveredProofDp)
    return new Set(eqDps.map(distancePairKey))
  }, [hoveredProofDp])

  // ── Completion result derived from proof ──
  const completionResult = useMemo(() => {
    if (!isComplete) return null
    return deriveCompletionResult(
      factStoreRef.current,
      proposition.resultSegments,
      constructionRef.current,
    )
    // proofFacts in deps so we re-derive after conclusion facts are added
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proofFacts, proposition.resultSegments])

  // ── Input mode detection ──
  const [isTouch, setIsTouch] = useState(true) // mobile-first default
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

  const tutorialSubSteps = useMemo(() => getTutorial(isTouch), [isTouch, getTutorial])
  const tutorialSubStepsRef = useRef(tutorialSubSteps)
  tutorialSubStepsRef.current = tutorialSubSteps

  // Derived: current sub-step definition
  const currentSubStepDef = tutorialSubSteps[currentStep]?.[tutorialSubStep]
  const currentInstruction = currentSubStepDef?.instruction ?? ''
  const currentSpeech = currentSubStepDef?.speech ?? ''
  const currentHint: TutorialHint = currentSubStepDef?.hint ?? { type: 'none' }
  const currentHintRef = useRef<TutorialHint>(currentHint)
  currentHintRef.current = currentHint

  // ── Group proof facts by step ──
  const factsByStep = useMemo(() => {
    const map = new Map<number, EqualityFact[]>()
    for (const fact of proofFacts) {
      const existing = map.get(fact.atStep) ?? []
      existing.push(fact)
      map.set(fact.atStep, existing)
    }
    return map
  }, [proofFacts])

  // ── TTS integration ──
  useEuclidAudioHelp({
    instruction: currentSpeech,
    isComplete,
    celebrationText: completionResult?.status === 'proven' && completionResult.statement
      ? completionResult.statement
      : 'Construction complete!',
  })

  const requestDraw = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  // Sync active tool to ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // ── Auto-select tool and sync expected action based on current step ──
  useEffect(() => {
    if (currentStep >= proposition.steps.length) {
      expectedActionRef.current = null
      return
    }
    const stepDef = proposition.steps[currentStep]
    expectedActionRef.current = stepDef.expected

    if (stepDef.tool === null) return
    if (stepDef.tool !== activeTool) {
      setActiveTool(stepDef.tool)
      activeToolRef.current = stepDef.tool

      // Initialize macro phase when entering a macro step
      if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
        const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
        if (macroDef) {
          macroPhaseRef.current = {
            tag: 'selecting',
            propId: stepDef.expected.propId,
            inputLabels: macroDef.inputLabels,
            selectedPointIds: [],
          }
        }
      }

      const toolLabels: Record<string, string> = {
        compass: 'Compass',
        straightedge: 'Straightedge',
        ruler: 'Ruler',
        macro: 'Proposition',
      }
      const label = toolLabels[stepDef.tool] ?? stepDef.tool
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
    const conclusionFn = PROP_CONCLUSIONS[proposition.id]
    if (!conclusionFn) return
    const newFacts = conclusionFn(
      factStoreRef.current,
      constructionRef.current,
      proposition.steps.length,
    )
    if (newFacts.length > 0) {
      setProofFacts(prev => [...prev, ...newFacts])
    }
  }, [isComplete, proposition.id, proposition.steps.length])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      } else if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setPanZoomEnabled(prev => {
          const next = !prev
          panZoomDisabledRef.current = !next
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Step validation (uses ref to avoid stale closures) ──

  const checkStep = useCallback(
    (element: ConstructionElement, candidate?: IntersectionCandidate) => {
      const step = currentStepRef.current
      if (step >= proposition.steps.length) return

      const stepDef = proposition.steps[step]
      const valid = validateStep(stepDef.expected, constructionRef.current, element, candidate)
      if (valid) {
        setCompletedSteps(prev => {
          const next = [...prev]
          next[step] = true
          return next
        })
        const nextStep = step + 1
        currentStepRef.current = nextStep
        if (nextStep >= proposition.steps.length) {
          setIsComplete(true)
        }
        setCurrentStep(nextStep)
      }
    },
    [proposition.steps],
  )

  // ── Commit handlers ──

  const handleCommitCircle = useCallback(
    (centerId: string, radiusPointId: string) => {
      const result = addCircle(constructionRef.current, centerId, radiusPointId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.circle,
        candidatesRef.current,
        proposition.extendSegments,
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      checkStep(result.circle)
      requestDraw()
    },
    [checkStep, requestDraw, proposition.extendSegments],
  )

  const handleCommitSegment = useCallback(
    (fromId: string, toId: string) => {
      const result = addSegment(constructionRef.current, fromId, toId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.segment,
        candidatesRef.current,
        proposition.extendSegments,
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      checkStep(result.segment)
      requestDraw()
    },
    [checkStep, requestDraw, proposition.extendSegments],
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      // In guided mode, reject candidates that don't match the current step's expected ofA/ofB.
      // This prevents wrong taps from creating points that derail subsequent steps.
      const step = currentStepRef.current
      let explicitLabel: string | undefined
      if (step < proposition.steps.length) {
        const expected = proposition.steps[step].expected
        if (expected.type === 'intersection') {
          explicitLabel = expected.label
          if (expected.ofA != null && expected.ofB != null) {
            const resolvedA = resolveSelector(expected.ofA, constructionRef.current)
            const resolvedB = resolveSelector(expected.ofB, constructionRef.current)
            if (!resolvedA || !resolvedB) return
            const matches =
              (candidate.ofA === resolvedA && candidate.ofB === resolvedB) ||
              (candidate.ofA === resolvedB && candidate.ofB === resolvedA)
            if (!matches) {
              return
            }
            // If beyondId is specified, reject candidates on the wrong side
            if (expected.beyondId) {
              if (!isCandidateBeyondPoint(candidate, expected.beyondId, candidate.ofA, candidate.ofB, constructionRef.current)) {
                return
              }
            }
          }
        }
      }

      const result = addPoint(
        constructionRef.current,
        candidate.x,
        candidate.y,
        'intersection',
        explicitLabel,
      )
      constructionRef.current = result.state

      candidatesRef.current = candidatesRef.current.filter(
        c => !(Math.abs(c.x - candidate.x) < 0.001 && Math.abs(c.y - candidate.y) < 0.001),
      )

      // Derive Def.15 facts for intersection points on circles
      const newFacts = deriveDef15Facts(
        candidate,
        result.point.id,
        constructionRef.current,
        factStoreRef.current,
        step,
      )
      if (newFacts.length > 0) {
        setProofFacts(prev => [...prev, ...newFacts])
      }

      checkStep(result.point, candidate)
      requestDraw()
    },
    [checkStep, requestDraw, proposition.steps],
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const step = currentStepRef.current

      // Get outputLabels from the current step's expected action
      const expected = step < proposition.steps.length ? proposition.steps[step].expected : null
      const outputLabels = expected?.type === 'macro' ? expected.outputLabels : undefined

      // Execute the macro — state is computed all at once
      const result = macroDef.execute(
        constructionRef.current,
        inputPointIds,
        candidatesRef.current,
        factStoreRef.current,
        proposition.extendSegments,
        outputLabels,
      )

      // Update atStep on macro's facts
      const factsWithStep = result.newFacts.map(f => ({ ...f, atStep: step }))

      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      // factStore is mutated in place by the macro — no reassignment needed
      if (factsWithStep.length > 0) {
        setProofFacts(prev => [...prev, ...factsWithStep])
      }

      // Start animation
      macroAnimationRef.current = createMacroAnimation(result)

      // Directly advance the step (macro validation is handled here, not in validateStep)
      setCompletedSteps(prev => {
        const next = [...prev]
        next[step] = true
        return next
      })
      const nextStep = step + 1
      currentStepRef.current = nextStep
      if (nextStep >= proposition.steps.length) {
        setIsComplete(true)
      }
      setCurrentStep(nextStep)

      requestDraw()
    },
    [proposition.steps, proposition.extendSegments, requestDraw],
  )

  const handleUndo = useCallback(() => {
    // Context-sensitive: ruler active → pop last measurement; otherwise → undo construction
    if (activeToolRef.current === 'ruler' && measurementsRef.current.length > 0) {
      measurementsRef.current = measurementsRef.current.slice(0, -1)
    } else {
      constructionRef.current = removeLastElement(constructionRef.current)
      candidatesRef.current = []
    }
    requestDraw()
  }, [requestDraw])

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
    compassPhaseRef,
    straightedgePhaseRef,
    pointerWorldRef,
    snappedPointIdRef,
    candidatesRef,
    pointerCapturedRef,
    activeToolRef,
    needsDrawRef,
    onCommitCircle: handleCommitCircle,
    onCommitSegment: handleCommitSegment,
    onMarkIntersection: handleMarkIntersection,
    expectedActionRef,
    rulerPhaseRef,
    measurementsRef,
    macroPhaseRef,
    onCommitMacro: handleCommitMacro,
  })

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

  // ── RAF render loop ──
  useEffect(() => {
    let running = true

    function draw() {
      if (!running) return

      // ── Observe tool phase transitions for tutorial advancement ──
      const subSteps = tutorialSubStepsRef.current
      const step = currentStepRef.current
      const subStep = tutorialSubStepRef.current

      const compassTag = compassPhaseRef.current.tag
      if (compassTag !== prevCompassTagRef.current) {
        const prev = prevCompassTagRef.current
        prevCompassTagRef.current = compassTag

        if (compassTag === 'idle' && prev !== 'idle') {
          // Gesture cancelled or completed — reset sub-step
          tutorialSubStepRef.current = 0
          setTutorialSubStep(0)
        } else {
          const subStepDef = subSteps[step]?.[subStep]
          if (subStepDef?.advanceOn === compassTag) {
            const next = subStep + 1
            tutorialSubStepRef.current = next
            setTutorialSubStep(next)
          }
        }
      }

      const straightedgeTag = straightedgePhaseRef.current.tag
      if (straightedgeTag !== prevStraightedgeTagRef.current) {
        const prev = prevStraightedgeTagRef.current
        prevStraightedgeTagRef.current = straightedgeTag

        if (straightedgeTag === 'idle' && prev !== 'idle') {
          tutorialSubStepRef.current = 0
          setTutorialSubStep(0)
        }
      }

      // ── Tick macro animation ──
      const macroAnim = macroAnimationRef.current
      if (macroAnim && macroAnim.revealedCount < macroAnim.elements.length) {
        const newCount = tickMacroAnimation(macroAnim)
        if (newCount !== macroAnim.revealedCount) {
          macroAnim.revealedCount = newCount
          needsDrawRef.current = true
        }
        if (newCount >= macroAnim.elements.length) {
          macroAnimationRef.current = null
        }
      }

      // ── Track macro phase for tutorial advancement ──
      const macroPhase = macroPhaseRef.current
      if (macroPhase.tag === 'selecting' && macroPhase.selectedPointIds.length > 0) {
        const subStepDef = subSteps[step]?.[subStep]
        const advanceTag = `macro-select-${macroPhase.selectedPointIds.length - 1}`
        if (subStepDef?.advanceOn === advanceTag) {
          const next = subStep + 1
          tutorialSubStepRef.current = next
          setTutorialSubStep(next)
        }
      }

      // ── Keep animating while tutorial hints are visible ──
      const hint = currentHintRef.current
      if (hint.type !== 'none') {
        needsDrawRef.current = true
      }

      const canvas = canvasRef.current
      if (canvas && needsDrawRef.current) {
        needsDrawRef.current = false

        const dpr = window.devicePixelRatio || 1
        const cssWidth = canvas.width / dpr
        const cssHeight = canvas.height / dpr

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          // Derive candidate filter from current step's expected intersection
          // Resolve ElementSelectors to runtime IDs for filtering
          const curStep = currentStepRef.current
          const curExpected = curStep < proposition.steps.length
            ? proposition.steps[curStep].expected
            : null
          let candFilter: { ofA: string; ofB: string; beyondId?: string } | null = null
          if (curExpected?.type === 'intersection' && curExpected.ofA != null && curExpected.ofB != null) {
            const resolvedA = resolveSelector(curExpected.ofA, constructionRef.current)
            const resolvedB = resolveSelector(curExpected.ofB, constructionRef.current)
            if (resolvedA && resolvedB) {
              candFilter = { ofA: resolvedA, ofB: resolvedB, beyondId: curExpected.beyondId }
            }
          }
          const complete = curStep >= proposition.steps.length

          // Compute hidden elements during macro animation
          const hiddenIds = getHiddenElementIds(macroAnimationRef.current)

          renderConstruction(
            ctx,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            compassPhaseRef.current,
            straightedgePhaseRef.current,
            pointerWorldRef.current,
            snappedPointIdRef.current,
            candidatesRef.current,
            constructionRef.current.nextColorIndex,
            candFilter,
            complete,
            complete ? proposition.resultSegments : undefined,
            hiddenIds.size > 0 ? hiddenIds : undefined,
          )

          // Render equality tick marks on segments with proven equalities
          if (factStoreRef.current.facts.length > 0) {
            renderEqualityMarks(
              ctx,
              constructionRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              factStoreRef.current,
              hiddenIds.size > 0 ? hiddenIds : undefined,
              complete ? proposition.resultSegments : undefined,
            )
          }

          // Render measurements overlay (with fact store for formal equality)
          renderMeasurements(
            ctx,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            measurementsRef.current,
            rulerPhaseRef.current,
            snappedPointIdRef.current,
            pointerWorldRef.current,
            factStoreRef.current,
          )

          // Render tutorial hint on top
          renderTutorialHint(
            ctx,
            hint,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            candidatesRef.current,
            performance.now() / 1000,
          )

          ctx.restore()
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

  // ── Citation ordinals: track how many times each citation has appeared ──
  // 1st: full label + axiom text. 2nd: full label only. 3rd+: abbreviation.
  const citationOrdinals = useMemo(() => {
    const counts = new Map<string, number>()
    const ordinals = new Map<string, number>()

    for (let i = 0; i < proposition.steps.length; i++) {
      const step = proposition.steps[i]
      if (step.citation) {
        const n = (counts.get(step.citation) ?? 0) + 1
        counts.set(step.citation, n)
        ordinals.set(`step-${i}`, n)
      }
      for (const fact of (factsByStep.get(i) ?? [])) {
        const cd = citationDefFromFact(fact.citation)
        if (cd) {
          const n = (counts.get(cd.key) ?? 0) + 1
          counts.set(cd.key, n)
          ordinals.set(`fact-${fact.id}`, n)
        }
      }
    }
    for (const fact of (factsByStep.get(proposition.steps.length) ?? [])) {
      const cd = citationDefFromFact(fact.citation)
      if (cd) {
        const n = (counts.get(cd.key) ?? 0) + 1
        counts.set(cd.key, n)
        ordinals.set(`fact-${fact.id}`, n)
      }
    }
    return ordinals
  }, [proposition.steps, factsByStep])

  // Scroll the proof panel to keep current step visible
  const proofScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = proofScrollRef.current
    if (!container) return
    const active = container.querySelector('[data-step-current="true"]') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentStep])

  return (
    <div
      data-component="euclid-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* ── Left pane: Canvas ── */}
      <div
        ref={containerRef}
        data-element="canvas-pane"
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          data-element="euclid-canvas"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
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

        {/* Tool selector */}
        <div
          data-element="tool-selector"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            zIndex: 10,
          }}
        >
          <ToolButton
            label="Compass"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" />
                <path d="M12 6l-4 14" />
                <path d="M12 6l4 14" />
                <path d="M6 18a6 6 0 0 0 12 0" />
              </svg>
            }
            active={activeTool === 'compass'}
            onClick={() => setActiveTool('compass')}
          />
          <ToolButton
            label="Straightedge"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
            }
            active={activeTool === 'straightedge'}
            onClick={() => setActiveTool('straightedge')}
          />
          <ToolButton
            label="Ruler"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="8" x2="4" y2="16" />
                <line x1="20" y1="8" x2="20" y2="16" />
              </svg>
            }
            active={activeTool === 'ruler'}
            onClick={() => {
              if (activeTool === 'ruler') {
                measurementsRef.current = []
                rulerPhaseRef.current = { tag: 'idle' }
                setActiveTool(preRulerToolRef.current)
                needsDrawRef.current = true
              } else {
                if (activeTool === 'compass' || activeTool === 'straightedge') {
                  preRulerToolRef.current = activeTool
                }
                setActiveTool('ruler')
              }
            }}
          />
          <ToolButton
            label="Undo"
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M3 13a9 9 0 1 0 3-7.7L3 7" />
              </svg>
            }
            active={false}
            onClick={handleUndo}
          />
        </div>

        {/* Subtle "?" hint */}
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

        {/* Keyboard shortcuts overlay */}
        {showShortcuts && (
          <KeyboardShortcutsOverlay
            shortcuts={SHORTCUTS}
            onClose={() => setShowShortcuts(false)}
            isDark={false}
          />
        )}
      </div>

      {/* ── Right pane: Proof panel ── */}
      <div
        data-element="proof-panel"
        style={{
          width: 340,
          minWidth: 340,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#FAFAF0',
          borderLeft: '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        {/* Proposition header */}
        <div
          data-element="proof-header"
          style={{
            padding: '16px 20px 12px',
            borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
          }}
        >
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4,
            fontFamily: 'system-ui, sans-serif',
          }}>
            Proposition I.{proposition.id}
          </div>
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#334155',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {proposition.title}
          </div>
        </div>

        {/* Scrollable steps + proof chain */}
        <div
          ref={proofScrollRef}
          data-element="proof-steps"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '12px 20px',
          }}
        >
          {proposition.steps.map((step, i) => {
            const isDone = completedSteps[i]
            const isCurrent = i === currentStep && !isComplete
            const isFuture = !isDone && !isCurrent
            const stepFacts = factsByStep.get(i) ?? []

            return (
              <div
                key={i}
                data-element="proof-step"
                data-step-current={isCurrent ? 'true' : undefined}
                style={{
                  marginBottom: 16,
                  opacity: isFuture ? 0.35 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                {/* Step header: number + instruction + citation */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}>
                  {/* Step indicator */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    marginTop: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'system-ui, sans-serif',
                    background: isDone
                      ? '#10b981'
                      : isCurrent
                        ? '#4E79A7'
                        : '#e2e8f0',
                    color: isDone || isCurrent ? '#fff' : '#94a3b8',
                    transition: 'all 0.3s ease',
                  }}>
                    {isDone ? '\u2713' : i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Formal instruction */}
                    <div style={{
                      fontSize: 13,
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? '#1e293b' : '#475569',
                      fontFamily: 'Georgia, serif',
                      lineHeight: 1.4,
                    }}>
                      {step.instruction}
                    </div>

                    {/* Citation: progressive disclosure */}
                    {step.citation && (() => {
                      const cit = CITATIONS[step.citation]
                      const ord = citationOrdinals.get(`step-${i}`) ?? 1
                      const label = ord <= 2 ? (cit?.label ?? step.citation) : step.citation
                      const showText = ord === 1
                      return (
                        <div
                          data-element="citation-text"
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            lineHeight: 1.4,
                            color: isDone ? '#6b9b6b' : '#7893ab',
                            fontFamily: 'Georgia, serif',
                            fontStyle: 'italic',
                          }}
                        >
                          <span style={{
                            fontWeight: 600,
                            fontStyle: 'normal',
                            fontSize: 10,
                          }}>
                            {label}
                          </span>
                          {showText && cit?.text && (
                            <span style={{ marginLeft: 4 }}>
                              — {cit.text}
                            </span>
                          )}
                        </div>
                      )
                    })()}

                    {/* Tutorial guidance for current step */}
                    {isCurrent && currentInstruction && (
                      <div
                        data-element="step-guidance"
                        style={{
                          marginTop: 6,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: 'rgba(78, 121, 167, 0.06)',
                          border: '1px solid rgba(78, 121, 167, 0.15)',
                          fontSize: 12,
                          color: '#4E79A7',
                          fontFamily: 'system-ui, sans-serif',
                          lineHeight: 1.4,
                        }}
                      >
                        {currentInstruction}
                      </div>
                    )}

                    {/* Facts derived at this step */}
                    {stepFacts.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {stepFacts.map(fact => {
                          const factCit = citationDefFromFact(fact.citation)
                          const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
                          const citLabel = factCit
                            ? (ord <= 2 ? factCit.label : factCit.key)
                            : null
                          const showText = ord === 1 && factCit
                          const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
                          const highlighted = hoveredDpKeys != null && (
                            hoveredDpKeys.has(distancePairKey(fact.left)) ||
                            hoveredDpKeys.has(distancePairKey(fact.right))
                          )
                          return (
                            <div key={fact.id} style={{
                              fontSize: 11,
                              marginBottom: 3,
                              paddingLeft: 8,
                              borderLeft: highlighted
                                ? '2px solid #10b981'
                                : '2px solid rgba(78, 121, 167, 0.2)',
                              background: highlighted
                                ? 'rgba(16, 185, 129, 0.08)'
                                : 'transparent',
                              borderRadius: highlighted ? 2 : 0,
                              transition: 'all 0.15s ease',
                            }}>
                              <div>
                                <span style={{ color: '#4E79A7', fontWeight: 600, fontFamily: 'Georgia, serif' }}>
                                  {fact.statement}
                                </span>
                                {citLabel && (
                                  <span style={{
                                    color: '#94a3b8',
                                    fontFamily: 'Georgia, serif',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    marginLeft: 6,
                                  }}>
                                    [{citLabel}]
                                  </span>
                                )}
                              </div>
                              {showText && factCit?.text && (
                                <div style={{
                                  color: '#94a3b8',
                                  fontStyle: 'italic',
                                  fontFamily: 'Georgia, serif',
                                  fontSize: 10,
                                  lineHeight: 1.3,
                                  marginTop: 1,
                                }}>
                                  {factCit.text}
                                </div>
                              )}
                              <div style={{
                                color: '#94a3b8',
                                fontStyle: 'italic',
                                fontFamily: 'Georgia, serif',
                                fontSize: 10,
                                lineHeight: 1.3,
                                marginTop: 1,
                              }}>
                                {explanation}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Conclusion facts (atStep === steps.length) */}
          {(() => {
            const conclusionFacts = factsByStep.get(proposition.steps.length) ?? []
            if (conclusionFacts.length === 0 && !isComplete) return null
            return conclusionFacts.map(fact => {
              const factCit = citationDefFromFact(fact.citation)
              const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
              const citLabel = factCit
                ? (ord <= 2 ? factCit.label : factCit.key)
                : null
              const showText = ord === 1 && factCit
              const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
              const highlighted = hoveredDpKeys != null && (
                hoveredDpKeys.has(distancePairKey(fact.left)) ||
                hoveredDpKeys.has(distancePairKey(fact.right))
              )
              return (
                <div key={fact.id} style={{
                  fontSize: 11,
                  marginBottom: 3,
                  paddingLeft: 28,
                  marginLeft: 0,
                }}>
                  <div style={{
                    paddingLeft: 8,
                    borderLeft: highlighted
                      ? '2px solid #10b981'
                      : '2px solid rgba(16, 185, 129, 0.3)',
                    background: highlighted
                      ? 'rgba(16, 185, 129, 0.08)'
                      : 'transparent',
                    borderRadius: highlighted ? 2 : 0,
                    transition: 'all 0.15s ease',
                  }}>
                    <div>
                      <span style={{ color: '#4E79A7', fontWeight: 600, fontFamily: 'Georgia, serif' }}>
                        {fact.statement}
                      </span>
                      {citLabel && (
                        <span style={{
                          color: '#94a3b8',
                          fontFamily: 'Georgia, serif',
                          fontSize: 10,
                          fontWeight: 600,
                          marginLeft: 6,
                        }}>
                          [{citLabel}]
                        </span>
                      )}
                    </div>
                    {showText && factCit?.text && (
                      <div style={{
                        color: '#94a3b8',
                        fontStyle: 'italic',
                        fontFamily: 'Georgia, serif',
                        fontSize: 10,
                        lineHeight: 1.3,
                        marginTop: 1,
                      }}>
                        {factCit.text}
                      </div>
                    )}
                    <div style={{
                      color: '#94a3b8',
                      fontStyle: 'italic',
                      fontFamily: 'Georgia, serif',
                      fontSize: 10,
                      lineHeight: 1.3,
                      marginTop: 1,
                    }}>
                      {explanation}
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>

        {/* Conclusion bar — pinned at bottom, segments are hoverable */}
        {isComplete && completionResult && (
          <div
            data-element="proof-conclusion"
            style={{
              padding: '12px 20px',
              borderTop: completionResult.status === 'proven'
                ? '2px solid rgba(16, 185, 129, 0.4)'
                : '2px solid rgba(239, 68, 68, 0.4)',
              background: completionResult.status === 'proven'
                ? 'rgba(16, 185, 129, 0.06)'
                : 'rgba(239, 68, 68, 0.06)',
            }}
            onMouseLeave={() => setHoveredProofDp(null)}
          >
            {completionResult.status === 'proven' ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  color: '#10b981',
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: 'Georgia, serif',
                }}>
                  {'∴ '}
                  {completionResult.segments.map((seg, idx) => (
                    <span key={seg.label}>
                      {idx > 0 && (
                        <span style={{ fontWeight: 400, margin: '0 2px' }}> = </span>
                      )}
                      <span
                        data-element="conclusion-segment"
                        onMouseEnter={() => setHoveredProofDp(seg.dp)}
                        style={{
                          cursor: 'default',
                          borderBottom: hoveredDpKeys?.has(distancePairKey(seg.dp))
                            ? '2px solid #10b981'
                            : '2px solid transparent',
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        {seg.label}
                      </span>
                    </span>
                  ))}
                </span>
                <span style={{
                  color: '#10b981',
                  fontStyle: 'italic',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.02em',
                }}>
                  Q.E.F.
                </span>
              </div>
            ) : (
              <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 13, fontFamily: 'Georgia, serif' }}>
                Proof incomplete — could not establish equality for {completionResult.statement}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tool button component ──

interface ToolButtonProps {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function ToolButton({ label, icon, active, onClick }: ToolButtonProps) {
  return (
    <button
      data-action={`tool-${label.toLowerCase()}`}
      onClick={onClick}
      title={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        border: active ? '2px solid #4E79A7' : '1px solid rgba(203, 213, 225, 0.8)',
        background: active ? 'rgba(78, 121, 167, 0.1)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        color: active ? '#4E79A7' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </button>
  )
}
