'use client'

import { useState } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useIsMobile } from '@/hooks/useMediaQuery'
import NumberFlow from '@number-flow/react'

interface FloatingPageIndicatorProps {
  currentPage: number
  totalPages: number
  onJumpToPage: (pageIndex: number) => void
  isScrolling?: boolean
}

export function FloatingPageIndicator({
  currentPage,
  totalPages,
  onJumpToPage,
  isScrolling = false,
}: FloatingPageIndicatorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const isMobile = useIsMobile()
  const [isHovered, setIsHovered] = useState(false)

  if (totalPages <= 1) return null

  const isActive = isHovered || isScrolling

  return (
    <div
      data-component="floating-page-indicator"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={css({
        position: 'absolute',
        // Mobile: top-left with margin, Desktop: centered at top
        top: '4',
        left: isMobile ? '3' : '50%',
        transform: isMobile ? 'none' : 'translateX(-50%)',
        zIndex: 10,
        bg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        rounded: 'full',
        // Mobile: smaller padding
        px: isMobile ? '2' : '4',
        py: isMobile ? '1' : '2',
        shadow: 'lg',
        display: 'inline-flex',
        alignItems: 'center',
        gap: isMobile ? '2' : '3',
        opacity: isActive ? 1 : 0.7,
        transition: 'opacity 0.3s ease-in-out',
        // Mobile: slightly smaller scale
        fontSize: isMobile ? 'xs' : 'sm',
      })}
    >
      <button
        onClick={() => onJumpToPage(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className={css({
          px: isMobile ? '1' : '2',
          py: '1',
          rounded: 'md',
          fontSize: isMobile ? 'xs' : 'sm',
          fontWeight: 'medium',
          color: isDark ? 'gray.300' : 'gray.700',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _disabled: {
            opacity: 0.3,
            cursor: 'not-allowed',
          },
          _hover: {
            bg: isDark ? 'gray.700' : 'gray.100',
          },
        })}
      >
        ←
      </button>

      <span
        className={css({
          fontSize: isMobile ? 'xs' : 'sm',
          fontWeight: 'semibold',
          color: isDark ? 'gray.100' : 'gray.900',
          minW: isMobile ? '16' : '20',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          whiteSpace: 'nowrap',
        })}
      >
        {isMobile ? (
          // Mobile: compact format "1/5"
          <>
            <NumberFlow
              value={currentPage + 1}
              format={{ notation: 'standard' }}
              trend={0}
              animated
              style={{
                fontWeight: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
              }}
            />
            /
            <NumberFlow
              value={totalPages}
              format={{ notation: 'standard' }}
              trend={0}
              animated
              style={{
                fontWeight: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
              }}
            />
          </>
        ) : (
          // Desktop: full format "Page 1 of 5"
          <>
            Page{' '}
            <NumberFlow
              value={currentPage + 1}
              format={{ notation: 'standard' }}
              trend={0}
              animated
              style={{
                fontWeight: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
              }}
            />{' '}
            of{' '}
            <NumberFlow
              value={totalPages}
              format={{ notation: 'standard' }}
              trend={0}
              animated
              style={{
                fontWeight: 'inherit',
                fontSize: 'inherit',
                color: 'inherit',
              }}
            />
          </>
        )}
      </span>

      <button
        onClick={() => onJumpToPage(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
        className={css({
          px: isMobile ? '1' : '2',
          py: '1',
          rounded: 'md',
          fontSize: isMobile ? 'xs' : 'sm',
          fontWeight: 'medium',
          color: isDark ? 'gray.300' : 'gray.700',
          cursor: 'pointer',
          transition: 'all 0.2s',
          _disabled: {
            opacity: 0.3,
            cursor: 'not-allowed',
          },
          _hover: {
            bg: isDark ? 'gray.700' : 'gray.100',
          },
        })}
      >
        →
      </button>
    </div>
  )
}
