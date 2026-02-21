'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function WorksheetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      label="Worksheets Error Boundary"
      backLabel="Home"
      backHref="/"
    />
  )
}
