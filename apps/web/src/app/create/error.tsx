'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function CreateError({
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
      label="Create Error Boundary"
      backLabel="Create"
      backHref="/create"
    />
  )
}
