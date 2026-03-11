import { ImageResponse } from 'next/og'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { players, sessionPlans, sessionSongs } from '@/db/schema'
import { validateSessionShare } from '@/lib/session-share'
import type { SessionSongLLMOutput } from '@/db/schema/session-songs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const alt = 'Practice session on Abaci.One'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

interface OGImageProps {
  params: Promise<{ token: string }>
}

interface SessionStats {
  accuracy: number
  problemsDone: number
  problemsTotal: number
  bestCorrectStreak: number
  partTypes: string[]
  durationMinutes: number
  skillsPracticed: string[]
}

interface SessionProblem {
  terms: number[]
  answer: number
}

/** Format a skill key like "basic.directAddition" into "Direct Addition" */
function formatSkill(skill: string): string {
  const name = skill.includes('.') ? skill.split('.').pop()! : skill
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/^\+/, 'Plus ')
    .trim()
}

/** Extract sample problems from session plan parts */
function extractProblems(parts: unknown): SessionProblem[] {
  if (!Array.isArray(parts)) return []
  const problems: SessionProblem[] = []
  for (const part of parts) {
    if (part?.slots && Array.isArray(part.slots)) {
      for (const slot of part.slots) {
        if (slot?.problem?.terms && slot.problem.answer != null) {
          problems.push({ terms: slot.problem.terms, answer: slot.problem.answer })
        }
      }
    }
  }
  return problems
}

/** Format a problem as a string like "13 + 11 + 10 = 34" */
function formatProblem(p: SessionProblem): string {
  return `${p.terms.join(' + ')} = ${p.answer}`
}

export default async function Image({ params }: OGImageProps) {
  const { token } = await params

  const validation = await validateSessionShare(token)

  let studentName = 'Student'
  let studentEmoji = ''
  let songTitle: string | null = null
  let sessionCompleted = false
  let stats: SessionStats | null = null
  let sampleProblems: SessionProblem[] = []

  if (validation.valid && validation.share) {
    const share = validation.share

    const [playerResults, sessions] = await Promise.all([
      db.select().from(players).where(eq(players.id, share.playerId)).limit(1),
      db.select().from(sessionPlans).where(eq(sessionPlans.id, share.sessionId)).limit(1),
    ])

    const player = playerResults[0]
    const session = sessions[0]

    if (player) {
      studentName = player.name
      studentEmoji = player.emoji
    }

    if (session) {
      sampleProblems = extractProblems(session.parts).slice(0, 2)
    }

    if (session?.completedAt) {
      sessionCompleted = true

      const [song] = await db
        .select()
        .from(sessionSongs)
        .where(eq(sessionSongs.sessionPlanId, share.sessionId))
        .limit(1)

      if (song?.status === 'completed') {
        if (song.llmOutput) {
          songTitle = (song.llmOutput as SessionSongLLMOutput)?.title ?? null
        }
        if (song.promptInput) {
          const input = song.promptInput as { currentSession?: SessionStats }
          stats = input.currentSession ?? null
        }
      }
    }
  }

  const hasSong = !!songTitle
  const accuracyPct = stats ? Math.round(stats.accuracy * 100) : null
  const skills = stats?.skillsPracticed?.map(formatSkill).slice(0, 2) ?? []

  return new ImageResponse(
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
          {sessionCompleted ? 'Practice session complete' : 'Practicing now'}
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
                {formatProblem(p)}
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
              <div style={{ fontSize: '22px', color: '#9ca3af', display: 'flex' }}>accuracy</div>
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
                {stats.problemsDone}/{stats.problemsTotal}
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>problems</div>
            </div>

            {/* Streak */}
            {stats.bestCorrectStreak > 0 && (
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
                  {stats.bestCorrectStreak} {'\uD83D\uDD25'}
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>streak</div>
              </div>
            )}

            {/* Duration */}
            {stats.durationMinutes > 0 && (
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
                  {stats.durationMinutes}m
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>duration</div>
              </div>
            )}
          </div>
        )}

        {/* Skills + sample problems */}
        {(skills.length > 0 || (hasSong && sampleProblems.length > 0)) && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '0 4px',
            }}
          >
            {skills.length > 0 && (
              <div style={{ fontSize: '16px', color: '#6b7280', display: 'flex', gap: '8px' }}>
                <span style={{ color: '#4ade80', display: 'flex' }}>Skills:</span>
                <span style={{ display: 'flex' }}>{skills.join(', ')}</span>
              </div>
            )}
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
                    {formatProblem(p)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fallback for no stats */}
        {!stats && !sessionCompleted && (
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
    </div>,
    { ...size }
  )
}
