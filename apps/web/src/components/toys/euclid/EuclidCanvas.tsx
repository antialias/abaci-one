'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
  CompassPhase,
  StraightedgePhase,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  ConstructionPoint,
  TutorialHint,
  TutorialSubStep,
  ExpectedAction,
  GhostLayer,
} from './types'
import { needsExtendedSegments, BYRNE_CYCLE } from './types'
import {
  initializeGiven,
  addPoint,
  addCircle,
  addSegment,
  getPoint,
  getAllCircles,
  getAllSegments,
  getRadius,
} from './engine/constructionState'
import {
  findNewIntersections,
  isCandidateBeyondPoint,
  circleCircleIntersections,
} from './engine/intersections'
import { renderConstruction, renderDragInvitation } from './render/renderConstruction'
import {
  renderToolOverlay,
  getFriction,
  setFriction,
  getFrictionRange,
} from './render/renderToolOverlay'
import type { StraightedgeDrawAnim } from './render/renderToolOverlay'
import { renderTutorialHint } from './render/renderTutorialHint'
import { renderEqualityMarks } from './render/renderEqualityMarks'
import { useEuclidTouch } from './interaction/useEuclidTouch'
import { useToolInteraction } from './interaction/useToolInteraction'
import { useDragGivenPoints } from './interaction/useDragGivenPoints'
import type { PostCompletionAction, ReplayResult } from './engine/replayConstruction'
import { replayConstruction } from './engine/replayConstruction'
import { validateStep } from './propositions/validation'
import { PROP_REGISTRY } from './propositions/registry'
import { PLAYGROUND_PROP } from './propositions/playground'
import { useAudioManager } from '@/hooks/useAudioManager'
import { useTTS } from '@/hooks/useTTS'
import { useEuclidAudioHelp } from './hooks/useEuclidAudioHelp'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  createFactStore,
  addFact,
  addAngleFact,
  queryEquality,
  getEqualDistances,
  getEqualAngles,
  rebuildFactStore,
} from './engine/factStore'
import type { FactStore } from './engine/factStore'
import type { ProofFact } from './engine/facts'
import {
  distancePair,
  distancePairKey,
  angleMeasure,
  angleMeasureKey,
  isAngleFact,
} from './engine/facts'
import type { AngleMeasure } from './engine/facts'
import type { DistancePair } from './engine/facts'
import { deriveDef15Facts } from './engine/factDerivation'
import { MACRO_REGISTRY } from './engine/macros'
import { resolveSelector } from './engine/selectors'
import type { MacroAnimation } from './engine/macroExecution'
import {
  createMacroAnimation,
  tickMacroAnimation,
  getHiddenElementIds,
} from './engine/macroExecution'
import { CITATIONS, citationDefFromFact } from './engine/citations'
import {
  renderGhostGeometry,
  getGhostFalloff,
  setGhostFalloff,
  getGhostFalloffRange,
  getGhostBaseOpacity,
  setGhostBaseOpacity,
  getGhostBaseOpacityRange,
} from './render/renderGhostGeometry'
import { renderProductionSegments } from './render/renderProductionSegments'
import { renderAngleArcs } from './render/renderAngleArcs'
import { renderSuperpositionFlash } from './render/renderSuperpositionFlash'
import type { SuperpositionFlash } from './render/renderSuperpositionFlash'
import { KeyboardShortcutsOverlay } from '../shared/KeyboardShortcutsOverlay'
import type { ShortcutEntry } from '../shared/KeyboardShortcutsOverlay'
import { ToyDebugPanel, DebugSlider, DebugCheckbox } from '../ToyDebugPanel'
import { useEuclidMusic } from './audio/useEuclidMusic'
import type { UseEuclidMusicReturn } from './audio/useEuclidMusic'

// ── Keyboard shortcuts ──

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'V', description: 'Toggle pan/zoom (disabled by default)' },
  { key: '?', description: 'Toggle this help' },
]

const MOBILE_STEP_STRIP_HEIGHT = 180
const AUTO_FIT_PAD_PX = 56
const AUTO_FIT_PAD_PX_MOBILE = 72
const AUTO_FIT_LERP = 0.12
const AUTO_FIT_MIN_PPU = 0.2
const AUTO_FIT_MIN_WORLD_HIT_RADIUS = 0.08
const AUTO_FIT_MAX_PPU_HEADROOM = 1.1
const AUTO_FIT_HIT_RADIUS_TOUCH = 44
const AUTO_FIT_HIT_RADIUS_MOUSE = 30
const AUTO_FIT_DOCK_GAP = 12
const AUTO_FIT_SOFT_MARGIN = 24
const AUTO_FIT_SWEEP_LERP_MIN = 0.03
const AUTO_FIT_POST_SWEEP_MS = 750
const AUTO_FIT_MAX_CENTER_PX = 2
const AUTO_FIT_MAX_PPU_DELTA = 1

// ── Viewport centering ──

/** Compute a good initial viewport center for a proposition's given elements. */
function computeInitialViewport(
  givenElements: readonly { kind: string; x?: number; y?: number }[]
): EuclidViewportState {
  const points = givenElements.filter(
    (e) => e.kind === 'point' && e.x !== undefined && e.y !== undefined
  ) as { x: number; y: number }[]
  if (points.length === 0) return { center: { x: 0, y: 0 }, pixelsPerUnit: 60 }

  const minX = Math.min(...points.map((p) => p.x))
  const maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y))
  const maxY = Math.max(...points.map((p) => p.y))

  // Center on given points, shifted up a bit to leave room for construction above
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2 + 1.5

  return { center: { x: cx, y: cy }, pixelsPerUnit: 50 }
}

function getAutoFitMaxPpu(isTouch: boolean): number {
  const hitRadius = isTouch ? AUTO_FIT_HIT_RADIUS_TOUCH : AUTO_FIT_HIT_RADIUS_MOUSE
  return (hitRadius / AUTO_FIT_MIN_WORLD_HIT_RADIUS) * AUTO_FIT_MAX_PPU_HEADROOM
}

function clampPpu(ppu: number, maxPpu: number): number {
  return Math.max(AUTO_FIT_MIN_PPU, Math.min(maxPpu, ppu))
}

function clampPpuWithMin(ppu: number, minPpu: number, maxPpu: number): number {
  return Math.max(minPpu, Math.min(maxPpu, ppu))
}

function getConstructionBounds(state: ConstructionState): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  const points = state.elements.filter(
    (e): e is ConstructionPoint => e.kind === 'point'
  )
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
    const r = getRadius(state, circle.id)
    const centerPoint = getPoint(state, circle.centerId)
    if (!centerPoint || r <= 0) continue
    minX = Math.min(minX, centerPoint.x - r)
    minY = Math.min(minY, centerPoint.y - r)
    maxX = Math.max(maxX, centerPoint.x + r)
    maxY = Math.max(maxY, centerPoint.y + r)
  }

  return { minX, minY, maxX, maxY }
}

function expandBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
  r: number
) {
  bounds.minX = Math.min(bounds.minX, x - r)
  bounds.minY = Math.min(bounds.minY, y - r)
  bounds.maxX = Math.max(bounds.maxX, x + r)
  bounds.maxY = Math.max(bounds.maxY, y + r)
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2
  let a = angle % twoPi
  if (a < 0) a += twoPi
  return a
}

function isAngleOnArc(start: number, end: number, angle: number, ccw: boolean): boolean {
  if (ccw) {
    if (end >= start) return angle >= start && angle <= end
    return angle >= start || angle <= end
  }
  if (end <= start) return angle <= start && angle >= end
  return angle <= start || angle >= end
}

function expandBoundsForArc(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number
) {
  if (r <= 0) return
  const ccw = sweep >= 0
  const start = normalizeAngle(startAngle)
  const end = normalizeAngle(startAngle + sweep)

  const candidates = [start, end, 0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
  for (const a of candidates) {
    const ang = normalizeAngle(a)
    if (!isAngleOnArc(start, end, ang, ccw)) continue
    const x = cx + Math.cos(ang) * r
    const y = cy + Math.sin(ang) * r
    bounds.minX = Math.min(bounds.minX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.maxY = Math.max(bounds.maxY, y)
  }
}

function getFitRect(
  cssWidth: number,
  cssHeight: number,
  canvasRect: DOMRect | null,
  dockRect: DOMRect | null,
  pad: number,
  dockGap: number,
  reservedBottom: number
) {
  let left = 0
  let right = cssWidth
  let top = 0
  let bottom = Math.max(0, cssHeight - reservedBottom)

  if (canvasRect && dockRect) {
    const dockLeft = dockRect.left - canvasRect.left
    const dockRight = dockRect.right - canvasRect.left
    const dockTop = dockRect.top - canvasRect.top
    const dockBottom = dockRect.bottom - canvasRect.top
    const overlapsY = dockBottom > 0 && dockTop < cssHeight
    const overlapsX = dockRight > 0 && dockLeft < cssWidth

    if (overlapsX && overlapsY) {
      if (dockLeft >= cssWidth / 2) {
        right = Math.min(right, dockLeft - dockGap)
      } else if (dockRight <= cssWidth / 2) {
        left = Math.max(left, dockRight + dockGap)
      } else if (dockTop >= cssHeight / 2) {
        bottom = Math.min(bottom, dockTop - dockGap)
      } else {
        top = Math.max(top, dockBottom + dockGap)
      }
    }
  }

  return {
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  }
}

function getScreenBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewport: EuclidViewportState,
  cssWidth: number,
  cssHeight: number
) {
  const toScreenX = (x: number) => (x - viewport.center.x) * viewport.pixelsPerUnit + cssWidth / 2
  const toScreenY = (y: number) => (viewport.center.y - y) * viewport.pixelsPerUnit + cssHeight / 2
  const sx1 = toScreenX(bounds.minX)
  const sx2 = toScreenX(bounds.maxX)
  const sy1 = toScreenY(bounds.minY)
  const sy2 = toScreenY(bounds.maxY)
  return {
    minX: Math.min(sx1, sx2),
    maxX: Math.max(sx1, sx2),
    minY: Math.min(sy1, sy2),
    maxY: Math.max(sy1, sy2),
  }
}

function boundsWithinRect(
  screenBounds: { minX: number; maxX: number; minY: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number
) {
  return (
    screenBounds.minX >= rect.left + margin &&
    screenBounds.maxX <= rect.right - margin &&
    screenBounds.minY >= rect.top + margin &&
    screenBounds.maxY <= rect.bottom - margin
  )
}

function clampViewportToRect(
  viewport: EuclidViewportState,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number,
  cssWidth: number,
  cssHeight: number
) {
  const screenBounds = getScreenBounds(bounds, viewport, cssWidth, cssHeight)
  let shiftX = 0
  let shiftY = 0
  if (screenBounds.minX < rect.left + margin) {
    shiftX = rect.left + margin - screenBounds.minX
  } else if (screenBounds.maxX > rect.right - margin) {
    shiftX = rect.right - margin - screenBounds.maxX
  }
  if (screenBounds.minY < rect.top + margin) {
    shiftY = rect.top + margin - screenBounds.minY
  } else if (screenBounds.maxY > rect.bottom - margin) {
    shiftY = rect.bottom - margin - screenBounds.maxY
  }

  if (shiftX !== 0) {
    viewport.center.x -= shiftX / viewport.pixelsPerUnit
  }
  if (shiftY !== 0) {
    viewport.center.y += shiftY / viewport.pixelsPerUnit
  }
}

function getScreenBoundsForViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  centerX: number,
  centerY: number,
  ppu: number,
  cssWidth: number,
  cssHeight: number
) {
  const toScreenX = (x: number) => (x - centerX) * ppu + cssWidth / 2
  const toScreenY = (y: number) => (centerY - y) * ppu + cssHeight / 2
  const sx1 = toScreenX(bounds.minX)
  const sx2 = toScreenX(bounds.maxX)
  const sy1 = toScreenY(bounds.minY)
  const sy2 = toScreenY(bounds.maxY)
  return {
    minX: Math.min(sx1, sx2),
    maxX: Math.max(sx1, sx2),
    minY: Math.min(sy1, sy2),
    maxY: Math.max(sy1, sy2),
  }
}

function clampCenterToRect(
  centerX: number,
  centerY: number,
  ppu: number,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { left: number; right: number; top: number; bottom: number },
  margin: number,
  cssWidth: number,
  cssHeight: number
) {
  const screenBounds = getScreenBoundsForViewport(bounds, centerX, centerY, ppu, cssWidth, cssHeight)
  let shiftX = 0
  let shiftY = 0
  if (screenBounds.minX < rect.left + margin) {
    shiftX = rect.left + margin - screenBounds.minX
  } else if (screenBounds.maxX > rect.right - margin) {
    shiftX = rect.right - margin - screenBounds.maxX
  }
  if (screenBounds.minY < rect.top + margin) {
    shiftY = rect.top + margin - screenBounds.minY
  } else if (screenBounds.maxY > rect.bottom - margin) {
    shiftY = rect.bottom - margin - screenBounds.maxY
  }
  return {
    centerX: centerX - shiftX / ppu,
    centerY: centerY + shiftY / ppu,
  }
}

function rotatePoint(
  pt: { x: number; y: number },
  center: { x: number; y: number },
  angle: number
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = pt.x - center.x
  const dy = pt.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

/**
 * Compute a citation group key for cross-type hover highlighting.
 * Facts from the same derivation (e.g., same I.4 triangle congruence) share a group.
 */
function citGroupKey(fact: ProofFact): string | null {
  const j = fact.justification
  // Match triangle congruence pattern: △ABC ≅ △DEF
  const triMatch = j.match(/△\w+ ≅ △\w+/)
  if (triMatch) return `${fact.atStep}:tri:${triMatch[0]}`
  // Group C.N.4 facts at the same step (superposition derives all conclusions at once)
  if (fact.citation.type === 'cn4') return `${fact.atStep}:cn4`
  return null
}

interface ProofSnapshot {
  construction: ConstructionState
  candidates: IntersectionCandidate[]
  proofFacts: ProofFact[]
  ghostLayers: GhostLayer[]
}

function captureSnapshot(
  construction: ConstructionState,
  candidates: IntersectionCandidate[],
  proofFacts: ProofFact[],
  ghostLayers: GhostLayer[]
): ProofSnapshot {
  // ConstructionState is replaced on each mutation (spread), so storing the reference is safe.
  // Same for candidates array (replaced via [...old, ...new]).
  // proofFacts is also replaced via proofFactsRef.current = [...].
  // ghostLayers is also replaced via ghostLayersRef.current = [...].
  return { construction, candidates, proofFacts, ghostLayers }
}

interface CompletionSegment {
  label: string
  dp: DistancePair
}

interface CompletionResult {
  /** 'proven' when the fact store confirms the result, 'unproven' if it doesn't */
  status: 'proven' | 'unproven'
  /** The equality statement, e.g. "AF = BC" */
  statement: string | null
  /** Individual segments in the equality chain, for hover provenance */
  segments: CompletionSegment[]
}

/**
 * Derive the completion result from the fact store's proven equalities
 * on the proposition's result segments. Returns the proven equality
 * (e.g. "AF = BC") or flags it as unproven if the engine couldn't establish it.
 */
function deriveCompletionResult(
  factStore: FactStore,
  resultSegments: Array<{ fromId: string; toId: string }> | undefined,
  state: ConstructionState
): CompletionResult {
  if (!resultSegments || resultSegments.length === 0) {
    return { status: 'proven', statement: null, segments: [] }
  }

  const label = (id: string) => getPoint(state, id)?.label ?? id
  const segLabel = (fromId: string, toId: string) => `${label(fromId)}${label(toId)}`

  // Collect all result segment distance pairs
  const resultDps = resultSegments.map((rs) => distancePair(rs.fromId, rs.toId))

  // Build an ordered list of equal segments, starting with result segments
  // then adding any construction segment that's in the same equality class
  const equalSegs: CompletionSegment[] = []
  const seen = new Set<string>()

  for (const rs of resultSegments) {
    const lbl = segLabel(rs.fromId, rs.toId)
    if (!seen.has(lbl)) {
      seen.add(lbl)
      equalSegs.push({ label: lbl, dp: distancePair(rs.fromId, rs.toId) })
    }
  }

  // Check all construction segments for matches
  for (const seg of getAllSegments(state)) {
    const segDp = distancePair(seg.fromId, seg.toId)
    const lbl = segLabel(seg.fromId, seg.toId)
    if (seen.has(lbl)) continue

    for (const rDp of resultDps) {
      if (queryEquality(factStore, rDp, segDp)) {
        seen.add(lbl)
        equalSegs.push({ label: lbl, dp: segDp })
        break
      }
    }
  }

  if (equalSegs.length >= 2) {
    return {
      status: 'proven',
      statement: equalSegs.map((s) => s.label).join(' = '),
      segments: equalSegs,
    }
  }

  // If we have result segments but couldn't find proven equalities,
  // the proof chain is incomplete
  return {
    status: 'unproven',
    statement: resultSegments.map((rs) => segLabel(rs.fromId, rs.toId)).join(', '),
    segments: resultSegments.map((rs) => ({
      label: segLabel(rs.fromId, rs.toId),
      dp: distancePair(rs.fromId, rs.toId),
    })),
  }
}

interface EuclidCanvasProps {
  propositionId?: number
  /** Called when the proposition is completed (all steps done + proven) */
  onComplete?: (propId: number) => void
  /** Hides proof panel for free-form playground mode */
  playgroundMode?: boolean
}

export function EuclidCanvas({ propositionId = 1, onComplete, playgroundMode }: EuclidCanvasProps) {
  const isMobile = useIsMobile()
  const proposition =
    (propositionId === 0 ? PLAYGROUND_PROP : PROP_REGISTRY[propositionId]) ?? PROP_REGISTRY[1]
  const extendSegments = useMemo(() => needsExtendedSegments(proposition), [proposition])
  const getTutorial = proposition.getTutorial ?? (() => [] as TutorialSubStep[][])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const toolDockRef = useRef<HTMLDivElement | null>(null)

  // Core refs (performance-critical, not React state)
  const viewportRef = useRef<EuclidViewportState>(computeInitialViewport(proposition.givenElements))
  const constructionRef = useRef<ConstructionState>(initializeGiven(proposition.givenElements))
  const compassPhaseRef = useRef<CompassPhase>({ tag: 'idle' })
  const straightedgePhaseRef = useRef<StraightedgePhase>({ tag: 'idle' })
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const snappedPointIdRef = useRef<string | null>(null)
  const candidatesRef = useRef<IntersectionCandidate[]>([])
  const pointerCapturedRef = useRef(false)
  const activeToolRef = useRef<ActiveTool>(proposition.steps[0]?.tool ?? 'compass')
  const expectedActionRef = useRef<ExpectedAction | null>(proposition.steps[0]?.expected ?? null)
  const needsDrawRef = useRef(true)
  const rafRef = useRef<number>(0)
  const macroPhaseRef = useRef<MacroPhase>({ tag: 'idle' })
  const macroAnimationRef = useRef<MacroAnimation | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(true)
  const straightedgeDrawAnimRef = useRef<StraightedgeDrawAnim | null>(null)
  const superpositionFlashRef = useRef<SuperpositionFlash | null>(null)
  const isCompleteRef = useRef(false)
  const completionTimeRef = useRef<number>(0)
  const postCompletionActionsRef = useRef<PostCompletionAction[]>([])
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const hoveredMacroStepRef = useRef<number | null>(null)
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const propositionRef = useRef(proposition)
  propositionRef.current = proposition
  const musicRef = useRef<UseEuclidMusicReturn | null>(null)
  const correctionRef = useRef<{
    active: boolean
    startTime: number
    duration: number
    center: { x: number; y: number }
    fromAngle: number
    toAngle: number
  } | null>(null)
  const correctionActiveRef = useRef(false)

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>(proposition.steps[0]?.tool ?? 'compass')
  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0)
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(
    proposition.steps.map(() => false)
  )
  const [isComplete, setIsComplete] = useState(false)
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [proofFacts, setProofFacts] = useState<ProofFact[]>([])
  const proofFactsRef = useRef<ProofFact[]>([])
  const snapshotStackRef = useRef<ProofSnapshot[]>([
    captureSnapshot(constructionRef.current, candidatesRef.current, [], []),
  ])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [panZoomEnabled, setPanZoomEnabled] = useState(false)
  const [isProofOpen, setIsProofOpen] = useState(false)
  const [isToolDockActive, setIsToolDockActive] = useState(false)
  const [isCorrectionActive, setIsCorrectionActive] = useState(false)
  const [frictionCoeff, setFrictionCoeff] = useState(getFriction)
  const [ghostBaseOpacityVal, setGhostBaseOpacityVal] = useState(getGhostBaseOpacity)
  const [ghostFalloffCoeff, setGhostFalloffCoeff] = useState(getGhostFalloff)
  const [hoveredProofDp, setHoveredProofDp] = useState<DistancePair | null>(null)
  const [hoveredFactId, setHoveredFactId] = useState<number | null>(null)
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null)
  const [autoCompleting, setAutoCompleting] = useState(false)
  const lastSweepRef = useRef<number>(0)
  const lastSweepTimeRef = useRef<number>(0)
  const lastSweepCenterRef = useRef<string | null>(null)

  // Combined highlight state: distance keys, angle keys, citation group
  const highlightState = useMemo(() => {
    const dpKeys = new Set<string>()
    const angleKeys = new Set<string>()
    let citGroup: string | null = null

    // From conclusion bar segment hover (distance only)
    if (hoveredProofDp) {
      for (const dp of getEqualDistances(factStoreRef.current, hoveredProofDp)) {
        dpKeys.add(distancePairKey(dp))
      }
    }

    // From fact row hover
    if (hoveredFactId != null) {
      const fact = proofFacts.find((f) => f.id === hoveredFactId)
      if (fact) {
        if (isAngleFact(fact)) {
          for (const am of getEqualAngles(factStoreRef.current, fact.left)) {
            angleKeys.add(angleMeasureKey(am))
          }
        } else {
          for (const dp of getEqualDistances(factStoreRef.current, fact.left)) {
            dpKeys.add(distancePairKey(dp))
          }
        }
        citGroup = citGroupKey(fact)
      }
    }

    return {
      dpKeys: dpKeys.size > 0 ? dpKeys : null,
      angleKeys: angleKeys.size > 0 ? angleKeys : null,
      citGroup,
    }
  }, [hoveredProofDp, hoveredFactId, proofFacts])

  /** Check if a proof fact should be highlighted given the current hover state */
  const isFactHighlighted = useCallback(
    (fact: ProofFact): boolean => {
      const { dpKeys, angleKeys, citGroup } = highlightState
      // Distance equivalence class
      if (!isAngleFact(fact) && dpKeys != null) {
        if (dpKeys.has(distancePairKey(fact.left)) || dpKeys.has(distancePairKey(fact.right))) {
          return true
        }
      }
      // Angle equivalence class
      if (isAngleFact(fact) && angleKeys != null) {
        if (
          angleKeys.has(angleMeasureKey(fact.left)) ||
          angleKeys.has(angleMeasureKey(fact.right))
        ) {
          return true
        }
      }
      // Citation group (cross-type: same derivation highlights related facts)
      if (citGroup != null && citGroupKey(fact) === citGroup) {
        return true
      }
      return false
    },
    [highlightState]
  )

  // ── Completion result derived from proof ──
  const completionResult = useMemo(() => {
    if (!isComplete) return null
    return deriveCompletionResult(
      factStoreRef.current,
      proposition.resultSegments,
      constructionRef.current
    )
    // proofFacts in deps so we re-derive after conclusion facts are added
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proofFacts, proposition.resultSegments])

  const showProofPanel = !isMobile || isProofOpen

  const togglePanZoom = useCallback(() => {
    setPanZoomEnabled((prev) => {
      const next = !prev
      panZoomDisabledRef.current = !next
      return next
    })
  }, [])

  // Sync isCompleteRef with state + record completion time
  if (isComplete && !isCompleteRef.current) {
    completionTimeRef.current = performance.now()
  }
  isCompleteRef.current = isComplete

  // ── Input mode detection ──
  const [isTouch, setIsTouch] = useState(true) // mobile-first default
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Tutorial state ──
  const [tutorialSubStep, setTutorialSubStep] = useState(0)
  const tutorialSubStepRef = useRef(0)
  const prevCompassTagRef = useRef('idle')
  const prevStraightedgeTagRef = useRef('idle')

  const tutorialSubSteps = useMemo(() => getTutorial(isTouch), [isTouch, getTutorial])
  const tutorialSubStepsRef = useRef(tutorialSubSteps)
  tutorialSubStepsRef.current = tutorialSubSteps

  // Derived: current sub-step definition
  const currentSubStepDef = tutorialSubSteps[currentStep]?.[tutorialSubStep]
  const currentInstruction = currentSubStepDef?.instruction ?? ''
  const currentSpeech = currentSubStepDef?.speech ?? ''
  const currentHint: TutorialHint = currentSubStepDef?.hint ?? { type: 'none' }
  const currentHintRef = useRef<TutorialHint>(currentHint)
  currentHintRef.current = currentHint

  // ── Group proof facts by step ──
  const factsByStep = useMemo(() => {
    const map = new Map<number, ProofFact[]>()
    for (const fact of proofFacts) {
      const existing = map.get(fact.atStep) ?? []
      existing.push(fact)
      map.set(fact.atStep, existing)
    }
    return map
  }, [proofFacts])

  // ── TTS integration ──
  const { isEnabled: audioEnabled, setEnabled: setAudioEnabled } = useAudioManager()
  const sayCorrection = useTTS(
    {
      say: {
        en: 'You chose the lower intersection. I will rotate the triangle 180 degrees around the midpoint of AB. That swaps A and B, so I will relabel them so A stays on the left. Then we can explore.',
      },
      tone: 'tutorial-instruction',
    },
    {}
  )
  const explorationNarration = proposition.explorationNarration
  const { handleDragStart, handleConstructionBreakdown } = useEuclidAudioHelp({
    instruction: currentSpeech,
    isComplete,
    celebrationText:
      completionResult?.status === 'proven' && completionResult.statement
        ? completionResult.statement
        : 'Construction complete!',
    explorationNarration,
  })

  // ── Fire onComplete callback and auto-select Move tool ──
  useEffect(() => {
    if (isComplete) {
      if (onComplete) onComplete(propositionId)
      if (proposition.id === 1) {
        const state = constructionRef.current
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
              correctionRef.current = {
                active: true,
                startTime: performance.now(),
                duration: 900,
                center,
                fromAngle: 0,
                toAngle: Math.PI,
              }
              correctionActiveRef.current = true
              setIsCorrectionActive(true)
              if (audioEnabled) {
                sayCorrection()
              }
            }
          }
        }
      }
      if (proposition.draggablePointIds && !correctionActiveRef.current) {
        setActiveTool('move')
        activeToolRef.current = 'move'
      }
      musicRef.current?.notifyCompletion()
    } else {
      correctionRef.current = null
      correctionActiveRef.current = false
      setIsCorrectionActive(false)
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

  const requestDraw = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  // ── Load given facts into the fact store (for theorems like I.4) ──
  useEffect(() => {
    const hasDistanceFacts = proposition.givenFacts && proposition.givenFacts.length > 0
    const hasAngleFacts = proposition.givenAngleFacts && proposition.givenAngleFacts.length > 0
    if (!hasDistanceFacts && !hasAngleFacts) return
    const store = factStoreRef.current
    const newFacts: ProofFact[] = []
    if (proposition.givenFacts) {
      for (const gf of proposition.givenFacts) {
        const left = distancePair(gf.left.a, gf.left.b)
        const right = distancePair(gf.right.a, gf.right.b)
        newFacts.push(
          ...addFact(
            store,
            left,
            right,
            { type: 'given' },
            gf.statement,
            'Given',
            -1 // before any step
          )
        )
      }
    }
    if (proposition.givenAngleFacts) {
      for (const gaf of proposition.givenAngleFacts) {
        const left = angleMeasure(gaf.left.vertex, gaf.left.ray1, gaf.left.ray2)
        const right = angleMeasure(gaf.right.vertex, gaf.right.ray1, gaf.right.ray2)
        newFacts.push(
          ...addAngleFact(store, left, right, { type: 'given' }, gaf.statement, 'Given', -1)
        )
      }
    }
    if (newFacts.length > 0) {
      proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
      setProofFacts(proofFactsRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync active tool to ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // ── Auto-select tool and sync expected action based on current step ──
  useEffect(() => {
    if (currentStep >= proposition.steps.length) {
      expectedActionRef.current = null
      return
    }
    const stepDef = proposition.steps[currentStep]
    expectedActionRef.current = stepDef.expected

    if (stepDef.tool === null) return

    // Initialize macro phase when entering a macro step (regardless of tool change)
    if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
      const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
      if (macroDef) {
        macroPhaseRef.current = {
          tag: 'selecting',
          propId: stepDef.expected.propId,
          inputLabels: macroDef.inputLabels,
          selectedPointIds: [],
        }
      }
    }

    if (stepDef.tool !== activeTool) {
      setActiveTool(stepDef.tool)
      activeToolRef.current = stepDef.tool

      const toolLabels: Record<string, string> = {
        compass: 'Compass',
        straightedge: 'Straightedge',
        macro: 'Proposition',
      }
      const label = toolLabels[stepDef.tool] ?? stepDef.tool
      setToolToast(label)
      if (toolToastTimerRef.current) clearTimeout(toolToastTimerRef.current)
      toolToastTimerRef.current = setTimeout(() => setToolToast(null), 1800)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // ── Reset tutorial sub-step when prop step changes ──
  useEffect(() => {
    tutorialSubStepRef.current = 0
    setTutorialSubStep(0)
  }, [currentStep])

  // ── Derive proposition conclusion facts when complete ──
  useEffect(() => {
    if (!isComplete) return
    const conclusionFn = proposition.deriveConclusion
    if (!conclusionFn) return
    const newFacts = conclusionFn(
      factStoreRef.current,
      constructionRef.current,
      proposition.steps.length
    )
    if (newFacts.length > 0) {
      proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
      setProofFacts(proofFactsRef.current)
    }

    // Trigger superposition flash for C.N.4 theorems
    if (proposition.superpositionFlash) {
      superpositionFlashRef.current = {
        startTime: performance.now(),
        ...proposition.superpositionFlash,
      }
      needsDrawRef.current = true
    }
  }, [isComplete, proposition.id, proposition.steps.length, proposition.superpositionFlash])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts((prev) => !prev)
      } else if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        togglePanZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanZoom])

  // ── Step validation (uses ref to avoid stale closures) ──

  const checkStep = useCallback(
    (element: ConstructionElement, candidate?: IntersectionCandidate) => {
      const step = currentStepRef.current
      if (step >= proposition.steps.length) return

      const stepDef = proposition.steps[step]
      const valid = validateStep(stepDef.expected, constructionRef.current, element, candidate)
      if (valid) {
        // Capture snapshot before advancing — state after this step completes
        snapshotStackRef.current = [
          ...snapshotStackRef.current,
          captureSnapshot(
            constructionRef.current,
            candidatesRef.current,
            proofFactsRef.current,
            ghostLayersRef.current
          ),
        ]

        setCompletedSteps((prev) => {
          const next = [...prev]
          next[step] = true
          return next
        })
        const nextStep = step + 1
        currentStepRef.current = nextStep
        if (nextStep >= proposition.steps.length) {
          setIsComplete(true)
          // Recompute candidates with segment extension for post-completion play
          if (!extendSegments) {
            let updatedCandidates = [...candidatesRef.current]
            for (const el of constructionRef.current.elements) {
              if (el.kind === 'point') continue
              const additional = findNewIntersections(
                constructionRef.current,
                el,
                updatedCandidates,
                true
              )
              updatedCandidates = [...updatedCandidates, ...additional]
            }
            candidatesRef.current = updatedCandidates
          }
        }
        setCurrentStep(nextStep)
      }
    },
    [proposition.steps, extendSegments]
  )

  // ── Commit handlers ──

  const handleCommitCircle = useCallback(
    (centerId: string, radiusPointId: string) => {
      const result = addCircle(constructionRef.current, centerId, radiusPointId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.circle,
        candidatesRef.current,
        extendSegments || isCompleteRef.current
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'circle', centerId, radiusPointId },
        ]
      }

      checkStep(result.circle)
      requestDraw()
      musicRef.current?.notifyChange()
    },
    [checkStep, requestDraw, extendSegments]
  )

  const handleCommitSegment = useCallback(
    (fromId: string, toId: string) => {
      const result = addSegment(constructionRef.current, fromId, toId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.segment,
        candidatesRef.current,
        extendSegments || isCompleteRef.current
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // Start drawing animation — progressive line reveal
      const fromPt = getPoint(result.state, fromId)
      const toPt = getPoint(result.state, toId)
      if (fromPt && toPt) {
        const dx = toPt.x - fromPt.x
        const dy = toPt.y - fromPt.y
        const worldDist = Math.sqrt(dx * dx + dy * dy)
        const screenDist = worldDist * viewportRef.current.pixelsPerUnit
        const duration = Math.max(500, Math.min(2000, screenDist * 5))
        straightedgeDrawAnimRef.current = {
          segmentId: result.segment.id,
          fromId,
          toId,
          color: result.segment.color,
          startTime: performance.now(),
          duration,
        }
      }

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'segment', fromId, toId },
        ]
      }

      checkStep(result.segment)
      requestDraw()
      musicRef.current?.notifyChange()
    },
    [checkStep, requestDraw, extendSegments]
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      // In guided mode, reject candidates that don't match the current step's expected ofA/ofB.
      // This prevents wrong taps from creating points that derail subsequent steps.
      const step = currentStepRef.current
      let explicitLabel: string | undefined
      if (step < proposition.steps.length) {
        const expected = proposition.steps[step].expected
        if (expected.type === 'intersection') {
          explicitLabel = expected.label
          if (expected.ofA != null && expected.ofB != null) {
            const resolvedA = resolveSelector(expected.ofA, constructionRef.current)
            const resolvedB = resolveSelector(expected.ofB, constructionRef.current)
            if (!resolvedA || !resolvedB) return
            const matches =
              (candidate.ofA === resolvedA && candidate.ofB === resolvedB) ||
              (candidate.ofA === resolvedB && candidate.ofB === resolvedA)
            if (!matches) {
              return
            }
            // If beyondId is specified, reject candidates on the wrong side
            if (expected.beyondId) {
              if (
                !isCandidateBeyondPoint(
                  candidate,
                  expected.beyondId,
                  candidate.ofA,
                  candidate.ofB,
                  constructionRef.current
                )
              ) {
                return
              }
            }
          }
        }
      }

      const result = addPoint(
        constructionRef.current,
        candidate.x,
        candidate.y,
        'intersection',
        explicitLabel
      )
      constructionRef.current = result.state

      candidatesRef.current = candidatesRef.current.filter(
        (c) => !(Math.abs(c.x - candidate.x) < 0.001 && Math.abs(c.y - candidate.y) < 0.001)
      )

      // Derive Def.15 facts for intersection points on circles
      const newFacts = deriveDef15Facts(
        candidate,
        result.point.id,
        constructionRef.current,
        factStoreRef.current,
        step
      )
      if (newFacts.length > 0) {
        proofFactsRef.current = [...proofFactsRef.current, ...newFacts]
        setProofFacts(proofFactsRef.current)
      }

      // Record post-completion action for replay during drag
      if (isCompleteRef.current) {
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'intersection', ofA: candidate.ofA, ofB: candidate.ofB, which: candidate.which },
        ]
      }

      checkStep(result.point, candidate)
      requestDraw()
      musicRef.current?.notifyIntersection(candidate.x, candidate.y)
      musicRef.current?.notifyChange()
    },
    [checkStep, requestDraw, proposition.steps]
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const step = currentStepRef.current

      // Get outputLabels from the current step's expected action
      const expected = step < proposition.steps.length ? proposition.steps[step].expected : null
      const outputLabels = expected?.type === 'macro' ? expected.outputLabels : undefined

      // Execute the macro — state is computed all at once
      const result = macroDef.execute(
        constructionRef.current,
        inputPointIds,
        candidatesRef.current,
        factStoreRef.current,
        step,
        extendSegments,
        outputLabels
      )

      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      // factStore is mutated in place by the macro — no reassignment needed
      if (result.newFacts.length > 0) {
        proofFactsRef.current = [...proofFactsRef.current, ...result.newFacts]
        setProofFacts(proofFactsRef.current)
      }

      // Collect ghost layers produced by the macro itself
      const macroGhosts = result.ghostLayers.map((gl) => ({ ...gl, atStep: step }))
      if (macroGhosts.length > 0) {
        ghostLayersRef.current = [...ghostLayersRef.current, ...macroGhosts]
      }

      // Start animation
      macroAnimationRef.current = createMacroAnimation(result)

      // Capture snapshot before advancing — state after this step completes
      snapshotStackRef.current = [
        ...snapshotStackRef.current,
        captureSnapshot(
          constructionRef.current,
          candidatesRef.current,
          proofFactsRef.current,
          ghostLayersRef.current
        ),
      ]

      // Directly advance the step (macro validation is handled here, not in validateStep)
      setCompletedSteps((prev) => {
        const next = [...prev]
        next[step] = true
        return next
      })
      const nextStep = step + 1
      currentStepRef.current = nextStep
      if (nextStep >= proposition.steps.length) {
        setIsComplete(true)
        // Recompute candidates with segment extension for post-completion play
        if (!extendSegments) {
          let updatedCandidates = [...candidatesRef.current]
          for (const el of constructionRef.current.elements) {
            if (el.kind === 'point') continue
            const additional = findNewIntersections(
              constructionRef.current,
              el,
              updatedCandidates,
              true
            )
            updatedCandidates = [...updatedCandidates, ...additional]
          }
          candidatesRef.current = updatedCandidates
        }
      }
      setCurrentStep(nextStep)

      requestDraw()
      musicRef.current?.notifyChange()
    },
    [proposition.steps, extendSegments, requestDraw]
  )

  const handleRewindToStep = useCallback(
    (targetStep: number) => {
      const snapshot = snapshotStackRef.current[targetStep]
      if (!snapshot) return

      // 1. Reset all tool phases to idle, clear animations
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      macroPhaseRef.current = { tag: 'idle' }
      macroAnimationRef.current = null
      superpositionFlashRef.current = null
      pointerCapturedRef.current = false
      postCompletionActionsRef.current = []

      // 2. Restore construction, candidates, proofFacts, ghostLayers from snapshot
      constructionRef.current = snapshot.construction
      candidatesRef.current = snapshot.candidates
      proofFactsRef.current = snapshot.proofFacts
      setProofFacts(snapshot.proofFacts)
      ghostLayersRef.current = snapshot.ghostLayers
      ghostOpacitiesRef.current = new Map()

      // 3. Rebuild factStore via rebuildFactStore
      factStoreRef.current = rebuildFactStore(snapshot.proofFacts)

      // 4. Truncate snapshot stack to [0..targetStep]
      snapshotStackRef.current = snapshotStackRef.current.slice(0, targetStep + 1)

      // 5. Set currentStep, reset completedSteps from targetStep onward
      currentStepRef.current = targetStep
      setCurrentStep(targetStep)
      setCompletedSteps((prev) => {
        const next = [...prev]
        for (let i = targetStep; i < next.length; i++) {
          next[i] = false
        }
        return next
      })
      setIsComplete(false)

      // 6. Reset tutorial sub-step and hover state
      tutorialSubStepRef.current = 0
      setTutorialSubStep(0)
      setHoveredProofDp(null)
      setHoveredFactId(null)
      prevCompassTagRef.current = 'idle'
      prevStraightedgeTagRef.current = 'idle'

      // 7. Sync tool/expectedAction refs for the new current step
      if (targetStep < proposition.steps.length) {
        const stepDef = proposition.steps[targetStep]
        expectedActionRef.current = stepDef.expected
        if (stepDef.tool !== null) {
          setActiveTool(stepDef.tool)
          activeToolRef.current = stepDef.tool

          // Initialize macro phase when rewinding to a macro step
          if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
            const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
            if (macroDef) {
              macroPhaseRef.current = {
                tag: 'selecting',
                propId: stepDef.expected.propId,
                inputLabels: macroDef.inputLabels,
                selectedPointIds: [],
              }
            }
          }
        }
      } else {
        expectedActionRef.current = null
      }

      requestDraw()
    },
    [proposition.steps, requestDraw]
  )

  // ── Auto-complete: execute each step on 250ms interval ──
  useEffect(() => {
    if (!autoCompleting) return

    const interval = setInterval(() => {
      const step = currentStepRef.current
      if (step >= proposition.steps.length) {
        setAutoCompleting(false)
        return
      }

      const expected = proposition.steps[step].expected

      if (expected.type === 'compass') {
        handleCommitCircle(expected.centerId, expected.radiusPointId)
      } else if (expected.type === 'straightedge') {
        handleCommitSegment(expected.fromId, expected.toId)
      } else if (expected.type === 'intersection') {
        const state = constructionRef.current
        const candidates = candidatesRef.current
        const resolvedA = expected.ofA != null ? resolveSelector(expected.ofA, state) : null
        const resolvedB = expected.ofB != null ? resolveSelector(expected.ofB, state) : null

        if (resolvedA && resolvedB) {
          const match = candidates.find((c) => {
            const matches =
              (c.ofA === resolvedA && c.ofB === resolvedB) ||
              (c.ofA === resolvedB && c.ofB === resolvedA)
            if (!matches) return false
            if (expected.beyondId) {
              return isCandidateBeyondPoint(c, expected.beyondId, c.ofA, c.ofB, state)
            }
            const hasHigher = candidates.some(
              (other) =>
                other !== c &&
                ((other.ofA === resolvedA && other.ofB === resolvedB) ||
                  (other.ofA === resolvedB && other.ofB === resolvedA)) &&
                other.y > c.y
            )
            return !hasHigher
          })
          if (match) {
            handleMarkIntersection(match)
          }
        }
      } else if (expected.type === 'macro') {
        handleCommitMacro(expected.propId, expected.inputPointIds)
      }
    }, 250)

    return () => clearInterval(interval)
  }, [
    autoCompleting,
    proposition.steps,
    handleCommitCircle,
    handleCommitSegment,
    handleMarkIntersection,
    handleCommitMacro,
  ])

  // ── Hook up pan/zoom ──
  useEuclidTouch({
    viewportRef,
    canvasRef,
    pointerCapturedRef,
    onViewportChange: requestDraw,
    panZoomDisabledRef,
  })

  // ── Hook up tool interaction ──
  useToolInteraction({
    canvasRef,
    viewportRef,
    constructionRef,
    compassPhaseRef,
    straightedgePhaseRef,
    pointerWorldRef,
    snappedPointIdRef,
    candidatesRef,
    pointerCapturedRef,
    activeToolRef,
    needsDrawRef,
    onCommitCircle: handleCommitCircle,
    onCommitSegment: handleCommitSegment,
    onMarkIntersection: handleMarkIntersection,
    expectedActionRef,
    macroPhaseRef,
    onCommitMacro: handleCommitMacro,
  })

  // ── Hook up drag interaction for post-completion play ──
  const constructionIntactRef = useRef(true)
  const handleDragReplay = useCallback(
    (result: ReplayResult) => {
      proofFactsRef.current = result.proofFacts
      setProofFacts(result.proofFacts)
      ghostLayersRef.current = result.ghostLayers
      musicRef.current?.notifyChange()

      // Detect construction breakdown: was intact, now incomplete
      const intact = result.stepsCompleted >= propositionRef.current.steps.length
      if (constructionIntactRef.current && !intact) {
        handleConstructionBreakdown()
      }
      constructionIntactRef.current = intact
    },
    [handleConstructionBreakdown]
  )

  useDragGivenPoints({
    canvasRef,
    propositionRef,
    constructionRef,
    factStoreRef,
    viewportRef,
    isCompleteRef,
    activeToolRef,
    needsDrawRef,
    pointerCapturedRef,
    candidatesRef,
    postCompletionActionsRef,
    interactionLockedRef: correctionActiveRef,
    onReplayResult: handleDragReplay,
    onDragStart: handleDragStart,
  })

  // ── Construction music ──
  const music = useEuclidMusic({ constructionRef, factStoreRef, isComplete })
  musicRef.current = music

  // ── Canvas resize observer ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      requestDraw()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [requestDraw])

  // ── RAF render loop ──
  useEffect(() => {
    let running = true

    function draw() {
      if (!running) return

      // ── Observe tool phase transitions for tutorial advancement ──
      const subSteps = tutorialSubStepsRef.current
      const step = currentStepRef.current
      const subStep = tutorialSubStepRef.current

      const compassTag = compassPhaseRef.current.tag
      if (compassTag !== prevCompassTagRef.current) {
        const prev = prevCompassTagRef.current
        prevCompassTagRef.current = compassTag

        if (compassTag === 'idle' && prev !== 'idle') {
          // Gesture cancelled or completed — reset sub-step
          tutorialSubStepRef.current = 0
          setTutorialSubStep(0)
        } else {
          const subStepDef = subSteps[step]?.[subStep]
          const adv = subStepDef?.advanceOn
          if (adv?.kind === 'compass-phase' && adv.phase === compassTag) {
            const next = subStep + 1
            tutorialSubStepRef.current = next
            setTutorialSubStep(next)
          }
        }
      }

      const straightedgeTag = straightedgePhaseRef.current.tag
      if (straightedgeTag !== prevStraightedgeTagRef.current) {
        const prev = prevStraightedgeTagRef.current
        prevStraightedgeTagRef.current = straightedgeTag

        if (straightedgeTag === 'idle' && prev !== 'idle') {
          tutorialSubStepRef.current = 0
          setTutorialSubStep(0)
        }
      }

      // ── Tick macro animation ──
      const macroAnim = macroAnimationRef.current
      if (macroAnim && macroAnim.revealedCount < macroAnim.elements.length) {
        const newCount = tickMacroAnimation(macroAnim)
        if (newCount !== macroAnim.revealedCount) {
          macroAnim.revealedCount = newCount
          needsDrawRef.current = true
        }
        if (newCount >= macroAnim.elements.length) {
          macroAnimationRef.current = null
        }
      }

      // ── Track macro phase for tutorial advancement ──
      const macroPhase = macroPhaseRef.current
      if (macroPhase.tag === 'selecting' && macroPhase.selectedPointIds.length > 0) {
        const subStepDef = subSteps[step]?.[subStep]
        const adv = subStepDef?.advanceOn
        if (adv?.kind === 'macro-select' && adv.index === macroPhase.selectedPointIds.length - 1) {
          const next = subStep + 1
          tutorialSubStepRef.current = next
          setTutorialSubStep(next)
        }
      }

      // ── Keep animating while tutorial hints are visible ──
      const hint = currentHintRef.current
      if (hint.type !== 'none') {
        needsDrawRef.current = true
      }

      // ── Keep animating while tool overlay is visible (idle bob animation) ──
      if (pointerWorldRef.current && activeToolRef.current !== 'macro') {
        needsDrawRef.current = true
      }

      // ── Keep animating while draggable point pulse rings are visible ──
      if (isCompleteRef.current && propositionRef.current.draggablePointIds) {
        needsDrawRef.current = true
      }

      const canvas = canvasRef.current
      if (canvas && needsDrawRef.current) {
        needsDrawRef.current = false

        const dpr = window.devicePixelRatio || 1
        const cssWidth = canvas.width / dpr
        const cssHeight = canvas.height / dpr

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.scale(dpr, dpr)

          const compassPhase = compassPhaseRef.current
          const allowAutoFit =
            !panZoomEnabled &&
            (!pointerCapturedRef.current ||
              compassPhase.tag === 'radius-set' ||
              compassPhase.tag === 'sweeping')
          const pad = isMobile ? AUTO_FIT_PAD_PX_MOBILE : AUTO_FIT_PAD_PX
          const canvasRect = canvas.getBoundingClientRect()
          const dockRect = toolDockRef.current?.getBoundingClientRect() ?? null
          const reservedBottom =
            isMobile && !isProofOpen && isCompleteRef.current ? MOBILE_STEP_STRIP_HEIGHT : 0
          const fitRect = getFitRect(
            cssWidth,
            cssHeight,
            canvasRect,
            dockRect,
            pad,
            AUTO_FIT_DOCK_GAP,
            reservedBottom
          )
          if (allowAutoFit) {
            const bounds = getConstructionBounds(constructionRef.current)
            if (bounds) {
              if (compassPhase.tag === 'sweeping') {
                const centerPoint = getPoint(constructionRef.current, compassPhase.centerId)
                if (centerPoint && compassPhase.radius > 0) {
                  expandBoundsForArc(
                    bounds,
                    centerPoint.x,
                    centerPoint.y,
                    compassPhase.radius,
                    compassPhase.startAngle,
                    compassPhase.cumulativeSweep
                  )
                }
              }
              const width = Math.max(1, bounds.maxX - bounds.minX)
              const height = Math.max(1, bounds.maxY - bounds.minY)
              const availableW = Math.max(1, fitRect.width - pad * 2)
              const availableH = Math.max(1, fitRect.height - pad * 2)
              const minPpuNeeded = Math.min(availableW / width, availableH / height)
              const fitArea = availableW * availableH
              const boundsArea = width * height
              const shouldZoomIn = boundsArea <= fitArea * 0.25
              const desiredPpu = Math.min(availableW / width, availableH / height)
              const maxPpu = getAutoFitMaxPpu(isTouch)
              const targetPpu = shouldZoomIn
                ? clampPpu(desiredPpu, maxPpu)
                : clampPpuWithMin(desiredPpu, minPpuNeeded, maxPpu)
              const targetCx = (bounds.minX + bounds.maxX) / 2
              const targetCy = (bounds.minY + bounds.maxY) / 2

              const v = viewportRef.current
              const prevCx = v.center.x
              const prevCy = v.center.y
              const prevPpu = v.pixelsPerUnit
              const screenBounds = getScreenBounds(bounds, v, cssWidth, cssHeight)
              const softOk = boundsWithinRect(
                screenBounds,
                { left: fitRect.left, right: fitRect.right, top: fitRect.top, bottom: fitRect.bottom },
                AUTO_FIT_SOFT_MARGIN
              )

              const now = performance.now()
              let sweepSpeed = 0
              if (compassPhase.tag === 'sweeping') {
                const lastSweep = lastSweepRef.current
                const lastTime = lastSweepTimeRef.current || now
                const dt = Math.max(1, now - lastTime) / 1000
                sweepSpeed = Math.abs(compassPhase.cumulativeSweep - lastSweep) / dt
                lastSweepRef.current = compassPhase.cumulativeSweep
                lastSweepTimeRef.current = now
                lastSweepCenterRef.current = compassPhase.centerId
              } else {
                lastSweepRef.current = 0
              }
              const sinceSweepMs = now - (lastSweepTimeRef.current || now)
              const isPostSweep = sinceSweepMs < AUTO_FIT_POST_SWEEP_MS
              const sweepLerp =
                compassPhase.tag === 'sweeping' || isPostSweep
                  ? Math.max(AUTO_FIT_SWEEP_LERP_MIN, AUTO_FIT_LERP / (1 + sweepSpeed * 0.4))
                  : AUTO_FIT_LERP

              let effectivePpu = v.pixelsPerUnit
              if (!softOk || targetPpu < v.pixelsPerUnit || shouldZoomIn) {
                const nextPpu = v.pixelsPerUnit + (targetPpu - v.pixelsPerUnit) * sweepLerp
                const deltaPpu = Math.max(
                  -AUTO_FIT_MAX_PPU_DELTA,
                  Math.min(AUTO_FIT_MAX_PPU_DELTA, nextPpu - v.pixelsPerUnit)
                )
                effectivePpu = v.pixelsPerUnit + deltaPpu
                v.pixelsPerUnit = effectivePpu
              }

              let targetCenterX =
                targetCx - (fitRect.centerX - cssWidth / 2) / effectivePpu
              let targetCenterY =
                targetCy + (fitRect.centerY - cssHeight / 2) / effectivePpu
              if (compassPhase.tag === 'sweeping' || isPostSweep) {
                const anchorCenterId =
                  compassPhase.tag === 'sweeping'
                    ? compassPhase.centerId
                    : lastSweepCenterRef.current
                const centerPoint = anchorCenterId
                  ? getPoint(constructionRef.current, anchorCenterId)
                  : null
                if (centerPoint) {
                  const anchorScreenX =
                    (centerPoint.x - v.center.x) * v.pixelsPerUnit + cssWidth / 2
                  const anchorScreenY =
                    (v.center.y - centerPoint.y) * v.pixelsPerUnit + cssHeight / 2
                  targetCenterX = centerPoint.x - (anchorScreenX - cssWidth / 2) / effectivePpu
                  targetCenterY = centerPoint.y + (anchorScreenY - cssHeight / 2) / effectivePpu
                }
              }
              if (isCompleteRef.current) {
                const clamped = clampCenterToRect(
                  targetCenterX,
                  targetCenterY,
                  effectivePpu,
                  bounds,
                  {
                    left: fitRect.left,
                    right: fitRect.right,
                    top: fitRect.top,
                    bottom: fitRect.bottom,
                  },
                  pad,
                  cssWidth,
                  cssHeight
                )
                targetCenterX = clamped.centerX
                targetCenterY = clamped.centerY
              }

              const maxPx = shouldZoomIn ? AUTO_FIT_MAX_CENTER_PX * 3 : AUTO_FIT_MAX_CENTER_PX
              const maxDx = maxPx / v.pixelsPerUnit
              const maxDy = maxPx / v.pixelsPerUnit
              const dx = (targetCenterX - v.center.x) * sweepLerp
              const dy = (targetCenterY - v.center.y) * sweepLerp
              v.center.x += Math.max(-maxDx, Math.min(maxDx, dx))
              v.center.y += Math.max(-maxDy, Math.min(maxDy, dy))

              if (
                Math.abs(v.center.x - prevCx) > 0.001 ||
                Math.abs(v.center.y - prevCy) > 0.001 ||
                Math.abs(v.pixelsPerUnit - prevPpu) > 0.01
              ) {
                needsDrawRef.current = true
              }

              // debug logging removed

              // debug logging removed

              // debug logging removed
            }
          }

          // Derive candidate filter from current step's expected intersection
          // Resolve ElementSelectors to runtime IDs for filtering
          const curStep = currentStepRef.current
          const curExpected =
            curStep < proposition.steps.length ? proposition.steps[curStep].expected : null
          let candFilter: { ofA: string; ofB: string; beyondId?: string } | null = null
          if (
            curExpected?.type === 'intersection' &&
            curExpected.ofA != null &&
            curExpected.ofB != null
          ) {
            const resolvedA = resolveSelector(curExpected.ofA, constructionRef.current)
            const resolvedB = resolveSelector(curExpected.ofB, constructionRef.current)
            if (resolvedA && resolvedB) {
              candFilter = { ofA: resolvedA, ofB: resolvedB, beyondId: curExpected.beyondId }
            }
          }
          const complete = !playgroundMode && curStep >= proposition.steps.length

          // Compute hidden elements during macro animation
          const hiddenIds = getHiddenElementIds(macroAnimationRef.current)

          // Handle straightedge drawing animation — hide the segment while it's being progressively drawn
          const drawAnim = straightedgeDrawAnimRef.current
          if (drawAnim) {
            const elapsed = performance.now() - drawAnim.startTime
            if (elapsed >= drawAnim.duration) {
              straightedgeDrawAnimRef.current = null
            } else {
              hiddenIds.add(drawAnim.segmentId)
              needsDrawRef.current = true
            }
          }

          let drawState = constructionRef.current
          if (correctionRef.current?.active) {
            const correction = correctionRef.current
            const t = Math.min(1, (performance.now() - correction.startTime) / correction.duration)
            const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            const angle =
              correction.fromAngle + (correction.toAngle - correction.fromAngle) * ease
            const state = constructionRef.current
            const updatedElements = state.elements.map((el) => {
              if (el.kind === 'point') {
                const rotated = rotatePoint({ x: el.x, y: el.y }, correction.center, angle)
                return { ...el, x: rotated.x, y: rotated.y }
              }
              return el
            })
            drawState = { ...state, elements: updatedElements }
            needsDrawRef.current = true
            if (t >= 1) {
              correctionRef.current = null
              correctionActiveRef.current = false
              setIsCorrectionActive(false)
              if (propositionRef.current.draggablePointIds) {
                setActiveTool('move')
                activeToolRef.current = 'move'
              }
              // Apply final rotation to actual state via replay for geometric consistency
              const prop = propositionRef.current
              const center = correction.center
              const angleFinal = correction.toAngle
              let givenElements: ConstructionElement[]
              if (prop.computeGivenElements) {
                const positions = new Map<string, { x: number; y: number }>()
                for (const el of constructionRef.current.elements) {
                  if (el.kind === 'point' && el.origin === 'given') {
                    const rotated = rotatePoint({ x: el.x, y: el.y }, center, angleFinal)
                    positions.set(el.id, rotated)
                  }
                }
                const pA = positions.get('pt-A')
                const pB = positions.get('pt-B')
                if (pA && pB && pA.x > pB.x) {
                  positions.set('pt-A', pB)
                  positions.set('pt-B', pA)
                }
                givenElements = prop.computeGivenElements(positions)
              } else {
                const rotatedPoints = new Map<string, { x: number; y: number }>()
                for (const el of prop.givenElements) {
                  if (el.kind === 'point') {
                    const rotated = rotatePoint({ x: el.x, y: el.y }, center, angleFinal)
                    rotatedPoints.set(el.id, rotated)
                  }
                }
                const pA = rotatedPoints.get('pt-A')
                const pB = rotatedPoints.get('pt-B')
                if (pA && pB && pA.x > pB.x) {
                  rotatedPoints.set('pt-A', pB)
                  rotatedPoints.set('pt-B', pA)
                }
                givenElements = prop.givenElements.map((el) => {
                  if (el.kind === 'point' && rotatedPoints.has(el.id)) {
                    const rotated = rotatedPoints.get(el.id)!
                    return { ...el, x: rotated.x, y: rotated.y }
                  }
                  return el
                })
              }
              const result = replayConstruction(
                givenElements,
                prop.steps,
                prop,
                postCompletionActionsRef.current
              )
              constructionRef.current = result.state
              factStoreRef.current = result.factStore
              candidatesRef.current = result.candidates
              proofFactsRef.current = result.proofFacts
              setProofFacts(result.proofFacts)
            }
          }

          renderConstruction(
            ctx,
            drawState,
            viewportRef.current,
            cssWidth,
            cssHeight,
            compassPhaseRef.current,
            straightedgePhaseRef.current,
            pointerWorldRef.current,
            snappedPointIdRef.current,
            candidatesRef.current,
            drawState.nextColorIndex,
            candFilter,
            complete,
            complete ? proposition.resultSegments : undefined,
            hiddenIds.size > 0 ? hiddenIds : undefined,
            undefined, // transparentBg
            complete ? proposition.draggablePointIds : undefined
          )

          // Render Post.2 production segments (extensions to intersection points)
          renderProductionSegments(
            ctx,
            drawState,
            proposition.steps,
            currentStepRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight
          )

          // Render ghost geometry (dependency scaffolding from macros)
          if (ghostLayersRef.current.length > 0) {
            const ghostAnimating = renderGhostGeometry(
              ctx,
              ghostLayersRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              hoveredMacroStepRef.current,
              ghostOpacitiesRef.current
            )
            if (ghostAnimating || hoveredMacroStepRef.current !== null) {
              needsDrawRef.current = true
            }
          }

          // Render equality tick marks on segments with proven equalities
          if (factStoreRef.current.facts.length > 0) {
            renderEqualityMarks(
              ctx,
              drawState,
              viewportRef.current,
              cssWidth,
              cssHeight,
              factStoreRef.current,
              hiddenIds.size > 0 ? hiddenIds : undefined,
              complete ? proposition.resultSegments : undefined
            )
          }

          // Render angle arcs (for theorems with given angles)
          if (proposition.givenAngles) {
            renderAngleArcs(
              ctx,
              drawState,
              viewportRef.current,
              cssWidth,
              cssHeight,
              proposition.givenAngles,
              proposition.equalAngles
            )
          }

          // Render superposition flash animation (C.N.4)
          if (superpositionFlashRef.current) {
            const stillAnimating = renderSuperpositionFlash(
              ctx,
              superpositionFlashRef.current,
              drawState,
              viewportRef.current,
              cssWidth,
              cssHeight,
              performance.now()
            )
            if (stillAnimating) {
              needsDrawRef.current = true
            } else {
              superpositionFlashRef.current = null
            }
          }

          // Render drag invitation text post-completion
          if (
            complete &&
            completionTimeRef.current > 0 &&
            propositionRef.current.draggablePointIds
          ) {
            const stillShowing = renderDragInvitation(
              ctx,
              cssWidth,
              cssHeight,
              completionTimeRef.current
            )
            if (stillShowing) {
              needsDrawRef.current = true
            }
          }

          // Render tool overlay (geometric previews + physical tool body)
          const nextColor = BYRNE_CYCLE[constructionRef.current.nextColorIndex % BYRNE_CYCLE.length]
          renderToolOverlay(
            ctx,
            activeToolRef.current,
            compassPhaseRef.current,
            straightedgePhaseRef.current,
            pointerWorldRef.current,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            nextColor,
            complete,
            straightedgeDrawAnimRef.current
          )

          // Render tutorial hint on top
          renderTutorialHint(
            ctx,
            hint,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            candidatesRef.current,
            performance.now() / 1000
          )

          ctx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Citation ordinals: track how many times each citation has appeared ──
  // 1st: full label + axiom text. 2nd: full label only. 3rd+: abbreviation.
  const citationOrdinals = useMemo(() => {
    const counts = new Map<string, number>()
    const ordinals = new Map<string, number>()

    for (let i = 0; i < proposition.steps.length; i++) {
      const step = proposition.steps[i]
      if (step.citation) {
        const n = (counts.get(step.citation) ?? 0) + 1
        counts.set(step.citation, n)
        ordinals.set(`step-${i}`, n)
      }
      for (const fact of factsByStep.get(i) ?? []) {
        const cd = citationDefFromFact(fact.citation)
        if (cd) {
          const n = (counts.get(cd.key) ?? 0) + 1
          counts.set(cd.key, n)
          ordinals.set(`fact-${fact.id}`, n)
        }
      }
    }
    for (const fact of factsByStep.get(proposition.steps.length) ?? []) {
      const cd = citationDefFromFact(fact.citation)
      if (cd) {
        const n = (counts.get(cd.key) ?? 0) + 1
        counts.set(cd.key, n)
        ordinals.set(`fact-${fact.id}`, n)
      }
    }
    return ordinals
  }, [proposition.steps, factsByStep])

  // Scroll the proof panel to keep current step visible
  const proofScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = proofScrollRef.current
    if (!container) return
    const active = container.querySelector('[data-step-current="true"]') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentStep])

  return (
    <div
      data-component="euclid-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Left pane: Canvas ── */}
      <div
        ref={containerRef}
        data-element="canvas-pane"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          data-element="euclid-canvas"
          onPointerDown={() => {
            if (isMobile) setIsToolDockActive(true)
          }}
          onPointerUp={() => {
            if (isMobile) setIsToolDockActive(false)
          }}
          onPointerCancel={() => {
            if (isMobile) setIsToolDockActive(false)
          }}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor:
              activeTool === 'move'
                ? undefined // drag hook manages grab/grabbing cursor
                : activeTool !== 'macro'
                  ? 'none'
                  : undefined,
          }}
        />

        {/* Tool auto-switch toast */}
        {toolToast && (
          <div
            data-element="tool-toast"
            style={{
              position: 'absolute',
              bottom: isMobile
                ? `calc(${MOBILE_STEP_STRIP_HEIGHT + 56}px + env(safe-area-inset-bottom))`
                : 84,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 14px',
              borderRadius: 8,
              background: 'rgba(78, 121, 167, 0.12)',
              color: '#4E79A7',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {toolToast} selected
          </div>
        )}

        <div
          data-element="tool-selector"
          ref={toolDockRef}
          onMouseEnter={() => setIsToolDockActive(true)}
          onMouseLeave={() => setIsToolDockActive(false)}
          onTouchStart={() => setIsToolDockActive(true)}
          onTouchEnd={() => setIsToolDockActive(false)}
          onPointerDown={() => setIsToolDockActive(true)}
          onPointerUp={() => setIsToolDockActive(false)}
          style={{
            position: 'absolute',
            display: 'flex',
            gap: 8,
            zIndex: 10,
            ...(isMobile
              ? {
                  top: '50%',
                  right: 12,
                  transform: 'translateY(-50%)',
                  flexDirection: 'column',
                  padding: '8px 6px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(203, 213, 225, 0.8)',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                  backdropFilter: 'blur(8px)',
                  opacity: isToolDockActive ? 1 : 0.55,
                  transition: 'opacity 0.2s ease',
                }
              : {
                  bottom: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }),
          }}
        >
          {isComplete && proposition.draggablePointIds && (
            <ToolButton
              label="Move"
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1" />
                  <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6" />
                  <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
                  <path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 17" />
                </svg>
              }
              active={activeTool === 'move'}
              onClick={() => setActiveTool('move')}
              size={isMobile ? 44 : 48}
            />
          )}
          <ToolButton
            label="Compass"
            icon={
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="1" />
                <path d="M12 6l-4 14" />
                <path d="M12 6l4 14" />
                <path d="M6 18a6 6 0 0 0 12 0" />
              </svg>
            }
            active={activeTool === 'compass'}
            onClick={() => setActiveTool('compass')}
            size={isMobile ? 44 : 48}
          />
          <ToolButton
            label="Straightedge"
            icon={
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="20" x2="20" y2="4" />
              </svg>
            }
            active={activeTool === 'straightedge'}
            onClick={() => setActiveTool('straightedge')}
            size={isMobile ? 44 : 48}
          />
          {isMobile && (
            <ToolButton
              label="Pan"
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 11V5a2 2 0 0 1 4 0v6" />
                  <path d="M11 10V4a2 2 0 0 1 4 0v6" />
                  <path d="M15 11V7a2 2 0 0 1 4 0v4" />
                  <path d="M7 11v5a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6" />
                </svg>
              }
            active={panZoomEnabled}
            onClick={togglePanZoom}
            size={isMobile ? 44 : 48}
          />
          )}
        </div>

        {isCorrectionActive && (
          <div
            data-element="orientation-correction"
            style={{
              position: 'absolute',
              bottom: isMobile ? MOBILE_STEP_STRIP_HEIGHT + 16 : 16,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.82)',
              color: '#f8fafc',
              fontSize: 12,
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
              zIndex: 11,
            }}
          >
            Rotating to the standard orientation…
          </div>
        )}

        {/* Audio toggle */}
        <button
          data-action="toggle-audio"
          onClick={() => setAudioEnabled(!audioEnabled)}
          title={audioEnabled ? 'Mute narration' : 'Enable narration'}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid rgba(203, 213, 225, 0.8)',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(8px)',
            color: audioEnabled ? '#4E79A7' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.15s ease',
            zIndex: 10,
            padding: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {audioEnabled ? (
              <>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            ) : (
              <line x1="23" y1="9" x2="17" y2="15" />
            )}
          </svg>
        </button>

        {!isMobile && (
          <div
            data-element="shortcuts-hint"
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              fontSize: 12,
              color: 'rgba(100, 116, 139, 0.5)',
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Press ? for shortcuts
          </div>
        )}

        {/* Keyboard shortcuts overlay */}
        {showShortcuts && (
          <KeyboardShortcutsOverlay
            shortcuts={SHORTCUTS}
            onClose={() => setShowShortcuts(false)}
            isDark={false}
          />
        )}
      </div>

      {isMobile && !playgroundMode && !isProofOpen && (
        <div
          data-element="mobile-step-strip"
          style={{
            height: MOBILE_STEP_STRIP_HEIGHT,
            padding: '10px 14px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
            background: 'rgba(250, 250, 240, 0.98)',
            borderTop: '1px solid rgba(203, 213, 225, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748b',
                fontFamily: 'system-ui, sans-serif',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Step {Math.min(currentStep + 1, proposition.steps.length)} of{' '}
              {proposition.steps.length}
            </div>
            <button
              data-action="open-proof-panel"
              onClick={() => setIsProofOpen(true)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(203, 213, 225, 0.9)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#334155',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'system-ui, sans-serif',
                cursor: 'pointer',
              }}
            >
              All steps
            </button>
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1e293b',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.4,
            }}
          >
            {proposition.steps[currentStep]?.instruction}
          </div>
          {currentInstruction && (
            <div
              style={{
                fontSize: 12,
                color: '#4E79A7',
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1.4,
              }}
            >
              {currentInstruction}
            </div>
          )}
          {isComplete && completionResult && (
            <div
              style={{
                fontSize: 12,
                color: completionResult.status === 'proven' ? '#0f766e' : '#b91c1c',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                lineHeight: 1.3,
              }}
            >
              {completionResult.status === 'proven'
                ? `Conclusion: ${
                    completionResult.statement ?? 'Construction complete'
                  } • ${proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}`
                : `Proof incomplete: ${completionResult.statement ?? ''}`}
            </div>
          )}
        </div>
      )}

      {/* ── Right pane: Proof panel (hidden in playground mode) ── */}
      {!playgroundMode && showProofPanel && (
        <div
          data-element="proof-panel"
          style={{
            width: isMobile ? '100%' : 340,
            minWidth: isMobile ? 0 : 340,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#FAFAF0',
            borderLeft: isMobile ? undefined : '1px solid rgba(203, 213, 225, 0.6)',
            borderTop: isMobile ? '1px solid rgba(203, 213, 225, 0.6)' : undefined,
            position: isMobile ? 'absolute' : 'relative',
            left: isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            bottom: isMobile ? 0 : undefined,
            height: isMobile ? '60dvh' : '100%',
            boxShadow: isMobile ? '0 -10px 24px rgba(0,0,0,0.12)' : undefined,
            zIndex: isMobile ? 20 : undefined,
          }}
        >
          {/* Proposition header */}
          <div
            data-element="proof-header"
            style={{
              padding: '16px 20px 12px',
              borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 4,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Proposition I.{proposition.id}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#334155',
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                }}
              >
                {proposition.title}
              </div>
            </div>
            {isMobile && (
              <button
                data-action="close-proof-panel"
                onClick={() => setIsProofOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(203, 213, 225, 0.8)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Close steps panel"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Scrollable steps + proof chain */}
          <div
            ref={proofScrollRef}
            data-element="proof-steps"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '12px 20px',
            }}
          >
            {/* Given facts (atStep === -1, displayed before construction steps) */}
            {(() => {
              const givenFacts = factsByStep.get(-1) ?? []
              if (givenFacts.length === 0) return null
              return (
                <div data-element="given-facts" style={{ marginBottom: 16 }}>
                  {givenFacts.map((fact) => {
                    const highlighted = isFactHighlighted(fact)
                    return (
                      <div
                        key={fact.id}
                        onMouseEnter={() => setHoveredFactId(fact.id)}
                        onMouseLeave={() => setHoveredFactId(null)}
                        style={{
                          fontSize: 11,
                          marginBottom: 3,
                          paddingLeft: 8,
                          cursor: 'default',
                          borderLeft: highlighted
                            ? '2px solid #10b981'
                            : '2px solid rgba(78, 121, 167, 0.2)',
                          background: highlighted ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                          borderRadius: highlighted ? 2 : 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div>
                          <span
                            style={{
                              color: '#4E79A7',
                              fontWeight: 600,
                              fontFamily: 'Georgia, serif',
                            }}
                          >
                            {fact.statement}
                          </span>
                          <span
                            style={{
                              color: '#94a3b8',
                              fontFamily: 'Georgia, serif',
                              fontSize: 10,
                              fontWeight: 600,
                              marginLeft: 6,
                            }}
                          >
                            [Given]
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            {proposition.steps.map((step, i) => {
              const isDone = completedSteps[i]
              const isCurrent = i === currentStep && !isComplete
              const isFuture = !isDone && !isCurrent
              const stepFacts = factsByStep.get(i) ?? []

              const isHovered = isDone && hoveredStepIndex === i

              return (
                <div
                  key={i}
                  data-element="proof-step"
                  data-step-current={isCurrent ? 'true' : undefined}
                  onClick={isDone ? () => handleRewindToStep(i) : undefined}
                  onMouseEnter={
                    isDone
                      ? () => {
                          setHoveredStepIndex(i)
                          // Activate ghost geometry hover for macro steps
                          if (step.expected.type === 'macro') {
                            hoveredMacroStepRef.current = i
                            needsDrawRef.current = true
                          }
                        }
                      : undefined
                  }
                  onMouseLeave={
                    isDone
                      ? () => {
                          setHoveredStepIndex(null)
                          hoveredMacroStepRef.current = null
                          needsDrawRef.current = true
                        }
                      : undefined
                  }
                  style={{
                    marginBottom: 16,
                    opacity: isFuture ? 0.35 : 1,
                    transition: 'opacity 0.3s ease',
                    cursor: isDone ? 'pointer' : undefined,
                    borderRadius: 6,
                    background: isHovered ? 'rgba(16, 185, 129, 0.06)' : undefined,
                  }}
                >
                  {/* Step header: number + instruction + citation */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    {/* Step indicator */}
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'system-ui, sans-serif',
                        background: isDone
                          ? isHovered
                            ? '#0d9668'
                            : '#10b981'
                          : isCurrent
                            ? '#4E79A7'
                            : '#e2e8f0',
                        color: isDone || isCurrent ? '#fff' : '#94a3b8',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {isDone ? (isHovered ? '\u21BA' : '\u2713') : i + 1}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Formal instruction */}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent ? '#1e293b' : '#475569',
                          fontFamily: 'Georgia, serif',
                          lineHeight: 1.4,
                        }}
                      >
                        {step.instruction}
                      </div>

                      {/* Citation: progressive disclosure */}
                      {step.citation &&
                        (() => {
                          const cit = CITATIONS[step.citation]
                          const ord = citationOrdinals.get(`step-${i}`) ?? 1
                          const label = ord <= 2 ? (cit?.label ?? step.citation) : step.citation
                          const showText = ord === 1
                          return (
                            <div
                              data-element="citation-text"
                              style={{
                                marginTop: 4,
                                fontSize: 11,
                                lineHeight: 1.4,
                                color: isDone ? '#6b9b6b' : '#7893ab',
                                fontFamily: 'Georgia, serif',
                                fontStyle: 'italic',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontStyle: 'normal',
                                  fontSize: 10,
                                }}
                              >
                                {label}
                              </span>
                              {showText && cit?.text && (
                                <span style={{ marginLeft: 4 }}>— {cit.text}</span>
                              )}
                            </div>
                          )
                        })()}

                      {/* Tutorial guidance for current step */}
                      {isCurrent && currentInstruction && (
                        <div
                          data-element="step-guidance"
                          style={{
                            marginTop: 6,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: 'rgba(78, 121, 167, 0.06)',
                            border: '1px solid rgba(78, 121, 167, 0.15)',
                            fontSize: 12,
                            color: '#4E79A7',
                            fontFamily: 'system-ui, sans-serif',
                            lineHeight: 1.4,
                          }}
                        >
                          {currentInstruction}
                        </div>
                      )}

                      {/* Facts derived at this step */}
                      {stepFacts.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                          {stepFacts.map((fact) => {
                            const factCit = citationDefFromFact(fact.citation)
                            const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
                            const citLabel = factCit
                              ? ord <= 2
                                ? factCit.label
                                : factCit.key
                              : null
                            const showText = ord === 1 && factCit
                            const explanation = fact.justification.replace(
                              /^(Def\.15|C\.N\.\d|I\.\d+):\s*/,
                              ''
                            )
                            const highlighted = isFactHighlighted(fact)
                            return (
                              <div
                                key={fact.id}
                                onMouseEnter={() => setHoveredFactId(fact.id)}
                                onMouseLeave={() => setHoveredFactId(null)}
                                style={{
                                  fontSize: 11,
                                  marginBottom: 3,
                                  paddingLeft: 8,
                                  cursor: 'default',
                                  borderLeft: highlighted
                                    ? '2px solid #10b981'
                                    : '2px solid rgba(78, 121, 167, 0.2)',
                                  background: highlighted
                                    ? 'rgba(16, 185, 129, 0.08)'
                                    : 'transparent',
                                  borderRadius: highlighted ? 2 : 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div>
                                  <span
                                    style={{
                                      color: '#4E79A7',
                                      fontWeight: 600,
                                      fontFamily: 'Georgia, serif',
                                    }}
                                  >
                                    {fact.statement}
                                  </span>
                                  {citLabel && (
                                    <span
                                      style={{
                                        color: '#94a3b8',
                                        fontFamily: 'Georgia, serif',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        marginLeft: 6,
                                      }}
                                    >
                                      [{citLabel}]
                                    </span>
                                  )}
                                </div>
                                {showText && factCit?.text && (
                                  <div
                                    style={{
                                      color: '#94a3b8',
                                      fontStyle: 'italic',
                                      fontFamily: 'Georgia, serif',
                                      fontSize: 10,
                                      lineHeight: 1.3,
                                      marginTop: 1,
                                    }}
                                  >
                                    {factCit.text}
                                  </div>
                                )}
                                <div
                                  style={{
                                    color: '#94a3b8',
                                    fontStyle: 'italic',
                                    fontFamily: 'Georgia, serif',
                                    fontSize: 10,
                                    lineHeight: 1.3,
                                    marginTop: 1,
                                  }}
                                >
                                  {explanation}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Conclusion facts (atStep === steps.length) */}
            {(() => {
              const conclusionFacts = factsByStep.get(proposition.steps.length) ?? []
              if (conclusionFacts.length === 0 && !isComplete) return null
              return conclusionFacts.map((fact) => {
                const factCit = citationDefFromFact(fact.citation)
                const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
                const citLabel = factCit ? (ord <= 2 ? factCit.label : factCit.key) : null
                const showText = ord === 1 && factCit
                const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
                const highlighted = isFactHighlighted(fact)
                return (
                  <div
                    key={fact.id}
                    onMouseEnter={() => setHoveredFactId(fact.id)}
                    onMouseLeave={() => setHoveredFactId(null)}
                    style={{
                      fontSize: 11,
                      marginBottom: 3,
                      paddingLeft: 28,
                      marginLeft: 0,
                      cursor: 'default',
                    }}
                  >
                    <div
                      style={{
                        paddingLeft: 8,
                        borderLeft: highlighted
                          ? '2px solid #10b981'
                          : '2px solid rgba(16, 185, 129, 0.3)',
                        background: highlighted ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                        borderRadius: highlighted ? 2 : 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            color: '#4E79A7',
                            fontWeight: 600,
                            fontFamily: 'Georgia, serif',
                          }}
                        >
                          {fact.statement}
                        </span>
                        {citLabel && (
                          <span
                            style={{
                              color: '#94a3b8',
                              fontFamily: 'Georgia, serif',
                              fontSize: 10,
                              fontWeight: 600,
                              marginLeft: 6,
                            }}
                          >
                            [{citLabel}]
                          </span>
                        )}
                      </div>
                      {showText && factCit?.text && (
                        <div
                          style={{
                            color: '#94a3b8',
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, serif',
                            fontSize: 10,
                            lineHeight: 1.3,
                            marginTop: 1,
                          }}
                        >
                          {factCit.text}
                        </div>
                      )}
                      <div
                        style={{
                          color: '#94a3b8',
                          fontStyle: 'italic',
                          fontFamily: 'Georgia, serif',
                          fontSize: 10,
                          lineHeight: 1.3,
                          marginTop: 1,
                        }}
                      >
                        {explanation}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Conclusion bar — pinned at bottom, segments are hoverable */}
          {isComplete && completionResult && (
            <div
              data-element="proof-conclusion"
              style={{
                padding: '12px 20px',
                borderTop:
                  completionResult.status === 'proven'
                    ? '2px solid rgba(16, 185, 129, 0.4)'
                    : '2px solid rgba(239, 68, 68, 0.4)',
                background:
                  completionResult.status === 'proven'
                    ? 'rgba(16, 185, 129, 0.06)'
                    : 'rgba(239, 68, 68, 0.06)',
              }}
              onMouseLeave={() => {
                setHoveredProofDp(null)
                setHoveredFactId(null)
              }}
            >
              {completionResult.status === 'proven' ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      color: '#10b981',
                      fontWeight: 700,
                      fontSize: 15,
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {'∴ '}
                    {completionResult.segments.map((seg, idx) => (
                      <span key={seg.label}>
                        {idx > 0 && <span style={{ fontWeight: 400, margin: '0 2px' }}> = </span>}
                        <span
                          data-element="conclusion-segment"
                          onMouseEnter={() => setHoveredProofDp(seg.dp)}
                          style={{
                            cursor: 'default',
                            borderBottom: highlightState.dpKeys?.has(distancePairKey(seg.dp))
                              ? '2px solid #10b981'
                              : '2px solid transparent',
                            transition: 'border-color 0.15s ease',
                          }}
                        >
                          {seg.label}
                        </span>
                      </span>
                    ))}
                  </span>
                  {(() => {
                    // Render angle conclusion facts as interactive hoverable spans
                    const conclusionAngleFacts = (
                      factsByStep.get(proposition.steps.length) ?? []
                    ).filter(isAngleFact)
                    if (conclusionAngleFacts.length > 0) {
                      return (
                        <div
                          style={{
                            color: '#10b981',
                            fontSize: 11,
                            fontFamily: 'Georgia, serif',
                            fontStyle: 'italic',
                            marginTop: 2,
                            width: '100%',
                          }}
                        >
                          {conclusionAngleFacts.map((fact, idx) => (
                            <span key={fact.id}>
                              {idx > 0 && ', '}
                              <span
                                data-element="conclusion-angle"
                                onMouseEnter={() => setHoveredFactId(fact.id)}
                                onMouseLeave={() => setHoveredFactId(null)}
                                style={{
                                  cursor: 'default',
                                  borderBottom: isFactHighlighted(fact)
                                    ? '2px solid #10b981'
                                    : '2px solid transparent',
                                  transition: 'border-color 0.15s ease',
                                }}
                              >
                                {fact.statement}
                              </span>
                            </span>
                          ))}
                        </div>
                      )
                    }
                    // Fall back to static theorem conclusion text
                    if (proposition.theoremConclusion) {
                      return (
                        <div
                          style={{
                            color: '#10b981',
                            fontSize: 11,
                            fontFamily: 'Georgia, serif',
                            fontStyle: 'italic',
                            marginTop: 2,
                            width: '100%',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {proposition.theoremConclusion}
                        </div>
                      )
                    }
                    return null
                  })()}
                  <span
                    style={{
                      color: '#10b981',
                      fontStyle: 'italic',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'Georgia, serif',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}
                  </span>
                  {proposition.draggablePointIds && (
                    <div
                      data-element="drag-invitation"
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(78, 121, 167, 0.08)',
                        border: '1px solid rgba(78, 121, 167, 0.15)',
                        color: '#4E79A7',
                        fontSize: 12,
                        fontFamily: 'system-ui, sans-serif',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 1.4,
                      }}
                    >
                      Now try dragging the points to see that it always works.
                    </div>
                  )}
                </div>
              ) : (
                <span
                  style={{
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  Proof incomplete — could not establish equality for {completionResult.statement}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <ToyDebugPanel title="Euclid">
        <DebugCheckbox
          label="Construction music"
          checked={music.isPlaying}
          onChange={() => music.toggle()}
        />
        <DebugSlider
          label="Friction (β)"
          value={frictionCoeff}
          min={getFrictionRange().min}
          max={getFrictionRange().max}
          step={0.001}
          onChange={(v) => {
            setFrictionCoeff(v)
            setFriction(v)
          }}
          formatValue={(v) => v.toFixed(3)}
        />
        <DebugSlider
          label="Ghost opacity"
          value={ghostBaseOpacityVal}
          min={getGhostBaseOpacityRange().min}
          max={getGhostBaseOpacityRange().max}
          step={0.01}
          onChange={(v) => {
            setGhostBaseOpacityVal(v)
            setGhostBaseOpacity(v)
            needsDrawRef.current = true
          }}
          formatValue={(v) => v.toFixed(2)}
        />
        <DebugSlider
          label="Ghost depth falloff"
          value={ghostFalloffCoeff}
          min={getGhostFalloffRange().min}
          max={getGhostFalloffRange().max}
          step={0.01}
          onChange={(v) => {
            setGhostFalloffCoeff(v)
            setGhostFalloff(v)
            needsDrawRef.current = true
          }}
          formatValue={(v) => v.toFixed(2)}
        />
        {!isComplete && proposition.steps.length > 0 && (
          <button
            data-action="auto-complete"
            onClick={() => setAutoCompleting(true)}
            disabled={autoCompleting}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: autoCompleting ? 'rgba(129,140,248,0.4)' : 'rgba(129,140,248,0.8)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: autoCompleting ? 'default' : 'pointer',
              opacity: autoCompleting ? 0.7 : 1,
            }}
          >
            {autoCompleting ? 'Completing…' : 'Complete Construction'}
          </button>
        )}
      </ToyDebugPanel>
    </div>
  )
}

// ── Tool button component ──

interface ToolButtonProps {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  size?: number
}

function ToolButton({ label, icon, active, onClick, size = 48 }: ToolButtonProps) {
  return (
    <button
      data-action={`tool-${label.toLowerCase()}`}
      onClick={onClick}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        border: active ? '2px solid #4E79A7' : '1px solid rgba(203, 213, 225, 0.8)',
        background: active ? 'rgba(78, 121, 167, 0.1)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(8px)',
        color: active ? '#4E79A7' : '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
    </button>
  )
}
