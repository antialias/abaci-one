'use client'

import { useState, useEffect } from 'react'
import { buildFinalState } from './buildFinalStates'
import { renderConstruction } from './renderConstruction'
import { getAllPoints, getAllCircles, getPoint, getRadius } from '../engine/constructionState'
import { PROP_1 } from '../propositions/prop1'
import { PROP_2 } from '../propositions/prop2'
import { PROP_3 } from '../propositions/prop3'
import { PROP_4 } from '../propositions/prop4'
import { IMPLEMENTED_PROPS } from '../data/propositionGraph'
import type { ConstructionState, EuclidViewportState, PropositionDef } from '../types'

const PREVIEW_W = 260
const PREVIEW_H = 200
const PADDING_FRACTION = 0.15

const PROP_DEFS: Record<number, PropositionDef> = {
  1: PROP_1,
  2: PROP_2,
  3: PROP_3,
  4: PROP_4,
}

/**
 * Compute a viewport that fits all geometric elements (points + circle extents)
 * into the given pixel dimensions with padding.
 */
function computeFitViewport(state: ConstructionState, w: number, h: number): EuclidViewportState {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const pt of getAllPoints(state)) {
    minX = Math.min(minX, pt.x)
    maxX = Math.max(maxX, pt.x)
    minY = Math.min(minY, pt.y)
    maxY = Math.max(maxY, pt.y)
  }

  for (const circle of getAllCircles(state)) {
    const center = getPoint(state, circle.centerId)
    if (!center) continue
    const r = getRadius(state, circle.id)
    minX = Math.min(minX, center.x - r)
    maxX = Math.max(maxX, center.x + r)
    minY = Math.min(minY, center.y - r)
    maxY = Math.max(maxY, center.y + r)
  }

  // Add padding
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const padX = rangeX * PADDING_FRACTION
  const padY = rangeY * PADDING_FRACTION
  minX -= padX
  maxX += padX
  minY -= padY
  maxY += padY

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scaleX = w / (maxX - minX)
  const scaleY = h / (maxY - minY)
  const pixelsPerUnit = Math.min(scaleX, scaleY)

  return { center: { x: cx, y: cy }, pixelsPerUnit }
}

/**
 * Renders the final construction state for each implemented proposition
 * to an offscreen canvas, returning a Map of propId → data URL.
 * Computed once on mount and cached.
 */
export function usePropPreviews(): Map<number, string> {
  const [previews, setPreviews] = useState<Map<number, string>>(() => new Map())

  useEffect(() => {
    const map = new Map<number, string>()
    const idle = { tag: 'idle' as const }

    for (const propId of IMPLEMENTED_PROPS) {
      const finalState = buildFinalState(propId)
      if (!finalState) continue

      const prop = PROP_DEFS[propId]
      const viewport = computeFitViewport(finalState, PREVIEW_W, PREVIEW_H)

      const canvas = document.createElement('canvas')
      canvas.width = PREVIEW_W
      canvas.height = PREVIEW_H
      const ctx = canvas.getContext('2d')
      if (!ctx) continue

      renderConstruction(
        ctx,
        finalState,
        viewport,
        PREVIEW_W,
        PREVIEW_H,
        idle, // compassPhase: idle
        idle, // straightedgePhase: idle
        null, // pointerWorld
        null, // snappedPointId
        [], // candidates
        0, // nextColorIndex
        null, // candidateFilter
        true, // isComplete
        prop.resultSegments,
        undefined, // hiddenElementIds
        true // transparentBg
      )

      map.set(propId, canvas.toDataURL('image/png'))
    }

    setPreviews(map)
  }, [])

  return previews
}
