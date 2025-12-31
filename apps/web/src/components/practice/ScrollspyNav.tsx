'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

export interface ScrollspySection {
  id: string
  label: string
  icon?: string
}

export interface ScrollspyNavProps {
  /** Sections to track and navigate to */
  sections: ScrollspySection[]
  /** Offset from top of viewport for intersection detection */
  topOffset?: number
  /** Dark mode */
  isDark: boolean
}

/**
 * ScrollspyNav - Mobile navigation that tracks scroll position
 *
 * Features:
 * - Fixed at bottom of viewport (48px height)
 * - Highlights active section based on scroll position
 * - Click to smooth-scroll to section
 * - Only shows on mobile/tablet (hidden at 1200px+)
 */
export function ScrollspyNav({ sections, topOffset = 200, isDark }: ScrollspyNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(sections[0]?.id ?? null)
  const [isVisible, setIsVisible] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  // Check if we should show the fixed nav (based on viewport width)
  useEffect(() => {
    const checkVisibility = () => {
      setIsVisible(window.innerWidth < 1200)
    }

    checkVisibility()
    window.addEventListener('resize', checkVisibility)
    return () => window.removeEventListener('resize', checkVisibility)
  }, [])

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      // Find the section that's currently in view
      // Start from the bottom and work up to find the topmost visible section
      let currentSection: string | null = null

      for (const section of sections) {
        const element = document.querySelector(`[data-scrollspy-section="${section.id}"]`)
        if (element) {
          const rect = element.getBoundingClientRect()
          // Section is considered active if its top is above the threshold
          if (rect.top < topOffset) {
            currentSection = section.id
          }
        }
      }

      // If no section is active (at the very top), use the first section
      if (!currentSection && sections.length > 0) {
        currentSection = sections[0].id
      }

      if (currentSection !== activeSection) {
        setActiveSection(currentSection)
      }
    }

    // Initial check
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections, topOffset, activeSection])

  // Scroll to section when clicked
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const element = document.querySelector(`[data-scrollspy-section="${sectionId}"]`)
      if (element) {
        const rect = element.getBoundingClientRect()
        const scrollY = window.scrollY + rect.top - topOffset + 20 // 20px padding
        window.scrollTo({ top: scrollY, behavior: 'smooth' })
      }
    },
    [topOffset]
  )

  if (sections.length === 0) {
    return null
  }

  return (
    <nav
      ref={navRef}
      data-component="scrollspy-nav"
      className={css({
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 80,
        backgroundColor: isDark ? 'gray.900' : 'white',
        borderTop: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        // Hide on desktop - only show on mobile/tablet
        display: isVisible ? 'block' : 'none',
      })}
    >
      <div
        data-element="scrollspy-track"
        className={css({
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          overflowX: 'auto',
          padding: '0.75rem 1rem',
          // Hide scrollbar but allow scrolling
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        })}
      >
        {sections.map((section) => {
          const isActive = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              data-section-link={section.id}
              data-active={isActive}
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.125rem',
                padding: '0.25rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'medium',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: 'none',
                backgroundColor: 'transparent',
                color: isActive
                  ? isDark
                    ? 'blue.400'
                    : 'blue.600'
                  : isDark
                    ? 'gray.400'
                    : 'gray.500',
                _hover: {
                  color: isDark ? 'gray.200' : 'gray.700',
                },
              })}
            >
              <span>{section.label}</span>
              {/* Dot indicator for active section */}
              <span
                className={css({
                  width: '4px',
                  height: '4px',
                  borderRadius: 'full',
                  backgroundColor: isActive
                    ? isDark
                      ? 'blue.400'
                      : 'blue.600'
                    : 'transparent',
                  transition: 'background-color 0.2s',
                })}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default ScrollspyNav
