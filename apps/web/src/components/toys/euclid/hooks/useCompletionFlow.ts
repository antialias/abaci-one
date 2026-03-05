import { useEffect, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { RAFContext } from '../engine/rafContext'
import type { ConstructionElement, PropositionDef } from '../types'
import { replayConstruction } from '../engine/replayConstruction'
import { mergeProofFacts } from '../engine/factStore'
import { getPoint } from '../engine/constructionState'
import type { UseEuclidMusicReturn } from '../audio/useEuclidMusic'

interface UseCompletionFlowOptions {
  rafCtx: RAFContext
  isComplete: boolean
  playgroundMode: boolean | undefined
  proposition: PropositionDef
  propositionId: number
  onComplete?: (propId: number) => void
  audioEnabled: boolean
  sayCorrection: () => void
  musicRef: MutableRefObject<UseEuclidMusicReturn | null>
}

/**
 * Manages the completion lifecycle:
 * - Fires onComplete callback when proposition is solved
 * - Handles Prop 1 triangle orientation correction
 * - Auto-selects Move tool for draggable props
 * - Notifies music system
 * - Runs the wiggle animation to invite point dragging
 * - Auto-triggers wiggle 400ms after completion
 */
export function useCompletionFlow({
  rafCtx,
  isComplete,
  playgroundMode,
  proposition,
  propositionId,
  onComplete,
  audioEnabled,
  sayCorrection,
  musicRef,
}: UseCompletionFlowOptions) {
  // ── Fire onComplete callback and auto-select Move tool ──
  useEffect(() => {
    if (isComplete) {
      if (onComplete && !playgroundMode) onComplete(propositionId)
      if (proposition.id === 1) {
        const state = rafCtx.constructionRef.current
        const pA = getPoint(state, 'pt-A')
        const pB = getPoint(state, 'pt-B')
        const pC = getPoint(state, 'pt-C')
        if (pA && pB && pC) {
          const abx = pB.x - pA.x
          const aby = pB.y - pA.y
          const cross = abx * (pC.y - pA.y) - aby * (pC.x - pA.x)
          if (cross < 0) {
            const center = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 }
            if (center) {
              rafCtx.correctionRef.current = {
                active: true,
                startTime: performance.now(),
                duration: 900,
                center,
                fromAngle: 0,
                toAngle: Math.PI,
              }
              rafCtx.correctionActiveRef.current = true
              rafCtx.setIsCorrectionActive(true)
              if (audioEnabled) {
                sayCorrection()
              }
            }
          }
        }
      }
      if (
        !playgroundMode &&
        proposition.draggablePointIds &&
        !rafCtx.correctionActiveRef.current
      ) {
        rafCtx.setActiveTool('move')
        rafCtx.activeToolRef.current = 'move'
      }
      if (!playgroundMode) musicRef.current?.notifyCompletion()
    } else {
      rafCtx.correctionRef.current = null
      rafCtx.correctionActiveRef.current = false
      rafCtx.setIsCorrectionActive(false)
    }
  }, [
    isComplete,
    onComplete,
    propositionId,
    proposition.draggablePointIds,
    proposition.id,
    audioEnabled,
    sayCorrection,
  ])

  // ── Wiggle animation — invite kids to drag moveable points ──
  const startWiggle = useCallback(
    (delayMs: number = 0) => {
      // Cancel any existing wiggle
      rafCtx.wiggleCancelRef.current?.()
      rafCtx.wiggleCancelRef.current = null

      const prop = rafCtx.propositionRef.current
      const computeFn = prop.computeGivenElements

      // Collect all moveable points: given draggable + free (playground)
      const initialPositions = new Map<string, { x: number; y: number }>()
      const initialActions = [...rafCtx.postCompletionActionsRef.current]
      const draggableSet = new Set(prop.draggablePointIds ?? [])
      for (const el of rafCtx.constructionRef.current.elements) {
        if (el.kind !== 'point') continue
        if (draggableSet.has(el.id) || el.origin === 'free' || el.origin === 'extend') {
          initialPositions.set(el.id, { x: el.x, y: el.y })
        }
      }
      if (initialPositions.size === 0) return

      // Per-point random sinusoid parameters
      const params = [...initialPositions.keys()].map((ptId) => {
        const canvas = rafCtx.canvasRef.current
        const cssMin = canvas
          ? Math.min(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height)
          : 600
        const ppu = rafCtx.viewportRef.current.pixelsPerUnit
        const amp = ((0.0025 + Math.random() * 0.00375) * cssMin) / ppu
        return {
          ptId,
          isFree: !draggableSet.has(ptId),
          ax: amp * (0.6 + Math.random() * 0.8),
          ay: amp * (0.6 + Math.random() * 0.8),
          freqX: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000),
          freqY: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000),
          phaseX: Math.random() * 2 * Math.PI,
          phaseY: Math.random() * 2 * Math.PI,
        }
      })

      const DURATION_MS = 1500
      let frameId = 0
      let cancelled = false

      function applyPositions(positions: Map<string, { x: number; y: number }>) {
        // Update free-point actions with new positions
        const actions = initialActions.map((a) => {
          if (a.type === 'free-point' && positions.has(a.id)) {
            const pos = positions.get(a.id)!
            return { ...a, x: pos.x, y: pos.y }
          }
          return a
        })
        rafCtx.postCompletionActionsRef.current = actions

        let givenElements: ConstructionElement[]
        if (computeFn) {
          givenElements = computeFn(positions)
        } else {
          givenElements = prop.givenElements.map((el) => {
            if (el.kind === 'point' && positions.has(el.id)) {
              const pos = positions.get(el.id)!
              return { ...el, x: pos.x, y: pos.y }
            }
            return el
          })
        }
        const result = replayConstruction(
          givenElements,
          prop.steps,
          prop,
          actions,
          rafCtx.stepDataRef.current
        )
        rafCtx.constructionRef.current = result.state
        rafCtx.candidatesRef.current = result.candidates
        rafCtx.ghostLayersRef.current = result.ghostLayers
        rafCtx.factStoreRef.current = result.factStore
        mergeProofFacts(rafCtx.factStoreRef.current, rafCtx.proofFactsRef.current)
      }

      function frame(now: number) {
        if (cancelled) return
        const t = now - startMs
        if (t >= DURATION_MS) {
          // Restore original positions
          rafCtx.postCompletionActionsRef.current = initialActions
          applyPositions(initialPositions)
          rafCtx.needsDrawRef.current = true
          rafCtx.wiggleCancelRef.current = null // prevent stale cancel from wiping later actions
          return
        }
        const envelope = Math.sin((t / DURATION_MS) * Math.PI)
        const positions = new Map(initialPositions)
        for (const p of params) {
          const orig = initialPositions.get(p.ptId)!
          positions.set(p.ptId, {
            x: orig.x + envelope * p.ax * Math.sin(p.freqX * t + p.phaseX),
            y: orig.y + envelope * p.ay * Math.sin(p.freqY * t + p.phaseY),
          })
        }
        applyPositions(positions)
        rafCtx.needsDrawRef.current = true
        frameId = requestAnimationFrame(frame)
      }

      let startMs = 0
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          startMs = performance.now()
          frameId = requestAnimationFrame(frame)
        }
      }, delayMs)

      const cancel = () => {
        cancelled = true
        clearTimeout(timeoutId)
        cancelAnimationFrame(frameId)
        rafCtx.postCompletionActionsRef.current = initialActions
        applyPositions(initialPositions)
        rafCtx.needsDrawRef.current = true
      }
      rafCtx.wiggleCancelRef.current = cancel

      return cancel
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Auto-wiggle on proposition completion (not in playground — user triggers manually)
  useEffect(() => {
    if (!isComplete) return
    if (playgroundMode) return
    if (!proposition.draggablePointIds || proposition.draggablePointIds.length === 0) return

    const cancel = startWiggle(400) // 400ms delay for completion moment to render

    return () => {
      cancel?.()
      rafCtx.wiggleCancelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proposition.id])

  return { startWiggle }
}
