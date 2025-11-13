'use client'

import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'

export interface Tab {
  id: string
  label: string
  icon: string | ((operator?: 'addition' | 'subtraction' | 'mixed') => string)
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
  { id: 'layout', label: 'Layout', icon: '📐' },
  { id: 'scaffolding', label: 'Scaffolding', icon: '🎨' },
  { id: 'difficulty', label: 'Difficulty', icon: '📊' },
]

interface TabNavigationProps {
  activeTab: string
  onChange: (tabId: string) => void
  operator?: 'addition' | 'subtraction' | 'mixed'
}

export function TabNavigation({ activeTab, onChange, operator }: TabNavigationProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const getTabIcon = (tab: Tab) => {
    if (typeof tab.icon === 'function') {
      return tab.icon(operator)
    }
    return tab.icon
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
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.5',
              })}
            >
              <span
                className={css({
                  fontSize: isOperatorSymbol ? 'lg' : undefined,
                  fontWeight: isOperatorSymbol ? 'bold' : undefined,
                })}
              >
                {icon}
              </span>
              <span>{tab.label}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
