/**
 * Link-unfurl card for a shared celebration song.
 *
 * Honours the share's privacy projection only: it fetches via `getSharedSong`
 * (the single privacy boundary) WITHOUT `bumpView` — a crawler/preview must
 * not inflate the human view count — and renders just what that projection
 * already permitted (no toggle logic, no raw facts, baked into the PNG).
 *
 * Visual language mirrors `app/observe/[token]/opengraph-image.tsx` (dark
 * card, brand diamonds, bottom Abaci.One bar) for a consistent unfurl family.
 */

import { ImageResponse } from 'next/og'
import { getSharedSong } from '@/lib/song-share/getSharedSong'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const alt = 'A celebration song on Abaci.One'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface OGImageProps {
  params: Promise<{ code: string }>
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#111827',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative brand diamonds — left edge */}
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
        {['#c084fc', '#fbbf24', '#4ade80', '#60a5fa'].map((fill) => (
          <svg key={fill} width="40" height="40" viewBox="0 0 40 40">
            <polygon points="20,0 40,20 20,40 0,20" fill={fill} />
          </svg>
        ))}
      </div>

      {children}

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
            {'·'} A celebration song
          </span>
        </div>
      </div>
    </div>
  )
}

export default async function Image({ params }: OGImageProps) {
  const { code } = await params
  // No bumpView: OG fetches must not count as human plays.
  const payload = await getSharedSong(code)

  if (!payload) {
    return new ImageResponse(
      (
        <Frame>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              gap: '16px',
            }}
          >
            <div style={{ fontSize: '90px', display: 'flex' }}>{'🎵'}</div>
            <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#ffffff', display: 'flex' }}>
              A song made on Abaci.One
            </div>
          </div>
        </Frame>
      ),
      { ...size }
    )
  }

  const { player, song, stats } = payload
  const styles = song.styles.slice(0, 3)

  return new ImageResponse(
    (
      <Frame>
        {/* Left — who + song */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '52%',
            padding: '50px 30px 70px 90px',
          }}
        >
          <div style={{ fontSize: '88px', marginBottom: '8px', display: 'flex' }}>
            {player.emoji}
          </div>
          <div
            style={{
              fontSize: '30px',
              color: '#9ca3af',
              display: 'flex',
              marginBottom: '4px',
            }}
          >
            A song for
          </div>
          <div
            style={{
              fontSize: '52px',
              fontWeight: 'bold',
              color: '#ffffff',
              display: 'flex',
              lineHeight: 1.15,
              marginBottom: song.title ? '20px' : '0',
            }}
          >
            {player.name}
          </div>
          {song.title && (
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
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                {'🎵'} Practice Song
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 'bold',
                  color: '#e9d5ff',
                  display: 'flex',
                  lineHeight: 1.3,
                }}
              >
                {song.title}
              </div>
            </div>
          )}
        </div>

        {/* Right — only what the share's toggles permitted */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            width: '48%',
            padding: '50px 90px 70px 20px',
            gap: '18px',
          }}
        >
          {stats.accuracyPct != null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px',
              }}
            >
              <div
                style={{
                  fontSize: '76px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  display: 'flex',
                  color:
                    stats.accuracyPct >= 80
                      ? '#4ade80'
                      : stats.accuracyPct >= 60
                        ? '#fbbf24'
                        : '#f87171',
                }}
              >
                {stats.accuracyPct}%
              </div>
              <div style={{ fontSize: '24px', color: '#9ca3af', display: 'flex' }}>accuracy</div>
            </div>
          )}

          {(stats.problemsDone != null || (stats.bestCorrectStreak ?? 0) > 0) && (
            <div style={{ display: 'flex', gap: '14px' }}>
              {stats.problemsDone != null && stats.problemsTotal != null && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '30px',
                      fontWeight: 'bold',
                      color: '#60a5fa',
                      display: 'flex',
                    }}
                  >
                    {stats.problemsDone}/{stats.problemsTotal}
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>
                    problems
                  </div>
                </div>
              )}
              {(stats.bestCorrectStreak ?? 0) > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '30px',
                      fontWeight: 'bold',
                      color: '#fbbf24',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {stats.bestCorrectStreak} {'🔥'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af', display: 'flex' }}>streak</div>
                </div>
              )}
            </div>
          )}

          {stats.skills && stats.skills.length > 0 && (
            <div style={{ fontSize: '17px', color: '#6b7280', display: 'flex', gap: '8px' }}>
              <span style={{ color: '#4ade80', display: 'flex' }}>Skills:</span>
              <span style={{ display: 'flex' }}>{stats.skills.slice(0, 3).join(', ')}</span>
            </div>
          )}

          {styles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {styles.map((s) => (
                <div
                  key={s}
                  style={{
                    fontSize: '15px',
                    color: '#d1d5db',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '999px',
                    padding: '6px 14px',
                    display: 'flex',
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </Frame>
    ),
    { ...size }
  )
}
