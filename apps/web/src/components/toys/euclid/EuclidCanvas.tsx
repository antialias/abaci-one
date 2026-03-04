'use client'

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
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
import { findNewIntersections, isCandidateBeyondPoint } from './engine/intersections'
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
import { useToolPhaseManager } from './interaction/useToolPhaseManager'
import { useDragGivenPoints } from './interaction/useDragGivenPoints'
import type { PostCompletionAction, ReplayResult } from './engine/replayConstruction'
import { replayConstruction } from './engine/replayConstruction'
import { validateStep } from './propositions/validation'
import { PROP_REGISTRY } from './propositions/registry'
import { PLAYGROUND_PROP } from './propositions/playground'
import { PlaygroundCreationsPanel } from './PlaygroundCreationsPanel'
import { ProofLedger } from './ledger/ProofLedger'
import type { LedgerEntryDescriptor } from './ledger/describeAction'
import { describeToolPhase } from './ledger/describeAction'
import { useAudioManager } from '@/hooks/useAudioManager'
import { useTTS } from '@/hooks/useTTS'
import { useEuclidAudioHelp } from './hooks/useEuclidAudioHelp'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useCharacterProfileImage } from '@/lib/character/useCharacterProfileImage'
import {
  createFactStore,
  addFact,
  addAngleFact,
  queryEquality,
  rebuildFactStore,
} from './engine/factStore'
import type { FactStore } from './engine/factStore'
import type { ProofFact } from './engine/facts'
import { distancePair, angleMeasure } from './engine/facts'
import { deriveDef15Facts } from './engine/factDerivation'
import { MACRO_REGISTRY } from './engine/macros'
import { resolveSelector } from './engine/selectors'
import type { MacroAnimation } from './engine/macroExecution'
import {
  createMacroAnimation,
  tickMacroAnimation,
  getHiddenElementIds,
} from './engine/macroExecution'
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
import { MacroToolPanel } from './MacroToolPanel'
import { renderMacroPreview } from './render/renderMacroPreview'
import { MACRO_PREVIEW_REGISTRY } from './engine/macroPreview'
import { useGeometryVoice } from './voice/useGeometryVoice'
import { GeometryTeacherProvider, useGeometryTeacher } from './GeometryTeacherContext'
import { getTeacherConfig } from './characters/registry'
import { useConstructionNotifier } from './voice/useConstructionNotifier'
import { ConstructionEventBus } from './voice/ConstructionEventBus'
import { useHecklerTrigger, type HecklerStage } from './voice/useHecklerTrigger'
import { DEFAULT_STALL_LINES } from '@/lib/voice/stallLines'
import type { AttitudeId } from './voice/attitudes/types'
import { EuclidContextDebugPanel } from './EuclidContextDebugPanel'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { ChatCallState } from '@/lib/character/types'
import { useEuclidChat } from './chat/useEuclidChat'
import { DockedEuclidChat } from './chat/DockedEuclidChat'
import { EuclidChatPanel } from './chat/EuclidChatPanel'
import { GuidedProofPanel } from './proof/GuidedProofPanel'
import type { CompletionResult, CompletionSegment } from './proof/types'
import { latexToMarkers } from './chat/parseGeometricEntities'
import type {
  GeometricEntityRef,
  EuclidEntityRef,
  FoundationEntityRef,
} from './chat/parseGeometricEntities'
import { isGeometricEntity, foundationToCitationKey } from './chat/parseGeometricEntities'
import { useEuclidEntityRenderer } from './chat/useEuclidEntityRenderer'
import { generateId } from '@/lib/character/useCharacterChat'
import { MiniWaveform, AnimatedDots, formatTime } from '@/lib/voice/PhoneCallOverlay'
import { renderChatHighlight } from './render/renderChatHighlight'
import { playgroundToProofJSON } from './editor/playgroundToProofJSON'
import { exportPropositionDef, generateClaudePrompt } from './editor/exportPropositionDef'

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
const AUTO_FIT_SWEEP_PPU_DELTA = 3
const AUTO_FIT_CEREMONY_PPU_DELTA = 4
/** Fraction of pad used as tip margin in the hard visibility constraint */
const AUTO_FIT_TIP_PAD_FRACTION = 0.5

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
  /** Resolved proposition definition. If provided, takes precedence over propositionId lookup. */
  proposition?: import('./types').PropositionDef
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
  /** Whether the current user is an admin (enables export buttons in playground mode) */
  isAdmin?: boolean
}

// ── Heckler incoming call overlay ──

function HecklerIncomingOverlay({
  stage,
  profileImage,
  characterName,
  matchDescription: _matchDescription,
  onAnswer,
  onDismiss,
}: {
  stage: HecklerStage
  profileImage: string
  characterName: string
  matchDescription: string | null
  onAnswer: () => void
  onDismiss: () => void
}) {
  const isRinging = stage === 'ringing'
  // Ring tone is now played by useVoiceCall's playRingTone() during pre-dial

  return (
    <div
      data-element="heckler-incoming"
      style={{
        position: 'absolute',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: isRinging ? '12px 20px' : '8px 16px',
        borderRadius: 16,
        background: isRinging ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.6)',
        color: '#f8fafc',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: isRinging
          ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(78, 121, 167, 0.4)'
          : '0 4px 16px rgba(0,0,0,0.2)',
        zIndex: 20,
        transition: 'all 0.3s ease',
        opacity: stage === 'watching' ? 0.7 : 1,
        animation: isRinging ? 'heckler-ring 1s ease-in-out infinite' : undefined,
        pointerEvents: isRinging ? 'auto' : 'none',
      }}
    >
      <img
        src={profileImage}
        alt={characterName}
        style={{
          width: isRinging ? 40 : 32,
          height: isRinging ? 40 : 32,
          borderRadius: '50%',
          objectFit: 'cover',
          transition: 'all 0.3s ease',
        }}
      />
      {isRinging ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{characterName} is calling...</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Incoming observation</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            <button
              data-action="answer-heckler"
              onClick={onAnswer}
              style={{
                border: 'none',
                borderRadius: 20,
                padding: '6px 16px',
                background: '#22c55e',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Answer
            </button>
            <button
              data-action="dismiss-heckler"
              onClick={onDismiss}
              style={{
                border: 'none',
                borderRadius: 20,
                padding: '6px 16px',
                background: '#ef4444',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <span style={{ fontSize: 12, opacity: 0.8 }}>{characterName} is watching...</span>
      )}
      {/* Keyframe animation for the ring effect */}
      {isRinging && (
        <style>{`
          @keyframes heckler-ring {
            0%, 100% { transform: translateX(-50%) scale(1); }
            10% { transform: translateX(-50%) scale(1.02) rotate(-1deg); }
            20% { transform: translateX(-50%) scale(1.02) rotate(1deg); }
            30% { transform: translateX(-50%) scale(1.02) rotate(-1deg); }
            40% { transform: translateX(-50%) scale(1); }
          }
        `}</style>
      )}
    </div>
  )
}

// ── Heckler active call presence ──

function HecklerCallPresence({
  profileImage,
  characterName,
  isSpeaking,
  isThinking,
  timeRemaining,
  onHangUp,
}: {
  profileImage: string
  characterName: string
  isSpeaking: boolean
  isThinking: boolean
  timeRemaining: number | null
  onHangUp: () => void
}) {
  const glowColor = isSpeaking
    ? 'rgba(168, 85, 247, 0.7)'
    : isThinking
      ? 'rgba(168, 85, 247, 0.35)'
      : 'transparent'
  const glowShadow = isSpeaking
    ? `0 0 0 3px ${glowColor}, 0 0 20px ${glowColor}`
    : isThinking
      ? `0 0 0 2px ${glowColor}, 0 0 12px ${glowColor}`
      : '0 4px 16px rgba(0,0,0,0.3)'

  return (
    <div
      data-element="heckler-call-presence"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        zIndex: 18,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '16px 20px',
        borderRadius: 16,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        animation: 'hecklerPresenceFadeIn 0.3s ease-out',
        minWidth: 140,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Avatar */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: glowShadow,
          transition: 'box-shadow 0.3s ease',
          animation: isSpeaking
            ? 'hecklerSpeakingPulse 1.5s ease-in-out infinite'
            : isThinking
              ? 'hecklerSpeakingPulse 2.5s ease-in-out infinite'
              : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profileImage}
          alt={characterName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* Name + waveform + timer row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        {isThinking ? (
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            Consulting scrolls<AnimatedDots />
          </span>
        ) : (
          <>
            <span>{characterName}</span>
            <MiniWaveform isDark active={isSpeaking} />
            {timeRemaining != null && (
              <span style={{ opacity: 0.6, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeRemaining)}
              </span>
            )}
          </>
        )}
      </div>

      {/* End Call button */}
      <button
        data-action="end-heckler-call"
        onClick={onHangUp}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: 20,
          padding: '8px 0',
          background: 'rgba(239, 68, 68, 0.85)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 1)'
        }}
        onMouseLeave={(e) => {
          ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.85)'
        }}
      >
        End Call
      </button>

      <style>{`
        @keyframes hecklerPresenceFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hecklerSpeakingPulse {
          0%, 100% { box-shadow: ${glowShadow}; }
          50% { box-shadow: 0 0 0 ${isSpeaking ? 4 : 3}px ${glowColor}, 0 0 ${isSpeaking ? 28 : 16}px ${glowColor}; }
        }
      `}</style>
    </div>
  )
}

const WRONG_MOVE_PHRASES = [
  "Not quite. Let's try that step again.",
  "Hmm, that's not right. Try again.",
  "That's not it. Here's the step one more time:",
  'Oops! Let me remind you:',
]

/**
 * Public EuclidCanvas — wraps the inner canvas with the geometry teacher provider.
 * Manages dynamic attitude switching (teacher → heckler) for the heckler trigger.
 */
export function EuclidCanvas(props: EuclidCanvasProps) {
  const [attitudeId, setAttitudeId] = useState<AttitudeId>('teacher')
  const voiceConfig = useMemo(
    () => getTeacherConfig(props.proposition?.characterId, attitudeId),
    [props.proposition?.characterId, attitudeId]
  )
  return (
    <GeometryTeacherProvider config={voiceConfig}>
      <EuclidCanvasInner {...props} onAttitudeChange={setAttitudeId} />
    </GeometryTeacherProvider>
  )
}

function EuclidCanvasInner({
  propositionId = 1,
  proposition: propositionProp,
  onComplete,
  playgroundMode,
  languageStyle,
  completionMeta,
  initialActions,
  initialGivenPoints,
  playerId,
  disableAudio,
  isAdmin: isAdminProp,
  onAttitudeChange,
}: EuclidCanvasProps & { onAttitudeChange?: (attitudeId: AttitudeId) => void }) {
  const isMobile = useIsMobile()
  const isAdmin = isAdminProp === true
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const propositionBase =
    propositionProp ??
    (propositionId === 0 ? PLAYGROUND_PROP : PROP_REGISTRY[propositionId]) ??
    PROP_REGISTRY[1]
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
  const hasConstructionSteps = useMemo(
    () => steps.some((s) => s.expected.type !== 'observation'),
    [steps]
  )
  const extendSegments = useMemo(() => needsExtendedSegments(proposition), [proposition])
  const getTutorial = proposition.getTutorial ?? (() => [] as TutorialSubStep[][])
  // All prior propositions that have applicable macros
  const availableMacros = useMemo(() => {
    return Object.entries(MACRO_REGISTRY)
      .filter(([key]) => playgroundMode || Number(key) < propositionId)
      .map(([, def]) => ({
        propId: def.propId,
        def,
        title: PROP_REGISTRY[def.propId]?.title ?? '',
      }))
  }, [propositionId, playgroundMode])
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
  const toolPhases = useToolPhaseManager(
    steps[0]?.expected.type === 'observation' ? 'move' : (steps[0]?.tool ?? 'compass')
  )
  const {
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    snappedPointIdRef,
    activeToolRef,
    pointerCapturedRef,
    needsDrawRef,
  } = toolPhases
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const candidatesRef = useRef<IntersectionCandidate[]>([])
  const expectedActionRef = useRef<ExpectedAction | null>(steps[0]?.expected ?? null)
  const rafRef = useRef<number>(0)
  const extendPreviewRef = useRef<{ x: number; y: number } | null>(null)
  const [macroPhase, setMacroPhase] = useState<MacroPhase>({ tag: 'idle' })
  const macroAnimationRef = useRef<MacroAnimation | null>(null)
  const wiggleCancelRef = useRef<(() => void) | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(true)
  const straightedgeDrawAnimRef = useRef<StraightedgeDrawAnim | null>(null)
  const superpositionFlashRef = useRef<SuperpositionFlash | null>(null)
  const dragPointIdRef = useRef<string | null>(null)
  const dragLabelRef = useRef<string | null>(null)
  const isCompleteRef = useRef(false)
  const completionTimeRef = useRef<number>(0)
  const postCompletionActionsRef = useRef<PostCompletionAction[]>(initialActions ?? [])
  const eventBusRef = useRef(new ConstructionEventBus())
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const hoveredMacroStepRef = useRef<number | null>(null)
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const ghostBoundsEnabledRef = useRef(false)
  const macroPreviewAutoFitRef = useRef(true)
  const macroRevealRef = useRef<MacroCeremonyState | null>(null)
  const ceremonyDebugRef = useRef<{
    speedMultiplier: number
    paused: boolean
  }>({ speedMultiplier: 1, paused: false })
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
  // Forward ref for notifier — populated after useConstructionNotifier returns.
  // Used by updateToolPreview (defined earlier than the notifier hook).
  const notifierForwardRef = useRef<{ notifyToolState: () => void }>({
    notifyToolState: () => {},
  })

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>(
    playgroundMode
      ? 'move'
      : steps[0]?.expected.type === 'observation'
        ? 'move'
        : (steps[0]?.tool ?? 'compass')
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
  const [toolPreview, setToolPreview] = useState<LedgerEntryDescriptor | null>(null)
  const [isToolDockActive, setIsToolDockActive] = useState(false)
  const [isCorrectionActive, setIsCorrectionActive] = useState(false)
  const [frictionCoeff, setFrictionCoeff] = useState(getFriction)
  const [ghostBaseOpacityVal, setGhostBaseOpacityVal] = useState(getGhostBaseOpacity)
  const [ghostFalloffCoeff, setGhostFalloffCoeff] = useState(getGhostFalloff)
  const [ceremonySpeed, setCeremonySpeed] = useState(1)
  const [ceremonyPaused, setCeremonyPaused] = useState(false)
  const [ceremonyFocusMode, setCeremonyFocusMode] = useState(false)
  const [showContextDebug, setShowContextDebug] = useState(() => {
    if (typeof window === 'undefined') return true
    const stored = localStorage.getItem('euclid-show-context-debug')
    return stored === null ? true : stored === '1'
  })
  // Tick counter to force re-render when ceremony state changes from step buttons
  const [ceremonyTick, setCeremonyTick] = useState(0)
  // Sync ceremony debug state → ref for RAF loop
  ceremonyDebugRef.current.speedMultiplier = ceremonySpeed
  ceremonyDebugRef.current.paused = ceremonyPaused
  const [activeCitation, setActiveCitation] = useState<{ key: string; rect: DOMRect } | null>(null)
  const citationShowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const citationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const popoverHoveredRef = useRef(false)
  const [autoCompleting, setAutoCompleting] = useState(false)
  const lastSweepRef = useRef<number>(0)
  const lastSweepTimeRef = useRef<number>(0)
  const lastSweepCenterRef = useRef<string | null>(null)

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

  // ── Macro tool handlers ──

  /** propId required by the current guided step, or null if not a macro step */
  const guidedPropId = useMemo(() => {
    if (currentStep >= steps.length) return null
    const expected = steps[currentStep].expected
    return expected.type === 'macro' ? expected.propId : null
  }, [currentStep, steps])

  /** Recompute the ledger tool preview from current ref state (playground mode only).
   *  Also notifies voice of tool state changes (consolidates two callbacks). */
  const updateToolPreview = useCallback(() => {
    notifierForwardRef.current.notifyToolState()
    if (!playgroundMode) return
    setToolPreview(
      describeToolPhase(
        {
          compass: compassPhaseRef.current,
          straightedge: straightedgePhaseRef.current,
          extend: extendPhaseRef.current,
          macro: macroPhaseRef.current,
          snappedPointId: snappedPointIdRef.current,
        },
        constructionRef.current
      )
    )
  }, [playgroundMode])

  // Wire callback slots on the tool phase manager
  toolPhases.onMacroPhaseSync = setMacroPhase
  toolPhases.onActiveToolSync = setActiveTool
  toolPhases.onPhaseChange = updateToolPreview

  const handleMacroToolClick = useCallback(() => {
    toolPhases.selectTool('macro')
    // If there's only one macro available, skip the picker and go straight to selecting
    if (availableMacros.length === 1) {
      const { propId, def } = availableMacros[0]
      toolPhases.enterMacroSelecting(propId, def.inputs)
    } else {
      toolPhases.enterMacroChoosing()
    }
  }, [availableMacros, toolPhases])

  const handleMacroPropositionSelect = useCallback(
    (propId: number) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return
      toolPhases.enterMacroSelecting(propId, macroDef.inputs)
    },
    [toolPhases]
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
  const {
    isEnabled: globalAudioEnabled,
    setEnabled: setAudioEnabled,
    stop: stopAudio,
  } = useAudioManager()
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
  // Heckler stall speaker — plays a TTS line while WebRTC finishes connecting
  const speakHecklerStall = useTTS({ say: { en: '' }, tone: 'tutorial-instruction' })
  const speakHecklerStallRef = useRef(speakHecklerStall)
  speakHecklerStallRef.current = speakHecklerStall
  // ── Pending action ref — shared between notifier, voice, and chat ──
  const pendingActionRef = useRef<string | null>(null)

  // ── Text chat (must come before voice so transcript callbacks can reference addMessage) ──
  const euclidChat = useEuclidChat({
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    isComplete,
    playgroundMode: !!playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
    pendingActionRef,
    isMobile,
  })

  // Keep a ref to chat messages for voice session context injection
  const chatMessagesRef = useRef(euclidChat.messages)
  chatMessagesRef.current = euclidChat.messages

  // ── Transcript callbacks: inject voice transcripts into the shared chat history ──
  const handleModelSpeech = useCallback(
    (transcript: string) => {
      // Convert LaTeX notation from voice transcripts to our {seg:AB} marker syntax
      const converted = latexToMarkers(transcript)
      const msgId = generateId()
      // Insert before trailing events — speech started before events that arrived during it
      euclidChat.addMessageBeforeTrailingEvents({
        id: msgId,
        role: 'assistant',
        content: converted,
        timestamp: Date.now(),
        via: 'voice',
      })
      // Async: send to LLM for full entity markup (foundation refs, missed geometric refs)
      euclidChat.markupMessage(msgId, converted)
    },
    [euclidChat.addMessageBeforeTrailingEvents, euclidChat.markupMessage]
  )

  const handleChildSpeech = useCallback(
    (transcript: string) => {
      const msgId = generateId()
      euclidChat.addMessage({
        id: msgId,
        role: 'user',
        content: transcript,
        timestamp: Date.now(),
        via: 'voice',
      })
      // Async: markup user voice transcript with strict validation (preserves original text exactly)
      euclidChat.markupMessage(msgId, transcript, true)
    },
    [euclidChat.addMessage, euclidChat.markupMessage]
  )

  // ── Call Euclid voice (after chat so transcript callbacks are available) ──
  const euclidVoice = useGeometryVoice({
    canvasRef,
    constructionRef,
    factStoreRef,
    proofFactsRef,
    currentStepRef,
    propositionId,
    propositionTitle: proposition.title,
    propositionKind: proposition.kind ?? 'construction',
    totalSteps: steps.length,
    isComplete,
    playgroundMode: !!playgroundMode,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    steps,
    chatMessagesRef,
    compactForVoice: euclidChat.compaction.compactForVoice,
    onModelSpeech: handleModelSpeech,
    onChildSpeech: handleChildSpeech,
  })

  // ── Speaking-aware profile image (needs euclidVoice.isSpeaking) ──
  const teacherConfig = useGeometryTeacher()
  const smProfileImage = useCharacterProfileImage(
    teacherConfig.definition.profileImage,
    'sm',
    euclidVoice.isSpeaking
  )
  const lgProfileImage = useCharacterProfileImage(
    teacherConfig.definition.profileImage,
    'lg',
    euclidVoice.isSpeaking
  )

  // ── Push-based construction notifier ──
  const notifierRef = useConstructionNotifier({
    canvasRef,
    constructionRef,
    proofFactsRef,
    currentStepRef,
    steps,
    isComplete,
    activeToolRef,
    compassPhaseRef,
    straightedgePhaseRef,
    extendPhaseRef,
    macroPhaseRef,
    dragPointIdRef,
    voiceCallRef: euclidVoice.voiceCallRef,
    addMessage: euclidChat.addMessage,
    setTrailingEvent: euclidChat.setTrailingEvent,
    eventBus: eventBusRef.current,
  })

  // Wire the forward ref so updateToolPreview (defined before this hook) can call notifyToolState
  notifierForwardRef.current = notifierRef.current

  // ── Heckler trigger — watches construction in playground for proposition patterns ──
  //
  // When the user clicks Answer, the WebRTC session may not be ready yet. Stall
  // TTS lines fill the gap with in-character speech ("One moment — I need to
  // collect my thoughts...") while the session finishes connecting in the background.
  //
  // IMPORTANT: We must wait for the stall TTS to finish before activating the
  // realtime session (unmuting mic + sending response.create). If we activate
  // while the stall is still playing through the speakers, the mic picks up
  // the stall audio → VAD fires → cancels Euclid's first response → stuttering
  // loop. The stall text is injected into the voice model's conversation context
  // so Euclid continues naturally from where the stall left off.
  //
  // Activation requires TWO conditions:
  //   1. Voice session is 'preconnected' (WebRTC ready)
  //   2. Stall TTS has finished (or was never started)
  // The tryActivate helper checks both and fires activateSession when both are met.
  const pendingActivateRef = useRef(false)
  const stallTextRef = useRef<string | null>(null)
  const stallDoneRef = useRef(true) // true = no stall playing (safe to activate)
  // Track that the current dial is a heckler pre-dial (to suppress call UI)
  const hecklerPreDialRef = useRef(false)

  const heckler = useHecklerTrigger(constructionRef, !!playgroundMode)

  /** Try to activate — only fires when BOTH session is ready AND stall TTS is done. */
  const tryActivateRef = useRef(() => {})
  tryActivateRef.current = () => {
    if (!pendingActivateRef.current) return
    if (euclidVoice.state !== 'preconnected') {
      console.log('[heckler-activate] not yet — voiceState=%s, stallDone=%s',
        euclidVoice.state, stallDoneRef.current)
      return
    }
    if (!stallDoneRef.current) {
      console.log('[heckler-activate] not yet — session ready but stall TTS still playing')
      return
    }
    console.log('[heckler-activate] both ready — activating now')
    pendingActivateRef.current = false
    hecklerPreDialRef.current = false
    euclidVoice.activateSession(stallTextRef.current ?? undefined)
    stallTextRef.current = null
  }

  // Pre-dial when heckler enters 'ringing': switch attitude and start WebRTC
  useEffect(() => {
    console.log('[heckler-predial] effect: stage=%s, voiceState=%s, preDialRef=%s',
      heckler.stage, euclidVoice.state, hecklerPreDialRef.current)
    if (heckler.stage !== 'ringing') return
    // Already initiated pre-dial — don't schedule another
    if (hecklerPreDialRef.current) {
      console.log('[heckler-predial] skipped — already initiated')
      return
    }
    // Already dialing or connected — skip
    if (euclidVoice.state !== 'idle' && euclidVoice.state !== 'error') {
      console.log('[heckler-predial] skipped — voice not idle (state=%s)', euclidVoice.state)
      return
    }
    console.log('[heckler-predial] initiating pre-dial')
    onAttitudeChange?.('heckler')
    hecklerPreDialRef.current = true
    pendingActivateRef.current = false
    stallTextRef.current = null
    stallDoneRef.current = true
    // Dial after a microtask to let the config update (deferGreeting) propagate
    setTimeout(() => {
      console.log('[heckler-predial] setTimeout fired, calling dial()')
      euclidVoice.dial()
    }, 50)
  }, [heckler.stage, euclidVoice.state, euclidVoice.dial, onAttitudeChange])

  // When the user clicks "Answer": activate immediately or play stalling TTS
  const handleHecklerAnswer = useCallback(() => {
    console.log('[heckler-answer] clicked: voiceState=%s, preDialRef=%s, stallDone=%s',
      euclidVoice.state, hecklerPreDialRef.current, stallDoneRef.current)
    // Kill ring tone immediately so it doesn't overlap with speech
    euclidVoice.stopRing()
    heckler.answer() // transition stage to 'answered', prevent re-triggering
    pendingActivateRef.current = true
    if (euclidVoice.state === 'preconnected') {
      // Connection already ready — activate immediately (no stall needed)
      console.log('[heckler-answer] preconnected — activating immediately')
      stallDoneRef.current = true
      hecklerPreDialRef.current = false
      pendingActivateRef.current = false
      euclidVoice.activateSession(stallTextRef.current ?? undefined)
      stallTextRef.current = null
    } else {
      // Connection not ready yet — play stalling TTS while we wait
      console.log('[heckler-answer] not preconnected — stalling (voiceState=%s)', euclidVoice.state)
      const lines = teacherConfig.stallLines ?? DEFAULT_STALL_LINES
      const line = lines[Math.floor(Math.random() * lines.length)]
      stallTextRef.current = line
      stallDoneRef.current = false
      speakHecklerStallRef.current({ say: { en: line } }).then(() => {
        console.log('[heckler-stall] TTS finished')
        stallDoneRef.current = true
        tryActivateRef.current()
      })
      // If dial hasn't started yet (user clicked Answer before pre-dial effect fired),
      // ensure we kick it off now
      if (euclidVoice.state === 'idle' || euclidVoice.state === 'error') {
        console.log('[heckler-answer] voice still idle — kicking off dial')
        hecklerPreDialRef.current = true
        onAttitudeChange?.('heckler')
        setTimeout(() => euclidVoice.dial(), 50)
      }
    }
  }, [heckler, euclidVoice, teacherConfig.stallLines, onAttitudeChange])

  // When session reaches preconnected, try to activate (also needs stall to be done)
  useEffect(() => {
    if (euclidVoice.state === 'preconnected' && pendingActivateRef.current) {
      tryActivateRef.current()
    }
  }, [euclidVoice.state])

  // Clean up pre-dial if heckler match is lost (e.g. undo reverts the construction)
  useEffect(() => {
    if (heckler.stage === 'idle' && hecklerPreDialRef.current) {
      console.log('[heckler-cleanup] match lost — hanging up pre-dial, voiceState=%s', euclidVoice.state)
      hecklerPreDialRef.current = false
      pendingActivateRef.current = false
      stallTextRef.current = null
      stallDoneRef.current = true
      stopAudio() // kill stall TTS if playing
      if (euclidVoice.state !== 'idle') euclidVoice.hangUp()
      onAttitudeChange?.('teacher')
    }
  }, [heckler.stage, euclidVoice, onAttitudeChange, stopAudio])

  // Dismiss: clean up pre-connection and revert to teacher
  const handleHecklerDismiss = useCallback(() => {
    console.log('[heckler-dismiss] voiceState=%s', euclidVoice.state)
    heckler.dismiss()
    stopAudio() // kill stall TTS if playing
    if (euclidVoice.state !== 'idle') euclidVoice.hangUp()
    hecklerPreDialRef.current = false
    pendingActivateRef.current = false
    stallTextRef.current = null
    stallDoneRef.current = true
    onAttitudeChange?.('teacher')
  }, [heckler, euclidVoice, onAttitudeChange, stopAudio])

  // Trigger heckler topology check whenever a construction event fires.
  useEffect(() => {
    if (!playgroundMode) return
    return eventBusRef.current.subscribe(() => {
      heckler.notifyConstructionChange()
    })
  }, [playgroundMode, heckler.notifyConstructionChange])

  // ── Unified send handler: routes to voice session or SSE chat ──
  const handleChatSend = useCallback(
    (text: string) => {
      console.log(
        '[euclid] handleChatSend: voiceState=%s, text=%s',
        euclidVoice.state,
        text.slice(0, 50)
      )
      if (euclidVoice.state === 'active') {
        // Send to voice session + add to shared message history
        console.log('[euclid] routing to voice session')
        euclidVoice.sendUserText(text)
        const msgId = generateId()
        euclidChat.addMessage({
          id: msgId,
          role: 'user',
          content: text,
          timestamp: Date.now(),
          via: 'typed-during-call',
        })
        euclidChat.markupMessage(msgId, text, true)
      } else {
        // Normal SSE chat — sendMessage adds to history + streams response
        console.log('[euclid] routing to SSE chat')
        euclidChat.sendMessage(text)
      }
    },
    [euclidVoice.state, euclidVoice.sendUserText, euclidChat.addMessage, euclidChat.sendMessage]
  )

  // Chat highlight state — set when hovering geometric entities in chat
  const chatHighlightRef = useRef<GeometricEntityRef | null>(null)

  // Unified highlight handler for the old onHighlight prop (geometric only)
  const handleChatHighlight = useCallback((entity: EuclidEntityRef | null) => {
    if (entity && isGeometricEntity(entity)) {
      chatHighlightRef.current = entity
    } else {
      chatHighlightRef.current = null
    }
    needsDrawRef.current = true
  }, [])

  // Foundation highlight: reuses the same activeCitation state + CitationPopover
  const handleChatHighlightFoundation = useCallback(
    (entity: FoundationEntityRef, anchorRect: DOMRect) => {
      if (citationHideTimerRef.current) clearTimeout(citationHideTimerRef.current)
      if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
      const key = foundationToCitationKey(entity)
      citationShowTimerRef.current = setTimeout(() => {
        setActiveCitation({ key, rect: anchorRect })
      }, 200)
    },
    []
  )

  const handleChatUnhighlightFoundation = useCallback(() => {
    if (citationShowTimerRef.current) clearTimeout(citationShowTimerRef.current)
    citationHideTimerRef.current = setTimeout(() => {
      if (!popoverHoveredRef.current) setActiveCitation(null)
    }, 300)
  }, [])

  // Per-entity-type renderer for MarkedText — delegates to EuclidEntitySpan
  const renderEntity = useEuclidEntityRenderer({
    onHighlightGeometric: handleChatHighlight,
    onHighlightFoundation: handleChatHighlightFoundation,
    onUnhighlightFoundation: handleChatUnhighlightFoundation,
  })

  // Subtle renderer for tutorial guidance — interactive but visually muted
  const renderEntitySubtle = useEuclidEntityRenderer({
    onHighlightGeometric: handleChatHighlight,
    onHighlightFoundation: handleChatHighlightFoundation,
    onUnhighlightFoundation: handleChatUnhighlightFoundation,
    subtle: true,
  })

  // Mute TTS narration while a voice call is active, and stop any playing audio.
  // During heckler pre-dial (ringing/preconnected), the call is invisible to the user.
  const euclidCallVisible =
    euclidVoice.state === 'active' ||
    euclidVoice.state === 'ending' ||
    euclidVoice.state === 'error' ||
    (euclidVoice.state === 'ringing' && !hecklerPreDialRef.current)
  useEffect(() => {
    if (euclidCallVisible) stopAudio()
  }, [euclidCallVisible, stopAudio])
  const narrationEnabled = disableAudio ? audioEnabled : euclidCallVisible ? false : undefined

  // ── Build chatCallState from euclidVoice ──
  const chatCallState: ChatCallState | undefined = euclidCallVisible
    ? {
        state: euclidVoice.state,
        timeRemaining: euclidVoice.timeRemaining,
        isSpeaking: euclidVoice.isSpeaking,
        isThinking: euclidVoice.isThinking,
        thinkingLabel: 'Consulting scrolls',
        error: euclidVoice.error,
        errorCode: euclidVoice.errorCode,
        onHangUp: euclidVoice.hangUp,
        onRetry: euclidVoice.dial,
      }
    : undefined

  // Inject "Call ended" event when transitioning from active → ending
  const prevVoiceStateRef = useRef(euclidVoice.state)
  useEffect(() => {
    const prev = prevVoiceStateRef.current
    prevVoiceStateRef.current = euclidVoice.state
    if (prev === 'active' && euclidVoice.state === 'ending') {
      euclidChat.addMessage({
        id: generateId(),
        role: 'user',
        content: 'Call ended',
        timestamp: Date.now(),
        isEvent: true,
      })
    }
  }, [euclidVoice.state, euclidChat.addMessage])

  const { handleDragStart, handleConstructionBreakdown } = useEuclidAudioHelp({
    instruction: currentSpeech,
    isComplete: playgroundMode ? false : isComplete,
    celebrationText:
      completionResult?.status === 'proven' && completionResult.statement
        ? completionResult.statement
        : 'Construction complete!',
    explorationNarration,
    enabledOverride: narrationEnabled,
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

  // ── Wiggle animation — invite kids to drag moveable points ──
  // Extracted so it can be triggered by both completion and the playground wiggle button.
  const startWiggle = useCallback(
    (delayMs: number = 0) => {
      // Cancel any existing wiggle
      wiggleCancelRef.current?.()
      wiggleCancelRef.current = null

      const prop = propositionRef.current
      const computeFn = prop.computeGivenElements

      // Collect all moveable points: given draggable + free (playground)
      const initialPositions = new Map<string, { x: number; y: number }>()
      const initialActions = [...postCompletionActionsRef.current]
      const draggableSet = new Set(prop.draggablePointIds ?? [])
      for (const el of constructionRef.current.elements) {
        if (el.kind !== 'point') continue
        if (draggableSet.has(el.id) || el.origin === 'free' || el.origin === 'extend') {
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
        const amp = ((0.0025 + Math.random() * 0.00375) * cssMin) / ppu
        return {
          ptId,
          isFree: !draggableSet.has(ptId),
          ax: amp * (0.6 + Math.random() * 0.8),
          ay: amp * (0.6 + Math.random() * 0.8),
          freqX: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000),
          freqY: (2 + Math.random() * 2) * ((2 * Math.PI) / 1000),
          phaseX: Math.random() * 2 * Math.PI,
          phaseY: Math.random() * 2 * Math.PI,
        }
      })

      const DURATION_MS = 1500
      let frameId = 0
      let cancelled = false

      function applyPositions(positions: Map<string, { x: number; y: number }>) {
        // Update free-point actions with new positions
        const actions = initialActions.map((a) => {
          if (a.type === 'free-point' && positions.has(a.id)) {
            const pos = positions.get(a.id)!
            return { ...a, x: pos.x, y: pos.y }
          }
          return a
        })
        postCompletionActionsRef.current = actions

        let givenElements: ConstructionElement[]
        if (computeFn) {
          givenElements = computeFn(positions)
        } else {
          givenElements = prop.givenElements.map((el) => {
            if (el.kind === 'point' && positions.has(el.id)) {
              const pos = positions.get(el.id)!
              return { ...el, x: pos.x, y: pos.y }
            }
            return el
          })
        }
        const result = replayConstruction(givenElements, prop.steps, prop, actions)
        constructionRef.current = result.state
        candidatesRef.current = result.candidates
        ghostLayersRef.current = result.ghostLayers
        factStoreRef.current = result.factStore
      }

      function frame(now: number) {
        if (cancelled) return
        const t = now - startMs
        if (t >= DURATION_MS) {
          // Restore original positions
          postCompletionActionsRef.current = initialActions
          applyPositions(initialPositions)
          needsDrawRef.current = true
          wiggleCancelRef.current = null // prevent stale cancel from wiping later actions
          return
        }
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
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          startMs = performance.now()
          frameId = requestAnimationFrame(frame)
        }
      }, delayMs)

      const cancel = () => {
        cancelled = true
        clearTimeout(timeoutId)
        cancelAnimationFrame(frameId)
        postCompletionActionsRef.current = initialActions
        applyPositions(initialPositions)
        needsDrawRef.current = true
      }
      wiggleCancelRef.current = cancel

      return cancel
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Auto-wiggle on proposition completion (not in playground — user triggers manually)
  useEffect(() => {
    if (!isComplete) return
    if (playgroundMode) return
    if (!proposition.draggablePointIds || proposition.draggablePointIds.length === 0) return

    const cancel = startWiggle(400) // 400ms delay for completion moment to render

    return () => {
      cancel?.()
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

    // Observation steps need no tool — stay on move
    if (stepDef.expected.type === 'observation') {
      if (activeTool !== 'move') {
        toolPhases.selectTool('move')
      }
      return
    }

    if (stepDef.tool === null) return

    // In guided mode, auto-select the required proposition so the user can
    // immediately tap canvas points. The panel will appear showing the
    // active proposition with point-selection progress.
    if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
      const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
      if (macroDef) {
        toolPhases.enterMacroSelecting(stepDef.expected.propId, macroDef.inputs)
      }
    }

    if (stepDef.tool !== activeTool) {
      toolPhases.selectTool(stepDef.tool)

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
      toolPhases.resetAll()

      // Lock all tool interactions for the duration of the correction narration
      correctionActiveRef.current = true

      const phrase = WRONG_MOVE_PHRASES[wrongMoveCounterRef.current++ % WRONG_MOVE_PHRASES.length]
      const instruction = currentSpeechRef.current || steps[step].instruction

      const unlock = () => {
        correctionActiveRef.current = false
        // Re-initialize the macro selecting phase if the step expects a macro.
        // The step-sync useEffect won't re-fire because currentStep didn't change.
        const stepDef = steps[step]
        if (stepDef?.tool === 'macro' && stepDef.expected.type === 'macro') {
          const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
          if (macroDef) {
            toolPhases.enterMacroSelecting(stepDef.expected.propId, macroDef.inputs)
          }
        }
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
    [steps, requestDraw, setProofFacts, toolPhases]
  )

  // ── Step validation (uses ref to avoid stale closures) ──

  const checkStep = useCallback(
    (element: ConstructionElement, candidate?: IntersectionCandidate) => {
      const step = currentStepRef.current
      if (step >= steps.length) return

      const stepDef = steps[step]
      const valid = validateStep(stepDef.expected, constructionRef.current, element, candidate)
      console.log(
        '[checkStep] step=%d valid=%s expected=%o element=%o',
        step,
        valid,
        stepDef.expected,
        { kind: element.kind, id: element.id }
      )
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

  // ── Advance observation step (no canvas interaction needed) ──
  const advanceObservation = useCallback(() => {
    const step = currentStepRef.current
    if (step >= steps.length) return
    const stepDef = steps[step]
    if (stepDef.expected.type !== 'observation') return

    // Capture snapshot before advancing
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
    }
    setCurrentStep(nextStep)
  }, [steps])

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

      const cLabel = getPoint(result.state, centerId)?.label ?? centerId.replace(/^pt-/, '')
      const rLabel =
        getPoint(result.state, radiusPointId)?.label ?? radiusPointId.replace(/^pt-/, '')
      notifierRef.current.notifyConstruction({
        action: `Drew circle centered at ${cLabel} through ${rLabel}`,
        shouldPrompt: true,
      })
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

      const fLabel = getPoint(result.state, fromId)?.label ?? fromId.replace(/^pt-/, '')
      const tLabel = getPoint(result.state, toId)?.label ?? toId.replace(/^pt-/, '')
      notifierRef.current.notifyConstruction({
        action: `Drew segment from ${fLabel} to ${tLabel}`,
        shouldPrompt: true,
      })
    },
    [checkStep, requestDraw, extendSegments]
  )

  const handleCommitExtend = useCallback(
    (baseId: string, throughId: string, projX: number, projY: number) => {
      const step = currentStepRef.current
      const isGuidedExtend = step < steps.length && steps[step].expected.type === 'extend'

      const basePt = getPoint(constructionRef.current, baseId)
      const throughPt = getPoint(constructionRef.current, throughId)
      if (!basePt || !throughPt) return

      const dx = throughPt.x - basePt.x
      const dy = throughPt.y - basePt.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 0.001) return

      let newX: number, newY: number, label: string | undefined
      if (isGuidedExtend) {
        const expected = steps[step].expected as Extract<
          (typeof steps)[number]['expected'],
          { type: 'extend' }
        >
        // Guided: use expected.distance along the ray
        const dirX = dx / len
        const dirY = dy / len
        newX = throughPt.x + dirX * expected.distance
        newY = throughPt.y + dirY * expected.distance
        label = expected.label
      } else {
        // Free-form: use the actual projected cursor position
        newX = projX
        newY = projY
      }

      // Free-form extends get 'extend' origin (draggable); guided keeps 'intersection'
      const ptOrigin = isGuidedExtend ? 'intersection' : 'extend'
      const ptResult = addPoint(constructionRef.current, newX, newY, ptOrigin, label)
      constructionRef.current = ptResult.state

      const segResult = addSegment(constructionRef.current, throughId, ptResult.point.id)
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

      if (isGuidedExtend) {
        checkStep(ptResult.point)
      }
      requestDraw()

      const throughLabel =
        getPoint(constructionRef.current, throughId)?.label ?? throughId.replace(/^pt-/, '')
      const newLabel = ptResult.point.label
      notifierRef.current.notifyConstruction({
        action: `Extended line through ${throughLabel} to new point ${newLabel}`,
        shouldPrompt: true,
      })

      // Record in post-completion actions for free-form extends
      if (!isGuidedExtend) {
        // Compute distance from throughPt to the new point along the ray
        const eDx = newX - throughPt.x
        const eDy = newY - throughPt.y
        const extendDistance = Math.sqrt(eDx * eDx + eDy * eDy)

        postCompletionActionsRef.current = [
          ...postCompletionActionsRef.current,
          {
            type: 'extend' as const,
            baseId,
            throughId,
            pointId: ptResult.point.id,
            segmentId: segResult.segment.id,
            distance: extendDistance,
          },
        ]
      }
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

      notifierRef.current.notifyConstruction({
        action: `Marked intersection point ${result.point.label}`,
        shouldPrompt: true,
      })
    },
    [checkStep, requestDraw, steps]
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const step = currentStepRef.current
      const expected = step < steps.length ? steps[step].expected : null

      // A macro application is "guided" when the current step expects this exact proposition
      // AND the input points match the expected inputs (in order).
      // Without the input check, wrong inputs (e.g. ['pt-B','pt-B'] instead of ['pt-A','pt-B'])
      // would be treated as correct, advancing the step with a degenerate/empty construction.
      const isGuidedStep =
        expected?.type === 'macro' &&
        expected.propId === propId &&
        expected.inputPointIds.length === inputPointIds.length &&
        expected.inputPointIds.every((id, i) => id === inputPointIds[i])
      const outputLabels =
        isGuidedStep && expected?.type === 'macro' ? expected.outputLabels : undefined

      console.log(
        '[commit-macro] propId=%d inputs=%o step=%d expected=%o isGuidedStep=%s expectedInputs=%o',
        propId,
        inputPointIds,
        step,
        expected,
        isGuidedStep,
        expected?.type === 'macro' ? expected.inputPointIds : 'N/A'
      )

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

      notifierRef.current.notifyConstruction({
        action: `Applied Proposition I.${propId}`,
        shouldPrompt: true,
      })

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
          toolPhases.enterMacroSelecting(mpId, mDef.inputs)
        } else {
          toolPhases.enterMacroChoosing()
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
        const nextSt = stepToAdvance + 1
        setCompletedSteps((prev) => {
          const next = [...prev]
          next[stepToAdvance] = true
          return next
        })
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

        // Depth-1 layers were already visible as the live preview — pre-reveal
        // them so they stay visible while deeper layers animate in underneath.
        const preRevealedLayers = new Map<string, number>()
        for (const layer of macroGhosts) {
          if (layer.depth === 1) {
            const key = `${layer.atStep}:${layer.depth}`
            const groupCount = layer.revealGroups?.length ?? 1
            preRevealedLayers.set(key, groupCount)
            // Seed opacity from preview level for smooth transition to ceremony target
            ghostOpacitiesRef.current.set(key, 0.35)
          }
        }

        // Build timed sequence only for deeper layers (depth > 1)
        const sequence: Array<{ layerKey: string; groupIndex: number; msDelay: number }> = []
        let lastGroupMaxDurationMs = 0 // draw duration of the previous group, for timing
        for (const layer of sorted) {
          if (layer.depth === 1) continue // already pre-revealed
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
          // If sequence is empty (only depth-1 layers, e.g. I.1), mark all shown immediately
          allShownMs: sequence.length === 0 ? performance.now() : null,
          postNarrationDelayMs: 1200,
          advanceStep: doAdvanceStep,
          preRevealedLayers,
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
  const [creationId, setCreationId] = useState<string | null>(null)
  const [creationIsPublic, setCreationIsPublic] = useState(false)
  const [creationTitle, setCreationTitle] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'copied'>('idle')
  const [showCreationsPanel, setShowCreationsPanel] = useState(false)

  // Drag state for euclid-quad (draggable by avatar)
  const quadRef = useRef<HTMLDivElement>(null)
  const quadDragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const [quadOffset, setQuadOffset] = useState({ x: 0, y: 0 })

  const [quadDragging, setQuadDragging] = useState(false)

  const handleQuadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      quadDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: quadOffset.x,
        origY: quadOffset.y,
      }
      setQuadDragging(true)
    },
    [quadOffset]
  )

  const handleQuadPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = quadDragRef.current
    if (!drag) return
    e.preventDefault()
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    let newX = drag.origX + dx
    let newY = drag.origY + dy

    // Clamp so the quad stays within the canvas pane bounds.
    const container = containerRef.current
    const root = container?.parentElement // euclid-canvas root
    if (container && root) {
      const rootW = root.clientWidth
      const rootH = root.clientHeight
      const cw = container.clientWidth
      const ch = container.clientHeight
      const QUAD_SIZE = 76
      const MARGIN = 12

      const baseX = cw - MARGIN - QUAD_SIZE
      const baseY = ch - MARGIN - QUAD_SIZE
      const quadLeft = baseX + newX
      const quadTop = baseY + newY

      const clampedLeft = Math.max(0, Math.min(quadLeft, rootW - QUAD_SIZE))
      const clampedTop = Math.max(0, Math.min(quadTop, rootH - QUAD_SIZE))
      newX = clampedLeft - baseX
      newY = clampedTop - baseY
    }

    setQuadOffset({ x: newX, y: newY })
  }, [])

  const handleQuadPointerUp = useCallback((e: React.PointerEvent) => {
    if (!quadDragRef.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    quadDragRef.current = null
    setQuadDragging(false)
  }, [])

  // Chat mode: closed (hidden), docked (in proof column), floating (old quad popup)
  const [chatMode, setChatMode] = useState<'closed' | 'docked' | 'floating'>('closed')
  const [mobileDockedExpanded, setMobileDockedExpanded] = useState(false)
  const dockedInputRef = useRef<HTMLInputElement | null>(null)

  // Floating chat animation (only when mode === 'floating')
  const [chatMounted, setChatMounted] = useState(false)
  const [chatExpanded, setChatExpanded] = useState(false)

  useEffect(() => {
    if (chatMode === 'floating') {
      setChatMounted(true)
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setChatExpanded(true))
      })
      return () => cancelAnimationFrame(raf)
    } else {
      setChatExpanded(false)
      if (chatMounted) {
        const timer = setTimeout(() => setChatMounted(false), 250)
        return () => clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMode])

  // Auto-open docked chat when a visible call starts (skip heckler pre-dial)
  useEffect(() => {
    if (euclidVoice.state === 'active' && chatMode === 'closed') {
      setChatMode('docked')
    }
    // Also open on normal ringing (non-heckler pre-dial)
    if (euclidVoice.state === 'ringing' && !hecklerPreDialRef.current && chatMode === 'closed') {
      setChatMode('docked')
    }
  }, [euclidVoice.state, chatMode])

  const handleNewCanvas = useCallback(() => {
    constructionRef.current = initializeGiven(proposition.givenElements)
    candidatesRef.current = []
    postCompletionActionsRef.current = []
    eventBusRef.current.emit({ action: 'reset', shouldPrompt: false, reset: true })
    ghostLayersRef.current = []
    proofFactsRef.current = []
    toolPhases.resetAll()
    setCreationId(null)
    setCreationIsPublic(false)
    setCreationTitle('')
    setSaveState('idle')
    setShareState('idle')
  }, [proposition.givenElements, toolPhases])

  /** Revert the playground to the state just after a given action index.
   *  Truncates postCompletionActions and replays the full construction. */
  const handleRevertToAction = useCallback(
    (actionIndex: number) => {
      // Truncate actions: keep [0..actionIndex] (the clicked step stays)
      postCompletionActionsRef.current = postCompletionActionsRef.current.slice(0, actionIndex + 1)

      // Replay the entire construction with the truncated action list
      const result = replayConstruction(
        proposition.givenElements,
        proposition.steps,
        proposition,
        postCompletionActionsRef.current
      )

      // Restore all state refs atomically
      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      ghostLayersRef.current = result.ghostLayers
      proofFactsRef.current = result.proofFacts
      setProofFacts(result.proofFacts)
      factStoreRef.current = result.factStore

      // Reset tool phases to idle
      toolPhases.resetAll()
      macroAnimationRef.current = null
      macroRevealRef.current = null

      // Notify ledger to re-derive entries
      eventBusRef.current.emit({ action: 'revert', shouldPrompt: false, reset: true })
    },
    [proposition, toolPhases]
  )

  /** Capture a thumbnail from the main canvas. */
  const captureThumbnail = useCallback((): string | undefined => {
    const srcCanvas = canvasRef.current
    if (!srcCanvas) return undefined
    const THUMB_W = 400
    const THUMB_H = 300
    const off = document.createElement('canvas')
    off.width = THUMB_W
    off.height = THUMB_H
    const ctx = off.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(srcCanvas, 0, 0, THUMB_W, THUMB_H)
    return off.toDataURL('image/jpeg', 0.75)
  }, [])

  /** Collect creation data payload. */
  const collectCreationData = useCallback(() => {
    const givenPoints = getAllPoints(constructionRef.current)
      .filter((pt) => pt.origin === 'given')
      .map((pt) => ({ id: pt.id, x: pt.x, y: pt.y }))
    return { givenPoints, actions: postCompletionActionsRef.current }
  }, [])

  /** Save as draft (POST new or PATCH existing). */
  const handleSave = useCallback(async () => {
    if (saveState === 'saving') return
    setSaveState('saving')

    const thumbnail = captureThumbnail()
    const data = collectCreationData()
    const title = creationTitle || null

    try {
      if (creationId) {
        // PATCH existing
        const res = await fetch(`/api/euclid/creations/${creationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, thumbnail, title }),
        })
        if (res.ok) {
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 1500)
        } else {
          setSaveState('idle')
        }
      } else {
        // POST new (private draft)
        const res = await fetch('/api/euclid/creations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, thumbnail, isPublic: false, playerId: playerId ?? null, title }),
        })
        const json = await res.json()
        if (res.ok) {
          setCreationId(json.id)
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 1500)
        } else {
          setSaveState('idle')
        }
      }
    } catch {
      setSaveState('idle')
    }
  }, [saveState, creationId, creationTitle, captureThumbnail, collectCreationData, playerId])

  /** Share: make public + copy link. */
  const handleShare = useCallback(async () => {
    if (!creationId || shareState === 'sharing') return
    setShareState('sharing')

    try {
      if (!creationIsPublic) {
        // Make public
        const res = await fetch(`/api/euclid/creations/${creationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublic: true }),
        })
        if (!res.ok) {
          setShareState('idle')
          return
        }
        setCreationIsPublic(true)
      }

      // Copy link
      const url = `${window.location.origin}/toys/euclid/creations/${creationId}`
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      setShareState('idle')
    }
  }, [creationId, creationIsPublic, shareState])

  /** Load a creation in-place from the creations panel. */
  const handleLoadCreation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/euclid/creations/${id}`)
        if (!res.ok) return
        const json = await res.json()
        const creation = json.creation as {
          id: string
          data: { givenPoints: Array<{ id: string; x: number; y: number }>; actions: PostCompletionAction[] }
          title: string | null
          isPublic: boolean
        }

        // Reset construction using given points from the creation
        let givenElements = proposition.givenElements
        if (creation.data.givenPoints?.length > 0) {
          givenElements = givenElements.map((el) => {
            if (el.kind === 'point') {
              const saved = creation.data.givenPoints.find((gp) => gp.id === el.id)
              if (saved) return { ...el, x: saved.x, y: saved.y }
            }
            return el
          })
        }
        // Replay actions
        const actions = creation.data.actions ?? []
        postCompletionActionsRef.current = actions
        const result = replayConstruction(
          givenElements,
          proposition.steps,
          proposition,
          actions
        )

        constructionRef.current = result.state
        candidatesRef.current = result.candidates
        ghostLayersRef.current = result.ghostLayers
        proofFactsRef.current = result.proofFacts

        // Reset tool phases
        toolPhases.resetAll()
        macroAnimationRef.current = null
        macroRevealRef.current = null

        // Update creation tracking state
        setCreationId(creation.id)
        setCreationTitle(creation.title ?? '')
        setCreationIsPublic(creation.isPublic)
        setSaveState('idle')
        setShareState('idle')

        // Notify and redraw
        eventBusRef.current.emit({ action: 'reset', shouldPrompt: false, reset: true })
        needsDrawRef.current = true
        setShowCreationsPanel(false)
      } catch (err) {
        console.error('[EuclidCanvas] Failed to load creation:', err)
      }
    },
    [proposition, toolPhases]
  )

  const [exportCopied, setExportCopied] = useState<'ts' | 'claude' | null>(null)

  /** Admin export: copy PropositionDef TypeScript to clipboard. */
  const handleExportTypeScript = useCallback(async () => {
    const proofJSON = playgroundToProofJSON(
      proposition.givenElements,
      postCompletionActionsRef.current,
      constructionRef.current,
      { title: creationTitle || 'Playground Construction' }
    )
    const code = exportPropositionDef(proofJSON)
    await navigator.clipboard.writeText(code)
    setExportCopied('ts')
    setTimeout(() => setExportCopied(null), 2000)
  }, [proposition.givenElements, creationTitle])

  /** Admin export: copy Claude prompt to clipboard. */
  const handleExportClaudePrompt = useCallback(async () => {
    const proofJSON = playgroundToProofJSON(
      proposition.givenElements,
      postCompletionActionsRef.current,
      constructionRef.current,
      { title: creationTitle || 'Playground Construction' }
    )
    const prompt = generateClaudePrompt(proofJSON)
    await navigator.clipboard.writeText(prompt)
    setExportCopied('claude')
    setTimeout(() => setExportCopied(null), 2000)
  }, [proposition.givenElements, creationTitle])

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

      notifierRef.current.notifyConstruction({
        action: `Placed free point ${result.point.label}`,
        shouldPrompt: false,
      })
    },
    [requestDraw]
  )

  const handleRewindToStep = useCallback(
    (targetStep: number) => {
      const snapshot = snapshotStackRef.current[targetStep]
      if (!snapshot) return

      // 1. Reset all tool phases to idle, clear animations
      toolPhases.resetAll()
      macroAnimationRef.current = null
      macroRevealRef.current = null
      superpositionFlashRef.current = null
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

      // 6. Reset tutorial sub-step
      tutorialSubStepRef.current = 0
      setTutorialSubStep(0)
      prevCompassTagRef.current = 'idle'
      prevStraightedgeTagRef.current = 'idle'

      // 7. Sync tool/expectedAction refs for the new current step
      if (targetStep < steps.length) {
        const stepDef = steps[targetStep]
        expectedActionRef.current = stepDef.expected
        if (stepDef.tool !== null) {
          toolPhases.selectTool(stepDef.tool)

          // In guided mode, auto-select the required proposition on rewind
          if (stepDef.tool === 'macro' && stepDef.expected.type === 'macro') {
            const macroDef = MACRO_REGISTRY[stepDef.expected.propId]
            if (macroDef) {
              toolPhases.enterMacroSelecting(stepDef.expected.propId, macroDef.inputs)
            }
          }
        }
      } else {
        expectedActionRef.current = null
      }

      requestDraw()
    },
    [steps, requestDraw, toolPhases]
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
    pointerWorldRef,
    candidatesRef,
    toolPhases,
    onCommitCircle: handleCommitCircle,
    onCommitSegment: handleCommitSegment,
    onMarkIntersection: handleMarkIntersection,
    expectedActionRef,
    onCommitMacro: handleCommitMacro,
    onPlaceFreePoint: handlePlaceFreePoint,
    disabledRef: correctionActiveRef,
    extendPreviewRef,
    onCommitExtend: handleCommitExtend,
  })

  // ── Hook up drag interaction for post-completion play ──
  const constructionIntactRef = useRef(true)
  // Topology tracking: detect when elements appear/disappear during drag.
  // Uses a drag-start baseline so oscillations resolve to the NET change,
  // and collapseInChat replaces (not appends) the event in chat.
  /** Baseline from drag start — never updated during drag */
  const topologyBaselineRef = useRef<{
    map: Map<string, string>
    steps: number
    factCount: number
  } | null>(null)
  /** Current frame's map — used to describe elements that may disappear next frame */
  const topologyCurrentRef = useRef<Map<string, string>>(new Map())
  const topologyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Build a human-readable name for a construction element. */
  function describeElement(el: ConstructionElement, state: ConstructionState): string {
    if (el.kind === 'point') return `point ${el.label}`
    if (el.kind === 'circle') {
      const center = state.elements.find((e) => e.id === el.centerId)
      const radius = state.elements.find((e) => e.id === el.radiusPointId)
      const cLabel = center && 'label' in center ? center.label : '?'
      const rLabel = radius && 'label' in radius ? radius.label : '?'
      return `circle centered at ${cLabel} through ${rLabel}`
    }
    // el.kind === 'segment'
    const from = state.elements.find((e) => e.id === el.fromId)
    const to = state.elements.find((e) => e.id === el.toId)
    const fLabel = from && 'label' in from ? from.label : '?'
    const tLabel = to && 'label' in to ? to.label : '?'
    return `segment ${fLabel}${tLabel}`
  }

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

      // Build current element map (need this every frame so we can name
      // elements that might disappear in a future frame)
      const currMap = new Map<string, string>()
      for (const el of result.state.elements) {
        currMap.set(el.id, describeElement(el, result.state))
      }

      // Set baseline on first frame (drag start)
      if (!topologyBaselineRef.current) {
        topologyBaselineRef.current = {
          map: new Map(currMap),
          steps: result.stepsCompleted,
          factCount: result.proofFacts.length,
        }
        topologyCurrentRef.current = currMap
        return
      }

      topologyCurrentRef.current = currMap

      // Compute NET diff from drag-start baseline (not frame-to-frame).
      // This resolves oscillations: if F disappears then reappears, net = nothing.
      const baseline = topologyBaselineRef.current
      const baseIds = new Set(baseline.map.keys())
      const currIds = new Set(currMap.keys())
      const appeared = [...currIds].filter((id) => !baseIds.has(id))
      const disappeared = [...baseIds].filter((id) => !currIds.has(id))
      const stepsChanged = result.stepsCompleted !== baseline.steps
      const parts: string[] = []

      if (appeared.length > 0) {
        parts.push(`${appeared.map((id) => currMap.get(id)!).join(', ')} appeared`)
      }
      if (disappeared.length > 0) {
        // Use current map first (for elements that existed recently), fall back to baseline
        parts.push(
          `${disappeared.map((id) => topologyCurrentRef.current.get(id) ?? baseline.map.get(id)!).join(', ')} disappeared`
        )
      }
      if (stepsChanged) {
        if (result.stepsCompleted < baseline.steps) {
          // Use the proof engine to describe what broke
          const cr = deriveCompletionResult(
            result.factStore,
            propositionRef.current.resultSegments,
            result.state
          )
          const failedStep = propositionRef.current.steps[result.stepsCompleted]
          let breakdown = `construction broke down at step ${result.stepsCompleted + 1}`
          if (failedStep) breakdown += `: "${failedStep.instruction}"`
          if (cr.status === 'unproven' && cr.statement) {
            breakdown += ` — cannot prove ${cr.statement}`
          }
          parts.push(breakdown)
        } else if (result.stepsCompleted > baseline.steps) {
          const cr = deriveCompletionResult(
            result.factStore,
            propositionRef.current.resultSegments,
            result.state
          )
          let restored = `construction restored through step ${result.stepsCompleted}`
          if (cr.status === 'proven' && cr.statement) {
            restored += ` — ${cr.statement} proven`
          }
          parts.push(restored)
        }
      }

      // Note proof fact count changes (tells Euclid about proof chain health)
      const factDelta = result.proofFacts.length - baseline.factCount
      if (factDelta < 0) {
        parts.push(`${Math.abs(factDelta)} proven fact${Math.abs(factDelta) > 1 ? 's' : ''} lost`)
      } else if (factDelta > 0) {
        parts.push(`${factDelta} new fact${factDelta > 1 ? 's' : ''} proven`)
      }

      // Debounce + collapse: replace the single trailing event in chat
      if (topologyTimerRef.current) clearTimeout(topologyTimerRef.current)
      topologyTimerRef.current = setTimeout(() => {
        topologyTimerRef.current = null
        if (parts.length > 0) {
          const action = `While dragging: ${parts.join('; ')}`
          notifierRef.current.notifyConstruction({
            action,
            shouldPrompt: false,
            collapseInChat: true,
          })
        } else {
          // Net change resolved to nothing — remove any trailing event
          euclidChat.setTrailingEvent(null)
        }
      }, 400)
    },
    [handleConstructionBreakdown, euclidChat.setTrailingEvent]
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
    dragPointIdRef,
    onReplayResult: handleDragReplay,
    onDragStart: useCallback(
      (pointId: string) => {
        wiggleCancelRef.current?.()
        wiggleCancelRef.current = null
        // Capture label for the drag-end notifier (dragPointIdRef is cleared before onDragEnd fires)
        const pt = constructionRef.current.elements.find(
          (e) => e.kind === 'point' && e.id === pointId
        )
        dragLabelRef.current = pt && 'label' in pt ? pt.label : null
        // Reset topology tracking so first replay frame sets the baseline
        topologyBaselineRef.current = null
        handleDragStart(pointId)
      },
      [handleDragStart]
    ),
    onDragEnd: useCallback(() => {
      notifierRef.current.notifyDragEnd(dragLabelRef.current ?? undefined)
      dragLabelRef.current = null
    }, []),
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
        const cdbg = ceremonyDebugRef.current
        const speed = Math.max(0.01, cdbg.speedMultiplier)
        if (!cdbg.paused && ceremony.revealed < ceremony.sequence.length) {
          // Still revealing groups — check if the next one is due
          const entry = ceremony.sequence[ceremony.revealed]
          if (now - ceremony.lastRevealMs >= entry.msDelay / speed) {
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
                  const baseDurationMs =
                    el.kind === 'circle' ? 700 : el.kind === 'segment' ? 400 : 0
                  ceremony.elementAnims.set(`${revealedEntry.layerKey}:${idx}`, {
                    startMs: now,
                    durationMs: baseDurationMs / speed,
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
        } else if (!cdbg.paused && ceremony.allShownMs !== null) {
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
          if (now - ceremony.allShownMs >= ceremony.postNarrationDelayMs / speed) {
            ceremony.advanceStep()
            macroRevealRef.current = null
          } else {
            needsDrawRef.current = true
          }
        }
        // When paused, keep drawing so ghost opacity lerps and the canvas stays live
        if (cdbg.paused) {
          needsDrawRef.current = true
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
      if (
        pointerWorldRef.current &&
        (activeToolRef.current !== 'macro' || macroPhaseRef.current.tag === 'selecting')
      ) {
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
              const includeGhostBounds = inCeremony || ghostBoundsEnabledRef.current
              if (includeGhostBounds) {
                const ceremonyLayerKeys = inCeremony
                  ? new Set([
                      ...cer!.sequence.map((e) => e.layerKey),
                      ...cer!.preRevealedLayers.keys(),
                    ])
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
              // Expand bounds to include macro preview geometry for the
              // current step's prescribed input points. Uses FIXED construction
              // points (not the cursor) so the geometry is viewport-independent
              // and can't cause a zoom feedback loop.
              let includeMacroPreview = false
              if (macroPreviewAutoFitRef.current) {
                const stepIdx = currentStepRef.current
                const stepExpected = stepIdx < steps.length ? steps[stepIdx].expected : null
                if (stepExpected?.type === 'macro') {
                  const previewFn = MACRO_PREVIEW_REGISTRY[stepExpected.propId]
                  if (previewFn) {
                    const positions: { x: number; y: number }[] = []
                    for (const pid of stepExpected.inputPointIds) {
                      const pt = getPoint(constructionRef.current, pid)
                      if (pt) positions.push({ x: pt.x, y: pt.y })
                    }
                    if (positions.length === stepExpected.inputPointIds.length) {
                      const result = previewFn(positions)
                      if (result) {
                        includeMacroPreview = true
                        for (const el of [...result.ghostElements, ...result.resultElements]) {
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
              // Suppress zoom-in when ghost/macro-preview bounds are included
              const shouldZoomIn =
                !includeGhostBounds && !includeMacroPreview && boundsArea <= fitArea * 0.25
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
              // Dampen lerp when macro preview drives bounds so the viewport
              // eases smoothly into the expanded framing.
              const baseLerp = includeMacroPreview ? AUTO_FIT_LERP * 0.5 : AUTO_FIT_LERP
              const sweepLerp =
                compassPhase.tag === 'sweeping' || isPostSweep
                  ? Math.max(AUTO_FIT_SWEEP_LERP_MIN, baseLerp / (1 + sweepSpeed * 0.4))
                  : baseLerp

              let effectivePpu = v.pixelsPerUnit
              const isSweeping = compassPhase.tag === 'sweeping'
              if (!softOk || targetPpu < v.pixelsPerUnit || shouldZoomIn) {
                const nextPpu = v.pixelsPerUnit + (targetPpu - v.pixelsPerUnit) * sweepLerp
                const ppuDeltaCap = inCeremony
                  ? AUTO_FIT_CEREMONY_PPU_DELTA
                  : isSweeping
                    ? AUTO_FIT_SWEEP_PPU_DELTA
                    : AUTO_FIT_MAX_PPU_DELTA
                const deltaPpu = Math.max(
                  -ppuDeltaCap,
                  Math.min(ppuDeltaCap, nextPpu - v.pixelsPerUnit)
                )
                // During sweep: only zoom out (negative delta), never in.
                // This ensures the drawn arc always stays visible — the
                // viewport expands to frame the arc but never contracts
                // while the user is still drawing.
                if (!isSweeping || deltaPpu <= 0) {
                  effectivePpu = v.pixelsPerUnit + deltaPpu
                  v.pixelsPerUnit = effectivePpu
                }
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

              // Hard constraint: compass scribing tip must always be visible.
              // After the soft lerp, check if the tip is within the safe zone.
              // If not, force-zoom out just enough to bring it inside.
              if (compassPhase.tag === 'sweeping' && compassPhase.radius > 0) {
                const sweepCenter = getPoint(constructionRef.current, compassPhase.centerId)
                if (sweepCenter) {
                  const tipAngle = compassPhase.startAngle + compassPhase.cumulativeSweep
                  const tipWorldX = sweepCenter.x + Math.cos(tipAngle) * compassPhase.radius
                  const tipWorldY = sweepCenter.y + Math.sin(tipAngle) * compassPhase.radius
                  const tipDx = tipWorldX - v.center.x
                  const tipDy = v.center.y - tipWorldY // screen Y inverted
                  const tipPad = pad * AUTO_FIT_TIP_PAD_FRACTION
                  let maxPpu = v.pixelsPerUnit
                  if (tipDx > 0.001) {
                    const limit = (fitRect.right - tipPad - cssWidth / 2) / tipDx
                    if (limit > 0) maxPpu = Math.min(maxPpu, limit)
                  } else if (tipDx < -0.001) {
                    const limit = (fitRect.left + tipPad - cssWidth / 2) / tipDx
                    if (limit > 0) maxPpu = Math.min(maxPpu, limit)
                  }
                  if (tipDy > 0.001) {
                    const limit = (fitRect.bottom - tipPad - cssHeight / 2) / tipDy
                    if (limit > 0) maxPpu = Math.min(maxPpu, limit)
                  } else if (tipDy < -0.001) {
                    const limit = (fitRect.top + tipPad - cssHeight / 2) / tipDy
                    if (limit > 0) maxPpu = Math.min(maxPpu, limit)
                  }
                  if (maxPpu < v.pixelsPerUnit && maxPpu >= AUTO_FIT_MIN_PPU) {
                    v.pixelsPerUnit = maxPpu
                  }
                }
              }

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
          const complete = playgroundMode || curStep >= steps.length

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
            const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
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
            complete
              ? playgroundMode
                ? getAllPoints(drawState)
                    .filter(
                      (pt) =>
                        pt.origin === 'given' || pt.origin === 'free' || pt.origin === 'extend'
                    )
                    .map((pt) => pt.id)
                : proposition.draggablePointIds
              : undefined,
            complete ? postCompletionActionsRef.current : undefined
          )

          // Keep redrawing while ripple rings are visible so they animate
          if (
            complete &&
            (playgroundMode
              ? getAllPoints(drawState).some(
                  (pt) => pt.origin === 'given' || pt.origin === 'free' || pt.origin === 'extend'
                )
              : proposition.draggablePointIds?.length)
          ) {
            needsDrawRef.current = true
          }

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
              // Pre-revealed layers (depth-1) are visible from frame 1
              for (const [key, groupCount] of cer.preRevealedLayers) {
                ceremonyRevealCounts.set(key, groupCount)
              }
              // Timed sequence entries (deeper layers)
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

          // Render macro preview (unbound markers + live ghost geometry)
          if (macroPhaseRef.current.tag === 'selecting') {
            const previewAnimating = renderMacroPreview(
              ctx,
              macroPhaseRef.current,
              constructionRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              pointerWorldRef.current,
              snappedPointIdRef.current
            )
            if (previewAnimating) needsDrawRef.current = true
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

          // Render chat entity highlight (golden glow on hovered geometric refs)
          if (chatHighlightRef.current) {
            renderChatHighlight(
              ctx,
              drawState,
              chatHighlightRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight
            )
            needsDrawRef.current = true
          }

          // Render voice highlight (golden glow from voice tool calls)
          if (euclidVoice.voiceHighlightRef.current) {
            renderChatHighlight(
              ctx,
              drawState,
              euclidVoice.voiceHighlightRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight
            )
            needsDrawRef.current = true
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
          overflow: 'visible',
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
                : activeTool === 'macro' && macroPhase.tag !== 'selecting'
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

        {(hasConstructionSteps || isComplete || playgroundMode) && (
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
            {playgroundMode && (
              <ToolButton
                label="Wiggle"
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
                    <path d="M2 12c1.5-3 3.5-3 5 0s3.5 3 5 0 3.5-3 5 0 3.5 3 5 0" />
                  </svg>
                }
                active={false}
                onClick={() => startWiggle(0)}
                size={isMobile ? 44 : 48}
              />
            )}
          </div>
        )}

        {/* Top-right bar — playground controls only */}
        {playgroundMode && (
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
            {/* Title input */}
            <input
              data-element="creation-title"
              type="text"
              value={creationTitle}
              onChange={(e) => setCreationTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
              }}
              placeholder="Untitled construction"
              style={{
                width: 180,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: 'rgba(255,255,255,0.85)',
                color: '#1A1A2E',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'system-ui, sans-serif',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(78,121,167,0.5)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'transparent'
              }}
            />

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

            {/* Save (draft) */}
            <button
              onClick={handleSave}
              disabled={saveState === 'saving' || postCompletionActionsRef.current.length === 0}
              title="Save draft"
              style={{
                padding: '7px 13px',
                borderRadius: 8,
                border: '1px solid rgba(203,213,225,0.9)',
                background:
                  saveState === 'saved'
                    ? 'rgba(16,185,129,0.9)'
                    : 'rgba(255,255,255,0.9)',
                color: saveState === 'saved' ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'system-ui, sans-serif',
                cursor:
                  saveState === 'saving' || postCompletionActionsRef.current.length === 0
                    ? 'default'
                    : 'pointer',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                opacity:
                  postCompletionActionsRef.current.length === 0 && saveState !== 'saved'
                    ? 0.5
                    : 1,
                transition: 'background 0.2s, color 0.2s, opacity 0.2s',
              }}
            >
              {saveState === 'saving'
                ? 'Saving...'
                : saveState === 'saved'
                  ? 'Saved'
                  : 'Save'}
            </button>

            {/* Share / Copy link — only visible after first save */}
            {creationId && (
              <button
                onClick={handleShare}
                disabled={shareState === 'sharing'}
                style={{
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    shareState === 'copied'
                      ? '#10b981'
                      : '#4E79A7',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'system-ui, sans-serif',
                  cursor: shareState === 'sharing' ? 'wait' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'background 0.2s',
                }}
              >
                {shareState === 'copied'
                  ? 'Link copied!'
                  : shareState === 'sharing'
                    ? 'Sharing...'
                    : creationIsPublic
                      ? 'Copy link'
                      : 'Share'}
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
          </div>
        )}

        {/* Admin-only export buttons */}
        {playgroundMode && isAdmin && (
          <div
            data-element="admin-export-bar"
            style={{
              position: 'absolute',
              top: 52,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 12,
              fontFamily: 'system-ui, sans-serif',
              fontSize: 11,
            }}
          >
            <span style={{ color: '#9ca3af' }}>Export:</span>
            <button
              onClick={handleExportTypeScript}
              style={{
                background: 'none',
                border: 'none',
                color: exportCopied === 'ts' ? '#10b981' : '#4E79A7',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: exportCopied === 'ts' ? 600 : 400,
                fontFamily: 'system-ui, sans-serif',
                textDecoration: exportCopied === 'ts' ? 'none' : 'underline',
                padding: 0,
                transition: 'color 0.15s',
              }}
            >
              {exportCopied === 'ts' ? 'Copied!' : 'TypeScript'}
            </button>
            <button
              onClick={handleExportClaudePrompt}
              style={{
                background: 'none',
                border: 'none',
                color: exportCopied === 'claude' ? '#10b981' : '#4E79A7',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: exportCopied === 'claude' ? 600 : 400,
                fontFamily: 'system-ui, sans-serif',
                textDecoration: exportCopied === 'claude' ? 'none' : 'underline',
                padding: 0,
                transition: 'color 0.15s',
              }}
            >
              {exportCopied === 'claude' ? 'Copied!' : 'Claude Prompt'}
            </button>
          </div>
        )}

        {/* Euclid assembly — quad + floating chat, positioned at bottom-right */}
        {/* Hidden on mobile — controls live in the always-visible mobile chat strip */}
        {!playgroundMode && !isMobile && (
          <div
            ref={quadRef}
            data-component="euclid-assembly"
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 12,
              transform: `translate(${quadOffset.x}px, ${quadOffset.y}px)`,
            }}
          >
            {/* Floating chat panel — only when mode is 'floating' */}
            {chatMounted && (
              <div
                data-element="chat-anim-wrapper"
                style={{
                  position: 'absolute',
                  bottom: 38,
                  right: 38,
                  zIndex: 1,
                  transformOrigin: '100% 100%',
                  transform: chatExpanded ? 'scale(1)' : 'scale(0)',
                  opacity: chatExpanded ? 1 : 0,
                  transition: chatExpanded
                    ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease'
                    : 'transform 0.2s ease-in, opacity 0.15s ease-in',
                  willChange: 'transform, opacity',
                }}
              >
                <EuclidChatPanel
                  messages={euclidChat.messages}
                  isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
                  onSend={handleChatSend}
                  onClose={() => setChatMode('closed')}
                  onHighlight={handleChatHighlight}
                  renderEntity={renderEntity}
                  onDragPointerDown={handleQuadPointerDown}
                  onDragPointerMove={handleQuadPointerMove}
                  onDragPointerUp={handleQuadPointerUp}
                  isDragging={quadDragging}
                  squareBottomRight
                  debugCompaction={
                    isVisualDebugEnabled
                      ? {
                          coversUpTo: euclidChat.compaction.coversUpTo,
                          isSummarizing: !!euclidChat.compaction.isSummarizingRef.current,
                          onCompactUpTo: euclidChat.compaction.manualCompactUpTo,
                        }
                      : undefined
                  }
                  callState={chatCallState}
                />
                {/* Dock button — pins chat into proof column */}
                <button
                  data-action="dock-chat"
                  onClick={() => setChatMode('docked')}
                  title="Dock into proof panel"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 32,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '2px 4px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {/* Pin/dock icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
              </div>
            )}
            {/* Quad: avatar (TL), mute (TR), call (BL), chat (BR) */}
            <div
              data-component="euclid-quad"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gridTemplateRows: '1fr 1fr',
                width: 76,
                height: 76,
                borderRadius: 10,
                border: '1px solid rgba(203, 213, 225, 0.8)',
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                position: 'relative',
              }}
            >
              {/* Cross dividers */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 6,
                  bottom: 6,
                  width: 1,
                  background: 'rgba(203, 213, 225, 0.5)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: 6,
                  right: 6,
                  height: 1,
                  background: 'rgba(203, 213, 225, 0.5)',
                  pointerEvents: 'none',
                }}
              />
              {/* TL: Euclid avatar — drag handle (disabled when floating chat is expanded) */}
              <div
                data-element="euclid-avatar"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: !chatExpanded ? (quadDragging ? 'grabbing' : 'grab') : 'default',
                  borderRadius: '9px 0 0 0',
                  touchAction: 'none',
                }}
                onPointerDown={!chatExpanded ? handleQuadPointerDown : undefined}
                onPointerMove={!chatExpanded ? handleQuadPointerMove : undefined}
                onPointerUp={!chatExpanded ? handleQuadPointerUp : undefined}
                onPointerCancel={!chatExpanded ? handleQuadPointerUp : undefined}
                onMouseEnter={(e) => {
                  if (chatMode === 'floating') return
                  const popover = e.currentTarget.querySelector(
                    '[data-element="euclid-popover"]'
                  ) as HTMLElement
                  if (popover) popover.style.opacity = '1'
                }}
                onMouseLeave={(e) => {
                  const popover = e.currentTarget.querySelector(
                    '[data-element="euclid-popover"]'
                  ) as HTMLElement
                  if (popover) popover.style.opacity = '0'
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={smProfileImage}
                  alt="Εὐκλείδης"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {/* Popover — only when floating chat is not expanded */}
                {!chatExpanded && (
                  <div
                    data-element="euclid-popover"
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      right: -38,
                      marginBottom: 8,
                      width: 220,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(203, 213, 225, 0.8)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                      opacity: 0,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: 'none',
                      zIndex: 20,
                      fontSize: 12,
                      lineHeight: 1.45,
                      color: '#374151',
                      fontFamily: 'system-ui, sans-serif',
                      fontStyle: 'italic',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontStyle: 'normal',
                        marginBottom: 4,
                        fontSize: 13,
                      }}
                    >
                      Εὐκλείδης
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      &ldquo;I am here if you need guidance. You may call upon me by voice, or write
                      to me if you prefer. I can also narrate your progress as you work.&rdquo;
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        fontStyle: 'normal',
                        fontSize: 11,
                        color: '#6b7280',
                      }}
                    >
                      <span>
                        <strong style={{ color: '#4E79A7' }}>📞 Call</strong> — speak with me
                        directly
                      </span>
                      <span>
                        <strong style={{ color: '#4E79A7' }}>💬 Chat</strong> — write to me
                      </span>
                      <span>
                        <strong style={{ color: '#4E79A7' }}>🔊 Sound</strong> — toggle my narration
                      </span>
                    </div>
                    {/* Arrow */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -5,
                        left: 24,
                        width: 10,
                        height: 10,
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(203, 213, 225, 0.8)',
                        borderTop: 'none',
                        borderLeft: 'none',
                        transform: 'rotate(45deg)',
                      }}
                    />
                  </div>
                )}
              </div>
              {/* TR: Mute/unmute */}
              <button
                data-action="toggle-audio"
                onClick={() =>
                  disableAudio ? setLocalAudioEnabled((v) => !v) : setAudioEnabled(!audioEnabled)
                }
                title={audioEnabled ? 'Mute narration' : 'Enable narration'}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: audioEnabled ? '#4E79A7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  borderRadius: '0 9px 0 0',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(78, 121, 167, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
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
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {audioEnabled ? (
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  ) : (
                    <line x1="23" y1="9" x2="17" y2="15" />
                  )}
                </svg>
              </button>
              {/* BL: Call */}
              <button
                data-action="call-euclid"
                onClick={euclidVoice.state === 'idle' ? euclidVoice.dial : undefined}
                title="Call Εὐκλείδης"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: euclidVoice.state === 'idle' ? '#4E79A7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: euclidVoice.state === 'idle' ? 'pointer' : 'default',
                  padding: 0,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  borderRadius: '0 0 0 9px',
                }}
                onMouseEnter={(e) => {
                  if (euclidVoice.state === 'idle')
                    e.currentTarget.style.background = 'rgba(78, 121, 167, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
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
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              {/* BR: Chat — toggles docked mode; disabled during active voice call */}
              <button
                data-action="chat-euclid"
                onClick={
                  euclidVoice.state !== 'idle'
                    ? undefined
                    : () =>
                        setChatMode((m) => {
                          if (m === 'closed') {
                            requestAnimationFrame(() => dockedInputRef.current?.focus())
                            return 'docked'
                          }
                          return 'closed'
                        })
                }
                title={chatMode !== 'closed' ? 'Close chat' : 'Open chat'}
                style={{
                  border: 'none',
                  background: chatMode !== 'closed' ? 'rgba(78, 121, 167, 0.12)' : 'transparent',
                  color: euclidVoice.state !== 'idle' ? '#94a3b8' : '#4E79A7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: euclidVoice.state !== 'idle' ? 'default' : 'pointer',
                  padding: 0,
                  transition: 'background 0.15s ease, color 0.15s ease',
                  borderRadius: '0 0 9px 0',
                }}
                onMouseEnter={(e) => {
                  if (euclidVoice.state === 'idle')
                    e.currentTarget.style.background =
                      chatMode !== 'closed'
                        ? 'rgba(78, 121, 167, 0.16)'
                        : 'rgba(78, 121, 167, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    chatMode !== 'closed' ? 'rgba(78, 121, 167, 0.12)' : 'transparent'
                }}
              >
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Voice call UI is now integrated into the chat panel via callState */}

        {showCreationsPanel && (
          <PlaygroundCreationsPanel
            onClose={() => setShowCreationsPanel(false)}
            onLoad={handleLoadCreation}
            currentId={creationId}
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

        {/* ── Heckler incoming call overlay (playground mode) ── */}
        {playgroundMode && (heckler.stage === 'watching' || heckler.stage === 'ringing') && (
          <HecklerIncomingOverlay
            stage={heckler.stage}
            profileImage={smProfileImage}
            characterName={teacherConfig.definition.displayName}
            matchDescription={heckler.matchDescription}
            onAnswer={handleHecklerAnswer}
            onDismiss={handleHecklerDismiss}
          />
        )}

        {/* ── Heckler active call presence (playground mode) ── */}
        {playgroundMode && euclidCallVisible && (
          <HecklerCallPresence
            profileImage={lgProfileImage}
            characterName={
              teacherConfig.definition.nativeDisplayName ??
              teacherConfig.definition.displayName
            }
            isSpeaking={euclidVoice.isSpeaking}
            isThinking={euclidVoice.isThinking}
            timeRemaining={euclidVoice.timeRemaining}
            onHangUp={euclidVoice.hangUp}
          />
        )}
      </div>

      {/* ── Right pane: Construction log (playground mode) ── */}
      {playgroundMode && (
        <div
          data-element="proof-ledger-panel"
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
          }}
        >
          <ProofLedger
            constructionState={constructionRef.current}
            actions={postCompletionActionsRef.current}
            givenElements={proposition.givenElements}
            eventBus={eventBusRef.current}
            pointLabels={getAllPoints(constructionRef.current).map((p) => p.label)}
            renderEntity={renderEntity}
            onRevertToAction={handleRevertToAction}
            onCitationPointerEnter={handleCitationPointerEnter}
            onCitationPointerLeave={handleCitationPointerLeave}
            onCitationPointerDown={handleCitationPointerDown}
            toolPreview={toolPreview}
            isMobile={isMobile}
          />
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
            position: 'relative',
            height: isMobile
              ? mobileDockedExpanded
                ? 'calc(50dvh / 3)'
                : `${MOBILE_PROOF_PANEL_HEIGHT_RATIO * 100}dvh`
              : '100%',
            transition: isMobile ? 'height 0.25s ease' : undefined,
            boxShadow: isMobile ? '0 -10px 24px rgba(0,0,0,0.12)' : undefined,
          }}
        >
          <GuidedProofPanel
            proposition={proposition}
            steps={steps}
            currentStep={currentStep}
            completedSteps={completedSteps}
            isComplete={isComplete}
            proofFacts={proofFacts}
            factsByStep={factsByStep}
            completionResult={completionResult}
            completionMeta={completionMeta}
            currentInstruction={currentInstruction}
            constructionState={constructionRef.current}
            onRewindToStep={handleRewindToStep}
            advanceObservation={advanceObservation}
            onHoverMacroStep={(stepIdx) => {
              hoveredMacroStepRef.current = stepIdx
              needsDrawRef.current = true
            }}
            renderEntity={renderEntity}
            renderEntitySubtle={renderEntitySubtle}
            onHighlight={handleChatHighlight}
            onCitationPointerEnter={handleCitationPointerEnter}
            onCitationPointerLeave={handleCitationPointerLeave}
            onCitationPointerDown={handleCitationPointerDown}
            factStoreRef={factStoreRef}
            isMobile={isMobile}
          />
          {/* Docked chat — desktop: below proof steps in the right column */}
          {!isMobile && (
            <DockedEuclidChat
              messages={euclidChat.messages}
              isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
              onSend={handleChatSend}
              onHighlight={handleChatHighlight}
              renderEntity={renderEntity}
              callState={chatCallState}
              isMobile={false}
              collapsed={chatMode !== 'docked'}
              onUndock={() => setChatMode('floating')}
              inputRef={dockedInputRef}
              debugCompaction={
                isVisualDebugEnabled
                  ? {
                      coversUpTo: euclidChat.compaction.coversUpTo,
                      isSummarizing: !!euclidChat.compaction.isSummarizingRef.current,
                      onCompactUpTo: euclidChat.compaction.manualCompactUpTo,
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* Docked chat — mobile: compact strip below proof panel */}
      {isMobile && !playgroundMode && showProofPanel && (
        <DockedEuclidChat
          messages={euclidChat.messages}
          isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
          onSend={handleChatSend}
          onHighlight={handleChatHighlight}
          renderEntity={renderEntity}
          callState={chatCallState}
          isMobile={true}
          collapsed={false}
          inputRef={dockedInputRef}
          onCall={euclidVoice.state === 'idle' ? euclidVoice.dial : undefined}
          canCall={euclidVoice.state === 'idle'}
          onToggleAudio={() =>
            disableAudio ? setLocalAudioEnabled((v) => !v) : setAudioEnabled(!audioEnabled)
          }
          audioEnabled={audioEnabled}
          onExpandedChange={setMobileDockedExpanded}
          onColdStart={euclidChat.coldStart}
        />
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

      {showContextDebug && (
        <EuclidContextDebugPanel
          constructionRef={constructionRef}
          proofFactsRef={proofFactsRef}
          currentStepRef={currentStepRef}
          steps={steps}
          isComplete={isComplete}
          activeToolRef={activeToolRef}
          compassPhaseRef={compassPhaseRef}
          straightedgePhaseRef={straightedgePhaseRef}
          extendPhaseRef={extendPhaseRef}
          macroPhaseRef={macroPhaseRef}
          dragPointIdRef={dragPointIdRef}
          pendingActionRef={pendingActionRef}
          voiceState={euclidVoice.state}
          isSpeaking={euclidVoice.isSpeaking}
          notifierRef={notifierRef}
          chatMessageCount={euclidChat.messages.length}
          compaction={{
            headSummary: euclidChat.compaction.headSummary,
            coversUpTo: euclidChat.compaction.coversUpTo,
            isSummarizingRef: euclidChat.compaction.isSummarizingRef,
          }}
        />
      )}

      <ToyDebugPanel title="Euclid">
        {/* Focus mode toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            data-action="debug-focus-all"
            onClick={() => setCeremonyFocusMode(false)}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 4,
              border: 'none',
              background: !ceremonyFocusMode ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            All
          </button>
          <button
            data-action="debug-focus-ceremony"
            onClick={() => setCeremonyFocusMode(true)}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: 4,
              border: 'none',
              background: ceremonyFocusMode ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Ceremony
          </button>
        </div>

        {/* ── Ceremony debug section (always visible) ── */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.5,
            }}
          >
            Ceremony
          </div>

          {/* Speed slider */}
          <DebugSlider
            label="Playback speed"
            value={ceremonySpeed}
            min={0.1}
            max={5}
            step={0.1}
            onChange={(v) => {
              setCeremonySpeed(v)
              needsDrawRef.current = true
            }}
            formatValue={(v) => `${v.toFixed(1)}x`}
          />

          {/* Transport controls */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Prev */}
            <button
              data-action="ceremony-prev"
              disabled={!macroRevealRef.current || macroRevealRef.current.revealed <= 0}
              onClick={() => {
                const cer = macroRevealRef.current
                if (!cer || cer.revealed <= 0) return
                // Un-reveal the last group
                cer.revealed--
                cer.allShownMs = null
                cer.narrationFired = false
                // Remove element animations for the group we just hid
                const entry = cer.sequence[cer.revealed]
                const layer = ghostLayersRef.current.find(
                  (gl) => `${gl.atStep}:${gl.depth}` === entry.layerKey
                )
                if (layer?.revealGroups) {
                  const group = layer.revealGroups[entry.groupIndex - 1]
                  if (group) {
                    for (const idx of group) {
                      cer.elementAnims.delete(`${entry.layerKey}:${idx}`)
                    }
                  }
                }
                cer.lastRevealMs = performance.now()
                needsDrawRef.current = true
                setCeremonyTick((t) => t + 1)
              }}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                opacity: !macroRevealRef.current || macroRevealRef.current.revealed <= 0 ? 0.3 : 1,
              }}
            >
              {'<'}
            </button>

            {/* Pause / Play */}
            <button
              data-action="ceremony-pause"
              onClick={() => {
                const next = !ceremonyPaused
                setCeremonyPaused(next)
                // When unpausing, reset the delay timer so the next group doesn't fire instantly
                if (!next && macroRevealRef.current) {
                  macroRevealRef.current.lastRevealMs = performance.now()
                  if (macroRevealRef.current.allShownMs !== null) {
                    macroRevealRef.current.allShownMs = performance.now()
                  }
                }
                needsDrawRef.current = true
              }}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 4,
                border: 'none',
                background: ceremonyPaused ? 'rgba(129,140,248,0.8)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {ceremonyPaused ? '\u25B6' : '\u23F8'}
            </button>

            {/* Next */}
            <button
              data-action="ceremony-next"
              disabled={
                !macroRevealRef.current ||
                macroRevealRef.current.revealed >= macroRevealRef.current.sequence.length
              }
              onClick={() => {
                const cer = macroRevealRef.current
                if (!cer || cer.revealed >= cer.sequence.length) return
                const now = performance.now()
                cer.revealed++
                cer.lastRevealMs = now
                // Start draw animations for the newly revealed group
                const entry = cer.sequence[cer.revealed - 1]
                const layer = ghostLayersRef.current.find(
                  (gl) => `${gl.atStep}:${gl.depth}` === entry.layerKey
                )
                if (layer?.revealGroups) {
                  const group = layer.revealGroups[entry.groupIndex - 1]
                  if (group) {
                    const speed = Math.max(0.01, ceremonySpeed)
                    for (const idx of group) {
                      const el = layer.elements[idx]
                      if (!el) continue
                      const baseDurationMs =
                        el.kind === 'circle' ? 700 : el.kind === 'segment' ? 400 : 0
                      cer.elementAnims.set(`${entry.layerKey}:${idx}`, {
                        startMs: now,
                        durationMs: baseDurationMs / speed,
                      })
                    }
                  }
                }
                if (cer.revealed >= cer.sequence.length) {
                  cer.allShownMs = now
                }
                needsDrawRef.current = true
                setCeremonyTick((t) => t + 1)
              }}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                opacity:
                  !macroRevealRef.current ||
                  macroRevealRef.current.revealed >= macroRevealRef.current.sequence.length
                    ? 0.3
                    : 1,
              }}
            >
              {'>'}
            </button>
          </div>

          {/* Ceremony state readout */}
          {(() => {
            void ceremonyTick // subscribe to tick updates
            const cer = macroRevealRef.current
            if (!cer) {
              return (
                <div style={{ fontSize: 10, opacity: 0.4, fontFamily: 'monospace' }}>
                  No active ceremony
                </div>
              )
            }
            const total = cer.sequence.length
            const preRevealed = cer.preRevealedLayers.size
            const phase =
              cer.allShownMs !== null
                ? cer.narrationFired
                  ? 'post-narration'
                  : 'narrating'
                : 'revealing'
            // Identify current layer being revealed
            const currentEntry = cer.revealed < total ? cer.sequence[cer.revealed] : null
            return (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                  opacity: 0.85,
                }}
              >
                <div>
                  Group:{' '}
                  <span style={{ color: '#818cf8' }}>
                    {cer.revealed}/{total}
                  </span>
                  {preRevealed > 0 && (
                    <span style={{ opacity: 0.5 }}> (+{preRevealed} pre-revealed)</span>
                  )}
                </div>
                <div>
                  Phase: <span style={{ color: '#86efac' }}>{phase}</span>
                </div>
                {currentEntry && (
                  <div style={{ opacity: 0.6 }}>
                    Next: {currentEntry.layerKey} g{currentEntry.groupIndex} ({currentEntry.msDelay}
                    ms)
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* ── General controls (hidden in focus mode) ── */}
        {!ceremonyFocusMode && (
          <>
            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <DebugCheckbox
                label="Construction music"
                checked={music.isPlaying}
                onChange={() => music.toggle()}
              />
              <DebugCheckbox
                label="Context debug"
                checked={showContextDebug}
                onChange={(v) => {
                  setShowContextDebug(v)
                  localStorage.setItem('euclid-show-context-debug', v ? '1' : '0')
                }}
              />
              <DebugCheckbox
                label="Macro preview auto-fit"
                checked={macroPreviewAutoFitRef.current}
                onChange={(v) => {
                  macroPreviewAutoFitRef.current = v
                }}
              />
            </div>
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
          </>
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
