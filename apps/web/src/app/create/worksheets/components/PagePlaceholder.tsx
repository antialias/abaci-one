'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'

interface PagePlaceholderProps {
  pageNumber: number
  orientation?: 'portrait' | 'landscape'
  rows?: number
  cols?: number
  loading?: boolean
}

export function PagePlaceholder({
  pageNumber,
  orientation = 'portrait',
  rows = 5,
  cols = 4,
  loading = false,
}: PagePlaceholderProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Calculate exact pixel dimensions based on page size
  // Portrait: 8.5" × 11" at 96 DPI = 816px × 1056px
  // Landscape: 11" × 8.5" at 96 DPI = 1056px × 816px
  // Scale down to fit typical viewport (maxWidth: 100%)
  const width = orientation === 'portrait' ? 816 : 1056
  const height = orientation === 'portrait' ? 1056 : 816

  return (
    <div
      data-component="page-placeholder"
      data-page-number={pageNumber}
      style={{
        maxWidth: '100%',
        width: `${width}px`,
        height: `${height}px`,
      }}
      className={css({
        bg: isDark ? 'gray.800' : 'gray.100',
        border: '2px dashed',
        borderColor: isDark ? 'gray.600' : 'gray.300',
        rounded: 'lg',
        animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'pulse 2s ease-in-out infinite',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        padding: '12',
      })}
    >
      {/* Header area (mimics worksheet header with name/date) */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          mb: '8',
          opacity: 0.3,
        })}
      >
        <div
          className={css({
            width: '30%',
            height: '6',
            bg: isDark ? 'gray.600' : 'gray.400',
            rounded: 'sm',
          })}
        />
        <div
          className={css({
            width: '25%',
            height: '6',
            bg: isDark ? 'gray.600' : 'gray.400',
            rounded: 'sm',
          })}
        />
      </div>

      {/* Problem grid - cartoonish representation */}
      <div
        data-element="problem-grid-preview"
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          opacity: 0.3,
        })}
      >
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={css({
              display: 'flex',
              gap: '3',
              flex: 1,
            })}
          >
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={css({
                  flex: 1,
                  bg: isDark ? 'gray.700' : 'gray.300',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.400',
                  rounded: 'md',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '2',
                  gap: '1',
                })}
              >
                {/* Problem number */}
                <div
                  className={css({
                    width: '20%',
                    height: '2',
                    bg: isDark ? 'gray.600' : 'gray.500',
                    rounded: 'xs',
                  })}
                />
                {/* Top operand */}
                <div
                  className={css({
                    width: '60%',
                    height: '3',
                    bg: isDark ? 'gray.600' : 'gray.500',
                    rounded: 'xs',
                    alignSelf: 'flex-end',
                  })}
                />
                {/* Bottom operand */}
                <div
                  className={css({
                    width: '60%',
                    height: '3',
                    bg: isDark ? 'gray.600' : 'gray.500',
                    rounded: 'xs',
                    alignSelf: 'flex-end',
                  })}
                />
                {/* Answer line */}
                <div
                  className={css({
                    width: '60%',
                    height: '1px',
                    bg: isDark ? 'gray.600' : 'gray.500',
                    alignSelf: 'flex-end',
                  })}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Page info overlay */}
      <div
        className={css({
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          zIndex: 1,
          bg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(243, 244, 246, 0.95)',
          px: '6',
          py: '4',
          rounded: 'lg',
          border: '2px solid',
          borderColor: isDark ? 'gray.600' : 'gray.400',
          backdropFilter: 'blur(4px)',
        })}
      >
        {loading ? (
          <>
            <div
              className={css({
                fontSize: '3xl',
                color: isDark ? 'gray.500' : 'gray.400',
                animation: 'spin',
                animationDuration: '1s',
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              })}
            >
              ⏳
            </div>
            <div
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
              })}
            >
              Loading page {pageNumber}...
            </div>
          </>
        ) : (
          <>
            <div
              className={css({
                fontSize: '3xl',
                color: isDark ? 'gray.500' : 'gray.400',
              })}
            >
              📄
            </div>
            <div
              className={css({
                fontSize: 'lg',
                fontWeight: 'semibold',
                color: isDark ? 'gray.300' : 'gray.700',
              })}
            >
              Page {pageNumber}
            </div>
            <div
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Scroll to load
            </div>
          </>
        )}
      </div>
    </div>
  )
}
