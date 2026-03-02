/**
 * Small SVG geometric diagrams for proposition nodes.
 * Extracted from EuclidMap.tsx for reuse in MacroToolPanel.
 *
 * Renders as an SVG <g> element when used inside an SVG (EuclidMap),
 * or as a standalone <svg> element via PropThumbnailStandalone.
 */

import type { ThematicBlock } from '../data/book1'

const ICON_SIZE = 44

/** Subtle accent colors per thematic block — muted but distinctive. */
const BLOCK_ACCENTS: Record<ThematicBlock, string> = {
  'basic-constructions': '#3b82f6',
  'triangle-congruence': '#8b5cf6',
  'fundamental-constructions': '#0ea5e9',
  'angle-arithmetic': '#f59e0b',
  'triangle-inequalities': '#ef4444',
  'construction-from-parts': '#10b981',
  'more-congruence': '#a855f7',
  'parallel-lines': '#06b6d4',
  'parallelogram-basics': '#f97316',
  'area-theory': '#ec4899',
  'application-of-areas': '#d946ef',
  'the-finale': '#eab308',
}

/**
 * Small SVG geometric diagram for a proposition node.
 * Specific icons for implemented props; block-based for the rest.
 * Renders as a <g> element — must be placed inside an <svg>.
 */
export function PropThumbnail({
  propId,
  block,
  color,
}: {
  propId: number
  block: ThematicBlock
  color: string
}) {
  const s = ICON_SIZE
  const c = s / 2
  const o = 0.65
  const accent = BLOCK_ACCENTS[block] ?? color
  const sw = 1.5

  // Specific diagrams for implemented propositions
  switch (propId) {
    case 1:
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
    case 2:
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
    case 3:
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

  // Block-based generic icons
  switch (block) {
    case 'basic-constructions':
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
          <polyline
            points={`${5},${s - 10} ${11},${s - 10} ${11},${s - 4}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.6}
          />
        </g>
      )
    case 'angle-arithmetic':
      return (
        <g opacity={o}>
          <line x1={c} y1={s - 4} x2={3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={c} y1={s - 4} x2={s - 3} y2={4} stroke={color} strokeWidth={sw} />
          <line x1={3} y1={s - 4} x2={s - 3} y2={s - 4} stroke={accent} strokeWidth={sw} />
          <path
            d={`M ${c - 6} ${s - 4} A 8 8 0 0 1 ${c - 3} ${s - 9}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
        </g>
      )
    case 'triangle-inequalities':
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
      return (
        <g opacity={o}>
          <polygon
            points={`${5},${s - 5} ${5},${10} ${s - 8},${s - 5}`}
            fill={accent}
            fillOpacity={0.1}
            stroke={color}
            strokeWidth={sw}
          />
          <polyline
            points={`${5},${s - 10} ${10},${s - 10} ${10},${s - 5}`}
            fill="none"
            stroke={accent}
            strokeWidth={sw * 0.7}
          />
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
      return (
        <g opacity={o}>
          <polygon
            points={`${c},4 ${4},${s - 4} ${s - 4},${s - 4}`}
            fill={accent}
            fillOpacity={0.08}
            stroke={color}
            strokeWidth={sw}
          />
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

/**
 * Standalone SVG wrapper for PropThumbnail — used outside of SVG contexts
 * (e.g. in MacroToolPanel cards).
 */
export function PropThumbnailStandalone({
  propId,
  size = ICON_SIZE,
  color = '#4E79A7',
}: {
  propId: number
  size?: number
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <PropThumbnail propId={propId} block="basic-constructions" color={color} />
    </svg>
  )
}

export { BLOCK_ACCENTS, ICON_SIZE }
