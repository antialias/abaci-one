'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function ToysError({
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
      label="Toys Error Boundary"
      backLabel="Toys"
      backHref="/toys"
    />
  )
}
