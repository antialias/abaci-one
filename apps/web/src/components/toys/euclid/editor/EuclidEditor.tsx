'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import type {
  EuclidViewportState,
  ConstructionState,
  CompassPhase,
  StraightedgePhase,
  MacroPhase,
  ActiveTool,
  IntersectionCandidate,
  ExpectedAction,
  GhostLayer,
  SerializedAction,
  ExtendPhase,
} from '../types'
import { BYRNE_CYCLE } from '../types'
import type { SerializedElement, SerializedEqualityFact } from '../types'
import {
  addPoint,
  addCircle,
  addSegment,
  getPoint,
} from '../engine/constructionState'
import { findNewIntersections } from '../engine/intersections'
import { screenToWorld2D, worldToScreen2D } from '../../shared/coordinateConversions'
import { hitTestPoints } from '../interaction/hitTesting'
import { renderConstruction } from '../render/renderConstruction'
import { renderToolOverlay } from '../render/renderToolOverlay'
import { renderEqualityMarks } from '../render/renderEqualityMarks'
import { renderGhostGeometry } from '../render/renderGhostGeometry'
import { useEuclidTouch } from '../interaction/useEuclidTouch'
import { useToolInteraction } from '../interaction/useToolInteraction'
import { createFactStore } from '../engine/factStore'
import type { FactStore } from '../engine/factStore'
import { deriveDef15Facts } from '../engine/factDerivation'
import { MACRO_REGISTRY } from '../engine/macros'
import { useEditorState } from './useEditorState'
import { exportPropositionDef, generateClaudePrompt } from './exportPropositionDef'
import { CitationPalette } from './CitationPalette'
import { EditorStepList } from './EditorStepList'
import { PropositionInfo } from './PropositionInfo'

// ── Tool button (same as EuclidCanvas) ──

interface ToolButtonProps {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function ToolButton({ label, icon, active, onClick }: ToolButtonProps) {
  return (
    <button
      data-action={`tool-${label.toLowerCase()}`}
      onClick={onClick}
      title={label}
      style={{
        width: 48,
        height: 48,
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

// ── Given setup right-panel ──

interface GivenSetupPanelProps {
  givenElements: SerializedElement[]
  givenFacts: SerializedEqualityFact[]
  onRenamePoint: (pointId: string, newLabel: string) => void
  onDeleteGivenElement: (elementId: string) => void
  onAddGivenFact: (leftA: string, leftB: string, rightA: string, rightB: string) => void
  onDeleteGivenFact: (index: number) => void
  onStartProof: () => void
}

function GivenSetupPanel({
  givenElements,
  givenFacts,
  onRenamePoint,
  onDeleteGivenElement,
  onAddGivenFact,
  onDeleteGivenFact,
  onStartProof,
}: GivenSetupPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [eqLeft, setEqLeft] = useState('')
  const [eqRight, setEqRight] = useState('')

  const points = givenElements.filter((e) => e.kind === 'point')
  const segments = givenElements.filter((e) => e.kind === 'segment')

  // All ordered point pairs for the segment picker
  const segmentPairs = points.flatMap((a, i) =>
    points.slice(i + 1).map((b) => ({
      value: `${a.id}|${b.id}`,
      label: `${a.label}${b.label}`,
    }))
  )

  return (
    <div
      data-element="given-setup-panel"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Instructions */}
      <div
        style={{
          padding: '12px 20px',
          fontSize: 13,
          color: '#475569',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          lineHeight: 1.5,
          borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
        }}
      >
        Use the <strong>Point</strong> tool to place given points.
        Use the <strong>Straightedge</strong> to add segments between points.
      </div>

      {/* Given elements list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 20px' }}>
        {/* Section: Points */}
        {points.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'system-ui, sans-serif',
                marginBottom: 6,
                marginTop: 4,
              }}
            >
              Points ({points.length})
            </div>
            {points.map((pt) => (
              <div
                key={pt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 13,
                  fontFamily: 'Georgia, serif',
                  color: '#475569',
                }}
              >
                {renamingId === pt.id ? (
                  <input
                    data-element="rename-given-point"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameValue.trim()) {
                        onRenamePoint(pt.id, renameValue.trim())
                        setRenamingId(null)
                      }
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        onRenamePoint(pt.id, renameValue.trim())
                      }
                      setRenamingId(null)
                    }}
                    maxLength={2}
                    autoFocus
                    style={{
                      width: 32,
                      padding: '2px 4px',
                      borderRadius: 3,
                      border: '1px solid #4E79A7',
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none',
                      fontFamily: 'Georgia, serif',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={() => {
                      setRenamingId(pt.id)
                      setRenameValue(pt.label ?? '')
                    }}
                    style={{ fontWeight: 700, cursor: 'text', minWidth: 20 }}
                    title="Double-click to rename"
                  >
                    {pt.label}
                  </span>
                )}
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
                  ({pt.x?.toFixed(1)}, {pt.y?.toFixed(1)})
                </span>
                <button
                  data-action="delete-given-element"
                  onClick={() => onDeleteGivenElement(pt.id)}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#cbd5e1',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                  title="Remove point"
                >
                  &times;
                </button>
              </div>
            ))}
          </>
        )}

        {/* Section: Segments */}
        {segments.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'system-ui, sans-serif',
                marginBottom: 6,
                marginTop: 12,
              }}
            >
              Segments ({segments.length})
            </div>
            {segments.map((seg) => {
              const fromPt = points.find((p) => p.id === seg.fromId)
              const toPt = points.find((p) => p.id === seg.toId)
              return (
                <div
                  key={seg.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    fontSize: 13,
                    fontFamily: 'Georgia, serif',
                    color: '#475569',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {fromPt?.label ?? '?'}{toPt?.label ?? '?'}
                  </span>
                  <button
                    data-action="delete-given-element"
                    onClick={() => onDeleteGivenElement(seg.id)}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      fontSize: 14,
                      cursor: 'pointer',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}
                    title="Remove segment"
                  >
                    &times;
                  </button>
                </div>
              )
            })}
          </>
        )}

        {/* Section: Equal Segments */}
        {points.length >= 2 && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'system-ui, sans-serif',
                marginBottom: 6,
                marginTop: 12,
              }}
            >
              Equal Segments ({givenFacts.length})
            </div>
            {givenFacts.map((fact, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 13,
                  fontFamily: 'Georgia, serif',
                  color: '#475569',
                }}
              >
                <span style={{ fontWeight: 600 }}>{fact.statement}</span>
                <button
                  data-action="delete-given-fact"
                  onClick={() => onDeleteGivenFact(i)}
                  style={{
                    marginLeft: 'auto',
                    background: 'none',
                    border: 'none',
                    color: '#cbd5e1',
                    fontSize: 14,
                    cursor: 'pointer',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                  title="Remove equality"
                >
                  &times;
                </button>
              </div>
            ))}
            {/* Add equality row */}
            {segmentPairs.length >= 2 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 0',
                  fontSize: 13,
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                <select
                  data-element="eq-left"
                  value={eqLeft}
                  onChange={(e) => setEqLeft(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, fontFamily: 'Georgia, serif', fontWeight: 600 }}
                >
                  <option value="">segment...</option>
                  {segmentPairs.map((sp) => (
                    <option key={sp.value} value={sp.value}>{sp.label}</option>
                  ))}
                </select>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>=</span>
                <select
                  data-element="eq-right"
                  value={eqRight}
                  onChange={(e) => setEqRight(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, fontFamily: 'Georgia, serif', fontWeight: 600 }}
                >
                  <option value="">segment...</option>
                  {segmentPairs.filter((sp) => sp.value !== eqLeft).map((sp) => (
                    <option key={sp.value} value={sp.value}>{sp.label}</option>
                  ))}
                </select>
                <button
                  data-action="add-given-fact"
                  onClick={() => {
                    if (eqLeft && eqRight && eqLeft !== eqRight) {
                      const [la, lb] = eqLeft.split('|')
                      const [ra, rb] = eqRight.split('|')
                      onAddGivenFact(la, lb, ra, rb)
                      setEqLeft('')
                      setEqRight('')
                    }
                  }}
                  disabled={!eqLeft || !eqRight || eqLeft === eqRight}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: eqLeft && eqRight && eqLeft !== eqRight
                      ? '#4E79A7'
                      : 'rgba(78, 121, 167, 0.2)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: eqLeft && eqRight && eqLeft !== eqRight ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </>
        )}

        {points.length === 0 && (
          <div
            style={{
              fontSize: 13,
              color: '#94a3b8',
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              paddingTop: 12,
            }}
          >
            No given elements yet. Click on the canvas to add points.
          </div>
        )}
      </div>

      {/* Start Proof button */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(203, 213, 225, 0.3)' }}>
        <button
          data-action="start-proof"
          onClick={onStartProof}
          disabled={points.length < 2}
          style={{
            width: '100%',
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: points.length >= 2 ? '#10b981' : 'rgba(16, 185, 129, 0.3)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            cursor: points.length >= 2 ? 'pointer' : 'default',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Start Proof
        </button>
      </div>
    </div>
  )
}

// ── Main editor ──

interface EuclidEditorProps {
  propositionId: number
}

export function EuclidEditor({ propositionId }: EuclidEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Core refs (same pattern as EuclidCanvas)
  const viewportRef = useRef<EuclidViewportState>({ center: { x: 0, y: 0 }, pixelsPerUnit: 50 })
  const constructionRef = useRef<ConstructionState>({
    elements: [],
    nextLabelIndex: 0,
    nextColorIndex: 0,
  })
  const compassPhaseRef = useRef<CompassPhase>({ tag: 'idle' })
  const straightedgePhaseRef = useRef<StraightedgePhase>({ tag: 'idle' })
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null)
  const snappedPointIdRef = useRef<string | null>(null)
  const candidatesRef = useRef<IntersectionCandidate[]>([])
  const pointerCapturedRef = useRef(false)
  const activeToolRef = useRef<ActiveTool>('compass')
  const expectedActionRef = useRef<ExpectedAction | null>(null)
  const needsDrawRef = useRef(true)
  const rafRef = useRef<number>(0)
  const macroPhaseRef = useRef<MacroPhase>({ tag: 'idle' })
  const extendPhaseRef = useRef<ExtendPhase>({ tag: 'idle' })
  const extendPreviewRef = useRef<{ x: number; y: number } | null>(null)
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(false) // pan/zoom enabled by default in editor
  const citationRequiredRef = useRef(false) // true when authoring mode requires citation
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const hoveredMacroStepRef = useRef<number | null>(null)

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>('compass')
  const [macroPhase, setMacroPhase] = useState<MacroPhase>({ tag: 'idle' })
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [undoReset, setUndoReset] = useState<(() => void) | null>(null)
  const undoResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Editor state
  const editor = useEditorState({
    propositionId,
    constructionRef,
    candidatesRef,
    factStoreRef,
    ghostLayersRef,
  })

  const requestDraw = useCallback(() => {
    needsDrawRef.current = true
  }, [])

  // Sync active tool to ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // Auto-select tools on mode change
  useEffect(() => {
    if (editor.mode === 'given-setup') {
      // Auto-select point tool in given-setup mode
      setActiveTool('point')
      activeToolRef.current = 'point'
    }
    needsDrawRef.current = true
  }, [editor.mode])

  // Sync citation-required ref: block tool gestures in authoring mode without a citation
  useEffect(() => {
    citationRequiredRef.current = editor.mode === 'authoring' && editor.activeCitation === null
  }, [editor.mode, editor.activeCitation])

  // Load saved proof on mount
  useEffect(() => {
    editor.load().then((data) => {
      if (data && data.givenElements.length > 0) {
        // Initialize construction from given elements so they render
        editor.initializeConstruction()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Citation-to-tool mapping ──

  const handleCitationSelect = useCallback(
    (citation: string) => {
      editor.setActiveCitation(citation)

      // Map citation to tool
      if (citation === 'Post.1') {
        setActiveTool('straightedge')
        activeToolRef.current = 'straightedge'
        expectedActionRef.current = null
      } else if (citation === 'Post.2') {
        setActiveTool('extend')
        activeToolRef.current = 'extend'
        extendPhaseRef.current = { tag: 'idle' }
        extendPreviewRef.current = null
        expectedActionRef.current = null
      } else if (citation === 'Post.3') {
        setActiveTool('compass')
        activeToolRef.current = 'compass'
        expectedActionRef.current = null
      } else if (citation.startsWith('I.')) {
        const propId = parseInt(citation.slice(2), 10)
        if (MACRO_REGISTRY[propId]) {
          setActiveTool('macro')
          activeToolRef.current = 'macro'
          expectedActionRef.current = null
          const macroDef = MACRO_REGISTRY[propId]
          macroPhaseRef.current = {
            tag: 'selecting',
            propId,
            inputLabels: macroDef.inputLabels,
            selectedPointIds: [],
          }
        }
      }
      // Def.*, C.N.*, Given → fact-only, no tool change needed
      requestDraw()
    },
    [editor, requestDraw]
  )

  // ── Commit handlers (editor versions) ──

  const handleCommitCircle = useCallback(
    (centerId: string, radiusPointId: string) => {
      const result = addCircle(constructionRef.current, centerId, radiusPointId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.circle,
        candidatesRef.current,
        false
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // Always record compass steps in authoring mode (gestures are blocked without
      // citation, but this prevents silent data loss if one slips through)
      if (editor.mode === 'authoring') {
        const action: SerializedAction = { type: 'compass', centerId, radiusPointId }
        const citation = editor.activeCitation || ''
        const instruction = editor.generateInstruction(citation, action)
        editor.addStep({ citation, instruction, action })
      }

      requestDraw()
    },
    [editor, requestDraw]
  )

  const handleCommitSegment = useCallback(
    (fromId: string, toId: string) => {
      const result = addSegment(constructionRef.current, fromId, toId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.segment,
        candidatesRef.current,
        false
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      if (editor.mode === 'given-setup') {
        // Add to givenElements for serialization
        editor.addGivenSegment(fromId, toId)
      } else {
        // Always record straightedge steps in authoring mode
        const action: SerializedAction = { type: 'straightedge', fromId, toId }
        const citation = editor.activeCitation || ''
        const instruction = editor.generateInstruction(citation, action)
        editor.addStep({ citation, instruction, action })
      }

      requestDraw()
    },
    [editor, requestDraw]
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      const currentStep = editor.steps.length
      const result = addPoint(constructionRef.current, candidate.x, candidate.y, 'intersection')
      constructionRef.current = result.state

      candidatesRef.current = candidatesRef.current.filter(
        (c) => !(Math.abs(c.x - candidate.x) < 0.001 && Math.abs(c.y - candidate.y) < 0.001)
      )

      // Derive Def.15 facts
      const newFacts = deriveDef15Facts(
        candidate,
        result.point.id,
        constructionRef.current,
        factStoreRef.current,
        currentStep
      )
      if (newFacts.length > 0) {
        editor.updateProofFacts(newFacts)
      }

      // Always record intersection steps — use active citation or empty string
      const action: SerializedAction = {
        type: 'intersection',
        ofA: candidate.ofA,
        ofB: candidate.ofB,
        label: result.point.label,
      }
      const citation = editor.activeCitation || ''
      const instruction = editor.activeCitation
        ? editor.generateInstruction(citation, action)
        : `Mark intersection point ${result.point.label}.`
      editor.addStep({
        citation,
        instruction,
        action,
      })

      requestDraw()
    },
    [editor, requestDraw]
  )

  const handleCommitMacro = useCallback(
    (propId: number, inputPointIds: string[]) => {
      const macroDef = MACRO_REGISTRY[propId]
      if (!macroDef) return

      const currentStep = editor.steps.length
      const result = macroDef.execute(
        constructionRef.current,
        inputPointIds,
        candidatesRef.current,
        factStoreRef.current,
        currentStep,
        false
      )

      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      if (result.newFacts.length > 0) {
        editor.updateProofFacts(result.newFacts)
      }

      const macroGhosts = result.ghostLayers.map((gl) => ({ ...gl, atStep: currentStep }))
      if (macroGhosts.length > 0) {
        ghostLayersRef.current = [...ghostLayersRef.current, ...macroGhosts]
      }

      // Always record macro steps in authoring mode
      const action: SerializedAction = { type: 'macro', propId, inputPointIds }
      const citation = editor.activeCitation || ''
      const instruction = editor.generateInstruction(citation, action)
      editor.addStep({ citation, instruction, action })

      requestDraw()
    },
    [editor, requestDraw]
  )

  // ── Fact-only step submission ──

  const handleAddFactStep = useCallback(
    (citation: string, instruction: string) => {
      editor.addStep({
        citation,
        instruction,
        action: { type: 'fact-only' },
      })
    },
    [editor]
  )

  // ── Tool blocked handler (no citation selected in authoring mode) ──

  const handleToolBlocked = useCallback(() => {
    setToolToast('Select a citation first')
    if (toolToastTimerRef.current) clearTimeout(toolToastTimerRef.current)
    toolToastTimerRef.current = setTimeout(() => setToolToast(null), 2500)
  }, [])

  const handleToolBlockedRef = useRef(handleToolBlocked)
  handleToolBlockedRef.current = handleToolBlocked

  // ── Place free point ──

  const handlePlaceFreePoint = useCallback(
    (worldX: number, worldY: number) => {
      // Snap to half-grid in given-setup mode
      const isGiven = editor.mode === 'given-setup'
      const x = isGiven ? Math.round(worldX * 2) / 2 : worldX
      const y = isGiven ? Math.round(worldY * 2) / 2 : worldY

      const result = addPoint(constructionRef.current, x, y, isGiven ? 'given' : 'free')
      constructionRef.current = result.state

      if (isGiven) {
        // Also add to givenElements for serialization
        editor.addGivenPointFromConstruction(result.point.id, result.point.label, x, y)
      } else {
        // Always record free point placement in authoring mode
        const action: SerializedAction = {
          type: 'intersection',
          ofA: 'free',
          ofB: 'free',
          label: result.point.label,
        }
        const citation = editor.activeCitation || ''
        const instruction = `Place point ${result.point.label}.`
        editor.addStep({ citation, instruction, action })
      }

      requestDraw()
    },
    [editor, requestDraw]
  )

  // ── Macro phase change sync ──

  const handleMacroPhaseChange = useCallback(
    (phase: MacroPhase) => {
      setMacroPhase(phase)
    },
    []
  )

  // ── Export handlers ──

  const handleCopyTypeScript = useCallback(() => {
    const proof = editor.serialize()
    const ts = exportPropositionDef(proof)
    navigator.clipboard.writeText(ts)
  }, [editor])

  const handleCopyClaudePrompt = useCallback(() => {
    const proof = editor.serialize()
    const prompt = generateClaudePrompt(proof)
    navigator.clipboard.writeText(prompt)
  }, [editor])

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
    onPlaceFreePoint: handlePlaceFreePoint,
    onMacroPhaseChange: handleMacroPhaseChange,
    requiresCitationRef: citationRequiredRef,
    onToolBlocked: handleToolBlocked,
  })

  // ── Move tool: drag given points in given-setup mode ──
  const updatePositionRef = useRef(editor.updateGivenPointPosition)
  updatePositionRef.current = editor.updateGivenPointPosition

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const HIT_RADIUS = 30
    let dragPointId: string | null = null

    function getCSSSize() {
      const dpr = window.devicePixelRatio || 1
      return { w: canvas!.width / dpr, h: canvas!.height / dpr }
    }

    function toWorld(sx: number, sy: number, w: number, h: number) {
      const vp = viewportRef.current
      return {
        x: (sx - w / 2) / vp.pixelsPerUnit + vp.center.x,
        y: -(sy - h / 2) / vp.pixelsPerUnit + vp.center.y,
      }
    }

    function hitTestPoints(sx: number, sy: number) {
      const vp = viewportRef.current
      const { w, h } = getCSSSize()
      let best: { id: string } | null = null
      let bestDist = Infinity
      for (const el of constructionRef.current.elements) {
        if (el.kind !== 'point') continue
        const screenX = (el.x - vp.center.x) * vp.pixelsPerUnit + w / 2
        const screenY = -(el.y - vp.center.y) * vp.pixelsPerUnit + h / 2
        const dist = Math.hypot(sx - screenX, sy - screenY)
        if (dist < HIT_RADIUS && dist < bestDist) {
          best = el
          bestDist = dist
        }
      }
      return best
    }

    function handlePointerDown(e: PointerEvent) {
      if (activeToolRef.current !== 'move') return
      if (pointerCapturedRef.current) return
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const hit = hitTestPoints(sx, sy)
      if (hit) {
        e.stopPropagation()
        e.preventDefault()
        dragPointId = hit.id
        pointerCapturedRef.current = true
        canvas!.style.cursor = 'grabbing'
        needsDrawRef.current = true
      }
    }

    function handlePointerMove(e: PointerEvent) {
      if (activeToolRef.current !== 'move') return
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()

      if (dragPointId) {
        e.stopPropagation()
        e.preventDefault()
        const world = toWorld(sx, sy, w, h)
        // Snap to half-grid like point placement
        const x = Math.round(world.x * 2) / 2
        const y = Math.round(world.y * 2) / 2
        // Update the point in constructionRef directly for immediate visual feedback
        constructionRef.current = {
          ...constructionRef.current,
          elements: constructionRef.current.elements.map((el) =>
            el.kind === 'point' && el.id === dragPointId ? { ...el, x, y } : el
          ),
        }
        // Sync to givenElements state (also enforces equality constraints)
        updatePositionRef.current(dragPointId, x, y)
        needsDrawRef.current = true
      } else {
        // Hover cursor
        const hit = hitTestPoints(sx, sy)
        canvas!.style.cursor = hit ? 'grab' : ''
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (!dragPointId) return
      e.stopPropagation()
      dragPointId = null
      pointerCapturedRef.current = false
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const hit = hitTestPoints(sx, sy)
      canvas!.style.cursor = hit ? 'grab' : ''
      needsDrawRef.current = true
    }

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    canvas.addEventListener('pointerup', handlePointerUp, { capture: true })
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
      canvas.removeEventListener('pointerup', handlePointerUp, { capture: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Extend tool (Post.2): three-click interaction ──
  // Kept as stable refs so the effect doesn't re-register listeners.
  const handleCommitExtendRef = useRef<
    (baseId: string, throughId: string, projX: number, projY: number) => void
  >(() => {})
  handleCommitExtendRef.current = (
    baseId: string,
    throughId: string,
    projX: number,
    projY: number
  ) => {
    // Calculate distance from through point to placed point
    const throughPt = getPoint(constructionRef.current, throughId)
    const distance = throughPt
      ? Math.sqrt((projX - throughPt.x) ** 2 + (projY - throughPt.y) ** 2)
      : 0

    // Create the new point
    const ptResult = addPoint(constructionRef.current, projX, projY, 'intersection')
    constructionRef.current = ptResult.state

    // Create the extension segment from throughId to new point
    const segResult = addSegment(constructionRef.current, throughId, ptResult.point.id)
    constructionRef.current = segResult.state

    // Find intersections for both the new point and segment
    const ptCandidates = findNewIntersections(
      constructionRef.current,
      ptResult.point,
      candidatesRef.current,
      false
    )
    const segCandidates = findNewIntersections(
      constructionRef.current,
      segResult.segment,
      [...candidatesRef.current, ...ptCandidates],
      false
    )
    candidatesRef.current = [...candidatesRef.current, ...ptCandidates, ...segCandidates]

    // Always record extend steps
    const action: SerializedAction = {
      type: 'extend',
      baseId,
      throughId,
      distance,
      label: ptResult.point.label,
    }
    const citation = editor.activeCitation || ''
    const instruction = editor.generateInstruction(citation, action)
    editor.addStep({ citation, instruction, action })

    needsDrawRef.current = true
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const HIT_RADIUS = 30

    function getCSSSize() {
      const dpr = window.devicePixelRatio || 1
      return { w: canvas!.width / dpr, h: canvas!.height / dpr }
    }

    function toWorld(sx: number, sy: number, cw: number, ch: number) {
      const v = viewportRef.current
      return screenToWorld2D(sx, sy, v.center.x, v.center.y, v.pixelsPerUnit, v.pixelsPerUnit, cw, ch)
    }

    function handlePointerDown(e: PointerEvent) {
      if (activeToolRef.current !== 'extend') return
      // Block extend gestures when no citation is active in authoring mode
      if (citationRequiredRef.current) {
        handleToolBlockedRef.current()
        return
      }
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const isTouch = e.pointerType === 'touch'
      const state = constructionRef.current
      const viewport = viewportRef.current
      const phase = extendPhaseRef.current

      const hitPt = hitTestPoints(sx, sy, state, viewport, w, h, isTouch)

      if (phase.tag === 'idle') {
        if (hitPt) {
          e.stopPropagation()
          extendPhaseRef.current = { tag: 'base-set', baseId: hitPt.id }
          needsDrawRef.current = true
        }
        return
      }

      if (phase.tag === 'base-set') {
        if (hitPt && hitPt.id !== phase.baseId) {
          e.stopPropagation()
          extendPhaseRef.current = { tag: 'extending', baseId: phase.baseId, throughId: hitPt.id }
          needsDrawRef.current = true
        }
        return
      }

      if (phase.tag === 'extending') {
        e.stopPropagation()
        const preview = extendPreviewRef.current
        if (preview) {
          handleCommitExtendRef.current(phase.baseId, phase.throughId, preview.x, preview.y)
        }
        extendPhaseRef.current = { tag: 'idle' }
        extendPreviewRef.current = null
        needsDrawRef.current = true
        return
      }
    }

    function handlePointerMove(e: PointerEvent) {
      if (activeToolRef.current !== 'extend') return
      const rect = canvas!.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const { w, h } = getCSSSize()
      const phase = extendPhaseRef.current

      if (phase.tag === 'extending') {
        const world = toWorld(sx, sy, w, h)
        const state = constructionRef.current
        const basePt = getPoint(state, phase.baseId)
        const throughPt = getPoint(state, phase.throughId)
        if (basePt && throughPt) {
          // Direction from base through "through" point
          const dx = throughPt.x - basePt.x
          const dy = throughPt.y - basePt.y
          const len = Math.sqrt(dx * dx + dy * dy)
          if (len > 0.001) {
            const dirX = dx / len
            const dirY = dy / len
            // Project cursor onto ray beyond throughPt
            const cx = world.x - throughPt.x
            const cy = world.y - throughPt.y
            const t = Math.max(0, cx * dirX + cy * dirY) // clamp to forward direction
            extendPreviewRef.current = {
              x: throughPt.x + dirX * t,
              y: throughPt.y + dirY * t,
            }
          }
        }
        canvas!.style.cursor = 'crosshair'
        needsDrawRef.current = true
        return
      }

      // For idle and base-set, show grab cursor over points
      const isTouch = e.pointerType === 'touch'
      const state = constructionRef.current
      const viewport = viewportRef.current
      const hitPt = hitTestPoints(sx, sy, state, viewport, w, h, isTouch)
      canvas!.style.cursor = hitPt ? 'pointer' : 'crosshair'
      needsDrawRef.current = true
    }

    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    canvas.addEventListener('pointermove', handlePointerMove, { capture: true })
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      canvas.removeEventListener('pointermove', handlePointerMove, { capture: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      // Keep animating when pointer is over canvas (tool overlay idle bob)
      if (pointerWorldRef.current && activeToolRef.current !== 'macro') {
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

          renderConstruction(
            ctx,
            constructionRef.current,
            viewportRef.current,
            cssWidth,
            cssHeight,
            compassPhaseRef.current,
            straightedgePhaseRef.current,
            pointerWorldRef.current,
            snappedPointIdRef.current,
            candidatesRef.current,
            constructionRef.current.nextColorIndex,
            null, // no candidate filter in editor
            false, // not complete
            undefined, // no result segments
            undefined // no hidden IDs
          )

          // Render ghost geometry
          if (ghostLayersRef.current.length > 0) {
            renderGhostGeometry(
              ctx,
              ghostLayersRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              hoveredMacroStepRef.current,
              ghostOpacitiesRef.current
            )
          }

          // Render equality marks
          if (factStoreRef.current.facts.length > 0) {
            renderEqualityMarks(
              ctx,
              constructionRef.current,
              viewportRef.current,
              cssWidth,
              cssHeight,
              factStoreRef.current
            )
          }

          // Render tool overlay
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
            false, // not complete
            null // no straightedge draw animation
          )

          // ── Extend tool preview ──
          const extPhase = extendPhaseRef.current
          const vp = viewportRef.current
          const cState = constructionRef.current

          if (extPhase.tag === 'base-set') {
            // Highlight the selected base point with a colored ring
            const basePt = getPoint(cState, extPhase.baseId)
            if (basePt) {
              const bs = worldToScreen2D(basePt.x, basePt.y, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, cssWidth, cssHeight)
              ctx.beginPath()
              ctx.arc(bs.x, bs.y, 10, 0, Math.PI * 2)
              ctx.strokeStyle = nextColor
              ctx.lineWidth = 2.5
              ctx.stroke()
            }
          }

          if (extPhase.tag === 'extending') {
            const basePt = getPoint(cState, extPhase.baseId)
            const throughPt = getPoint(cState, extPhase.throughId)
            const preview = extendPreviewRef.current
            if (basePt && throughPt) {
              const as = worldToScreen2D(basePt.x, basePt.y, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, cssWidth, cssHeight)
              const bs = worldToScreen2D(throughPt.x, throughPt.y, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, cssWidth, cssHeight)

              // Draw faint infinite ray from A through B
              const rdx = bs.x - as.x
              const rdy = bs.y - as.y
              const rlen = Math.sqrt(rdx * rdx + rdy * rdy)
              if (rlen > 0.1) {
                const extend = Math.max(cssWidth, cssHeight) * 2
                const rnx = rdx / rlen
                const rny = rdy / rlen
                ctx.beginPath()
                ctx.moveTo(as.x, as.y)
                ctx.lineTo(as.x + rnx * extend, as.y + rny * extend)
                ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
                ctx.lineWidth = 1
                ctx.stroke()
              }

              if (preview) {
                const ps = worldToScreen2D(preview.x, preview.y, vp.center.x, vp.center.y, vp.pixelsPerUnit, vp.pixelsPerUnit, cssWidth, cssHeight)

                // Dashed colored segment from B to projected cursor position
                ctx.beginPath()
                ctx.moveTo(bs.x, bs.y)
                ctx.lineTo(ps.x, ps.y)
                ctx.strokeStyle = nextColor
                ctx.lineWidth = 2
                ctx.setLineDash([8, 4])
                ctx.stroke()
                ctx.setLineDash([])

                // Small circle at projected cursor (point preview)
                ctx.beginPath()
                ctx.arc(ps.x, ps.y, 4, 0, Math.PI * 2)
                ctx.fillStyle = nextColor
                ctx.fill()
                ctx.beginPath()
                ctx.arc(ps.x, ps.y, 4, 0, Math.PI * 2)
                ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)'
                ctx.lineWidth = 1
                ctx.stroke()
              }

              // Highlight through point with ring
              ctx.beginPath()
              ctx.arc(bs.x, bs.y, 10, 0, Math.PI * 2)
              ctx.strokeStyle = nextColor
              ctx.lineWidth = 2
              ctx.setLineDash([4, 3])
              ctx.stroke()
              ctx.setLineDash([])
            }
          }

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

  // ── Tool change handler ──
  const handleToolChange = useCallback(
    (tool: ActiveTool) => {
      setActiveTool(tool)
      activeToolRef.current = tool
      // Reset phases on tool change
      compassPhaseRef.current = { tag: 'idle' }
      straightedgePhaseRef.current = { tag: 'idle' }
      extendPhaseRef.current = { tag: 'idle' }
      extendPreviewRef.current = null
      if (tool !== 'macro') {
        macroPhaseRef.current = { tag: 'idle' }
      }
      // Clear custom cursor when switching away from move/extend
      if (tool !== 'move' && tool !== 'extend' && canvasRef.current) {
        canvasRef.current.style.cursor = ''
      }
      requestDraw()
    },
    [requestDraw]
  )

  return (
    <div
      data-component="euclid-editor"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
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
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          data-element="euclid-editor-canvas"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            cursor:
              activeTool === 'move' || activeTool === 'extend'
                ? undefined
                : activeTool !== 'macro'
                  ? 'none'
                  : undefined,
          }}
        />

        {/* Tool toast */}
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
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#b45309',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'system-ui, sans-serif',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          >
            {toolToast}
          </div>
        )}

        {/* Undo reset toast */}
        {undoReset && (
          <div
            data-element="undo-reset-toast"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(30, 30, 30, 0.88)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              zIndex: 20,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            <span>Reset</span>
            <button
              data-action="undo-reset"
              onClick={undoReset}
              style={{
                padding: '3px 10px',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Undo
            </button>
          </div>
        )}

        {/* Tool selector */}
        <div
          data-element="tool-selector"
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
            zIndex: 10,
          }}
        >
          {editor.mode === 'authoring' && (
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
              onClick={() => handleToolChange('compass')}
            />
          )}
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
            onClick={() => handleToolChange('straightedge')}
          />
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
            onClick={() => handleToolChange('point')}
          />
          {editor.mode === 'given-setup' && (
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
              onClick={() => handleToolChange('move')}
            />
          )}
        </div>

        {/* Save status indicator */}
        <div
          data-element="save-status"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            fontSize: 11,
            fontFamily: 'system-ui, sans-serif',
            color: editor.saving ? '#f0c75e' : editor.dirty ? '#8b949e' : '#3fb950',
            zIndex: 10,
          }}
        >
          {editor.saving ? 'Saving...' : editor.dirty ? 'Unsaved changes' : 'Saved'}
        </div>
      </div>

      {/* ── Right pane: Editor panel ── */}
      <div
        data-element="editor-panel"
        style={{
          width: 380,
          minWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#FAFAF0',
          borderLeft: '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        {/* Proposition info */}
        <PropositionInfo
          propositionId={propositionId}
          authorNotes={editor.authorNotes}
          onAuthorNotesChange={editor.setAuthorNotes}
        />

        {/* Mode-specific content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {editor.mode === 'authoring' && (
            <>
              {/* Citation palette */}
              <CitationPalette
                propositionId={propositionId}
                activeCitation={editor.activeCitation}
                onSelect={handleCitationSelect}
                usedCitations={editor.steps.map((s) => s.citation)}
                onAddFactStep={handleAddFactStep}
              />

              {/* Step list */}
              <EditorStepList
                steps={editor.steps}
                proofFacts={editor.proofFacts}
                onUpdateInstruction={editor.updateStepInstruction}
                onUpdateNotes={editor.updateStepNotes}
                onDeleteLast={editor.deleteLastStep}
                onRewind={editor.rewindToStep}
              />
            </>
          )}

          {editor.mode === 'given-setup' && (
            <GivenSetupPanel
              givenElements={editor.givenElements}
              givenFacts={editor.givenFacts}
              onRenamePoint={editor.renameGivenPoint}
              onDeleteGivenElement={editor.deleteGivenElement}
              onAddGivenFact={editor.addGivenFact}
              onDeleteGivenFact={editor.deleteGivenFact}
              onStartProof={editor.startProof}
            />
          )}
        </div>

        {/* Bottom bar with mode controls */}
        <div
          data-element="editor-bottom-bar"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(203, 213, 225, 0.5)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <button
            data-action="start-fresh"
            onClick={() => {
              const snapshot = editor.captureFullState()
              editor.resetAll()
              // Clear any existing undo timer
              if (undoResetTimerRef.current) clearTimeout(undoResetTimerRef.current)
              // Offer undo for 8 seconds
              const restore = () => {
                editor.restoreFullState(snapshot)
                setUndoReset(null)
                if (undoResetTimerRef.current) clearTimeout(undoResetTimerRef.current)
                needsDrawRef.current = true
              }
              setUndoReset(() => restore)
              undoResetTimerRef.current = setTimeout(() => {
                setUndoReset(null)
              }, 8000)
              needsDrawRef.current = true
            }}
            title="Clear all given elements, steps, and notes"
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.04)',
              color: '#dc2626',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Start Fresh
          </button>
          {editor.mode === 'authoring' && (
            <>
              <button
                data-action="edit-given"
                onClick={editor.editGiven}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(203, 213, 225, 0.8)',
                  background: 'white',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Edit Given
              </button>
              <button
                data-action="copy-typescript"
                onClick={handleCopyTypeScript}
                disabled={editor.steps.length === 0}
                title="Copy generated PropDef TypeScript to clipboard"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  background: 'rgba(16, 185, 129, 0.06)',
                  color: editor.steps.length > 0 ? '#059669' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: editor.steps.length > 0 ? 'pointer' : 'default',
                }}
              >
                Copy TS
              </button>
              <button
                data-action="copy-claude-prompt"
                onClick={handleCopyClaudePrompt}
                disabled={editor.steps.length === 0}
                title="Copy Claude prompt with proof JSON + draft TypeScript"
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: '1px solid rgba(147, 51, 234, 0.5)',
                  background: 'rgba(147, 51, 234, 0.06)',
                  color: editor.steps.length > 0 ? '#7c3aed' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: editor.steps.length > 0 ? 'pointer' : 'default',
                }}
              >
                Copy Prompt
              </button>
              <button
                data-action="save"
                onClick={editor.save}
                disabled={editor.saving || !editor.dirty}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: editor.dirty ? '#4E79A7' : 'rgba(78, 121, 167, 0.3)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: editor.dirty ? 'pointer' : 'default',
                  marginLeft: 'auto',
                }}
              >
                {editor.saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
