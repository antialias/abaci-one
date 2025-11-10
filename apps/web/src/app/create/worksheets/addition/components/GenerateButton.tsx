'use client'

import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { hstack } from '../../../../../../styled-system/patterns'

type GenerationStatus = 'idle' | 'generating' | 'error'

interface GenerateButtonProps {
  status: GenerationStatus
  onGenerate: () => void
  isDark?: boolean
}

/**
 * Button to trigger worksheet PDF generation
 * Shows loading state during generation
 */
export function GenerateButton({ status, onGenerate, isDark = false }: GenerateButtonProps) {
  const t = useTranslations('create.worksheets.addition')
  const isGenerating = status === 'generating'

  return (
    <div
      data-section="generate-panel"
      className={css({
        bg: isDark ? 'gray.800' : 'white',
        rounded: '2xl',
        shadow: 'card',
        p: '6',
      })}
    >
      <button
        type="button"
        data-action="generate-worksheet"
        onClick={onGenerate}
        disabled={isGenerating}
        className={css({
          w: 'full',
          px: '6',
          py: '4',
          bg: 'brand.600',
          color: 'white',
          fontSize: 'lg',
          fontWeight: 'semibold',
          rounded: 'xl',
          shadow: 'card',
          transition: 'all',
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          opacity: isGenerating ? '0.7' : '1',
          _hover: isGenerating
            ? {}
            : {
                bg: 'brand.700',
                transform: 'translateY(-1px)',
                shadow: 'modal',
              },
        })}
      >
        <span className={hstack({ gap: '3', justify: 'center' })}>
          {isGenerating ? (
            <>
              <div
                className={css({
                  w: '5',
                  h: '5',
                  border: '2px solid',
                  borderColor: 'white',
                  borderTopColor: 'transparent',
                  rounded: 'full',
                  animation: 'spin 1s linear infinite',
                })}
              />
              {t('generate.generating')}
            </>
          ) : (
            <>
              <div className={css({ fontSize: 'xl' })}>📝</div>
              {t('generate.button')}
            </>
          )}
        </span>
      </button>
    </div>
  )
}
