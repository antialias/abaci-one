'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'

interface PagePlaceholderProps {
  pageNumber: number
  orientation?: 'portrait' | 'landscape'
}

export function PagePlaceholder({ pageNumber, orientation = 'portrait' }: PagePlaceholderProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Match the aspect ratio of actual worksheet pages
  // Portrait: 8.5" × 11" (aspect ratio 1:1.294)
  // Landscape: 11" × 8.5" (aspect ratio 1.294:1)
  const aspectRatio = orientation === 'portrait' ? 11 / 8.5 : 8.5 / 11

  return (
    <div
      data-component="page-placeholder"
      data-page-number={pageNumber}
      className={css({
        bg: isDark ? 'gray.800' : 'gray.100',
        border: '2px dashed',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        rounded: 'lg',
        width: '100%',
        aspectRatio: `1 / ${aspectRatio}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4',
        animation: 'pulse 2s ease-in-out infinite',
      })}
    >
      <div
        className={css({
          fontSize: '4xl',
          color: isDark ? 'gray.600' : 'gray.400',
        })}
      >
        📄
      </div>
      <div
        className={css({
          fontSize: 'lg',
          fontWeight: 'semibold',
          color: isDark ? 'gray.500' : 'gray.500',
        })}
      >
        Page {pageNumber}
      </div>
      <div
        className={css({
          fontSize: 'sm',
          color: isDark ? 'gray.600' : 'gray.400',
        })}
      >
        Loading...
      </div>
    </div>
  )
}
