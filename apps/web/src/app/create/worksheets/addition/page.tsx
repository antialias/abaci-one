'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../../../styled-system/patterns'
import { ConfigPanel } from './components/ConfigPanel'
import { WorksheetPreview } from './components/WorksheetPreview'
import type { WorksheetFormState } from './types'
import { validateWorksheetConfig } from './validation'

type GenerationStatus = 'idle' | 'generating' | 'error'

/**
 * Get current date formatted as "Month Day, Year"
 */
function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AdditionWorksheetPage() {
  const t = useTranslations('create.worksheets.addition')
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Immediate form state (for controls - updates instantly)
  // PRIMARY state: problemsPerPage, cols, pages (what user controls)
  // DERIVED state: rows, total (calculated from primary)
  const [formState, setFormState] = useState<WorksheetFormState>({
    // Primary state
    problemsPerPage: 20,
    cols: 5,
    pages: 1,
    orientation: 'landscape',
    // Derived state
    rows: 4, // (20 / 5) * 1 = 4
    total: 20, // 20 * 1 = 20
    // Other settings
    name: '',
    date: '', // Will be set at generation time
    pAnyStart: 0.75,
    pAllStart: 0.25,
    interpolate: true,
    showCarryBoxes: true,
    showAnswerBoxes: true,
    showPlaceValueColors: true,
    showProblemNumbers: true,
    showCellBorder: true,
    showTenFrames: false,
    showTenFramesForAll: false,
    fontSize: 16,
    seed: Date.now() % 2147483647,
  })

  // Debounced form state (for preview - updates after delay)
  const [debouncedFormState, setDebouncedFormState] = useState<WorksheetFormState>(formState)

  // Debounce preview updates (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFormState(formState)
    }, 500)

    return () => clearTimeout(timer)
  }, [formState])

  const handleFormChange = (updates: Partial<WorksheetFormState>) => {
    setFormState((prev) => {
      const newState = { ...prev, ...updates }

      // Generate new seed when problem settings change
      const affectsProblems =
        updates.problemsPerPage !== undefined ||
        updates.cols !== undefined ||
        updates.pages !== undefined ||
        updates.orientation !== undefined ||
        updates.pAnyStart !== undefined ||
        updates.pAllStart !== undefined ||
        updates.interpolate !== undefined

      if (affectsProblems) {
        newState.seed = Date.now() % 2147483647
      }

      return newState
    })
  }

  const handleGenerate = async () => {
    setGenerationStatus('generating')
    setError(null)

    try {
      // Set current date at generation time
      const configWithDate = {
        ...formState,
        date: getDefaultDate(),
      }

      // Validate configuration
      const validation = validateWorksheetConfig(configWithDate)
      if (!validation.isValid || !validation.config) {
        throw new Error(validation.errors?.join(', ') || 'Invalid configuration')
      }

      const response = await fetch('/api/create/worksheets/addition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configWithDate),
      })

      if (!response.ok) {
        const errorResult = await response.json()
        const errorMsg = errorResult.details
          ? `${errorResult.error}\n\n${errorResult.details}`
          : errorResult.error || 'Generation failed'
        throw new Error(errorMsg)
      }

      // Success - response is binary PDF data, trigger download
      const blob = await response.blob()
      const filename = `addition-worksheet-${formState.name || 'student'}-${Date.now()}.pdf`

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setGenerationStatus('idle')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setGenerationStatus('error')
    }
  }

  const handleNewGeneration = () => {
    setGenerationStatus('idle')
    setError(null)
  }

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <div
        data-component="addition-worksheet-page"
        className={css({ minHeight: '100vh', bg: 'gray.50' })}
      >
        {/* Main Content */}
        <div className={container({ maxW: '7xl', px: '4', py: '8' })}>
          <div className={stack({ gap: '6', mb: '8' })}>
            <div className={stack({ gap: '2', textAlign: 'center' })}>
              <h1
                className={css({
                  fontSize: '3xl',
                  fontWeight: 'bold',
                  color: 'gray.900',
                })}
              >
                {t('pageTitle')}
              </h1>
              <p
                className={css({
                  fontSize: 'lg',
                  color: 'gray.600',
                })}
              >
                {t('pageSubtitle')}
              </p>
            </div>
          </div>

          {/* Configuration Interface */}
          <div
            className={grid({
              columns: { base: 1, lg: 2 },
              gap: '8',
              alignItems: 'start',
            })}
          >
            {/* Configuration Panel */}
            <div
              data-section="config-panel"
              className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '8',
              })}
            >
              <ConfigPanel formState={formState} onChange={handleFormChange} />
            </div>

            {/* Preview & Generate Panel */}
            <div className={stack({ gap: '8' })}>
              {/* Preview */}
              <div
                data-section="preview-panel"
                className={css({
                  bg: 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '6',
                })}
              >
                <WorksheetPreview formState={debouncedFormState} />
              </div>

              {/* Generate Button */}
              <div
                data-section="generate-panel"
                className={css({
                  bg: 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '6',
                })}
              >
                <button
                  data-action="generate-worksheet"
                  onClick={handleGenerate}
                  disabled={generationStatus === 'generating'}
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
                    cursor: generationStatus === 'generating' ? 'not-allowed' : 'pointer',
                    opacity: generationStatus === 'generating' ? '0.7' : '1',
                    _hover:
                      generationStatus === 'generating'
                        ? {}
                        : {
                            bg: 'brand.700',
                            transform: 'translateY(-1px)',
                            shadow: 'modal',
                          },
                  })}
                >
                  <span className={hstack({ gap: '3', justify: 'center' })}>
                    {generationStatus === 'generating' ? (
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
            </div>
          </div>

          {/* Error Display */}
          {generationStatus === 'error' && error && (
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
                  data-action="try-again"
                  onClick={handleNewGeneration}
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
          )}
        </div>
      </div>
    </PageWithNav>
  )
}
