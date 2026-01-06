'use client'

import { css } from '../../../../../../styled-system/css'

interface CollapsedCardProps {
  icon: string
  title: string
  summary?: string
  // For upcoming cards - can be a simple string or rich preview with multiple lines
  preview?:
    | {
        primary: string
        secondary?: string
        tertiary?: string
      }
    | string
  status: 'done' | 'upcoming'
}

export function CollapsedCard({ icon, title, summary, preview, status }: CollapsedCardProps) {
  const isDone = status === 'done'

  // Parse preview into lines
  const previewObj = typeof preview === 'string' ? { primary: preview } : preview

  // Rich preview means we need a larger card
  const hasRichPreview = !isDone && previewObj && (previewObj.secondary || previewObj.tertiary)

  return (
    <div
      data-element="collapsed-card"
      data-status={status}
      title={title}
      className={css({
        width: hasRichPreview ? '90px' : '70px',
        minHeight: hasRichPreview ? '85px' : '70px',
        py: hasRichPreview ? 2 : 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: hasRichPreview ? 1 : 0.5,
        bg: 'gray.800',
        borderRadius: 'lg',
        border: '2px solid',
        borderColor: isDone ? 'green.700' : 'gray.700',
        opacity: isDone ? 1 : 0.7,
        transition: 'all 0.3s ease',
      })}
    >
      {/* Icon */}
      <span className={css({ fontSize: 'lg' })}>{icon}</span>

      {isDone ? (
        /* Done state - simple summary */
        <span
          className={css({
            fontSize: 'xs',
            color: 'green.400',
            fontWeight: 'medium',
            textAlign: 'center',
            px: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          })}
        >
          {summary || '✓'}
        </span>
      ) : previewObj ? (
        /* Upcoming state with preview */
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
          })}
        >
          <span
            className={css({
              fontSize: 'xs',
              color: 'gray.300',
              fontWeight: 'medium',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            })}
          >
            {previewObj.primary}
          </span>
          {previewObj.secondary && (
            <span
              className={css({
                fontSize: '10px',
                color: 'gray.500',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              })}
            >
              {previewObj.secondary}
            </span>
          )}
          {previewObj.tertiary && (
            <span
              className={css({
                fontSize: '10px',
                color: 'gray.500',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              })}
            >
              {previewObj.tertiary}
            </span>
          )}
        </div>
      ) : (
        /* Fallback to title */
        <span
          className={css({
            fontSize: 'xs',
            color: 'gray.400',
            fontWeight: 'medium',
            textAlign: 'center',
          })}
        >
          {title}
        </span>
      )}
    </div>
  )
}
