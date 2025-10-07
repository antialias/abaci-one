'use client'

import type { ReactNode } from 'react'
import { css } from '../../styled-system/css'

interface StandardGameLayoutProps {
  children: ReactNode
  className?: string
}

/**
 * Standard game layout that ensures:
 * 1. Exact 100vh height with no scrolling (vertical or horizontal)
 * 2. Navigation never covers game elements (safe area padding)
 * 3. Perfect viewport fit on all devices
 * 4. Consistent experience across all games
 */
export function StandardGameLayout({ children, className }: StandardGameLayoutProps) {
  return (
    <div
      className={css(
        {
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

          // Transparent background - themes will be applied at nav level
          background: 'transparent',
        },
        className
      )}
    >
      {children}
    </div>
  )
}
