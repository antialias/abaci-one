'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function DebugError({
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
      label="Debug Error Boundary"
      backLabel="Debug Hub"
      backHref="/debug"
    />
  )
}
