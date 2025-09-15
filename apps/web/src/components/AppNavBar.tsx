'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { css } from '../../styled-system/css'
import { container, hstack } from '../../styled-system/patterns'
import { AbacusDisplayDropdown } from './AbacusDisplayDropdown'

interface AppNavBarProps {
  variant?: 'full' | 'minimal'
}

export function AppNavBar({ variant = 'full' }: AppNavBarProps) {
  const pathname = usePathname()
  const isGamePage = pathname?.startsWith('/games')

  // Auto-detect variant based on context
  const actualVariant = variant === 'full' && isGamePage ? 'minimal' : variant

  if (actualVariant === 'minimal') {
    return (
      <header className={css({
        position: 'fixed',
        top: '4',
        right: '4',
        zIndex: 40,
        // Make it less prominent during games
        opacity: '0.9',
        _hover: { opacity: '1' },
        transition: 'all'
      })}>
        <div className={hstack({ gap: '3' })}>
          {/* Compact Navigation Menu */}
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            px: '3',
            py: '2',
            bg: 'white',
            border: '1px solid',
            borderColor: 'gray.200',
            rounded: 'lg',
            shadow: 'sm'
          })}>
            <Link
              href="/"
              className={css({
                display: 'flex',
                alignItems: 'center',
                fontSize: 'lg',
                textDecoration: 'none',
                _hover: { transform: 'scale(1.1)' },
                transition: 'transform'
              })}
              title="Home"
            >
              🧮
            </Link>
            <div className={css({ w: '1px', h: '4', bg: 'gray.300' })} />
            <CompactNavLink href="/create" currentPath={pathname} title="Create">
              ✏️
            </CompactNavLink>
            <CompactNavLink href="/guide" currentPath={pathname} title="Guide">
              📖
            </CompactNavLink>
            <CompactNavLink href="/games" currentPath={pathname} title="Games">
              🎮
            </CompactNavLink>
          </div>
          <AbacusDisplayDropdown />
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
            <AbacusDisplayDropdown />
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
  children
}: {
  href: string
  currentPath: string | null
  title: string
  children: React.ReactNode
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
        color: isActive ? 'brand.600' : 'gray.500',
        rounded: 'md',
        transition: 'all',
        textDecoration: 'none',
        _hover: {
          color: isActive ? 'brand.700' : 'gray.700',
          transform: 'scale(1.1)'
        }
      })}
    >
      {children}
    </Link>
  )
}