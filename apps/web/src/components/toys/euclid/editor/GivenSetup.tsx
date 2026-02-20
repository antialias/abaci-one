'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type { ConstructionState, EuclidViewportState, SerializedElement } from '../types'
import { BYRNE } from '../types'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'

interface GivenSetupProps {
  givenElements: SerializedElement[]
  onAddPoint: (x: number, y: number) => string
  onAddSegment: (fromId: string, toId: string) => void
  onMovePoint: (pointId: string, x: number, y: number) => void
  onRenamePoint: (pointId: string, newLabel: string) => void
  onStartProof: () => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  viewportRef: React.MutableRefObject<EuclidViewportState>
  constructionRef: React.MutableRefObject<ConstructionState>
  needsDrawRef: React.MutableRefObject<boolean>
}

export function GivenSetup({
  givenElements,
  onAddPoint,
  onAddSegment,
  onMovePoint,
  onRenamePoint,
  onStartProof,
  canvasRef,
  viewportRef,
  constructionRef,
  needsDrawRef,
}: GivenSetupProps) {
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [segmentMode, setSegmentMode] = useState(false)
  const [segmentFromId, setSegmentFromId] = useState<string | null>(null)
  const draggingRef = useRef<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const points = givenElements.filter((e) => e.kind === 'point')
  const segments = givenElements.filter((e) => e.kind === 'segment')

  // ── Draw given elements on a separate overlay ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // We piggyback on the main RAF loop by requesting a draw
    // The main canvas draws construction state which includes given elements
    // once they're initialized. For the setup phase, we draw directly.
    function drawGiven() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.save()
      ctx.scale(dpr, dpr)

      // Clear
      ctx.fillStyle = '#FAFAF0'
      ctx.fillRect(0, 0, cssW, cssH)

      // Draw grid
      const vp = viewportRef.current
      const gridStep = 1
      const left = vp.center.x - cssW / 2 / vp.pixelsPerUnit
      const right = vp.center.x + cssW / 2 / vp.pixelsPerUnit
      const bottom = vp.center.y - cssH / 2 / vp.pixelsPerUnit
      const top = vp.center.y + cssH / 2 / vp.pixelsPerUnit

      ctx.strokeStyle = 'rgba(203, 213, 225, 0.3)'
      ctx.lineWidth = 0.5
      for (let x = Math.floor(left); x <= Math.ceil(right); x += gridStep) {
        const sx = (x - vp.center.x) * vp.pixelsPerUnit + cssW / 2
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, cssH)
        ctx.stroke()
      }
      for (let y = Math.floor(bottom); y <= Math.ceil(top); y += gridStep) {
        const sy = cssH / 2 - (y - vp.center.y) * vp.pixelsPerUnit
        ctx.beginPath()
        ctx.moveTo(0, sy)
        ctx.lineTo(cssW, sy)
        ctx.stroke()
      }

      // Draw segments
      for (const seg of segments) {
        const from = points.find((p) => p.id === seg.fromId)
        const to = points.find((p) => p.id === seg.toId)
        if (!from || !to) continue
        const s1 = worldToScreen2D(
          from.x!,
          from.y!,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        const s2 = worldToScreen2D(
          to.x!,
          to.y!,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        ctx.strokeStyle = BYRNE.given
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(s1.x, s1.y)
        ctx.lineTo(s2.x, s2.y)
        ctx.stroke()
      }

      // Draw points
      for (const pt of points) {
        const s = worldToScreen2D(
          pt.x!,
          pt.y!,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        const isSelected = selectedPointId === pt.id
        const isSegFrom = segmentFromId === pt.id

        // Point circle
        ctx.beginPath()
        ctx.arc(s.x, s.y, isSelected ? 7 : 5, 0, Math.PI * 2)
        ctx.fillStyle = isSegFrom ? '#4E79A7' : BYRNE.given
        ctx.fill()

        if (isSelected) {
          ctx.strokeStyle = '#4E79A7'
          ctx.lineWidth = 2
          ctx.stroke()
        }

        // Label
        ctx.font = '600 12px system-ui, sans-serif'
        ctx.fillStyle = BYRNE.given
        ctx.textAlign = 'center'
        ctx.fillText(pt.label!, s.x, s.y - 10)
      }

      // Segment mode instruction
      if (segmentMode) {
        ctx.font = '12px system-ui, sans-serif'
        ctx.fillStyle = '#4E79A7'
        ctx.textAlign = 'center'
        if (segmentFromId) {
          ctx.fillText('Click second point for segment', cssW / 2, 30)
        } else {
          ctx.fillText('Click first point for segment', cssW / 2, 30)
        }
      }

      ctx.restore()
    }

    // Run draw whenever elements change
    drawGiven()
    needsDrawRef.current = false

    // Keep redrawing for interactive feedback
    const interval = setInterval(drawGiven, 100)
    return () => clearInterval(interval)
  }, [
    givenElements,
    selectedPointId,
    segmentMode,
    segmentFromId,
    canvasRef,
    viewportRef,
    needsDrawRef,
    points,
    segments,
  ])

  // ── Canvas click handler ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleClick(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas!.width / dpr
      const cssH = canvas!.height / dpr
      const vp = viewportRef.current

      // Hit test existing points
      for (const pt of points) {
        const s = worldToScreen2D(
          pt.x!,
          pt.y!,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        const dx = sx - s.x
        const dy = sy - s.y
        if (Math.sqrt(dx * dx + dy * dy) < 15) {
          if (segmentMode) {
            if (!segmentFromId) {
              setSegmentFromId(pt.id!)
            } else if (pt.id !== segmentFromId) {
              onAddSegment(segmentFromId, pt.id!)
              setSegmentFromId(null)
              setSegmentMode(false)
            }
          } else {
            setSelectedPointId(pt.id!)
          }
          return
        }
      }

      // No point hit — add new point if not in segment mode
      if (!segmentMode) {
        const world = screenToWorld2D(
          sx,
          sy,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        // Snap to grid
        const snappedX = Math.round(world.x * 2) / 2
        const snappedY = Math.round(world.y * 2) / 2
        const newId = onAddPoint(snappedX, snappedY)
        setSelectedPointId(newId)
      }
    }

    canvas.addEventListener('click', handleClick)
    return () => canvas.removeEventListener('click', handleClick)
  }, [canvasRef, viewportRef, points, segmentMode, segmentFromId, onAddPoint, onAddSegment])

  // ── Drag handler ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleMouseDown(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas!.width / dpr
      const cssH = canvas!.height / dpr
      const vp = viewportRef.current

      for (const pt of points) {
        const s = worldToScreen2D(
          pt.x!,
          pt.y!,
          vp.center.x,
          vp.center.y,
          vp.pixelsPerUnit,
          vp.pixelsPerUnit,
          cssW,
          cssH
        )
        if (Math.sqrt((sx - s.x) ** 2 + (sy - s.y) ** 2) < 15) {
          draggingRef.current = pt.id!
          canvas!.style.cursor = 'grabbing'
          e.preventDefault()
          return
        }
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas!.width / dpr
      const cssH = canvas!.height / dpr
      const vp = viewportRef.current

      const world = screenToWorld2D(
        sx,
        sy,
        vp.center.x,
        vp.center.y,
        vp.pixelsPerUnit,
        vp.pixelsPerUnit,
        cssW,
        cssH
      )
      const snappedX = Math.round(world.x * 2) / 2
      const snappedY = Math.round(world.y * 2) / 2
      onMovePoint(draggingRef.current, snappedX, snappedY)
    }

    function handleMouseUp() {
      draggingRef.current = null
      if (canvas) canvas.style.cursor = 'default'
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [canvasRef, viewportRef, points, onMovePoint])

  return (
    <div
      data-element="given-setup-overlay"
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
        zIndex: 10,
      }}
    >
      <button
        data-action="toggle-segment-mode"
        onClick={() => {
          setSegmentMode(!segmentMode)
          setSegmentFromId(null)
        }}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: segmentMode ? '2px solid #4E79A7' : '1px solid rgba(203, 213, 225, 0.8)',
          background: segmentMode ? 'rgba(78, 121, 167, 0.1)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          color: segmentMode ? '#4E79A7' : '#475569',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        {segmentMode ? 'Cancel Segment' : 'Add Segment'}
      </button>

      {selectedPointId && !segmentMode && (
        <button
          data-action="rename-point"
          onClick={() => {
            const pt = points.find((p) => p.id === selectedPointId)
            if (pt) {
              setRenamingId(pt.id!)
              setRenameValue(pt.label!)
            }
          }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid rgba(203, 213, 225, 0.8)',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            color: '#475569',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          Rename
        </button>
      )}

      {renamingId && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <input
            data-element="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                onRenamePoint(renamingId, renameValue.trim())
                setRenamingId(null)
                setSelectedPointId(`pt-${renameValue.trim()}`)
              }
              if (e.key === 'Escape') setRenamingId(null)
            }}
            maxLength={2}
            autoFocus
            style={{
              width: 32,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid #4E79A7',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
              outline: 'none',
            }}
          />
        </div>
      )}

      <button
        data-action="start-proof"
        onClick={onStartProof}
        disabled={points.length < 2}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          border: 'none',
          background: points.length >= 2 ? '#10b981' : 'rgba(16, 185, 129, 0.3)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: points.length >= 2 ? 'pointer' : 'default',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        Start Proof
      </button>
    </div>
  )
}
