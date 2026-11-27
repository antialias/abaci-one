/**
 * The share link's OG card (Phase 4c): pure props in, the card's markup out,
 * so its text can be snapshot without rendering a PNG. Every number comes
 * from the session report (`ogCardFromReport`), the same numbers the
 * share page shows.
 */

import { reportEnding, reportProgress, wholeMinutes } from '@/lib/curriculum/observer-report'
import type { SessionReport } from '@/lib/curriculum/session-report'

export type OgCardStatus = 'live' | 'completed' | 'ended_early' | 'abandoned' | 'unknown'

export interface OgCardStats {
  /** "done/planned" */
  problems: string
  /** First-try accuracy, whole percent; null with nothing attempted */
  firstTryPct: number | null
  fixedInRetries: number
  /** Wall time, whole minutes */
  minutes: number
}

export interface ObserveOgCardProps {
  studentName: string
  studentEmoji: string
  status: OgCardStatus
  songTitle: string | null
  /** Formatted sample problems ("12 + 3 = 15") */
  sampleProblems: string[]
  stats: OgCardStats | null
}

const STATUS_LINE: Record<OgCardStatus, string> = {
  live: 'Practicing now',
  completed: 'Practice session complete',
  ended_early: 'Session ended early',
  abandoned: 'Session left unfinished',
  unknown: 'Practice session',
}

/** The card's status and numbers from the report (null report: no numbers). */
export function ogCardFromReport(report: SessionReport | null): {
  status: OgCardStatus
  stats: OgCardStats | null
} {
  if (!report) return { status: 'unknown', stats: null }
  const ending = reportEnding(report)
  const status: OgCardStatus = ending ?? (report.outcome === 'in_progress' ? 'live' : 'unknown')
  const { done, total } = reportProgress(report)
  const pct = report.totals.firstTryAccuracy
  return {
    status,
    stats:
      report.totals.problems > 0 || status !== 'live'
        ? {
            problems: `${done}/${total}`,
            firstTryPct: pct == null ? null : Math.round(pct * 100),
            fixedInRetries: report.totals.fixedInRetries,
            minutes: wholeMinutes(report.time.wallMs),
          }
        : null,
  }
}

export function ObserveOgCard({
  studentName,
  studentEmoji,
  status,
  songTitle,
  sampleProblems,
  stats,
}: ObserveOgCardProps) {
  const hasSong = !!songTitle
  const accuracyPct = stats?.firstTryPct ?? null

  return (
    <div
      style={{
        background: '#111827',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        padding: '0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative diamond beads - left side */}
      <div
        style={{
          position: 'absolute',
          left: '30px',
          top: '0',
          bottom: '0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '50px',
          opacity: 0.2,
        }}
      >
        {/* Diamond shapes in brand colors */}
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="20,0 40,20 20,40 0,20" fill="#c084fc" />
        </svg>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="20,0 40,20 20,40 0,20" fill="#fbbf24" />
        </svg>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="20,0 40,20 20,40 0,20" fill="#4ade80" />
        </svg>
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon points="20,0 40,20 20,40 0,20" fill="#60a5fa" />
        </svg>
      </div>

      {/* Decorative math operators - right side */}
      <div
        style={{
          position: 'absolute',
          right: '25px',
          top: '0',
          bottom: '0',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '60px',
          opacity: 0.15,
          fontSize: '36px',
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        <span>+</span>
        <span>=</span>
      </div>

      {/* Left column — student + song */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '50%',
          padding: '50px 40px 50px 90px',
        }}
      >
        {/* Student emoji */}
        <div style={{ fontSize: '80px', marginBottom: '12px', display: 'flex' }}>
          {studentEmoji || '\uD83E\uDDEE'}
        </div>

        {/* Student name */}
        <div
          style={{
            fontSize: '42px',
            fontWeight: 'bold',
            color: '#ffffff',
            marginBottom: '8px',
            display: 'flex',
            lineHeight: 1.2,
          }}
        >
          {studentName}
        </div>

        {/* Session status */}
        <div
          style={{
            fontSize: '22px',
            color: '#9ca3af',
            marginBottom: hasSong ? '24px' : '20px',
            display: 'flex',
          }}
        >
          {STATUS_LINE[status]}
        </div>

        {/* Song title card */}
        {hasSong && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background:
                'linear-gradient(135deg, rgba(192, 132, 252, 0.2), rgba(124, 58, 237, 0.2))',
              borderRadius: '16px',
              padding: '16px 20px',
              border: '1px solid rgba(192, 132, 252, 0.3)',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#c084fc',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              {'\uD83C\uDFB5'} Practice Song
            </div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#e9d5ff',
                display: 'flex',
                lineHeight: 1.3,
              }}
            >
              {songTitle}
            </div>
          </div>
        )}

        {/* Sample problems — shown when no song */}
        {!hasSong && sampleProblems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '4px',
            }}
          >
            {sampleProblems.map((p, i) => (
              <div
                key={i}
                style={{
                  fontSize: '22px',
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  display: 'flex',
                  opacity: 0.8,
                }}
              >
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right column — stats */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '50%',
          padding: '50px 90px 50px 20px',
          gap: '20px',
        }}
      >
        {/* Accuracy — hero stat */}
        {accuracyPct != null && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '20px',
              padding: '24px 28px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '72px',
                  fontWeight: 'bold',
                  color: accuracyPct >= 80 ? '#4ade80' : accuracyPct >= 60 ? '#fbbf24' : '#f87171',
                  lineHeight: 1,
                  display: 'flex',
                }}
              >
                {accuracyPct}%
              </div>
              <div style={{ fontSize: '22px', color: '#9ca3af', display: 'flex' }}>first try</div>
            </div>

            {/* Accuracy bar */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '8px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${accuracyPct}%`,
                  height: '100%',
                  background:
                    accuracyPct >= 80 ? '#4ade80' : accuracyPct >= 60 ? '#fbbf24' : '#f87171',
                  borderRadius: '4px',
                  display: 'flex',
                }}
              />
            </div>
          </div>
        )}

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'flex', gap: '16px' }}>
            {/* Problems */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div
                style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: '#60a5fa',
                  display: 'flex',
                }}
              >
                {stats.problems}
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>problems</div>
            </div>

            {/* Fixed in retries */}
            {stats.fixedInRetries > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {stats.fixedInRetries}
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>
                  fixed in retries
                </div>
              </div>
            )}

            {/* Duration */}
            {stats.minutes > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#c084fc',
                    display: 'flex',
                  }}
                >
                  {stats.minutes}m
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>duration</div>
              </div>
            )}
          </div>
        )}

        {/* Sample problems (with a song) */}
        {hasSong && sampleProblems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '0 4px',
            }}
          >
            {hasSong && sampleProblems.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '18px',
                  color: '#fbbf24',
                  fontFamily: 'monospace',
                  opacity: 0.7,
                }}
              >
                {sampleProblems.map((p, i) => (
                  <span key={i} style={{ display: 'flex' }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fallback for no stats */}
        {!stats && status === 'live' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '20px',
              padding: '40px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px', display: 'flex' }}>
              {'\uD83D\uDCCA'}
            </div>
            <div style={{ fontSize: '20px', color: '#9ca3af', display: 'flex' }}>
              Session in progress...
            </div>
          </div>
        )}
      </div>

      {/* Bottom branding bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.4))',
        }}
      >
        <div
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Abaci.One
          <span style={{ color: '#6b7280', fontWeight: 400, display: 'flex' }}>
            {'\u00B7'} Learn Soroban Through Play
          </span>
        </div>
      </div>
    </div>
  )
}
