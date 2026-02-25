'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { FoundationDiagram } from './foundationsData'
import type { ConstructionState, EuclidViewportState, CompassPhase, StraightedgePhase } from '../types'
import { initializeGiven, getAllCircles, getPoint, getRadius } from '../engine/constructionState'
import { renderConstruction } from '../render/renderConstruction'
import { renderEqualityMarks } from '../render/renderEqualityMarks'
import { renderAngleArcs } from '../render/renderAngleArcs'
import { worldToScreen2D } from '../../shared/coordinateConversions'
import { createFactStore, addFact } from '../engine/factStore'
import { distancePair } from '../engine/facts'

const IDLE_COMPASS: CompassPhase = { tag: 'idle' }
const IDLE_STRAIGHTEDGE: StraightedgePhase = { tag: 'idle' }
const EMPTY_CANDIDATES: [] = []

function computeBounds(state: ConstructionState) {
  const points = state.elements.filter((el) => el.kind === 'point') as Array<{
    x: number
    y: number
  }>
  if (points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const pt of points) {
    minX = Math.min(minX, pt.x)
    minY = Math.min(minY, pt.y)
    maxX = Math.max(maxX, pt.x)
    maxY = Math.max(maxY, pt.y)
  }

  for (const circle of getAllCircles(state)) {
    const center = getPoint(state, circle.centerId)
    const r = getRadius(state, circle.id)
    if (!center || r <= 0) continue
    minX = Math.min(minX, center.x - r)
    minY = Math.min(minY, center.y - r)
    maxX = Math.max(maxX, center.x + r)
    maxY = Math.max(maxY, center.y + r)
  }

  return { minX, minY, maxX, maxY }
}

function computeViewport(state: ConstructionState, width: number, height: number): EuclidViewportState {
  const bounds = computeBounds(state)
  if (!bounds) return { center: { x: 0, y: 0 }, pixelsPerUnit: 60 }

  const pad = 28
  const spanX = Math.max(1, bounds.maxX - bounds.minX)
  const spanY = Math.max(1, bounds.maxY - bounds.minY)
  const ppu = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY)
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }

  return { center, pixelsPerUnit: Math.max(18, Math.min(80, ppu)) }
}

function drawAnimatedOverlay(
  ctx: CanvasRenderingContext2D,
  state: ConstructionState,
  viewport: EuclidViewportState,
  width: number,
  height: number,
  diagram: FoundationDiagram,
  timeMs: number
) {
  const animation = diagram.animation
  if (!animation) return

  if (animation.type === 'line-draw') {
    const from = getPoint(state, animation.fromId)
    const to = getPoint(state, animation.toId)
    if (!from || !to) return
    const duration = animation.durationMs ?? 2000
    const t = (timeMs % duration) / duration
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    const start = worldToScreen2D(
      from.x,
      from.y,
      viewport.center.x,
      viewport.center.y,
      viewport.pixelsPerUnit,
      viewport.pixelsPerUnit,
      width,
      height
    )
    const end = worldToScreen2D(
      x,
      y,
      viewport.center.x,
      viewport.center.y,
      viewport.pixelsPerUnit,
      viewport.pixelsPerUnit,
      width,
      height
    )
    ctx.save()
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.restore()
  }

  if (animation.type === 'circle-sweep') {
    const center = getPoint(state, animation.centerId)
    if (!center) return
    const circleMatch = getAllCircles(state).find(
      (c) => c.centerId === animation.centerId && c.radiusPointId === animation.radiusPointId
    )
    const radius = circleMatch ? getRadius(state, circleMatch.id) : 0
    if (radius <= 0) return
    const duration = animation.durationMs ?? 2400
    const t = (timeMs % duration) / duration
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + Math.PI * 2 * t
    const sc = worldToScreen2D(
      center.x,
      center.y,
      viewport.center.x,
      viewport.center.y,
      viewport.pixelsPerUnit,
      viewport.pixelsPerUnit,
      width,
      height
    )
    ctx.save()
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(sc.x, sc.y, radius * viewport.pixelsPerUnit, startAngle, endAngle)
    ctx.stroke()
    ctx.restore()
  }

  if (animation.type === 'pulse-point') {
    const duration = animation.durationMs ?? 2200
    const t = (timeMs % duration) / duration
    const alpha = 0.35 + 0.35 * Math.sin(t * Math.PI * 2)
    for (const id of animation.pointIds) {
      const pt = getPoint(state, id)
      if (!pt) continue
      const sp = worldToScreen2D(
        pt.x,
        pt.y,
        viewport.center.x,
        viewport.center.y,
        viewport.pixelsPerUnit,
        viewport.pixelsPerUnit,
        width,
        height
      )
      ctx.save()
      ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, 14 + 6 * alpha, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }
}

interface EuclidFoundationCanvasProps {
  diagram: FoundationDiagram
}

export function EuclidFoundationCanvas({ diagram }: EuclidFoundationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null)

  const state = useMemo(() => initializeGiven(diagram.elements), [diagram.elements])
  const { factStore, angleSpecs, equalAngles } = useMemo(() => {
    const store = createFactStore()
    if (diagram.equalSegmentGroups) {
      for (const group of diagram.equalSegmentGroups) {
        const base = group[0]
        if (!base) continue
        for (let i = 1; i < group.length; i++) {
          const next = group[i]
          addFact(
            store,
            distancePair(base.fromId, base.toId),
            distancePair(next.fromId, next.toId),
            { type: 'given' },
            `${base.fromId.replace('pt-', '')}${base.toId.replace('pt-', '')} = ${next.fromId.replace('pt-', '')}${next.toId.replace('pt-', '')}`,
            'Given equality for foundation diagram.',
            0
          )
        }
      }
    }
    return {
      factStore: store,
      angleSpecs: diagram.givenAngles ?? [],
      equalAngles: diagram.equalAngles ?? [],
    }
  }, [diagram])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let isMounted = true

    const resize = () => {
      const width = Math.max(1, Math.round(container.clientWidth))
      const height = Math.max(1, Math.round(container.clientHeight))
      const last = lastSizeRef.current
      if (last && Math.abs(last.w - width) < 1 && Math.abs(last.h - height) < 1) {
        return
      }
      lastSizeRef.current = { w: width, h: height }
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (time: number) => {
      if (!isMounted) return
      const width = container.clientWidth
      const height = container.clientHeight
      const viewport = computeViewport(state, width, height)

      renderConstruction(
        ctx,
        state,
        viewport,
        width,
        height,
        IDLE_COMPASS,
        IDLE_STRAIGHTEDGE,
        null,
        null,
        EMPTY_CANDIDATES,
        0,
        null,
        true,
        undefined,
        undefined,
        false,
        undefined
      )

      if (diagram.equalSegmentGroups && diagram.equalSegmentGroups.length > 0) {
        renderEqualityMarks(ctx, state, viewport, width, height, factStore)
      }

      if (angleSpecs.length > 0) {
        renderAngleArcs(ctx, state, viewport, width, height, angleSpecs, equalAngles)
      }

      drawAnimatedOverlay(ctx, state, viewport, width, height, diagram, time)

      if (diagram.animation) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    resize()
    rafRef.current = requestAnimationFrame(draw)

    const observer = new ResizeObserver(() => {
      resize()
      rafRef.current = requestAnimationFrame(draw)
    })
    observer.observe(container)

    return () => {
      isMounted = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      observer.disconnect()
    }
  }, [diagram, state])

  return (
    <div
      ref={containerRef}
      data-component="foundation-canvas"
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        background: '#FAFAF0',
        boxSizing: 'border-box',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
