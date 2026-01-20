'use client'

import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface Suggestion {
  id: string
  title: string
  description: string
  emoji: string
  difficulty: string
  similarity: number
  source: 'hardcoded' | 'database'
}

interface SuggestionPanelProps {
  suggestions: Suggestion[]
  isLoading: boolean
  isExpanded: boolean
  onUseFlowchart: (id: string) => void
  onExpand: () => void
  onCollapse: () => void
}

/**
 * Panel showing similar existing flowcharts when user types a topic.
 * Has two modes:
 * - Collapsed: shows top result with "Show X more" link
 * - Expanded: shows all results with "Back" button (replaces modal content)
 */
export function SuggestionPanel({
  suggestions,
  isLoading,
  isExpanded,
  onUseFlowchart,
  onExpand,
  onCollapse,
}: SuggestionPanelProps) {
  if (isLoading) {
    return (
      <div
        className={hstack({
          gap: '2',
          padding: '3',
          color: { base: 'gray.600', _dark: 'gray.400' },
          fontSize: 'sm',
        })}
      >
        <span className={css({ animation: 'spin 1s linear infinite' })}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        </span>
        <span>Searching for similar flowcharts...</span>
      </div>
    )
  }

  if (suggestions.length === 0) {
    return null
  }

  const visibleSuggestions = isExpanded ? suggestions : suggestions.slice(0, 1)
  const hiddenCount = suggestions.length - 1

  // Expanded mode: full list with back button
  if (isExpanded) {
    return (
      <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
        <div
          className={hstack({
            gap: '2',
            color: { base: 'gray.700', _dark: 'gray.300' },
            fontSize: 'md',
            fontWeight: 'medium',
          })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span>Similar flowcharts ({suggestions.length})</span>
        </div>

        <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
          {visibleSuggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onUse={() => onUseFlowchart(suggestion.id)}
            />
          ))}
        </div>

        <button
          onClick={onCollapse}
          className={css({
            padding: '3',
            borderRadius: 'lg',
            backgroundColor: 'transparent',
            color: { base: 'blue.600', _dark: 'blue.400' },
            fontWeight: 'medium',
            border: '1px solid',
            borderColor: { base: 'blue.300', _dark: 'blue.700' },
            cursor: 'pointer',
            _hover: {
              backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
            },
          })}
        >
          ← Back to create new
        </button>
      </div>
    )
  }

  // Collapsed mode: compact panel with top result
  return (
    <div
      className={vstack({
        gap: '3',
        alignItems: 'stretch',
        padding: '4',
        backgroundColor: { base: 'blue.50', _dark: 'blue.950' },
        borderRadius: 'lg',
        border: '1px solid',
        borderColor: { base: 'blue.200', _dark: 'blue.800' },
      })}
    >
      <div
        className={hstack({
          gap: '2',
          color: { base: 'blue.700', _dark: 'blue.300' },
          fontSize: 'sm',
          fontWeight: 'medium',
        })}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span>Or use an existing flowchart:</span>
      </div>

      <SuggestionItem
        suggestion={visibleSuggestions[0]}
        onUse={() => onUseFlowchart(visibleSuggestions[0].id)}
      />

      {hiddenCount > 0 && (
        <button
          onClick={onExpand}
          className={css({
            padding: '2',
            fontSize: 'sm',
            color: { base: 'blue.600', _dark: 'blue.400' },
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'center',
            _hover: {
              textDecoration: 'underline',
            },
          })}
        >
          Show {hiddenCount} more similar →
        </button>
      )}
    </div>
  )
}

function SuggestionItem({ suggestion, onUse }: { suggestion: Suggestion; onUse: () => void }) {
  return (
    <div
      className={hstack({
        gap: '3',
        padding: '3',
        backgroundColor: { base: 'white', _dark: 'gray.800' },
        borderRadius: 'md',
        border: '1px solid',
        borderColor: { base: 'gray.200', _dark: 'gray.700' },
        justifyContent: 'space-between',
      })}
    >
      <div className={vstack({ gap: '1', alignItems: 'flex-start', flex: '1' })}>
        <div className={hstack({ gap: '2', flexWrap: 'wrap' })}>
          <span className={css({ fontSize: 'lg' })}>{suggestion.emoji}</span>
          <span
            className={css({
              fontWeight: 'semibold',
              color: { base: 'gray.900', _dark: 'gray.100' },
              fontSize: 'sm',
            })}
          >
            {suggestion.title}
          </span>
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.500', _dark: 'gray.400' },
              backgroundColor: { base: 'gray.100', _dark: 'gray.700' },
              padding: '1',
              paddingX: '2',
              borderRadius: 'full',
            })}
          >
            {Math.round(suggestion.similarity * 100)}% match
          </span>
        </div>
        {suggestion.description && (
          <p
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.600', _dark: 'gray.400' },
              lineHeight: 'snug',
            })}
          >
            {suggestion.description}
          </p>
        )}
      </div>
      <button
        onClick={onUse}
        className={css({
          padding: '2',
          paddingX: '3',
          backgroundColor: { base: 'blue.600', _dark: 'blue.500' },
          color: 'white',
          borderRadius: 'md',
          fontSize: 'xs',
          fontWeight: 'medium',
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          _hover: {
            backgroundColor: { base: 'blue.700', _dark: 'blue.600' },
          },
        })}
      >
        Use This
      </button>
    </div>
  )
}
