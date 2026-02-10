'use client'

import { useEffect, useRef } from 'react'
import { css } from '../../../../styled-system/css'
import type { LogEntry, LogLevel } from './useTestLog'

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: '#8b949e',
  warn: '#d29922',
  error: '#f85149',
  success: '#3fb950',
}

function formatTs(ms: number): string {
  const secs = (ms / 1000).toFixed(2)
  return `+${secs.padStart(7, ' ')}s`
}

interface EventLogProps {
  entries: LogEntry[]
  onClear: () => void
}

export function EventLog({ entries, onClear }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [entries.length])

  return (
    <div data-component="EventLog">
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        })}
      >
        <span className={css({ fontSize: '11px', color: '#8b949e' })}>
          {entries.length} event{entries.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClear}
          className={css({
            fontSize: '11px',
            color: '#8b949e',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            _hover: { color: '#f0f6fc', backgroundColor: '#30363d' },
          })}
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollRef}
        className={css({
          fontFamily: 'monospace',
          fontSize: '12px',
          lineHeight: '1.5',
          backgroundColor: '#0d1117',
          border: '1px solid #21262d',
          borderRadius: '6px',
          padding: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
        })}
      >
        {entries.length === 0 ? (
          <span className={css({ color: '#484f58', fontStyle: 'italic' })}>No events yet</span>
        ) : (
          entries.map((entry, i) => (
            <div key={i} className={css({ whiteSpace: 'pre-wrap', wordBreak: 'break-all' })}>
              <span className={css({ color: '#484f58' })}>{formatTs(entry.timestamp)}</span>{' '}
              <span style={{ color: LEVEL_COLORS[entry.level] }}>
                [{entry.level.toUpperCase().padEnd(7)}]
              </span>{' '}
              <span className={css({ color: '#c9d1d9' })}>{entry.message}</span>
              {entry.detail && (
                <span className={css({ color: '#6e7681' })}> {entry.detail}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
