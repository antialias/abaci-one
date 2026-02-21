'use client'

import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function FlowchartError({
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
      label="Flowchart Error Boundary"
      backLabel="Flowcharts"
      backHref="/flowchart"
    />
  )
}
