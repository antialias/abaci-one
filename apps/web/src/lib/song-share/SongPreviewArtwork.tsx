/**
 * Shared visual for a song-share unfurl.
 *
 * Rendered as a PNG by two callers that both wrap it in next/og's
 * `ImageResponse`:
 * - `app/song/[code]/opengraph-image.tsx` — the static OG preview
 * - `lib/song-share/renderPreviewCover.ts` — the still cover frame that
 *   becomes the video track of the iMessage preview MP4
 *
 * Both surfaces want the exact same artwork, so the React tree lives here
 * and `displayFont` (whether Fraunces inlined successfully or we fell back
 * to system serif) is passed in. The component returns a JSX subtree that
 * the caller hands to `new ImageResponse(<artwork />, { ... })`.
 */

import type { SharedSongPayload } from './getSharedSong'

export const SONG_PREVIEW_SIZE = { width: 1200, height: 630 } as const

export function PlayButtonGlyph({ size: glyphSize = 220 }: { size?: number }) {
  return (
    <div
      style={{
        width: glyphSize,
        height: glyphSize,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #c084fc 0%, #db2777 60%, #fbbf24 100%)',
        boxShadow: '0 18px 60px rgba(192, 132, 252, 0.55), 0 0 0 8px rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: glyphSize * 0.42,
          color: 'white',
          // Nudge optical center — the ▶ glyph reads slightly left-of-center.
          marginLeft: glyphSize * 0.05,
          lineHeight: 1,
          display: 'flex',
          fontWeight: 700,
        }}
      >
        ▶
      </div>
    </div>
  )
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
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 90px',
          background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))',
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
        <div
          style={{
            fontSize: '17px',
            fontWeight: 700,
            color: '#fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            letterSpacing: '0.04em',
          }}
        >
          ▶ Tap to listen
        </div>
      </div>
    </div>
  )
}

export interface SongPreviewArtworkProps {
  /** Resolved share payload, or null to render the generic fallback card. */
  payload: SharedSongPayload | null
  /** CSS font-family string. Caller decides whether Fraunces inlined or to fall back. */
  displayFont: string
}

export function SongPreviewArtwork({ payload, displayFont }: SongPreviewArtworkProps) {
  if (!payload) {
    return (
      <Frame>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            gap: '20px',
          }}
        >
          <PlayButtonGlyph size={180} />
          <div
            style={{
              fontSize: '44px',
              fontFamily: displayFont,
              fontWeight: 700,
              color: '#ffffff',
              display: 'flex',
            }}
          >
            A song made on Abaci.One
          </div>
        </div>
      </Frame>
    )
  }

  const { player, song, stats } = payload
  const styles = song.styles.slice(0, 3)

  return (
    <Frame>
      {/* Left — who + song */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: '58%',
          padding: '50px 30px 80px 90px',
        }}
      >
        <div style={{ fontSize: '96px', marginBottom: '6px', display: 'flex' }}>{player.emoji}</div>
        <div
          style={{
            fontSize: '28px',
            color: '#9ca3af',
            display: 'flex',
            marginBottom: '4px',
            fontFamily: displayFont,
            fontStyle: 'italic',
          }}
        >
          A song for
        </div>
        <div
          style={{
            fontSize: '76px',
            fontFamily: displayFont,
            fontWeight: 700,
            display: 'flex',
            lineHeight: 1.05,
            marginBottom: song.title ? '22px' : '0',
            background: 'linear-gradient(135deg, #ffffff 0%, #fde68a 60%, #fdba74 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
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
                'linear-gradient(135deg, rgba(192, 132, 252, 0.22), rgba(251, 191, 36, 0.18))',
              borderRadius: '18px',
              padding: '16px 22px',
              border: '1px solid rgba(192, 132, 252, 0.35)',
              maxWidth: '600px',
            }}
          >
            <div
              style={{
                fontSize: '14px',
                color: '#c084fc',
                marginBottom: '6px',
                display: 'flex',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              {'♫'} Practice Song
            </div>
            <div
              style={{
                fontSize: '30px',
                fontFamily: displayFont,
                fontWeight: 700,
                fontStyle: 'italic',
                color: '#e9d5ff',
                display: 'flex',
                lineHeight: 1.25,
              }}
            >
              “{song.title}”
            </div>
          </div>
        )}
      </div>

      {/* Right — large play-button overlay + opt-in stats stack */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '42%',
          padding: '50px 90px 80px 20px',
          gap: '24px',
        }}
      >
        <PlayButtonGlyph size={220} />

        {/* Stat row — wraps the 1-3 permitted facts beneath the play button. */}
        {(stats.accuracyPct != null || (stats.bestCorrectStreak ?? 0) > 0) && (
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              maxWidth: '380px',
            }}
          >
            {stats.accuracyPct != null && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                  padding: '10px 16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  style={{
                    fontSize: '36px',
                    fontFamily: displayFont,
                    fontWeight: 700,
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
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', marginTop: 4 }}>
                  accuracy
                </div>
              </div>
            )}
            {(stats.bestCorrectStreak ?? 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                  padding: '10px 16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  style={{
                    fontSize: '36px',
                    fontFamily: displayFont,
                    fontWeight: 700,
                    color: '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    lineHeight: 1,
                  }}
                >
                  {stats.bestCorrectStreak} {'🔥'}
                </div>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', marginTop: 4 }}>
                  streak
                </div>
              </div>
            )}
          </div>
        )}

        {styles.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              maxWidth: '360px',
            }}
          >
            {styles.map((s) => (
              <div
                key={s}
                style={{
                  fontSize: '14px',
                  color: '#d1d5db',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '999px',
                  padding: '5px 12px',
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
  )
}
