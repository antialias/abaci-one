'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function VisionTrainingError({
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
      label="Vision Training Error Boundary"
      backLabel="Vision Training"
      backHref="/vision-training"
    />
  )
}
