'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'
import { classifySongFailure } from '@/lib/session-song/classify-failure'
import type { SessionSongFailureKind } from '@/db/schema/session-songs'

interface SongFailureGroup {
  failureKind: SessionSongFailureKind | 'unknown'
  count: number
  latestErrorMessage: string | null
  latestAt: number
}

interface SystemHealthData {
  songFailures: SongFailureGroup[]
  windowHours: number
  generatedAt: number
}

/**
 * Reactive admin banner — flags server-level config issues by looking at the
 * trailing edge of the failure stream. Specifically calls out auth_invalid
 * and quota_exceeded since those affect every user, not just whoever
 * happened to play.
 */
export function SystemHealthBanner() {
  const [data, setData] = useState<SystemHealthData | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/admin/system-health')
        if (!res.ok || cancelled) return
        const body = (await res.json()) as SystemHealthData
        if (!cancelled) setData(body)
      } catch {
        // Banner is best-effort; fail silently.
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (!data) return null

  // Only escalate on server-level kinds. Skip rate_limited (transient) and
  // unknown (could be one-offs), and skip transient.
  const escalating = data.songFailures.filter(
    (g) =>
      g.failureKind === 'missing_config' ||
      g.failureKind === 'auth_invalid' ||
      g.failureKind === 'quota_exceeded'
  )
  if (escalating.length === 0) return null

  return (
    <div
      data-component="admin-system-health-banner"
      className={css({
        marginBottom: '16px',
        padding: '14px 16px',
        borderRadius: '8px',
        backgroundColor: '#3a1f1f',
        borderLeft: '4px solid #f85149',
        color: '#f0f6fc',
      })}
    >
      <div
        className={css({
          fontSize: '14px',
          fontWeight: 'bold',
          marginBottom: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        })}
      >
        <span aria-hidden>⚠️</span>
        Session songs are failing for users
      </div>
      <p
        className={css({
          fontSize: '12px',
          color: '#c9d1d9',
          marginBottom: '10px',
        })}
      >
        {escalating.reduce((acc, g) => acc + g.count, 0)} failed song{' '}
        {escalating.reduce((acc, g) => acc + g.count, 0) === 1 ? 'request' : 'requests'} in the last{' '}
        {data.windowHours}h.
      </p>
      <ul
        className={css({
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        })}
      >
        {escalating.map((g) => {
          const classified = classifySongFailure(g.latestErrorMessage ?? g.failureKind)
          return (
            <li
              key={g.failureKind}
              data-failure-kind={g.failureKind}
              className={css({
                fontSize: '13px',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: '#1f1414',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                })}
              >
                <span
                  className={css({
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: '#f85149',
                  })}
                >
                  {g.failureKind.replace('_', ' ')}
                </span>
                <span className={css({ color: '#8b949e', fontSize: '11px' })}>
                  ×{g.count} ·{' '}
                  {new Date(g.latestAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <span className={css({ color: '#c9d1d9' })}>{classified.ownerMessage}</span>
              {classified.remediation && (
                <a
                  href={classified.remediation.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-action={`remediate-${g.failureKind}`}
                  className={css({
                    color: '#58a6ff',
                    fontSize: '12px',
                    textDecoration: 'none',
                    _hover: { textDecoration: 'underline' },
                  })}
                >
                  {classified.remediation.label} →
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
