'use client'

import { useCallback, useState } from 'react'
import { useVisualDebugSafe } from '@/contexts/VisualDebugContext'
import type { GeneratedProblem, ProblemSlot, SessionPart } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'

interface ProblemDebugPanelProps {
  /** The current problem being displayed */
  problem: GeneratedProblem
  /** The current slot */
  slot: ProblemSlot
  /** The current part */
  part: SessionPart
  /** Current part index */
  partIndex: number
  /** Current slot index */
  slotIndex: number
  /** Current user input */
  userInput: string
  /** Current phase name */
  phaseName: string
}

/**
 * Debug panel that shows current problem details when visual debug mode is on.
 * Allows easy copying of problem data for bug reports.
 */
export function ProblemDebugPanel({
  problem,
  slot,
  part,
  partIndex,
  slotIndex,
  userInput,
  phaseName,
}: ProblemDebugPanelProps) {
  const { isVisualDebugEnabled } = useVisualDebugSafe()
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const debugData = {
    problem: {
      terms: problem.terms,
      answer: problem.answer,
      skillsRequired: problem.skillsRequired,
    },
    slot: {
      index: slot.index,
      purpose: slot.purpose,
      constraints: slot.constraints,
    },
    part: {
      number: part.partNumber,
      type: part.type,
    },
    position: {
      partIndex,
      slotIndex,
    },
    state: {
      userInput,
      phaseName,
    },
  }

  const debugJson = JSON.stringify(debugData, null, 2)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(debugJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
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

  return (
    <div
      data-component="problem-debug-panel"
      className={css({
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        width: isCollapsed ? 'auto' : '360px',
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
        <span className={css({ fontWeight: 'bold', color: '#4ade80' })}>
          Problem Debug {isCollapsed ? '(expand)' : ''}
        </span>
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
              {copied ? 'Copied!' : 'Copy JSON'}
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
          {/* Quick summary */}
          <div
            className={css({
              marginBottom: '12px',
              padding: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
            })}
          >
            <div className={css({ color: '#fbbf24', marginBottom: '4px' })}>
              Part {part.partNumber} ({part.type}) - Slot {slotIndex + 1}
            </div>
            <div className={css({ color: '#f472b6' })}>
              {problem.terms
                .map((t, i) => (i === 0 ? t : t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))
                .join(' ')}{' '}
              = {problem.answer}
            </div>
            <div className={css({ color: '#67e8f9', marginTop: '4px' })}>
              Skills: {problem.skillsRequired.join(', ')}
            </div>
            <div className={css({ color: '#a3a3a3', marginTop: '4px' })}>
              Phase: {phaseName} | Input: "{userInput}"
            </div>
          </div>

          {/* Full JSON */}
          <pre
            className={css({
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: '#a3e635',
              margin: 0,
              lineHeight: '1.4',
            })}
          >
            {debugJson}
          </pre>
        </div>
      )}
    </div>
  )
}
