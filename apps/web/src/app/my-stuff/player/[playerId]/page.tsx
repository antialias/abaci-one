'use client'

import Link from 'next/link'
import { AppNavBar } from '@/components/AppNavBar'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { useEuclidCreations } from '@/hooks/useEuclidCreations'
import { usePostcards } from '@/hooks/usePostcards'
import { css } from '../../../../../styled-system/css'
import { vstack, hstack } from '../../../../../styled-system/patterns'

interface Props {
  params: { playerId: string }
}

export default function PlayerStuffPage({ params }: Props) {
  const { playerId } = params
  const { data: players = [] } = useUserPlayers()
  const { data: creations = [], isLoading } = useEuclidCreations('mine', playerId)
  const { data: postcards = [], isLoading: postcardsLoading } = usePostcards(playerId)

  const player = players.find((p) => p.id === playerId)
  const emoji = player?.emoji ?? '🧒'
  const name = player?.name ?? '…'

  return (
    <div
      data-component="player-stuff-page"
      className={vstack({ alignItems: 'stretch', minH: '100vh', bg: 'gray.50' })}
    >
      <AppNavBar
        navSlot={
          <Link
            href="/my-stuff"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'rgba(55, 65, 81, 1)',
              textDecoration: 'none',
            }}
          >
            ← My Stuff
          </Link>
        }
      />

      <main
        className={vstack({
          alignItems: 'stretch',
          maxW: '860px',
          w: '100%',
          mx: 'auto',
          px: '16px',
          pt: 'calc(var(--app-nav-height) + 32px)',
          pb: '48px',
          gap: '40px',
        })}
      >
        {/* Player header */}
        <div className={hstack({ gap: '16px', alignItems: 'center' })}>
          <span
            className={css({
              fontSize: '52px',
              lineHeight: '1',
              w: '72px',
              h: '72px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bg: 'white',
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid token(colors.gray.200)',
            })}
          >
            {emoji}
          </span>
          <div className={vstack({ alignItems: 'flex-start', gap: '2px' })}>
            <h1
              className={css({
                fontSize: '26px',
                fontWeight: '800',
                color: 'gray.900',
              })}
            >
              {name}&apos;s Stuff
            </h1>
            <span className={css({ fontSize: '13px', color: 'gray.500' })}>
              Creations & postcards
            </span>
          </div>
        </div>

        {/* ── Number Line Postcards ── */}
        {(postcards.length > 0 || postcardsLoading) && (
          <section data-section="postcards">
            <h2
              className={css({
                fontSize: '18px',
                fontWeight: '700',
                color: 'gray.800',
                mb: '12px',
              })}
            >
              Memories from the Number Line
            </h2>

            {postcardsLoading ? (
              <p className={css({ color: 'gray.400', fontSize: '14px' })}>Loading…</p>
            ) : (
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                })}
              >
                {postcards
                  .filter((p) => p.status === 'ready')
                  .map((p) => (
                    <Link
                      key={p.id}
                      href={`/my-stuff/postcards/${p.id}`}
                      className={css({
                        display: 'block',
                        textDecoration: 'none',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: '1px solid token(colors.gray.200)',
                        bg: 'white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'box-shadow 0.15s, transform 0.15s',
                        _hover: {
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          transform: 'translateY(-2px)',
                        },
                        position: 'relative',
                      })}
                    >
                      {!p.isRead && (
                        <span
                          className={css({
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            w: '10px',
                            h: '10px',
                            borderRadius: '50%',
                            bg: 'blue.500',
                            border: '2px solid white',
                          })}
                        />
                      )}
                      {p.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.thumbnailUrl}
                          alt={`Postcard from ${p.callerNumber}`}
                          style={{
                            width: '100%',
                            aspectRatio: '4/3',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '4/3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'linear-gradient(135deg, #E0F2FE, #FDE68A)',
                            fontSize: 32,
                          }}
                        >
                          {Number.isInteger(p.callerNumber)
                            ? p.callerNumber
                            : p.callerNumber.toPrecision(4)}
                        </div>
                      )}
                      <div className={css({ p: '8px 10px' })}>
                        <span
                          className={css({
                            fontSize: '13px',
                            fontWeight: '600',
                            color: 'gray.700',
                          })}
                        >
                          From #
                          {Number.isInteger(p.callerNumber)
                            ? p.callerNumber
                            : p.callerNumber.toPrecision(4)}
                        </span>
                        <span
                          className={css({
                            display: 'block',
                            fontSize: '11px',
                            color: 'gray.400',
                            mt: '2px',
                          })}
                        >
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                {postcards.some((p) => p.status === 'generating' || p.status === 'pending') && (
                  <div
                    className={css({
                      borderRadius: '12px',
                      border: '1px dashed token(colors.gray.300)',
                      bg: 'gray.50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      aspectRatio: '4/3',
                      color: 'gray.400',
                      fontSize: '13px',
                      fontStyle: 'italic',
                    })}
                  >
                    Creating postcard…
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Euclid Creations ── */}
        <section data-section="euclid-creations">
          <div
            className={hstack({
              justifyContent: 'space-between',
              alignItems: 'baseline',
              mb: '12px',
            })}
          >
            <h2
              className={css({
                fontSize: '18px',
                fontWeight: '700',
                color: 'gray.800',
              })}
            >
              Euclid Creations
            </h2>
            <Link
              href={`/toys/euclid/playground?player=${encodeURIComponent(playerId)}`}
              className={css({
                fontSize: '13px',
                fontWeight: '600',
                color: 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Open playground →
            </Link>
          </div>

          {isLoading ? (
            <p className={css({ color: 'gray.400', fontSize: '14px' })}>Loading…</p>
          ) : creations.length === 0 ? (
            <div
              className={vstack({
                alignItems: 'center',
                gap: '16px',
                p: '40px 24px',
                bg: 'white',
                borderRadius: '16px',
                border: '1px solid token(colors.gray.200)',
                textAlign: 'center',
              })}
            >
              <span className={css({ fontSize: '48px' })}>🔵📐</span>
              <p className={css({ color: 'gray.500', fontSize: '15px', maxW: '280px' })}>
                No creations yet! Open the Euclid playground to start building.
              </p>
              <Link
                href={`/toys/euclid/playground?player=${encodeURIComponent(playerId)}`}
                className={css({
                  px: '20px',
                  py: '10px',
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  _hover: { bg: 'blue.700' },
                })}
              >
                Open playground
              </Link>
            </div>
          ) : (
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '10px',
              })}
            >
              {creations.map((c) => (
                <Link
                  key={c.id}
                  href={`/toys/euclid/creations/${c.id}`}
                  className={css({
                    display: 'block',
                    textDecoration: 'none',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid token(colors.gray.200)',
                    bg: '#FAFAF0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    transition: 'box-shadow 0.15s',
                    _hover: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                  })}
                >
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnail}
                      alt="Creation preview"
                      style={{
                        width: '100%',
                        aspectRatio: '4/3',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '4/3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d1d5db',
                        fontSize: 28,
                      }}
                    >
                      ◯
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
