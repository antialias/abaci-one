'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
  CompassPhase,
  StraightedgePhase,
  ExtendPhase,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ConstructionElement,
  ConstructionPoint,
  TutorialHint,
  TutorialSubStep,
  ExpectedAction,
  GhostLayer,
  MacroCeremonyState,
} from './types'
import { needsExtendedSegments, BYRNE_CYCLE } from './types'
import {
  initializeGiven,
  addPoint,
  addCircle,
  addSegment,
  getPoint,
  getAllPoints,
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
import { PlaygroundCreationsPanel } from './PlaygroundCreationsPanel'
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
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'
import { CitationPopover } from './foundations/CitationPopover'
import { getFoundationHref } from './foundations/citationUtils'
import { MacroToolPanel } from './MacroToolPanel'

// ── Keyboard shortcuts ──

const SHORTCUTS: ShortcutEntry[] = [
  { key: 'V', description: 'Toggle pan/zoom (disabled by default)' },
  { key: 'G', description: 'Include ghost geometry in auto-zoom bounds' },
  { key: '?', description: 'Toggle this help' },
]

const MOBILE_PROOF_PANEL_HEIGHT_RATIO = 0.35
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
const AUTO_FIT_CEREMONY_PPU_DELTA = 4

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
  const points = state.elements.filter((e): e is ConstructionPoint => e.kind === 'point')
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
  const screenBounds = getScreenBoundsForViewport(
    bounds,
    centerX,
    centerY,
    ppu,
    cssWidth,
    cssHeight
  )
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

  const label = (id: string) => getPoint(state, id)?.label ?? id.replace(/^pt-/, '')
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
  /** Optional narration style (defaults to standard). */
  languageStyle?: KidLanguageStyle
  completionMeta?: {
    unlocked: number[]
    nextPropId: number | null
    onNavigateNext: (propId: number) => void
    onNavigateMap: () => void
  }
  /** Pre-populate playground with a saved creation's actions */
  initialActions?: import('./engine/replayConstruction').PostCompletionAction[]
  /** Override given point positions for loaded creations */
  initialGivenPoints?: Array<{ id: string; x: number; y: number }>
  /** Active player ID — stored with saved creations so they belong to the kid, not the account */
  playerId?: string | null
  /**
   * Start with audio disabled and manage it locally (independent of the global audio manager).
   * Useful when embedding the canvas in a context where auto-play narration would be disruptive
   * (e.g. a blog post). The user can still toggle audio on via the speaker button.
   */
  disableAudio?: boolean
}

const WRONG_MOVE_PHRASES = [
  "Not quite. Let's try that step again.",
  "Hmm, that's not right. Try again.",
  "That's not it. Here's the step one more time:",
  'Oops! Let me remind you:',
]

export function EuclidCanvas({
  propositionId = 1,
  onComplete,
  playgroundMode,
  languageStyle,
  completionMeta,
  initialActions,
  initialGivenPoints,
  playerId,
  disableAudio,
}: EuclidCanvasProps) {
  const isMobile = useIsMobile()
  const proofFont = {
    header: isMobile ? 11 : 14,
    title: isMobile ? 11 : 14,
    stepTitle: isMobile ? 11 : 13,
    stepText: isMobile ? 10 : 12,
    hint: isMobile ? 9 : 11,
    citation: isMobile ? 9 : 10,
    conclusion: isMobile ? 12 : 15,
  }
  const propositionBase =
    (propositionId === 0 ? PLAYGROUND_PROP : PROP_REGISTRY[propositionId]) ?? PROP_REGISTRY[1]
  const proposition = useMemo(() => {
    if (!initialGivenPoints || initialGivenPoints.length === 0) return propositionBase
    const overrideMap = new Map(initialGivenPoints.map((p) => [p.id, p]))
    return {
      ...propositionBase,
      givenElements: propositionBase.givenElements.map((el) => {
        if (el.kind === 'point' && overrideMap.has(el.id)) {
          const pos = overrideMap.get(el.id)!
          return { ...el, x: pos.x, y: pos.y }
        }
        return el
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propositionId])
  const stepInstructionOverrides = useMemo(() => {
    if (!languageStyle) return null
    return proposition.stepInstructionsByStyle?.[languageStyle] ?? null
  }, [languageStyle, proposition])
  const steps = useMemo(() => {
    if (!stepInstructionOverrides) return proposition.steps
    return proposition.steps.map((step, idx) => {
      const instruction = stepInstructionOverrides[idx]
      return instruction ? { ...step, instruction } : step
    })
  }, [proposition.steps, stepInstructionOverrides])
  const extendSegments = useMemo(() => needsExtendedSegments(proposition), [proposition])
  const getTutorial = proposition.getTutorial ?? (() => [] as TutorialSubStep[][])
  // All prior propositions that have applicable macros
  const availableMacros = useMemo(() => {
    return Object.entries(MACRO_REGISTRY)
      .filter(([key]) => Number(key) < propositionId)
      .map(([, def]) => ({
        propId: def.propId,
        def,
        title: PROP_REGISTRY[def.propId]?.title ?? '',
      }))
  }, [propositionId])
  const explorationNarration = useMemo(() => {
    if (!languageStyle) return proposition.explorationNarration
    return (
      proposition.explorationNarrationByStyle?.[languageStyle] ?? proposition.explorationNarration
    )
  }, [languageStyle, proposition])

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
  const activeToolRef = useRef<ActiveTool>(steps[0]?.tool ?? 'compass')
  const expectedActionRef = useRef<ExpectedAction | null>(steps[0]?.expected ?? null)
  const needsDrawRef = useRef(true)
  const rafRef = useRef<number>(0)
  const macroPhaseRef = useRef<MacroPhase>({ tag: 'idle' })
  const extendPhaseRef = useRef<ExtendPhase>({ tag: 'idle' })
  const extendPreviewRef = useRef<{ x: number; y: number } | null>(null)
  const [macroPhase, setMacroPhase] = useState<MacroPhase>({ tag: 'idle' })
  const macroAnimationRef = useRef<MacroAnimation | null>(null)
  const wiggleCancelRef = useRef<(() => void) | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(true)
  const straightedgeDrawAnimRef = useRef<StraightedgeDrawAnim | null>(null)
  const superpositionFlashRef = useRef<SuperpositionFlash | null>(null)
  const isCompleteRef = useRef(false)
  const completionTimeRef = useRef<number>(0)
  const postCompletionActionsRef = useRef<PostCompletionAction[]>(initialActions ?? [])
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const hoveredMacroStepRef = useRef<number | null>(null)
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const ghostBoundsEnabledRef = useRef(false)
  const macroRevealRef = useRef<MacroCeremonyState | null>(null)
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
  const wrongMoveCounterRef = useRef(0)

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>(
    playgroundMode ? 'move' : (steps[0]?.tool ?? 'compass')
  )
  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0)
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(steps.map(() => false))
  const [isComplete, setIsComplete] = useState(playgroundMode ? true : false)
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ceremonyLabel, setCeremonyLabel] = useState<string | null>(null)
  const [proofFacts, setProofFacts] = useState<ProofFact[]>([])
  const proofFactsRef = useRef<ProofFact[]>([])
  const snapshotStackRef = useRef<ProofSnapshot[]>([
    captureSnapshot(constructionRef.current, candidatesRef.current, [], []),
  ])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [panZoomEnabled, setPanZoomEnabled] = useState(false)
  const [isToolDockActive, setIsToolDockActive] = useState(false)
  const [isCorrectionActive, setIsCorrectionActive] = useState(false)
  const [frictionCoeff, setFrictionCoeff] = useState(getFriction)
  const [ghostBaseOpacityVal, setGhostBaseOpacityVal] = useState(getGhostBaseOpacity)
  const [ghostFalloffCoeff, setGhostFalloffCoeff] = useState(getGhostFalloff)
  const [hoveredProofDp, setHoveredProofDp] = useState<DistancePair | null>(null)
  const [hoveredFactId, setHoveredFactId] = useState<number | null>(null)
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null)
  const [activeCitation, setActiveCitation] = useState<{ key: string; rect: DOMRect } | null>(null)
  const citationShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const citationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popoverHoveredRef = useRef(false)
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
  // Citation popover handlers
  const handleCitationPointerEnter = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (isMobile) return
      if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      citationShowTimerRef.current = setTimeout(() => {
        setActiveCitation({ key, rect })
      }, 200)
    },
    [isMobile]
  )

  const handleCitationPointerLeave = useCallback(() => {
    if (isMobile) return
    if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
    citationHideTimerRef.current = setTimeout(() => {
      if (!popoverHoveredRef.current) setActiveCitation(null)
    }, 300)
  }, [isMobile])

  const handleCitationPointerDown = useCallback(
    (key: string, e: React.PointerEvent) => {
      if (!isMobile) return
      e.preventDefault()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setActiveCitation({ key, rect })
    },
    [isMobile]
  )

  // Mobile: dismiss popover when press ends anywhere
  useEffect(() => {
    if (!isMobile) return
    const dismiss = () => setActiveCitation(null)
    window.addEventListener('pointerup', dismiss)
    window.addEventListener('pointercancel', dismiss)
    return () => {
      window.removeEventListener('pointerup', dismiss)
      window.removeEventListener('pointercancel', dismiss)
    }
  }, [isMobile])

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

  // ── Macro tool handlers ──

  /** propId required by the current guided step, or null if not a macro step */
  const guidedPropId = useMemo(() => {
    if (currentStep >= steps.length) return null
    const expected = steps[currentStep].expected
    return expected.type === 'macro' ? expected.propId : null
  }, [currentStep, steps])

  const handleMacroPhaseChange = useCallback((phase: MacroPhase) => {
    setMacroPhase(phase)
  }, [])

  const handleMacroToolClick = useCallback(() => {
    setActiveTool('macro')
    activeToolRef.current = 'macro'
    // If there's only one macro available, skip the picker and go straight to selecting
    if (availableMacros.length === 1) {
      const { propId, def } = availableMacros[0]
      const phase: MacroPhase = {
        tag: 'selecting',
        propId,
        inputLabels: def.inputLabels,
        selectedPointIds: [],
      }
      macroPhaseRef.current = phase
      setMacroPhase(phase)
    } else {
      const choosingPhase: MacroPhase = { tag: 'choosing' }
      macroPhaseRef.current = choosingPhase
      setMacroPhase(choosingPhase)
    }
  }, [availableMacros])

  const handleMacroPropositionSelect = useCallback((propId: number) => {
    const macroDef = MACRO_REGISTRY[propId]
    console.log(
      '[macro-debug] handleMacroPropositionSelect propId=%d macroDef=%o',
      propId,
      macroDef
    )
    if (!macroDef) return
    const phase: MacroPhase = {
      tag: 'selecting',
      propId,
      inputLabels: macroDef.inputLabels,
      selectedPointIds: [],
    }
    console.log('[macro-debug] setting macroPhaseRef to', phase)
    macroPhaseRef.current = phase
    setMacroPhase(phase)
  }, [])

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

  const showProofPanel = !playgroundMode

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
  const prevExtendTagRef = useRef('idle')

  const tutorialSubSteps = useMemo(
    () => getTutorial(isTouch, { languageStyle }),
    [isTouch, getTutorial, languageStyle]
  )
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
  const { isEnabled: globalAudioEnabled, setEnabled: setAudioEnabled } = useAudioManager()
  // When disableAudio is set, manage audio state locally so we don't auto-play on mount
  // (useful for blog embeds). The user can still toggle it on via the speaker button.
  const [localAudioEnabled, setLocalAudioEnabled] = useState(false)
  const audioEnabled = disableAudio ? localAudioEnabled : globalAudioEnabled
  const audioEnabledRef = useRef(audioEnabled)
  audioEnabledRef.current = audioEnabled
  const currentSpeechRef = useRef(currentSpeech)
  currentSpeechRef.current = currentSpeech
  const sayCorrection = useTTS(
    {
      say: {
        en: 'You chose the lower intersection. I will rotate the triangle 180 degrees around the midpoint of AB. That swaps A and B, so I will relabel them so A stays on the left. Then we can explore.',
      },
      tone: 'tutorial-instruction',
    },
    {}
  )
  const sayMacroReveal = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const sayMacroRevealRef = useRef(sayMacroReveal)
  sayMacroRevealRef.current = sayMacroReveal
  // Generic correction speaker — called with dynamic text for wrong-move feedback
  const speakStepCorrection = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const speakStepCorrectionRef = useRef(speakStepCorrection)
  speakStepCorrectionRef.current = speakStepCorrection
  const { handleDragStart, handleConstructionBreakdown } = useEuclidAudioHelp({
    instruction: currentSpeech,
    isComplete,
    celebrationText:
      completionResult?.status === 'proven' && completionResult.statement
        ? completionResult.statement
        : 'Construction complete!',
    explorationNarration,
    enabledOverride: disableAudio ? audioEnabled : undefined,
  })

  // ── Fire onComplete callback and auto-select Move tool ──
  useEffect(() => {
    if (isComplete) {
      if (onComplete && !playgroundMode) onComplete(propositionId)
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
      if (!playgroundMode && proposition.draggablePointIds && !correctionActiveRef.current) {
        setActiveTool('move')
        activeToolRef.current = 'move'
      }
      if (!playgroundMode) musicRef.current?.notifyCompletion()
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

  // ── Completion wiggle — invite kids to drag given points ──
  useEffect(() => {
    if (!isComplete) return
    if (playgroundMode) return // no wiggle in freeform playground
    if (!proposition.draggablePointIds || proposition.draggablePointIds.length === 0) return

    const draggableIds = proposition.draggablePointIds
    const computeFn = proposition.computeGivenElements

    // Snapshot initial world positions of every draggable given point
    const initialPositions = new Map<string, { x: number; y: number }>()
    for (const el of constructionRef.current.elements) {
      if (el.kind === 'point' && el.origin === 'given' && draggableIds.includes(el.id)) {
        initialPositions.set(el.id, { x: el.x, y: el.y })
      }
    }
    if (initialPositions.size === 0) return

    // Per-point random sinusoid parameters
    const params = [...initialPositions.keys()].map((ptId) => {
      const canvas = canvasRef.current
      const cssMin = canvas
        ? Math.min(canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height)
        : 600
      const ppu = viewportRef.current.pixelsPerUnit
      const amp = ((0.0025 + Math.random() * 0.00375) * cssMin) / ppu // 0.25–0.625 % of viewport
      return {
        ptId,
        ax: amp * (0.6 + Math.random() * 0.8),
        ay: amp * (0.6 + Math.random() * 0.8),
        freqX: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000), // 2–4 Hz
        freqY: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000),
        phaseX: Math.random() * 2 * Math.PI,
        phaseY: Math.random() * 2 * Math.PI,
      }
    })

    const DURATION_MS = 1500
    let frameId = 0
    let cancelled = false

    function applyPositions(positions: Map<string, { x: number; y: number }>) {
      let givenElements: ConstructionElement[]
      if (computeFn) {
        givenElements = computeFn(positions)
      } else {
        givenElements = proposition.givenElements.map((el) => {
          if (el.kind === 'point' && positions.has(el.id)) {
            const pos = positions.get(el.id)!
            return { ...el, x: pos.x, y: pos.y }
          }
          return el
        })
      }
      const result = replayConstruction(
        givenElements,
        proposition.steps,
        proposition,
        postCompletionActionsRef.current
      )
      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      ghostLayersRef.current = result.ghostLayers
      factStoreRef.current = result.factStore
    }

    function frame(now: number) {
      if (cancelled) return
      const t = now - startMs
      if (t >= DURATION_MS) {
        applyPositions(initialPositions)
        needsDrawRef.current = true
        return
      }
      // Sine envelope: eases in and out for a smooth wiggle feel
      const envelope = Math.sin((t / DURATION_MS) * Math.PI)
      const positions = new Map(initialPositions)
      for (const p of params) {
        const orig = initialPositions.get(p.ptId)!
        positions.set(p.ptId, {
          x: orig.x + envelope * p.ax * Math.sin(p.freqX * t + p.phaseX),
          y: orig.y + envelope * p.ay * Math.sin(p.freqY * t + p.phaseY),
        })
      }
      applyPositions(positions)
      needsDrawRef.current = true
      frameId = requestAnimationFrame(frame)
    }

    let startMs = 0
    // Short delay so the completion moment has time to render first
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        startMs = performance.now()
        frameId = requestAnimationFrame(frame)
      }
    }, 400)

    const cancel = () => {
      cancelled = true
      clearTimeout(timeoutId)
      cancelAnimationFrame(frameId)
      // Snap back to original so no stale offset remains
      applyPositions(initialPositions)
      needsDrawRef.current = true
    }
    wiggleCancelRef.current = cancel

    return () => {
      cancel()
      wiggleCancelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, proposition.id])

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

  // ── Replay initial creation state (for loaded playground creations) ──
  useEffect(() => {
    if (!initialActions || initialActions.length === 0) return
    const result = replayConstruction(
      proposition.givenElements,
      proposition.steps,
      proposition,
      initialActions
    )
    constructionRef.current = result.state
    candidatesRef.current = result.candidates
    proofFactsRef.current = result.proofFacts
    ghostLayersRef.current = result.ghostLayers
    needsDrawRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync active tool to ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // ── Auto-select tool and sync expected action based on current step ──
  useEffect(() => {
    if (currentStep >= steps.length) {
      expectedActionRef.current = null
      return
    }
    const stepDef = steps[currentStep]
    expectedActionRef.current = stepDef.expected

    if (stepDef.tool === null) return

    // In guided mode, auto-select the required proposition so the user can
    // immediately tap canvas points. The panel will appear showing the
    // active proposition with point-selection progress.
    if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
      const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
      if (macroDef) {
        const phase: MacroPhase = {
          tag: 'selecting',
          propId: stepDef.expected.propId,
          inputLabels: macroDef.inputLabels,
          selectedPointIds: [],
        }
        macroPhaseRef.current = phase
        setMacroPhase(phase)
      }
    }

    if (stepDef.tool !== activeTool) {
      setActiveTool(stepDef.tool)
      activeToolRef.current = stepDef.tool

      const toolLabels: Record<string, string> = {
        compass: 'Compass',
        straightedge: 'Straightedge',
        extend: 'Straightedge',
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
    const newFacts = conclusionFn(factStoreRef.current, constructionRef.current, steps.length)
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
  }, [isComplete, proposition.id, steps.length, proposition.superpositionFlash])

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
      } else if ((e.key === 'g' || e.key === 'G') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        ghostBoundsEnabledRef.current = !ghostBoundsEnabledRef.current
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanZoom])

  // ── Wrong-move correction ──

  const triggerCorrection = useCallback(
    (step: number) => {
      const snapshot = snapshotStackRef.current[step]
      if (!snapshot) return

      // Revert construction state to what it was before the wrong action
      constructionRef.current = snapshot.construction
      candidatesRef.current = snapshot.candidates
      proofFactsRef.current = snapshot.proofFacts
      setProofFacts(snapshot.proofFacts)
      ghostLayersRef.current = snapshot.ghostLayers
      factStoreRef.current = rebuildFactStore(snapshot.proofFacts)

      // Clear any ongoing draw animations
      straightedgeDrawAnimRef.current = null
      macroAnimationRef.current = null
      macroRevealRef.current = null

      // Reset tool phases so no in-flight gesture survives the revert
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      macroPhaseRef.current = { tag: 'idle' }
      setMacroPhase({ tag: 'idle' })

      // Lock all tool interactions for the duration of the correction narration
      correctionActiveRef.current = true

      const phrase = WRONG_MOVE_PHRASES[wrongMoveCounterRef.current++ % WRONG_MOVE_PHRASES.length]
      const instruction = currentSpeechRef.current || steps[step].instruction

      const unlock = () => {
        correctionActiveRef.current = false
      }

      if (audioEnabledRef.current) {
        speakStepCorrectionRef
          .current({ say: { en: phrase } })
          .then(() => speakStepCorrectionRef.current({ say: { en: instruction } }))
          .finally(unlock)
      } else {
        setTimeout(unlock, 1200)
      }

      requestDraw()
    },
    [steps, requestDraw, setProofFacts, setMacroPhase]
  )

  // ── Step validation (uses ref to avoid stale closures) ──

  const checkStep = useCallback(
    (element: ConstructionElement, candidate?: IntersectionCandidate) => {
      const step = currentStepRef.current
      if (step >= steps.length) return

      const stepDef = steps[step]
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
        if (nextStep >= steps.length) {
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
      } else {
        triggerCorrection(step)
      }
    },
    [steps, extendSegments, triggerCorrection]
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

  const handleCommitExtend = useCallback(
    (baseId: string, throughId: string, _projX: number, _projY: number) => {
      const step = currentStepRef.current
      if (step >= steps.length) return
      const expected = steps[step].expected
      if (expected.type !== 'extend') return

      // Use expected.distance along the ray (student click determines direction only)
      const basePt = getPoint(constructionRef.current, expected.baseId)
      const throughPt = getPoint(constructionRef.current, expected.throughId)
      if (!basePt || !throughPt) return

      const dx = throughPt.x - basePt.x
      const dy = throughPt.y - basePt.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 0.001) return

      const dirX = dx / len
      const dirY = dy / len
      const newX = throughPt.x + dirX * expected.distance
      const newY = throughPt.y + dirY * expected.distance

      const ptResult = addPoint(
        constructionRef.current,
        newX,
        newY,
        'intersection',
        expected.label
      )
      constructionRef.current = ptResult.state

      const segResult = addSegment(
        constructionRef.current,
        expected.throughId,
        ptResult.point.id
      )
      constructionRef.current = segResult.state

      const ptCands = findNewIntersections(
        constructionRef.current,
        ptResult.point,
        candidatesRef.current,
        extendSegments
      )
      const segCands = findNewIntersections(
        constructionRef.current,
        segResult.segment,
        [...candidatesRef.current, ...ptCands],
        extendSegments
      )
      candidatesRef.current = [...candidatesRef.current, ...ptCands, ...segCands]

      checkStep(ptResult.point)
      requestDraw()
    },
    [steps, checkStep, requestDraw, extendSegments]
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      // In guided mode, reject candidates that don't match the current step's expected ofA/ofB.
      // This prevents wrong taps from creating points that derail subsequent steps.
      const step = currentStepRef.current
      let explicitLabel: string | undefined
      if (step < steps.length) {
        const expected = steps[step].expected
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
              if (!correctionActiveRef.current && audioEnabledRef.current) {
                speakStepCorrectionRef.current({
                  say: { en: "That's not the intersection we need. Try a different one." },
                })
              }
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
    [checkStep, requestDraw, steps]
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const step = currentStepRef.current
      const expected = step < steps.length ? steps[step].expected : null

      // A macro application is "guided" when the current step expects this exact proposition.
      // In guided mode: full flow with snapshot, ceremony, and step advancement.
      // In free mode: apply elements immediately, reopen picker for another application.
      const isGuidedStep = expected?.type === 'macro' && expected.propId === propId
      const outputLabels =
        isGuidedStep && expected?.type === 'macro' ? expected.outputLabels : undefined

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
      if (result.newFacts.length > 0) {
        proofFactsRef.current = [...proofFactsRef.current, ...result.newFacts]
        setProofFacts(proofFactsRef.current)
      }

      if (!isGuidedStep) {
        if (!isCompleteRef.current) {
          // ── Wrong macro during guided steps ──────────────────────────
          // The user applied a macro that doesn't match the expected action.
          // Revert and narrate.
          triggerCorrection(step)
          return
        }
        // ── Free-form path (post-completion) ─────────────────────────
        // Apply elements immediately without ceremony or step advancement.
        // Record action so drag replay can reconstruct these elements.
        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          { type: 'macro' as const, propId, inputPointIds, atStep: step },
        ]
        // Add ghost layers immediately (no ceremony in free-form)
        const macroGhosts = result.ghostLayers.map((gl) => ({ ...gl, atStep: step }))
        ghostLayersRef.current = [...ghostLayersRef.current, ...macroGhosts]
        macroAnimationRef.current = createMacroAnimation(result)
        if (availableMacros.length === 1) {
          const { propId: mpId, def: mDef } = availableMacros[0]
          const nextPhase: MacroPhase = {
            tag: 'selecting',
            propId: mpId,
            inputLabels: mDef.inputLabels,
            selectedPointIds: [],
          }
          macroPhaseRef.current = nextPhase
          setMacroPhase(nextPhase)
        } else {
          const choosingPhase: MacroPhase = { tag: 'choosing' }
          macroPhaseRef.current = choosingPhase
          setMacroPhase(choosingPhase)
        }
        requestDraw()
        musicRef.current?.notifyChange()
        return
      }

      // ── Guided path ───────────────────────────────────────────────
      // Collect ghost layers produced by the macro itself
      const macroGhosts = result.ghostLayers.map((gl) => ({ ...gl, atStep: step }))
      if (macroGhosts.length > 0) {
        ghostLayersRef.current = [...ghostLayersRef.current, ...macroGhosts]
      }

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

      // Check if any ghost layers have revealGroups (ceremony needed)
      const hasCeremony = macroGhosts.some((gl) => gl.revealGroups && gl.revealGroups.length > 0)

      // Build the step-advance closure.
      // For ceremony: also starts macroAnimation so construction elements appear
      // after the ghost reveal rather than racing with it.
      const stepToAdvance = step
      const doAdvanceStep = () => {
        setCompletedSteps((prev) => {
          const next = [...prev]
          next[stepToAdvance] = true
          return next
        })
        const nextSt = stepToAdvance + 1
        currentStepRef.current = nextSt
        if (nextSt >= steps.length) {
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
        setCurrentStep(nextSt)
        // Start macro animation now — elements appear after ghost ceremony
        macroAnimationRef.current = createMacroAnimation(result)
        setCeremonyLabel(null)
        musicRef.current?.notifyChange()
      }

      if (hasCeremony) {
        // Animation durations by element type
        const elemAnimDurationMs = (el: GhostLayer['elements'][number]): number => {
          if (el.kind === 'circle') return 700
          if (el.kind === 'segment') return 400
          return 0
        }

        // Sort layers deepest-first so dependencies are shown before the result
        const sorted = [...macroGhosts].sort((a, b) => b.depth - a.depth)
        const sequence: Array<{ layerKey: string; groupIndex: number; msDelay: number }> = []
        let lastGroupMaxDurationMs = 0 // draw duration of the previous group, for timing
        for (const layer of sorted) {
          const key = `${layer.atStep}:${layer.depth}`
          const groupCount = layer.revealGroups?.length ?? 1
          for (let g = 0; g < groupCount; g++) {
            // First group: initial pause before anything appears
            // Subsequent groups: wait for previous group to finish drawing + small pause
            const msDelay = sequence.length === 0 ? 400 : lastGroupMaxDurationMs + 200
            sequence.push({ layerKey: key, groupIndex: g + 1, msDelay })
            // Compute this group's max draw duration for the next group's delay
            const group = layer.revealGroups?.[g]
            lastGroupMaxDurationMs = group
              ? Math.max(0, ...group.map((idx) => elemAnimDurationMs(layer.elements[idx])))
              : 400
          }
        }
        const depth1Layer = macroGhosts.find((gl) => gl.depth === 1)
        const narrationText = depth1Layer?.keyNarration ?? ''
        const propTitle = PROP_REGISTRY[propId]?.title ?? ''
        setCeremonyLabel(`Applying I.${propId}${propTitle ? ` · ${propTitle}` : ''}`)
        macroRevealRef.current = {
          sequence,
          revealed: 0,
          lastRevealMs: performance.now(),
          narrationText,
          narrationFired: false,
          allShownMs: null,
          postNarrationDelayMs: 1200,
          advanceStep: doAdvanceStep,
          elementAnims: new Map(),
          // Keep macro output elements hidden until ceremony completes so the
          // ghost construction is revealed before the solid result appears
          hiddenElementIds: new Set(result.addedElements.map((e) => e.id)),
        }
      } else {
        // No ceremony — advance step and start animation immediately
        macroAnimationRef.current = createMacroAnimation(result)
        doAdvanceStep()
      }

      requestDraw()
    },
    [steps, extendSegments, requestDraw, triggerCorrection]
  )

  // ── Save / share / new / panel (playground mode only) ──
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [showCreationsPanel, setShowCreationsPanel] = useState(false)

  const handleNewCanvas = useCallback(() => {
    constructionRef.current = initializeGiven(proposition.givenElements)
    candidatesRef.current = []
    postCompletionActionsRef.current = []
    ghostLayersRef.current = []
    proofFactsRef.current = []
    compassPhaseRef.current = { tag: 'idle' }
    straightedgePhaseRef.current = { tag: 'idle' }
    const idlePhase: MacroPhase = { tag: 'idle' }
    macroPhaseRef.current = idlePhase
    setMacroPhase(idlePhase)
    setSaveState('idle')
    setSavedId(null)
    setLinkCopied(false)
    needsDrawRef.current = true
  }, [proposition.givenElements])

  const handleSave = useCallback(async () => {
    if (saveState === 'saving') return
    setSaveState('saving')

    // Capture thumbnail: draw main canvas onto a small offscreen canvas
    let thumbnail: string | undefined
    const srcCanvas = canvasRef.current
    if (srcCanvas) {
      const THUMB_W = 400
      const THUMB_H = 300
      const off = document.createElement('canvas')
      off.width = THUMB_W
      off.height = THUMB_H
      const ctx = off.getContext('2d')
      if (ctx) {
        ctx.drawImage(srcCanvas, 0, 0, THUMB_W, THUMB_H)
        thumbnail = off.toDataURL('image/jpeg', 0.75)
      }
    }

    // Collect given point positions
    const givenPoints = getAllPoints(constructionRef.current)
      .filter((pt) => pt.origin === 'given')
      .map((pt) => ({ id: pt.id, x: pt.x, y: pt.y }))

    const data = {
      givenPoints,
      actions: postCompletionActionsRef.current,
    }

    try {
      const res = await fetch('/api/euclid/creations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, thumbnail, isPublic: true, playerId: playerId ?? null }),
      })
      const json = await res.json()
      if (res.ok) {
        setSavedId(json.id)
        setSaveState('saved')
      } else {
        setSaveState('idle')
      }
    } catch {
      setSaveState('idle')
    }
  }, [saveState])

  const handleCopyLink = useCallback(() => {
    if (!savedId) return
    const url = `${window.location.origin}/toys/euclid/creations/${savedId}`
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }, [savedId])

  const handlePlaceFreePoint = useCallback(
    (worldX: number, worldY: number) => {
      if (!isCompleteRef.current) return
      const result = addPoint(constructionRef.current, worldX, worldY, 'free')
      constructionRef.current = result.state
      // Record action for replay during drag
      postCompletionActionsRef.current = [
        ...postCompletionActionsRef.current,
        {
          type: 'free-point' as const,
          id: result.point.id,
          label: result.point.label,
          x: worldX,
          y: worldY,
        },
      ]
      requestDraw()
    },
    [requestDraw]
  )

  const handleRewindToStep = useCallback(
    (targetStep: number) => {
      const snapshot = snapshotStackRef.current[targetStep]
      if (!snapshot) return

      // 1. Reset all tool phases to idle, clear animations
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      macroPhaseRef.current = { tag: 'idle' }
      setMacroPhase({ tag: 'idle' })
      macroAnimationRef.current = null
      macroRevealRef.current = null
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
      if (targetStep < steps.length) {
        const stepDef = steps[targetStep]
        expectedActionRef.current = stepDef.expected
        if (stepDef.tool !== null) {
          setActiveTool(stepDef.tool)
          activeToolRef.current = stepDef.tool

          // In guided mode, auto-select the required proposition on rewind
          if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
            const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
            if (macroDef) {
              const phase: MacroPhase = {
                tag: 'selecting',
                propId: stepDef.expected.propId,
                inputLabels: macroDef.inputLabels,
                selectedPointIds: [],
              }
              macroPhaseRef.current = phase
              setMacroPhase(phase)
            }
          }
        }
      } else {
        expectedActionRef.current = null
      }

      requestDraw()
    },
    [steps, requestDraw]
  )

  // ── Auto-complete: execute each step on 250ms interval ──
  useEffect(() => {
    if (!autoCompleting) return

    const interval = setInterval(() => {
      const step = currentStepRef.current
      if (step >= steps.length) {
        setAutoCompleting(false)
        return
      }

      const expected = steps[step].expected

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
      } else if (expected.type === 'extend') {
        // Auto-complete extend steps: compute position and commit
        const basePt = getPoint(constructionRef.current, expected.baseId)
        const throughPt = getPoint(constructionRef.current, expected.throughId)
        if (basePt && throughPt) {
          const dx = throughPt.x - basePt.x
          const dy = throughPt.y - basePt.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len > 0.001) {
            const dirX = dx / len
            const dirY = dy / len
            const newX = throughPt.x + dirX * expected.distance
            const newY = throughPt.y + dirY * expected.distance
            const ptResult = addPoint(
              constructionRef.current,
              newX,
              newY,
              'intersection',
              expected.label
            )
            constructionRef.current = ptResult.state
            const segResult = addSegment(
              constructionRef.current,
              expected.throughId,
              ptResult.point.id
            )
            constructionRef.current = segResult.state
            const ptCands = findNewIntersections(
              constructionRef.current,
              ptResult.point,
              candidatesRef.current,
              extendSegments
            )
            const segCands = findNewIntersections(
              constructionRef.current,
              segResult.segment,
              [...candidatesRef.current, ...ptCands],
              extendSegments
            )
            candidatesRef.current = [...candidatesRef.current, ...ptCands, ...segCands]
            checkStep(ptResult.point)
          }
        }
      } else if (expected.type === 'macro') {
        handleCommitMacro(expected.propId, expected.inputPointIds)
      }
    }, 250)

    return () => clearInterval(interval)
  }, [
    autoCompleting,
    steps,
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
    onMacroPhaseChange: handleMacroPhaseChange,
    onPlaceFreePoint: handlePlaceFreePoint,
    disabledRef: correctionActiveRef,
    extendPhaseRef,
    extendPreviewRef,
    onCommitExtend: handleCommitExtend,
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
    onDragStart: useCallback(
      (pointId: string) => {
        wiggleCancelRef.current?.()
        wiggleCancelRef.current = null
        handleDragStart(pointId)
      },
      [handleDragStart]
    ),
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

      // ── Observe extend phase transitions for tutorial advancement ──
      const extendTag = extendPhaseRef.current.tag
      if (extendTag !== prevExtendTagRef.current) {
        const prev = prevExtendTagRef.current
        prevExtendTagRef.current = extendTag

        if (extendTag === 'idle' && prev !== 'idle') {
          // Extend gesture completed or cancelled — reset sub-step
          tutorialSubStepRef.current = 0
          setTutorialSubStep(0)
        } else {
          const subStepDef = subSteps[step]?.[subStep]
          const adv = subStepDef?.advanceOn
          if (adv?.kind === 'extend-phase' && adv.phase === extendTag) {
            const next = subStep + 1
            tutorialSubStepRef.current = next
            setTutorialSubStep(next)
          }
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

      // ── Tick macro reveal ceremony ──
      const ceremony = macroRevealRef.current
      if (ceremony) {
        const now = performance.now()
        if (ceremony.revealed < ceremony.sequence.length) {
          // Still revealing groups — check if the next one is due
          const entry = ceremony.sequence[ceremony.revealed]
          if (now - ceremony.lastRevealMs >= entry.msDelay) {
            ceremony.revealed++
            ceremony.lastRevealMs = now
            needsDrawRef.current = true
            // Start draw animations for each element in this newly revealed group
            const revealedEntry = ceremony.sequence[ceremony.revealed - 1]
            const layer = ghostLayersRef.current.find(
              (gl) => `${gl.atStep}:${gl.depth}` === revealedEntry.layerKey
            )
            if (layer?.revealGroups) {
              const group = layer.revealGroups[revealedEntry.groupIndex - 1]
              if (group) {
                for (const idx of group) {
                  const el = layer.elements[idx]
                  if (!el) continue
                  const durationMs = el.kind === 'circle' ? 700 : el.kind === 'segment' ? 400 : 0
                  ceremony.elementAnims.set(`${revealedEntry.layerKey}:${idx}`, {
                    startMs: now,
                    durationMs,
                  })
                }
              }
            }
            if (ceremony.revealed >= ceremony.sequence.length) {
              ceremony.allShownMs = now
            }
          } else {
            // Not yet due — keep animating so we check again next frame
            needsDrawRef.current = true
          }
        } else if (ceremony.allShownMs !== null) {
          // All groups shown — fire narration once, then advance step after delay
          if (!ceremony.narrationFired) {
            ceremony.narrationFired = true
            if (ceremony.narrationText) {
              sayMacroRevealRef.current({
                say: { en: ceremony.narrationText },
                tone: 'tutorial-instruction',
              })
            }
          }
          if (now - ceremony.allShownMs >= ceremony.postNarrationDelayMs) {
            ceremony.advanceStep()
            macroRevealRef.current = null
          } else {
            needsDrawRef.current = true
          }
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
          const reservedBottom = 0
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
              // During ceremony: expand bounds to include ghost geometry so the
              // viewport zooms out to frame the full dependency construction.
              // When ghostBoundsEnabled (G key): also include hovered ghost layers.
              const cer = macroRevealRef.current
              const inCeremony = cer != null
              const hoveredStep = hoveredMacroStepRef.current
              const includeGhostBounds =
                inCeremony || ghostBoundsEnabledRef.current
              if (includeGhostBounds) {
                const ceremonyLayerKeys = inCeremony
                  ? new Set(cer!.sequence.map((e) => e.layerKey))
                  : null
                for (const layer of ghostLayersRef.current) {
                  const key = `${layer.atStep}:${layer.depth}`
                  // During ceremony: only include ceremony layers
                  // With G toggle + hover: include only the hovered step's layers
                  // With G toggle (no hover): include all ghost layers
                  if (ceremonyLayerKeys && !ceremonyLayerKeys.has(key)) continue
                  if (!ceremonyLayerKeys && hoveredStep != null && layer.atStep !== hoveredStep)
                    continue
                  for (const el of layer.elements) {
                    if (el.kind === 'circle') {
                      expandBounds(bounds, el.cx, el.cy, el.r)
                    } else if (el.kind === 'segment') {
                      expandBounds(bounds, el.x1, el.y1, 0)
                      expandBounds(bounds, el.x2, el.y2, 0)
                    } else if (el.kind === 'point') {
                      expandBounds(bounds, el.x, el.y, 0)
                    }
                  }
                }
              }
              const width = Math.max(1, bounds.maxX - bounds.minX)
              const height = Math.max(1, bounds.maxY - bounds.minY)
              const availableW = Math.max(1, fitRect.width - pad * 2)
              const availableH = Math.max(1, fitRect.height - pad * 2)
              const minPpuNeeded = Math.min(availableW / width, availableH / height)
              const fitArea = availableW * availableH
              const boundsArea = width * height
              // Suppress zoom-in when ghost bounds are included (ceremony or G toggle)
              const shouldZoomIn = !includeGhostBounds && boundsArea <= fitArea * 0.25
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
                {
                  left: fitRect.left,
                  right: fitRect.right,
                  top: fitRect.top,
                  bottom: fitRect.bottom,
                },
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
                const ppuDeltaCap = inCeremony
                  ? AUTO_FIT_CEREMONY_PPU_DELTA
                  : AUTO_FIT_MAX_PPU_DELTA
                const deltaPpu = Math.max(
                  -ppuDeltaCap,
                  Math.min(ppuDeltaCap, nextPpu - v.pixelsPerUnit)
                )
                effectivePpu = v.pixelsPerUnit + deltaPpu
                v.pixelsPerUnit = effectivePpu
              }

              let targetCenterX = targetCx - (fitRect.centerX - cssWidth / 2) / effectivePpu
              let targetCenterY = targetCy + (fitRect.centerY - cssHeight / 2) / effectivePpu
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
          const curExpected = curStep < steps.length ? steps[curStep].expected : null
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
          const complete = !playgroundMode && curStep >= steps.length

          // Compute hidden elements during macro animation
          const hiddenIds = getHiddenElementIds(macroAnimationRef.current)
          // Also hide macro output elements while the ceremony is playing —
          // the solid result should appear only after the ghost reveal finishes
          const ceremonyHidden = macroRevealRef.current?.hiddenElementIds
          if (ceremonyHidden) {
            for (const id of ceremonyHidden) hiddenIds.add(id)
          }

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
            const angle = correction.fromAngle + (correction.toAngle - correction.fromAngle) * ease
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
            steps,
            currentStepRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight
          )

          // Render ghost geometry (dependency scaffolding from macros)
          if (ghostLayersRef.current.length > 0) {
            // Build ceremony reveal counts map for the current frame
            const cer = macroRevealRef.current
            let ceremonyRevealCounts: Map<string, number> | null = null
            if (cer) {
              ceremonyRevealCounts = new Map<string, number>()
              for (let i = 0; i < cer.revealed; i++) {
                const entry = cer.sequence[i]
                ceremonyRevealCounts.set(entry.layerKey, entry.groupIndex)
              }
            }
            const ghostAnimating = renderGhostGeometry(
              ctx,
              ghostLayersRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              hoveredMacroStepRef.current,
              ghostOpacitiesRef.current,
              ceremonyRevealCounts,
              cer?.elementAnims ?? null,
              cer ? performance.now() : undefined
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
            straightedgeDrawAnimRef.current,
            extendPhaseRef.current,
            extendPreviewRef.current
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

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
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
    for (const fact of factsByStep.get(steps.length) ?? []) {
      const cd = citationDefFromFact(fact.citation)
      if (cd) {
        const n = (counts.get(cd.key) ?? 0) + 1
        counts.set(cd.key, n)
        ordinals.set(`fact-${fact.id}`, n)
      }
    }
    return ordinals
  }, [steps, factsByStep])

  // Scroll the proof panel to keep current step visible.
  // Uses container-local scrollTop to avoid scrollIntoView triggering page-level scroll.
  const proofScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = proofScrollRef.current
    if (!container) return
    const active = container.querySelector('[data-step-current="true"]') as HTMLElement | null
    if (!active) return
    const pad = 8
    const top = active.offsetTop
    const bottom = top + active.offsetHeight
    if (top < container.scrollTop + pad) {
      container.scrollTop = top - pad
    } else if (bottom > container.scrollTop + container.clientHeight - pad) {
      container.scrollTop = bottom - container.clientHeight + pad
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
        userSelect: 'none',
        WebkitUserSelect: 'none',
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
                : activeTool === 'macro' || activeTool === 'extend'
                  ? undefined
                  : 'none',
          }}
        />

        {/* Tool auto-switch toast */}
        {toolToast && (
          <div
            data-element="tool-toast"
            style={{
              position: 'absolute',
              bottom: 84,
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

        {/* Macro reveal ceremony label */}
        {ceremonyLabel && (
          <div
            data-element="ceremony-label"
            style={{
              position: 'absolute',
              bottom: 84,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '5px 14px',
              borderRadius: 8,
              background: 'rgba(240, 199, 94, 0.15)',
              color: '#b08a1a',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
              letterSpacing: '0.03em',
            }}
          >
            {ceremonyLabel}
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
          {(playgroundMode || (isComplete && proposition.draggablePointIds)) && (
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
          {availableMacros.length > 0 && (
            <ToolButton
              label="Proposition"
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
                  {/* Two overlapping circles — evokes prior constructions */}
                  <circle cx="9" cy="12" r="5" />
                  <circle cx="15" cy="12" r="5" />
                </svg>
              }
              active={activeTool === 'macro'}
              onClick={handleMacroToolClick}
              size={isMobile ? 44 : 48}
            />
          )}
          {playgroundMode && (
            <ToolButton
              label="Point"
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
                  <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                </svg>
              }
              active={activeTool === 'point'}
              onClick={() => {
                setActiveTool('point')
                activeToolRef.current = 'point'
              }}
              size={isMobile ? 44 : 48}
            />
          )}
        </div>

        {/* Top-right bar — audio toggle (propositions) OR playground controls */}
        <div
          data-element="top-right-bar"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 12,
          }}
        >
          {playgroundMode ? (
            <>
              {/* New */}
              <button
                onClick={handleNewCanvas}
                title="New canvas"
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: '1px solid rgba(203,213,225,0.9)',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#374151',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                + New
              </button>

              {/* Share / Copy link */}
              {saveState === 'saved' && savedId ? (
                <button
                  onClick={handleCopyLink}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    border: 'none',
                    background: linkCopied ? '#10b981' : '#4E79A7',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'system-ui, sans-serif',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'background 0.2s',
                  }}
                >
                  {linkCopied ? '✓ Copied!' : '🔗 Copy link'}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 8,
                    border: 'none',
                    background: saveState === 'saving' ? 'rgba(78,121,167,0.6)' : '#4E79A7',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'system-ui, sans-serif',
                    cursor: saveState === 'saving' ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {saveState === 'saving' ? 'Saving…' : '↑ Share'}
                </button>
              )}

              {/* My creations */}
              <button
                onClick={() => setShowCreationsPanel(true)}
                title="My creations"
                style={{
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: 8,
                  border: '1px solid rgba(203,213,225,0.9)',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#374151',
                  fontSize: 16,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⊞
              </button>
            </>
          ) : (
            /* Audio toggle — proposition mode */
            <button
              data-action="toggle-audio"
              onClick={() =>
                disableAudio ? setLocalAudioEnabled((v) => !v) : setAudioEnabled(!audioEnabled)
              }
              title={audioEnabled ? 'Mute narration' : 'Enable narration'}
              style={{
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
          )}
        </div>

        {showCreationsPanel && (
          <PlaygroundCreationsPanel
            onClose={() => setShowCreationsPanel(false)}
            currentId={savedId}
            playerId={playerId}
          />
        )}

        {/* Proposition picker panel — shown when macro tool is active */}
        {activeTool === 'macro' && macroPhase.tag !== 'idle' && (
          <MacroToolPanel
            macros={availableMacros}
            macroPhase={macroPhase}
            guidedPropId={guidedPropId}
            onSelect={handleMacroPropositionSelect}
            isMobile={isMobile}
          />
        )}

        {isCorrectionActive && (
          <div
            data-element="orientation-correction"
            style={{
              position: 'absolute',
              bottom: 16,
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
            position: 'relative',
            height: isMobile ? `${MOBILE_PROOF_PANEL_HEIGHT_RATIO * 100}dvh` : '100%',
            boxShadow: isMobile ? '0 -10px 24px rgba(0,0,0,0.12)' : undefined,
          }}
        >
          {/* Proposition header (hidden on mobile to save space) */}
          {!isMobile && (
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
                    fontSize: proofFont.header,
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
            </div>
          )}

          {/* Scrollable steps + proof chain */}
          <div
            ref={proofScrollRef}
            data-element="proof-steps"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: isMobile ? '10px 14px' : '12px 20px',
            }}
          >
            {/* Given facts (atStep === -1, displayed before construction steps) */}
            {(() => {
              const givenFacts = factsByStep.get(-1) ?? []
              if (givenFacts.length === 0) return null
              return (
                <div data-element="given-facts" style={{ marginBottom: isMobile ? 8 : 16 }}>
                  {givenFacts.map((fact) => {
                    const highlighted = isFactHighlighted(fact)
                    return (
                      <div
                        key={fact.id}
                        onMouseEnter={() => setHoveredFactId(fact.id)}
                        onMouseLeave={() => setHoveredFactId(null)}
                        style={{
                          fontSize: proofFont.stepText,
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
                              fontSize: proofFont.citation,
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
            {steps.map((step, i) => {
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
                    marginBottom: isMobile ? 8 : 16,
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
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        borderRadius: '50%',
                        flexShrink: 0,
                        marginTop: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? 10 : 11,
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
                          fontSize: proofFont.stepTitle,
                          fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent ? '#1e293b' : '#475569',
                          fontFamily: 'Georgia, serif',
                          lineHeight: isMobile ? 1.25 : 1.4,
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
                          const foundationHref = getFoundationHref(step.citation)
                          return (
                            <div
                              data-element="citation-text"
                              style={{
                                marginTop: 4,
                                fontSize: proofFont.stepText,
                                lineHeight: isMobile ? 1.25 : 1.4,
                                color: isDone ? '#6b9b6b' : '#7893ab',
                                fontFamily: 'Georgia, serif',
                                fontStyle: 'italic',
                              }}
                            >
                              {foundationHref || step.citation.match(/^I\./) ? (
                                <a
                                  href={
                                    foundationHref ??
                                    `/toys/euclid/${step.citation.replace('I.', '')}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onPointerEnter={(e) =>
                                    handleCitationPointerEnter(step.citation!, e)
                                  }
                                  onPointerLeave={handleCitationPointerLeave}
                                  onPointerDown={(e) =>
                                    handleCitationPointerDown(step.citation!, e)
                                  }
                                  style={{
                                    fontWeight: 600,
                                    fontStyle: 'normal',
                                    fontSize: proofFont.citation,
                                    color: 'inherit',
                                    textDecoration: 'underline',
                                    textDecorationColor: 'rgba(16, 185, 129, 0.45)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {label}
                                </a>
                              ) : (
                                <span
                                  style={{
                                    fontWeight: 600,
                                    fontStyle: 'normal',
                                    fontSize: proofFont.citation,
                                  }}
                                >
                                  {label}
                                </span>
                              )}
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
                            fontSize: proofFont.stepText,
                            color: '#4E79A7',
                            fontFamily: 'system-ui, sans-serif',
                            lineHeight: isMobile ? 1.25 : 1.4,
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
                            const foundationHref = factCit ? getFoundationHref(factCit.key) : null
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
                                  fontSize: proofFont.stepText,
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
                                  {citLabel && factCit && (
                                    <>
                                      {foundationHref || factCit.key.match(/^I\./) ? (
                                        <a
                                          href={
                                            foundationHref ??
                                            `/toys/euclid/${factCit.key.replace('I.', '')}`
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onPointerEnter={(e) =>
                                            handleCitationPointerEnter(factCit.key, e)
                                          }
                                          onPointerLeave={handleCitationPointerLeave}
                                          onPointerDown={(e) =>
                                            handleCitationPointerDown(factCit.key, e)
                                          }
                                          style={{
                                            color: '#94a3b8',
                                            fontFamily: 'Georgia, serif',
                                            fontSize: proofFont.citation,
                                            fontWeight: 600,
                                            marginLeft: 6,
                                            textDecoration: 'underline',
                                            textDecorationColor: 'rgba(16, 185, 129, 0.45)',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          [{citLabel}]
                                        </a>
                                      ) : (
                                        <span
                                          style={{
                                            color: '#94a3b8',
                                            fontFamily: 'Georgia, serif',
                                            fontSize: proofFont.citation,
                                            fontWeight: 600,
                                            marginLeft: 6,
                                          }}
                                        >
                                          [{citLabel}]
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                {showText && factCit?.text && (
                                  <div
                                    style={{
                                      color: '#94a3b8',
                                      fontStyle: 'italic',
                                      fontFamily: 'Georgia, serif',
                                      fontSize: proofFont.citation,
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
                                    fontSize: proofFont.citation,
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
              const conclusionFacts = factsByStep.get(steps.length) ?? []
              if (conclusionFacts.length === 0 && !isComplete) return null
              return conclusionFacts.map((fact) => {
                const factCit = citationDefFromFact(fact.citation)
                const ord = citationOrdinals.get(`fact-${fact.id}`) ?? 1
                const citLabel = factCit ? (ord <= 2 ? factCit.label : factCit.key) : null
                const showText = ord === 1 && factCit
                const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
                const foundationHref = factCit ? getFoundationHref(factCit.key) : null
                const highlighted = isFactHighlighted(fact)
                return (
                  <div
                    key={fact.id}
                    onMouseEnter={() => setHoveredFactId(fact.id)}
                    onMouseLeave={() => setHoveredFactId(null)}
                    style={{
                      fontSize: proofFont.stepText,
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
                        {citLabel && factCit && (
                          <>
                            {foundationHref || factCit.key.match(/^I\./) ? (
                              <a
                                href={
                                  foundationHref ?? `/toys/euclid/${factCit.key.replace('I.', '')}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                onPointerEnter={(e) => handleCitationPointerEnter(factCit.key, e)}
                                onPointerLeave={handleCitationPointerLeave}
                                onPointerDown={(e) => handleCitationPointerDown(factCit.key, e)}
                                style={{
                                  color: '#94a3b8',
                                  fontFamily: 'Georgia, serif',
                                  fontSize: proofFont.citation,
                                  fontWeight: 600,
                                  marginLeft: 6,
                                  textDecoration: 'underline',
                                  textDecorationColor: 'rgba(16, 185, 129, 0.45)',
                                  cursor: 'pointer',
                                }}
                              >
                                [{citLabel}]
                              </a>
                            ) : (
                              <span
                                style={{
                                  color: '#94a3b8',
                                  fontFamily: 'Georgia, serif',
                                  fontSize: proofFont.citation,
                                  fontWeight: 600,
                                  marginLeft: 6,
                                }}
                              >
                                [{citLabel}]
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {showText && factCit?.text && (
                        <div
                          style={{
                            color: '#94a3b8',
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, serif',
                            fontSize: proofFont.citation,
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
                          fontSize: proofFont.citation,
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

          {/* Conclusion + completion (merged on mobile) */}
          {isComplete && completionResult && (
            <div
              data-element="proof-conclusion"
              style={{
                padding: isMobile ? '6px 10px' : '12px 20px',
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 5,
                      flexWrap: 'wrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        color: '#10b981',
                        fontWeight: 700,
                        fontSize: proofFont.conclusion,
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
                      const conclusionAngleFacts = (factsByStep.get(steps.length) ?? []).filter(
                        isAngleFact
                      )
                      if (conclusionAngleFacts.length > 0) {
                        return (
                          <div
                            style={{
                              color: '#10b981',
                              fontSize: proofFont.stepText,
                              fontFamily: 'Georgia, serif',
                              fontStyle: 'italic',
                              marginTop: 0,
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
                              fontSize: proofFont.stepText,
                              fontFamily: 'Georgia, serif',
                              fontStyle: 'italic',
                              marginTop: 0,
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
                        fontSize: proofFont.stepText,
                        fontWeight: 600,
                        fontFamily: 'Georgia, serif',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}
                    </span>
                  </div>
                  {isMobile && completionMeta?.nextPropId && (
                    <button
                      type="button"
                      data-action="navigate-next"
                      onClick={() => completionMeta.onNavigateNext(completionMeta.nextPropId!)}
                      style={{
                        padding: '4px 8px',
                        fontSize: proofFont.stepText,
                        fontWeight: 600,
                        fontFamily: 'Georgia, serif',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        marginLeft: 'auto',
                      }}
                    >
                      {completionMeta.unlocked.includes(completionMeta.nextPropId)
                        ? `Unlocked: I.${completionMeta.nextPropId} →`
                        : `Next: I.${completionMeta.nextPropId} →`}
                    </button>
                  )}
                  {!isMobile && proposition.draggablePointIds && (
                    <div
                      data-element="drag-invitation"
                      style={{
                        marginTop: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(78, 121, 167, 0.08)',
                        border: '1px solid rgba(78, 121, 167, 0.15)',
                        color: '#4E79A7',
                        fontSize: proofFont.stepText,
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
                    fontSize: proofFont.stepText,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  Proof incomplete — could not establish equality for {completionResult.statement}
                </span>
              )}
              {isMobile &&
                completionMeta &&
                (completionResult.status !== 'proven' ||
                  (completionMeta.unlocked.length > 0 &&
                    !(
                      completionMeta.nextPropId &&
                      completionMeta.unlocked.length === 1 &&
                      completionMeta.unlocked[0] === completionMeta.nextPropId
                    ))) && (
                  <div
                    data-element="proof-completion-dock"
                    style={{
                      marginTop: 4,
                      paddingTop: 4,
                      borderTop: '1px dashed rgba(148, 163, 184, 0.5)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      {completionResult.status !== 'proven' && (
                        <div
                          style={{
                            color: '#b91c1c',
                            fontFamily: 'Georgia, serif',
                            fontSize: proofFont.stepText,
                            fontWeight: 600,
                          }}
                        >
                          Incomplete
                        </div>
                      )}
                    </div>
                    {completionMeta.unlocked.length > 0 &&
                      !(
                        completionMeta.nextPropId &&
                        completionMeta.unlocked.length === 1 &&
                        completionMeta.unlocked[0] === completionMeta.nextPropId
                      ) && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: proofFont.stepText,
                            color: '#475569',
                            fontFamily: 'Georgia, serif',
                            lineHeight: isMobile ? 1.2 : 1.4,
                          }}
                        >
                          <span style={{ color: '#10b981', fontWeight: 600 }}>Unlocked: </span>
                          {completionMeta.unlocked.map((id, i) => (
                            <span key={id}>
                              {i > 0 && ', '}
                              <strong>I.{id}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                )}
            </div>
          )}

          {!isMobile && isComplete && completionResult && completionMeta && (
            <div
              data-element="proof-completion-dock"
              style={{
                padding: '10px 20px 12px',
                borderTop: '1px dashed rgba(148, 163, 184, 0.5)',
                background: 'rgba(248, 250, 252, 0.9)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    color: completionResult.status === 'proven' ? '#0f766e' : '#b91c1c',
                    fontFamily: 'Georgia, serif',
                    fontSize: proofFont.stepText,
                    fontWeight: 600,
                  }}
                >
                  ✓ I.{proposition.id}{' '}
                  {completionResult.status === 'proven'
                    ? `Complete • ${proposition.kind === 'theorem' ? 'Q.E.D.' : 'Q.E.F.'}`
                    : 'Incomplete'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {completionMeta.nextPropId && (
                    <button
                      type="button"
                      data-action="navigate-next"
                      onClick={() => completionMeta.onNavigateNext(completionMeta.nextPropId!)}
                      style={{
                        padding: '5px 12px',
                        fontSize: proofFont.stepText,
                        fontWeight: 600,
                        fontFamily: 'Georgia, serif',
                        background: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      {completionMeta.unlocked.includes(completionMeta.nextPropId)
                        ? `Unlocked: I.${completionMeta.nextPropId} →`
                        : `Next: I.${completionMeta.nextPropId} →`}
                    </button>
                  )}
                </div>
              </div>
              {completionMeta.unlocked.length > 0 &&
                !(
                  completionMeta.nextPropId &&
                  completionMeta.unlocked.length === 1 &&
                  completionMeta.unlocked[0] === completionMeta.nextPropId
                ) && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: proofFont.stepText,
                      color: '#475569',
                      fontFamily: 'Georgia, serif',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Unlocked: </span>
                    {completionMeta.unlocked.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ', '}
                        <strong>I.{id}</strong>
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Citation popover — rendered at root so position:fixed works cleanly */}
      {activeCitation && (
        <CitationPopover
          citationKey={activeCitation.key}
          anchorRect={activeCitation.rect}
          onClose={() => setActiveCitation(null)}
          onMouseEnter={() => {
            popoverHoveredRef.current = true
            if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
          }}
          onMouseLeave={() => {
            popoverHoveredRef.current = false
            setActiveCitation(null)
          }}
        />
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
        {!isComplete && steps.length > 0 && (
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
