'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function PracticeError({
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
      label="Practice Error Boundary"
      backLabel="Pick Student"
      backHref="/practice"
    />
  )
}
