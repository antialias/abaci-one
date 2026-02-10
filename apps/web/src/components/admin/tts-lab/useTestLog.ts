'use client'

import { useCallback, useRef, useState } from 'react'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  timestamp: number
  level: LogLevel
  message: string
  detail?: string
}

export interface UseTestLogReturn {
  entries: LogEntry[]
  log: (level: LogLevel, message: string, detail?: string) => void
  clear: () => void
}

export function useTestLog(maxEntries = 200): UseTestLogReturn {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const startRef = useRef(Date.now())

  const log = useCallback(
    (level: LogLevel, message: string, detail?: string) => {
      setEntries((prev) => {
        const next = [
          ...prev,
          { timestamp: Date.now() - startRef.current, level, message, detail },
        ]
        return next.length > maxEntries ? next.slice(-maxEntries) : next
      })
    },
    [maxEntries]
  )

  const clear = useCallback(() => {
    setEntries([])
    startRef.current = Date.now()
  }, [])

  return { entries, log, clear }
}
