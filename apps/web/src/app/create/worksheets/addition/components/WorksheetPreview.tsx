'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { css } from '../../../../../../styled-system/css'
import { hstack, stack } from '../../../../../../styled-system/patterns'
import type { WorksheetFormState } from '../types'

interface WorksheetPreviewProps {
  formState: WorksheetFormState
  initialData?: string[]
  isDark?: boolean
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
  const fetchId = Math.random().toString(36).slice(2, 9)
  console.log(`[WorksheetPreview] fetchWorksheetPreview called (ID: ${fetchId})`, {
    seed: formState.seed,
    problemsPerPage: formState.problemsPerPage,
    pAnyStart: formState.pAnyStart,
    pAllStart: formState.pAllStart,
    mode: formState.mode,
    operator: formState.operator,
  })

  // Set current date for preview
  const configWithDate = {
    ...formState,
    date: getDefaultDate(),
  }

  // Use absolute URL for SSR compatibility
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  const url = `${baseUrl}/api/create/worksheets/addition/preview`

  console.log(`[WorksheetPreview] Fetching from API (ID: ${fetchId})...`)
  const response = await fetch(url, {
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
  console.log(`[WorksheetPreview] Fetch complete (ID: ${fetchId}), pages:`, data.pages.length)
  return data.pages
}

function PreviewContent({ formState, initialData, isDark = false }: WorksheetPreviewProps) {
  const t = useTranslations('create.worksheets.addition')
  const [currentPage, setCurrentPage] = useState(0)

  // Track if we've used the initial data (so we only use it once)
  const initialDataUsed = useRef(false)

  console.log('[WorksheetPreview] Rendering with formState:', {
    seed: formState.seed,
    problemsPerPage: formState.problemsPerPage,
    hasInitialData: !!initialData,
    initialDataUsed: initialDataUsed.current,
  })

  // Only use initialData on the very first query, not on subsequent fetches
  const queryInitialData = !initialDataUsed.current && initialData ? initialData : undefined

  if (queryInitialData) {
    console.log('[WorksheetPreview] Using server-generated initial data')
    initialDataUsed.current = true
  }

  // Use Suspense Query - will suspend during loading
  const { data: pages } = useSuspenseQuery({
    queryKey: [
      'worksheet-preview',
      // PRIMARY state
      formState.problemsPerPage,
      formState.cols,
      formState.pages,
      formState.orientation,
      // V4: Problem size (CRITICAL - affects column layout and problem generation)
      formState.digitRange?.min,
      formState.digitRange?.max,
      // V4: Operator selection (addition, subtraction, or mixed)
      formState.operator,
      // V4: Mode and conditional display settings
      formState.mode,
      formState.displayRules, // Smart mode: conditional scaffolding
      formState.difficultyProfile, // Smart mode: difficulty preset
      formState.manualPreset, // Manual mode: manual preset
      // Mastery mode: skill IDs (CRITICAL for mastery+mixed mode)
      formState.currentAdditionSkillId,
      formState.currentSubtractionSkillId,
      formState.currentStepId,
      // Other settings that affect appearance
      formState.name,
      formState.pAnyStart,
      formState.pAllStart,
      formState.interpolate,
      formState.showCarryBoxes,
      formState.showAnswerBoxes,
      formState.showPlaceValueColors,
      formState.showProblemNumbers,
      formState.showCellBorder,
      formState.showTenFrames,
      formState.showTenFramesForAll,
      formState.seed, // Include seed to bust cache when problem set regenerates
      // Note: fontSize, date, rows, total intentionally excluded
      // (rows and total are derived from primary state)
    ],
    queryFn: () => {
      console.log('[WorksheetPreview] Fetching preview from API...')
      return fetchWorksheetPreview(formState)
    },
    initialData: queryInitialData, // Only use on first render
  })

  console.log('[WorksheetPreview] Preview fetched, pages:', pages.length)

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
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          {t('preview.title')}
        </h3>
        <p
          className={css({
            fontSize: 'sm',
            color: isDark ? 'gray.300' : 'gray.600',
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
            alignItems: 'center',
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
              color: isDark ? 'gray.200' : 'gray.700',
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
          bg: isDark ? 'gray.700' : 'white',
          rounded: 'lg',
          p: '4',
          border: '1px solid',
          borderColor: isDark ? 'gray.600' : 'gray.200',
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
            alignItems: 'center',
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
              color: isDark ? 'gray.200' : 'gray.700',
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
          bg: isDark ? 'rgba(59, 130, 246, 0.1)' : 'blue.50',
          border: '1px solid',
          borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'blue.200',
          rounded: 'lg',
          p: '3',
          fontSize: 'sm',
          color: isDark ? 'blue.300' : 'blue.800',
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
  console.log('[WorksheetPreview] Showing fallback (Suspense boundary)')
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

export function WorksheetPreview({
  formState,
  initialData,
  isDark = false,
}: WorksheetPreviewProps) {
  return (
    <Suspense fallback={<PreviewFallback />}>
      <PreviewContent formState={formState} initialData={initialData} isDark={isDark} />
    </Suspense>
  )
}
