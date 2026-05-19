'use client'

import Link from 'next/link'
import { AppNavBar } from '@/components/AppNavBar'
import {
  PostcardsSection,
  CelebrationSongsSection,
  EuclidCreationsSection,
} from '@/components/my-stuff/PlayerStuffSections'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { css } from '../../../../../styled-system/css'
import { vstack, hstack } from '../../../../../styled-system/patterns'

interface Props {
  params: { playerId: string }
}

export default function PlayerStuffPage({ params }: Props) {
  const { playerId } = params
  const { data: players = [] } = useUserPlayers()

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
              Songs, creations & postcards
            </span>
          </div>
        </div>

        <PostcardsSection playerId={playerId} />
        <CelebrationSongsSection playerId={playerId} />
        <EuclidCreationsSection playerId={playerId} />
      </main>
    </div>
  )
}
