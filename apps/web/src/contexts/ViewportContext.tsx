'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

/**
 * Viewport dimensions
 */
export interface ViewportDimensions {
  width: number
  height: number
}

/**
 * Viewport context value
 */
interface ViewportContextValue {
  width: number
  height: number
}

const ViewportContext = createContext<ViewportContextValue | null>(null)

/**
 * Hook to get viewport dimensions
 * Returns mock dimensions in preview mode, actual window dimensions otherwise
 */
export function useViewport(): ViewportDimensions {
  const context = useContext(ViewportContext)

  // If context is provided (preview mode or custom viewport), use it
  if (context) {
    return context
  }

  // Otherwise, use actual window dimensions (hook will update on resize)
  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  })

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Set initial value

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return dimensions
}

/**
 * Provider that supplies custom viewport dimensions
 * Used in preview mode to provide mock 1440×900 viewport
 */
export function ViewportProvider({
  children,
  width,
  height,
}: {
  children: ReactNode
  width: number
  height: number
}) {
  return <ViewportContext.Provider value={{ width, height }}>{children}</ViewportContext.Provider>
}
