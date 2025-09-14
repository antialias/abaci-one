'use client'

import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { css } from '../../../styled-system/css'
import { container, stack, hstack, grid } from '../../../styled-system/patterns'
import Link from 'next/link'
import { ConfigurationForm } from '@/components/ConfigurationForm'
import { LivePreview } from '@/components/LivePreview'
import { GenerationProgress } from '@/components/GenerationProgress'
import { DownloadCard } from '@/components/DownloadCard'

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

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error'

interface GenerationResult {
  id: string
  downloadUrl: string
  metadata: {
    cardCount: number
    numbers: number[]
    format: string
    filename: string
    fileSize: number
  }
}

export default function CreatePage() {
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FlashcardConfig>({
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
      hideInactiveBeads: false,
      beadShape: 'diamond',
      colorScheme: 'place-value',
      coloredNumerals: false,
      scaleFactor: 0.9,
      format: 'pdf'
    }
  })

  const handleGenerate = async (config: FlashcardConfig) => {
    setGenerationStatus('generating')
    setError(null)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Generation failed')
      }

      setGenerationResult(result)
      setGenerationStatus('success')
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setGenerationStatus('error')
    }
  }

  const handleNewGeneration = () => {
    setGenerationStatus('idle')
    setGenerationResult(null)
    setError(null)
  }

  return (
    <div className={css({ minHeight: '100vh', bg: 'gray.50' })}>
      {/* Header */}
      <header className={css({ bg: 'white', shadow: 'card', position: 'sticky', top: 0, zIndex: 10 })}>
        <div className={container({ maxW: '7xl', px: '4', py: '4' })}>
          <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
            <Link
              href="/"
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                color: 'brand.800',
                textDecoration: 'none'
              })}
            >
              🧮 Soroban Generator
            </Link>

            <div className={hstack({ gap: '3' })}>
              <Link
                href="/gallery"
                className={css({
                  px: '4',
                  py: '2',
                  color: 'brand.600',
                  fontWeight: 'medium',
                  rounded: 'lg',
                  transition: 'all',
                  _hover: { bg: 'brand.50' }
                })}
              >
                Gallery
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={container({ maxW: '7xl', px: '4', py: '8' })}>
        <div className={stack({ gap: '6', mb: '8' })}>
          <div className={stack({ gap: '2', textAlign: 'center' })}>
            <h1 className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'gray.900'
            })}>
              Create Your Flashcards
            </h1>
            <p className={css({
              fontSize: 'lg',
              color: 'gray.600'
            })}>
              Configure your perfect soroban flashcards and download instantly
            </p>
          </div>
        </div>

        {/* Configuration Interface */}
        <div className={grid({
          columns: { base: 1, lg: 2 },
          gap: '8',
          alignItems: 'start'
        })}>
          {/* Configuration Panel */}
          <div className={css({
            bg: 'white',
            rounded: '2xl',
            shadow: 'card',
            p: '8'
          })}>
            <ConfigurationForm
              form={form}
              onGenerate={handleGenerate}
              isGenerating={generationStatus === 'generating'}
            />
          </div>

          {/* Preview & Generation Panel */}
          <div className={stack({ gap: '6' })}>
            {/* Live Preview */}
            <div className={css({
              bg: 'white',
              rounded: '2xl',
              shadow: 'card',
              p: '8'
            })}>
              <LivePreview config={form.state.values} />
            </div>

            {/* Generation Status */}
            {generationStatus === 'generating' && (
              <div className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '8'
              })}>
                <GenerationProgress config={form.state.values} />
              </div>
            )}

            {/* Success Result */}
            {generationStatus === 'success' && generationResult && (
              <div className={css({
                bg: 'white',
                rounded: '2xl',
                shadow: 'card',
                p: '8'
              })}>
                <DownloadCard
                  result={generationResult}
                  onNewGeneration={handleNewGeneration}
                />
              </div>
            )}

            {/* Error Display */}
            {generationStatus === 'error' && error && (
              <div className={css({
                bg: 'red.50',
                border: '1px solid',
                borderColor: 'red.200',
                rounded: '2xl',
                p: '8'
              })}>
                <div className={stack({ gap: '4' })}>
                  <div className={hstack({ gap: '3', alignItems: 'center' })}>
                    <div className={css({ fontSize: '2xl' })}>❌</div>
                    <h3 className={css({
                      fontSize: 'xl',
                      fontWeight: 'semibold',
                      color: 'red.800'
                    })}>
                      Generation Failed
                    </h3>
                  </div>
                  <p className={css({
                    color: 'red.700',
                    lineHeight: 'relaxed'
                  })}>
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
                      _hover: { bg: 'red.700' }
                    })}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}