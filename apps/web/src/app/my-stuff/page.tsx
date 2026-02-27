'use client'

import Link from 'next/link'
import { AppNavBar } from '@/components/AppNavBar'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { useEuclidCreations } from '@/hooks/useEuclidCreations'
import { useMyFlowcharts } from '@/hooks/useTeacherFlowcharts'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className={css({
        fontSize: '18px',
        fontWeight: '700',
        color: 'gray.800',
        mb: '12px',
      })}
    >
      {children}
    </h2>
  )
}

export default function MyStuffPage() {
  const { data: players = [], isLoading: playersLoading } = useUserPlayers()
  const { data: creations = [], isLoading: creationsLoading } = useEuclidCreations('mine', null)
  const { data: flowcharts = [], isLoading: flowchartsLoading } = useMyFlowcharts()
  const visibleFlowcharts = flowcharts.filter((f) => f.status !== 'archived')

  const visiblePlayers = players.filter((p) => !p.isArchived)

  return (
    <div
      data-component="my-stuff-page"
      className={vstack({ alignItems: 'stretch', minH: '100vh', bg: 'gray.50' })}
    >
      <AppNavBar />

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
        <h1
          className={css({
            fontSize: '28px',
            fontWeight: '800',
            color: 'gray.900',
          })}
        >
          ⭐ My Stuff
        </h1>

        {/* ── Players ── */}
        <section data-section="players">
          <SectionHeader>My Players</SectionHeader>
          {playersLoading ? (
            <p className={css({ color: 'gray.400', fontSize: '14px' })}>Loading…</p>
          ) : visiblePlayers.length === 0 ? (
            <div
              className={vstack({
                alignItems: 'flex-start',
                gap: '12px',
                p: '24px',
                bg: 'white',
                borderRadius: '12px',
                border: '1px solid token(colors.gray.200)',
              })}
            >
              <p className={css({ color: 'gray.500', fontSize: '14px' })}>
                No players yet. Add a player to track a kid&apos;s creations and progress.
              </p>
              <Link
                href="/players"
                className={css({
                  px: '14px',
                  py: '8px',
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  _hover: { bg: 'blue.700' },
                })}
              >
                Add a player
              </Link>
            </div>
          ) : (
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '12px',
              })}
            >
              {visiblePlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/my-stuff/player/${player.id}`}
                  data-action="view-player-stuff"
                  className={vstack({
                    gap: '8px',
                    p: '20px 16px',
                    bg: 'white',
                    borderRadius: '12px',
                    border: '1px solid token(colors.gray.200)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    textDecoration: 'none',
                    alignItems: 'center',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                    _hover: {
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      borderColor: 'blue.300',
                    },
                  })}
                >
                  <span className={css({ fontSize: '36px', lineHeight: '1' })}>
                    {player.emoji ?? '🧒'}
                  </span>
                  <span
                    className={css({
                      fontSize: '14px',
                      fontWeight: '600',
                      color: 'gray.800',
                      textAlign: 'center',
                    })}
                  >
                    {player.name}
                  </span>
                </Link>
              ))}
              <Link
                href="/players"
                data-action="manage-players"
                className={vstack({
                  gap: '8px',
                  p: '20px 16px',
                  bg: 'white',
                  borderRadius: '12px',
                  border: '1px dashed token(colors.gray.300)',
                  textDecoration: 'none',
                  alignItems: 'center',
                  color: 'gray.400',
                  transition: 'color 0.15s, border-color 0.15s',
                  _hover: { color: 'gray.600', borderColor: 'gray.400' },
                })}
              >
                <span className={css({ fontSize: '28px', lineHeight: '1' })}>+</span>
                <span className={css({ fontSize: '13px', fontWeight: '600' })}>Add / manage</span>
              </Link>
            </div>
          )}
        </section>

        {/* ── My Euclid Creations (user-level) ── */}
        <section data-section="euclid-creations">
          <div className={hstack({ justifyContent: 'space-between', alignItems: 'baseline', mb: '12px' })}>
            <SectionHeader>My Euclid Creations</SectionHeader>
            <Link
              href="/toys/euclid/playground"
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
          {creationsLoading ? (
            <p className={css({ color: 'gray.400', fontSize: '14px' })}>Loading…</p>
          ) : creations.length === 0 ? (
            <div
              className={vstack({
                alignItems: 'flex-start',
                gap: '12px',
                p: '24px',
                bg: 'white',
                borderRadius: '12px',
                border: '1px solid token(colors.gray.200)',
              })}
            >
              <p className={css({ color: 'gray.500', fontSize: '14px' })}>
                No creations yet. Try the Euclid playground to build something!
              </p>
              <Link
                href="/toys/euclid/playground"
                className={css({
                  px: '14px',
                  py: '8px',
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
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
              {creations.slice(0, 8).map((c) => (
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
                    _hover: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
                  })}
                >
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnail}
                      alt="Creation preview"
                      style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
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

        {/* ── My Flowcharts ── */}
        <section data-section="flowcharts">
          <div className={hstack({ justifyContent: 'space-between', alignItems: 'baseline', mb: '12px' })}>
            <SectionHeader>My Flowcharts</SectionHeader>
            <Link
              href="/flowchart/my-flowcharts"
              className={css({
                fontSize: '13px',
                fontWeight: '600',
                color: 'blue.600',
                textDecoration: 'none',
                _hover: { textDecoration: 'underline' },
              })}
            >
              Manage →
            </Link>
          </div>
          {flowchartsLoading ? (
            <p className={css({ color: 'gray.400', fontSize: '14px' })}>Loading…</p>
          ) : visibleFlowcharts.length === 0 ? (
            <div
              className={vstack({
                alignItems: 'flex-start',
                gap: '12px',
                p: '24px',
                bg: 'white',
                borderRadius: '12px',
                border: '1px solid token(colors.gray.200)',
              })}
            >
              <p className={css({ color: 'gray.500', fontSize: '14px' })}>
                No flowcharts yet. Create one to guide students through a skill.
              </p>
              <Link
                href="/flowchart/workshop"
                className={css({
                  px: '14px',
                  py: '8px',
                  bg: 'blue.600',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  _hover: { bg: 'blue.700' },
                })}
              >
                Create a flowchart
              </Link>
            </div>
          ) : (
            <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
              {visibleFlowcharts.map((f) => (
                <Link
                  key={f.id}
                  href={f.status === 'published' ? `/flowchart/${f.id}` : `/flowchart/my-flowcharts`}
                  className={hstack({
                    gap: '12px',
                    p: '14px 16px',
                    bg: 'white',
                    borderRadius: '10px',
                    border: '1px solid token(colors.gray.200)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    textDecoration: 'none',
                    alignItems: 'center',
                    _hover: { borderColor: 'blue.300', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                  })}
                >
                  <span className={css({ fontSize: '22px', flexShrink: '0' })}>{f.emoji || '📊'}</span>
                  <span className={css({ fontSize: '14px', fontWeight: '600', color: 'gray.800', flex: '1' })}>
                    {f.title}
                  </span>
                  <span
                    className={css({
                      fontSize: '11px',
                      fontWeight: '600',
                      px: '8px',
                      py: '2px',
                      borderRadius: 'full',
                      bg: f.status === 'published' ? 'green.100' : 'gray.100',
                      color: f.status === 'published' ? 'green.700' : 'gray.500',
                      flexShrink: '0',
                    })}
                  >
                    {f.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
