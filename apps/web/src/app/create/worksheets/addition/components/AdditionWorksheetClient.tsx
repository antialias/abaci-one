'use client'

import { useTranslations } from 'next-intl'
import React, { useState, useEffect } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../../../../styled-system/patterns'
import { ConfigPanel } from './ConfigPanel'
import { WorksheetPreview } from './WorksheetPreview'
import type { WorksheetFormState } from '../types'
import { validateWorksheetConfig } from '../validation'
import { defaultAdditionConfig } from '../../config-schemas'

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
}

export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
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
  // Use defaults for required fields (server should always provide these, but TypeScript needs guarantees)
  const problemsPerPage = initialSettings.problemsPerPage ?? 20
  const pages = initialSettings.pages ?? 1
  const cols = initialSettings.cols ?? 5

  const rows = Math.ceil((problemsPerPage * pages) / cols)
  const total = problemsPerPage * pages

  // Immediate form state (for controls - updates instantly)
  const [formState, setFormState] = useState<WorksheetFormState>(() => {
    const initial = {
      ...initialSettings,
      rows,
      total,
      date: '', // Will be set at generation time
      // seed comes from initialSettings (server-generated, stable across StrictMode remounts)
      // Ensure displayRules is always defined (critical for difficulty adjustment)
      displayRules: initialSettings.displayRules ?? defaultAdditionConfig.displayRules,
      pAnyStart: initialSettings.pAnyStart ?? defaultAdditionConfig.pAnyStart,
      pAllStart: initialSettings.pAllStart ?? defaultAdditionConfig.pAllStart,
    }
    console.log('[Worksheet Client] Initial formState:', {
      seed: initial.seed,
      displayRules: initial.displayRules,
    })
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

  // Helper to get default columns based on problems per page and orientation
  const getDefaultColsForProblemsPerPage = (
    problemsPerPage: number,
    orientation: 'portrait' | 'landscape'
  ): number => {
    if (orientation === 'portrait') {
      if (problemsPerPage === 6) return 2
      if (problemsPerPage === 8) return 2
      if (problemsPerPage === 10) return 2
      if (problemsPerPage === 12) return 3
      if (problemsPerPage === 15) return 3
      return 2
    } else {
      if (problemsPerPage === 8) return 4
      if (problemsPerPage === 10) return 5
      if (problemsPerPage === 12) return 4
      if (problemsPerPage === 15) return 5
      if (problemsPerPage === 16) return 4
      if (problemsPerPage === 20) return 5
      return 4
    }
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
                <ConfigPanel formState={formState} onChange={handleFormChange} />
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
              {/* Orientation Panel */}
              <div
                data-section="orientation-panel"
                className={css({
                  bg: 'white',
                  rounded: '2xl',
                  shadow: 'card',
                  p: '4',
                })}
              >
                <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
                  {/* Row 1: Orientation + Pages */}
                  <div
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '3',
                      alignItems: 'end',
                    })}
                  >
                    {/* Orientation */}
                    <div>
                      <div
                        className={css({
                          fontSize: '2xs',
                          fontWeight: 'semibold',
                          color: 'gray.500',
                          textTransform: 'uppercase',
                          letterSpacing: 'wider',
                          mb: '1.5',
                        })}
                      >
                        Orientation
                      </div>
                      <div className={css({ display: 'flex', gap: '1.5' })}>
                        <button
                          onClick={() => {
                            const orientation = 'portrait'
                            const problemsPerPage = 15
                            const cols = 3
                            const pages = formState.pages || 1
                            const rows = Math.ceil((problemsPerPage * pages) / cols)
                            const total = problemsPerPage * pages
                            setFormState({
                              ...formState,
                              orientation,
                              problemsPerPage,
                              cols,
                              pages,
                              rows,
                              total,
                            })
                          }}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.5',
                            flex: '1',
                            px: '3',
                            py: '2',
                            border: '2px solid',
                            borderColor:
                              formState.orientation === 'portrait' ? 'brand.500' : 'gray.300',
                            bg: formState.orientation === 'portrait' ? 'brand.50' : 'white',
                            rounded: 'lg',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            _hover: {
                              borderColor: 'brand.400',
                            },
                          })}
                        >
                          <div
                            className={css({
                              fontSize: 'lg',
                            })}
                          >
                            📄
                          </div>
                          <div
                            className={css({
                              fontSize: 'sm',
                              fontWeight: 'semibold',
                              color:
                                formState.orientation === 'portrait' ? 'brand.700' : 'gray.600',
                            })}
                          >
                            Portrait
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            const orientation = 'landscape'
                            const problemsPerPage = 20
                            const cols = 5
                            const pages = formState.pages || 1
                            const rows = Math.ceil((problemsPerPage * pages) / cols)
                            const total = problemsPerPage * pages
                            setFormState({
                              ...formState,
                              orientation,
                              problemsPerPage,
                              cols,
                              pages,
                              rows,
                              total,
                            })
                          }}
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.5',
                            flex: '1',
                            px: '3',
                            py: '2',
                            border: '2px solid',
                            borderColor:
                              formState.orientation === 'landscape' ? 'brand.500' : 'gray.300',
                            bg: formState.orientation === 'landscape' ? 'brand.50' : 'white',
                            rounded: 'lg',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            _hover: {
                              borderColor: 'brand.400',
                            },
                          })}
                        >
                          <div
                            className={css({
                              fontSize: 'lg',
                            })}
                          >
                            📃
                          </div>
                          <div
                            className={css({
                              fontSize: 'sm',
                              fontWeight: 'semibold',
                              color:
                                formState.orientation === 'landscape' ? 'brand.700' : 'gray.600',
                            })}
                          >
                            Landscape
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Pages */}
                    <div>
                      <div
                        className={css({
                          fontSize: '2xs',
                          fontWeight: 'semibold',
                          color: 'gray.500',
                          textTransform: 'uppercase',
                          letterSpacing: 'wider',
                          mb: '1.5',
                        })}
                      >
                        Pages
                      </div>
                      <div className={css({ display: 'flex', gap: '1' })}>
                        {[1, 2, 3, 4].map((pageCount) => {
                          const isSelected = (formState.pages || 1) === pageCount
                          return (
                            <button
                              key={pageCount}
                              onClick={() => {
                                const problemsPerPage = formState.problemsPerPage || 15
                                const cols = formState.cols || 3
                                const rows = Math.ceil((problemsPerPage * pageCount) / cols)
                                const total = problemsPerPage * pageCount
                                setFormState({
                                  ...formState,
                                  pages: pageCount,
                                  rows,
                                  total,
                                })
                              }}
                              className={css({
                                w: '10',
                                h: '10',
                                border: '2px solid',
                                borderColor: isSelected ? 'brand.500' : 'gray.300',
                                bg: isSelected ? 'brand.50' : 'white',
                                rounded: 'lg',
                                cursor: 'pointer',
                                fontSize: 'sm',
                                fontWeight: 'bold',
                                color: isSelected ? 'brand.700' : 'gray.600',
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                _hover: {
                                  borderColor: 'brand.400',
                                },
                              })}
                            >
                              {pageCount}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Problems per page dropdown + Total badge */}
                  <div
                    className={css({
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '3',
                      alignItems: 'center',
                    })}
                  >
                    <div>
                      <div
                        className={css({
                          fontSize: '2xs',
                          fontWeight: 'semibold',
                          color: 'gray.500',
                          textTransform: 'uppercase',
                          letterSpacing: 'wider',
                          display: 'block',
                          mb: '1.5',
                        })}
                      >
                        Problems per Page
                      </div>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            className={css({
                              w: 'full',
                              px: '3',
                              py: '2',
                              border: '2px solid',
                              borderColor: 'gray.300',
                              bg: 'white',
                              rounded: 'lg',
                              cursor: 'pointer',
                              fontSize: 'sm',
                              fontWeight: 'medium',
                              color: 'gray.700',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              _hover: {
                                borderColor: 'brand.400',
                              },
                            })}
                          >
                            <span>
                              {formState.problemsPerPage || 15} problems (
                              {getDefaultColsForProblemsPerPage(
                                formState.problemsPerPage || 15,
                                formState.orientation || 'portrait'
                              )}{' '}
                              cols ×{' '}
                              {Math.ceil(
                                (formState.problemsPerPage || 15) /
                                  getDefaultColsForProblemsPerPage(
                                    formState.problemsPerPage || 15,
                                    formState.orientation || 'portrait'
                                  )
                              )}{' '}
                              rows)
                            </span>
                            <span className={css({ fontSize: 'xs', color: 'gray.400' })}>▼</span>
                          </button>
                        </DropdownMenu.Trigger>

                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className={css({
                              bg: 'white',
                              rounded: 'lg',
                              shadow: 'modal',
                              border: '1px solid',
                              borderColor: 'gray.200',
                              p: '2',
                              minW: '64',
                              maxH: '96',
                              overflowY: 'auto',
                              zIndex: 50,
                            })}
                            sideOffset={5}
                          >
                            <div
                              className={css({
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1',
                              })}
                            >
                              {((formState.orientation || 'portrait') === 'portrait'
                                ? [6, 8, 10, 12, 15]
                                : [8, 10, 12, 15, 16, 20]
                              ).map((count) => {
                                const orientation = formState.orientation || 'portrait'
                                const cols = getDefaultColsForProblemsPerPage(count, orientation)
                              const rows = Math.ceil(count / cols)
                              const isSelected = (formState.problemsPerPage || 15) === count

                              return (
                                <DropdownMenu.Item
                                  key={count}
                                  onSelect={() => {
                                    const newCols = getDefaultColsForProblemsPerPage(
                                      count,
                                      orientation
                                    )
                                    const pages = formState.pages || 1
                                    const rowsCalc = Math.ceil((count * pages) / newCols)
                                    const total = count * pages
                                    setFormState({
                                      ...formState,
                                      problemsPerPage: count,
                                      cols: newCols,
                                      pages,
                                      rows: rowsCalc,
                                      total,
                                    })
                                  }}
                                  className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3',
                                    px: '3',
                                    py: '2',
                                    rounded: 'md',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    bg: isSelected ? 'brand.50' : 'transparent',
                                    _hover: {
                                      bg: 'brand.50',
                                    },
                                    _focus: {
                                      bg: 'brand.100',
                                    },
                                  })}
                                >
                                  {/* Grid visualization */}
                                  <div
                                    className={css({
                                      display: 'grid',
                                      placeItems: 'center',
                                      w: '12',
                                      h: '12',
                                      flexShrink: 0,
                                    })}
                                    style={{
                                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                                      gap: '2px',
                                    }}
                                  >
                                    {Array.from({ length: count }).map((_, i) => (
                                      <div
                                        key={i}
                                        className={css({
                                          w: '1.5',
                                          h: '1.5',
                                          bg: isSelected ? 'brand.500' : 'gray.400',
                                          rounded: 'full',
                                        })}
                                      />
                                    ))}
                                  </div>
                                  {/* Text description */}
                                  <div className={css({ flex: 1 })}>
                                    <div
                                      className={css({
                                        fontSize: 'sm',
                                        fontWeight: 'semibold',
                                        color: isSelected ? 'brand.700' : 'gray.700',
                                      })}
                                    >
                                      {count} problems
                                    </div>
                                    <div
                                      className={css({
                                        fontSize: 'xs',
                                        color: isSelected ? 'brand.600' : 'gray.500',
                                      })}
                                    >
                                      {cols} cols × {rows} rows
                                    </div>
                                  </div>
                                </DropdownMenu.Item>
                              )
                            })}
                            </div>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>

                    {/* Total problems badge */}
                    <div
                      className={css({
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1',
                      })}
                    >
                      <div
                        className={css({
                          fontSize: '2xs',
                          fontWeight: 'semibold',
                          color: 'gray.500',
                          textTransform: 'uppercase',
                          letterSpacing: 'wider',
                        })}
                      >
                        Total
                      </div>
                      <div
                        className={css({
                          px: '4',
                          py: '2',
                          bg: 'brand.100',
                          rounded: 'full',
                          fontSize: 'lg',
                          fontWeight: 'bold',
                          color: 'brand.700',
                        })}
                      >
                        {(formState.problemsPerPage || 15) * (formState.pages || 1)}
                      </div>
                    </div>
                  </div>
                </div>
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
