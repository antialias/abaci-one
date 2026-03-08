/**
 * renderFrame — Pure function that draws one complete frame of the Euclid canvas.
 *
 * Extracted from the RAF render loop in EuclidCanvas.tsx.
 * Handles pre-render computation (hidden IDs, candidate filter, correction rotation)
 * and dispatches all render subsystem calls.
 */
import type { RAFContext } from '../engine/rafContext'
import type { CompassPhase, StraightedgePhase, ExtendPhase } from '../types'
import { resolveSelector } from '../engine/selectors'
import { getHiddenElementIds } from '../engine/macroExecution'
import { getAllPoints } from '../engine/constructionState'
import { rotatePoint } from '../engine/viewportMath'
import { BYRNE_CYCLE } from '../types'
import { renderConstruction, renderDragInvitation } from './renderConstruction'
import { renderToolOverlay } from './renderToolOverlay'
import { renderTutorialHint } from './renderTutorialHint'
import { renderEqualityMarks } from './renderEqualityMarks'
import { renderGhostGeometry } from './renderGhostGeometry'
import { renderProductionSegments } from './renderProductionSegments'
import { renderAngleArcs } from './renderAngleArcs'
import { renderSuperpositionFlash } from './renderSuperpositionFlash'
import { renderSuperpositionInteraction } from './renderSuperpositionInteraction'
import { renderCitationFlashes } from './renderCitationFlash'
import { renderMacroPreview } from './renderMacroPreview'
import { renderChatHighlight } from './renderChatHighlight'

export function renderFrame(
  ctx: RAFContext,
  drawCtx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number
): void {
  const prop = ctx.propositionRef.current

  // ── Derive candidate filter from current step's expected intersection ──
  const curStep = ctx.currentStepRef.current
  const curExpected =
    curStep < ctx.stepsRef.current.length ? ctx.stepsRef.current[curStep].expected : null
  let candFilter: { ofA: string; ofB: string; beyondId?: string } | null = null
  if (curExpected?.type === 'intersection' && curExpected.ofA != null && curExpected.ofB != null) {
    const resolvedA = resolveSelector(curExpected.ofA, ctx.constructionRef.current)
    const resolvedB = resolveSelector(curExpected.ofB, ctx.constructionRef.current)
    if (resolvedA && resolvedB) {
      candFilter = { ofA: resolvedA, ofB: resolvedB, beyondId: curExpected.beyondId }
    }
  }
  const complete = ctx.playgroundModeRef.current || curStep >= ctx.stepsRef.current.length

  // ── Compute hidden elements during macro animation ──
  const hiddenIds = getHiddenElementIds(ctx.macroAnimationRef.current)
  // Also hide macro output elements while the ceremony is playing
  const ceremonyHidden = ctx.macroRevealRef.current?.hiddenElementIds
  if (ceremonyHidden) {
    for (const id of ceremonyHidden) hiddenIds.add(id)
  }

  // ── Handle straightedge drawing animation ──
  const drawAnim = ctx.straightedgeDrawAnimRef.current
  if (drawAnim) {
    const elapsed = performance.now() - drawAnim.startTime
    if (elapsed >= drawAnim.duration) {
      ctx.straightedgeDrawAnimRef.current = null
    } else {
      hiddenIds.add(drawAnim.segmentId)
      ctx.needsDrawRef.current = true
    }
  }

  // ── Compute drawState (possibly with correction rotation) ──
  let drawState = ctx.constructionRef.current
  if (ctx.correctionRef.current?.active) {
    const correction = ctx.correctionRef.current
    const t = Math.min(1, (performance.now() - correction.startTime) / correction.duration)
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const angle = correction.fromAngle + (correction.toAngle - correction.fromAngle) * ease
    const state = ctx.constructionRef.current
    const updatedElements = state.elements.map((el) => {
      if (el.kind === 'point') {
        const rotated = rotatePoint({ x: el.x, y: el.y }, correction.center, angle)
        return { ...el, x: rotated.x, y: rotated.y }
      }
      return el
    })
    drawState = { ...state, elements: updatedElements }
    ctx.needsDrawRef.current = true
  }

  // ── 1. Main construction geometry ──
  renderConstruction(
    drawCtx,
    drawState,
    ctx.viewportRef.current,
    cssWidth,
    cssHeight,
    ctx.compassPhaseRef.current as CompassPhase,
    ctx.straightedgePhaseRef.current as StraightedgePhase,
    ctx.pointerWorldRef.current,
    ctx.snappedPointIdRef.current,
    ctx.candidatesRef.current,
    drawState.nextColorIndex,
    candFilter,
    complete,
    complete ? ctx.effectiveResultSegmentsRef.current : undefined,
    hiddenIds.size > 0 ? hiddenIds : undefined,
    undefined, // transparentBg
    complete
      ? ctx.playgroundModeRef.current
        ? getAllPoints(drawState)
            .filter((pt) => pt.origin === 'given' || pt.origin === 'free' || pt.origin === 'extend')
            .map((pt) => pt.id)
        : prop.draggablePointIds
      : undefined,
    complete ? ctx.postCompletionActionsRef.current : undefined
  )

  // Keep redrawing while ripple rings are visible
  if (
    complete &&
    (ctx.playgroundModeRef.current
      ? getAllPoints(drawState).some(
          (pt) => pt.origin === 'given' || pt.origin === 'free' || pt.origin === 'extend'
        )
      : prop.draggablePointIds?.length)
  ) {
    ctx.needsDrawRef.current = true
  }

  // ── 2. Post.2 production segments (extensions to intersection points) ──
  renderProductionSegments(
    drawCtx,
    drawState,
    ctx.stepsRef.current,
    ctx.currentStepRef.current,
    ctx.viewportRef.current,
    cssWidth,
    cssHeight
  )

  // ── 3. Ghost geometry (dependency scaffolding from macros) ──
  if (ctx.ghostLayersRef.current.length > 0) {
    const cer = ctx.macroRevealRef.current
    let ceremonyRevealCounts: Map<string, number> | null = null
    if (cer) {
      ceremonyRevealCounts = new Map<string, number>()
      for (const [key, groupCount] of cer.preRevealedLayers) {
        ceremonyRevealCounts.set(key, groupCount)
      }
      for (let i = 0; i < cer.revealed; i++) {
        const entry = cer.sequence[i]
        ceremonyRevealCounts.set(entry.layerKey, entry.groupIndex)
      }
    }
    const ghostAnimating = renderGhostGeometry(
      drawCtx,
      ctx.ghostLayersRef.current,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      ctx.hoveredMacroStepRef.current,
      ctx.ghostOpacitiesRef.current,
      ceremonyRevealCounts,
      cer?.elementAnims ?? null,
      cer ? performance.now() : undefined
    )
    if (ghostAnimating || ctx.hoveredMacroStepRef.current !== null) {
      ctx.needsDrawRef.current = true
    }
  }

  // ── 4. Macro preview (unbound markers + live ghost geometry) ──
  if (ctx.macroPhaseRef.current.tag === 'selecting') {
    const previewAnimating = renderMacroPreview(
      drawCtx,
      ctx.macroPhaseRef.current,
      ctx.constructionRef.current,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      ctx.pointerWorldRef.current,
      ctx.snappedPointIdRef.current
    )
    if (previewAnimating) ctx.needsDrawRef.current = true
  }

  // ── 5. Equality tick marks on segments with proven equalities ──
  if (ctx.factStoreRef.current.facts.length > 0) {
    renderEqualityMarks(
      drawCtx,
      drawState,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      ctx.factStoreRef.current,
      hiddenIds.size > 0 ? hiddenIds : undefined,
      complete ? ctx.effectiveResultSegmentsRef.current : undefined
    )
  }

  // ── 6. Angle arcs (static from proposition + dynamic from fact store) ──
  if (prop.givenAngles || ctx.factStoreRef.current.angleFacts.length > 0) {
    renderAngleArcs(
      drawCtx,
      drawState,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      prop.givenAngles,
      prop.equalAngles,
      ctx.factStoreRef.current
    )
  }

  // ── 6½. Superposition interaction (interactive drag/flip/snap) ──
  if (ctx.superpositionPhaseRef.current.tag !== 'idle') {
    if (
      renderSuperpositionInteraction(
        drawCtx,
        ctx.superpositionPhaseRef.current,
        drawState,
        ctx.viewportRef.current,
        cssWidth,
        cssHeight,
        performance.now()
      )
    ) {
      ctx.needsDrawRef.current = true
    }
  }

  // ── 7. Superposition flash animation (C.N.4) ──
  if (ctx.superpositionFlashRef.current) {
    const stillAnimating = renderSuperpositionFlash(
      drawCtx,
      ctx.superpositionFlashRef.current,
      drawState,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      performance.now()
    )
    if (stillAnimating) {
      ctx.needsDrawRef.current = true
    } else {
      ctx.superpositionFlashRef.current = null
    }
  }

  // ── 8. Citation flashes (Post.1/2/3) ──
  if (ctx.citationFlashesRef.current.length > 0) {
    ctx.citationFlashesRef.current = renderCitationFlashes(
      drawCtx,
      ctx.citationFlashesRef.current,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight,
      performance.now()
    )
    if (ctx.citationFlashesRef.current.length > 0) {
      ctx.needsDrawRef.current = true
    }
  }

  // ── 9. Drag invitation text post-completion ──
  if (complete && ctx.completionTimeRef.current > 0 && prop.draggablePointIds) {
    const stillShowing = renderDragInvitation(
      drawCtx,
      cssWidth,
      cssHeight,
      ctx.completionTimeRef.current
    )
    if (stillShowing) {
      ctx.needsDrawRef.current = true
    }
  }

  // ── 10. Chat entity highlight (golden glow on hovered geometric refs) ──
  if (ctx.chatHighlightRef.current) {
    renderChatHighlight(
      drawCtx,
      drawState,
      ctx.chatHighlightRef.current,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight
    )
    ctx.needsDrawRef.current = true
  }

  // ── 11. Voice highlight (golden glow from voice tool calls) ──
  if (ctx.euclidVoiceHighlightRef.current) {
    renderChatHighlight(
      drawCtx,
      drawState,
      ctx.euclidVoiceHighlightRef.current,
      ctx.viewportRef.current,
      cssWidth,
      cssHeight
    )
    ctx.needsDrawRef.current = true
  }

  // ── 12. Tool overlay (geometric previews + physical tool body) ──
  const nextColor = BYRNE_CYCLE[ctx.constructionRef.current.nextColorIndex % BYRNE_CYCLE.length]
  renderToolOverlay(
    drawCtx,
    ctx.activeToolRef.current,
    ctx.compassPhaseRef.current as CompassPhase,
    ctx.straightedgePhaseRef.current as StraightedgePhase,
    ctx.pointerWorldRef.current,
    ctx.constructionRef.current,
    ctx.viewportRef.current,
    cssWidth,
    cssHeight,
    nextColor,
    complete,
    ctx.straightedgeDrawAnimRef.current,
    ctx.extendPhaseRef.current as ExtendPhase,
    ctx.extendPreviewRef.current
  )

  // ── 13. Tutorial hint on top ──
  renderTutorialHint(
    drawCtx,
    ctx.currentHintRef.current,
    ctx.constructionRef.current,
    ctx.viewportRef.current,
    cssWidth,
    cssHeight,
    ctx.candidatesRef.current,
    performance.now() / 1000
  )
}
