'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { css } from '../../styled-system/css'
import { container, hstack } from '../../styled-system/patterns'
import { AbacusDisplayDropdown } from './AbacusDisplayDropdown'
import { useFullscreen } from '../contexts/FullscreenContext'
import { useGameTheme } from '../contexts/GameThemeContext'

interface AppNavBarProps {
  variant?: 'full' | 'minimal'
}

export function AppNavBar({ variant = 'full' }: AppNavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isGamePage = pathname?.startsWith('/games')
  const isArcadePage = pathname?.startsWith('/arcade')
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen()
  const { theme: gameTheme, isHydrated } = useGameTheme()

  // Route-based theme detection as fallback for page reloads
  const getRouteBasedTheme = () => {
    if (pathname === '/games/memory-quiz') {
      return {
        gameName: "Memory Lightning",
        backgroundColor: "linear-gradient(to bottom right, #f0fdf4, #eff6ff)"
      }
    }
    if (pathname === '/games/matching') {
      return {
        gameName: "Memory Pairs",
        backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      }
    }
    return null
  }

  // Use context theme if available, otherwise fall back to route-based detection
  const currentTheme = gameTheme || getRouteBasedTheme()

  // Helper function to get themed background colors
  const getThemedBackground = (opacity: number = 0.85) => {
    // Only apply theming after hydration to prevent SSR/client mismatch
    if (isHydrated && currentTheme?.backgroundColor) {
      const color = currentTheme.backgroundColor
      if (color.startsWith('#')) {
        // Convert hex to rgba
        const hex = color.slice(1)
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return `rgba(${r}, ${g}, ${b}, ${opacity})`
      } else if (color.startsWith('rgb')) {
        // Handle rgb/rgba formats
        const match = color.match(/rgba?\(([^)]+)\)/)
        if (match) {
          const values = match[1].split(',').map(v => v.trim())
          if (values.length >= 3) {
            return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${opacity})`
          }
        }
      } else if (color.startsWith('linear-gradient')) {
        // Extract colors from gradient and use dominant color
        const hexMatch = color.match(/#[0-9a-fA-F]{6}/g)
        if (hexMatch && hexMatch.length > 0) {
          // Use the first color from the gradient
          const hex = hexMatch[0].slice(1)
          const r = parseInt(hex.slice(0, 2), 16)
          const g = parseInt(hex.slice(2, 4), 16)
          const b = parseInt(hex.slice(4, 6), 16)
          return `rgba(${r}, ${g}, ${b}, ${opacity})`
        }
        // Fallback: try to extract rgb values
        const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)
        if (rgbMatch && rgbMatch.length > 0) {
          const values = rgbMatch[0].match(/\d+/g)
          if (values && values.length >= 3) {
            return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${opacity})`
          }
        }
        // Final fallback for gradients
        return isFullscreen ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`
      }
    }
    return isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white'
  }

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
          {/* Game branding (fullscreen only) */}
          {isFullscreen && (isArcadePage || isGamePage) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 16px',
                background: isHydrated && currentTheme ? getThemedBackground(0.85) : 'rgba(0, 0, 0, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(15px)'
              }}
            >
              <h1 className={css({
                fontSize: 'lg',
                fontWeight: 'bold',
                background: gameTheme ? 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)' : 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6)',
                backgroundClip: 'text',
                color: 'transparent'
              })}>
                🕹️ {(isHydrated && currentTheme?.gameName) || (isArcadePage ? 'Arcade' : 'Game')}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: isHydrated && currentTheme ? getThemedBackground(isFullscreen ? 0.85 : 1) : (isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white'),
              border: isFullscreen ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              backdropFilter: isFullscreen ? 'blur(15px)' : 'none'
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: isHydrated && currentTheme ? getThemedBackground(isFullscreen ? 0.85 : 1) : (isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white'),
              border: isFullscreen ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              backdropFilter: isFullscreen ? 'blur(15px)' : 'none'
            }}
          >
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
                onClick={() => {
                  console.log('🔄 AppNavBar: Navigating to games with Next.js router (no page reload)')
                  router.push('/games')
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
        px: { base: '4', md: '3' },
        py: { base: '3', md: '2' },
        minH: { base: '44px', md: 'auto' },
        minW: { base: '44px', md: 'auto' },
        fontSize: 'sm',
        fontWeight: 'medium',
        color: isActive ? 'brand.700' : 'gray.600',
        bg: isActive ? 'brand.50' : 'transparent',
        rounded: 'lg',
        transition: 'all',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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