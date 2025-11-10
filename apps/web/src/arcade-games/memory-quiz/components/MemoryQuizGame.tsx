'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'
import { useMemoryQuiz } from '../Provider'
import { DisplayPhase } from './DisplayPhase'
import { InputPhase } from './InputPhase'
import { ResultsPhase } from './ResultsPhase'
import { SetupPhase } from './SetupPhase'

// CSS animations that need to be global
const globalAnimations = `
@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
  50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5); }
  100% { transform: scale(1); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
}

@keyframes subtlePageFlash {
  0% { background: linear-gradient(to bottom right, #f0fdf4, #ecfdf5); }
  50% { background: linear-gradient(to bottom right, #dcfce7, #d1fae5); }
  100% { background: linear-gradient(to bottom right, #f0fdf4, #ecfdf5); }
}

@keyframes fadeInScale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes explode {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.5);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2) rotate(180deg);
  }
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
`

export function MemoryQuizGame() {
  const router = useRouter()
  const { state, exitSession, resetGame } = useMemoryQuiz()

  return (
    <PageWithNav
      navTitle="Memory Lightning"
      navEmoji="🧠"
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
          background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
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
              borderColor: 'gray.200',
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
              {state.gamePhase === 'setup' && <SetupPhase />}
              {state.gamePhase === 'display' && <DisplayPhase />}
              {state.gamePhase === 'input' && <InputPhase key="input-phase" />}
              {state.gamePhase === 'results' && <ResultsPhase />}
            </div>
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}
