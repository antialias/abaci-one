import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SharedSongPlayer } from '@/components/song/SharedSongPlayer'
import { SongLyrics } from '@/components/song/SongLyrics'
import { getSharedSong } from '@/lib/song-share/getSharedSong'
import { css } from '@styled/css'
import { vstack, hstack, wrap } from '@styled/patterns'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ code: string }>
}

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

  return {
    title,
    description,
    // Keepsake links are private-by-link, not for search engines.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'Abaci.One' },
  }
}

export default async function SharedSongPage({ params }: Props) {
  const { code } = await params
  const payload = await getSharedSong(code, { bumpView: true })
  if (!payload) notFound()

  const { player, song, stats } = payload
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
      className={css({ minH: '100vh', bg: 'gray.50', py: '40px', px: '16px' })}
    >
      <main
        className={vstack({
          alignItems: 'stretch',
          gap: '28px',
          maxW: '680px',
          mx: 'auto',
        })}
      >
        {/* Hero */}
        <div className={vstack({ alignItems: 'center', gap: '10px', textAlign: 'center' })}>
          <span
            className={css({
              fontSize: '64px',
              lineHeight: '1',
              w: '96px',
              h: '96px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'white',
              borderRadius: '50%',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '1px solid token(colors.gray.200)',
            })}
          >
            {player.emoji}
          </span>
          <h1 className={css({ fontSize: '24px', fontWeight: '800', color: 'gray.900' })}>
            A song for {player.name}
          </h1>
          {song.title && (
            <p className={css({ fontSize: '18px', fontWeight: '600', color: 'purple.700' })}>
              “{song.title}”
            </p>
          )}
        </div>

        {/* Player */}
        <SharedSongPlayer audioPath={song.audioPath} title={song.title} />

        {/* Musical style */}
        {song.styles.length > 0 && (
          <div className={wrap({ gap: '8px', justifyContent: 'center' })}>
            {song.styles.map((s) => (
              <span
                key={s}
                className={css({
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'gray.600',
                  bg: 'white',
                  border: '1px solid token(colors.gray.200)',
                  borderRadius: 'full',
                  px: '10px',
                  py: '4px',
                })}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Lyrics */}
        <section data-section="lyrics">
          <h2
            className={css({
              fontSize: '15px',
              fontWeight: '700',
              color: 'gray.700',
              mb: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            })}
          >
            Lyrics
          </h2>
          <SongLyrics sections={song.sections} />
        </section>

        {/* Opt-in stats */}
        {hasStats && (
          <section
            data-section="stats"
            className={vstack({
              alignItems: 'stretch',
              gap: '10px',
              bg: 'white',
              borderRadius: '14px',
              border: '1px solid token(colors.gray.200)',
              p: '18px',
            })}
          >
            <h2
              className={css({
                fontSize: '15px',
                fontWeight: '700',
                color: 'gray.700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              })}
            >
              About this practice session
            </h2>
            {stats.storyAngle && (
              <p className={css({ fontSize: '15px', color: 'gray.800', fontStyle: 'italic' })}>
                The story: {stats.storyAngle}
              </p>
            )}
            {stats.highlights && stats.highlights.length > 0 && (
              <ul
                data-element="session-highlights"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
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
                      color: 'gray.700',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start',
                    })}
                  >
                    <span aria-hidden="true">✨</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={wrap({ gap: '20px' })}>
              {stats.age != null && <Stat label="Age" value={String(stats.age)} />}
              {stats.accuracyPct != null && (
                <Stat label="Accuracy" value={`${stats.accuracyPct}%`} />
              )}
              {stats.problemsDone != null && stats.problemsTotal != null && (
                <Stat label="Problems" value={`${stats.problemsDone}/${stats.problemsTotal}`} />
              )}
              {stats.bestCorrectStreak != null && stats.bestCorrectStreak > 0 && (
                <Stat label="Best streak" value={`${stats.bestCorrectStreak} 🔥`} />
              )}
            </div>
            {stats.skills && stats.skills.length > 0 && (
              <div className={hstack({ gap: '8px', flexWrap: 'wrap' })}>
                <span className={css({ fontSize: '13px', color: 'gray.500' })}>Skills:</span>
                {stats.skills.map((sk) => (
                  <span
                    key={sk}
                    className={css({
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'green.700',
                      bg: 'green.50',
                      borderRadius: 'full',
                      px: '8px',
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

        {/* CTA */}
        <div className={vstack({ alignItems: 'center', gap: '6px', pt: '8px' })}>
          <Link
            href="/"
            className={css({
              fontSize: '14px',
              fontWeight: '700',
              color: 'purple.700',
              textDecoration: 'none',
              _hover: { textDecoration: 'underline' },
            })}
          >
            Made on Abaci.One — learn soroban through play →
          </Link>
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={vstack({ alignItems: 'flex-start', gap: '2px' })}>
      <span className={css({ fontSize: '20px', fontWeight: '800', color: 'gray.900' })}>
        {value}
      </span>
      <span
        className={css({
          fontSize: '11px',
          color: 'gray.500',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        })}
      >
        {label}
      </span>
    </div>
  )
}
