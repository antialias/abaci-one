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
        opacity: '0.8',
        _hover: { opacity: '1' },
        transition: 'opacity'
      })}>
        <div className={hstack({ gap: '2' })}>
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