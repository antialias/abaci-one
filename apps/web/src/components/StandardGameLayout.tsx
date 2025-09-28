'use client'

import { ReactNode, useEffect } from 'react'
import { css } from '../../styled-system/css'
import { useGameTheme } from '../contexts/GameThemeContext'

interface StandardGameLayoutProps {
  children: ReactNode
  className?: string
  theme?: {
    gameName: string
    backgroundColor: string
  }
}

/**
 * Standard game layout that ensures:
 * 1. Exact 100vh height with no scrolling (vertical or horizontal)
 * 2. Navigation never covers game elements (safe area padding)
 * 3. Perfect viewport fit on all devices
 * 4. Consistent experience across all games
 */
export function StandardGameLayout({ children, className, theme }: StandardGameLayoutProps) {
  const { setTheme } = useGameTheme()

  // Set the theme when component mounts and clean up on unmount
  useEffect(() => {
    if (theme) {
      setTheme(theme)
    }
    return () => {
      setTheme(null)
    }
  }, [theme, setTheme])

  return (
    <div className={css({
      // Exact viewport sizing - no scrolling ever
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',

      // Safe area for navigation (fixed at top: 4px, right: 4px)
      // Navigation is ~60px tall, so we need padding-top of ~80px to be safe
      paddingTop: '80px',
      paddingRight: '4px', // Ensure nav doesn't overlap content on right side
      paddingBottom: '4px',
      paddingLeft: '4px',

      // Box sizing to include padding in dimensions
      boxSizing: 'border-box',

      // Flex container for game content
      display: 'flex',
      flexDirection: 'column',

      // Apply the theme background if provided
      background: theme?.backgroundColor || 'transparent'
    }, className)}>
      {children}
    </div>
  )
}