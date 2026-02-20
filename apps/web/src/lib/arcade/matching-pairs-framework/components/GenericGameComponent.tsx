'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../styled-system/css'
import { StandardGameLayout } from '@/components/StandardGameLayout'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { GenericSetupPhase } from './GenericSetupPhase'
import { GenericGamePhase } from './GenericGamePhase'
import { GenericResultsPhase } from './GenericResultsPhase'
import type {
  BaseMatchingCard,
  BaseMatchingConfig,
  MatchingPairsContextValue,
  MatchingPairsVariant,
} from '../types'

/**
 * Create a game component for a matching-pairs variant.
 * Returns a React component that renders the full game with phase routing.
 */
export function createMatchingPairsGameComponent<
  TCard extends BaseMatchingCard,
  TConfig extends BaseMatchingConfig,
>(
  variant: MatchingPairsVariant<TCard, TConfig>,
  useMatchingPairs: () => MatchingPairsContextValue<TCard, TConfig>
): () => JSX.Element {
  function MatchingPairsGameComponent() {
    const router = useRouter()
    const ctx = useMatchingPairs()
    const { state, exitSession, resetGame, goToSetup } = ctx
    const { setFullscreenElement } = useFullscreen()
    const gameRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (gameRef.current) {
        setFullscreenElement(gameRef.current)
      }
    }, [setFullscreenElement])

    // Get nav info from variant
    const config = state as unknown as TConfig
    const navInfo = variant.getNavInfo?.(config) ?? { title: variant.gameName, emoji: '🎮' }

    return (
      <PageWithNav
        navTitle={navInfo.title}
        navEmoji={navInfo.emoji}
        emphasizePlayerSelection={state.gamePhase === 'setup'}
        onExitSession={() => {
          exitSession()
          router.push('/arcade')
        }}
        onSetup={
          goToSetup
            ? () => {
                goToSetup()
              }
            : undefined
        }
        onNewGame={() => {
          resetGame()
        }}
        currentPlayerId={state.currentPlayer}
        playerScores={state.scores}
        playerStreaks={state.consecutiveMatches}
      >
        <StandardGameLayout>
          <div
            ref={gameRef}
            className={css({
              flex: 1,
              padding: { base: '12px', sm: '16px', md: '20px' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              overflow: 'auto',
            })}
          >
            <main
              className={css({
                width: '100%',
                maxWidth: '1200px',
                background: 'rgba(255,255,255,0.95)',
                borderRadius: { base: '12px', md: '20px' },
                padding: { base: '12px', sm: '16px', md: '24px', lg: '32px' },
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              })}
            >
              {state.gamePhase === 'setup' && (
                <GenericSetupPhase ctx={ctx} SetupContent={variant.SetupContent} />
              )}
              {state.gamePhase === 'playing' && <GenericGamePhase ctx={ctx} variant={variant} />}
              {state.gamePhase === 'results' && (
                <GenericResultsPhase ctx={ctx} gameName={variant.gameName} />
              )}
            </main>
          </div>
        </StandardGameLayout>
      </PageWithNav>
    )
  }

  return MatchingPairsGameComponent
}
