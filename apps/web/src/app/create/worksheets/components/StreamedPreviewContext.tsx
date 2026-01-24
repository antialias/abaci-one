'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface StreamedPreviewContextValue {
  /**
   * The streamed preview pages (SVG strings)
   * undefined = not yet received, [] = received but empty/failed
   */
  streamedPages: string[] | undefined

  /**
   * Total number of pages in the worksheet (may be more than streamed pages)
   */
  totalPages: number | undefined

  /**
   * Whether the streamed preview has been received
   */
  isLoaded: boolean

  /**
   * Called by PreviewDataInjector when streamed data arrives
   */
  setStreamedPreview: (pages: string[] | undefined, totalPages: number | undefined) => void
}

const StreamedPreviewContext = createContext<StreamedPreviewContextValue | null>(null)

interface StreamedPreviewProviderProps {
  children: ReactNode
}

/**
 * Provides streamed preview data to child components.
 * The preview is generated server-side and streamed via Suspense,
 * then injected into this context by PreviewDataInjector.
 */
export function StreamedPreviewProvider({ children }: StreamedPreviewProviderProps) {
  const [streamedPages, setStreamedPages] = useState<string[] | undefined>(undefined)
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined)
  const [isLoaded, setIsLoaded] = useState(false)

  const setStreamedPreview = useCallback(
    (pages: string[] | undefined, total: number | undefined) => {
      setStreamedPages(pages)
      setTotalPages(total)
      setIsLoaded(true)
    },
    []
  )

  return (
    <StreamedPreviewContext.Provider
      value={{
        streamedPages,
        totalPages,
        isLoaded,
        setStreamedPreview,
      }}
    >
      {children}
    </StreamedPreviewContext.Provider>
  )
}

/**
 * Hook to access streamed preview data.
 * Must be used within a StreamedPreviewProvider.
 */
export function useStreamedPreview(): StreamedPreviewContextValue {
  const context = useContext(StreamedPreviewContext)
  if (!context) {
    throw new Error('useStreamedPreview must be used within StreamedPreviewProvider')
  }
  return context
}
