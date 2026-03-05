import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type {
  ConstructionState,
  IntersectionCandidate,
  GhostLayer,
  PropositionStep,
  MacroCeremonyState,
  ConstructionElement,
} from '../types'
import type { ProofFact } from '../engine/facts'
import type { FactStore } from '../engine/factStore'
import type { PostCompletionAction } from '../engine/replayConstruction'
import type { StraightedgeDrawAnim } from '../render/renderToolOverlay'
import type { CitationFlashInit } from '../render/renderCitationFlash'
import type { MacroAnimation } from '../engine/macroExecution'
import type { EuclidViewportState } from '../types'
import type { ToolPhaseManager } from '../interaction/useToolPhaseManager'
import type { UseEuclidMusicReturn } from '../audio/useEuclidMusic'
import {
  addPoint,
  addCircle,
  addSegment,
  getPoint,
} from '../engine/constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from '../engine/intersections'
import { deriveDef15Facts } from '../engine/factDerivation'
import { resolveSelector } from '../engine/selectors'
import { MACRO_REGISTRY } from '../engine/macros'
import { createMacroAnimation } from '../engine/macroExecution'
import { captureSnapshot } from '../engine/snapshots'
import { CITATIONS } from '../engine/citations'
import { PROP_REGISTRY } from '../propositions/registry'

export interface ConstructionCommandsReturn {
  handleCommitCircle: (centerId: string, radiusPointId: string) => void
  handleCommitSegment: (fromId: string, toId: string) => void
  handleCommitExtend: (
    baseId: string,
    throughId: string,
    projX: number,
    projY: number
  ) => void
  handleMarkIntersection: (candidate: IntersectionCandidate) => void
  handleCommitMacro: (propId: number, inputPointIds: string[]) => void
  handlePlaceFreePoint: (worldX: number, worldY: number) => void
}

export interface UseConstructionCommandsOptions {
  // Step/tutorial
  steps: PropositionStep[]
  extendSegments: boolean
  currentStepRef: MutableRefObject<number>
  resolvedStepOverridesRef: MutableRefObject<
    Map<number, Partial<PropositionStep>>
  >
  snapshotStackRef: MutableRefObject<
    import('../engine/snapshots').ProofSnapshot[]
  >
  stepDataRef: MutableRefObject<Map<number, Record<string, unknown>>>

  // Construction state refs
  constructionRef: MutableRefObject<ConstructionState>
  candidatesRef: MutableRefObject<IntersectionCandidate[]>
  proofFactsRef: MutableRefObject<ProofFact[]>
  factStoreRef: MutableRefObject<FactStore>
  ghostLayersRef: MutableRefObject<GhostLayer[]>
  isCompleteRef: MutableRefObject<boolean>
  postCompletionActionsRef: MutableRefObject<PostCompletionAction[]>

  // Animation refs
  viewportRef: MutableRefObject<EuclidViewportState>
  straightedgeDrawAnimRef: MutableRefObject<StraightedgeDrawAnim | null>
  macroAnimationRef: MutableRefObject<MacroAnimation | null>
  macroRevealRef: MutableRefObject<MacroCeremonyState | null>
  ghostOpacitiesRef: MutableRefObject<Map<string, number>>
  correctionActiveRef: MutableRefObject<boolean>

  // Tool phases
  toolPhases: ToolPhaseManager

  // Available macros (for re-entering macro selecting after free-form)
  availableMacros: Array<{
    propId: number
    def: { inputs: import('../engine/macros').MacroInput[] }
  }>

  // Given-setup mode
  givenSetupActiveRef: MutableRefObject<boolean>
  givenSetup: {
    addSegment: (fromId: string, toId: string) => void
    addPoint: (x: number, y: number) => void
  }

  // Audio
  audioEnabledRef: MutableRefObject<boolean>
  speakStepCorrectionRef: MutableRefObject<
    (opts: { say: { en: string } }) => Promise<void>
  >
  musicRef: MutableRefObject<UseEuclidMusicReturn | null>

  // Notifier
  notifierRef: MutableRefObject<{
    notifyConstruction: (opts: {
      action: string
      shouldPrompt: boolean
    }) => void
  }>

  // Tutorial callbacks
  checkStep: (
    element: ConstructionElement,
    candidate?: IntersectionCandidate
  ) => 'advanced' | 'corrected'
  triggerCorrection: (step: number) => void

  // Side effect callbacks (composition root provides)
  pushCitationFlash: (init: CitationFlashInit) => void
  requestDraw: () => void
  setCeremonyLabel: (label: string | null) => void
  setProofFacts: (v: ProofFact[]) => void
  setCompletedSteps: React.Dispatch<React.SetStateAction<boolean[]>>
  setCurrentStep: (step: number) => void
  setIsComplete: (v: boolean) => void

  // Straightedge phase ref (for given-setup segment reset)
  straightedgePhaseRef: MutableRefObject<{ tag: string }>
}

export function useConstructionCommands(
  opts: UseConstructionCommandsOptions
): ConstructionCommandsReturn {
  const {
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
  } = opts

  // Keep refs to avoid stale closures
  const stepsRef = { current: steps }

  const handleCommitCircle = useCallback(
    (centerId: string, radiusPointId: string) => {
      const result = addCircle(constructionRef.current, centerId, radiusPointId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.circle,
        candidatesRef.current,
        extendSegments || isCompleteRef.current
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'circle', centerId, radiusPointId },
        ]
      }

      checkStep(result.circle)
      requestDraw()
      musicRef.current?.notifyChange()

      // Citation flash at circle
      const centerPt = getPoint(result.state, centerId)
      const radiusPt = getPoint(result.state, radiusPointId)
      if (centerPt && radiusPt) {
        const dx = radiusPt.x - centerPt.x
        const dy = radiusPt.y - centerPt.y
        pushCitationFlash({
          type: 'circle',
          citation: 'Post.3',
          centerX: centerPt.x,
          centerY: centerPt.y,
          radius: Math.sqrt(dx * dx + dy * dy),
        })
      }

      const cLabel =
        getPoint(result.state, centerId)?.label ??
        centerId.replace(/^pt-/, '')
      const rLabel =
        getPoint(result.state, radiusPointId)?.label ??
        radiusPointId.replace(/^pt-/, '')
      notifierRef.current.notifyConstruction({
        action: `Drew circle centered at ${cLabel} through ${rLabel}`,
        shouldPrompt: true,
      })
    },
    [
      constructionRef,
      candidatesRef,
      isCompleteRef,
      postCompletionActionsRef,
      extendSegments,
      checkStep,
      requestDraw,
      musicRef,
      pushCitationFlash,
      notifierRef,
    ]
  )

  const handleCommitSegment = useCallback(
    (fromId: string, toId: string) => {
      // Given-setup mode: add a given segment instead
      if (givenSetupActiveRef.current) {
        givenSetup.addSegment(fromId, toId)
        // Reset straightedge phase so the tool is ready for next segment
        straightedgePhaseRef.current = { tag: 'idle' }
        requestDraw()
        return
      }
      const result = addSegment(constructionRef.current, fromId, toId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.segment,
        candidatesRef.current,
        extendSegments || isCompleteRef.current
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // Start drawing animation — progressive line reveal
      const fromPt = getPoint(result.state, fromId)
      const toPt = getPoint(result.state, toId)
      if (fromPt && toPt) {
        const dx = toPt.x - fromPt.x
        const dy = toPt.y - fromPt.y
        const worldDist = Math.sqrt(dx * dx + dy * dy)
        const screenDist = worldDist * viewportRef.current.pixelsPerUnit
        const duration = Math.max(500, Math.min(2000, screenDist * 5))
        straightedgeDrawAnimRef.current = {
          segmentId: result.segment.id,
          fromId,
          toId,
          color: result.segment.color,
          startTime: performance.now(),
          duration,
        }
      }

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'segment', fromId, toId },
        ]
      }

      checkStep(result.segment)
      requestDraw()
      musicRef.current?.notifyChange()

      // Citation flash along segment
      const fromPtFlash = getPoint(result.state, fromId)
      const toPtFlash = getPoint(result.state, toId)
      if (fromPtFlash && toPtFlash) {
        pushCitationFlash({
          type: 'segment',
          citation: 'Post.1',
          fromX: fromPtFlash.x,
          fromY: fromPtFlash.y,
          toX: toPtFlash.x,
          toY: toPtFlash.y,
        })
      }

      const fLabel =
        getPoint(result.state, fromId)?.label ?? fromId.replace(/^pt-/, '')
      const tLabel =
        getPoint(result.state, toId)?.label ?? toId.replace(/^pt-/, '')
      notifierRef.current.notifyConstruction({
        action: `Drew segment from ${fLabel} to ${tLabel}`,
        shouldPrompt: true,
      })
    },
    [
      constructionRef,
      candidatesRef,
      isCompleteRef,
      postCompletionActionsRef,
      viewportRef,
      straightedgeDrawAnimRef,
      straightedgePhaseRef,
      extendSegments,
      givenSetupActiveRef,
      givenSetup,
      checkStep,
      requestDraw,
      musicRef,
      pushCitationFlash,
      notifierRef,
    ]
  )

  const handleCommitExtend = useCallback(
    (baseId: string, throughId: string, projX: number, projY: number) => {
      const step = currentStepRef.current
      // Get effective expected action (may be overridden by resolveStep)
      const effectiveExpected =
        step < stepsRef.current.length
          ? (resolvedStepOverridesRef.current.get(step)?.expected ??
              stepsRef.current[step].expected)
          : null
      const isGuidedExtend = effectiveExpected?.type === 'extend'

      const basePt = getPoint(constructionRef.current, baseId)
      const throughPt = getPoint(constructionRef.current, throughId)
      if (!basePt || !throughPt) return

      const dx = throughPt.x - basePt.x
      const dy = throughPt.y - basePt.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 0.001) return

      let newX: number, newY: number, label: string | undefined
      if (isGuidedExtend) {
        const expected = effectiveExpected as Extract<
          import('../types').ExpectedAction,
          { type: 'extend' }
        >

        // Validate that the user is extending the correct segment
        if (baseId !== expected.baseId || throughId !== expected.throughId) {
          triggerCorrection(step)
          return
        }

        if (expected.distance != null) {
          // Fixed distance: use expected.distance along the ray
          const dirX = dx / len
          const dirY = dy / len
          newX = throughPt.x + dirX * expected.distance
          newY = throughPt.y + dirY * expected.distance
        } else {
          // Free extend: use cursor position, enforce minimum distance
          const dirX = dx / len
          const dirY = dy / len
          const toX = projX - throughPt.x
          const toY = projY - throughPt.y
          const proj = toX * dirX + toY * dirY
          const clampedDist = Math.max(0.2, proj) // minimum 0.2 units
          newX = throughPt.x + dirX * clampedDist
          newY = throughPt.y + dirY * clampedDist

          // Record the user-chosen distance in stepData for replay
          const actualDist = clampedDist
          stepDataRef.current.set(step, { distance: actualDist })
        }
        label = expected.label
      } else {
        // Free-form: use the actual projected cursor position
        newX = projX
        newY = projY
      }

      // Free-form extends get 'extend' origin (draggable); guided keeps 'intersection'
      const ptOrigin = isGuidedExtend ? 'intersection' : 'extend'
      const ptResult = addPoint(
        constructionRef.current,
        newX,
        newY,
        ptOrigin,
        label
      )
      constructionRef.current = ptResult.state

      const segResult = addSegment(
        constructionRef.current,
        throughId,
        ptResult.point.id
      )
      constructionRef.current = segResult.state

      const ptCands = findNewIntersections(
        constructionRef.current,
        ptResult.point,
        candidatesRef.current,
        extendSegments
      )
      const segCands = findNewIntersections(
        constructionRef.current,
        segResult.segment,
        [...candidatesRef.current, ...ptCands],
        extendSegments
      )
      candidatesRef.current = [
        ...candidatesRef.current,
        ...ptCands,
        ...segCands,
      ]

      if (isGuidedExtend) {
        checkStep(ptResult.point)
      }
      requestDraw()

      // Citation flash along extended segment
      pushCitationFlash({
        type: 'extend',
        citation: 'Post.2',
        throughX: throughPt.x,
        throughY: throughPt.y,
        endX: newX,
        endY: newY,
      })

      const throughLabel =
        getPoint(constructionRef.current, throughId)?.label ??
        throughId.replace(/^pt-/, '')
      const newLabel = ptResult.point.label
      notifierRef.current.notifyConstruction({
        action: `Extended line through ${throughLabel} to new point ${newLabel}`,
        shouldPrompt: true,
      })

      // Record in post-completion actions for free-form extends
      if (!isGuidedExtend) {
        // Compute distance from throughPt to the new point along the ray
        const eDx = newX - throughPt.x
        const eDy = newY - throughPt.y
        const extendDistance = Math.sqrt(eDx * eDx + eDy * eDy)

        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          {
            type: 'extend' as const,
            baseId,
            throughId,
            pointId: ptResult.point.id,
            segmentId: segResult.segment.id,
            distance: extendDistance,
          },
        ]
      }
    },
    [
      steps,
      constructionRef,
      candidatesRef,
      postCompletionActionsRef,
      currentStepRef,
      resolvedStepOverridesRef,
      stepDataRef,
      extendSegments,
      checkStep,
      triggerCorrection,
      requestDraw,
      pushCitationFlash,
      notifierRef,
    ]
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      // In guided mode, reject candidates that don't match the current step's expected ofA/ofB.
      const step = currentStepRef.current
      let explicitLabel: string | undefined
      if (step < stepsRef.current.length) {
        const expected = stepsRef.current[step].expected
        if (expected.type === 'intersection') {
          explicitLabel = expected.label
          if (expected.ofA != null && expected.ofB != null) {
            const resolvedA = resolveSelector(
              expected.ofA,
              constructionRef.current
            )
            const resolvedB = resolveSelector(
              expected.ofB,
              constructionRef.current
            )
            if (!resolvedA || !resolvedB) return
            const matches =
              (candidate.ofA === resolvedA && candidate.ofB === resolvedB) ||
              (candidate.ofA === resolvedB && candidate.ofB === resolvedA)
            if (!matches) {
              if (
                !correctionActiveRef.current &&
                audioEnabledRef.current
              ) {
                speakStepCorrectionRef.current({
                  say: {
                    en: "That's not the intersection we need. Try a different one.",
                  },
                })
              }
              return
            }
            // If beyondId is specified, reject candidates on the wrong side
            if (expected.beyondId) {
              if (
                !isCandidateBeyondPoint(
                  candidate,
                  expected.beyondId,
                  candidate.ofA,
                  candidate.ofB,
                  constructionRef.current
                )
              ) {
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
        explicitLabel
      )
      constructionRef.current = result.state

      candidatesRef.current = candidatesRef.current.filter(
        (c) =>
          !(
            Math.abs(c.x - candidate.x) < 0.001 &&
            Math.abs(c.y - candidate.y) < 0.001
          )
      )

      // Derive Def.15 facts for intersection points on circles
      const newFacts = deriveDef15Facts(
        candidate,
        result.point.id,
        constructionRef.current,
        factStoreRef.current,
        step
      )
      if (newFacts.length > 0) {
        proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
        setProofFacts(proofFactsRef.current)
      }

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          {
            type: 'intersection',
            ofA: candidate.ofA,
            ofB: candidate.ofB,
            which: candidate.which,
          },
        ]
      }

      checkStep(result.point, candidate)
      requestDraw()
      musicRef.current?.notifyIntersection(candidate.x, candidate.y)
      musicRef.current?.notifyChange()

      notifierRef.current.notifyConstruction({
        action: `Marked intersection point ${result.point.label}`,
        shouldPrompt: true,
      })
    },
    [
      steps,
      constructionRef,
      candidatesRef,
      proofFactsRef,
      factStoreRef,
      isCompleteRef,
      postCompletionActionsRef,
      currentStepRef,
      correctionActiveRef,
      audioEnabledRef,
      speakStepCorrectionRef,
      checkStep,
      requestDraw,
      musicRef,
      setProofFacts,
      notifierRef,
    ]
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const step = currentStepRef.current
      const overrides = resolvedStepOverridesRef.current.get(step)
      const expected =
        step < stepsRef.current.length
          ? (overrides?.expected ?? stepsRef.current[step].expected)
          : null

      // A macro application is "guided" when the current step expects this exact proposition
      // AND the input points match the expected inputs (in order).
      const isGuidedStep =
        expected?.type === 'macro' &&
        expected.propId === propId &&
        expected.inputPointIds.length === inputPointIds.length &&
        expected.inputPointIds.every((id, i) => id === inputPointIds[i])
      const outputLabels =
        isGuidedStep && expected?.type === 'macro'
          ? expected.outputLabels
          : undefined

      console.log(
        '[commit-macro] propId=%d inputs=%o step=%d expected=%o isGuidedStep=%s expectedInputs=%o',
        propId,
        inputPointIds,
        step,
        expected,
        isGuidedStep,
        expected?.type === 'macro' ? expected.inputPointIds : 'N/A'
      )

      // Execute the macro — state is computed all at once
      const result = macroDef.execute(
        constructionRef.current,
        inputPointIds,
        candidatesRef.current,
        factStoreRef.current,
        step,
        extendSegments,
        outputLabels
      )

      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      if (result.newFacts.length > 0) {
        proofFactsRef.current = [
          ...proofFactsRef.current,
          ...result.newFacts,
        ]
        setProofFacts(proofFactsRef.current)
      }

      // Citation flash at centroid of input points
      const citationKey = `I.${propId}`
      if (CITATIONS[citationKey]) {
        const inputPts = inputPointIds
          .map((id) => getPoint(constructionRef.current, id))
          .filter(Boolean) as { x: number; y: number }[]
        if (inputPts.length > 0) {
          const cx =
            inputPts.reduce((s, p) => s + p.x, 0) / inputPts.length
          const cy =
            inputPts.reduce((s, p) => s + p.y, 0) / inputPts.length
          pushCitationFlash({
            type: 'point',
            citation: citationKey,
            worldX: cx,
            worldY: cy,
          })
        }
      }

      notifierRef.current.notifyConstruction({
        action: `Applied Proposition I.${propId}`,
        shouldPrompt: true,
      })

      if (!isGuidedStep) {
        if (!isCompleteRef.current) {
          // Wrong macro during guided steps — revert and narrate.
          triggerCorrection(step)
          return
        }
        // Free-form path (post-completion) — apply without ceremony.
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          {
            type: 'macro' as const,
            propId,
            inputPointIds,
            atStep: step,
          },
        ]

        // Add ghost layers immediately (no ceremony in free-form)
        const macroGhosts = result.ghostLayers.map((gl) => ({
          ...gl,
          atStep: step,
        }))
        ghostLayersRef.current = [
          ...ghostLayersRef.current,
          ...macroGhosts,
        ]
        macroAnimationRef.current = createMacroAnimation(result)
        if (availableMacros.length === 1) {
          const { propId: mpId, def: mDef } = availableMacros[0]
          toolPhases.enterMacroSelecting(mpId, mDef.inputs)
        } else {
          toolPhases.enterMacroChoosing()
        }
        requestDraw()
        musicRef.current?.notifyChange()
        return
      }

      // ── Guided path ───────────────────────────────────────────────
      const macroGhosts = result.ghostLayers.map((gl) => ({
        ...gl,
        atStep: step,
      }))
      if (macroGhosts.length > 0) {
        ghostLayersRef.current = [
          ...ghostLayersRef.current,
          ...macroGhosts,
        ]
      }

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

      // Check if any ghost layers have revealGroups (ceremony needed)
      const hasCeremony = macroGhosts.some(
        (gl) => gl.revealGroups && gl.revealGroups.length > 0
      )

      // Build the step-advance closure.
      const stepToAdvance = step
      const doAdvanceStep = () => {
        const nextSt = stepToAdvance + 1
        setCompletedSteps((prev) => {
          const next = [...prev]
          next[stepToAdvance] = true
          return next
        })
        currentStepRef.current = nextSt
        if (nextSt >= stepsRef.current.length) {
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
        setCurrentStep(nextSt)
        // Start macro animation — elements appear after ghost ceremony
        macroAnimationRef.current = createMacroAnimation(result)
        setCeremonyLabel(null)
        musicRef.current?.notifyChange()
      }

      if (hasCeremony) {
        // Animation durations by element type
        const elemAnimDurationMs = (
          el: GhostLayer['elements'][number]
        ): number => {
          if (el.kind === 'circle') return 700
          if (el.kind === 'segment') return 400
          return 0
        }

        // Sort layers deepest-first
        const sorted = [...macroGhosts].sort((a, b) => b.depth - a.depth)

        // Depth-1 layers were already visible as the live preview — pre-reveal them
        const preRevealedLayers = new Map<string, number>()
        for (const layer of macroGhosts) {
          if (layer.depth === 1) {
            const key = `${layer.atStep}:${layer.depth}`
            const groupCount = layer.revealGroups?.length ?? 1
            preRevealedLayers.set(key, groupCount)
            ghostOpacitiesRef.current.set(key, 0.35)
          }
        }

        // Build timed sequence only for deeper layers (depth > 1)
        const sequence: Array<{
          layerKey: string
          groupIndex: number
          msDelay: number
        }> = []
        let lastGroupMaxDurationMs = 0
        for (const layer of sorted) {
          if (layer.depth === 1) continue
          const key = `${layer.atStep}:${layer.depth}`
          const groupCount = layer.revealGroups?.length ?? 1
          for (let g = 0; g < groupCount; g++) {
            const msDelay =
              sequence.length === 0 ? 400 : lastGroupMaxDurationMs + 200
            sequence.push({ layerKey: key, groupIndex: g + 1, msDelay })
            const group = layer.revealGroups?.[g]
            lastGroupMaxDurationMs = group
              ? Math.max(
                  0,
                  ...group.map((idx) =>
                    elemAnimDurationMs(layer.elements[idx])
                  )
                )
              : 400
          }
        }
        const depth1Layer = macroGhosts.find((gl) => gl.depth === 1)
        const narrationText = depth1Layer?.keyNarration ?? ''
        const propTitle = PROP_REGISTRY[propId]?.title ?? ''
        setCeremonyLabel(
          `Applying I.${propId}${propTitle ? ` · ${propTitle}` : ''}`
        )

        macroRevealRef.current = {
          sequence,
          revealed: 0,
          lastRevealMs: performance.now(),
          narrationText,
          narrationFired: false,
          allShownMs: sequence.length === 0 ? performance.now() : null,
          postNarrationDelayMs: 1200,
          advanceStep: doAdvanceStep,
          preRevealedLayers,
          elementAnims: new Map(),
          hiddenElementIds: new Set(
            result.addedElements.map((e) => e.id)
          ),
        }
      } else {
        // No ceremony — advance step and start animation immediately
        macroAnimationRef.current = createMacroAnimation(result)
        doAdvanceStep()
      }

      requestDraw()
    },
    [
      steps,
      extendSegments,
      constructionRef,
      candidatesRef,
      proofFactsRef,
      factStoreRef,
      ghostLayersRef,
      isCompleteRef,
      postCompletionActionsRef,
      currentStepRef,
      resolvedStepOverridesRef,
      snapshotStackRef,
      macroAnimationRef,
      macroRevealRef,
      ghostOpacitiesRef,
      availableMacros,
      toolPhases,
      checkStep,
      triggerCorrection,
      requestDraw,
      pushCitationFlash,
      musicRef,
      notifierRef,
      setCeremonyLabel,
      setProofFacts,
      setCompletedSteps,
      setCurrentStep,
      setIsComplete,
    ]
  )

  const handlePlaceFreePoint = useCallback(
    (worldX: number, worldY: number) => {
      // Given-setup mode: place a given point instead
      if (givenSetupActiveRef.current) {
        givenSetup.addPoint(worldX, worldY)
        requestDraw()
        return
      }
      if (!isCompleteRef.current) return
      const result = addPoint(constructionRef.current, worldX, worldY, 'free')
      constructionRef.current = result.state
      // Record action for replay during drag
      postCompletionActionsRef.current = [
        ...postCompletionActionsRef.current,
        {
          type: 'free-point' as const,
          id: result.point.id,
          label: result.point.label,
          x: worldX,
          y: worldY,
        },
      ]
      requestDraw()

      // Citation flash at the point
      pushCitationFlash({
        type: 'point',
        citation: 'Def.1',
        worldX,
        worldY,
      })

      notifierRef.current.notifyConstruction({
        action: `Placed free point ${result.point.label}`,
        shouldPrompt: false,
      })
    },
    [
      constructionRef,
      isCompleteRef,
      postCompletionActionsRef,
      givenSetupActiveRef,
      givenSetup,
      requestDraw,
      pushCitationFlash,
      notifierRef,
    ]
  )

  return {
    handleCommitCircle,
    handleCommitSegment,
    handleCommitExtend,
    handleMarkIntersection,
    handleCommitMacro,
    handlePlaceFreePoint,
  }
}
