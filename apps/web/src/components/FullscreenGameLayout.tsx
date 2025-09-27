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
      {/* Fullscreen mini nav */}
      {isFullscreen && (
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
                🕹️ {title}
              </h1>

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
            </div>

            <div className={css({
              display: 'flex',
              gap: '2'
            })}>
              <button
                onClick={() => window.location.href = '/arcade'}
                className={css({
                  px: '3',
                  py: '1',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  rounded: 'lg',
                  color: 'blue.300',
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  _hover: {
                    background: 'rgba(59, 130, 246, 0.3)',
                    transform: 'scale(1.05)'
                  }
                })}
              >
                🏟️ Back to Arena
              </button>

              <button
                onClick={handleExitGame}
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
                ✕ Exit Fullscreen
              </button>
            </div>
          </div>
        </div>
      )}

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