import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
  GhostLayer,
  PropositionStep,
  MacroPhase,
  ActiveTool,
  SuperpositionPhase,
} from '../types'
import type { ProofFact } from '../engine/facts'
import type { FactStore } from '../engine/factStore'
import { rebuildFactStore } from '../engine/factStore'
import { captureSnapshot } from '../engine/snapshots'
import type { ProofSnapshot } from '../engine/snapshots'
import { validateStep } from '../propositions/validation'
import { findNewIntersections } from '../engine/intersections'
import { MACRO_REGISTRY } from '../engine/macros'
import type { ToolPhaseManager } from '../interaction/useToolPhaseManager'

const WRONG_MOVE_PHRASES = [
  "Not quite. Let's try that step again.",
  "Hmm, that's not right. Try again.",
  "That's not it. Here's the step one more time:",
  'Oops! Let me remind you:',
]

export interface TutorialController {
  /**
   * Validate an element against the expected action at the current step.
   * Returns 'advanced' if the step was correct and advanced, 'corrected' if wrong.
   */
  checkStep: (
    element: ConstructionElement,
    candidate?: IntersectionCandidate
  ) => 'advanced' | 'corrected'

  /**
   * Advance past an observation step (no canvas interaction needed).
   */
  advanceObservation: () => void

  /**
   * Trigger a correction: revert state to the snapshot at the given step,
   * narrate wrong-move feedback, and lock interactions during narration.
   */
  triggerCorrection: (step: number) => void

  /**
   * Rewind to a previous step (restoring all state from the snapshot stack).
   */
  handleRewindToStep: (targetStep: number) => void
}

export interface UseTutorialControllerOptions {
  steps: PropositionStep[]
  extendSegments: boolean

  // Refs owned by the composition root but read/written by the controller
  currentStepRef: MutableRefObject<number>
  snapshotStackRef: MutableRefObject<ProofSnapshot[]>
  resolvedStepOverridesRef: MutableRefObject<Map<number, Partial<PropositionStep>>>
  resolvedTutorialRef: MutableRefObject<Map<number, import('../types').TutorialSubStep[]>>
  stepDataRef: MutableRefObject<Map<number, Record<string, unknown>>>

  // Mutable refs the controller reads/writes
  constructionRef: MutableRefObject<ConstructionState>
  candidatesRef: MutableRefObject<IntersectionCandidate[]>
  proofFactsRef: MutableRefObject<ProofFact[]>
  ghostLayersRef: MutableRefObject<GhostLayer[]>
  factStoreRef: MutableRefObject<FactStore>
  isCompleteRef: MutableRefObject<boolean>

  // Animation/tool refs the controller needs to clear on correction/rewind
  straightedgeDrawAnimRef: MutableRefObject<unknown>
  macroAnimationRef: MutableRefObject<unknown>
  macroRevealRef: MutableRefObject<unknown>
  superpositionFlashRef: MutableRefObject<unknown>
  citationFlashesRef: MutableRefObject<unknown[]>
  ghostOpacitiesRef: MutableRefObject<Map<string, number>>
  postCompletionActionsRef: MutableRefObject<unknown[]>
  correctionActiveRef: MutableRefObject<boolean>

  // Superposition interaction
  superpositionPhaseRef?: MutableRefObject<SuperpositionPhase>
  superpositionCascadeTimersRef?: MutableRefObject<ReturnType<typeof setTimeout>[]>

  // Tool phase manager
  toolPhases: ToolPhaseManager

  // Audio
  audioEnabledRef: MutableRefObject<boolean>
  currentSpeechRef: MutableRefObject<string>
  speakStepCorrectionRef: MutableRefObject<(opts: { say: { en: string } }) => Promise<void>>

  // Proposition (for resolveStep, resolveTutorialStep)
  proposition: import('../types').PropositionDef

  // Tutorial advancement sub-step refs (cleared on rewind)
  tutorialSubStepRef: MutableRefObject<number>
  prevCompassTagRef: MutableRefObject<string>
  prevStraightedgeTagRef: MutableRefObject<string>

  // State setters
  setCurrentStep: (step: number) => void
  setCompletedSteps: React.Dispatch<React.SetStateAction<boolean[]>>
  setIsComplete: (v: boolean) => void
  setProofFacts: (v: ProofFact[]) => void
  setTutorialSubStep: (v: number) => void
  requestDraw: () => void
}

export function useTutorialController(opts: UseTutorialControllerOptions): TutorialController {
  const {
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
  } = opts

  const wrongMoveCounterRef = useRef(0)

  // Keep a ref to steps to avoid stale closures
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  const triggerCorrection = useCallback(
    (step: number) => {
      const snapshot = snapshotStackRef.current[step]
      if (!snapshot) return

      // Revert construction state to what it was before the wrong action
      constructionRef.current = snapshot.construction
      candidatesRef.current = snapshot.candidates
      proofFactsRef.current = snapshot.proofFacts
      setProofFacts(snapshot.proofFacts)
      ghostLayersRef.current = snapshot.ghostLayers
      factStoreRef.current = rebuildFactStore(snapshot.proofFacts)

      // Clear any ongoing draw animations
      straightedgeDrawAnimRef.current = null
      macroAnimationRef.current = null
      macroRevealRef.current = null

      // Reset superposition interaction
      if (superpositionPhaseRef) superpositionPhaseRef.current = { tag: 'idle' }
      if (superpositionCascadeTimersRef) {
        for (const t of superpositionCascadeTimersRef.current) clearTimeout(t)
        superpositionCascadeTimersRef.current = []
      }

      // Reset tool phases so no in-flight gesture survives the revert
      toolPhases.resetAll()

      // Lock all tool interactions for the duration of the correction narration
      correctionActiveRef.current = true

      const phrase = WRONG_MOVE_PHRASES[wrongMoveCounterRef.current++ % WRONG_MOVE_PHRASES.length]
      const stepOverrides = resolvedStepOverridesRef.current.get(step)
      const instruction =
        currentSpeechRef.current || stepOverrides?.instruction || stepsRef.current[step].instruction

      const unlock = () => {
        correctionActiveRef.current = false
        // Re-initialize the macro selecting phase if the step expects a macro.
        // The step-sync useEffect won't re-fire because currentStep didn't change.
        const stepDef = stepsRef.current[step]
        if (stepDef?.tool === 'macro' && stepDef.expected.type === 'macro') {
          const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
          if (macroDef) {
            toolPhases.enterMacroSelecting(stepDef.expected.propId, macroDef.inputs)
          }
        }
      }

      if (audioEnabledRef.current) {
        speakStepCorrectionRef
          .current({ say: { en: phrase } })
          .then(() => speakStepCorrectionRef.current({ say: { en: instruction } }))
          .finally(unlock)
      } else {
        setTimeout(unlock, 1200)
      }

      requestDraw()
    },
    [
      constructionRef,
      candidatesRef,
      proofFactsRef,
      ghostLayersRef,
      factStoreRef,
      straightedgeDrawAnimRef,
      macroAnimationRef,
      macroRevealRef,
      correctionActiveRef,
      toolPhases,
      audioEnabledRef,
      currentSpeechRef,
      speakStepCorrectionRef,
      setProofFacts,
      requestDraw,
    ]
  )

  const checkStep = useCallback(
    (element: ConstructionElement, candidate?: IntersectionCandidate): 'advanced' | 'corrected' => {
      const step = currentStepRef.current
      if (step >= stepsRef.current.length) return 'advanced'

      const stepDef = stepsRef.current[step]
      // Use resolved override if available (for adaptive steps like Prop 5)
      const overrides = resolvedStepOverridesRef.current.get(step)
      const effectiveExpected = overrides?.expected ?? stepDef.expected
      const valid = validateStep(effectiveExpected, constructionRef.current, element, candidate)
      console.log(
        '[checkStep] step=%d valid=%s expected=%o element=%o',
        step,
        valid,
        effectiveExpected,
        { kind: element.kind, id: element.id }
      )
      if (valid) {
        // Capture snapshot before advancing — state after this step completes
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
          next[step] = true
          return next
        })
        const nextStep = step + 1
        currentStepRef.current = nextStep
        if (nextStep >= stepsRef.current.length) {
          setIsComplete(true)
          // Recompute candidates with segment extension for post-completion play
          if (!extendSegments) {
            let updatedCandidates = [...candidatesRef.current]
            for (const el of constructionRef.current.elements) {
              if (el.kind === 'point') continue
              const additional = findNewIntersections(
                constructionRef.current,
                el,
                updatedCandidates,
                true
              )
              updatedCandidates = [...updatedCandidates, ...additional]
            }
            candidatesRef.current = updatedCandidates
          }
        }
        setCurrentStep(nextStep)
        return 'advanced'
      } else {
        triggerCorrection(step)
        return 'corrected'
      }
    },
    [
      constructionRef,
      candidatesRef,
      proofFactsRef,
      ghostLayersRef,
      extendSegments,
      setCompletedSteps,
      setCurrentStep,
      setIsComplete,
      triggerCorrection,
    ]
  )

  const advanceObservation = useCallback(() => {
    const step = currentStepRef.current
    if (step >= stepsRef.current.length) return
    const stepDef = stepsRef.current[step]
    if (stepDef.expected.type !== 'observation') return

    // Capture snapshot before advancing
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
      next[step] = true
      return next
    })
    const nextStep = step + 1
    currentStepRef.current = nextStep
    if (nextStep >= stepsRef.current.length) {
      setIsComplete(true)
    }
    setCurrentStep(nextStep)
  }, [
    constructionRef,
    candidatesRef,
    proofFactsRef,
    ghostLayersRef,
    setCompletedSteps,
    setCurrentStep,
    setIsComplete,
  ])

  const handleRewindToStep = useCallback(
    (targetStep: number) => {
      const snapshot = snapshotStackRef.current[targetStep]
      if (!snapshot) return

      // 1. Reset all tool phases to idle, clear animations
      toolPhases.resetAll()
      macroAnimationRef.current = null
      macroRevealRef.current = null
      superpositionFlashRef.current = null
      citationFlashesRef.current = []
      postCompletionActionsRef.current = []

      // Reset superposition interaction
      if (superpositionPhaseRef) superpositionPhaseRef.current = { tag: 'idle' }
      if (superpositionCascadeTimersRef) {
        for (const t of superpositionCascadeTimersRef.current) clearTimeout(t)
        superpositionCascadeTimersRef.current = []
      }

      // 2. Restore construction, candidates, proofFacts, ghostLayers from snapshot
      constructionRef.current = snapshot.construction
      candidatesRef.current = snapshot.candidates
      proofFactsRef.current = snapshot.proofFacts
      setProofFacts(snapshot.proofFacts)
      ghostLayersRef.current = snapshot.ghostLayers
      ghostOpacitiesRef.current = new Map()

      // 3. Rebuild factStore via rebuildFactStore
      factStoreRef.current = rebuildFactStore(snapshot.proofFacts)

      // 4. Truncate snapshot stack to [0..targetStep]
      snapshotStackRef.current = snapshotStackRef.current.slice(0, targetStep + 1)

      // 5. Set currentStep, reset completedSteps from targetStep onward
      currentStepRef.current = targetStep
      setCurrentStep(targetStep)
      setCompletedSteps((prev) => {
        const next = [...prev]
        for (let i = targetStep; i < next.length; i++) {
          next[i] = false
        }
        return next
      })
      setIsComplete(false)

      // 6. Reset tutorial sub-step
      tutorialSubStepRef.current = 0
      setTutorialSubStep(0)
      prevCompassTagRef.current = 'idle'
      prevStraightedgeTagRef.current = 'idle'

      // 7. Clear resolved step/tutorial overrides for steps at and after the target
      for (const key of resolvedStepOverridesRef.current.keys()) {
        if (key >= targetStep) resolvedStepOverridesRef.current.delete(key)
      }
      for (const key of resolvedTutorialRef.current.keys()) {
        if (key >= targetStep) resolvedTutorialRef.current.delete(key)
      }
      // Clear step data for steps at and after the target
      for (const key of stepDataRef.current.keys()) {
        if (key >= targetStep) stepDataRef.current.delete(key)
      }

      // 8. Sync tool/expectedAction refs for the new current step
      if (targetStep < stepsRef.current.length) {
        // Re-resolve step if proposition has resolveStep
        if (proposition.resolveStep && targetStep >= 2) {
          const override = proposition.resolveStep(
            targetStep,
            constructionRef.current,
            stepDataRef.current
          )
          if (override) {
            resolvedStepOverridesRef.current.set(targetStep, override as Partial<PropositionStep>)
          }
        }
      }

      requestDraw()
    },
    [
      constructionRef,
      candidatesRef,
      proofFactsRef,
      ghostLayersRef,
      factStoreRef,
      ghostOpacitiesRef,
      macroAnimationRef,
      macroRevealRef,
      superpositionFlashRef,
      citationFlashesRef,
      postCompletionActionsRef,
      toolPhases,
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
    ]
  )

  return {
    checkStep,
    advanceObservation,
    triggerCorrection,
    handleRewindToStep,
  }
}
