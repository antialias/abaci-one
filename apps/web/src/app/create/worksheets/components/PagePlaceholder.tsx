'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'

interface PagePlaceholderProps {
  pageNumber: number
}

export function PagePlaceholder({ pageNumber }: PagePlaceholderProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <div
      data-component="page-placeholder"
      data-page-number={pageNumber}
      className={css({
        bg: isDark ? 'gray.800' : 'gray.100',
        border: '2px dashed',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        rounded: 'lg',
        minHeight: '800px',
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
