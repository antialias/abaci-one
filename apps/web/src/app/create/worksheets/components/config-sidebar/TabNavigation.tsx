'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import type { DisplayRules } from '../../displayRules'
import { LayoutPreview } from './LayoutPreview'
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
    pages?: number
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
    icon: 'preview',
    subtitle: ({ orientation, problemsPerPage, cols, pages }) => {
      if (!orientation || !problemsPerPage || !cols || !pages) return null
      const orientationLabel = orientation === 'portrait' ? 'Portrait' : 'Landscape'
      const rows = Math.ceil(problemsPerPage / cols)
      const pageLabel = pages === 1 ? 'page' : 'pages'
      return `${orientationLabel}: ${cols}×${rows}, ${pages} ${pageLabel}`
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
  pages?: number
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
  pages,
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
        pages,
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
        const showLayoutPreview = tab.id === 'layout' && orientation && problemsPerPage && cols
        const showScaffoldingPreview = tab.id === 'scaffolding' && displayRules
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
                flexDirection: 'row',
                alignItems: 'center',
                gap: '2',
                width: '100%',
              })}
            >
              {/* Icon - left side, uses full height */}
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                })}
              >
                {showLayoutPreview ? (
                  <LayoutPreview
                    orientation={orientation!}
                    cols={cols!}
                    rows={Math.ceil(problemsPerPage! / cols!)}
                    maxSize={32}
                  />
                ) : showScaffoldingPreview ? (
                  <ProblemPreview
                    displayRules={displayRules!}
                    resolvedDisplayRules={resolvedDisplayRules}
                    operator={operator}
                    digitRange={digitRange}
                  />
                ) : (
                  <span
                    className={css({
                      fontSize: '3xl',
                      fontWeight: isOperatorSymbol ? 'bold' : undefined,
                      lineHeight: '1',
                    })}
                  >
                    {icon}
                  </span>
                )}
              </div>

              {/* Label + Subtitle - right side, stacked vertically */}
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5',
                  flex: 1,
                })}
              >
                <span>{tab.label}</span>
                {subtitle ? (
                  <span
                    className={css({
                      fontSize: '2xs',
                      fontWeight: 'normal',
                      whiteSpace: 'pre-line',
                      textAlign: 'left',
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
                {/* Total badge for layout tab */}
                {tab.id === 'layout' && problemsPerPage && pages ? (
                  <span
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1',
                      px: '2',
                      py: '0.5',
                      bg: activeTab === tab.id ? 'brand.500' : isDark ? 'gray.600' : 'gray.400',
                      color: 'white',
                      rounded: 'full',
                      fontSize: '2xs',
                      fontWeight: 'semibold',
                      mt: '0.5',
                    })}
                  >
                    <span>Total:</span>
                    <span>{problemsPerPage * pages}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
