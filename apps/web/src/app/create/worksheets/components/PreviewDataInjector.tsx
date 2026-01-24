'use client'

import { useEffect } from 'react'
import { useStreamedPreview } from './StreamedPreviewContext'

interface PreviewDataInjectorProps {
  pages?: string[]
  totalPages?: number
}

/**
 * Client component that receives streamed preview data from the server
 * and injects it into the StreamedPreviewContext for use by PreviewCenter.
 *
 * This component renders nothing visible - it just bridges the server-streamed
 * data into the client-side context system.
 */
export function PreviewDataInjector({ pages, totalPages }: PreviewDataInjectorProps) {
  const { setStreamedPreview } = useStreamedPreview()

  useEffect(() => {
    console.log('[PreviewDataInjector] Received streamed preview:', {
      pageCount: pages?.length ?? 0,
      totalPages,
    })
    setStreamedPreview(pages, totalPages)
  }, [pages, totalPages, setStreamedPreview])

  // This component doesn't render anything visible
  return null
}
