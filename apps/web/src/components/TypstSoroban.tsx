'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { generateSorobanSVG, getWasmStatus, triggerWasmPreload, type SorobanConfig } from '@/lib/typst-soroban'
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
  lazy?: boolean // New prop for lazy loading
}

export function TypstSoroban({
  number,
  width = '120pt',
  height = '160pt',
  className,
  onError,
  onSuccess,
  enableServerFallback = false,
  lazy = false
}: TypstSorobanProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!lazy) // Don't start loading if lazy
  const [error, setError] = useState<string | null>(null)
  const [shouldLoad, setShouldLoad] = useState(!lazy) // Control when loading starts
  const globalConfig = useAbacusConfig()

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!shouldLoad) return

    async function generateSVG() {
      // Cancel any previous generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      setIsLoading(true)
      setError(null)

      // Longer delay to prevent flashing for fast renders
      await new Promise(resolve => setTimeout(resolve, 300))

      if (signal.aborted) return

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

        if (signal.aborted) return

        setSvg(generatedSvg)
        // Call success callback after state is set
        setTimeout(() => onSuccess?.(), 0)
      } catch (err) {
        if (signal.aborted) return

        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        console.error('TypstSoroban generation error:', err)
        // Call error callback after state is set
        setTimeout(() => onError?.(errorMessage), 0)
      } finally {
        if (!signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    generateSVG()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [shouldLoad, number, width, height, globalConfig.beadShape, globalConfig.colorScheme, globalConfig.hideInactiveBeads, globalConfig.coloredNumerals, globalConfig.scaleFactor, enableServerFallback])

  // Handler to trigger loading on user interaction
  const handleLoadTrigger = useCallback(() => {
    if (!shouldLoad && !isLoading && !svg) {
      setShouldLoad(true)
      // Also trigger WASM preload if not already started
      triggerWasmPreload()
    }
  }, [shouldLoad, isLoading, svg])

  // Show lazy loading placeholder
  if (lazy && !shouldLoad && !svg) {
    const wasmStatus = getWasmStatus()

    return (
      <div
        className={className}
        onClick={handleLoadTrigger}
        onMouseEnter={handleLoadTrigger}
      >
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: wasmStatus.isLoaded ? 'green.25' : 'gray.50',
          rounded: 'md',
          minH: '200px',
          cursor: 'pointer',
          transition: 'all',
          _hover: {
            bg: wasmStatus.isLoaded ? 'green.50' : 'gray.100',
            transform: 'scale(1.02)'
          }
        })}>
          <div className={css({
            fontSize: '4xl',
            opacity: '0.6',
            transition: 'all',
            _hover: { opacity: '0.8' }
          })}>
            {wasmStatus.isLoaded ? '🚀' : '🧮'}
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className={css({
          w: 'full',
          h: 'full',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'blue.25',
          rounded: 'md',
          minH: '200px'
        })}>
          <div className={css({
            w: '6',
            h: '6',
            border: '2px solid',
            borderColor: 'blue.200',
            borderTopColor: 'blue.500',
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
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'red.25',
          rounded: 'md',
          minH: '200px'
        })}>
          <div className={css({ fontSize: '3xl', opacity: '0.6' })}>⚠️</div>
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