'use client'

import { useTranslations } from 'next-intl'
import React, { useState, useEffect } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../../../../styled-system/patterns'
import { ConfigPanel } from './ConfigPanel'
import { WorksheetPreview } from './WorksheetPreview'
import type { WorksheetFormState } from '../types'
import { validateWorksheetConfig } from '../validation'
import type { DisplayExamples } from '../generateExamples'

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

interface AdditionWorksheetClientProps {
  initialSettings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  initialPreview?: string[]
  displayExamples?: DisplayExamples
}

export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
  displayExamples,
}: AdditionWorksheetClientProps) {
  console.log('[Worksheet Client] Component render, initialSettings:', {
    problemsPerPage: initialSettings.problemsPerPage,
    cols: initialSettings.cols,
    pages: initialSettings.pages,
    seed: initialSettings.seed,
  })

  const t = useTranslations('create.worksheets.addition')
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Calculate derived state from initial settings
  const rows = Math.ceil(
    (initialSettings.problemsPerPage * initialSettings.pages) / initialSettings.cols
  )
  const total = initialSettings.problemsPerPage * initialSettings.pages

  // Immediate form state (for controls - updates instantly)
  const [formState, setFormState] = useState<WorksheetFormState>(() => {
    const initial = {
      ...initialSettings,
      rows,
      total,
      date: '', // Will be set at generation time
      // seed comes from initialSettings (server-generated, stable across StrictMode remounts)
    }
    console.log('[Worksheet Client] Initial formState:', { seed: initial.seed })
    return initial
  })

  // Debounced form state (for preview - updates after delay)
  const [debouncedFormState, setDebouncedFormState] = useState<WorksheetFormState>(() => {
    console.log('[Worksheet Client] Initial debouncedFormState (same as formState)')
    return formState
  })

  // Store the previous formState to detect real changes
  const prevFormStateRef = React.useRef(formState)

  // Log whenever debouncedFormState changes (this triggers preview re-fetch)
  useEffect(() => {
    console.log('[Worksheet Client] debouncedFormState changed - preview will re-fetch:', {
      seed: debouncedFormState.seed,
      problemsPerPage: debouncedFormState.problemsPerPage,
    })
  }, [debouncedFormState])

  // Debounce preview updates (500ms delay) - only when formState actually changes
  useEffect(() => {
    console.log('[Debounce Effect] Triggered')
    console.log('[Debounce Effect] Current formState seed:', formState.seed)
    console.log('[Debounce Effect] Previous formState seed:', prevFormStateRef.current.seed)

    // Skip if formState hasn't actually changed (handles StrictMode double-render)
    if (formState === prevFormStateRef.current) {
      console.log('[Debounce Effect] Skipping - formState reference unchanged')
      return
    }

    prevFormStateRef.current = formState

    console.log('[Debounce Effect] Setting timer to update debouncedFormState in 500ms')
    const timer = setTimeout(() => {
      console.log('[Debounce Effect] Timer fired - updating debouncedFormState')
      setDebouncedFormState(formState)
    }, 500)

    return () => {
      console.log('[Debounce Effect] Cleanup - clearing timer')
      clearTimeout(timer)
    }
  }, [formState])

  // Store the previous formState for auto-save to detect real changes
  const prevAutoSaveFormStateRef = React.useRef(formState)

  // Auto-save settings when they change (debounced) - skip on initial mount
  useEffect(() => {
    // Skip auto-save if formState hasn't actually changed (handles StrictMode double-render)
    if (formState === prevAutoSaveFormStateRef.current) {
      console.log('[Worksheet Settings] Skipping auto-save - formState reference unchanged')
      return
    }

    prevAutoSaveFormStateRef.current = formState

    console.log('[Worksheet Settings] Settings changed, will save in 1s...')

    const timer = setTimeout(async () => {
      console.log('[Worksheet Settings] Attempting to save settings...')
      setIsSaving(true)
      try {
        // Extract only the fields we want to persist (exclude date, seed, derived state)
        const {
          problemsPerPage,
          cols,
          pages,
          orientation,
          name,
          pAnyStart,
          pAllStart,
          interpolate,
          showCarryBoxes,
          showAnswerBoxes,
          showPlaceValueColors,
          showProblemNumbers,
          showCellBorder,
          showTenFrames,
          showTenFramesForAll,
          fontSize,
        } = formState

        const response = await fetch('/api/worksheets/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'addition',
            config: {
              problemsPerPage,
              cols,
              pages,
              orientation,
              name,
              pAnyStart,
              pAllStart,
              interpolate,
              showCarryBoxes,
              showAnswerBoxes,
              showPlaceValueColors,
              showProblemNumbers,
              showCellBorder,
              showTenFrames,
              showTenFramesForAll,
              fontSize,
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[Worksheet Settings] Save response:', data)
          if (data.success) {
            console.log('[Worksheet Settings] ✓ Settings saved successfully')
            setLastSaved(new Date())
          } else {
            console.log('[Worksheet Settings] Save skipped')
          }
        } else {
          console.error('[Worksheet Settings] Save failed with status:', response.status)
        }
      } catch (error) {
        // Silently fail - settings persistence is not critical
        console.error('[Worksheet Settings] Settings save error:', error)
      } finally {
        setIsSaving(false)
      }
    }, 1000) // 1 second debounce for auto-save

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
            <div className={stack({ gap: '3' })}>
              <div
                data-section="config-panel"
                className={css({
                  bg: 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '8',
                })}
              >
                <ConfigPanel
                  formState={formState}
                  onChange={handleFormChange}
                  displayExamples={displayExamples}
                />
              </div>

              {/* Settings saved indicator */}
              <div
                data-element="settings-status"
                className={css({
                  fontSize: 'sm',
                  color: 'gray.600',
                  textAlign: 'center',
                  py: '2',
                })}
              >
                {isSaving ? (
                  <span className={css({ color: 'gray.500' })}>Saving settings...</span>
                ) : lastSaved ? (
                  <span className={css({ color: 'green.600' })}>
                    ✓ Settings saved at {lastSaved.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
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
                <WorksheetPreview formState={debouncedFormState} initialData={initialPreview} />
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
