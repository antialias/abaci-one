'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks elapsed time since `startedAt` (unix ms), re-rendering on each tick.
 * Returns `null` when `startedAt` is null.
 */
export function useElapsedMs(startedAt: number | null, tickMs = 1000): number | null {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (startedAt == null) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [startedAt, tickMs])

  return startedAt == null ? null : now - startedAt
}
