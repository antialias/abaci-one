'use client'

import { useState, useEffect, useMemo } from 'react'
import { css } from '../../styled-system/css'
import { stack, hstack, grid } from '../../styled-system/patterns'
import { FlashcardConfig } from '@/app/create/page'
import { Eye, RefreshCw } from 'lucide-react'

interface LivePreviewProps {
  config: FlashcardConfig
}

interface PreviewData {
  samples: Array<{
    number: number
    front: string // SVG content
    back: string // Numeral
  }>
  count: number
}

export function LivePreview({ config }: LivePreviewProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced preview generation
  const debouncedConfig = useDebounce(config, 1000)

  useEffect(() => {
    const generatePreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Create a simplified config for quick preview
        const previewConfig = {
          ...debouncedConfig,
          range: getPreviewRange(debouncedConfig.range),
          format: 'svg' // Always use SVG for preview
        }

        const response = await fetch('/api/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(previewConfig),
        })

        if (response.ok) {
          const data = await response.json()
          setPreviewData(data)
        } else {
          throw new Error('Preview generation failed')
        }
      } catch (err) {
        console.error('Preview error:', err)
        setError('Unable to generate preview')
        // Set mock data for development
        setPreviewData(getMockPreviewData(debouncedConfig))
      } finally {
        setIsLoading(false)
      }
    }

    generatePreview()
  }, [debouncedConfig])

  return (
    <div className={stack({ gap: '6' })}>
      <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
        <div className={stack({ gap: '1' })}>
          <h3 className={css({
            fontSize: 'xl',
            fontWeight: 'bold',
            color: 'gray.900'
          })}>
            Live Preview
          </h3>
          <p className={css({
            fontSize: 'sm',
            color: 'gray.600'
          })}>
            See how your flashcards will look
          </p>
        </div>

        <div className={hstack({ gap: '2', alignItems: 'center' })}>
          {isLoading && (
            <RefreshCw
              size={16}
              className={css({ animation: 'spin 1s linear infinite', color: 'brand.600' })}
            />
          )}
          <div className={css({
            px: '3',
            py: '1',
            bg: 'brand.100',
            color: 'brand.800',
            fontSize: 'xs',
            fontWeight: 'medium',
            rounded: 'full'
          })}>
            {previewData?.count || 0} cards • {config.format?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Preview Cards */}
      {isLoading ? (
        <PreviewSkeleton />
      ) : error ? (
        <PreviewError error={error} />
      ) : previewData ? (
        <div className={grid({
          columns: { base: 1, md: 2, lg: 3 },
          gap: '4'
        })}>
          {previewData.samples.map((card, i) => (
            <FlashcardPreview
              key={i}
              number={card.number}
              frontSvg={card.front}
              backContent={card.back}
            />
          ))}
        </div>
      ) : null}

      {/* Configuration Summary */}
      <div className={css({
        p: '4',
        bg: 'gray.50',
        rounded: 'xl',
        border: '1px solid',
        borderColor: 'gray.200'
      })}>
        <h4 className={css({
          fontSize: 'sm',
          fontWeight: 'semibold',
          color: 'gray.900',
          mb: '3'
        })}>
          Configuration Summary
        </h4>
        <div className={grid({ columns: 2, gap: '3' })}>
          <ConfigSummaryItem label="Range" value={config.range} />
          <ConfigSummaryItem label="Cards per page" value={config.cardsPerPage?.toString() || '6'} />
          <ConfigSummaryItem label="Color scheme" value={config.colorScheme || 'place-value'} />
          <ConfigSummaryItem label="Bead shape" value={config.beadShape || 'diamond'} />
        </div>
      </div>
    </div>
  )
}

function FlashcardPreview({
  number,
  frontSvg,
  backContent
}: {
  number: number
  frontSvg: string
  backContent: string
}) {
  const [showBack, setShowBack] = useState(false)

  return (
    <div
      className={css({
        position: 'relative',
        aspectRatio: '3/4',
        bg: 'white',
        border: '2px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all',
        _hover: {
          borderColor: 'brand.300',
          transform: 'translateY(-2px)',
          shadow: 'card'
        }
      })}
      onClick={() => setShowBack(!showBack)}
    >
      {/* Flip indicator */}
      <div className={css({
        position: 'absolute',
        top: '2',
        right: '2',
        p: '1',
        bg: 'white',
        rounded: 'full',
        shadow: 'card',
        zIndex: 10
      })}>
        <Eye size={12} className={css({ color: 'gray.600' })} />
      </div>

      {showBack ? (
        // Back side - Numeral
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50'
        })}>
          <div className={css({
            fontSize: '4xl',
            fontWeight: 'bold',
            color: 'gray.900',
            fontFamily: 'mono'
          })}>
            {number}
          </div>
        </div>
      ) : (
        // Front side - Soroban
        <div className={css({
          w: 'full',
          h: 'full',
          p: '4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        })}>
          {frontSvg ? (
            <div
              dangerouslySetInnerHTML={{ __html: frontSvg }}
              className={css({ maxW: 'full', maxH: 'full' })}
            />
          ) : (
            <SorobanPlaceholder number={number} />
          )}
        </div>
      )}
    </div>
  )
}

function SorobanPlaceholder({ number }: { number: number }) {
  return (
    <div className={css({
      w: 'full',
      h: 'full',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2',
      color: 'gray.400'
    })}>
      <div className={css({ fontSize: '3xl' })}>🧮</div>
      <div className={css({ fontSize: 'sm', fontWeight: 'medium' })}>
        Soroban for {number}
      </div>
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <div className={grid({
      columns: { base: 1, md: 2, lg: 3 },
      gap: '4'
    })}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={css({
            aspectRatio: '3/4',
            bg: 'gray.100',
            rounded: 'xl',
            animation: 'pulse'
          })}
        />
      ))}
    </div>
  )
}

function PreviewError({ error }: { error: string }) {
  return (
    <div className={css({
      p: '6',
      bg: 'amber.50',
      border: '1px solid',
      borderColor: 'amber.200',
      rounded: 'xl',
      textAlign: 'center'
    })}>
      <div className={css({ fontSize: '2xl', mb: '2' })}>⚠️</div>
      <p className={css({ color: 'amber.800', fontWeight: 'medium' })}>
        {error}
      </p>
      <p className={css({ fontSize: 'sm', color: 'amber.700', mt: '1' })}>
        Preview will be available when you generate the flashcards
      </p>
    </div>
  )
}

function ConfigSummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={css({ fontSize: 'xs' })}>
      <span className={css({ color: 'gray.600' })}>{label}:</span>{' '}
      <span className={css({ fontWeight: 'medium', color: 'gray.900' })}>{value}</span>
    </div>
  )
}

// Utility functions
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function getPreviewRange(range: string): string {
  // For preview, limit to a few sample numbers
  if (range.includes('-')) {
    const [start] = range.split('-')
    const startNum = parseInt(start) || 0
    return `${startNum}-${startNum + 2}`
  }

  if (range.includes(',')) {
    const numbers = range.split(',').slice(0, 3)
    return numbers.join(',')
  }

  return range
}

function getMockPreviewData(config: FlashcardConfig): PreviewData {
  // Mock data for development/fallback
  return {
    count: 3,
    samples: [
      { number: 7, front: '', back: '7' },
      { number: 23, front: '', back: '23' },
      { number: 156, front: '', back: '156' }
    ]
  }
}