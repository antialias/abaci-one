'use client'

import { useEffect } from 'react'
import { css } from '../../../styled-system/css'
import { EnhancedChampionArena } from '../../components/EnhancedChampionArena'
import { FullscreenProvider, useFullscreen } from '../../contexts/FullscreenContext'

function ArcadeContent() {
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen()

  useEffect(() => {
    // Check if we should enter fullscreen (from games page navigation)
    const shouldEnterFullscreen = sessionStorage.getItem('enterArcadeFullscreen')
    if (shouldEnterFullscreen === 'true') {
      sessionStorage.removeItem('enterArcadeFullscreen')
      enterFullscreen()
    }
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

      {/* Note: Navigation is now handled by the enhanced AppNavBar */}

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

          {/* Enhanced Full-screen Champion Arena */}
          <EnhancedChampionArena
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