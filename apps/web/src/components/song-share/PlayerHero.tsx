/**
 * The big celebration hero atop the public song-share page.
 *
 * Three layers: a glowing emoji capsule, a Fraunces display headline with the
 * player's name in a purple→rose gradient text fill, and (when present) a soft
 * purple gradient card for the song title in display italic.
 *
 * Standalone component so the page layout reads top-to-bottom and so the hero
 * can be reused or restyled without touching the page shell.
 */

import { css } from '../../../styled-system/css'

interface PlayerHeroProps {
  emoji: string
  name: string
  songTitle: string | null
}

export function PlayerHero({ emoji, name, songTitle }: PlayerHeroProps) {
  return (
    <div
      data-component="player-hero"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '14px',
        textAlign: 'center',
      })}
    >
      {/* Emoji capsule — large, with a warm gold halo. */}
      <div
        className={css({
          position: 'relative',
          w: '128px',
          h: '128px',
          borderRadius: '50%',
          bg: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '78px',
          lineHeight: 1,
          boxShadow:
            '0 0 0 6px rgba(251, 191, 36, 0.18), 0 12px 32px rgba(124, 58, 237, 0.18), 0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid token(colors.purple.100)',
          animation: 'embellishmentPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        })}
      >
        {emoji}
      </div>

      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
        })}
      >
        <div
          className={css({
            fontFamily: 'display',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '20px',
            color: 'gray.500',
            lineHeight: 1.1,
          })}
        >
          A song for
        </div>
        <h1
          // Gradient text — purple → rose → orange. Panda accepts
          // `backgroundClip: 'text'`, but the `-webkit-background-clip`
          // prefix (still needed for Safari) isn't in its known props, so
          // we set it via the raw `style` prop alongside.
          style={{ WebkitBackgroundClip: 'text' }}
          className={css({
            fontFamily: 'display',
            fontWeight: 900,
            fontSize: { base: '44px', md: '56px' },
            lineHeight: 1.05,
            backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #db2777 60%, #f97316 100%)',
            backgroundClip: 'text',
            color: 'transparent',
            margin: 0,
          })}
        >
          {name}
        </h1>
        <div
          className={css({
            fontSize: '14px',
            color: 'gray.600',
            mt: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          })}
        >
          <span aria-hidden="true">🎉</span>
          <span>A celebration song from their practice</span>
        </div>
      </div>

      {songTitle && (
        <div
          className={css({
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            mt: '6px',
            px: '20px',
            py: '12px',
            borderRadius: '16px',
            background:
              'linear-gradient(135deg, rgba(192, 132, 252, 0.18), rgba(251, 191, 36, 0.16))',
            border: '1px solid rgba(192, 132, 252, 0.35)',
            maxW: '100%',
          })}
        >
          <div
            className={css({
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: 'purple.700',
            })}
          >
            ♫ Title
          </div>
          <div
            className={css({
              fontFamily: 'display',
              fontStyle: 'italic',
              fontWeight: 600,
              fontSize: { base: '22px', md: '26px' },
              lineHeight: 1.2,
              color: 'purple.900',
            })}
          >
            “{songTitle}”
          </div>
        </div>
      )}
    </div>
  )
}
