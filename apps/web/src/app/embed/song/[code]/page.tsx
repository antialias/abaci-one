/**
 * Iframe-safe embed of a public song share — what Twitter Player Card,
 * Discord, and Mastodon load inline when someone pastes a `/song/[code]`
 * link in those clients.
 *
 * Tiny on purpose: just the player + a minimal Abaci.One attribution corner
 * that links back to the full keepsake page. No nav, no stats panel, no
 * decorative background — chat embeds are small and any chrome competes
 * with the song.
 *
 * Uses the same `getSharedSong` privacy boundary as the full page (no
 * `bumpView` — embed loads shouldn't inflate the human view counter).
 */

import { notFound } from 'next/navigation'
import { SharedSongPlayerCard } from '@/components/song-share/SharedSongPlayerCard'
import { getSharedSong } from '@/lib/song-share/getSharedSong'
import { css } from '@styled/css'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ code: string }>
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abaci.one'

export default async function EmbedSongPage({ params }: Props) {
  const { code } = await params
  const payload = await getSharedSong(code) // no bumpView
  if (!payload) notFound()

  const { player, song, visibility } = payload

  return (
    <div
      data-component="embed-song"
      className={css({
        position: 'relative',
        minH: '100vh',
        bg: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        p: '12px',
      })}
    >
      <div
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '10px',
        })}
      >
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'white',
          })}
        >
          <span
            className={css({
              w: '36px',
              h: '36px',
              borderRadius: '50%',
              bg: 'white',
              color: 'gray.900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
            })}
          >
            {player.emoji}
          </span>
          <div className={css({ display: 'flex', flexDirection: 'column' })}>
            <span className={css({ fontSize: '11px', color: 'gray.400' })}>A song for</span>
            <span
              className={css({
                fontFamily: 'display',
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: 1.1,
              })}
            >
              {player.name}
            </span>
          </div>
        </div>

        <SharedSongPlayerCard
          audioPath={song.audioPath}
          alignmentPath={song.alignmentPath}
          lyrics={song.sections}
          title={song.title}
          variant="full"
          autoPlay={visibility.autoPlay}
        />
      </div>

      <a
        href={`${ORIGIN}/song/${code}`}
        target="_blank"
        rel="noopener noreferrer"
        className={css({
          mt: '8px',
          alignSelf: 'flex-end',
          fontSize: '11px',
          color: 'gray.400',
          textDecoration: 'none',
          letterSpacing: '0.04em',
          fontWeight: 600,
          _hover: { color: 'white' },
        })}
      >
        Made on Abaci.One ↗
      </a>
    </div>
  )
}
