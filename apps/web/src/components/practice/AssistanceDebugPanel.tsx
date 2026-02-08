'use client'

import { useState } from 'react'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'
import { DebugMermaidDiagram } from '../flowchart/DebugMermaidDiagram'
import type { AssistanceMachineState, AssistanceEventLogEntry } from './hooks/useProgressiveAssistance'

interface AssistanceDebugPanelProps {
  machineState: AssistanceMachineState
}

const STATE_DIAGRAM_MERMAID = `stateDiagram-v2
    [*] --> idle
    idle --> encouraging: TIMER_ENCOURAGEMENT
    idle --> offeringHelp: WRONG_ANSWER×3
    idle --> inHelp: HELP_ENTERED
    encouraging --> offeringHelp: TIMER_HELP_OFFER
    encouraging --> idle: DIGIT_TYPED
    encouraging --> inHelp: HELP_ENTERED
    offeringHelp --> autoPaused: TIMER_AUTO_PAUSE
    offeringHelp --> idle: DIGIT_TYPED
    offeringHelp --> inHelp: HELP_ENTERED
    autoPaused --> idle: RESUMED
    inHelp --> idle: HELP_EXITED
    inHelp --> idle: DIGIT_TYPED`

const STATE_COLORS: Record<string, string> = {
  idle: '#94a3b8',
  encouraging: '#60a5fa',
  offeringHelp: '#f59e0b',
  autoPaused: '#ef4444',
  inHelp: '#a78bfa',
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AssistanceDebugPanel({ machineState }: AssistanceDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (!isVisualDebugEnabled) return null

  const { state, context } = machineState
  const idleElapsed = Date.now() - context.idleStartedAt
  const stateColor = STATE_COLORS[state] || '#94a3b8'

  return (
    <div
      data-component="assistance-debug-panel"
      className={css({
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        color: 'gray.200',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'gray.700',
        fontSize: '0.6875rem',
        fontFamily: 'monospace',
        maxWidth: '380px',
        maxHeight: isCollapsed ? 'auto' : '500px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      })}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: isCollapsed ? 'none' : '1px solid',
          borderColor: 'gray.700',
          cursor: 'pointer',
          color: 'gray.200',
          fontSize: '0.6875rem',
          fontFamily: 'monospace',
          textAlign: 'left',
        })}
      >
        <span>{isCollapsed ? '▶' : '▼'}</span>
        <span style={{ fontWeight: 600 }}>Assistance</span>
        <span
          style={{
            backgroundColor: stateColor,
            color: '#0f172a',
            padding: '1px 6px',
            borderRadius: '4px',
            fontWeight: 700,
            fontSize: '0.625rem',
          }}
        >
          {state}
        </span>
      </button>

      {!isCollapsed && (
        <div
          className={css({
            overflow: 'auto',
            maxHeight: '460px',
          })}
        >
          {/* State Diagram */}
          <div
            className={css({
              padding: '0.5rem',
              borderBottom: '1px solid',
              borderColor: 'gray.700',
            })}
          >
            <div className={css({ fontSize: '0.625rem', color: 'gray.500', marginBottom: '0.25rem' })}>
              STATE DIAGRAM
            </div>
            <div className={css({ maxHeight: '180px', overflow: 'auto' })}>
              <DebugMermaidDiagram
                mermaidContent={STATE_DIAGRAM_MERMAID}
                currentNodeId={state}
              />
            </div>
          </div>

          {/* Context Inspector */}
          <div
            className={css({
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid',
              borderColor: 'gray.700',
            })}
          >
            <div className={css({ fontSize: '0.625rem', color: 'gray.500', marginBottom: '0.25rem' })}>
              CONTEXT
            </div>
            <table className={css({ width: '100%', borderCollapse: 'collapse' })}>
              <tbody>
                <ContextRow label="Wrong attempts" value={`${context.wrongAttemptCount} / ${context.wrongAnswerThreshold}`} />
                <ContextRow
                  label="Helped terms"
                  value={`{${[...context.helpedTermIndices].join(', ')}} (${context.helpedTermIndices.size})`}
                />
                <ContextRow
                  label="Move on"
                  value={
                    context.moveOnAvailable
                      ? 'available'
                      : context.moveOnGraceStartedAt
                        ? `grace: ${formatElapsed(Date.now() - context.moveOnGraceStartedAt)} / ${formatElapsed(context.moveOnGraceMs)}`
                        : 'locked'
                  }
                />
                <ContextRow label="Idle elapsed" value={formatElapsed(idleElapsed)} />
                <ContextRow
                  label="Thresholds"
                  value={`enc: ${formatElapsed(context.thresholds.encouragementMs)} | help: ${formatElapsed(context.thresholds.helpOfferMs)} | pause: ${formatElapsed(context.thresholds.autoPauseMs)}`}
                />
              </tbody>
            </table>

            {/* Threshold progress bar */}
            <div
              className={css({
                marginTop: '0.375rem',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: 'gray.800',
                position: 'relative',
                overflow: 'hidden',
              })}
            >
              {/* Green segment: 0 → encouragement */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${Math.min(100, (context.thresholds.encouragementMs / context.thresholds.autoPauseMs) * 100)}%`,
                  backgroundColor: '#22c55e',
                  opacity: 0.3,
                }}
              />
              {/* Yellow segment: encouragement → helpOffer */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(context.thresholds.encouragementMs / context.thresholds.autoPauseMs) * 100}%`,
                  top: 0,
                  height: '100%',
                  width: `${((context.thresholds.helpOfferMs - context.thresholds.encouragementMs) / context.thresholds.autoPauseMs) * 100}%`,
                  backgroundColor: '#f59e0b',
                  opacity: 0.3,
                }}
              />
              {/* Red segment: helpOffer → autoPause */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(context.thresholds.helpOfferMs / context.thresholds.autoPauseMs) * 100}%`,
                  top: 0,
                  height: '100%',
                  width: `${((context.thresholds.autoPauseMs - context.thresholds.helpOfferMs) / context.thresholds.autoPauseMs) * 100}%`,
                  backgroundColor: '#ef4444',
                  opacity: 0.3,
                }}
              />
              {/* Progress indicator */}
              <div
                style={{
                  position: 'absolute',
                  left: `${Math.min(100, (idleElapsed / context.thresholds.autoPauseMs) * 100)}%`,
                  top: 0,
                  width: '2px',
                  height: '100%',
                  backgroundColor: 'white',
                  transition: 'left 0.5s linear',
                }}
              />
            </div>
          </div>

          {/* Event Log */}
          <div className={css({ padding: '0.5rem 0.75rem' })}>
            <div className={css({ fontSize: '0.625rem', color: 'gray.500', marginBottom: '0.25rem' })}>
              EVENT LOG ({context.eventLog.length})
            </div>
            <div
              className={css({
                maxHeight: '120px',
                overflow: 'auto',
              })}
            >
              {context.eventLog.length === 0 ? (
                <div className={css({ color: 'gray.600', fontStyle: 'italic' })}>No events yet</div>
              ) : (
                context.eventLog.map((entry, i) => (
                  <EventLogRow key={`${entry.timestamp}-${i}`} entry={entry} />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className={css({ color: 'gray.500', paddingRight: '0.5rem', paddingY: '1px', whiteSpace: 'nowrap' })}>
        {label}
      </td>
      <td className={css({ color: 'gray.200', paddingY: '1px' })}>{value}</td>
    </tr>
  )
}

function EventLogRow({ entry }: { entry: AssistanceEventLogEntry }) {
  const transitionChanged = entry.fromState !== entry.toState

  return (
    <div
      className={css({
        display: 'flex',
        gap: '0.5rem',
        paddingY: '1px',
        fontSize: '0.625rem',
        lineHeight: 1.4,
        borderBottom: '1px solid',
        borderColor: 'gray.800',
      })}
    >
      <span className={css({ color: 'gray.600', whiteSpace: 'nowrap' })}>
        {formatTimestamp(entry.timestamp)}
      </span>
      <span className={css({ color: 'cyan.400', minWidth: '100px' })}>
        {entry.event}
      </span>
      <span className={css({ color: transitionChanged ? 'yellow.400' : 'gray.600' })}>
        {entry.fromState} → {entry.toState}
      </span>
      {entry.note && (
        <span className={css({ color: 'gray.500' })}>({entry.note})</span>
      )}
    </div>
  )
}
