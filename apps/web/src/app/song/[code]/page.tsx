import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CelebrationBackground } from '@/components/song-share/CelebrationBackground'
import { PlayerHero } from '@/components/song-share/PlayerHero'
import { SharedSongPlayerCard } from '@/components/song-share/SharedSongPlayerCard'
import { TrophyTile } from '@/components/song-share/TrophyTile'
import { getSharedSong } from '@/lib/song-share/getSharedSong'
import { css } from '@styled/css'
import { vstack, hstack, wrap } from '@styled/patterns'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ code: string }>
}

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? 'https://abaci.one'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const payload = await getSharedSong(code)

  if (!payload) {
    return { title: 'Song not found | Abaci.One', robots: { index: false, follow: false } }
  }

  const { player, song } = payload
  const title = `${player.emoji} A song for ${player.name}`
  const description = song.title
    ? `Listen to "${song.title}" — a celebration song made for ${player.name} on Abaci.One`
    : `A celebration song made for ${player.name} on Abaci.One`

  // Twitter Player Card + og:video light up inline playback in Twitter/X,
  // Discord, Mastodon. Clients that don't honor these tags fall back to the
  // OG image (the static "tap to play" poster) — no degradation.
  const embedUrl = `${ORIGIN}/embed/song/${code}`
  const streamUrl = `${ORIGIN}${song.audioPath}`

  return {
    title,
    description,
    // Keepsake links are private-by-link, not for search engines.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Abaci.One',
      videos: [{ url: embedUrl, secureUrl: embedUrl, type: 'text/html', width: 480, height: 600 }],
    },
    twitter: {
      card: 'player',
      title,
      description,
      players: [{ playerUrl: embedUrl, streamUrl, width: 480, height: 600 }],
    },
  }
}

export default async function SharedSongPage({ params }: Props) {
  const { code } = await params
  const payload = await getSharedSong(code, { bumpView: true })
  if (!payload) notFound()

  const { player, song, stats, visibility } = payload
  const hasStats =
    stats.age != null ||
    stats.accuracyPct != null ||
    stats.bestCorrectStreak != null ||
    (stats.skills?.length ?? 0) > 0 ||
    (stats.highlights?.length ?? 0) > 0 ||
    !!stats.storyAngle

  return (
    <div
      data-component="shared-song-page"
      className={css({
        position: 'relative',
        minH: '100vh',
        py: { base: '32px', md: '48px' },
        px: '16px',
      })}
    >
      <CelebrationBackground />

      <main
        className={vstack({
          position: 'relative',
          alignItems: 'stretch',
          gap: '36px',
          maxW: '680px',
          mx: 'auto',
          zIndex: 1,
        })}
      >
        <PlayerHero emoji={player.emoji} name={player.name} songTitle={song.title} />

        {/* Integrated player + lyrics — the lyrics are the playback surface */}
        <SharedSongPlayerCard
          audioPath={song.audioPath}
          alignmentPath={song.alignmentPath}
          lyrics={song.sections}
          title={song.title}
          variant="full"
          autoPlay={visibility.autoPlay}
        />

        {/* Musical style */}
        {song.styles.length > 0 && (
          <div className={wrap({ gap: '8px', justifyContent: 'center' })}>
            {song.styles.map((s) => (
              <span
                key={s}
                className={css({
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'purple.700',
                  bg: 'rgba(192, 132, 252, 0.14)',
                  borderRadius: 'full',
                  px: '12px',
                  py: '5px',
                })}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Opt-in stats — rebuilt as trophy tiles */}
        {hasStats && (
          <section
            data-section="stats"
            className={vstack({
              alignItems: 'stretch',
              gap: '16px',
              bg: 'white',
              borderRadius: '20px',
              border: '1px solid rgba(192, 132, 252, 0.2)',
              p: { base: '20px', md: '24px' },
              boxShadow: '0 8px 28px rgba(124, 58, 237, 0.08)',
            })}
          >
            <h2
              className={css({
                fontFamily: 'display',
                fontStyle: 'italic',
                fontWeight: '600',
                fontSize: '22px',
                color: 'purple.900',
                m: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              })}
            >
              <span aria-hidden="true">✨</span>
              <span>The story so far</span>
            </h2>

            {stats.storyAngle && (
              <p
                className={css({
                  fontFamily: 'display',
                  fontStyle: 'italic',
                  fontSize: '17px',
                  lineHeight: 1.5,
                  color: 'gray.700',
                  m: 0,
                })}
              >
                {stats.storyAngle}
              </p>
            )}

            {stats.highlights && stats.highlights.length > 0 && (
              <ul
                data-element="session-highlights"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  listStyle: 'none',
                  m: 0,
                  p: 0,
                })}
              >
                {stats.highlights.map((h) => (
                  <li
                    key={h}
                    className={css({
                      fontSize: '14px',
                      lineHeight: 1.5,
                      color: 'gray.800',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                    })}
                  >
                    <span aria-hidden="true">✨</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className={wrap({ gap: '12px' })}>
              {stats.accuracyPct != null && (
                <TrophyTile
                  tone="emerald"
                  glyph="✓"
                  value={`${stats.accuracyPct}%`}
                  label="Accuracy"
                />
              )}
              {stats.problemsDone != null && stats.problemsTotal != null && (
                <TrophyTile
                  tone="sky"
                  glyph="∑"
                  value={`${stats.problemsDone}/${stats.problemsTotal}`}
                  label="Problems"
                />
              )}
              {stats.bestCorrectStreak != null && stats.bestCorrectStreak > 0 && (
                <TrophyTile
                  tone="amber"
                  glyph="🔥"
                  value={stats.bestCorrectStreak}
                  label="Best streak"
                />
              )}
              {stats.age != null && (
                <TrophyTile tone="rose" glyph="✦" value={stats.age} label="Age" />
              )}
            </div>

            {stats.skills && stats.skills.length > 0 && (
              <div className={hstack({ gap: '8px', flexWrap: 'wrap' })}>
                <span className={css({ fontSize: '12px', color: 'gray.500', fontWeight: '600' })}>
                  Skills practiced:
                </span>
                {stats.skills.map((sk) => (
                  <span
                    key={sk}
                    className={css({
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'emerald.800',
                      bg: 'emerald.50',
                      border: '1px solid token(colors.emerald.200)',
                      borderRadius: 'full',
                      px: '10px',
                      py: '3px',
                    })}
                  >
                    {sk}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* CTA pill — friendly, branded, doesn't compete with the player */}
        <div className={vstack({ alignItems: 'center', gap: '6px', pt: '4px', pb: '16px' })}>
          <Link
            href="/"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              px: '20px',
              py: '12px',
              bg: 'white',
              border: '1px solid token(colors.purple.200)',
              borderRadius: 'full',
              fontSize: '14px',
              fontWeight: '700',
              color: 'purple.800',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(251, 191, 36, 0.18)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              _hover: {
                transform: 'translateY(-1px)',
                boxShadow: '0 6px 20px rgba(251, 191, 36, 0.28)',
              },
            })}
          >
            <span>Make a song on Abaci.One</span>
            <span aria-hidden="true">→</span>
          </Link>
          <p className={css({ fontSize: '12px', color: 'gray.500', m: 0 })}>
            Adaptive abacus practice that ends in a song.
          </p>
        </div>
      </main>
    </div>
  )
}
