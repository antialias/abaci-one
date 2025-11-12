'use client'

import { css } from '@styled/css'
import { useWorksheetPreview } from './WorksheetPreviewContext'

export function DuplicateWarningBanner() {
  const { warnings, isDismissed, setIsDismissed } = useWorksheetPreview()

  if (warnings.length === 0 || isDismissed) {
    return null
  }

  return (
    <div
      data-element="problem-space-warning"
      className={css({
        position: 'absolute',
        top: '24', // Well below the page indicator to avoid overlap
        left: '4',
        right: '20', // More space on right to avoid action button
        zIndex: 100,
        bg: 'yellow.50',
        border: '1px solid',
        borderColor: 'yellow.300',
        rounded: '15px',
        p: '4',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      })}
    >
      <div className={css({ flex: '1', display: 'flex', flexDirection: 'column', gap: '2' })}>
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontWeight: 'semibold',
            fontSize: 'md',
            color: 'yellow.800',
          })}
        >
          <span>⚠️</span>
          <span>Duplicate Problem Risk</span>
        </div>
        <div
          className={css({
            fontSize: 'sm',
            color: 'yellow.900',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
          })}
        >
          {warnings.join('\n\n')}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className={css({
          flexShrink: '0',
          color: 'yellow.700',
          fontSize: 'xl',
          lineHeight: '1',
          cursor: 'pointer',
          bg: 'transparent',
          border: 'none',
          p: '1',
          _hover: {
            color: 'yellow.900',
            bg: 'yellow.100',
            rounded: 'sm',
          },
        })}
        aria-label="Dismiss warning"
      >
        ×
      </button>
    </div>
  )
}
