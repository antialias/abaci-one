'use client'

import { useCallback, useState } from 'react'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type {
  DvrBufferInfo,
  ObservedSessionState,
  ObservedVisionFrame,
} from '@/hooks/useSessionObserver'
import { css } from '../../../styled-system/css'

interface ObserverDebugPanelProps {
  /** Whether the socket is connected */
  isConnected: boolean
  /** Whether actively observing */
  isObserving: boolean
  /** Whether showing live or scrubbed */
  isLive: boolean
  /** Session ID being observed */
  sessionId: string | undefined
  /** Observer ID */
  observerId: string
  /** Error message if any */
  error: string | null
  /** Observed practice state */
  state: ObservedSessionState | null
  /** Vision frame info (without image data) */
  visionFrame: ObservedVisionFrame | null
  /** DVR buffer info */
  dvrBufferInfo: DvrBufferInfo | null
  /** Number of accumulated results */
  resultsCount: number
}

/**
 * Debug panel that shows socket observer state when visual debug mode is on.
 * Used on the observer page to diagnose connection issues.
 */
export function ObserverDebugPanel({
  isConnected,
  isObserving,
  isLive,
  sessionId,
  observerId,
  error,
  state,
  visionFrame,
  dvrBufferInfo,
  resultsCount,
}: ObserverDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed

  const debugData = {
    socket: {
      isConnected,
      isObserving,
      isLive,
      error,
    },
    identifiers: {
      sessionId: sessionId ?? null,
      observerId,
    },
    observedState: state
      ? {
          problem: `${state.currentProblem.terms.join(' + ')} = ${state.currentProblem.answer}`,
          phase: state.phase,
          studentAnswer: state.studentAnswer,
          isCorrect: state.isCorrect,
          problemNumber: `${state.currentProblemNumber}/${state.totalProblems}`,
          position:
            state.currentPartIndex !== undefined
              ? `part ${state.currentPartIndex}, slot ${state.currentSlotIndex ?? '?'}`
              : null,
          receivedAt: new Date(state.receivedAt).toLocaleTimeString(),
        }
      : null,
    vision: visionFrame
      ? {
          detectedValue: visionFrame.detectedValue,
          confidence: Math.round(visionFrame.confidence * 100) + '%',
          receivedAt: new Date(visionFrame.receivedAt).toLocaleTimeString(),
        }
      : null,
    dvr: dvrBufferInfo
      ? {
          availableRange: `${dvrBufferInfo.availableFromMs}ms - ${dvrBufferInfo.availableToMs}ms`,
          currentProblem: dvrBufferInfo.currentProblemNumber,
          problemStartMs: dvrBufferInfo.currentProblemStartMs,
        }
      : null,
    resultsCount,
  }

  const debugJson = JSON.stringify(debugData, null, 2)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(debugJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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
  const statusColor = isObserving
    ? '#10b981'
    : isConnected
      ? '#eab308'
      : error
        ? '#ef4444'
        : '#6b7280'
  const statusText = isObserving
    ? isLive
      ? 'Observing (live)'
      : 'Observing (scrubbed)'
    : isConnected
      ? 'Connected (waiting)'
      : error
        ? 'Error'
        : 'Disconnected'

  return (
    <div
      data-component="observer-debug-panel"
      className={css({
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        width: isCollapsed ? 'auto' : '320px',
        maxHeight: isCollapsed ? 'auto' : '400px',
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
          <span className={css({ fontWeight: 'bold', color: '#f472b6' })}>
            Observer {isCollapsed ? `(${statusText})` : ''}
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
            maxHeight: '340px',
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
              <div>Observer: {observerId.slice(0, 12)}...</div>
              <div>Results collected: {resultsCount}</div>
            </div>

            {error && (
              <div
                className={css({
                  color: '#f87171',
                  fontSize: '10px',
                  marginTop: '6px',
                  padding: '4px',
                  backgroundColor: 'rgba(248, 113, 113, 0.1)',
                  borderRadius: '4px',
                })}
              >
                Error: {error}
              </div>
            )}
          </div>

          {/* Observed state */}
          {state && (
            <div
              className={css({
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(244, 114, 182, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(244, 114, 182, 0.3)',
              })}
            >
              <div className={css({ color: '#f472b6', fontWeight: 'bold', marginBottom: '6px' })}>
                Observed State
              </div>
              <div className={css({ color: '#d1d5db', fontSize: '10px' })}>
                <div>Phase: {state.phase}</div>
                <div>
                  Problem: {state.currentProblemNumber}/{state.totalProblems}
                </div>
                {state.currentPartIndex !== undefined && (
                  <div>
                    Position: Part {state.currentPartIndex + 1}, Slot{' '}
                    {(state.currentSlotIndex ?? 0) + 1}
                  </div>
                )}
                <div>Answer: "{state.studentAnswer}"</div>
                {state.isCorrect !== null && (
                  <div
                    style={{
                      color: state.isCorrect ? '#4ade80' : '#f87171',
                    }}
                  >
                    Result: {state.isCorrect ? 'Correct' : 'Incorrect'}
                  </div>
                )}
                <div className={css({ color: '#6b7280', marginTop: '4px' })}>
                  Received: {new Date(state.receivedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          {/* Vision info */}
          {visionFrame && (
            <div
              className={css({
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              })}
            >
              <div className={css({ color: '#60a5fa', fontWeight: 'bold', marginBottom: '6px' })}>
                Vision Frame
              </div>
              <div className={css({ color: '#d1d5db', fontSize: '10px' })}>
                <div>Detected: {visionFrame.detectedValue ?? '—'}</div>
                <div>Confidence: {Math.round(visionFrame.confidence * 100)}%</div>
                <div className={css({ color: '#6b7280' })}>
                  Received: {new Date(visionFrame.receivedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}

          {/* DVR buffer info */}
          {dvrBufferInfo && (
            <div
              className={css({
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderRadius: '4px',
                border: '1px solid rgba(168, 85, 247, 0.3)',
              })}
            >
              <div className={css({ color: '#a855f7', fontWeight: 'bold', marginBottom: '6px' })}>
                DVR Buffer
              </div>
              <div className={css({ color: '#d1d5db', fontSize: '10px' })}>
                <div>
                  Range: {dvrBufferInfo.availableFromMs}ms - {dvrBufferInfo.availableToMs}ms
                </div>
                <div>Current problem: #{dvrBufferInfo.currentProblemNumber ?? '—'}</div>
                <div>Problem start: {dvrBufferInfo.currentProblemStartMs ?? '—'}ms</div>
              </div>
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
