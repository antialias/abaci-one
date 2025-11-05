'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { css } from '../../styled-system/css'
import type { FlashcardFormState } from '@/app/create/flashcards/page'

interface FlashcardPreviewProps {
  config: Partial<FlashcardFormState>
}

async function fetchFlashcardPreview(config: Partial<FlashcardFormState>): Promise<string | null> {
  const response = await fetch('/api/create/flashcards/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || errorData.message || 'Failed to fetch preview')
  }

  const data = await response.json()
  return data.svg
}

export function FlashcardPreview({ config }: FlashcardPreviewProps) {
  const t = useTranslations('create.flashcards')

  // Use React Query to fetch preview (with automatic caching and updates)
  const {
    data: previewSvg,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['flashcard-preview', config],
    queryFn: () => fetchFlashcardPreview(config),
    enabled: typeof window !== 'undefined' && !!config.range,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 1,
  })

  // Show loading state
  if (isLoading || !previewSvg) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          color: 'gray.600',
        })}
      >
        <div
          className={css({
            w: '8',
            h: '8',
            border: '3px solid',
            borderColor: 'gray.200',
            borderTopColor: 'brand.600',
            rounded: 'full',
            animation: 'spin 1s linear infinite',
            mb: '4',
          })}
        />
        <p className={css({ fontSize: 'lg' })}>
          {isLoading ? t('preview.loading') : t('preview.noPreview')}
        </p>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          color: 'red.600',
          p: '6',
          textAlign: 'center',
        })}
      >
        <p className={css({ fontSize: 'lg', fontWeight: 'semibold', mb: '2' })}>
          {t('preview.error')}
        </p>
        <p className={css({ fontSize: 'sm', color: 'red.500' })}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
      })}
    >
      <div
        className={css({
          fontSize: 'sm',
          fontWeight: 'medium',
          color: 'brand.700',
          textAlign: 'center',
        })}
      >
        {t('preview.livePreview')}
      </div>
      <div
        className={css({
          bg: 'white',
          rounded: 'lg',
          p: '4',
          border: '2px solid',
          borderColor: 'gray.200',
          overflow: 'auto',
          maxHeight: '600px',
        })}
        dangerouslySetInnerHTML={{ __html: previewSvg }}
      />
      <div
        className={css({
          fontSize: 'xs',
          color: 'gray.500',
          textAlign: 'center',
        })}
      >
        {t('preview.hint')}
      </div>
    </div>
  )
}
