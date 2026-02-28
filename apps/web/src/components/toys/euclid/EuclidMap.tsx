'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const NODE_H = 48 // layout computation height (matches pre-computed layout)
const RENDER_H = 120 // rendered height (room for diagram + text)
const Y_SCALE = 1.5 // stretch Y to add vertical breathing room between taller nodes
const NODE_RX = 8
const ICON_SIZE = 44 // geometric thumbnail area
const PREVIEW_THUMB_W = 100 // real construction preview width (wider to match canvas aspect ratio)
const PREVIEW_THUMB_H = 56 // real construction preview height

const STATUS_STYLES: Record<
  NodeStatus,
  {
    fill: string
    stroke: string
    textColor: string
    strokeDash?: string
    opacity: number
  }
> = {
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
    opacity: 1,
  },
}

// ---------------------------------------------------------------------------
// Geometric thumbnails per proposition / thematic block
// ---------------------------------------------------------------------------

import { usePropPreviews } from './render/usePropPreviews'
import { ToyDebugPanel, DebugSlider } from '../ToyDebugPanel'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { ThematicBlock } from './data/book1'

/** Subtle accent colors per thematic block — muted but distinctive. */
const BLOCK_ACCENTS: Record<ThematicBlock, string> = {
  'basic-constructions': '#3b82f6', // blue
  'triangle-congruence': '#8b5cf6', // violet
  'fundamental-constructions': '#0ea5e9', // sky
  'angle-arithmetic': '#f59e0b', // amber
  'triangle-inequalities': '#ef4444', // red
  'construction-from-parts': '#10b981', // emerald
  'more-congruence': '#a855f7', // purple
  'parallel-lines': '#06b6d4', // cyan
  'parallelogram-basics': '#f97316', // orange
  'area-theory': '#ec4899', // pink
  'application-of-areas': '#d946ef', // fuchsia
  'the-finale': '#eab308', // yellow
}

/**
 * Small SVG geometric diagram for a proposition node.
 * Specific icons for implemented props; block-based for the rest.
 */
function PropThumbnail({
  propId,
  block,
  color,
}: {
  propId: number
  block: ThematicBlock
  color: string
}) {
  const s = ICON_SIZE
  const c = s / 2 // center
  const o = 0.65 // opacity
  const accent = BLOCK_ACCENTS[block] ?? color
  const sw = 1.5 // base stroke width

  // Specific diagrams for implemented propositions
  switch (propId) {
    case 1: // Equilateral triangle on a line
      return (
        <g opacity={o}>
          <line x1={3} y1={s - 3} x2={s - 3} y2={s - 3} stroke={accent} strokeWidth={sw} />
          <polygon
            points={`${c},3 ${3},${s - 3} ${s - 3},${s - 3}`}
            fill={accent}
            fillOpacity={0.12}
            stroke={accent}
            strokeWidth={sw * 0.9}
          />
          {/* Two construction arcs */}
          <path
            d={`M ${s * 0.15} ${s * 0.55} A ${s * 0.45} ${s * 0.45} 0 0 1 ${c} ${3}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.5}
            strokeDasharray="3 2"
          />
          <path
            d={`M ${s * 0.85} ${s * 0.55} A ${s * 0.45} ${s * 0.45} 0 0 0 ${c} ${3}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.5}
            strokeDasharray="3 2"
          />
        </g>
      )
    case 2: // Transfer a segment to a point
      return (
        <g opacity={o}>
          <circle cx={5} cy={c} r={2.5} fill={accent} />
          <line x1={8} y1={c} x2={s - 4} y2={c} stroke={accent} strokeWidth={sw} />
          <circle cx={s - 4} cy={c} r={2.5} fill={accent} />
          <line
            x1={5}
            y1={c + 10}
            x2={5 + s * 0.55}
            y2={c + 10}
            stroke={accent}
            strokeWidth={sw}
            strokeDasharray="3 2"
          />
          <circle cx={5} cy={c + 10} r={2} fill={accent} fillOpacity={0.5} />
        </g>
      )
    case 3: // Cut the greater to equal the less
      return (
        <g opacity={o}>
          <line x1={4} y1={c - 5} x2={s - 4} y2={c - 5} stroke={accent} strokeWidth={sw * 1.2} />
          <line x1={4} y1={c + 5} x2={c + 4} y2={c + 5} stroke={accent} strokeWidth={sw * 1.2} />
          <line
            x1={c + 4}
            y1={c - 9}
            x2={c + 4}
            y2={c + 9}
            stroke={accent}
            strokeWidth={sw * 0.7}
            strokeDasharray="2.5 1.5"
          />
        </g>
      )
  }

  // Block-based generic icons — use accent color for fills, color for strokes
  switch (block) {
    case 'basic-constructions':
      // Compass arc
      return (
        <g opacity={o}>
          <circle cx={c} cy={c - 2} r={2} fill={accent} />
          <line x1={c} y1={c - 2} x2={c - 10} y2={s - 3} stroke={color} strokeWidth={sw * 0.8} />
          <line x1={c} y1={c - 2} x2={c + 10} y2={s - 3} stroke={color} strokeWidth={sw * 0.8} />
          <path
            d={`M ${c - 12} ${s - 2} Q ${c} ${s - 10} ${c + 12} ${s - 2}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.8}
          />
        </g>
      )
    case 'triangle-congruence':
      // Two overlapping triangles (≅)
      return (
        <g opacity={o}>
          <polygon
            points={`${c - 3},4 ${4},${s - 4} ${s - 8},${s - 4}`}
            fill={accent}
            fillOpacity={0.1}
            stroke={accent}
            strokeWidth={sw}
          />
          <polygon
            points={`${c + 3},4 ${8},${s - 4} ${s - 4},${s - 4}`}
            fill="none"
            stroke={color}
            strokeWidth={sw * 0.8}
            strokeDasharray="3 2"
          />
        </g>
      )
    case 'fundamental-constructions':
      // Angle with bisector
      return (
        <g opacity={o}>
          <line x1={5} y1={s - 4} x2={5} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={5} y1={s - 4} x2={s - 4} y2={s - 4} stroke={color} strokeWidth={sw} />
          <line
            x1={5}
            y1={s - 4}
            x2={s - 6}
            y2={6}
            stroke={accent}
            strokeWidth={sw * 0.8}
            strokeDasharray="3 2"
          />
          {/* Right angle mark */}
          <polyline
            points={`${5},${s - 10} ${11},${s - 10} ${11},${s - 4}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.6}
          />
        </g>
      )
    case 'angle-arithmetic':
      // Two angles at a point (vertical angles)
      return (
        <g opacity={o}>
          <line x1={c} y1={s - 4} x2={3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={c} y1={s - 4} x2={s - 3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={3} y1={s - 4} x2={s - 3} y2={s - 4} stroke={accent} strokeWidth={sw} />
          {/* Angle arc highlight */}
          <path
            d={`M ${c - 6} ${s - 4} A 8 8 0 0 1 ${c - 3} ${s - 9}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
        </g>
      )
    case 'triangle-inequalities':
      // Triangle with one highlighted side
      return (
        <g opacity={o}>
          <polygon
            points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill={accent}
            fillOpacity={0.08}
            stroke={color}
            strokeWidth={sw * 0.8}
          />
          <line x1={4} y1={s - 4} x2={s - 4} y2={s - 4} stroke={accent} strokeWidth={sw * 1.8} />
        </g>
      )
    case 'parallel-lines':
      // Two parallel lines with transversal
      return (
        <g opacity={o}>
          <line x1={3} y1={12} x2={s - 3} y2={12} stroke={accent} strokeWidth={sw} />
          <line x1={3} y1={s - 12} x2={s - 3} y2={s - 12} stroke={accent} strokeWidth={sw} />
          <line
            x1={s - 10}
            y1={3}
            x2={10}
            y2={s - 3}
            stroke={color}
            strokeWidth={sw * 0.8}
            strokeDasharray="3 2"
          />
        </g>
      )
    case 'construction-from-parts':
      // Triangle constructed from given parts
      return (
        <g opacity={o}>
          <polygon
            points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill={accent}
            fillOpacity={0.1}
            stroke={color}
            strokeWidth={sw}
          />
          <path
            d={`M ${9} ${s - 8} A 6 6 0 0 1 ${10} ${s - 4}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
          <path
            d={`M ${s - 9} ${s - 8} A 6 6 0 0 0 ${s - 10} ${s - 4}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
        </g>
      )
    case 'parallelogram-basics':
      // Parallelogram with diagonal
      return (
        <g opacity={o}>
          <polygon
            points={`${10},${5} ${s - 3},${5} ${s - 10},${s - 5} ${3},${s - 5}`}
            fill={accent}
            fillOpacity={0.1}
            stroke={accent}
            strokeWidth={sw}
          />
          <line
            x1={10}
            y1={5}
            x2={s - 10}
            y2={s - 5}
            stroke={color}
            strokeWidth={sw * 0.7}
            strokeDasharray="3 2"
          />
        </g>
      )
    case 'the-finale':
      // Right triangle with squares on sides (Pythagorean)
      return (
        <g opacity={o}>
          <polygon
            points={`${5},${s - 5} ${5},${10} ${s - 8},${s - 5}`}
            fill={accent}
            fillOpacity={0.1}
            stroke={color}
            strokeWidth={sw}
          />
          {/* Right angle mark */}
          <polyline
            points={`${5},${s - 10} ${10},${s - 10} ${10},${s - 5}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
          {/* Small square on hypotenuse hint */}
          <rect
            x={s - 15}
            y={6}
            width={8}
            height={8}
            fill={accent}
            fillOpacity={0.15}
            stroke={accent}
            strokeWidth={sw * 0.5}
          />
        </g>
      )
    case 'more-congruence':
      // Two triangles with matching marks (SAS/ASA)
      return (
        <g opacity={o}>
          <polygon
            points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill={accent}
            fillOpacity={0.08}
            stroke={color}
            strokeWidth={sw}
          />
          {/* Tick marks on two sides */}
          <line
            x1={c - 5}
            y1={c - 2}
            x2={c - 3}
            y2={c + 1}
            stroke={accent}
            strokeWidth={sw * 0.9}
          />
          <line
            x1={c + 5}
            y1={c - 2}
            x2={c + 3}
            y2={c + 1}
            stroke={accent}
            strokeWidth={sw * 0.9}
          />
        </g>
      )
    case 'area-theory':
      // Triangle inscribed in rectangle (area)
      return (
        <g opacity={o}>
          <rect
            x={4}
            y={4}
            width={s - 8}
            height={s - 8}
            fill="none"
            stroke={color}
            strokeWidth={sw * 0.7}
          />
          <polygon
            points={`${4},${s - 4} ${c},${4} ${s - 4},${s - 4}`}
            fill={accent}
            fillOpacity={0.15}
            stroke={accent}
            strokeWidth={sw}
          />
        </g>
      )
    case 'application-of-areas':
      // Rectangle with shaded region
      return (
        <g opacity={o}>
          <rect
            x={4}
            y={6}
            width={s - 8}
            height={s - 12}
            fill="none"
            stroke={color}
            strokeWidth={sw}
          />
          <line
            x1={4}
            y1={6}
            x2={s - 4}
            y2={s - 6}
            stroke={color}
            strokeWidth={sw * 0.7}
            strokeDasharray="3 2"
          />
          <rect
            x={4}
            y={6}
            width={(s - 8) / 2}
            height={(s - 12) / 2}
            fill={accent}
            fillOpacity={0.2}
            stroke="none"
          />
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
function rectBorderPoint(cx: number, cy: number, w: number, h: number, px: number, py: number): Pt {
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
  srcX: number,
  srcY: number,
  tgtX: number,
  tgtY: number
): Pt[] {
  if (pts.length < 2) return pts
  const result = pts.map((p) => ({ ...p }))

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
  onSelectPlayground?: () => void
  hideHeader?: boolean
  showAll?: boolean
  onToggleShowAll?: () => void
}

export function EuclidMap({ completed, onSelectProp, onSelectPlayground, hideHeader, showAll: showAllProp, onToggleShowAll }: EuclidMapProps) {
  // showAll can be controlled externally (foundations page) or internally (main map page)
  const [showAllInternal, setShowAllInternal] = useState(false)
  const showAll = showAllProp ?? showAllInternal
  const setShowAll = onToggleShowAll ?? (() => setShowAllInternal((prev) => !prev))
  const [hoveredNode, setHoveredNode] = useState<number | null>(null)
  const [comingSoonOpacity, setComingSoonOpacity] = useState(1)
  const [rowWindow, setRowWindow] = useState(3) // how many rows from center to fit in viewport
  const previews = usePropPreviews()
  const { isVisualDebugEnabled } = useVisualDebugSafe()

  const completedCount = completed.size
  const totalImplemented = IMPLEMENTED_PROPS.size

  // Compute visible nodes + layout (dagre-powered)
  const visibleIds = useMemo(() => getVisibleNodes(completed, showAll), [completed, showAll])

  const { nodes: layout, edges } = useMemo(() => {
    const raw = computeLayout(visibleIds)
    // Scale Y coordinates to add vertical breathing room
    const scaledNodes = new Map<number, { x: number; y: number; level: number }>()
    for (const [id, pos] of raw.nodes) {
      scaledNodes.set(id, { x: pos.x, y: pos.y * Y_SCALE, level: pos.level })
    }
    const scaledEdges = raw.edges.map((e) => ({
      ...e,
      points: e.points.map((p) => ({ x: p.x, y: p.y * Y_SCALE })),
    }))
    return { nodes: scaledNodes, edges: scaledEdges }
  }, [visibleIds])

  // Compute SVG viewBox (static — used for normal map page)
  const viewBox = useMemo(() => {
    if (layout.size === 0) return '0 0 400 300'
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const pos of layout.values()) {
      const halfW = NODE_W / 2
      const halfH = RENDER_H / 2
      minX = Math.min(minX, pos.x - halfW)
      maxX = Math.max(maxX, pos.x + halfW)
      minY = Math.min(minY, pos.y - halfH)
      maxY = Math.max(maxY, pos.y + halfH)
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

  // -------------------------------------------------------------------------
  // Scroll-driven viewport (foundations page only)
  // The SVG is sticky in the viewport; scrolling pans/zooms through the graph.
  // -------------------------------------------------------------------------

  // Per-row metadata for scroll-driven viewport
  const rowMeta = useMemo(() => {
    if (!hideHeader || layout.size === 0) return null
    const byY = new Map<number, number[]>()
    for (const [, pos] of layout) {
      let xs = byY.get(pos.y)
      if (!xs) { xs = []; byY.set(pos.y, xs) }
      xs.push(pos.x)
    }
    const rows: { y: number; centerX: number; width: number }[] = []
    for (const [y, xs] of byY) {
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      rows.push({ y, centerX: (minX + maxX) / 2, width: maxX - minX + NODE_W })
    }
    rows.sort((a, b) => a.y - b.y)

    // Global center X for horizontal panning
    let gMinX = Infinity, gMaxX = -Infinity
    for (const pos of layout.values()) {
      gMinX = Math.min(gMinX, pos.x)
      gMaxX = Math.max(gMaxX, pos.x)
    }
    return { rows, globalCenterX: (gMinX + gMaxX) / 2 }
  }, [layout, hideHeader])

  const stickyRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const [scrollViewBox, setScrollViewBox] = useState<string | null>(null)

  const updateScrollViewBox = useCallback(() => {
    const container = containerRef.current
    const sticky = stickyRef.current
    if (!container || !sticky || !rowMeta || rowMeta.rows.length === 0) return

    const stickyH = sticky.clientHeight
    const stickyW = sticky.clientWidth
    if (stickyH === 0 || stickyW === 0) return

    // Compute scroll progress using the container's position relative to the scroll parent
    const scrollParent = scrollContainerRef.current
    let scrollTop: number
    if (scrollParent) {
      // Container's offset within the scroll parent minus current scroll position
      const containerTop = container.offsetTop - scrollParent.offsetTop
      const scrolled = scrollParent.scrollTop - containerTop
      scrollTop = Math.max(0, scrolled)
    } else {
      scrollTop = Math.max(0, -container.getBoundingClientRect().top)
    }
    const scrollRange = container.scrollHeight - stickyH
    const progress = scrollRange > 0 ? Math.min(1, scrollTop / scrollRange) : 0

    const { rows, globalCenterX } = rowMeta
    const firstY = rows[0].y
    const lastY = rows[rows.length - 1].y
    const currentY = firstY + progress * (lastY - firstY)

    // Find the segment [i, i+1] that currentY falls in
    const PAD = 140 // padding around row content
    const MIN_VB_W = 280 // minimum viewBox width (for single-node rows)
    const rawWidths = rows.map((r) => Math.max(MIN_VB_W, r.width + PAD))

    // Expand each row's width to the max of itself and (n-1) neighbors on each side
    // rowWindow=1: just center row, 2: center ± 1, 3: center ± 2
    const radius = rowWindow - 1
    const rowWidths = rawWidths.map((_, i) => {
      let maxW = rawWidths[i]
      for (let d = 1; d <= radius; d++) {
        if (i - d >= 0) maxW = Math.max(maxW, rawWidths[i - d])
        if (i + d < rawWidths.length) maxW = Math.max(maxW, rawWidths[i + d])
      }
      return maxW
    })
    const rowCenters = rows.map((r) => r.centerX)

    let segIdx = 0
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i].y <= currentY && rows[i + 1].y > currentY) {
        segIdx = i
        break
      }
      if (i === rows.length - 2) segIdx = i // clamp to last segment
    }
    const t =
      rows[segIdx + 1].y === rows[segIdx].y
        ? 0
        : (currentY - rows[segIdx].y) / (rows[segIdx + 1].y - rows[segIdx].y)

    // Catmull-Rom interpolation through all row waypoints for smooth zoom/pan
    // Uses 4 control points: P0 (prev), P1 (current), P2 (next), P3 (next-next)
    // Clamp at boundaries by repeating endpoints
    const catmullRom = (values: number[], idx: number, u: number) => {
      const p0 = values[Math.max(0, idx - 1)]
      const p1 = values[idx]
      const p2 = values[Math.min(values.length - 1, idx + 1)]
      const p3 = values[Math.min(values.length - 1, idx + 2)]
      const u2 = u * u
      const u3 = u2 * u
      return 0.5 * (
        2 * p1 +
        (-p0 + p2) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * u3
      )
    }

    const vbW = catmullRom(rowWidths, segIdx, t)
    const centerX = catmullRom(rowCenters, segIdx, t)

    // ViewBox height proportional to width (matching container aspect ratio)
    const aspect = stickyW / stickyH
    const vbH = vbW / aspect

    setScrollViewBox(`${centerX - vbW / 2} ${currentY - vbH / 2} ${vbW} ${vbH}`)
  }, [rowMeta, rowWindow])

  // Find the actual scroll container and attach scroll listener
  useEffect(() => {
    if (!hideHeader || !rowMeta) return
    // Walk up from the container to find the scrollable ancestor
    let el: HTMLElement | null = containerRef.current
    while (el) {
      const style = getComputedStyle(el)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainerRef.current = el
        break
      }
      el = el.parentElement
    }
    const scrollTarget = scrollContainerRef.current ?? window
    scrollTarget.addEventListener('scroll', updateScrollViewBox, { passive: true } as EventListenerOptions)
    window.addEventListener('resize', updateScrollViewBox, { passive: true })
    // Initial computation
    updateScrollViewBox()
    return () => {
      scrollTarget.removeEventListener('scroll', updateScrollViewBox)
      window.removeEventListener('resize', updateScrollViewBox)
    }
  }, [hideHeader, rowMeta, updateScrollViewBox])

  // Tooltip info for hovered locked node
  const hoveredInfo = useMemo(() => {
    if (hoveredNode === null) return null
    const status = getNodeStatus(hoveredNode, completed)
    if (status !== 'locked') return null
    const deps = getPrerequisites(hoveredNode)
    const missing = deps.filter((d) => !completed.has(d))
    return { propId: hoveredNode, missing }
  }, [hoveredNode, completed])

  // SVG content shared between scroll-driven and static viewport modes
  const svgContent = (
    <>
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

        const trimmed = trimToBorders(
          edge.points,
          srcPos.x, srcPos.y,
          tgtPos.x, tgtPos.y
        )
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
      {visibleIds.map((id) => {
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
        const thumbH = previews.has(id) ? PREVIEW_THUMB_H : ICON_SIZE
        const numberY = topY + thumbH + 12
        const titleStartY = numberY + 13

        return (
          <g
            key={id}
            data-element="map-node"
            data-prop-id={id}
            data-status={status}
            style={{
              cursor: isClickable ? 'pointer' : 'default',
              opacity: status === 'coming-soon' ? comingSoonOpacity : style.opacity,
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

            {/* Geometric thumbnail — real construction preview or generic icon */}
            {prop &&
              (previews.get(id) ? (
                <image
                  href={previews.get(id)}
                  x={pos.x - PREVIEW_THUMB_W / 2}
                  y={thumbCenterY}
                  width={PREVIEW_THUMB_W}
                  height={PREVIEW_THUMB_H}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : (
                <g transform={`translate(${pos.x - ICON_SIZE / 2}, ${thumbCenterY})`}>
                  <PropThumbnail propId={id} block={prop.block} color={style.textColor} />
                </g>
              ))}

            {/* Type badge (P = Problem/construction, T = Theorem) */}
            {prop && (
              <g data-element="type-badge">
                <rect
                  x={pos.x - NODE_W / 2 + 4}
                  y={topY + 4}
                  width={14}
                  height={14}
                  rx={3}
                  fill={prop.type === 'construction' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)'}
                />
                <text
                  x={pos.x - NODE_W / 2 + 11}
                  y={topY + 11}
                  fontSize={8}
                  fontWeight={700}
                  fontFamily="system-ui, sans-serif"
                  fill={prop.type === 'construction' ? '#d97706' : '#4f46e5'}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {prop.type === 'construction' ? 'P' : 'T'}
                </text>
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
    </>
  )

  return (
    <div
      data-component="euclid-map"
      style={{
        width: '100%',
        ...(hideHeader ? {} : { height: '100%' }),
        display: 'flex',
        flexDirection: 'column',
        background: '#FAFAF0',
      }}
    >
      {/* Header bar */}
      {!hideHeader && (
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

          <div style={{ display: 'flex', gap: 8 }}>
            {onSelectPlayground && (
              <button
                type="button"
                data-action="open-playground"
                onClick={onSelectPlayground}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'system-ui, sans-serif',
                  background: 'rgba(245, 158, 11, 0.08)',
                  color: '#d97706',
                  border: '1px solid #fbbf24',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Playground
              </button>
            )}
            <button
              type="button"
              data-action="toggle-show-all"
              onClick={setShowAll}
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
        </div>
      )}

      {/* SVG map */}
      {hideHeader ? (
        /* Scroll-driven viewport: sticky SVG + scroll spacer */
        <div
          ref={containerRef}
          data-element="map-viewport-scroll"
          style={{ position: 'relative' }}
        >
          <div
            ref={stickyRef}
            style={{
              position: 'sticky',
              top: 'calc(var(--app-nav-height, 0px) + 3rem)',
              height: 'calc(100vh - var(--app-nav-height, 0px) - 3rem)',
            }}
          >
            <svg
              data-element="map-svg"
              viewBox={scrollViewBox ?? viewBox}
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}
            >
              {svgContent}
            </svg>
          </div>
          {/* Spacer creates scroll range — height proportional to graph extent */}
          <div style={{ height: rowMeta ? (rowMeta.rows[rowMeta.rows.length - 1].y - rowMeta.rows[0].y) * 1.5 : 0 }} />
        </div>
      ) : (
        /* Normal scrollable map */
        <div
          data-element="map-viewport"
          style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px 20px' }}
        >
          <svg
            data-element="map-svg"
            viewBox={viewBox}
            style={{ display: 'block', width: '100%', maxWidth: 900, margin: '0 auto' }}
          >
            {svgContent}
          </svg>
        </div>
      )}

      {/* Legend — type badges */}
      {!hideHeader && (
        <div
          data-element="map-legend"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 20,
            padding: '12px 0 4px',
            fontSize: 12,
            fontFamily: 'system-ui, sans-serif',
            color: '#6b7280',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: 3,
                background: 'rgba(245,158,11,0.15)',
                color: '#d97706',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              P
            </span>
            Problem (construction)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: 3,
                background: 'rgba(99,102,241,0.12)',
                color: '#4f46e5',
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              T
            </span>
            Theorem
          </span>
        </div>
      )}

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
          Requires: {hoveredInfo.missing.map((d) => `I.${d}`).join(', ')}
        </div>
      )}

      <ToyDebugPanel title="Euclid Map">
        <DebugSlider
          label="Coming-soon opacity"
          value={comingSoonOpacity}
          min={0}
          max={1}
          step={0.05}
          onChange={setComingSoonOpacity}
          formatValue={(v) => v.toFixed(2)}
        />
        {hideHeader && (
          <DebugSlider
            label="Row window"
            value={rowWindow}
            min={1}
            max={3}
            step={1}
            onChange={setRowWindow}
            formatValue={(v) => v === 1 ? '1 (center only)' : `${v} (±${v - 1} rows)`}
          />
        )}
      </ToyDebugPanel>
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
