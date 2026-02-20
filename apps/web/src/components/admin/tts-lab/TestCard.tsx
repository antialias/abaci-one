'use client'

import type { ReactNode } from 'react'
import { css } from '../../../../styled-system/css'
import { EventLog } from './EventLog'
import type { LogEntry } from './useTestLog'

export type TestStatus = 'idle' | 'running' | 'pass' | 'fail'

const STATUS_COLORS: Record<TestStatus, string> = {
  idle: '#484f58',
  running: '#58a6ff',
  pass: '#3fb950',
  fail: '#f85149',
}

const STATUS_LABELS: Record<TestStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  pass: 'Pass',
  fail: 'Fail',
}

interface TestCardProps {
  title: string
  description: string
  status: TestStatus
  entries: LogEntry[]
  onClear: () => void
  children: ReactNode
}

export function TestCard({
  title,
  description,
  status,
  entries,
  onClear,
  children,
}: TestCardProps) {
  return (
    <div
      data-component="TestCard"
      className={css({
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        })}
      >
        <div>
          <h3
            className={css({
              fontSize: '14px',
              fontWeight: '600',
              color: '#f0f6fc',
              margin: '0',
            })}
          >
            {title}
          </h3>
          <p
            className={css({
              fontSize: '12px',
              color: '#8b949e',
              margin: '4px 0 0',
            })}
          >
            {description}
          </p>
        </div>
        <span
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
          })}
          style={{
            color: STATUS_COLORS[status],
            backgroundColor: STATUS_COLORS[status] + '20',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS[status],
              display: 'inline-block',
            }}
          />
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}>{children}</div>
      <EventLog entries={entries} onClear={onClear} />
    </div>
  )
}
