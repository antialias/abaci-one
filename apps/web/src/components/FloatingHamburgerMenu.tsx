'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import Link from 'next/link'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useFullscreen } from '@/contexts/FullscreenContext'
import { useDeploymentInfo } from '@/contexts/DeploymentInfoContext'
import { css } from '../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'

/**
 * FloatingHamburgerMenu - Minimal distraction-free menu
 *
 * A standalone hamburger menu that floats in the corner of the screen.
 * Use this when you want to hide the full app nav but still provide
 * access to navigation, settings, and theme toggle.
 *
 * Usage:
 *   <FloatingHamburgerMenu position="top-left" />
 */

interface FloatingHamburgerMenuProps {
  /** Corner position for the menu button */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /** Optional callback when user exits (e.g., back to main area) */
  onExit?: () => void
  /** Label for exit button (default: "Exit") */
  exitLabel?: string
}

export function FloatingHamburgerMenu({
  position = 'top-left',
  onExit,
  exitLabel = 'Exit',
}: FloatingHamburgerMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const { open: openDeploymentInfo } = useDeploymentInfo()

  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open])

  const handleClose = useCallback(() => setOpen(false), [])

  const isDark = resolvedTheme === 'dark'

  // Position styles based on prop
  const positionStyles = {
    'top-left': { top: '16px', left: '16px' },
    'top-right': { top: '16px', right: '16px' },
    'bottom-left': { bottom: '16px', left: '16px' },
    'bottom-right': { bottom: '16px', right: '16px' },
  }

  const buttonStyle = css({
    width: '44px',
    height: '44px',
    borderRadius: 'lg',
    border: '1px solid',
    borderColor: { base: 'gray.200', _dark: 'gray.700' },
    backgroundColor: { base: 'white', _dark: 'gray.800' },
    boxShadow: 'md',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    _hover: {
      backgroundColor: { base: 'gray.50', _dark: 'gray.700' },
      boxShadow: 'lg',
    },
  })

  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    fontSize: '14px',
    color: isDark ? '#e2e8f0' : '#1e293b',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'background-color 0.15s ease',
    textDecoration: 'none',
    width: '100%',
    border: 'none',
    background: 'transparent',
  }

  const menuItemHoverStyle = {
    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  }

  // Navigation links
  const navLinks = [
    { href: '/', label: 'Home', emoji: '🏠' },
    { href: '/create', label: 'Create', emoji: '✏️' },
    { href: '/practice', label: 'Practice', emoji: '🎯' },
    { href: '/flowchart', label: 'Flowcharts', emoji: '🗺️' },
    { href: '/games', label: 'Games', emoji: '🎮' },
  ]

  // Mobile: Full-screen overlay
  if (isMobile && open) {
    return (
      <>
        {/* Trigger button (hidden when menu open) */}
        <div
          style={{
            position: 'fixed',
            ...positionStyles[position],
            zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU,
          }}
        />

        {/* Full-screen overlay */}
        <div
          data-testid="floating-menu-overlay"
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#e2e8f0' : '#1e293b',
              fontSize: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Menu content */}
          <div style={{ marginTop: '60px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Exit button if provided */}
            {onExit && (
              <button
                onClick={() => {
                  onExit()
                  handleClose()
                }}
                style={{
                  ...menuItemStyle,
                  marginBottom: '16px',
                  background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                  color: isDark ? '#fca5a5' : '#dc2626',
                }}
              >
                <span style={{ fontSize: '18px' }}>🚪</span>
                <span>{exitLabel}</span>
              </button>
            )}

            {/* Navigation */}
            <div
              style={{
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: isDark ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 16px',
              }}
            >
              Navigate
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleClose}
                style={{
                  ...menuItemStyle,
                  background:
                    pathname === link.href
                      ? isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)'
                      : 'transparent',
                }}
              >
                <span style={{ fontSize: '18px' }}>{link.emoji}</span>
                <span>{link.label}</span>
              </Link>
            ))}

            {/* Divider */}
            <div
              style={{
                height: '1px',
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                margin: '12px 0',
              }}
            />

            {/* Controls */}
            <div
              style={{
                marginBottom: '8px',
                fontSize: '12px',
                fontWeight: '600',
                color: isDark ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 16px',
              }}
            >
              Controls
            </div>

            {/* Fullscreen */}
            <button
              onClick={() => {
                toggleFullscreen()
                handleClose()
              }}
              style={menuItemStyle}
            >
              <span style={{ fontSize: '18px' }}>{isFullscreen ? '🪟' : '⛶'}</span>
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => {
                setTheme(isDark ? 'light' : 'dark')
                handleClose()
              }}
              style={menuItemStyle}
            >
              <span style={{ fontSize: '18px' }}>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* Deployment info */}
            <button
              onClick={() => {
                openDeploymentInfo()
                handleClose()
              }}
              style={menuItemStyle}
            >
              <span style={{ fontSize: '18px' }}>ℹ️</span>
              <span>App Info</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  // Desktop: Dropdown menu
  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        zIndex: Z_INDEX.GAME_NAV.HAMBURGER_MENU,
      }}
    >
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            data-testid="floating-hamburger-button"
            className={buttonStyle}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke={isDark ? '#e2e8f0' : '#1e293b'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            data-testid="floating-menu-content"
            sideOffset={8}
            align={position.includes('left') ? 'start' : 'end'}
            style={{
              minWidth: '200px',
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderRadius: '12px',
              padding: '8px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              zIndex: Z_INDEX.GAME_NAV.HAMBURGER_NESTED_DROPDOWN,
            }}
          >
            {/* Exit button if provided */}
            {onExit && (
              <>
                <DropdownMenu.Item
                  onSelect={onExit}
                  style={{
                    ...menuItemStyle,
                    background: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                    color: isDark ? '#fca5a5' : '#dc2626',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(239, 68, 68, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(239, 68, 68, 0.1)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🚪</span>
                  <span>{exitLabel}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Separator
                  style={{
                    height: '1px',
                    background: isDark ? '#334155' : '#e2e8f0',
                    margin: '8px 0',
                  }}
                />
              </>
            )}

            {/* Navigation */}
            <DropdownMenu.Label
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: isDark ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 16px 8px',
              }}
            >
              Navigate
            </DropdownMenu.Label>
            {navLinks.map((link) => (
              <DropdownMenu.Item key={link.href} asChild onSelect={() => router.push(link.href)}>
                <div
                  style={{
                    ...menuItemStyle,
                    background:
                      pathname === link.href
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)'
                        : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = menuItemHoverStyle.background
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      pathname === link.href
                        ? isDark
                          ? 'rgba(255, 255, 255, 0.1)'
                          : 'rgba(0, 0, 0, 0.05)'
                        : 'transparent'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{link.emoji}</span>
                  <span>{link.label}</span>
                </div>
              </DropdownMenu.Item>
            ))}

            <DropdownMenu.Separator
              style={{ height: '1px', background: isDark ? '#334155' : '#e2e8f0', margin: '8px 0' }}
            />

            {/* Controls */}
            <DropdownMenu.Label
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: isDark ? '#94a3b8' : '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 16px 8px',
              }}
            >
              Controls
            </DropdownMenu.Label>

            <DropdownMenu.Item
              onSelect={toggleFullscreen}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = menuItemHoverStyle.background
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: '16px' }}>{isFullscreen ? '🪟' : '⛶'}</span>
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={() => setTheme(isDark ? 'light' : 'dark')}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = menuItemHoverStyle.background
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: '16px' }}>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              onSelect={openDeploymentInfo}
              style={menuItemStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = menuItemHoverStyle.background
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: '16px' }}>ℹ️</span>
              <span>App Info</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
