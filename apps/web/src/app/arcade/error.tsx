'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { RouteErrorFallback } from '@/components/RouteErrorFallback'

export default function ArcadeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageWithNav navTitle="Error">
      <RouteErrorFallback
        error={error}
        reset={reset}
        label="Arcade Error Boundary"
        backLabel="Return to Lobby"
        backHref="/arcade-rooms"
      />
    </PageWithNav>
  )
}
