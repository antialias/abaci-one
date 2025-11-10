'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
 * 5. Dynamically calculates nav height for proper spacing
 */
export function StandardGameLayout({ children, className }: StandardGameLayoutProps) {
  const [navHeight, setNavHeight] = useState(80) // Default fallback

  useEffect(() => {
    // Measure the actual nav height from the fixed header
    const measureNavHeight = () => {
      const header = document.querySelector('header')
      if (header) {
        const rect = header.getBoundingClientRect()
        // Add extra spacing for safety (nav top position + nav height + margin)
        const calculatedHeight = rect.top + rect.height + 20
        setNavHeight(calculatedHeight)
      }
    }

    // Measure on mount and when window resizes
    measureNavHeight()
    window.addEventListener('resize', measureNavHeight)

    // Also measure after a short delay to catch any late-rendering nav elements
    const timer = setTimeout(measureNavHeight, 100)

    return () => {
      window.removeEventListener('resize', measureNavHeight)
      clearTimeout(timer)
    }
  }, [])

  return (
    <div
      data-layout="standard-game-layout"
      data-nav-height={navHeight}
      className={`${css({
        // Exact viewport sizing - no scrolling ever
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',

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
      })} ${className || ''}`}
      style={{
        // Dynamic padding based on measured nav height
        paddingTop: `${navHeight}px`,
      }}
    >
      {children}
    </div>
  )
}
