'use client'

import { useEffect, ReactNode } from 'react'
import { css } from '../../styled-system/css'
import { FullscreenProvider, useFullscreen } from '../contexts/FullscreenContext'

interface FullscreenGameLayoutProps {
  children: ReactNode
  title: string
}

function FullscreenGameContent({ children, title }: FullscreenGameLayoutProps) {
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen()

  useEffect(() => {
    // Check if we should be in fullscreen mode
    const urlParams = new URLSearchParams(window.location.search)
    const shouldBeFullscreen = urlParams.get('fullscreen') === 'true'

    if (shouldBeFullscreen && !isFullscreen) {
      enterFullscreen()
    }
  }, [enterFullscreen, isFullscreen])

  const handleExitGame = async () => {
    await exitFullscreen()
    // Navigate back to arcade if we came from there
    window.location.href = '/arcade'
  }

  return (
    <div className={css({
      minH: 'screen',
      background: isFullscreen
        ? 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 50%, #2d1b69 100%)'
        : 'white'
    })}>
      {/* Note: Fullscreen navigation is now handled by the enhanced AppNavBar */}

      {/* Game content */}
      <div className={css({
        pt: isFullscreen ? '16' : '0', // Account for fixed nav in fullscreen
        minH: 'screen'
      })}>
        {children}
      </div>
    </div>
  )
}

export function FullscreenGameLayout({ children, title }: FullscreenGameLayoutProps) {
  return (
    <FullscreenProvider>
      <FullscreenGameContent title={title}>
        {children}
      </FullscreenGameContent>
    </FullscreenProvider>
  )
}