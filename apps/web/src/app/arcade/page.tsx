'use client'

import { useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { ChampionArena } from '../../components/ChampionArena'
import { FullscreenProvider, useFullscreen } from '../../contexts/FullscreenContext'

function ArcadeContent() {
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen()

  useEffect(() => {
    // Automatically enter fullscreen when page loads
    enterFullscreen()
  }, [enterFullscreen])

  const handleExitArcade = async () => {
    await exitFullscreen()
    // Navigate back to games page
    window.location.href = '/games'
  }

  return (
    <div className={css({
      minH: 'screen',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)',
      position: 'relative',
      overflow: 'hidden'
    })}>
      {/* Animated background elements */}
      <div className={css({
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
        `,
        animation: 'arcadeFloat 20s ease-in-out infinite'
      })} />

      {/* Mini nav bar */}
      <div className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        py: '2',
        px: '4'
      })}>
        <div className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxW: '6xl',
          mx: 'auto'
        })}>
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '3'
          })}>
            <h1 className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
              backgroundClip: 'text',
              color: 'transparent'
            })}>
              🕹️ Soroban Arcade
            </h1>

            {isFullscreen && (
              <div className={css({
                px: '2',
                py: '1',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                rounded: 'full',
                fontSize: 'xs',
                color: 'green.300',
                fontWeight: 'semibold'
              })}>
                ✨ FULLSCREEN MODE
              </div>
            )}
          </div>

          <button
            onClick={handleExitArcade}
            className={css({
              px: '3',
              py: '1',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              rounded: 'lg',
              color: 'red.300',
              fontSize: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              _hover: {
                background: 'rgba(239, 68, 68, 0.3)',
                transform: 'scale(1.05)'
              }
            })}
          >
            ✕ Exit Arcade
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={css({
        pt: '16', // Account for fixed nav
        pb: '8',
        px: '4',
        position: 'relative',
        zIndex: 1
      })}>
        <div className={css({
          maxW: '7xl',
          mx: 'auto'
        })}>
          {/* Arcade title */}
          <div className={css({
            textAlign: 'center',
            mb: '8'
          })}>
            <h2 className={css({
              fontSize: { base: '3xl', md: '5xl' },
              fontWeight: 'black',
              background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
              backgroundClip: 'text',
              color: 'transparent',
              mb: '4',
              textShadow: '0 0 30px rgba(96, 165, 250, 0.5)'
            })}>
              🏟️ CHAMPION ARENA
            </h2>

            <p className={css({
              fontSize: 'xl',
              color: 'gray.300',
              maxW: '2xl',
              mx: 'auto'
            })}>
              Select your champions and dive into epic mathematical battles!
            </p>
          </div>

          {/* Full-screen Champion Arena */}
          <ChampionArena
            onConfigurePlayer={() => {}}
            className={css({
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
            })}
          />
        </div>
      </div>
    </div>
  )
}

export default function ArcadePage() {
  return (
    <FullscreenProvider>
      <ArcadeContent />
    </FullscreenProvider>
  )
}

// Arcade-specific animations
const arcadeAnimations = `
@keyframes arcadeFloat {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
    opacity: 0.7;
  }
  33% {
    transform: translateY(-20px) rotate(1deg);
    opacity: 1;
  }
  66% {
    transform: translateY(-10px) rotate(-1deg);
    opacity: 0.8;
  }
}

@keyframes arcadePulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(96, 165, 250, 0.6);
  }
}
`

// Inject arcade animations
if (typeof document !== 'undefined' && !document.getElementById('arcade-animations')) {
  const style = document.createElement('style')
  style.id = 'arcade-animations'
  style.textContent = arcadeAnimations
  document.head.appendChild(style)
}