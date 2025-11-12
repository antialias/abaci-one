'use client'

import { useState } from 'react'
import { css } from '@styled/css'
import { useWorksheetPreview } from './WorksheetPreviewContext'

export function DuplicateWarningBanner() {
  const { warnings, isDismissed, setIsDismissed } = useWorksheetPreview()
  const [showDetails, setShowDetails] = useState(false)

  if (warnings.length === 0 || isDismissed) {
    return null
  }

  // Parse warnings to extract actionable items
  const firstWarning = warnings[0]
  const hasMultipleWarnings = warnings.length > 1

  return (
    <div
      data-element="problem-space-warning"
      className={css({
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxW: 'calc(100% - 160px)', // Leave space for action button
        zIndex: 100,
        bg: 'rgba(254, 243, 199, 0.95)', // amber.100 with transparency
        backdropFilter: 'blur(8px)',
        border: '1px solid',
        borderColor: 'amber.300',
        rounded: '15px',
        p: '4',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        boxShadow: '0 2px 12px rgba(217, 119, 6, 0.15)', // amber shadow
      })}
    >
      {/* Warning Icon */}
      <div
        className={css({
          fontSize: '2xl',
          lineHeight: '1',
          flexShrink: '0',
        })}
      >
        ⚠️
      </div>

      {/* Content */}
      <div className={css({ flex: '1', display: 'flex', flexDirection: 'column', gap: '2' })}>
        <div
          className={css({
            fontWeight: 'bold',
            fontSize: 'md',
            color: 'amber.900',
          })}
        >
          Not Enough Unique Problems
        </div>
        <div
          className={css({
            fontSize: 'sm',
            color: 'amber.800',
            lineHeight: '1.5',
          })}
        >
          {firstWarning}
        </div>

        {/* Show/Hide Details Toggle */}
        {hasMultipleWarnings && (
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className={css({
              alignSelf: 'flex-start',
              fontSize: 'xs',
              fontWeight: 'semibold',
              color: 'amber.700',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              p: '0',
              textDecoration: 'underline',
              _hover: {
                color: 'amber.900',
              },
            })}
          >
            {showDetails ? '▼ Hide details' : '▶ Show details'}
          </button>
        )}

        {/* Detailed warnings (collapsed by default) */}
        {showDetails && hasMultipleWarnings && (
          <div
            className={css({
              fontSize: 'xs',
              color: 'amber.800',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              mt: '2',
              pl: '3',
              borderLeft: '2px solid',
              borderColor: 'amber.300',
            })}
          >
            {warnings.slice(1).join('\n\n')}
          </div>
        )}
      </div>

      {/* Prominent Dismiss Button */}
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className={css({
          flexShrink: '0',
          px: '3',
          py: '1.5',
          bg: 'amber.600',
          color: 'white',
          fontSize: 'sm',
          fontWeight: 'bold',
          rounded: 'full',
          cursor: 'pointer',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '1',
          transition: 'all 0.2s',
          _hover: {
            bg: 'amber.700',
            transform: 'scale(1.05)',
          },
        })}
        aria-label="Dismiss warning"
      >
        <span>✕</span>
        <span>Dismiss</span>
      </button>
    </div>
  )
}
