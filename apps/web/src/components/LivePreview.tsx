'use client'

import { useState, useMemo } from 'react'
import { css } from '../../styled-system/css'
import { stack, hstack, grid } from '../../styled-system/patterns'
import { FlashcardConfig, FlashcardFormState } from '@/app/create/page'
import { Eye } from 'lucide-react'
import { TypstSoroban } from './TypstSoroban'
import { AbacusReact } from '@soroban/abacus-react'

interface LivePreviewProps {
  config: FlashcardFormState
}

export function LivePreview({ config }: LivePreviewProps) {
  // Generate preview numbers directly from config
  const previewNumbers = useMemo(() => {
    return getPreviewNumbers(config.range || '1-10')
  }, [config.range])

  const previewCount = previewNumbers.length

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
        <div className={hstack({ gap: '3', alignItems: 'center' })}>
          <div className={css({
            px: '3',
            py: '1',
            bg: 'brand.100',
            color: 'brand.800',
            fontSize: 'xs',
            fontWeight: 'medium',
            rounded: 'full'
          })}>
            {previewCount} cards • {config.format?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Preview Cards */}
      <div className={grid({
        columns: { base: 1, md: 2, lg: 3 },
        gap: '4'
      })}>
        {previewNumbers.map((number) => (
          <FlashcardPreview
            key={number}
            number={number}
            config={config}
          />
        ))}
      </div>

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
          mb: '2'
        })}>
          Configuration Summary
        </h4>
        <div className={grid({ columns: { base: 1, md: 2 }, gap: '3' })}>
          <ConfigItem label="Range" value={config.range || 'Not set'} />
          <ConfigItem label="Format" value={config.format?.toUpperCase() || 'PDF'} />
          <ConfigItem label="Cards per page" value={config.cardsPerPage?.toString() || '6'} />
          <ConfigItem label="Paper size" value={config.paperSize?.toUpperCase() || 'US-LETTER'} />
        </div>
      </div>
    </div>
  )
}

function FlashcardPreview({
  number,
  config
}: {
  number: number
  config: FlashcardFormState
}) {
  const [showBack, setShowBack] = useState(false)

  return (
    <div
      className={css({
        aspectRatio: '3/4',
        bg: 'white',
        rounded: 'xl',
        border: '2px solid',
        borderColor: 'gray.200',
        position: 'relative',
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
        // Front side - Soroban using React component
        <div className={css({
          w: 'full',
          h: 'full',
          p: '2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        })}>
          <AbacusReact
            value={number}
            columns={'auto'}
            beadShape={(config.beadShape as any) || 'diamond'}
            colorScheme={(config.colorScheme as any) || 'place-value'}
            scaleFactor={(config.scaleFactor || 1) * 1.2}
            interactive={false}
            showNumbers="never"
            animated={true}
            hideInactiveBeads={config.hideInactiveBeads}
          />
        </div>
      )}
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={css({
      fontSize: 'xs',
      color: 'gray.600'
    })}>
      <span className={css({ fontWeight: 'medium' })}>{label}:</span>{' '}
      <span>{value}</span>
    </div>
  )
}

// Helper function to extract numbers from range for preview
function getPreviewNumbers(range?: string): number[] {
  if (!range) return [1, 2, 3]

  // Handle comma-separated values
  if (range.includes(',')) {
    return range
      .split(',')
      .slice(0, 3)
      .map(n => parseInt(n.trim()))
      .filter(n => !isNaN(n))
  }

  // Handle range format like "1-10"
  if (range.includes('-')) {
    const [start] = range.split('-').map(n => parseInt(n.trim()))
    if (!isNaN(start)) {
      return [start, start + 1, start + 2]
    }
  }

  // Handle single number
  const singleNum = parseInt(range)
  if (!isNaN(singleNum)) {
    return [singleNum, singleNum + 1, singleNum + 2]
  }

  // Fallback
  return [1, 2, 3]
}