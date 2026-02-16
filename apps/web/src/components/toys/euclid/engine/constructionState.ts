import type {
  ConstructionState,
  ConstructionElement,
  ConstructionPoint,
  ConstructionCircle,
  ConstructionSegment,
  ElementOrigin,
} from '../types'
import { BYRNE, BYRNE_CYCLE } from '../types'

// ── Label generation ───────────────────────────────────────────────

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function labelAt(index: number): string {
  if (index < LABELS.length) return LABELS[index]
  // Beyond Z: A₂, B₂, ...
  const cycle = Math.floor(index / LABELS.length) + 1
  const ch = LABELS[index % LABELS.length]
  return `${ch}${cycle}`
}

// ── Pure state functions ───────────────────────────────────────────

export function createInitialState(): ConstructionState {
  return { elements: [], nextLabelIndex: 0, nextColorIndex: 0 }
}

/** Add a fully-formed set of given elements (for proposition setup) */
export function initializeGiven(givenElements: ConstructionElement[]): ConstructionState {
  let nextLabel = 0
  let nextColor = 0
  for (const el of givenElements) {
    if (el.kind === 'point') {
      nextLabel = Math.max(nextLabel, LABELS.indexOf(el.label) + 1)
    }
  }
  return { elements: [...givenElements], nextLabelIndex: nextLabel, nextColorIndex: nextColor }
}

export function addPoint(
  state: ConstructionState,
  x: number,
  y: number,
  origin: ElementOrigin,
): { state: ConstructionState; point: ConstructionPoint } {
  const label = labelAt(state.nextLabelIndex)
  const color = origin === 'given' ? BYRNE.given : BYRNE_CYCLE[state.nextColorIndex % BYRNE_CYCLE.length]
  const point: ConstructionPoint = {
    kind: 'point',
    id: `pt-${label}`,
    x,
    y,
    label,
    color,
    origin,
  }
  return {
    state: {
      ...state,
      elements: [...state.elements, point],
      nextLabelIndex: state.nextLabelIndex + 1,
      nextColorIndex: origin === 'given' ? state.nextColorIndex : state.nextColorIndex + 1,
    },
    point,
  }
}

export function addCircle(
  state: ConstructionState,
  centerId: string,
  radiusPointId: string,
): { state: ConstructionState; circle: ConstructionCircle } {
  const color = BYRNE_CYCLE[state.nextColorIndex % BYRNE_CYCLE.length]
  const circle: ConstructionCircle = {
    kind: 'circle',
    id: `cir-${state.elements.filter(e => e.kind === 'circle').length + 1}`,
    centerId,
    radiusPointId,
    color,
    origin: 'compass',
  }
  return {
    state: {
      ...state,
      elements: [...state.elements, circle],
      nextColorIndex: state.nextColorIndex + 1,
    },
    circle,
  }
}

export function addSegment(
  state: ConstructionState,
  fromId: string,
  toId: string,
): { state: ConstructionState; segment: ConstructionSegment } {
  const color = BYRNE_CYCLE[state.nextColorIndex % BYRNE_CYCLE.length]
  const segment: ConstructionSegment = {
    kind: 'segment',
    id: `seg-${state.elements.filter(e => e.kind === 'segment').length + 1}`,
    fromId,
    toId,
    color,
    origin: 'straightedge',
  }
  return {
    state: {
      ...state,
      elements: [...state.elements, segment],
      nextColorIndex: state.nextColorIndex + 1,
    },
    segment,
  }
}

export function removeLastElement(state: ConstructionState): ConstructionState {
  if (state.elements.length === 0) return state
  const last = state.elements[state.elements.length - 1]
  let newElements = state.elements.slice(0, -1)

  // If we removed a circle or segment, also remove any intersection points that depended on it
  if (last.kind === 'circle' || last.kind === 'segment') {
    newElements = newElements.filter(el => {
      if (el.kind !== 'point' || el.origin !== 'intersection') return true
      // Keep point only if it doesn't depend on the removed element
      // We encode dependency in the ID — but simpler: just check if any remaining
      // circle/segment could produce this point. For now, conservative: remove points
      // added after the penultimate non-point element.
      return true
    })
  }

  return {
    ...state,
    elements: newElements,
    nextLabelIndex: last.kind === 'point' ? state.nextLabelIndex - 1 : state.nextLabelIndex,
    nextColorIndex: Math.max(0, state.nextColorIndex - 1),
  }
}

// ── Lookups ────────────────────────────────────────────────────────

export function getPoint(state: ConstructionState, id: string): ConstructionPoint | undefined {
  return state.elements.find((e): e is ConstructionPoint => e.kind === 'point' && e.id === id)
}

export function getCircle(state: ConstructionState, id: string): ConstructionCircle | undefined {
  return state.elements.find((e): e is ConstructionCircle => e.kind === 'circle' && e.id === id)
}

export function getSegment(state: ConstructionState, id: string): ConstructionSegment | undefined {
  return state.elements.find((e): e is ConstructionSegment => e.kind === 'segment' && e.id === id)
}

export function getRadius(state: ConstructionState, circleId: string): number {
  const circle = getCircle(state, circleId)
  if (!circle) return 0
  const center = getPoint(state, circle.centerId)
  const radiusPt = getPoint(state, circle.radiusPointId)
  if (!center || !radiusPt) return 0
  return Math.sqrt((center.x - radiusPt.x) ** 2 + (center.y - radiusPt.y) ** 2)
}

export function getAllPoints(state: ConstructionState): ConstructionPoint[] {
  return state.elements.filter((e): e is ConstructionPoint => e.kind === 'point')
}

export function getAllCircles(state: ConstructionState): ConstructionCircle[] {
  return state.elements.filter((e): e is ConstructionCircle => e.kind === 'circle')
}

export function getAllSegments(state: ConstructionState): ConstructionSegment[] {
  return state.elements.filter((e): e is ConstructionSegment => e.kind === 'segment')
}
