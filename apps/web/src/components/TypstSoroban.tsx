'use client'

import { useState, useEffect, useCallback } from 'react'
import { generateSorobanSVG, type SorobanConfig } from '@/lib/typst-soroban'
import { css } from '../../styled-system/css'
import { useAbacusConfig } from '@/contexts/AbacusDisplayContext'

interface TypstSorobanProps {
  number: number
  width?: string
  height?: string
  className?: string
  onError?: (error: string) => void
  onSuccess?: () => void
  enableServerFallback?: boolean
}

export function TypstSoroban({
  number,
  width = '120pt',
  height = '160pt',
  className,
  onError,
  onSuccess,
  enableServerFallback = false
}: TypstSorobanProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const globalConfig = useAbacusConfig()

  useEffect(() => {
    async function generateSVG() {
      setIsLoading(true)
      setError(null)
      setSvg(null)

      try {
        const config: SorobanConfig = {
          number,
          width,
          height,
          beadShape: globalConfig.beadShape,
          colorScheme: globalConfig.colorScheme,
          hideInactiveBeads: globalConfig.hideInactiveBeads,
          coloredNumerals: globalConfig.coloredNumerals,
          scaleFactor: globalConfig.scaleFactor,
          transparent: false,
          enableServerFallback
        }

        const generatedSvg = await generateSorobanSVG(config)
        setSvg(generatedSvg)
        // Call success callback after state is set
        setTimeout(() => onSuccess?.(), 0)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        console.error('TypstSoroban generation error:', err)
        // Call error callback after state is set
        setTimeout(() => onError?.(errorMessage), 0)
      } finally {
        setIsLoading(false)
      }
    }

    generateSVG()
  }, [number, width, height, globalConfig.beadShape, globalConfig.colorScheme, globalConfig.hideInactiveBeads, globalConfig.coloredNumerals, globalConfig.scaleFactor, enableServerFallback])

  if (isLoading) {
    return (
      <div className={className}>
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          rounded: 'md',
          minH: '200px'
        })}>
          <div className={css({
            w: '8',
            h: '8',
            border: '2px solid',
            borderColor: 'gray.300',
            borderTopColor: 'brand.600',
            rounded: 'full',
            animation: 'spin 1s linear infinite'
          })} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'red.50',
          border: '1px solid',
          borderColor: 'red.200',
          rounded: 'md',
          p: '4',
          minH: '200px'
        })}>
          <div className={css({ fontSize: '2xl', mb: '2' })}>⚠️</div>
          <p className={css({ color: 'red.700', fontSize: 'sm', textAlign: 'center' })}>
            Failed to generate soroban
          </p>
          <p className={css({ color: 'red.600', fontSize: 'xs', mt: '1' })}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className={className}>
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          rounded: 'md',
          minH: '200px'
        })}>
          <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
            No SVG generated
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '& svg': {
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto'
          }
        })}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

// Optional: Create a hook for easier usage
export function useTypstSoroban(config: SorobanConfig) {
  const [svg, setSvg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setIsLoading(true)
    setError(null)
    setSvg(null)

    try {
      const generatedSvg = await generateSorobanSVG(config)
      setSvg(generatedSvg)
      return generatedSvg
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    svg,
    isLoading,
    error,
    generate
  }
}