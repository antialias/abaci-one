/**
 * Hot/Cold Debug Panel
 *
 * Shows debugging information for the hot/cold feedback system.
 * Displays enable conditions, current state, and feedback type.
 *
 * Only renders when visual debug mode is enabled.
 */

'use client'

import { css } from '../../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

export interface HotColdDebugPanelProps {
  /** Whether assistance level allows hot/cold feedback */
  assistanceAllowsHotCold: boolean
  /** Current assistance level */
  assistanceLevel: string
  /** Whether user has hot/cold enabled */
  hotColdEnabled: boolean
  /** Whether device has fine pointer (desktop) */
  hasAnyFinePointer: boolean
  /** Whether magnifier is currently visible */
  showMagnifier: boolean
  /** Whether mobile map dragging is in progress */
  isMobileMapDragging: boolean
  /** Current game mode */
  gameMode?: 'cooperative' | 'race' | 'turn-based'
  /** Current player ID (for turn-based) */
  currentPlayer?: string | null
  /** Local player ID */
  localPlayerId?: string
  /** Current hot/cold feedback type */
  hotColdFeedbackType: string | null
  /** Current target region ID */
  currentPrompt: string | null
}

// ============================================================================
// Component
// ============================================================================

export function HotColdDebugPanel({
  assistanceAllowsHotCold,
  assistanceLevel,
  hotColdEnabled,
  hasAnyFinePointer,
  showMagnifier,
  isMobileMapDragging,
  gameMode,
  currentPlayer,
  localPlayerId,
  hotColdFeedbackType,
  currentPrompt,
}: HotColdDebugPanelProps) {
  const isEnabled =
    assistanceAllowsHotCold &&
    hotColdEnabled &&
    (hasAnyFinePointer || showMagnifier || isMobileMapDragging) &&
    (gameMode !== 'turn-based' || currentPlayer === localPlayerId)

  return (
    <div
      data-element="hot-cold-debug-panel"
      className={css({
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        fontSize: '11px',
        fontFamily: 'monospace',
        borderRadius: '6px',
        zIndex: 1000,
        maxWidth: '280px',
        lineHeight: 1.4,
      })}
    >
      <div
        className={css({
          fontWeight: 'bold',
          marginBottom: '6px',
          borderBottom: '1px solid #444',
          paddingBottom: '4px',
        })}
      >
        🔥 Hot/Cold Debug
      </div>

      {/* Enable conditions */}
      <div className={css({ marginBottom: '6px' })}>
        <div
          className={css({
            color: '#888',
            fontSize: '10px',
            marginBottom: '2px',
          })}
        >
          Enable Conditions:
        </div>
        <div style={{ color: assistanceAllowsHotCold ? '#4ade80' : '#f87171' }}>
          {assistanceAllowsHotCold ? '✓' : '✗'} Assistance allows: {assistanceLevel}
        </div>
        <div style={{ color: hotColdEnabled ? '#4ade80' : '#f87171' }}>
          {hotColdEnabled ? '✓' : '✗'} User toggle: {hotColdEnabled ? 'ON' : 'OFF'}
        </div>
        <div style={{ color: hasAnyFinePointer ? '#4ade80' : '#f87171' }}>
          {hasAnyFinePointer ? '✓' : '✗'} Fine pointer (desktop)
        </div>
        <div style={{ color: showMagnifier ? '#4ade80' : '#f87171' }}>
          {showMagnifier ? '✓' : '✗'} Magnifier active
        </div>
        <div style={{ color: isMobileMapDragging ? '#4ade80' : '#f87171' }}>
          {isMobileMapDragging ? '✓' : '✗'} Mobile dragging
        </div>
        {gameMode === 'turn-based' && (
          <div
            style={{
              color: currentPlayer === localPlayerId ? '#4ade80' : '#f87171',
            }}
          >
            {currentPlayer === localPlayerId ? '✓' : '✗'} Is my turn
          </div>
        )}
      </div>

      {/* Overall status */}
      <div
        className={css({
          padding: '4px 8px',
          borderRadius: '4px',
          marginBottom: '6px',
        })}
        style={{
          background: isEnabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
        }}
      >
        <strong>Status: </strong>
        {isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}
      </div>

      {/* Current feedback */}
      <div>
        <span style={{ color: '#888' }}>Current feedback: </span>
        <span style={{ color: '#fbbf24' }}>{hotColdFeedbackType || 'none'}</span>
      </div>

      {/* Target info */}
      <div style={{ marginTop: '4px' }}>
        <span style={{ color: '#888' }}>Target region: </span>
        <span>{currentPrompt || 'none'}</span>
      </div>
    </div>
  )
}
