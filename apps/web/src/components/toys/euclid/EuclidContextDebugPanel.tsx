'use client'

/**
 * Debug panel showing all context shared with voice and text chat.
 *
 * Only renders when Visual Debug is enabled (useVisualDebugSafe).
 * Positioned top-left, clear of chat (bottom-right) and ToyDebugPanel (bottom-right).
 */

import { useState, useEffect } from 'react'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { ConstructionState, ActiveTool, CompassPhase, StraightedgePhase, ExtendPhase, MacroPhase, PropositionStep } from './types'
import type { ProofFact } from './engine/facts'
import type { CallState } from '@/lib/voice/types'
import type { ConstructionNotifier, NotifierLogEntry } from './voice/useConstructionNotifier'
import {
  serializeConstructionGraph,
  serializeProofFacts,
  serializeToolState,
  type ToolStateInfo,
} from './voice/serializeProofState'

interface EuclidContextDebugPanelProps {
  constructionRef: React.RefObject<ConstructionState>
  proofFactsRef: React.RefObject<ProofFact[]>
  currentStepRef: React.RefObject<number>
  steps: PropositionStep[]
  isComplete: boolean
  activeToolRef: React.RefObject<ActiveTool>
  compassPhaseRef: React.RefObject<CompassPhase>
  straightedgePhaseRef: React.RefObject<StraightedgePhase>
  extendPhaseRef: React.RefObject<ExtendPhase>
  macroPhaseRef: React.RefObject<MacroPhase>
  dragPointIdRef: React.RefObject<string | null>
  pendingActionRef: React.RefObject<string | null>
  voiceState: CallState
  isSpeaking: boolean
  notifierRef: React.RefObject<ConstructionNotifier>
  chatMessageCount: number
}

const SECTION_STYLE: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
  paddingTop: 6,
  marginTop: 4,
}

const LABEL_STYLE: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  opacity: 0.5,
  marginBottom: 2,
  cursor: 'pointer',
  userSelect: 'none' as const,
}

const VALUE_STYLE: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1.4,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  maxHeight: 120,
  overflow: 'auto',
  fontFamily: 'monospace',
  opacity: 0.85,
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={SECTION_STYLE}>
      <div
        style={LABEL_STYLE}
        onClick={() => setOpen((p) => !p)}
        data-element="debug-section-header"
      >
        {open ? '\u25BE' : '\u25B8'} {title}
      </div>
      {open && <div style={VALUE_STYLE}>{children}</div>}
    </div>
  )
}

export function EuclidContextDebugPanel(props: EuclidContextDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [, setTick] = useState(0)

  // Re-render every 500ms to pick up ref changes
  useEffect(() => {
    if (!isVisualDebugEnabled) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [isVisualDebugEnabled])

  if (!isVisualDebugEnabled) return null

  const {
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
    pendingActionRef,
    voiceState,
    isSpeaking,
    notifierRef,
    chatMessageCount,
  } = props

  const emptyState = { elements: [], nextLabelIndex: 0, nextColorIndex: 0 } as ConstructionState
  const state = constructionRef.current ?? emptyState
  const facts = proofFactsRef.current ?? []
  const step = currentStepRef.current ?? 0

  const toolInfo: ToolStateInfo = {
    activeTool: activeToolRef.current ?? 'compass',
    compassPhase: compassPhaseRef.current ?? { tag: 'idle' },
    straightedgePhase: straightedgePhaseRef.current ?? { tag: 'idle' },
    extendPhase: extendPhaseRef.current ?? { tag: 'idle' },
    macroPhase: macroPhaseRef.current ?? { tag: 'idle' },
    dragPointId: dragPointIdRef.current ?? null,
  }

  const constructionText = serializeConstructionGraph(state)
  const toolText = serializeToolState(toolInfo, state, step, steps, isComplete)
  const factsText = serializeProofFacts(facts)
  const recentEvents = notifierRef.current?.recentEvents ?? []
  const pendingAction = pendingActionRef.current

  return (
    <div
      data-component="euclid-context-debug-panel"
      style={{
        position: 'fixed',
        top: 'calc(var(--app-nav-height, 56px) + 16px)',
        left: 16,
        zIndex: 9999,
        background: 'rgba(17,24,39,0.88)',
        backdropFilter: 'blur(8px)',
        borderRadius: 8,
        padding: '10px 14px',
        color: 'rgba(243,244,246,1)',
        fontSize: 11,
        minWidth: 220,
        maxWidth: 320,
        maxHeight: 'calc(100vh - var(--app-nav-height, 56px) - 32px)',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          opacity: 0.5,
        }}
      >
        Context Debug
      </div>

      {/* Voice Session */}
      <CollapsibleSection title="Voice Session" defaultOpen>
        <div>State: <strong>{voiceState}</strong></div>
        <div>Speaking: {isSpeaking ? 'yes' : 'no'}</div>
      </CollapsibleSection>

      {/* Last Action */}
      <CollapsibleSection title="Last Action" defaultOpen>
        {pendingAction ?? <span style={{ opacity: 0.4 }}>(none)</span>}
      </CollapsibleSection>

      {/* Construction State */}
      <CollapsibleSection title="Construction State">
        {constructionText}
      </CollapsibleSection>

      {/* Tool State */}
      <CollapsibleSection title="Tool State" defaultOpen>
        {toolText}
      </CollapsibleSection>

      {/* Proven Facts */}
      <CollapsibleSection title="Proven Facts">
        {factsText}
      </CollapsibleSection>

      {/* Text Chat Context */}
      <CollapsibleSection title="Text Chat">
        <div>Messages: {chatMessageCount}</div>
        <div>Pending action: {pendingAction ?? '(none)'}</div>
      </CollapsibleSection>

      {/* Push Log */}
      <CollapsibleSection title={`Push Log (${recentEvents.length})`}>
        {recentEvents.length === 0 ? (
          <span style={{ opacity: 0.4 }}>(no events yet)</span>
        ) : (
          recentEvents
            .slice()
            .reverse()
            .map((evt: NotifierLogEntry, i: number) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 2, marginBottom: 2 }}>
                <span style={{ opacity: 0.5 }}>{new Date(evt.timestamp).toLocaleTimeString()}</span>{' '}
                <span style={{ color: evt.type === 'construction' ? '#86efac' : evt.type === 'tool' ? '#93c5fd' : '#fcd34d' }}>
                  [{evt.type}]
                </span>{' '}
                {evt.action}
                {evt.delivered ? '' : <span style={{ color: '#f87171', marginLeft: 4 }}>(not delivered)</span>}
              </div>
            ))
        )}
      </CollapsibleSection>
    </div>
  )
}
