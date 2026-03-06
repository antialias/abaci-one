import type { MutableRefObject } from 'react'
import type { PropositionDef, SerializedElement, SerializedEqualityFact } from './types'
import type { PostCompletionAction } from './engine/replayConstruction'

interface AdminExportBarProps {
  propositionIdInput: number
  setPropositionIdInput: (v: number) => void
  handleExportTypeScript: () => void
  handleExportClaudePrompt: () => void
  exportCopied: 'ts' | 'claude' | null
  dynamicPropositionRef: MutableRefObject<PropositionDef | null>
  handleActivateGivenSetup: (els?: SerializedElement[], facts?: SerializedEqualityFact[]) => void
  postCompletionActionsRef: MutableRefObject<PostCompletionAction[]>
}

export function AdminExportBar({
  propositionIdInput,
  setPropositionIdInput,
  handleExportTypeScript,
  handleExportClaudePrompt,
  exportCopied,
  dynamicPropositionRef,
  handleActivateGivenSetup,
  postCompletionActionsRef,
}: AdminExportBarProps) {
  return (
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
      <span style={{ color: '#9ca3af' }}>Prop ID:</span>
      <input
        type="number"
        value={propositionIdInput}
        onChange={(e) => setPropositionIdInput(Number(e.target.value) || 0)}
        style={{
          width: 40,
          padding: '2px 4px',
          fontSize: 11,
          borderRadius: 4,
          border: '1px solid #d1d5db',
          textAlign: 'center',
        }}
      />
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
      {dynamicPropositionRef.current && (
        <button
          onClick={() => {
            const dynProp = dynamicPropositionRef.current
            if (!dynProp) return
            // Warn if there are actions that will be lost
            if (
              postCompletionActionsRef.current.length > 0 &&
              !window.confirm('Editing givens will discard your construction actions. Continue?')
            ) {
              return
            }
            // Re-enter given-setup with existing elements/facts
            const serializedElements = dynProp.givenElements.map(
              (el): SerializedElement => ({
                kind: el.kind,
                id: el.id,
                label: el.kind === 'point' ? el.label : undefined,
                x: el.kind === 'point' ? el.x : undefined,
                y: el.kind === 'point' ? el.y : undefined,
                fromId: el.kind === 'segment' ? el.fromId : undefined,
                toId: el.kind === 'segment' ? el.toId : undefined,
                centerId: el.kind === 'circle' ? el.centerId : undefined,
                radiusPointId: el.kind === 'circle' ? el.radiusPointId : undefined,
                color: el.color,
                origin: el.origin,
              })
            )
            handleActivateGivenSetup(serializedElements, dynProp.givenFacts)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#4E79A7',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Edit Givens
        </button>
      )}
    </div>
  )
}
