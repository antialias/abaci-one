'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

export function MaxTermsSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { abacusMaxTerms, setAbacusMaxTerms } = useStartPracticeModal()

  return (
    <div data-setting="max-terms">
      <div
        data-element="terms-label"
        className={css({
          fontSize: '0.6875rem',
          fontWeight: '600',
          color: isDark ? 'gray.500' : 'gray.400',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            marginBottom: '0.25rem',
            fontSize: '0.625rem',
          },
        })}
      >
        Numbers per problem
      </div>
      <div
        data-element="terms-options"
        className={css({
          display: 'flex',
          gap: '0.25rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            gap: '0.125rem',
          },
        })}
      >
        {[3, 4, 5, 6, 7, 8].map((terms) => {
          const isSelected = abacusMaxTerms === terms
          return (
            <button
              key={terms}
              type="button"
              data-option={`terms-${terms}`}
              data-selected={isSelected}
              onClick={() => setAbacusMaxTerms(terms)}
              className={css({
                flex: 1,
                padding: '0.5rem 0.25rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.3125rem 0.125rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                },
              })}
              style={{
                backgroundColor: isSelected
                  ? isDark
                    ? '#8b5cf6'
                    : '#7c3aed'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                color: isSelected ? 'white' : isDark ? '#9ca3af' : '#6b7280',
              }}
            >
              {terms}
            </button>
          )
        })}
      </div>
    </div>
  )
}
