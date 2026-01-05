'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useEffect, useState } from 'react'

interface PagePlaceholderProps {
  pageNumber: number
  orientation?: 'portrait' | 'landscape'
  rows?: number
  cols?: number
  loading?: boolean
}

interface ProblemVariation {
  topWidths: [number, number]
  bottomWidths: [number, number]
  operator: '+' | '−'
}

interface AnimatedProblemCellProps {
  seed: number
  isDark: boolean
  animationDelay: string
  wiggleDelay: string
}

function AnimatedProblemCell({
  seed,
  isDark,
  animationDelay,
  wiggleDelay,
}: AnimatedProblemCellProps) {
  // Generate multiple problem variations to cycle through
  const problems: ProblemVariation[] = [
    {
      topWidths: [55 + ((seed * 7) % 25), 50 + ((seed * 11) % 30)],
      bottomWidths: [55 + ((seed * 13) % 25), 50 + ((seed * 19) % 30)],
      operator: '+',
    },
    {
      topWidths: [45 + ((seed * 17) % 30), 60 + ((seed * 23) % 20)],
      bottomWidths: [40 + ((seed * 29) % 35), 55 + ((seed * 31) % 25)],
      operator: '−',
    },
    {
      topWidths: [65 + ((seed * 37) % 15), 45 + ((seed * 41) % 30)],
      bottomWidths: [50 + ((seed * 43) % 30), 60 + ((seed * 47) % 20)],
      operator: '+',
    },
  ]

  const showCarryBoxes = seed % 4 === 0

  // State to track which problem variation is currently shown
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0)

  // Cycle through problems with staggered timing based on seed
  useEffect(() => {
    // Each cell cycles at a slightly different rate (0.5-1 seconds) - super fast!
    const cycleInterval = 500 + (seed % 10) * 50

    const intervalId = setInterval(() => {
      setCurrentProblemIndex((prev) => (prev + 1) % problems.length)
    }, cycleInterval)

    return () => clearInterval(intervalId)
  }, [seed, problems.length])

  const currentProblem = problems[currentProblemIndex]

  return (
    <div
      style={{
        animationDelay: animationDelay,
      }}
      className={css({
        flex: 1,
        bg: isDark ? 'gray.700' : 'gray.200',
        border: '3px dashed',
        borderColor: isDark ? 'gray.600' : 'gray.400',
        rounded: 'lg',
        display: 'flex',
        flexDirection: 'column',
        padding: '4',
        gap: '3',
        position: 'relative',
        justifyContent: 'space-between',
        animation: 'fadeInScale 0.6s ease-out',
        transition: 'all 0.3s ease',
        _hover: {
          transform: 'scale(1.02)',
          borderColor: isDark ? 'gray.500' : 'gray.500',
        },
      })}
    >
      {/* Top section: problem number + optional carry boxes */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          minHeight: '16px',
        })}
      >
        {/* Problem number - bouncy circle */}
        <div
          style={{ animationDelay: wiggleDelay }}
          className={css({
            width: '16px',
            height: '16px',
            bg: isDark ? 'blue.500' : 'blue.500',
            rounded: 'full',
            opacity: 0.85,
            animation: 'bounce 2s ease-in-out infinite',
          })}
        />

        {/* Optional carry boxes - wiggle animation */}
        {showCarryBoxes && (
          <div
            className={css({
              display: 'flex',
              gap: '3px',
            })}
          >
            <div
              style={{ animationDelay: wiggleDelay }}
              className={css({
                width: '16px',
                height: '16px',
                border: '3px dashed',
                borderColor: isDark ? 'purple.400' : 'purple.500',
                rounded: 'sm',
                opacity: 0.75,
                animation: 'wiggle 1.5s ease-in-out infinite',
              })}
            />
            <div
              style={{ animationDelay: `${parseFloat(wiggleDelay) + 0.2}s` }}
              className={css({
                width: '16px',
                height: '16px',
                border: '3px dashed',
                borderColor: isDark ? 'purple.400' : 'purple.500',
                rounded: 'sm',
                opacity: 0.75,
                animation: 'wiggle 1.5s ease-in-out infinite',
              })}
            />
          </div>
        )}
      </div>

      {/* Middle section: cartoonish number representations */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '4',
          flex: 1,
          justifyContent: 'center',
          transition: 'opacity 0.3s ease-in-out',
        })}
      >
        {/* Top operand - bars with widths from current problem */}
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'flex-end',
          })}
        >
          <div
            key={`top1-${currentProblemIndex}`}
            style={{ animationDelay: animationDelay }}
            className={css({
              width: `${currentProblem.topWidths[0]}%`,
              height: '14px',
              bg: isDark ? 'cyan.400' : 'cyan.500',
              rounded: 'full',
              opacity: 0.9,
              transition: 'width 0.4s ease-in-out',
            })}
          />
          <div
            key={`top2-${currentProblemIndex}`}
            style={{ animationDelay: `${parseFloat(animationDelay) + 0.2}s` }}
            className={css({
              width: `${currentProblem.topWidths[1]}%`,
              height: '14px',
              bg: isDark ? 'cyan.400' : 'cyan.500',
              rounded: 'full',
              opacity: 0.9,
              transition: 'width 0.4s ease-in-out',
            })}
          />
        </div>

        {/* Operator + bottom operand - playful layout */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            alignSelf: 'flex-end',
            width: '75%',
          })}
        >
          {/* Operator symbol - cycles between + and − */}
          <div
            key={`op-${currentProblemIndex}`}
            style={{ animationDelay: `${parseFloat(wiggleDelay) + 0.1}s` }}
            className={css({
              fontSize: '24px',
              fontWeight: 'black',
              color: isDark ? 'orange.400' : 'orange.600',
              opacity: 0.95,
              animation: 'colorShift 2s ease-in-out infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '20px',
              transition: 'opacity 0.3s ease-in-out',
            })}
          >
            {currentProblem.operator}
          </div>
          {/* Bottom operand bars - widths from current problem */}
          <div
            className={css({
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            })}
          >
            <div
              key={`bottom1-${currentProblemIndex}`}
              style={{ animationDelay: `${parseFloat(animationDelay) + 0.3}s` }}
              className={css({
                width: `${currentProblem.bottomWidths[0]}%`,
                height: '14px',
                bg: isDark ? 'green.400' : 'green.500',
                rounded: 'full',
                opacity: 0.9,
                alignSelf: 'flex-end',
                transition: 'width 0.4s ease-in-out',
              })}
            />
            <div
              key={`bottom2-${currentProblemIndex}`}
              style={{ animationDelay: `${parseFloat(animationDelay) + 0.4}s` }}
              className={css({
                width: `${currentProblem.bottomWidths[1]}%`,
                height: '14px',
                bg: isDark ? 'green.400' : 'green.500',
                rounded: 'full',
                opacity: 0.9,
                alignSelf: 'flex-end',
                transition: 'width 0.4s ease-in-out',
              })}
            />
          </div>
        </div>

        {/* Horizontal rule - animated wave */}
        <div
          className={css({
            width: '90%',
            height: '4px',
            bg: isDark ? 'gray.500' : 'gray.600',
            alignSelf: 'flex-end',
            my: '2',
            opacity: 0.85,
            rounded: 'full',
            animation: 'slideInRight 0.8s ease-out',
          })}
        />

        {/* Answer area - glowing box */}
        <div
          style={{ animationDelay: `${parseFloat(animationDelay) + 0.5}s` }}
          className={css({
            width: '90%',
            height: '20px',
            bg: isDark ? 'gray.700' : 'white',
            border: '3px dashed',
            borderColor: isDark ? 'yellow.500' : 'yellow.500',
            rounded: 'lg',
            alignSelf: 'flex-end',
            opacity: 0.85,
            animation: 'glow 2.5s ease-in-out infinite',
          })}
        />
      </div>
    </div>
  )
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

  // Calculate exact pixel dimensions and aspect ratios based on page size
  // Portrait: 8.5" × 11" at 96 DPI = 816px × 1056px (aspect ratio: 8.5/11)
  // Landscape: 11" × 8.5" at 96 DPI = 1056px × 816px (aspect ratio: 11/8.5)
  // Use max-width + aspect-ratio for responsive sizing that maintains proportions
  const maxWidth = orientation === 'portrait' ? 816 : 1056
  const aspectRatio = orientation === 'portrait' ? '8.5 / 11' : '11 / 8.5'

  return (
    <div
      data-component="page-placeholder"
      data-page-number={pageNumber}
      style={{
        width: '100%',
        maxWidth: `${maxWidth}px`,
        aspectRatio: aspectRatio,
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
            {Array.from({ length: cols }).map((_, colIndex) => {
              // Generate pseudo-random but consistent properties for visual variety
              const seed = rowIndex * cols + colIndex
              const animationDelay = `${(seed % 10) * 0.1}s`
              const wiggleDelay = `${(seed % 8) * 0.15}s`

              return (
                <AnimatedProblemCell
                  key={colIndex}
                  seed={seed}
                  isDark={isDark}
                  animationDelay={animationDelay}
                  wiggleDelay={wiggleDelay}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
