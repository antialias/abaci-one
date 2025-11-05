'use client'

import { useAbacusConfig } from '@soroban/abacus-react'
import { useForm } from '@tanstack/react-form'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ConfigurationFormWithoutGenerate } from '@/components/ConfigurationFormWithoutGenerate'
import { GenerationProgress } from '@/components/GenerationProgress'
import { FlashcardPreview } from '@/components/FlashcardPreview'
import { PageWithNav } from '@/components/PageWithNav'
import { StyleControls } from '@/components/StyleControls'
import { css } from '../../../../styled-system/css'
import { container, grid, hstack, stack } from '../../../../styled-system/patterns'

// Complete, validated configuration ready for generation
export interface FlashcardConfig {
  range: string
  step?: number
  cardsPerPage?: number
  paperSize?: 'us-letter' | 'a4' | 'a3' | 'a5'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
  gutter?: string
  shuffle?: boolean
  seed?: number
  showCutMarks?: boolean
  showRegistration?: boolean
  fontFamily?: string
  fontSize?: string
  columns?: string | number
  showEmptyColumns?: boolean
  hideInactiveBeads?: boolean
  beadShape?: 'diamond' | 'circle' | 'square'
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  coloredNumerals?: boolean
  scaleFactor?: number
  format?: 'pdf' | 'html' | 'png' | 'svg'
}

// Partial form state during editing (may have undefined values)
export interface FlashcardFormState {
  range?: string
  step?: number
  cardsPerPage?: number
  paperSize?: 'us-letter' | 'a4' | 'a3' | 'a5'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
  gutter?: string
  shuffle?: boolean
  seed?: number
  showCutMarks?: boolean
  showRegistration?: boolean
  fontFamily?: string
  fontSize?: string
  columns?: string | number
  showEmptyColumns?: boolean
  hideInactiveBeads?: boolean
  beadShape?: 'diamond' | 'circle' | 'square'
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  coloredNumerals?: boolean
  scaleFactor?: number
  format?: 'pdf' | 'html' | 'png' | 'svg'
}

// Validation function to convert form state to complete config
function validateAndCompleteConfig(formState: FlashcardFormState): FlashcardConfig {
  return {
    // Required fields with defaults
    range: formState.range || '0-99',

    // Optional fields with defaults
    step: formState.step ?? 1,
    cardsPerPage: formState.cardsPerPage ?? 6,
    paperSize: formState.paperSize ?? 'us-letter',
    orientation: formState.orientation ?? 'portrait',
    gutter: formState.gutter ?? '5mm',
    shuffle: formState.shuffle ?? false,
    seed: formState.seed,
    showCutMarks: formState.showCutMarks ?? false,
    showRegistration: formState.showRegistration ?? false,
    fontFamily: formState.fontFamily ?? 'DejaVu Sans',
    fontSize: formState.fontSize ?? '48pt',
    columns: formState.columns ?? 'auto',
    showEmptyColumns: formState.showEmptyColumns ?? false,
    hideInactiveBeads: formState.hideInactiveBeads ?? false,
    beadShape: formState.beadShape ?? 'diamond',
    colorScheme: formState.colorScheme ?? 'place-value',
    coloredNumerals: formState.coloredNumerals ?? false,
    scaleFactor: formState.scaleFactor ?? 0.9,
    format: formState.format ?? 'pdf',
    margins: formState.margins,
  }
}

type GenerationStatus = 'idle' | 'generating' | 'error'

export default function CreatePage() {
  const t = useTranslations('create.flashcards')
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const globalConfig = useAbacusConfig()

  const form = useForm<FlashcardFormState>({
    defaultValues: {
      range: '0-99',
      step: 1,
      cardsPerPage: 6,
      paperSize: 'us-letter',
      orientation: 'portrait',
      gutter: '5mm',
      shuffle: false,
      showCutMarks: false,
      showRegistration: false,
      fontFamily: 'DejaVu Sans',
      fontSize: '48pt',
      columns: 'auto',
      showEmptyColumns: false,
      // Use global config for abacus display settings
      hideInactiveBeads: globalConfig.hideInactiveBeads,
      beadShape: globalConfig.beadShape,
      colorScheme: globalConfig.colorScheme,
      coloredNumerals: globalConfig.coloredNumerals,
      scaleFactor: globalConfig.scaleFactor,
      format: 'pdf',
    },
  })

  const handleGenerate = async (formState: FlashcardFormState) => {
    setGenerationStatus('generating')
    setError(null)

    try {
      // Validate and complete the configuration
      const config = validateAndCompleteConfig(formState)

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        // Handle error response (should be JSON)
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'Generation failed')
      }

      // Success - response is binary PDF data, trigger download
      const blob = await response.blob()
      const filename = `soroban-flashcards-${config.range || 'cards'}.pdf`

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

      setGenerationStatus('idle') // Reset to idle after successful download
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
    <PageWithNav navTitle={t('navTitle')} navEmoji="✨">
      <div className={css({ minHeight: '100vh', bg: 'gray.50' })}>
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
              columns: { base: 1, lg: 3 },
              gap: '8',
              alignItems: 'start',
            })}
          >
            {/* Main Configuration Panel */}
            <div
              className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '8',
              })}
            >
              <ConfigurationFormWithoutGenerate form={form} />
            </div>

            {/* Style Controls Panel */}
            <div
              className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '6',
              })}
            >
              <div className={stack({ gap: '4' })}>
                <div className={stack({ gap: '1' })}>
                  <h3
                    className={css({
                      fontSize: 'lg',
                      fontWeight: 'bold',
                      color: 'gray.900',
                    })}
                  >
                    {t('stylePanel.title')}
                  </h3>
                  <p
                    className={css({
                      fontSize: 'sm',
                      color: 'gray.600',
                    })}
                  >
                    {t('stylePanel.subtitle')}
                  </p>
                </div>

                <form.Subscribe
                  selector={(state) => state}
                  children={(_state) => <StyleControls form={form} />}
                />
              </div>
            </div>

            {/* Live Preview Panel */}
            <div
              className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '6',
              })}
            >
              <div className={stack({ gap: '6' })}>
                <form.Subscribe
                  selector={(state) => state}
                  children={(state) => <FlashcardPreview config={state.values} />}
                />

                {/* Generate Button within Preview */}
                <div
                  className={css({
                    borderTop: '1px solid',
                    borderColor: 'gray.200',
                    pt: '6',
                  })}
                >
                  {/* Generation Status */}
                  {generationStatus === 'generating' && (
                    <div className={css({ mb: '4' })}>
                      <GenerationProgress config={form.state.values} />
                    </div>
                  )}

                  <button
                    onClick={() => handleGenerate(form.state.values)}
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
                          <div className={css({ fontSize: 'xl' })}>✨</div>
                          {t('generate.button')}
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display - moved to global level */}
          {generationStatus === 'error' && error && (
            <div
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
                <p
                  className={css({
                    color: 'red.700',
                    lineHeight: 'relaxed',
                  })}
                >
                  {error}
                </p>
                <button
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
