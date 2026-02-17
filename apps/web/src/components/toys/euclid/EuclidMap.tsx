'use client'

import { useMemo, useState } from 'react'
import {
  IMPLEMENTED_PROPS,
  getNodeStatus,
  getVisibleNodes,
  computeLayout,
  getProposition,
  getPrerequisites,
} from './data/propositionGraph'
import type { NodeStatus, LayoutEdge } from './data/propositionGraph'

// ---------------------------------------------------------------------------
// Colors and sizing
// ---------------------------------------------------------------------------

const NODE_W = 130
const NODE_H = 48   // layout computation height (matches pre-computed layout)
const RENDER_H = 108 // rendered height (room for diagram + text)
const NODE_RX = 8
const ICON_SIZE = 44 // geometric thumbnail area

const STATUS_STYLES: Record<NodeStatus, {
  fill: string
  stroke: string
  textColor: string
  strokeDash?: string
  opacity: number
}> = {
  completed: {
    fill: 'rgba(16, 185, 129, 0.12)',
    stroke: '#10b981',
    textColor: '#065f46',
    opacity: 1,
  },
  available: {
    fill: 'rgba(59, 130, 246, 0.08)',
    stroke: '#3b82f6',
    textColor: '#1e40af',
    opacity: 1,
  },
  locked: {
    fill: 'rgba(156, 163, 175, 0.08)',
    stroke: '#9ca3af',
    textColor: '#6b7280',
    opacity: 0.7,
  },
  'coming-soon': {
    fill: 'rgba(156, 163, 175, 0.04)',
    stroke: '#d1d5db',
    textColor: '#9ca3af',
    strokeDash: '4 3',
    opacity: 0.5,
  },
}

// ---------------------------------------------------------------------------
// Geometric thumbnails per proposition / thematic block
// ---------------------------------------------------------------------------

import type { ThematicBlock } from './data/book1'

/**
 * Small SVG geometric diagram for a proposition node.
 * Specific icons for implemented props; block-based for the rest.
 */
function PropThumbnail({ propId, block, color }: {
  propId: number
  block: ThematicBlock
  color: string
}) {
  const s = ICON_SIZE
  const c = s / 2 // center
  const o = 0.65  // opacity
  const sw = 1.5  // base stroke width

  // Specific diagrams for implemented propositions
  switch (propId) {
    case 1: // Equilateral triangle on a line
      return (
        <g opacity={o}>
          <line x1={3} y1={s - 3} x2={s - 3} y2={s - 3} stroke={color} strokeWidth={sw} />
          <polygon points={`${c},3 ${3},${s - 3} ${s - 3},${s - 3}`}
            fill="none" stroke={color} strokeWidth={sw * 0.9} />
          {/* Two construction arcs */}
          <path d={`M ${s * 0.15} ${s * 0.55} A ${s * 0.45} ${s * 0.45} 0 0 1 ${c} ${3}`}
            fill="none" stroke={color} strokeWidth={sw * 0.5} strokeDasharray="3 2" />
          <path d={`M ${s * 0.85} ${s * 0.55} A ${s * 0.45} ${s * 0.45} 0 0 0 ${c} ${3}`}
            fill="none" stroke={color} strokeWidth={sw * 0.5} strokeDasharray="3 2" />
        </g>
      )
    case 2: // Transfer a segment to a point
      return (
        <g opacity={o}>
          <circle cx={5} cy={c} r={2.5} fill={color} />
          <line x1={8} y1={c} x2={s - 4} y2={c} stroke={color} strokeWidth={sw} />
          <circle cx={s - 4} cy={c} r={2.5} fill={color} />
          <line x1={5} y1={c + 10} x2={5 + (s * 0.55)} y2={c + 10}
            stroke={color} strokeWidth={sw} strokeDasharray="3 2" />
          <circle cx={5} cy={c + 10} r={2} fill={color} fillOpacity={0.5} />
        </g>
      )
    case 3: // Cut the greater to equal the less
      return (
        <g opacity={o}>
          <line x1={4} y1={c - 5} x2={s - 4} y2={c - 5} stroke={color} strokeWidth={sw * 1.2} />
          <line x1={4} y1={c + 5} x2={c + 4} y2={c + 5} stroke={color} strokeWidth={sw * 1.2} />
          <line x1={c + 4} y1={c - 9} x2={c + 4} y2={c + 9}
            stroke={color} strokeWidth={sw * 0.7} strokeDasharray="2.5 1.5" />
        </g>
      )
  }

  // Block-based generic icons
  switch (block) {
    case 'basic-constructions':
      // Compass arc
      return (
        <g opacity={o}>
          <circle cx={c} cy={c - 2} r={2} fill={color} />
          <line x1={c} y1={c - 2} x2={c - 10} y2={s - 3} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={c} y1={c - 2} x2={c + 10} y2={s - 3} stroke={color} strokeWidth={sw * 0.8} />
          <path d={`M ${c - 12} ${s - 2} Q ${c} ${s - 10} ${c + 12} ${s - 2}`}
            fill="none" stroke={color} strokeWidth={sw * 0.8} />
        </g>
      )
    case 'triangle-congruence':
      // Two overlapping triangles (≅)
      return (
        <g opacity={o}>
          <polygon points={`${c - 3},4 ${4},${s - 4} ${s - 8},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw} />
          <polygon points={`${c + 3},4 ${8},${s - 4} ${s - 4},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw * 0.8} strokeDasharray="3 2" />
        </g>
      )
    case 'fundamental-constructions':
      // Angle with bisector
      return (
        <g opacity={o}>
          <line x1={5} y1={s - 4} x2={5} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={5} y1={s - 4} x2={s - 4} y2={s - 4} stroke={color} strokeWidth={sw} />
          <line x1={5} y1={s - 4} x2={s - 6} y2={6}
            stroke={color} strokeWidth={sw * 0.8} strokeDasharray="3 2" />
          {/* Right angle mark */}
          <polyline points={`${5},${s - 10} ${11},${s - 10} ${11},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw * 0.6} />
        </g>
      )
    case 'angle-arithmetic':
      // Two angles at a point (vertical angles)
      return (
        <g opacity={o}>
          <line x1={c} y1={s - 4} x2={3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={c} y1={s - 4} x2={s - 3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={3} y1={s - 4} x2={s - 3} y2={s - 4} stroke={color} strokeWidth={sw} />
        </g>
      )
    case 'triangle-inequalities':
      // Triangle with one highlighted side
      return (
        <g opacity={o}>
          <polygon points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw * 0.8} />
          <line x1={4} y1={s - 4} x2={s - 4} y2={s - 4} stroke={color} strokeWidth={sw * 1.8} />
        </g>
      )
    case 'parallel-lines':
      // Two parallel lines with transversal
      return (
        <g opacity={o}>
          <line x1={3} y1={12} x2={s - 3} y2={12} stroke={color} strokeWidth={sw} />
          <line x1={3} y1={s - 12} x2={s - 3} y2={s - 12} stroke={color} strokeWidth={sw} />
          <line x1={s - 10} y1={3} x2={10} y2={s - 3}
            stroke={color} strokeWidth={sw * 0.8} strokeDasharray="3 2" />
        </g>
      )
    case 'construction-from-parts':
      // Triangle constructed from given parts
      return (
        <g opacity={o}>
          <polygon points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw} />
          <path d={`M ${9} ${s - 8} A 6 6 0 0 1 ${10} ${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw * 0.7} />
          <path d={`M ${s - 9} ${s - 8} A 6 6 0 0 0 ${s - 10} ${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw * 0.7} />
        </g>
      )
    case 'parallelogram-basics':
      // Parallelogram with diagonal
      return (
        <g opacity={o}>
          <polygon points={`${10},${5} ${s - 3},${5} ${s - 10},${s - 5} ${3},${s - 5}`}
            fill="none" stroke={color} strokeWidth={sw} />
          <line x1={10} y1={5} x2={s - 10} y2={s - 5}
            stroke={color} strokeWidth={sw * 0.7} strokeDasharray="3 2" />
        </g>
      )
    case 'the-finale':
      // Right triangle with squares on sides (Pythagorean)
      return (
        <g opacity={o}>
          <polygon points={`${5},${s - 5} ${5},${10} ${s - 8},${s - 5}`}
            fill="none" stroke={color} strokeWidth={sw} />
          {/* Right angle mark */}
          <polyline points={`${5},${s - 10} ${10},${s - 10} ${10},${s - 5}`}
            fill="none" stroke={color} strokeWidth={sw * 0.7} />
          {/* Small square on hypotenuse hint */}
          <rect x={s - 15} y={6} width={8} height={8}
            fill="none" stroke={color} strokeWidth={sw * 0.5} />
        </g>
      )
    case 'more-congruence':
      // Two triangles with matching marks (SAS/ASA)
      return (
        <g opacity={o}>
          <polygon points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw} />
          {/* Tick marks on two sides */}
          <line x1={c - 5} y1={c - 2} x2={c - 3} y2={c + 1} stroke={color} strokeWidth={sw * 0.7} />
          <line x1={c + 5} y1={c - 2} x2={c + 3} y2={c + 1} stroke={color} strokeWidth={sw * 0.7} />
        </g>
      )
    case 'area-theory':
      // Triangle inscribed in rectangle (area)
      return (
        <g opacity={o}>
          <rect x={4} y={4} width={s - 8} height={s - 8}
            fill="none" stroke={color} strokeWidth={sw * 0.7} />
          <polygon points={`${4},${s - 4} ${c},${4} ${s - 4},${s - 4}`}
            fill="none" stroke={color} strokeWidth={sw} />
        </g>
      )
    case 'application-of-areas':
      // Rectangle with shaded region
      return (
        <g opacity={o}>
          <rect x={4} y={6} width={s - 8} height={s - 12}
            fill="none" stroke={color} strokeWidth={sw} />
          <line x1={4} y1={6} x2={s - 4} y2={s - 6}
            stroke={color} strokeWidth={sw * 0.7} strokeDasharray="3 2" />
          <rect x={4} y={6} width={(s - 8) / 2} height={(s - 12) / 2}
            fill={color} fillOpacity={0.15} stroke="none" />
        </g>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Edge helpers — simplify, trim to node borders, smooth Catmull-Rom spline
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number }

/**
 * Remove near-collinear intermediate points (perpendicular distance < epsilon).
 * Keeps first and last points unconditionally.
 */
function simplifyPoints(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts
  const result = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = pts[i]
    const next = pts[i + 1]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    const dist = Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / len
    if (dist > epsilon) {
      result.push(curr)
    }
  }
  result.push(pts[pts.length - 1])
  return result
}

/**
 * Find where a ray from a rect's center toward an external point
 * intersects the rect border. Handles all 4 sides.
 */
function rectBorderPoint(
  cx: number, cy: number,
  w: number, h: number,
  px: number, py: number,
): Pt {
  const dx = px - cx
  const dy = py - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy + h / 2 }

  const halfW = w / 2
  const halfH = h / 2
  let t = Infinity

  // Side intersections (left/right)
  if (dx !== 0) {
    const tSide = (dx > 0 ? halfW : -halfW) / dx
    if (tSide > 0 && Math.abs(dy * tSide) <= halfH) t = Math.min(t, tSide)
  }
  // Top/bottom intersections
  if (dy !== 0) {
    const tVert = (dy > 0 ? halfH : -halfH) / dy
    if (tVert > 0 && Math.abs(dx * tVert) <= halfW) t = Math.min(t, tVert)
  }

  return { x: cx + dx * t, y: cy + dy * t }
}

/**
 * Trim edge endpoints to node borders using ray-rect intersection.
 * Handles edges exiting/entering from any side of the node.
 */
function trimToBorders(
  pts: Pt[],
  srcX: number, srcY: number,
  tgtX: number, tgtY: number,
): Pt[] {
  if (pts.length < 2) return pts
  const result = pts.map(p => ({ ...p }))

  // Trim start → source border (ray from center toward next point)
  result[0] = rectBorderPoint(srcX, srcY, NODE_W, RENDER_H, result[1].x, result[1].y)

  // Trim end → target border (ray from center toward prev point)
  const last = result.length - 1
  result[last] = rectBorderPoint(tgtX, tgtY, NODE_W, RENDER_H, result[last - 1].x, result[last - 1].y)

  return result
}

/**
 * Convert points to SVG path using Catmull-Rom → cubic bezier.
 */
function pointsToPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  }

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[0]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[pts.length - 1]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EuclidMapProps {
  completed: Set<number>
  onSelectProp: (propId: number) => void
}

export function EuclidMap({ completed, onSelectProp }: EuclidMapProps) {
  const [showAll, setShowAll] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)

  const completedCount = completed.size
  const totalImplemented = IMPLEMENTED_PROPS.size

  // Compute visible nodes + layout (dagre-powered)
  const visibleIds = useMemo(
    () => getVisibleNodes(completed, showAll),
    [completed, showAll],
  )

  const { nodes: layout, edges } = useMemo(
    () => computeLayout(visibleIds),
    [visibleIds],
  )

  // Compute SVG viewBox
  const viewBox = useMemo(() => {
    if (layout.size === 0) return '0 0 400 300'
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const pos of layout.values()) {
      minX = Math.min(minX, pos.x - NODE_W / 2)
      maxX = Math.max(maxX, pos.x + NODE_W / 2)
      minY = Math.min(minY, pos.y - RENDER_H / 2)
      maxY = Math.max(maxY, pos.y + RENDER_H / 2)
    }
    // Also account for edge routing points
    for (const edge of edges) {
      for (const pt of edge.points) {
        minX = Math.min(minX, pt.x - 5)
        maxX = Math.max(maxX, pt.x + 5)
        minY = Math.min(minY, pt.y - 5)
        maxY = Math.max(maxY, pt.y + 5)
      }
    }
    const padX = 20
    const padY = 20
    const contentW = maxX - minX + padX * 2
    const contentH = maxY - minY + padY * 2
    const w = Math.max(contentW, 400)
    const offsetX = minX - padX - (w - contentW) / 2
    return `${offsetX} ${minY - padY} ${w} ${contentH}`
  }, [layout, edges])

  // Tooltip info for hovered locked node
  const hoveredInfo = useMemo(() => {
    if (hoveredNode === null) return null
    const status = getNodeStatus(hoveredNode, completed)
    if (status !== 'locked') return null
    const deps = getPrerequisites(hoveredNode)
    const missing = deps.filter(d => !completed.has(d))
    return { propId: hoveredNode, missing }
  }, [hoveredNode, completed])

  return (
    <div
      data-component="euclid-map"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAFAF0',
      }}
    >
      {/* Header bar */}
      <div
        data-element="map-header"
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(203, 213, 225, 0.4)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'Georgia, serif',
              color: '#1e293b',
            }}
          >
            Book I
          </span>
          <span
            style={{
              fontSize: 13,
              color: '#6b7280',
              fontFamily: 'Georgia, serif',
            }}
          >
            {completedCount} of {totalImplemented} complete
          </span>
        </div>

        <button
          type="button"
          data-action="toggle-show-all"
          onClick={() => setShowAll(prev => !prev)}
          style={{
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'system-ui, sans-serif',
            background: showAll ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
            color: showAll ? '#3b82f6' : '#6b7280',
            border: `1px solid ${showAll ? '#93c5fd' : '#d1d5db'}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {showAll ? 'Show available' : 'Show all 48'}
        </button>
      </div>

      {/* SVG map — scrollable */}
      <div
        data-element="map-viewport"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '24px 20px',
        }}
      >
        <svg
          data-element="map-svg"
          viewBox={viewBox}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 900,
            margin: '0 auto',
          }}
        >
          {/* Arrowhead marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="4"
              markerHeight="3"
              refX="3.5"
              refY="1.5"
              orient="auto"
            >
              <polygon points="0 0, 4 1.5, 0 3" fill="#cbd5e1" fillOpacity={0.6} />
            </marker>
          </defs>

          {/* Edges — simplified, trimmed, with arrowheads */}
          {edges.map((edge) => {
            const srcPos = layout.get(edge.from)
            const tgtPos = layout.get(edge.to)
            if (!srcPos || !tgtPos) return null

            const trimmed = trimToBorders(edge.points, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y)
            const simplified = simplifyPoints(trimmed, 4)
            const d = pointsToPath(simplified)
            if (!d) return null

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                data-element="map-edge"
                d={d}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={3}
                strokeOpacity={0.4}
                markerEnd="url(#arrowhead)"
              />
            )
          })}

          {/* Nodes */}
          {visibleIds.map(id => {
            const pos = layout.get(id)
            if (!pos) return null
            const status = getNodeStatus(id, completed)
            const style = STATUS_STYLES[status]
            const prop = getProposition(id)
            const isClickable = status === 'completed' || status === 'available'
            const titleLines = prop ? wrapTitle(prop.title, 20) : []

            // Vertical layout: thumbnail | number | title lines
            const topY = pos.y - RENDER_H / 2
            const thumbCenterY = topY + 5 // top of thumbnail area
            const numberY = topY + ICON_SIZE + 12
            const titleStartY = numberY + 13

            return (
              <g
                key={id}
                data-element="map-node"
                data-prop-id={id}
                data-status={status}
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  opacity: style.opacity,
                }}
                onClick={() => isClickable && onSelectProp(id)}
                onMouseEnter={() => setHoveredNode(id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Opaque background so edges are occluded behind node */}
                <rect
                  x={pos.x - NODE_W / 2}
                  y={topY}
                  width={NODE_W}
                  height={RENDER_H}
                  rx={NODE_RX}
                  fill="#FAFAF0"
                />
                <rect
                  x={pos.x - NODE_W / 2}
                  y={topY}
                  width={NODE_W}
                  height={RENDER_H}
                  rx={NODE_RX}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={status === 'available' ? 2 : 1.5}
                  strokeDasharray={style.strokeDash}
                />

                {/* Geometric thumbnail */}
                {prop && (
                  <g transform={`translate(${pos.x - ICON_SIZE / 2}, ${thumbCenterY})`}>
                    <PropThumbnail propId={id} block={prop.block} color={style.textColor} />
                  </g>
                )}

                {/* Checkmark for completed */}
                {status === 'completed' && (
                  <text
                    x={pos.x + NODE_W / 2 - 14}
                    y={topY + 10}
                    fontSize={11}
                    fill="#10b981"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontWeight={700}
                  >
                    ✓
                  </text>
                )}

                {/* Prop number */}
                <text
                  x={pos.x}
                  y={numberY}
                  fontSize={12}
                  fontWeight={700}
                  fontFamily="Georgia, serif"
                  fill={style.textColor}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  I.{id}
                </text>

                {/* Wrapped title (up to 3 lines) */}
                {titleLines.map((line, i, arr) => (
                  <text
                    key={i}
                    x={pos.x}
                    y={titleStartY + i * 10}
                    fontSize={8}
                    fontFamily="Georgia, serif"
                    fill={style.textColor}
                    textAnchor="middle"
                    dominantBaseline="central"
                    opacity={0.65}
                  >
                    {i === arr.length - 1 && line.length >= 20 ? line.slice(0, 19) + '…' : line}
                  </text>
                ))}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Tooltip for locked nodes */}
      {hoveredInfo && (
        <div
          data-element="map-tooltip"
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(17, 24, 39, 0.92)',
            color: '#e5e7eb',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          Requires: {hoveredInfo.missing.map(d => `I.${d}`).join(', ')}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Word-wrap a title into lines of at most `maxLen` characters.
 * Breaks on word boundaries; returns at most 3 lines.
 */
function wrapTitle(title: string, maxLen: number): string[] {
  if (title.length <= maxLen) return [title]
  const words = title.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > maxLen && current) {
      lines.push(current)
      current = word
      if (lines.length >= 3) break
    } else {
      current = candidate
    }
  }
  if (current && lines.length < 3) lines.push(current)
  return lines.slice(0, 3)
}
