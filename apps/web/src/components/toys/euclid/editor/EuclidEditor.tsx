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
  ExpectedAction,
  GhostLayer,
  SerializedAction,
} from '../types'
import { BYRNE_CYCLE } from '../types'
import { initializeGiven, addPoint, addCircle, addSegment, getPoint } from '../engine/constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from '../engine/intersections'
import { renderConstruction } from '../render/renderConstruction'
import { renderToolOverlay, getFriction } from '../render/renderToolOverlay'
import { renderEqualityMarks } from '../render/renderEqualityMarks'
import { renderGhostGeometry } from '../render/renderGhostGeometry'
import { renderProductionSegments } from '../render/renderProductionSegments'
import { useEuclidTouch } from '../interaction/useEuclidTouch'
import { useToolInteraction } from '../interaction/useToolInteraction'
import { createFactStore } from '../engine/factStore'
import type { FactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { deriveDef15Facts } from '../engine/factDerivation'
import { MACRO_REGISTRY } from '../engine/macros'
import { CITATIONS } from '../engine/citations'
import { useEditorState } from './useEditorState'
import { CitationPalette } from './CitationPalette'
import { EditorStepList } from './EditorStepList'
import { PropositionInfo } from './PropositionInfo'
import { GivenSetup } from './GivenSetup'
import { PROPOSITION_REFS } from './propositionReference'

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

// ── Main editor ──

interface EuclidEditorProps {
  propositionId: number
}

export function EuclidEditor({ propositionId }: EuclidEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Core refs (same pattern as EuclidCanvas)
  const viewportRef = useRef<EuclidViewportState>({ center: { x: 0, y: 0 }, pixelsPerUnit: 50 })
  const constructionRef = useRef<ConstructionState>({ elements: [], nextLabelIndex: 0, nextColorIndex: 0 })
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
  const factStoreRef = useRef<FactStore>(createFactStore())
  const panZoomDisabledRef = useRef(false) // pan/zoom enabled by default in editor
  const ghostLayersRef = useRef<GhostLayer[]>([])
  const ghostOpacitiesRef = useRef<Map<string, number>>(new Map())
  const hoveredMacroStepRef = useRef<number | null>(null)
  const editorModeRef = useRef<'given-setup' | 'authoring'>('given-setup')

  // React state for UI
  const [activeTool, setActiveTool] = useState<ActiveTool>('compass')
  const [toolToast, setToolToast] = useState<string | null>(null)
  const toolToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Sync editor mode to ref (for RAF loop)
  useEffect(() => {
    editorModeRef.current = editor.mode
    needsDrawRef.current = true
  }, [editor.mode])

  // Load saved proof on mount
  useEffect(() => {
    editor.load().then(data => {
      if (data && data.givenElements.length > 0 && data.steps.length > 0) {
        // Replay steps will be done in Phase 4 (for now, just initialize given)
        editor.initializeConstruction()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Citation-to-tool mapping ──

  const handleCitationSelect = useCallback((citation: string) => {
    editor.setActiveCitation(citation)

    // Map citation to tool
    if (citation === 'Post.1' || citation === 'Post.2') {
      setActiveTool('straightedge')
      activeToolRef.current = 'straightedge'
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
  }, [editor, requestDraw])

  // ── Commit handlers (editor versions) ──

  const handleCommitCircle = useCallback(
    (centerId: string, radiusPointId: string) => {
      const result = addCircle(constructionRef.current, centerId, radiusPointId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.circle,
        candidatesRef.current,
        false,
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // If we have an active citation, record the step
      if (editor.activeCitation) {
        const action: SerializedAction = { type: 'compass', centerId, radiusPointId }
        const instruction = editor.generateInstruction(editor.activeCitation, action)
        editor.addStep({
          citation: editor.activeCitation,
          instruction,
          action,
        })
      }

      requestDraw()
    },
    [editor, requestDraw],
  )

  const handleCommitSegment = useCallback(
    (fromId: string, toId: string) => {
      const result = addSegment(constructionRef.current, fromId, toId)
      constructionRef.current = result.state

      const newCandidates = findNewIntersections(
        result.state,
        result.segment,
        candidatesRef.current,
        false,
      )
      candidatesRef.current = [...candidatesRef.current, ...newCandidates]

      // If we have an active citation, record the step
      if (editor.activeCitation) {
        const action: SerializedAction = { type: 'straightedge', fromId, toId }
        const instruction = editor.generateInstruction(editor.activeCitation, action)
        editor.addStep({
          citation: editor.activeCitation,
          instruction,
          action,
        })
      }

      requestDraw()
    },
    [editor, requestDraw],
  )

  const handleMarkIntersection = useCallback(
    (candidate: IntersectionCandidate) => {
      const currentStep = editor.steps.length
      const result = addPoint(
        constructionRef.current,
        candidate.x,
        candidate.y,
        'intersection',
      )
      constructionRef.current = result.state

      candidatesRef.current = candidatesRef.current.filter(
        c => !(Math.abs(c.x - candidate.x) < 0.001 && Math.abs(c.y - candidate.y) < 0.001),
      )

      // Derive Def.15 facts
      const newFacts = deriveDef15Facts(
        candidate,
        result.point.id,
        constructionRef.current,
        factStoreRef.current,
        currentStep,
      )
      if (newFacts.length > 0) {
        editor.updateProofFacts(newFacts)
      }

      // Record as a step if we have a citation, or as an intersection sub-step
      if (editor.activeCitation) {
        const action: SerializedAction = {
          type: 'intersection',
          ofA: candidate.ofA,
          ofB: candidate.ofB,
          label: result.point.label,
        }
        const instruction = editor.generateInstruction(editor.activeCitation, action)
        editor.addStep({
          citation: editor.activeCitation,
          instruction,
          action,
        })
      }

      requestDraw()
    },
    [editor, requestDraw],
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
        false,
      )

      constructionRef.current = result.state
      candidatesRef.current = result.candidates
      if (result.newFacts.length > 0) {
        editor.updateProofFacts(result.newFacts)
      }

      const macroGhosts = result.ghostLayers.map(gl => ({ ...gl, atStep: currentStep }))
      if (macroGhosts.length > 0) {
        ghostLayersRef.current = [...ghostLayersRef.current, ...macroGhosts]
      }

      // Record step
      if (editor.activeCitation) {
        const action: SerializedAction = { type: 'macro', propId, inputPointIds }
        const instruction = editor.generateInstruction(editor.activeCitation, action)
        editor.addStep({
          citation: editor.activeCitation,
          instruction,
          action,
        })
      }

      requestDraw()
    },
    [editor, requestDraw],
  )

  // ── Fact-only step submission ──

  const handleAddFactStep = useCallback((citation: string, instruction: string) => {
    editor.addStep({
      citation,
      instruction,
      action: { type: 'fact-only' },
    })
  }, [editor])

  // ── Hook up pan/zoom ──
  useEuclidTouch({
    viewportRef,
    canvasRef,
    pointerCapturedRef,
    onViewportChange: requestDraw,
    panZoomDisabledRef,
  })

  // ── Hook up tool interaction (disabled during given-setup) ──
  const toolDisabledRef = useRef(true)
  useEffect(() => {
    toolDisabledRef.current = editor.mode === 'given-setup'
  }, [editor.mode])

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
    disabledRef: toolDisabledRef,
  })

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

      // In given-setup mode, GivenSetup handles all canvas drawing
      if (editorModeRef.current === 'given-setup') {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

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
            null,  // no candidate filter in editor
            false, // not complete
            undefined, // no result segments
            undefined, // no hidden IDs
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
              ghostOpacitiesRef.current,
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
              factStoreRef.current,
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
            null,  // no straightedge draw animation
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

  // ── Tool change handler ──
  const handleToolChange = useCallback((tool: ActiveTool) => {
    setActiveTool(tool)
    activeToolRef.current = tool
    // Reset phases on tool change
    compassPhaseRef.current = { tag: 'idle' }
    straightedgePhaseRef.current = { tag: 'idle' }
    if (tool !== 'macro') {
      macroPhaseRef.current = { tag: 'idle' }
    }
    requestDraw()
  }, [requestDraw])

  return (
    <div
      data-component="euclid-editor"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
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
            cursor: editor.mode === 'authoring' && activeTool !== 'macro' ? 'none' : undefined,
          }}
        />

        {/* Given setup overlay */}
        {editor.mode === 'given-setup' && (
          <GivenSetup
            givenElements={editor.givenElements}
            onAddPoint={editor.addGivenPoint}
            onAddSegment={editor.addGivenSegment}
            onMovePoint={editor.updateGivenPointPosition}
            onRenamePoint={editor.renameGivenPoint}
            onStartProof={editor.startProof}
            canvasRef={canvasRef}
            viewportRef={viewportRef}
            constructionRef={constructionRef}
            needsDrawRef={needsDrawRef}
          />
        )}

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

        {/* Tool selector (visible in authoring mode) */}
        {editor.mode === 'authoring' && (
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
            <ToolButton
              label="Compass"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <path d="M12 6l-4 14" />
                  <path d="M12 6l4 14" />
                  <path d="M6 18a6 6 0 0 0 12 0" />
                </svg>
              }
              active={activeTool === 'compass'}
              onClick={() => handleToolChange('compass')}
            />
            <ToolButton
              label="Straightedge"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="20" x2="20" y2="4" />
                </svg>
              }
              active={activeTool === 'straightedge'}
              onClick={() => handleToolChange('straightedge')}
            />
          </div>
        )}

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
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {editor.mode === 'authoring' && (
            <>
              {/* Citation palette */}
              <CitationPalette
                propositionId={propositionId}
                activeCitation={editor.activeCitation}
                onSelect={handleCitationSelect}
                usedCitations={editor.steps.map(s => s.citation)}
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
            <div style={{ padding: '16px 20px', fontSize: 13, color: '#475569', fontFamily: 'Georgia, serif' }}>
              Click on the canvas to place given points. Click two existing points to create a segment between them.
              When ready, click &ldquo;Start Proof&rdquo; to begin authoring.
            </div>
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
