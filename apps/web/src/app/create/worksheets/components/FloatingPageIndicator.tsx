'use client'

import { useState } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
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
  const [isHovered, setIsHovered] = useState(false)

  if (totalPages <= 1) return null

  const isActive = isHovered || isScrolling

  return (
    <div
      data-component="floating-page-indicator"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={css({
        position: 'sticky',
        top: '4',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        bg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
        rounded: 'full',
        px: '4',
        py: '2',
        shadow: 'lg',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3',
        opacity: isActive ? 1 : 0.7,
        transition: 'opacity 0.3s ease-in-out',
      })}
    >
      <button
        onClick={() => onJumpToPage(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className={css({
          px: '2',
          py: '1',
          rounded: 'md',
          fontSize: 'sm',
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
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: isDark ? 'gray.100' : 'gray.900',
          minW: '20',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: '1',
        })}
      >
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
      </span>

      <button
        onClick={() => onJumpToPage(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
        className={css({
          px: '2',
          py: '1',
          rounded: 'md',
          fontSize: 'sm',
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
