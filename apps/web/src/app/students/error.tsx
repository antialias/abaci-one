'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function StudentsError({
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
      label="Students Error Boundary"
      backLabel="Home"
      backHref="/"
    />
  )
}
