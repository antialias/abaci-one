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
const NODE_H = 48
const NODE_RX = 10

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
// Edge path helper — convert dagre routing points to SVG path
// ---------------------------------------------------------------------------

function edgeToPath(edge: LayoutEdge): string {
  const pts = edge.points
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  }
  // Use a smooth cubic bezier through the routing points
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const next = pts[i + 1]
    const cpx1 = (prev.x + curr.x) / 2
    const cpy1 = curr.y
    const cpx2 = (curr.x + next.x) / 2
    const cpy2 = curr.y
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${next.x} ${next.y}`
  }
  // If only 3 points, the loop above handles it. For 2+ intermediate points,
  // we get a smooth path. For exactly 2 points already handled above.
  if (pts.length === 3) {
    // Override with a simple cubic bezier
    const [p0, p1, p2] = pts
    d = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`
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
      minY = Math.min(minY, pos.y - NODE_H / 2)
      maxY = Math.max(maxY, pos.y + NODE_H / 2)
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
          {/* Edges — dagre-routed paths */}
          {edges.map((edge) => {
            const d = edgeToPath(edge)
            if (!d) return null
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                data-element="map-edge"
                d={d}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeOpacity={0.4}
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
                <rect
                  x={pos.x - NODE_W / 2}
                  y={pos.y - NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={NODE_RX}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={status === 'available' ? 2 : 1.5}
                  strokeDasharray={style.strokeDash}
                />

                {/* Checkmark for completed */}
                {status === 'completed' && (
                  <text
                    x={pos.x - NODE_W / 2 + 14}
                    y={pos.y}
                    fontSize={14}
                    fill="#10b981"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    ✓
                  </text>
                )}

                {/* Prop number */}
                <text
                  x={pos.x}
                  y={pos.y - 7}
                  fontSize={14}
                  fontWeight={700}
                  fontFamily="Georgia, serif"
                  fill={style.textColor}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  I.{id}
                </text>

                {/* Short title */}
                {prop && (
                  <text
                    x={pos.x}
                    y={pos.y + 11}
                    fontSize={9}
                    fontFamily="Georgia, serif"
                    fill={style.textColor}
                    textAnchor="middle"
                    dominantBaseline="central"
                    opacity={0.7}
                  >
                    {truncateTitle(prop.title, 18)}
                  </text>
                )}
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

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen - 1) + '…'
}
