'use client'

import { useMemo } from 'react'
import type { WordProblem, AnnotationTag } from '../wordProblems/types'
import type { CoordinatePlaneState } from '../types'
import { worldToScreen2D } from '../../shared/coordinateConversions'

/** Colors matching WordProblemCard tag colors */
const TAG_COLORS: Partial<Record<AnnotationTag, string>> = {
  slope: '#f59e0b',
  intercept: '#3b82f6',
  target: '#ef4444',
  answer: '#10b981',
  point1: '#8b5cf6',
  point2: '#ec4899',
}

interface AnnotationConnectorsProps {
  problem: WordProblem
  spanRefs: Map<AnnotationTag, HTMLSpanElement>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  canvasWidth: number
  canvasHeight: number
  revealStep: number
  isDark: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface ConnectorLine {
  tag: AnnotationTag
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string
  index: number
}

export function AnnotationConnectors({
  problem,
  spanRefs,
  stateRef,
  canvasWidth,
  canvasHeight,
  revealStep,
  isDark,
  containerRef,
}: AnnotationConnectorsProps) {
  const connectors = useMemo(() => {
    const container = containerRef.current
    if (!container) return []

    const containerRect = container.getBoundingClientRect()
    const state = stateRef.current
    const lines: ConnectorLine[] = []

    // Get annotated spans that have geometric targets
    const annotatedSpans = problem.spans.filter(s => s.tag && s.tag !== 'context' && s.tag !== 'question')

    annotatedSpans.forEach((span, index) => {
      if (index >= revealStep) return // Not yet revealed
      if (!span.tag) return

      const color = TAG_COLORS[span.tag]
      if (!color) return

      // Get text span position
      const spanEl = spanRefs.get(span.tag)
      if (!spanEl) return

      const spanRect = spanEl.getBoundingClientRect()
      const fromX = spanRect.left + spanRect.width / 2 - containerRect.left
      const fromY = spanRect.bottom - containerRect.top

      // Compute target geometry position
      const target = getGeometryTarget(span.tag, problem, state, canvasWidth, canvasHeight)
      if (!target) return

      lines.push({
        tag: span.tag,
        fromX,
        fromY,
        toX: target.x,
        toY: target.y,
        color,
        index,
      })
    })

    return lines
  }, [problem, spanRefs, stateRef, canvasWidth, canvasHeight, revealStep, containerRef])

  if (connectors.length === 0) return null

  return (
    <svg
      data-component="annotation-connectors"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 51,
      }}
    >
      {connectors.map((c) => (
        <ConnectorLine key={c.tag} connector={c} isDark={isDark} />
      ))}
    </svg>
  )
}

function ConnectorLine({ connector: c, isDark }: { connector: ConnectorLine; isDark: boolean }) {
  // Animate the line drawing using stroke-dasharray/offset
  const length = Math.sqrt((c.toX - c.fromX) ** 2 + (c.toY - c.fromY) ** 2)

  return (
    <g>
      <line
        x1={c.fromX}
        y1={c.fromY}
        x2={c.toX}
        y2={c.toY}
        stroke={c.color}
        strokeWidth={1.5}
        strokeDasharray={length}
        strokeDashoffset={0}
        opacity={0.7}
        style={{
          transition: 'stroke-dashoffset 400ms ease-out',
        }}
      />
      {/* Target dot */}
      <circle
        cx={c.toX}
        cy={c.toY}
        r={4}
        fill={c.color}
        opacity={0.8}
      />
    </g>
  )
}

/** Map annotation tags to geometric positions on the canvas */
function getGeometryTarget(
  tag: AnnotationTag,
  problem: WordProblem,
  state: CoordinatePlaneState,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } | null {
  const toScreen = (wx: number, wy: number) =>
    worldToScreen2D(wx, wy, state.center.x, state.center.y, state.pixelsPerUnit.x, state.pixelsPerUnit.y, canvasWidth, canvasHeight)

  const { slope, intercept } = problem.equation
  const m = slope.num / slope.den
  const b = intercept.num / intercept.den

  switch (tag) {
    case 'slope': {
      // Point at rise/run triangle midpoint — roughly at x=1 on the line
      const x = 1
      const y = m * x + b
      return toScreen(x, y)
    }
    case 'intercept': {
      // Y-intercept point
      return toScreen(0, b)
    }
    case 'target': {
      // Horizontal line at y = target — show at the solution x
      return toScreen(problem.answer.x, problem.answer.y)
    }
    case 'answer': {
      // The solution intersection point
      return toScreen(problem.answer.x, problem.answer.y)
    }
    case 'point1': {
      // First given point (level 4)
      const spans = problem.spans.find(s => s.tag === 'point1')
      if (spans?.value != null) {
        // Point value is encoded in the span — but for now use the answer
        return toScreen(0, b)
      }
      return null
    }
    case 'point2': {
      // Second given point (level 4)
      return toScreen(problem.answer.x, problem.answer.y)
    }
    default:
      return null
  }
}
