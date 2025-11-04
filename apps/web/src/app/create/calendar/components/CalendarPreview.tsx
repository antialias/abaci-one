'use client'

import { useQuery } from '@tanstack/react-query'
import { css } from '../../../../../styled-system/css'

interface CalendarPreviewProps {
  month: number
  year: number
  format: 'monthly' | 'daily'
  previewSvg: string | null
}

async function fetchTypstPreview(month: number, year: number, format: string): Promise<string | null> {
  const response = await fetch('/api/create/calendar/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, year, format }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch preview')
  }

  const data = await response.json()
  return data.svg
}

export function CalendarPreview({ month, year, format, previewSvg }: CalendarPreviewProps) {
  // Use React Query to fetch Typst-generated preview (client-side only)
  const { data: typstPreviewSvg, isLoading } = useQuery({
    queryKey: ['calendar-typst-preview', month, year, format],
    queryFn: () => fetchTypstPreview(month, year, format),
    enabled: typeof window !== 'undefined' && format === 'monthly', // Only run on client and for monthly format
  })

  // Use generated PDF SVG if available, otherwise use Typst live preview
  const displaySvg = previewSvg || typstPreviewSvg

  // Show loading state while fetching preview
  if (isLoading || (!displaySvg && format === 'monthly')) {
    return (
      <div
        data-component="calendar-preview"
        className={css({
          bg: 'gray.800',
          borderRadius: '12px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '600px',
        })}
      >
        <p
          className={css({
            fontSize: '1.25rem',
            color: 'gray.400',
            textAlign: 'center',
          })}
        >
          Loading preview...
        </p>
      </div>
    )
  }

  if (!displaySvg) {
    return (
      <div
        data-component="calendar-preview"
        className={css({
          bg: 'gray.800',
          borderRadius: '12px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '600px',
        })}
      >
        <p
          className={css({
            fontSize: '1.25rem',
            color: 'gray.400',
            textAlign: 'center',
          })}
        >
          {format === 'daily' ? 'Daily format - preview after generation' : 'No preview available'}
        </p>
      </div>
    )
  }

  return (
    <div
      data-component="calendar-preview"
      className={css({
        bg: 'gray.800',
        borderRadius: '12px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      })}
    >
      <p
        className={css({
          fontSize: '1.125rem',
          color: 'yellow.400',
          marginBottom: '1rem',
          textAlign: 'center',
          fontWeight: 'bold',
        })}
      >
        {previewSvg ? 'Generated PDF' : 'Live Preview'}
      </p>
      <div
        className={css({
          bg: 'white',
          borderRadius: '8px',
          padding: '1rem',
          maxWidth: '100%',
          overflow: 'auto',
        })}
        dangerouslySetInnerHTML={{ __html: displaySvg }}
      />
    </div>
  )
}
