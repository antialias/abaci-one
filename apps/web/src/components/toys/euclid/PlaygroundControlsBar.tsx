import type { MutableRefObject } from 'react'
import type { SerializedElement } from './types'
import type { PostCompletionAction } from './engine/replayConstruction'

interface PlaygroundControlsBarProps {
  creationTitle: string
  setCreationTitle: (v: string) => void
  saveState: 'idle' | 'saving' | 'saved'
  handleSave: () => void
  shareState: 'idle' | 'sharing' | 'copied'
  handleShare: () => void
  creationId: string | null
  creationIsPublic: boolean
  handleNewCanvas: () => void
  givenSetup: { isActive: boolean; givenElements: SerializedElement[] }
  handleActivateGivenSetup: () => void
  handleStartGivenConstruction: () => void
  isAdmin: boolean
  setShowCreationsPanel: (v: boolean) => void
  postCompletionActionsRef: MutableRefObject<PostCompletionAction[]>
}

export function PlaygroundControlsBar({
  creationTitle,
  setCreationTitle,
  saveState,
  handleSave,
  shareState,
  handleShare,
  creationId,
  creationIsPublic,
  handleNewCanvas,
  givenSetup,
  handleActivateGivenSetup,
  handleStartGivenConstruction,
  isAdmin,
  setShowCreationsPanel,
  postCompletionActionsRef,
}: PlaygroundControlsBarProps) {
  return (
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
      {!givenSetup.isActive && (
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
      )}

      {/* New with Givens (admin only) */}
      {isAdmin && !givenSetup.isActive && (
        <button
          onClick={() => handleActivateGivenSetup()}
          title="New with custom givens"
          style={{
            padding: '7px 13px',
            borderRadius: 8,
            border: '1px solid rgba(203,213,225,0.9)',
            background: 'rgba(255,255,255,0.9)',
            color: '#4E79A7',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          + Givens
        </button>
      )}

      {/* Start Construction (given-setup mode) */}
      {givenSetup.isActive && (
        <button
          onClick={handleStartGivenConstruction}
          disabled={givenSetup.givenElements.filter((e) => e.kind === 'point').length < 2}
          style={{
            padding: '7px 13px',
            borderRadius: 8,
            border: 'none',
            background:
              givenSetup.givenElements.filter((e) => e.kind === 'point').length >= 2
                ? '#10b981'
                : '#e5e7eb',
            color:
              givenSetup.givenElements.filter((e) => e.kind === 'point').length >= 2
                ? '#fff'
                : '#9ca3af',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            cursor:
              givenSetup.givenElements.filter((e) => e.kind === 'point').length >= 2
                ? 'pointer'
                : 'default',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'background 0.2s',
          }}
        >
          Start Construction
        </button>
      )}

      {/* Save (draft) — hidden during given-setup */}
      {!givenSetup.isActive && (
        <button
          onClick={handleSave}
          disabled={saveState === 'saving' || postCompletionActionsRef.current.length === 0}
          title="Save draft"
          style={{
            padding: '7px 13px',
            borderRadius: 8,
            border: '1px solid rgba(203,213,225,0.9)',
            background: saveState === 'saved' ? 'rgba(16,185,129,0.9)' : 'rgba(255,255,255,0.9)',
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
              postCompletionActionsRef.current.length === 0 && saveState !== 'saved' ? 0.5 : 1,
            transition: 'background 0.2s, color 0.2s, opacity 0.2s',
          }}
        >
          {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
        </button>
      )}

      {/* Share / Copy link — only visible after first save */}
      {!givenSetup.isActive && creationId && (
        <button
          onClick={handleShare}
          disabled={shareState === 'sharing'}
          style={{
            padding: '7px 13px',
            borderRadius: 8,
            border: 'none',
            background: shareState === 'copied' ? '#10b981' : '#4E79A7',
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

      {/* My creations — hidden during given-setup */}
      {!givenSetup.isActive && (
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
      )}
    </div>
  )
}
