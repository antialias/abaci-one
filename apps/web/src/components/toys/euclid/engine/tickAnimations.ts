import type { RAFContext } from './rafContext'
import { tickMacroAnimation } from './macroExecution'
import { replayConstruction } from './replayConstruction'
import { mergeProofFacts } from './factStore'
import { rotatePoint } from './viewportMath'
import { getPoint, getAllPoints } from './constructionState'
import type { ConstructionElement } from '../types'
import { triangleCentroid } from './superpositionMath'

/**
 * Tick all running animations: macro reveal, ceremony, relocate-point.
 * Returns true if any animation is in progress (needs continued drawing).
 */
export function tickAnimations(ctx: RAFContext): boolean {
  let animating = false

  // ── Tick macro animation ──
  const macroAnim = ctx.macroAnimationRef.current
  if (macroAnim && macroAnim.revealedCount < macroAnim.elements.length) {
    const newCount = tickMacroAnimation(macroAnim)
    if (newCount !== macroAnim.revealedCount) {
      macroAnim.revealedCount = newCount
      ctx.needsDrawRef.current = true
    }
    if (newCount >= macroAnim.elements.length) {
      ctx.macroAnimationRef.current = null
    }
    animating = true
  }

  // ── Tick macro reveal ceremony ──
  const ceremony = ctx.macroRevealRef.current
  if (ceremony) {
    const now = performance.now()
    const cdbg = ctx.ceremonyDebugRef.current
    const speed = Math.max(0.01, cdbg.speedMultiplier)
    if (!cdbg.paused && ceremony.revealed < ceremony.sequence.length) {
      // Still revealing groups — check if the next one is due
      const entry = ceremony.sequence[ceremony.revealed]
      if (now - ceremony.lastRevealMs >= entry.msDelay / speed) {
        ceremony.revealed++
        ceremony.lastRevealMs = now
        ctx.needsDrawRef.current = true
        // Start draw animations for each element in this newly revealed group
        const revealedEntry = ceremony.sequence[ceremony.revealed - 1]
        const layer = ctx.ghostLayersRef.current.find(
          (gl) => `${gl.atStep}:${gl.depth}` === revealedEntry.layerKey
        )
        if (layer?.revealGroups) {
          const group = layer.revealGroups[revealedEntry.groupIndex - 1]
          if (group) {
            for (const idx of group) {
              const el = layer.elements[idx]
              if (!el) continue
              const baseDurationMs = el.kind === 'circle' ? 700 : el.kind === 'segment' ? 400 : 0
              ceremony.elementAnims.set(`${revealedEntry.layerKey}:${idx}`, {
                startMs: now,
                durationMs: baseDurationMs / speed,
              })
            }
          }
        }
        if (ceremony.revealed >= ceremony.sequence.length) {
          ceremony.allShownMs = now
        }
      } else {
        // Not yet due — keep animating so we check again next frame
        ctx.needsDrawRef.current = true
      }
    } else if (!cdbg.paused && ceremony.allShownMs !== null) {
      // All groups shown — fire narration once, then advance step after delay
      if (!ceremony.narrationFired) {
        ceremony.narrationFired = true
        if (ceremony.narrationText) {
          ctx.sayMacroRevealRef.current({
            say: { en: ceremony.narrationText },
            tone: 'tutorial-instruction',
          })
        }
      }
      if (now - ceremony.allShownMs >= ceremony.postNarrationDelayMs / speed) {
        ceremony.advanceStep()
        ctx.macroRevealRef.current = null
      } else {
        ctx.needsDrawRef.current = true
      }
    }
    // When paused, keep drawing so ghost opacity lerps and the canvas stays live
    if (cdbg.paused) {
      ctx.needsDrawRef.current = true
    }
    animating = true
  }

  // ── Tick relocate-point animation ──
  const relocAnim = ctx.relocatePointAnimRef.current
  if (relocAnim) {
    const now = performance.now()
    const rawT = Math.min(1, (now - relocAnim.startTime) / relocAnim.durationMs)
    const easedT = 1 - (1 - rawT) * (1 - rawT) // ease-out quadratic

    // Build interpolated actions
    const interpX = relocAnim.fromX + (relocAnim.toX - relocAnim.fromX) * easedT
    const interpY = relocAnim.fromY + (relocAnim.toY - relocAnim.fromY) * easedT
    const interpActions = ctx.postCompletionActionsRef.current.map((a, i) =>
      i === relocAnim.actionIndex && a.type === 'free-point' ? { ...a, x: interpX, y: interpY } : a
    )

    // Full replay with interpolated coordinates (same pattern as drag/wiggle)
    const prop = ctx.propositionRef.current
    const result = replayConstruction(
      prop.givenElements,
      prop.steps,
      prop,
      interpActions,
      ctx.stepDataRef.current
    )
    ctx.constructionRef.current = {
      ...result.state,
      elements: [...result.state.elements, ...relocAnim.untrackedElements],
      nextLabelIndex: Math.max(
        result.state.nextLabelIndex,
        ctx.constructionRef.current.nextLabelIndex
      ),
      nextColorIndex: Math.max(
        result.state.nextColorIndex,
        ctx.constructionRef.current.nextColorIndex
      ),
    }
    ctx.candidatesRef.current = result.candidates
    ctx.ghostLayersRef.current = result.ghostLayers
    ctx.factStoreRef.current = result.factStore
    mergeProofFacts(ctx.factStoreRef.current, ctx.proofFactsRef.current)
    ctx.needsDrawRef.current = true

    if (rawT >= 1) {
      // Animation complete — finalize state and notify ledger
      // Don't overwrite proofFactsRef — it already has author-declared facts
      // that the replay doesn't know about.
      ctx.eventBusRef.current.emit({ action: 'revert', shouldPrompt: false, reset: true })
      ctx.relocatePointAnimRef.current = null
    }
    animating = true
  }

  // ── Tick correction animation ──
  const correction = ctx.correctionRef.current
  if (correction?.active) {
    const t = Math.min(1, (performance.now() - correction.startTime) / correction.duration)
    if (t >= 1) {
      // Finalize: apply rotation via replay for geometric consistency
      ctx.correctionRef.current = null
      ctx.correctionActiveRef.current = false
      ctx.setIsCorrectionActive(false)
      if (ctx.propositionRef.current.draggablePointIds) {
        ctx.setActiveTool('move')
        ctx.activeToolRef.current = 'move'
      }
      const prop = ctx.propositionRef.current
      const center = correction.center
      const angleFinal = correction.toAngle
      let givenElements: ConstructionElement[]
      if (prop.computeGivenElements) {
        const positions = new Map<string, { x: number; y: number }>()
        for (const el of ctx.constructionRef.current.elements) {
          if (el.kind === 'point' && el.origin === 'given') {
            const rotated = rotatePoint({ x: el.x, y: el.y }, center, angleFinal)
            positions.set(el.id, rotated)
          }
        }
        const pA = positions.get('pt-A')
        const pB = positions.get('pt-B')
        if (pA && pB && pA.x > pB.x) {
          positions.set('pt-A', pB)
          positions.set('pt-B', pA)
        }
        givenElements = prop.computeGivenElements(positions)
      } else {
        const rotatedPoints = new Map<string, { x: number; y: number }>()
        for (const el of prop.givenElements) {
          if (el.kind === 'point') {
            const rotated = rotatePoint({ x: el.x, y: el.y }, center, angleFinal)
            rotatedPoints.set(el.id, rotated)
          }
        }
        const pA = rotatedPoints.get('pt-A')
        const pB = rotatedPoints.get('pt-B')
        if (pA && pB && pA.x > pB.x) {
          rotatedPoints.set('pt-A', pB)
          rotatedPoints.set('pt-B', pA)
        }
        givenElements = prop.givenElements.map((el) => {
          if (el.kind === 'point' && rotatedPoints.has(el.id)) {
            const rotated = rotatedPoints.get(el.id)!
            return { ...el, x: rotated.x, y: rotated.y }
          }
          return el
        })
      }
      const result = replayConstruction(
        givenElements,
        prop.steps,
        prop,
        ctx.postCompletionActionsRef.current,
        ctx.stepDataRef.current
      )
      ctx.constructionRef.current = result.state
      ctx.factStoreRef.current = result.factStore
      ctx.candidatesRef.current = result.candidates
      ctx.proofFactsRef.current = result.proofFacts
      ctx.setProofFacts(result.proofFacts)
    }
    animating = true
  }

  // ── Tick superposition interaction ──
  const sp = ctx.superpositionPhaseRef.current
  if (sp.tag === 'lifting') {
    const now = performance.now()
    if (now - sp.startTime >= 300) {
      // Transition lifting → dragging
      const state = ctx.constructionRef.current
      const srcVerts = sp.srcTriIds.map((id) => {
        const p = getPoint(state, id)
        return p ? { x: p.x, y: p.y } : { x: 0, y: 0 }
      }) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]
      const centroid = triangleCentroid(srcVerts[0], srcVerts[1], srcVerts[2])
      ctx.superpositionPhaseRef.current = {
        tag: 'dragging',
        srcTriIds: sp.srcTriIds,
        tgtTriIds: sp.tgtTriIds,
        mapping: sp.mapping,
        cutoutVertices: srcVerts,
        dragAnchor: centroid,
        initialCentroid: centroid,
      }
    }
    animating = true
    ctx.needsDrawRef.current = true
  }
  if (sp.tag === 'flipping') {
    const now = performance.now()
    if (now - sp.startTime >= 800) {
      // Transition flipping → snapping
      ctx.superpositionPhaseRef.current = {
        tag: 'snapping',
        startTime: now,
        fromVertices: sp.postFlipVertices,
        toVertices: sp.postFlipVertices,
        srcTriIds: sp.srcTriIds,
        tgtTriIds: sp.tgtTriIds,
        mapping: sp.mapping,
      }
    }
    animating = true
    ctx.needsDrawRef.current = true
  }
  if (sp.tag === 'snapping') {
    const now = performance.now()
    if (now - sp.startTime >= 200) {
      // Transition snapping → settled
      ctx.superpositionPhaseRef.current = { tag: 'settled' }
      // Fire the settled callback (fact cascade + step advancement)
      ctx.onSuperpositionSettledRef.current?.()
      ctx.onSuperpositionSettledRef.current = null
    }
    animating = true
    ctx.needsDrawRef.current = true
  }
  if (sp.tag === 'settled') {
    // Transition settled → idle (cleanup)
    ctx.superpositionPhaseRef.current = { tag: 'idle' }
  }
  if (sp.tag === 'dragging' || sp.tag === 'mismatched') {
    animating = true
    ctx.needsDrawRef.current = true
  }

  return animating
}
