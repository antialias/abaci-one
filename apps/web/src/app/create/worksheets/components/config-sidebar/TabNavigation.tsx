'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { DisplayRules } from '../../displayRules'
import { ProblemPreview } from './ProblemPreview'

export interface Tab {
  id: string
  label: string
  icon: string | ((operator?: 'addition' | 'subtraction' | 'mixed') => string) | 'preview'
  subtitle?: (props: {
    mode?: 'custom' | 'manual' | 'mastery'
    difficultyProfile?: string
    interpolate?: boolean
    orientation?: 'portrait' | 'landscape'
    problemsPerPage?: number
    cols?: number
    displayRules?: DisplayRules
    resolvedDisplayRules?: DisplayRules
    operator?: 'addition' | 'subtraction' | 'mixed'
  }) => string | null
}

export const TABS: Tab[] = [
  {
    id: 'operator',
    label: 'Operator',
    icon: (operator) => {
      if (operator === 'mixed') return '±'
      if (operator === 'subtraction') return '−'
      return '+'
    },
  },
  {
    id: 'layout',
    label: 'Layout',
    icon: '📐',
    subtitle: ({ orientation, problemsPerPage, cols }) => {
      if (!orientation || !problemsPerPage || !cols) return null
      const orientationLabel = orientation === 'portrait' ? 'Portrait' : 'Landscape'
      const rows = Math.ceil(problemsPerPage / cols)
      return `${orientationLabel}: ${cols}×${rows}`
    },
  },
  {
    id: 'scaffolding',
    label: 'Scaffolding',
    icon: 'preview',
    subtitle: ({ displayRules, operator, resolvedDisplayRules }) => {
      if (!displayRules) return null

      // Map features to abbreviated names (for addition and subtraction)
      const features: { key: keyof DisplayRules; name: string }[] =
        operator === 'subtraction'
          ? [
              { key: 'borrowNotation', name: 'Borrow' },
              { key: 'borrowingHints', name: 'Hints' },
              { key: 'tenFrames', name: '10-frames' },
              { key: 'answerBoxes', name: 'Answer' },
              { key: 'placeValueColors', name: 'Colors' },
            ]
          : [
              { key: 'carryBoxes', name: 'Carry' },
              { key: 'tenFrames', name: '10-frames' },
              { key: 'answerBoxes', name: 'Answer' },
              { key: 'placeValueColors', name: 'Colors' },
            ]

      // Resolve 'auto' to actual value if we have resolved rules
      const getResolvedValue = (key: keyof DisplayRules) => {
        const value = displayRules[key]
        if (value === 'auto' && resolvedDisplayRules) {
          return resolvedDisplayRules[key]
        }
        return value
      }

      // Split features into 'always' and conditional (not 'never' and not 'always')
      const always = features.filter((f) => getResolvedValue(f.key) === 'always')
      const conditional = features.filter((f) => {
        const resolved = getResolvedValue(f.key)
        return resolved !== 'never' && resolved !== 'always'
      })

      // Build subtitle lines, hiding empty categories
      const lines: string[] = []
      if (always.length > 0) {
        lines.push(`Always: ${always.map((f) => f.name).join(', ')}`)
      }
      if (conditional.length > 0) {
        lines.push(`Conditional: ${conditional.map((f) => f.name).join(', ')}`)
      }

      // Return combined lines, or "None" if both are empty
      return lines.length > 0 ? lines.join('\n') : 'None'
    },
  },
  {
    id: 'difficulty',
    label: 'Difficulty',
    icon: '📊',
    subtitle: ({ mode, interpolate }) => {
      if (!mode) return null
      const modeName = mode === 'custom' ? 'Custom' : mode === 'mastery' ? 'Mastery' : 'Manual'
      const progression = interpolate ? 'Progressive' : 'Fixed'
      return mode === 'manual' ? modeName : `${modeName}: ${progression}`
    },
  },
]

interface TabNavigationProps {
  activeTab: string
  onChange: (tabId: string) => void
  operator?: 'addition' | 'subtraction' | 'mixed'
  mode?: 'custom' | 'manual' | 'mastery'
  difficultyProfile?: string
  interpolate?: boolean
  orientation?: 'portrait' | 'landscape'
  problemsPerPage?: number
  cols?: number
  displayRules?: DisplayRules
  resolvedDisplayRules?: DisplayRules
  digitRange?: { min: number; max: number }
}

export function TabNavigation({
  activeTab,
  onChange,
  operator,
  mode,
  difficultyProfile,
  interpolate,
  orientation,
  problemsPerPage,
  cols,
  displayRules,
  resolvedDisplayRules,
  digitRange,
}: TabNavigationProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const getTabIcon = (tab: Tab) => {
    if (typeof tab.icon === 'function') {
      return tab.icon(operator)
    }
    return tab.icon
  }

  const getTabSubtitle = (tab: Tab) => {
    if (typeof tab.subtitle === 'function') {
      return tab.subtitle({
        mode,
        difficultyProfile,
        interpolate,
        orientation,
        problemsPerPage,
        cols,
        displayRules,
        resolvedDisplayRules,
        operator,
      })
    }
    return null
  }

  return (
    <div
      data-component="tab-navigation"
      className={css({
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2',
      })}
    >
      {TABS.map((tab) => {
        const icon = getTabIcon(tab)
        const subtitle = getTabSubtitle(tab)
        const showPreviewIcon = tab.icon === 'preview' && displayRules
        // All operator symbols (+, −, ±) are ASCII characters that need larger font size
        const isOperatorSymbol = tab.id === 'operator'

        return (
          <button
            key={tab.id}
            data-action={`select-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={css({
              px: '3',
              py: '2',
              rounded: 'lg',
              fontSize: 'sm',
              fontWeight: 'medium',
              cursor: 'pointer',
              transition: 'all 0.2s',
              bg:
                activeTab === tab.id
                  ? isDark
                    ? 'brand.900'
                    : 'brand.50'
                  : isDark
                    ? 'gray.700'
                    : 'gray.100',
              color:
                activeTab === tab.id
                  ? isDark
                    ? 'brand.200'
                    : 'brand.700'
                  : isDark
                    ? 'gray.300'
                    : 'gray.600',
              border: '2px solid',
              borderColor: activeTab === tab.id ? 'brand.500' : 'transparent',
              _hover: {
                borderColor: 'brand.400',
              },
            })}
          >
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: subtitle || showPreviewIcon ? '0.5' : '1.5',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5',
                })}
              >
                {showPreviewIcon ? (
                  <ProblemPreview
                    displayRules={displayRules!}
                    resolvedDisplayRules={resolvedDisplayRules}
                    operator={operator}
                    digitRange={digitRange}
                  />
                ) : (
                  <span
                    className={css({
                      fontSize: isOperatorSymbol ? 'lg' : undefined,
                      fontWeight: isOperatorSymbol ? 'bold' : undefined,
                    })}
                  >
                    {icon}
                  </span>
                )}
                <span>{tab.label}</span>
              </div>
              {subtitle ? (
                <span
                  className={css({
                    fontSize: '2xs',
                    fontWeight: 'normal',
                    whiteSpace: 'pre-line',
                    textAlign: 'center',
                    color:
                      activeTab === tab.id
                        ? isDark
                          ? 'brand.300'
                          : 'brand.600'
                        : isDark
                          ? 'gray.400'
                          : 'gray.500',
                  })}
                >
                  {subtitle}
                </span>
              ) : null}
            </div>
          </button>
        )
      })}
    </div>
  )
}
