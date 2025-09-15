'use client'

import { Suspense, Component, ErrorInfo, ReactNode } from 'react'
import { useTypstRenderer, generateSorobanSVG, type SorobanConfig } from '@/lib/typst-soroban'
import { css } from '../../styled-system/css'
import { useAbacusConfig } from '@/contexts/AbacusDisplayContext'
import { useState, useEffect } from 'react'

interface TypstSorobanProps {
  number: number
  width?: string
  height?: string
  className?: string
  onError?: (error: string) => void
  onSuccess?: () => void
  enableServerFallback?: boolean
}

// Inner component that uses the WASM renderer (throws for Suspense)
function TypstSorobanInner({
  number,
  width = '120pt',
  height = '160pt',
  className,
  onError,
  onSuccess,
  enableServerFallback = false
}: TypstSorobanProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const globalConfig = useAbacusConfig()

  // This will throw if WASM isn't loaded yet (triggering Suspense)
  const typstRenderer = useTypstRenderer()

  useEffect(() => {
    async function generateSVG() {
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
        onSuccess?.()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        console.error('TypstSoroban generation error:', err)
        onError?.(errorMessage)
      }
    }

    generateSVG()
  }, [number, width, height, globalConfig.beadShape, globalConfig.colorScheme, globalConfig.hideInactiveBeads, globalConfig.coloredNumerals, globalConfig.scaleFactor, enableServerFallback, typstRenderer])

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
            Generating...
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

// Loading fallback component
function TypstSorobanLoading({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className={css({
        w: 'full',
        h: 'full',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bg: 'blue.50',
        rounded: 'md',
        minH: '200px',
        border: '1px solid',
        borderColor: 'blue.200'
      })}>
        <div className={css({
          w: '8',
          h: '8',
          border: '2px solid',
          borderColor: 'blue.300',
          borderTopColor: 'blue.600',
          rounded: 'full',
          animation: 'spin 1s linear infinite',
          mb: '3'
        })} />
        <p className={css({ color: 'blue.700', fontSize: 'sm', textAlign: 'center' })}>
          Loading WASM renderer...
        </p>
        <p className={css({ color: 'blue.600', fontSize: 'xs', mt: '1' })}>
          This may take a moment on first load
        </p>
      </div>
    </div>
  )
}

// Error boundary class
class TypstErrorBoundary extends Component<
  { children: ReactNode; fallback: (error: Error, resetError: () => void) => ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TypstSoroban Error Boundary caught an error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.resetError)
    }

    return this.props.children
  }
}

// Error fallback component
function TypstSorobanError({ error, resetError, className }: {
  error: Error
  resetError: () => void
  className?: string
}) {
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
        <div className={css({ fontSize: '2xl', mb: '3' })}>⚠️</div>
        <p className={css({ color: 'red.700', fontSize: 'sm', textAlign: 'center', mb: '3' })}>
          Failed to load WASM renderer
        </p>
        <p className={css({ color: 'red.600', fontSize: 'xs', mb: '3' })}>
          {error.message}
        </p>
        <button
          onClick={resetError}
          className={css({
            px: '3',
            py: '2',
            bg: 'red.600',
            color: 'white',
            fontSize: 'xs',
            rounded: 'md',
            border: 'none',
            cursor: 'pointer',
            _hover: { bg: 'red.700' }
          })}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

// Main Suspense wrapper component
export function TypstSoroban(props: TypstSorobanProps) {
  return (
    <TypstErrorBoundary
      fallback={(error, resetError) => (
        <TypstSorobanError
          error={error}
          resetError={resetError}
          className={props.className}
        />
      )}
    >
      <Suspense fallback={<TypstSorobanLoading className={props.className} />}>
        <TypstSorobanInner {...props} />
      </Suspense>
    </TypstErrorBoundary>
  )
}