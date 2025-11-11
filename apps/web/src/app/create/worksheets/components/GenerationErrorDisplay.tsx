'use client'

import { useTranslations } from 'next-intl'
import { css } from '@styled/css'
import { stack, hstack } from '@styled/patterns'

interface GenerationErrorDisplayProps {
  error: string | null
  visible: boolean
  onRetry: () => void
}

/**
 * Display generation errors with retry button
 * Only visible when error state is active
 */
export function GenerationErrorDisplay({ error, visible, onRetry }: GenerationErrorDisplayProps) {
  const t = useTranslations('create.worksheets.addition')

  if (!visible || !error) {
    return null
  }

  return (
    <div
      data-status="error"
      className={css({
        bg: 'red.50',
        border: '1px solid',
        borderColor: 'red.200',
        rounded: '2xl',
        p: '8',
        mt: '8',
      })}
    >
      <div className={stack({ gap: '4' })}>
        <div className={hstack({ gap: '3', alignItems: 'center' })}>
          <div className={css({ fontSize: '2xl' })}>❌</div>
          <h3
            className={css({
              fontSize: 'xl',
              fontWeight: 'semibold',
              color: 'red.800',
            })}
          >
            {t('error.title')}
          </h3>
        </div>
        <pre
          className={css({
            color: 'red.700',
            lineHeight: 'relaxed',
            whiteSpace: 'pre-wrap',
            fontFamily: 'mono',
            fontSize: 'sm',
            overflowX: 'auto',
          })}
        >
          {error}
        </pre>
        <button
          type="button"
          data-action="try-again"
          onClick={onRetry}
          className={css({
            alignSelf: 'start',
            px: '4',
            py: '2',
            bg: 'red.600',
            color: 'white',
            fontWeight: 'medium',
            rounded: 'lg',
            transition: 'all',
            _hover: { bg: 'red.700' },
          })}
        >
          {t('error.tryAgain')}
        </button>
      </div>
    </div>
  )
}
