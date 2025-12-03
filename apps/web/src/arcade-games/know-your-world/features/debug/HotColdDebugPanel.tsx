/**
 * HotColdDebugPanel Component
 *
 * Debug panel showing hot/cold feedback enable conditions and current state.
 * Only visible when visual debug mode is enabled.
 */

'use client'

import { memo } from 'react'
import type { FeedbackType } from '../../utils/hotColdPhrases'

// ============================================================================
// Types
// ============================================================================

export interface HotColdDebugPanelProps {
  /** Whether visual debug is enabled */
  visible: boolean
  /** Current assistance level ID */
  assistanceLevel: string
  /** Whether assistance allows hot/cold */
  assistanceAllowsHotCold: boolean
  /** Whether user has enabled hot/cold */
  hotColdEnabled: boolean
  /** Whether device has fine pointer */
  hasAnyFinePointer: boolean
  /** Whether magnifier is showing */
  showMagnifier: boolean
  /** Whether mobile map drag is active */
  isMobileMapDragging: boolean
  /** Current game mode */
  gameMode: 'cooperative' | 'race' | 'turn-based' | undefined
  /** Current player ID (for turn-based) */
  currentPlayer: string | null | undefined
  /** Local player ID */
  localPlayerId: string | null | undefined
  /** Current hot/cold feedback type */
  hotColdFeedbackType: FeedbackType | null
  /** Current prompt/target region */
  currentPrompt: string | null
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders a debug panel showing hot/cold feedback conditions and state.
 */
export const HotColdDebugPanel = memo(function HotColdDebugPanel({
  visible,
  assistanceLevel,
  assistanceAllowsHotCold,
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
  if (!visible) return null

  const isEnabled =
    assistanceAllowsHotCold &&
    hotColdEnabled &&
    (hasAnyFinePointer || showMagnifier || isMobileMapDragging) &&
    (gameMode !== 'turn-based' || currentPlayer === localPlayerId)

  return (
    <div
      data-element="hot-cold-debug-panel"
      style={{
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
      }}
    >
      <div
        style={{
          fontWeight: 'bold',
          marginBottom: '6px',
          borderBottom: '1px solid #444',
          paddingBottom: '4px',
        }}
      >
        🔥 Hot/Cold Debug
      </div>

      {/* Enable conditions */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ color: '#888', fontSize: '10px', marginBottom: '2px' }}>
          Enable Conditions:
        </div>
        <ConditionRow
          condition={assistanceAllowsHotCold}
          label={`Assistance allows: ${assistanceLevel}`}
        />
        <ConditionRow
          condition={hotColdEnabled}
          label={`User toggle: ${hotColdEnabled ? 'ON' : 'OFF'}`}
        />
        <ConditionRow condition={hasAnyFinePointer} label="Fine pointer (desktop)" />
        <ConditionRow condition={showMagnifier} label="Magnifier active" />
        <ConditionRow condition={isMobileMapDragging} label="Mobile dragging" />
        {gameMode === 'turn-based' && (
          <ConditionRow condition={currentPlayer === localPlayerId} label="Is my turn" />
        )}
      </div>

      {/* Overall status */}
      <div
        style={{
          padding: '4px 8px',
          borderRadius: '4px',
          background: isEnabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)',
          marginBottom: '6px',
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
})

// ============================================================================
// Helper Components
// ============================================================================

function ConditionRow({ condition, label }: { condition: boolean; label: string }) {
  return (
    <div style={{ color: condition ? '#4ade80' : '#f87171' }}>
      {condition ? '✓' : '✗'} {label}
    </div>
  )
}
