'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { hstack, stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'

interface WorksheetPreviewProps {
  formState: WorksheetFormState
}

function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

async function fetchWorksheetPreview(formState: WorksheetFormState): Promise<string[]> {
  // Set current date for preview
  const configWithDate = {
    ...formState,
    date: getDefaultDate(),
  }

  const response = await fetch('/api/create/worksheets/addition/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configWithDate),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMsg = errorData.error || errorData.message || 'Failed to fetch preview'
    const details = errorData.details ? `\n\n${errorData.details}` : ''
    const errors = errorData.errors ? `\n\nErrors:\n${errorData.errors.join('\n')}` : ''
    throw new Error(errorMsg + details + errors)
  }

  const data = await response.json()
  return data.pages
}

function PreviewContent({ formState }: WorksheetPreviewProps) {
  const t = useTranslations('create.worksheets.addition')
  const [currentPage, setCurrentPage] = useState(0)

  // Use Suspense Query - will suspend during loading
  const { data: pages } = useSuspenseQuery({
    queryKey: [
      'worksheet-preview',
      formState.total,
      formState.cols,
      formState.rows,
      formState.name,
      formState.pAnyStart,
      formState.pAllStart,
      formState.interpolate,
      formState.showCarryBoxes,
      formState.showCellBorder,
      // Note: seed, fontSize, and date intentionally excluded
    ],
    queryFn: () => fetchWorksheetPreview(formState),
  })

  const totalPages = pages.length

  // Reset to first page when preview updates
  useEffect(() => {
    setCurrentPage(0)
  }, [pages])

  return (
    <div data-component="worksheet-preview" className={stack({ gap: '4' })}>
      <div className={stack({ gap: '1' })}>
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: 'gray.900',
          })}
        >
          {t('preview.title')}
        </h3>
        <p
          className={css({
            fontSize: 'sm',
            color: 'gray.600',
          })}
        >
          {totalPages > 1 ? `${totalPages} pages` : t('preview.subtitle')}
        </p>
      </div>

      {/* Pagination Controls (top) */}
      {totalPages > 1 && (
        <div
          className={hstack({
            gap: '3',
            justify: 'center',
            align: 'center',
          })}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={css({
              px: '4',
              py: '2',
              bg: 'brand.600',
              color: 'white',
              rounded: 'lg',
              fontWeight: 'medium',
              cursor: 'pointer',
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
              _hover: {
                bg: 'brand.700',
              },
            })}
          >
            ← Previous
          </button>
          <span
            className={css({
              fontSize: 'sm',
              color: 'gray.700',
              fontWeight: 'medium',
            })}
          >
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className={css({
              px: '4',
              py: '2',
              bg: 'brand.600',
              color: 'white',
              rounded: 'lg',
              fontWeight: 'medium',
              cursor: 'pointer',
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
              _hover: {
                bg: 'brand.700',
              },
            })}
          >
            Next →
          </button>
        </div>
      )}

      {/* SVG Preview */}
      <div
        data-element="svg-preview"
        className={css({
          bg: 'white',
          rounded: 'lg',
          p: '4',
          border: '1px solid',
          borderColor: 'gray.200',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          '& svg': {
            maxWidth: '100%',
            maxHeight: '70vh',
            height: 'auto',
            width: 'auto',
          },
        })}
        dangerouslySetInnerHTML={{ __html: pages[currentPage] }}
      />

      {/* Pagination Controls (bottom) */}
      {totalPages > 1 && (
        <div
          className={hstack({
            gap: '3',
            justify: 'center',
            align: 'center',
          })}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={css({
              px: '4',
              py: '2',
              bg: 'brand.600',
              color: 'white',
              rounded: 'lg',
              fontWeight: 'medium',
              cursor: 'pointer',
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
              _hover: {
                bg: 'brand.700',
              },
            })}
          >
            ← Previous
          </button>
          <span
            className={css({
              fontSize: 'sm',
              color: 'gray.700',
              fontWeight: 'medium',
            })}
          >
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className={css({
              px: '4',
              py: '2',
              bg: 'brand.600',
              color: 'white',
              rounded: 'lg',
              fontWeight: 'medium',
              cursor: 'pointer',
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
              _hover: {
                bg: 'brand.700',
              },
            })}
          >
            Next →
          </button>
        </div>
      )}

      {/* Info about full worksheet */}
      <div
        className={css({
          bg: 'blue.50',
          border: '1px solid',
          borderColor: 'blue.200',
          rounded: 'lg',
          p: '3',
          fontSize: 'sm',
          color: 'blue.800',
        })}
      >
        <strong>Full worksheet:</strong> {formState.total} problems in a {formState.cols}×
        {formState.rows} grid
        {formState.interpolate && ' (progressive difficulty: easy → hard)'}
      </div>
    </div>
  )
}

function PreviewFallback() {
  return (
    <div
      data-component="worksheet-preview-loading"
      className={css({
        bg: 'white',
        rounded: '2xl',
        p: '6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '600px',
      })}
    >
      <p
        className={css({
          fontSize: 'lg',
          color: 'gray.400',
          textAlign: 'center',
        })}
      >
        Generating preview...
      </p>
    </div>
  )
}

export function WorksheetPreview({ formState }: WorksheetPreviewProps) {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <PreviewContent formState={formState} />
    </Suspense>
  )
}
