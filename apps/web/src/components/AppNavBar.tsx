'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { css } from '../../styled-system/css'
import { container, hstack } from '../../styled-system/patterns'
import { Z_INDEX } from '../constants/zIndex'
import { useDeploymentInfo } from '../contexts/DeploymentInfoContext'
import { useFullscreen } from '../contexts/FullscreenContext'
import { useTheme } from '../contexts/ThemeContext'
import { useVisualDebug } from '../contexts/VisualDebugContext'
// Import HomeHeroContext for optional usage
import type { Subtitle } from '../data/abaciOneSubtitles'
import { getRandomSubtitle } from '../data/abaciOneSubtitles'
import { AbacusDisplayDropdown } from './AbacusDisplayDropdown'
import { ThemeToggle } from './ThemeToggle'

type HomeHeroContextValue = {
  subtitle: Subtitle
  isHeroVisible: boolean
} | null

// HomeHeroContext - imported dynamically to avoid circular deps
let HomeHeroContextModule: any = null
try {
  HomeHeroContextModule = require('../contexts/HomeHeroContext')
} catch {
  // Context not available
}

const HomeHeroContext: React.Context<HomeHeroContextValue> =
  HomeHeroContextModule?.HomeHeroContext || React.createContext<HomeHeroContextValue>(null)

// Use HomeHeroContext without requiring it
function useOptionalHomeHero(): HomeHeroContextValue {
  return useContext(HomeHeroContext)
}

interface AppNavBarProps {
  variant?: 'full' | 'minimal'
  navSlot?: React.ReactNode
}

/**
 * Hamburger menu component for utility navigation
 */
// Shared menu content component
function MenuContent({
  isFullscreen,
  isArcadePage,
  pathname,
  toggleFullscreen,
  router,
  onNavigate,
  isMobile,
  resolvedTheme,
}: {
  isFullscreen: boolean
  isArcadePage: boolean
  pathname: string | null
  toggleFullscreen: () => void
  router: any
  onNavigate?: () => void
  isMobile?: boolean
  resolvedTheme?: 'light' | 'dark'
}) {
  const isDark = resolvedTheme === 'dark'
  const { open: openDeploymentInfo } = useDeploymentInfo()
  const { isVisualDebugEnabled, toggleVisualDebug, isDebugAllowed } = useVisualDebug()

  const linkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '10px' : '10px',
    padding: isMobile ? '8px 12px' : '10px 14px',
    borderRadius: '8px',
    color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
    fontSize: isMobile ? '14px' : '14px',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'all 0.2s ease',
  }

  const separatorStyle = {
    height: '1px',
    background: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 0.8)',
    margin: isMobile ? '8px 0' : '6px 0',
  }

  const sectionHeaderStyle = {
    fontSize: isMobile ? '10px' : '10px',
    fontWeight: 600,
    color: isDark ? 'rgba(196, 181, 253, 0.7)' : 'rgba(139, 92, 246, 0.7)',
    marginBottom: isMobile ? '6px' : '6px',
    marginLeft: isMobile ? '12px' : '12px',
    marginTop: isMobile ? '6px' : '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  }

  const handleLinkClick = (href: string) => {
    if (isMobile) {
      router.push(href)
      onNavigate?.()
    }
  }

  const renderNavLink = (href: string, icon: string, label: string) => {
    const linkElement = (
      <Link
        href={href}
        onClick={
          isMobile
            ? (e) => {
                e.preventDefault()
                handleLinkClick(href)
              }
            : undefined
        }
        style={linkStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark
            ? 'rgba(139, 92, 246, 0.2)'
            : 'rgba(139, 92, 246, 0.1)'
          e.currentTarget.style.color = isDark ? 'rgba(196, 181, 253, 1)' : 'rgba(109, 40, 217, 1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)'
        }}
      >
        <span style={{ fontSize: isMobile ? '18px' : '16px' }}>{icon}</span>
        <span>{label}</span>
      </Link>
    )

    return isMobile ? linkElement : <DropdownMenu.Item asChild>{linkElement}</DropdownMenu.Item>
  }

  const containerStyle = isMobile
    ? {
        width: '100%',
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '60px 16px 16px',
        boxSizing: 'border-box' as const,
        minHeight: 0, // Allow flex children to shrink
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column' as const,
      }
    : {}

  const controlButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '10px' : '10px',
    padding: isMobile ? '8px 12px' : '10px 14px',
    borderRadius: '8px',
    color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
    fontSize: isMobile ? '14px' : '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }

  return (
    <div style={containerStyle}>
      {isMobile ? (
        <div
          className={css({
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '16px',
            minHeight: 0, // Allow grid to shrink
            flex: '1 1 auto',
            alignContent: 'start',
            overflowY: 'auto',
            '@media (min-width: 480px) and (orientation: landscape)': {
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '20px',
              gridTemplateRows: 'min-content',
            },
            '@media (max-height: 600px)': {
              gap: '8px',
            },
          })}
        >
          {/* Column 1: Navigation + Controls */}
          <div>
            {/* Site Navigation Section */}
            <div style={sectionHeaderStyle}>Navigation</div>

            {renderNavLink('/', '🧮', 'Home')}
            {renderNavLink('/create', '✏️', 'Create')}
            {renderNavLink('/practice', '📚', 'Practice')}
            {renderNavLink('/games', '🎮', 'Games')}
            {renderNavLink('/guide', '📖', 'Guide')}
            {renderNavLink('/blog', '📝', 'Blog')}

            <div style={separatorStyle} />

            {/* Controls Section */}
            <div style={sectionHeaderStyle}>Controls</div>

            <div
              onClick={() => {
                toggleFullscreen()
                onNavigate?.()
              }}
              style={controlButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(59, 130, 246, 0.2)'
                  : 'rgba(59, 130, 246, 0.1)'
                e.currentTarget.style.color = isDark
                  ? 'rgba(147, 197, 253, 1)'
                  : 'rgba(29, 78, 216, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = isDark
                  ? 'rgba(209, 213, 219, 1)'
                  : 'rgba(55, 65, 81, 1)'
              }}
            >
              <span style={{ fontSize: '18px' }}>{isFullscreen ? '🪟' : '⛶'}</span>
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
            </div>

            {isArcadePage && (
              <div
                onClick={() => {
                  router.push('/games')
                  onNavigate?.()
                }}
                style={controlButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(239, 68, 68, 0.1)'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(252, 165, 165, 1)'
                    : 'rgba(185, 28, 28, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(209, 213, 219, 1)'
                    : 'rgba(55, 65, 81, 1)'
                }}
              >
                <span style={{ fontSize: '18px' }}>🚪</span>
                <span>Exit Arcade</span>
              </div>
            )}

            {openDeploymentInfo && (
              <div
                onClick={() => {
                  openDeploymentInfo()
                  onNavigate?.()
                }}
                style={controlButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'rgba(34, 197, 94, 0.1)'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(134, 239, 172, 1)'
                    : 'rgba(21, 128, 61, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(209, 213, 219, 1)'
                    : 'rgba(55, 65, 81, 1)'
                }}
              >
                <span style={{ fontSize: '18px' }}>ℹ️</span>
                <span>Deployment Info</span>
              </div>
            )}
          </div>

          {/* Column 2: Settings + Developer */}
          <div>
            {/* Settings Link */}
            <div style={sectionHeaderStyle}>Settings</div>

            <Link
              href="/settings"
              onClick={
                isMobile
                  ? (e) => {
                      e.preventDefault()
                      handleLinkClick('/settings')
                    }
                  : undefined
              }
              style={linkStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(139, 92, 246, 0.2)'
                  : 'rgba(139, 92, 246, 0.1)'
                e.currentTarget.style.color = isDark
                  ? 'rgba(196, 181, 253, 1)'
                  : 'rgba(109, 40, 217, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = isDark
                  ? 'rgba(209, 213, 219, 1)'
                  : 'rgba(55, 65, 81, 1)'
              }}
            >
              <span style={{ fontSize: '18px' }}>⚙️</span>
              <span>Preferences</span>
            </Link>

            {/* Theme Toggle - Quick Access */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '10px',
                padding: isMobile ? '8px 12px' : '10px 14px',
              }}
            >
              <ThemeToggle />
            </div>

            {/* Abacus Style - Quick Access */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '10px' : '10px',
                padding: isMobile ? '8px 12px' : '10px 14px',
              }}
            >
              <span style={{ fontSize: isMobile ? '18px' : '16px' }}>🧮</span>
              <span
                style={{
                  fontSize: isMobile ? '14px' : '14px',
                  fontWeight: 500,
                  color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
                }}
              >
                Abacus Style
              </span>
              <AbacusDisplayDropdown />
            </div>

            {/* Developer Section - shown in dev or when ?debug=1 is used */}
            {isDebugAllowed && (
              <>
                <div style={separatorStyle} />
                <div style={sectionHeaderStyle}>Developer</div>
                <Link
                  href="/debug"
                  data-action="debug-hub-link"
                  onClick={(e) => {
                    e.preventDefault()
                    handleLinkClick('/debug')
                  }}
                  style={linkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(234, 179, 8, 0.1)'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(253, 224, 71, 1)'
                      : 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(209, 213, 219, 1)'
                      : 'rgba(55, 65, 81, 1)'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>🛠️</span>
                  <span>Debug Hub</span>
                </Link>
                <Link
                  href="/vision-training"
                  data-action="vision-training-link"
                  onClick={(e) => {
                    e.preventDefault()
                    handleLinkClick('/vision-training')
                  }}
                  style={linkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(234, 179, 8, 0.1)'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(253, 224, 71, 1)'
                      : 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(209, 213, 219, 1)'
                      : 'rgba(55, 65, 81, 1)'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>👁️</span>
                  <span>Vision Training</span>
                </Link>
                <div
                  data-setting="visual-debug"
                  onClick={() => {
                    toggleVisualDebug()
                  }}
                  style={controlButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(234, 179, 8, 0.1)'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(253, 224, 71, 1)'
                      : 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(209, 213, 219, 1)'
                      : 'rgba(55, 65, 81, 1)'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{isVisualDebugEnabled ? '🔍' : '🐞'}</span>
                  <span>Visual Debug {isVisualDebugEnabled ? 'ON' : 'OFF'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: Single column layout */}
          {/* Site Navigation Section */}
          <div style={sectionHeaderStyle}>Navigation</div>

          {renderNavLink('/', '🧮', 'Home')}
          {renderNavLink('/create', '✏️', 'Create')}
          {renderNavLink('/practice', '📚', 'Practice')}
          {renderNavLink('/games', '🎮', 'Games')}
          {renderNavLink('/guide', '📖', 'Guide')}
          {renderNavLink('/blog', '📝', 'Blog')}

          <DropdownMenu.Separator style={separatorStyle} />

          {/* Controls Section */}
          <div style={sectionHeaderStyle}>Controls</div>

          <DropdownMenu.Item
            onSelect={toggleFullscreen}
            style={controlButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? 'rgba(59, 130, 246, 0.2)'
                : 'rgba(59, 130, 246, 0.1)'
              e.currentTarget.style.color = isDark
                ? 'rgba(147, 197, 253, 1)'
                : 'rgba(29, 78, 216, 1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = isDark
                ? 'rgba(209, 213, 219, 1)'
                : 'rgba(55, 65, 81, 1)'
            }}
          >
            <span style={{ fontSize: '16px' }}>{isFullscreen ? '🪟' : '⛶'}</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
          </DropdownMenu.Item>

          {isArcadePage && (
            <DropdownMenu.Item
              onSelect={() => router.push('/games')}
              style={controlButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = isDark
                  ? 'rgba(252, 165, 165, 1)'
                  : 'rgba(185, 28, 28, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = isDark
                  ? 'rgba(209, 213, 219, 1)'
                  : 'rgba(55, 65, 81, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>🚪</span>
              <span>Exit Arcade</span>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator style={separatorStyle} />

          {/* Settings Section */}
          <div style={sectionHeaderStyle}>Settings</div>

          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              style={linkStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(139, 92, 246, 0.2)'
                  : 'rgba(139, 92, 246, 0.1)'
                e.currentTarget.style.color = isDark
                  ? 'rgba(196, 181, 253, 1)'
                  : 'rgba(109, 40, 217, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = isDark
                  ? 'rgba(209, 213, 219, 1)'
                  : 'rgba(55, 65, 81, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>⚙️</span>
              <span>Preferences</span>
            </Link>
          </DropdownMenu.Item>

          {/* Theme Toggle - Quick Access */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
            }}
          >
            <ThemeToggle />
          </div>

          {/* Abacus Style - Quick Access */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🧮</span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: isDark ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
              }}
            >
              Abacus Style
            </span>
            <AbacusDisplayDropdown />
          </div>

          {/* Developer Section - shown in dev or when ?debug=1 is used */}
          {isDebugAllowed && (
            <>
              <DropdownMenu.Separator style={separatorStyle} />
              <div style={sectionHeaderStyle}>Developer</div>
              <DropdownMenu.Item asChild>
                <Link
                  href="/debug"
                  data-action="debug-hub-link"
                  style={linkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(234, 179, 8, 0.1)'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(253, 224, 71, 1)'
                      : 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(209, 213, 219, 1)'
                      : 'rgba(55, 65, 81, 1)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🛠️</span>
                  <span>Debug Hub</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/vision-training"
                  data-action="vision-training-link"
                  style={linkStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(234, 179, 8, 0.2)'
                      : 'rgba(234, 179, 8, 0.1)'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(253, 224, 71, 1)'
                      : 'rgba(161, 98, 7, 1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = isDark
                      ? 'rgba(209, 213, 219, 1)'
                      : 'rgba(55, 65, 81, 1)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>👁️</span>
                  <span>Vision Training</span>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                data-setting="visual-debug"
                onSelect={toggleVisualDebug}
                style={controlButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark
                    ? 'rgba(234, 179, 8, 0.2)'
                    : 'rgba(234, 179, 8, 0.1)'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(253, 224, 71, 1)'
                    : 'rgba(161, 98, 7, 1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = isDark
                    ? 'rgba(209, 213, 219, 1)'
                    : 'rgba(55, 65, 81, 1)'
                }}
              >
                <span style={{ fontSize: '16px' }}>{isVisualDebugEnabled ? '🔍' : '🐞'}</span>
                <span>Visual Debug {isVisualDebugEnabled ? 'ON' : 'OFF'}</span>
              </DropdownMenu.Item>
            </>
          )}
        </>
      )}
    </div>
  )
}

function HamburgerMenu({
  isFullscreen,
  isArcadePage,
  pathname,
  toggleFullscreen,
  router,
}: {
  isFullscreen: boolean
  isArcadePage: boolean
  pathname: string | null
  toggleFullscreen: () => void
  router: any
}) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { resolvedTheme } = useTheme()

  // Detect mobile viewport - check the smaller dimension to catch landscape orientation
  React.useEffect(() => {
    const checkMobile = () => {
      // Mobile if the smaller dimension is less than 640px (catches both portrait and landscape)
      const smallerDimension = Math.min(window.innerWidth, window.innerHeight)
      setIsMobile(smallerDimension < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
  }

  const handleClose = () => {
    setOpen(false)
  }

  // Mobile full-screen menu
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            padding: '8px',
            background: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white',
            border: isFullscreen ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              color: isFullscreen ? 'white' : '#374151',
            }}
          >
            {open ? '✕' : '☰'}
          </span>
        </button>

        {open &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              <div
                className={css({
                  position: 'fixed',
                  inset: 0,
                  background:
                    resolvedTheme === 'dark'
                      ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))'
                      : 'linear-gradient(135deg, rgba(249, 250, 251, 0.97), rgba(243, 244, 246, 0.97))',
                  backdropFilter: 'blur(12px)',
                  zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  animation: 'mobileMenuFadeIn 0.2s ease-out',
                })}
                onClick={(e) => {
                  // Close if clicking the backdrop
                  if (e.target === e.currentTarget) {
                    handleClose()
                  }
                }}
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className={css({
                    position: 'fixed',
                    top: '16px',
                    right: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '44px',
                    height: '44px',
                    padding: '8px',
                    background: resolvedTheme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'white',
                    border:
                      resolvedTheme === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.1)'
                        : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: 1,
                    _hover: {
                      background: resolvedTheme === 'dark' ? 'rgba(55, 65, 81, 0.9)' : '#f9fafb',
                    },
                  })}
                  aria-label="Close menu"
                >
                  <span
                    style={{
                      fontSize: '20px',
                      color: resolvedTheme === 'dark' ? 'white' : '#374151',
                    }}
                  >
                    ✕
                  </span>
                </button>

                <MenuContent
                  isFullscreen={isFullscreen}
                  isArcadePage={isArcadePage}
                  pathname={pathname}
                  toggleFullscreen={toggleFullscreen}
                  router={router}
                  onNavigate={handleClose}
                  isMobile={true}
                  resolvedTheme={resolvedTheme}
                />
              </div>

              <style
                dangerouslySetInnerHTML={{
                  __html: `
              @keyframes mobileMenuFadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
            `,
                }}
              />
            </>,
            document.body
          )}
      </>
    )
  }

  // Desktop dropdown menu
  return (
    <DropdownMenu.Root open={open} onOpenChange={handleOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            padding: '8px',
            background: isFullscreen
              ? 'rgba(0, 0, 0, 0.85)'
              : resolvedTheme === 'dark'
                ? 'rgba(31, 41, 55, 0.9)'
                : 'white',
            border: isFullscreen
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : resolvedTheme === 'dark'
                ? '1px solid rgba(75, 85, 99, 0.5)'
                : '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              color: isFullscreen
                ? 'white'
                : resolvedTheme === 'dark'
                  ? 'rgba(209, 213, 219, 1)'
                  : '#374151',
            }}
          >
            ☰
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={8}
          onInteractOutside={(e) => {
            // Don't close the hamburger menu when clicking inside the nested style dropdown
            const target = e.target as HTMLElement
            if (
              target.closest('[role="dialog"]') ||
              target.closest('[data-radix-popper-content-wrapper]')
            ) {
              e.preventDefault()
            }
          }}
          className={css({
            background:
              resolvedTheme === 'dark'
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(249, 250, 251, 0.97))',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow:
              resolvedTheme === 'dark'
                ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)'
                : '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)',
            minWidth: '220px',
            zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU,
            animation: 'dropdownFadeIn 0.2s ease-out',
          })}
        >
          <MenuContent
            isFullscreen={isFullscreen}
            isArcadePage={isArcadePage}
            pathname={pathname}
            toggleFullscreen={toggleFullscreen}
            router={router}
            isMobile={false}
            resolvedTheme={resolvedTheme}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dropdownFadeIn {
              from {
                opacity: 0;
                transform: translateY(-4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </DropdownMenu.Root>
  )
}

/**
 * Minimal navigation for game pages - centered game context with hamburger menu
 */
function MinimalNav({
  isFullscreen,
  isArcadePage,
  pathname,
  navSlot,
  toggleFullscreen,
  exitFullscreen,
  router,
}: {
  isFullscreen: boolean
  isArcadePage: boolean
  pathname: string | null
  navSlot: React.ReactNode
  toggleFullscreen: () => void
  exitFullscreen: () => void
  router: any
}) {
  return (
    <header
      style={{
        position: 'fixed',
        top: '16px',
        left: '16px',
        right: '16px',
        zIndex: Z_INDEX.NAV_BAR,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        // Set active nav height for content to use
        ['--app-nav-height' as any]: 'var(--app-nav-height-minimal)',
        // Use the variable for min-height to ensure consistency
        minHeight: 'var(--app-nav-height-minimal)',
      }}
      className={css({ _print: { display: 'none' } })}
    >
      {/* Hamburger Menu - positioned absolutely on left */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          pointerEvents: 'auto',
        }}
      >
        <HamburgerMenu
          isFullscreen={isFullscreen}
          isArcadePage={isArcadePage}
          pathname={pathname}
          toggleFullscreen={toggleFullscreen}
          router={router}
        />
      </div>

      {/* Centered Game Context */}
      {navSlot && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            background: isFullscreen ? 'rgba(0, 0, 0, 0.85)' : 'white',
            border: isFullscreen ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            backdropFilter: isFullscreen ? 'blur(15px)' : 'none',
            opacity: '0.95',
            transition: 'opacity 0.3s ease',
            pointerEvents: 'auto',
            maxWidth: 'calc(100% - 128px)', // Leave space for hamburger + margin
            whiteSpace: 'nowrap',
            overflow: 'visible',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.95'
          }}
        >
          {navSlot}
          {isFullscreen && (
            <div
              style={{
                padding: '4px 8px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '9999px',
                fontSize: '12px',
                color: 'rgb(134, 239, 172)',
                fontWeight: 600,
              }}
            >
              ✨ FULLSCREEN
            </div>
          )}
        </div>
      )}
    </header>
  )
}

export function AppNavBar({ variant = 'full', navSlot }: AppNavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isArcadePage = pathname?.startsWith('/arcade')
  const isVisionTrainingPage = pathname?.startsWith('/vision-training')
  const isHomePage = pathname === '/'
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen()
  const { open: openDeploymentInfo } = useDeploymentInfo()

  // Try to get home hero context (if on homepage)
  const homeHero = useOptionalHomeHero()

  // Select a random subtitle once on mount (performance: won't change on re-renders)
  // Use homeHero subtitle if available, otherwise generate one
  const fallbackSubtitle = useMemo(() => getRandomSubtitle(), [])
  const subtitle = homeHero?.subtitle || fallbackSubtitle

  // Show branding unless we're on homepage with visible hero
  const showBranding = !isHomePage || !homeHero || !homeHero.isHeroVisible

  // Auto-detect variant based on context
  // Arcade and vision training pages use minimal nav with hamburger + centered content
  const actualVariant =
    variant === 'full' && (isArcadePage || isVisionTrainingPage) ? 'minimal' : variant

  // Mini nav for games/arcade (both fullscreen and non-fullscreen)
  if (actualVariant === 'minimal') {
    return (
      <MinimalNav
        isFullscreen={isFullscreen}
        isArcadePage={isArcadePage}
        pathname={pathname}
        navSlot={navSlot}
        toggleFullscreen={toggleFullscreen}
        exitFullscreen={exitFullscreen}
        router={router}
      />
    )
  }

  // Check if we should use transparent styling (when hero is visible on home page)
  const isTransparent = isHomePage && homeHero?.isHeroVisible

  return (
    <Tooltip.Provider delayDuration={200}>
      <header
        style={{
          // Set active nav height for content to use
          ['--app-nav-height' as any]: 'var(--app-nav-height-full)',
          // Use the variable for min-height to ensure consistency
          minHeight: 'var(--app-nav-height-full)',
        }}
        className={css({
          bg: isTransparent ? 'transparent' : 'rgba(0, 0, 0, 0.5)',
          backdropFilter: isTransparent ? 'none' : 'blur(12px)',
          shadow: isTransparent ? 'none' : 'lg',
          borderBottom: isTransparent ? 'none' : '1px solid',
          borderColor: isTransparent ? 'transparent' : 'rgba(139, 92, 246, 0.2)',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: Z_INDEX.NAV_BAR,
          transition: 'all 0.3s ease',
          // Hide when printing
          _print: { display: 'none' },
        })}
      >
        <div className={container({ maxW: '7xl', px: '4', py: '3' })}>
          <div
            className={hstack({
              justify: 'space-between',
              alignItems: 'center',
            })}
          >
            {/* Logo - conditionally shown based on hero visibility */}
            {showBranding ? (
              <Link
                href="/"
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0',
                  textDecoration: 'none',
                  _hover: {
                    '& > .brand-name': { color: 'rgba(196, 181, 253, 1)' },
                  },
                  opacity: 0,
                  animation: 'fadeIn 0.3s ease-out forwards',
                })}
              >
                <span
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: 'rgba(255, 255, 255, 0.95)',
                  })}
                >
                  Abaci One
                </span>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span
                      className={css({
                        fontSize: 'xs',
                        fontWeight: 'medium',
                        color: 'rgba(196, 181, 253, 0.8)',
                        fontStyle: 'italic',
                        cursor: 'help',
                        whiteSpace: 'nowrap',
                        _hover: { color: 'rgba(196, 181, 253, 1)' },
                      })}
                    >
                      {subtitle.text}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="bottom"
                      align="start"
                      sideOffset={4}
                      className={css({
                        bg: 'gray.900',
                        color: 'white',
                        px: '3',
                        py: '2',
                        rounded: 'md',
                        fontSize: 'sm',
                        maxW: '250px',
                        shadow: 'lg',
                        zIndex: Z_INDEX.TOOLTIP,
                      })}
                    >
                      {subtitle.description}
                      <Tooltip.Arrow
                        className={css({
                          fill: 'gray.900',
                        })}
                      />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Link>
            ) : (
              <div />
            )}

            <div className={hstack({ gap: '6', alignItems: 'center' })}>
              {/* Navigation Links - progressively hide as viewport narrows */}
              <nav className={hstack({ gap: '4' })}>
                {/* Create - always visible when nav is shown */}
                <div className={css({ display: { base: 'none', sm: 'block' } })}>
                  <NavLink href="/create" currentPath={pathname} isTransparent={isTransparent}>
                    Create
                  </NavLink>
                </div>

                {/* Practice - hidden below md breakpoint */}
                <div className={css({ display: { base: 'none', md: 'block' } })}>
                  <NavLink href="/practice" currentPath={pathname} isTransparent={isTransparent}>
                    Practice
                  </NavLink>
                </div>

                {/* Games - hidden below lg breakpoint */}
                <div className={css({ display: { base: 'none', lg: 'block' } })}>
                  <NavLink href="/games" currentPath={pathname} isTransparent={isTransparent}>
                    Games
                  </NavLink>
                </div>

                {/* Blog - hidden below xl breakpoint */}
                <div className={css({ display: { base: 'none', xl: 'block' } })}>
                  <NavLink href="/blog" currentPath={pathname} isTransparent={isTransparent}>
                    Blog
                  </NavLink>
                </div>
              </nav>

              {/* Hamburger Menu - always visible, contains all links that don't fit */}
              <HamburgerMenu
                isFullscreen={false}
                isArcadePage={false}
                pathname={pathname}
                toggleFullscreen={toggleFullscreen}
                router={router}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Keyframes for fade-in animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(-5px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `,
        }}
      />
    </Tooltip.Provider>
  )
}

function NavLink({
  href,
  currentPath,
  children,
  isTransparent,
}: {
  href: string
  currentPath: string | null
  children: React.ReactNode
  isTransparent?: boolean
}) {
  const isActive = currentPath === href || (href !== '/' && currentPath?.startsWith(href))

  return (
    <Link
      href={href}
      style={{
        backdropFilter: isTransparent ? 'blur(8px)' : 'none',
      }}
      className={css({
        px: { base: '4', md: '3' },
        py: { base: '3', md: '2' },
        minH: { base: '44px', md: 'auto' },
        minW: { base: '44px', md: 'auto' },
        fontSize: 'sm',
        fontWeight: 'medium',
        color: isTransparent
          ? isActive
            ? 'text.primary'
            : 'text.secondary'
          : isActive
            ? 'rgba(196, 181, 253, 1)'
            : 'rgba(209, 213, 219, 0.9)',
        bg: isTransparent
          ? isActive
            ? 'bg.muted'
            : 'bg.subtle'
          : isActive
            ? 'rgba(139, 92, 246, 0.2)'
            : 'transparent',
        border: isTransparent ? '1px solid' : 'none',
        borderColor: isTransparent
          ? isActive
            ? 'border.default'
            : 'border.subtle'
          : 'transparent',
        rounded: 'lg',
        transition: 'all',
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isTransparent ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
        _hover: {
          color: isTransparent ? 'text.primary' : 'rgba(196, 181, 253, 1)',
          bg: isTransparent ? 'interactive.hover' : 'rgba(139, 92, 246, 0.25)',
          borderColor: isTransparent ? 'border.emphasis' : 'transparent',
          boxShadow: isTransparent ? '0 4px 12px rgba(0, 0, 0, 0.3)' : 'none',
        },
      })}
    >
      {children}
    </Link>
  )
}
