'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { css } from '../../styled-system/css'
import { container, hstack } from '../../styled-system/patterns'
import { useFullscreen } from '../contexts/FullscreenContext'
import { AbacusDisplayDropdown } from './AbacusDisplayDropdown'

interface AppNavBarProps {
  variant?: 'full' | 'minimal'
  navSlot?: React.ReactNode
}

/**
 * Hamburger menu component for utility navigation
 */
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
  const [hovered, setHovered] = useState(false)
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Open on hover or click
  const isOpen = open || hovered

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHovered(true)
  }

  const handleMouseLeave = () => {
    // Delay closing to allow moving from button to menu
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(false)
    }, 150)
  }

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
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
            ☰
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onInteractOutside={(e) => {
            // Don't close the hamburger menu when clicking inside the nested style dropdown
            const target = e.target as HTMLElement
            if (target.closest('[role="dialog"]') || target.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault()
            }
          }}
          style={{
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',
            minWidth: '220px',
            zIndex: 9999,
            animation: 'dropdownFadeIn 0.2s ease-out',
          }}
        >
          {/* Site Navigation Section */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'rgba(196, 181, 253, 0.7)',
              marginBottom: '6px',
              marginLeft: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Navigation
          </div>

          <DropdownMenu.Item asChild>
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>🧮</span>
              <span>Home</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/create"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>✏️</span>
              <span>Create</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/guide"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>📖</span>
              <span>Guide</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild>
            <Link
              href="/games"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'
                e.currentTarget.style.color = 'rgba(196, 181, 253, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>🎮</span>
              <span>Games</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{
              height: '1px',
              background: 'rgba(75, 85, 99, 0.5)',
              margin: '6px 0',
            }}
          />

          {/* Controls Section */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'rgba(196, 181, 253, 0.7)',
              marginBottom: '6px',
              marginLeft: '12px',
              marginTop: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Controls
          </div>

          <DropdownMenu.Item
            onSelect={toggleFullscreen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              color: 'rgba(209, 213, 219, 1)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
              e.currentTarget.style.color = 'rgba(147, 197, 253, 1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
            }}
          >
            <span style={{ fontSize: '16px' }}>{isFullscreen ? '🪟' : '⛶'}</span>
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
          </DropdownMenu.Item>

          {isArcadePage && (
            <DropdownMenu.Item
              onSelect={() => router.push('/games')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                color: 'rgba(209, 213, 219, 1)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                e.currentTarget.style.color = 'rgba(252, 165, 165, 1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(209, 213, 219, 1)'
              }}
            >
              <span style={{ fontSize: '16px' }}>🚪</span>
              <span>Exit Arcade</span>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator
            style={{
              height: '1px',
              background: 'rgba(75, 85, 99, 0.5)',
              margin: '6px 0',
            }}
          />

          {/* Style Section */}
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'rgba(196, 181, 253, 0.7)',
              marginBottom: '6px',
              marginLeft: '12px',
              marginTop: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Abacus Style
          </div>

          <div style={{ padding: '0 6px' }}>
            <AbacusDisplayDropdown isFullscreen={isFullscreen} />
          </div>
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
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
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
                fontWeight: '600',
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
  const isGamePage = pathname?.startsWith('/games')
  const isArcadePage = pathname?.startsWith('/arcade')
  const { isFullscreen, toggleFullscreen, exitFullscreen } = useFullscreen()

  // Auto-detect variant based on context
  const actualVariant = variant === 'full' && (isGamePage || isArcadePage) ? 'minimal' : variant

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

  return (
    <header
      className={css({
        bg: 'white',
        shadow: 'sm',
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      })}
    >
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
              _hover: { color: 'brand.900' },
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
  children,
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
          bg: isActive ? 'brand.100' : 'gray.50',
        },
      })}
    >
      {children}
    </Link>
  )
}

