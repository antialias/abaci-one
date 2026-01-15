'use client'

import { useCallback, useState } from 'react'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import { css } from '../../../styled-system/css'

interface BroadcastDebugPanelProps {
  /** Whether the socket is connected */
  isConnected: boolean
  /** Whether actively broadcasting */
  isBroadcasting: boolean
  /** Whether vision recording is active */
  isRecording: boolean
  /** Session ID being broadcast */
  sessionId: string | undefined
  /** Player ID */
  playerId: string | undefined
  /** Recording ID if recording */
  recordingId: string | null
  /** Current broadcast state (stringified for display) */
  broadcastState: {
    currentProblem?: { terms: number[]; answer: number }
    phase?: string
    studentAnswer?: string
    isCorrect?: boolean | null
    currentProblemNumber?: number
    totalProblems?: number
    currentPartIndex?: number
    currentSlotIndex?: number
  } | null
  /** Last broadcast timestamp */
  lastBroadcastTime?: number
}

/**
 * Debug panel that shows socket broadcast state when visual debug mode is on.
 * Used on the student practice page to diagnose connection issues.
 */
export function BroadcastDebugPanel({
  isConnected,
  isBroadcasting,
  isRecording,
  sessionId,
  playerId,
  recordingId,
  broadcastState,
  lastBroadcastTime,
}: BroadcastDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed

  const debugData = {
    socket: {
      isConnected,
      isBroadcasting,
    },
    recording: {
      isRecording,
      recordingId,
    },
    identifiers: {
      sessionId: sessionId ?? null,
      playerId: playerId ?? null,
    },
    broadcastState: broadcastState
      ? {
          problem: broadcastState.currentProblem
            ? `${broadcastState.currentProblem.terms.join(' + ')} = ${broadcastState.currentProblem.answer}`
            : null,
          phase: broadcastState.phase ?? null,
          studentAnswer: broadcastState.studentAnswer ?? '',
          isCorrect: broadcastState.isCorrect ?? null,
          problemNumber: `${broadcastState.currentProblemNumber ?? '?'}/${broadcastState.totalProblems ?? '?'}`,
          position: `part ${broadcastState.currentPartIndex ?? '?'}, slot ${broadcastState.currentSlotIndex ?? '?'}`,
        }
      : null,
    lastBroadcast: lastBroadcastTime ? new Date(lastBroadcastTime).toLocaleTimeString() : null,
  }

  const debugJson = JSON.stringify(debugData, null, 2)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(debugJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = debugJson
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [debugJson])

  if (!isVisualDebugEnabled) {
    return null
  }

  // Status color
  const statusColor = isBroadcasting ? '#10b981' : isConnected ? '#eab308' : '#ef4444'
  const statusText = isBroadcasting
    ? 'Broadcasting'
    : isConnected
      ? 'Connected (not broadcasting)'
      : 'Disconnected'

  return (
    <div
      data-component="broadcast-debug-panel"
      className={css({
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        width: isCollapsed ? 'auto' : '320px',
        maxHeight: isCollapsed ? 'auto' : '350px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
        fontFamily: 'monospace',
        fontSize: '11px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
        })}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
          <span
            className={css({
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              flexShrink: 0,
            })}
            style={{ backgroundColor: statusColor }}
          />
          <span className={css({ fontWeight: 'bold', color: '#60a5fa' })}>
            Broadcast {isCollapsed ? `(${statusText})` : ''}
          </span>
        </div>
        <div className={css({ display: 'flex', gap: '8px' })}>
          {!isCollapsed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCopy()
              }}
              className={css({
                padding: '4px 8px',
                backgroundColor: copied ? '#22c55e' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 'bold',
                transition: 'background-color 0.2s',
                _hover: {
                  backgroundColor: copied ? '#16a34a' : '#2563eb',
                },
              })}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <span className={css({ color: 'gray.400' })}>{isCollapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div
          className={css({
            padding: '12px',
            overflowY: 'auto',
            maxHeight: '290px',
          })}
        >
          {/* Status summary */}
          <div
            className={css({
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
            })}
          >
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
              })}
            >
              <span
                className={css({
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  flexShrink: 0,
                })}
                style={{ backgroundColor: statusColor }}
              />
              <span className={css({ color: '#fbbf24', fontWeight: 'bold' })}>{statusText}</span>
            </div>

            <div className={css({ color: '#a3a3a3', fontSize: '10px' })}>
              <div>Session: {sessionId ? sessionId.slice(0, 12) + '...' : '(none)'}</div>
              <div>Player: {playerId ? playerId.slice(0, 12) + '...' : '(none)'}</div>
              {isRecording && (
                <div className={css({ color: '#f87171' })}>
                  Recording: {recordingId?.slice(0, 8) ?? 'active'}
                </div>
              )}
            </div>
          </div>

          {/* Current state */}
          {broadcastState && (
            <div
              className={css({
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              })}
            >
              <div
                className={css({
                  color: '#60a5fa',
                  fontWeight: 'bold',
                  marginBottom: '6px',
                })}
              >
                Current State
              </div>
              <div className={css({ color: '#d1d5db', fontSize: '10px' })}>
                <div>Phase: {broadcastState.phase ?? '—'}</div>
                <div>
                  Problem: {broadcastState.currentProblemNumber ?? '?'}/
                  {broadcastState.totalProblems ?? '?'}
                </div>
                <div>
                  Position: Part {(broadcastState.currentPartIndex ?? 0) + 1}, Slot{' '}
                  {(broadcastState.currentSlotIndex ?? 0) + 1}
                </div>
                <div>Answer: "{broadcastState.studentAnswer ?? ''}"</div>
                {broadcastState.isCorrect !== null && broadcastState.isCorrect !== undefined && (
                  <div
                    style={{
                      color: broadcastState.isCorrect ? '#4ade80' : '#f87171',
                    }}
                  >
                    Result: {broadcastState.isCorrect ? 'Correct' : 'Incorrect'}
                  </div>
                )}
              </div>
            </div>
          )}

          {lastBroadcastTime && (
            <div
              className={css({
                color: '#6b7280',
                fontSize: '10px',
                marginBottom: '8px',
              })}
            >
              Last broadcast: {new Date(lastBroadcastTime).toLocaleTimeString()}
            </div>
          )}

          {/* Full JSON */}
          <pre
            className={css({
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: '#a3e635',
              margin: 0,
              lineHeight: '1.4',
              fontSize: '9px',
            })}
          >
            {debugJson}
          </pre>
        </div>
      )}
    </div>
  )
}
