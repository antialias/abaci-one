'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { css } from '../../styled-system/css'
import { container, hstack } from '../../styled-system/patterns'
import { AbacusDisplayDropdown } from './AbacusDisplayDropdown'
import { useFullscreen } from '../contexts/FullscreenContext'

interface AppNavBarProps {
  variant?: 'full' | 'minimal'
}

export function AppNavBar({ variant = 'full' }: AppNavBarProps) {
  const pathname = usePathname()
  const isGamePage = pathname?.startsWith('/games')
  const isArcadePage = pathname?.startsWith('/arcade')
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen()

  // Auto-detect variant based on context
  const actualVariant = variant === 'full' && (isGamePage || isArcadePage) ? 'minimal' : variant

  // Mini nav for games/arcade (both fullscreen and non-fullscreen)
  if (actualVariant === 'minimal') {
    return (
      <header className={css({
        position: 'fixed',
        top: isFullscreen ? '4' : '4',
        right: '4',
        zIndex: 100,
        opacity: '0.95',
        _hover: { opacity: '1' },
        transition: 'all 0.3s ease'
      })}>
        <div className={hstack({ gap: '2' })}>
          {/* Arcade branding (fullscreen only) */}
          {isFullscreen && (isArcadePage || isGamePage) && (
            <div className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '3',
              px: '4',
              py: '2',
              bg: 'rgba(0, 0, 0, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              rounded: 'lg',
              shadow: 'lg',
              backdropFilter: 'blur(15px)'
            })}>
              <h1 className={css({
                fontSize: 'lg',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
                backgroundClip: 'text',
                color: 'transparent'
              })}>
                🕹️ {isArcadePage ? 'Arcade' : 'Game'}
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
                ✨ FULLSCREEN
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            px: '3',
            py: '2',
            bg: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white',
            border: '1px solid',
            borderColor: isFullscreen ? 'rgba(255, 255, 255, 0.1)' : 'gray.200',
            rounded: 'lg',
            shadow: 'lg',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none'
          })}>
            <Link
              href="/"
              className={css({
                display: 'flex',
                alignItems: 'center',
                fontSize: 'lg',
                textDecoration: 'none',
                color: isFullscreen ? 'white' : 'gray.700',
                opacity: isFullscreen ? '0.8' : '1',
                _hover: {
                  transform: 'scale(1.1)',
                  opacity: '1'
                },
                transition: 'all'
              })}
              title="Home"
            >
              🧮
            </Link>
            <div className={css({
              w: '1px',
              h: '4',
              bg: isFullscreen ? 'rgba(255, 255, 255, 0.2)' : 'gray.300'
            })} />
            <CompactNavLink href="/create" currentPath={pathname} title="Create" isFullscreen={isFullscreen}>
              ✏️
            </CompactNavLink>
            <CompactNavLink href="/guide" currentPath={pathname} title="Guide" isFullscreen={isFullscreen}>
              📖
            </CompactNavLink>
            <CompactNavLink href="/games" currentPath={pathname} title="Games" isFullscreen={isFullscreen}>
              🎮
            </CompactNavLink>
          </div>

          {/* Fullscreen Controls */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            px: '3',
            py: '2',
            bg: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white',
            border: '1px solid',
            borderColor: isFullscreen ? 'rgba(255, 255, 255, 0.1)' : 'gray.200',
            rounded: 'lg',
            shadow: 'lg',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none'
          })}>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className={css({
                display: 'flex',
                alignItems: 'center',
                p: '1',
                fontSize: 'md',
                color: isFullscreen ? 'blue.300' : 'blue.600',
                bg: isFullscreen ? 'rgba(59, 130, 246, 0.2)' : 'blue.50',
                border: '1px solid',
                borderColor: isFullscreen ? 'rgba(59, 130, 246, 0.3)' : 'blue.200',
                rounded: 'md',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                _hover: {
                  bg: isFullscreen ? 'rgba(59, 130, 246, 0.3)' : 'blue.100',
                  transform: 'scale(1.1)'
                }
              })}
            >
              {isFullscreen ? '🪟' : '⛶'}
            </button>

            {isArcadePage && (
              <button
                onClick={async () => {
                  await exitFullscreen()
                  window.location.href = '/games'
                }}
                title="Exit Arcade"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  p: '1',
                  fontSize: 'md',
                  color: isFullscreen ? 'red.300' : 'red.600',
                  bg: isFullscreen ? 'rgba(239, 68, 68, 0.2)' : 'red.50',
                  border: '1px solid',
                  borderColor: isFullscreen ? 'rgba(239, 68, 68, 0.3)' : 'red.200',
                  rounded: 'md',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  _hover: {
                    bg: isFullscreen ? 'rgba(239, 68, 68, 0.3)' : 'red.100',
                    transform: 'scale(1.1)'
                  }
                })}
              >
                🚪
              </button>
            )}
          </div>

          {/* Abacus Display Dropdown */}
          <AbacusDisplayDropdown isFullscreen={isFullscreen} />
        </div>
      </header>
    )
  }

  return (
    <header className={css({
      bg: 'white',
      shadow: 'sm',
      borderBottom: '1px solid',
      borderColor: 'gray.200',
      position: 'sticky',
      top: 0,
      zIndex: 30
    })}>
      <div className={container({ maxW: '7xl', px: '4', py: '3' })}>
        <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
          {/* Logo */}
          <Link
            href="/"
            className={css({
              fontSize: 'xl',
              fontWeight: 'bold',
              color: 'brand.800',
              textDecoration: 'none',
              _hover: { color: 'brand.900' }
            })}
          >
            🧮 Soroban Generator
          </Link>

          <div className={hstack({ gap: '6', alignItems: 'center' })}>
            {/* Navigation Links */}
            <nav className={hstack({ gap: '4' })}>
              <NavLink href="/create" currentPath={pathname}>
                Create
              </NavLink>
              <NavLink href="/guide" currentPath={pathname}>
                Guide
              </NavLink>
              <NavLink href="/games" currentPath={pathname}>
                Games
              </NavLink>
            </nav>

            {/* Abacus Style Dropdown */}
            <AbacusDisplayDropdown isFullscreen={false} />
          </div>
        </div>
      </div>
    </header>
  )
}

function NavLink({
  href,
  currentPath,
  children
}: {
  href: string
  currentPath: string | null
  children: React.ReactNode
}) {
  const isActive = currentPath === href || (href !== '/' && currentPath?.startsWith(href))

  return (
    <Link
      href={href}
      className={css({
        px: '3',
        py: '2',
        fontSize: 'sm',
        fontWeight: 'medium',
        color: isActive ? 'brand.700' : 'gray.600',
        bg: isActive ? 'brand.50' : 'transparent',
        rounded: 'lg',
        transition: 'all',
        textDecoration: 'none',
        _hover: {
          color: isActive ? 'brand.800' : 'gray.900',
          bg: isActive ? 'brand.100' : 'gray.50'
        }
      })}
    >
      {children}
    </Link>
  )
}

function CompactNavLink({
  href,
  currentPath,
  title,
  children,
  isFullscreen = false
}: {
  href: string
  currentPath: string | null
  title: string
  children: React.ReactNode
  isFullscreen?: boolean
}) {
  const isActive = currentPath === href || (href !== '/' && currentPath?.startsWith(href))

  return (
    <Link
      href={href}
      title={title}
      className={css({
        display: 'flex',
        alignItems: 'center',
        p: '1',
        fontSize: 'md',
        color: isFullscreen
          ? (isActive ? 'white' : 'rgba(255, 255, 255, 0.8)')
          : (isActive ? 'brand.600' : 'gray.500'),
        rounded: 'md',
        transition: 'all',
        textDecoration: 'none',
        _hover: {
          color: isFullscreen
            ? 'white'
            : (isActive ? 'brand.700' : 'gray.700'),
          transform: 'scale(1.1)'
        }
      })}
    >
      {children}
    </Link>
  )
}