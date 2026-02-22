'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { useGameLayoutMode } from '@/contexts/GameLayoutContext'
import { css } from '../../../../styled-system/css'
import { useTypeRacerJr } from '../Provider'
import { SetupPhase } from './SetupPhase'
import { PlayingPhase } from './PlayingPhase'
import { ResultsPhase } from './ResultsPhase'

// CSS animations
const globalAnimations = `
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 8px rgba(59, 130, 246, 0.2); }
  50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(59, 130, 246, 0.4); }
  100% { transform: scale(1); box-shadow: 0 0 8px rgba(59, 130, 246, 0.2); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes bounceIn {
  0% { opacity: 0; transform: scale(0.3); }
  50% { transform: scale(1.1); }
  70% { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
`

export function TypeRacerGame() {
  const router = useRouter()
  const { state, exitSession, resetGame } = useTypeRacerJr()
  const layoutMode = useGameLayoutMode()

  const phaseContent = (
    <>
      {state.gamePhase === 'setup' && <SetupPhase />}
      {state.gamePhase === 'playing' && <PlayingPhase />}
      {state.gamePhase === 'results' && <ResultsPhase />}
    </>
  )

  // Container mode (practice game break)
  if (layoutMode === 'container') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: globalAnimations }} />
        <div
          className={css({
            bg: 'white',
            rounded: 'xl',
            shadow: 'xl',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'orange.200',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            m: '2',
          })}
        >
          <div
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'auto',
            })}
          >
            {phaseContent}
          </div>
        </div>
      </div>
    )
  }

  // Full mode with nav
  return (
    <PageWithNav
      navTitle="Type Racer Jr."
      navEmoji="⌨️"
      emphasizePlayerSelection={state.gamePhase === 'setup'}
      onExitSession={() => {
        exitSession?.()
        router.push('/arcade')
      }}
      onNewGame={() => {
        resetGame?.()
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: globalAnimations }} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          padding: '20px 8px',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
        }}
      >
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            className={css({
              textAlign: 'center',
              mb: '4',
              flexShrink: 0,
            })}
          >
            <Link
              href="/arcade"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                color: 'gray.600',
                textDecoration: 'none',
                mb: '4',
                _hover: { color: 'gray.800' },
              })}
            >
              ← Back to Champion Arena
            </Link>
          </div>

          <div
            className={css({
              bg: 'white',
              rounded: 'xl',
              shadow: 'xl',
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'orange.200',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '100%',
            })}
          >
            <div
              className={css({
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
              })}
            >
              {phaseContent}
            </div>
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
