'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  const currentConfigRef = useRef<any>(null)

  // Memoize the config to prevent unnecessary re-renders
  const stableConfig = useMemo(() => ({
    beadShape: globalConfig.beadShape,
    colorScheme: globalConfig.colorScheme,
    hideInactiveBeads: globalConfig.hideInactiveBeads,
    coloredNumerals: globalConfig.coloredNumerals,
    scaleFactor: globalConfig.scaleFactor
  }), [
    globalConfig.beadShape,
    globalConfig.colorScheme,
    globalConfig.hideInactiveBeads,
    globalConfig.coloredNumerals,
    globalConfig.scaleFactor
  ])

  useEffect(() => {
    if (!shouldLoad) return

    console.log(`🔄 TypstSoroban useEffect triggered for number ${number}, hasExistingSVG: ${!!svg}`)

    async function generateSVG() {
      // Create current config signature
      const currentConfig = {
        number,
        width,
        height,
        beadShape: stableConfig.beadShape,
        colorScheme: stableConfig.colorScheme,
        hideInactiveBeads: stableConfig.hideInactiveBeads,
        coloredNumerals: stableConfig.coloredNumerals,
        scaleFactor: stableConfig.scaleFactor,
        enableServerFallback
      }

      // Check if config changed since last render
      const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(currentConfigRef.current)

      // Don't regenerate if we already have an SVG for this exact config
      if (svg && !error && !configChanged) {
        console.log(`✅ Skipping regeneration for ${number} - already have SVG with same config`)
        return
      }

      if (configChanged) {
        console.log(`🔄 Config changed for ${number}, regenerating SVG`)
        // Clear existing SVG to show fresh loading state for config changes
        setSvg(null)
      }

      // Update config ref
      currentConfigRef.current = currentConfig

      // Cancel any previous generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      // Check cache quickly before showing loading state
      const cacheKey = JSON.stringify({
        number,
        width,
        height,
        beadShape: stableConfig.beadShape,
        colorScheme: stableConfig.colorScheme,
        hideInactiveBeads: stableConfig.hideInactiveBeads,
        coloredNumerals: stableConfig.coloredNumerals,
        scaleFactor: stableConfig.scaleFactor,
        enableServerFallback
      })

      setError(null)

      try {
        // Try generation immediately to see if it's cached
        const config: SorobanConfig = {
          number,
          width,
          height,
          beadShape: stableConfig.beadShape,
          colorScheme: stableConfig.colorScheme,
          hideInactiveBeads: stableConfig.hideInactiveBeads,
          coloredNumerals: stableConfig.coloredNumerals,
          scaleFactor: stableConfig.scaleFactor,
          transparent: false,
          enableServerFallback
        }

        // Set loading only after a delay if generation is slow
        const loadingTimeout = setTimeout(() => {
          if (!signal.aborted) {
            setIsLoading(true)
          }
        }, 100)

        const generatedSvg = await generateSorobanSVG(config)

        // Clear timeout since we got result quickly
        clearTimeout(loadingTimeout)

        if (signal.aborted) return

        setSvg(generatedSvg)
        setTimeout(() => onSuccess?.(), 0)
      } catch (err) {
        if (signal.aborted) return

        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        console.error('TypstSoroban generation error:', err)
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
  }, [shouldLoad, number, width, height, stableConfig, enableServerFallback])

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