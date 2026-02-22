'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'

interface TimerBarProps {
  /** Total time in seconds */
  totalSeconds: number
  /** Game start timestamp */
  startTime: number
  /** Called when timer reaches zero */
  onTimeUp: () => void
  /** Called when 10 seconds remain */
  onWarning?: () => void
}

/**
 * Full-width countdown bar for beat-the-clock mode.
 * Green -> yellow -> orange -> red, pulses in the last 10s.
 */
export function TimerBar({ totalSeconds, startTime, onTimeUp, onWarning }: TimerBarProps) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const warningFiredRef = useRef(false)
  const timeUpFiredRef = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const left = Math.max(0, totalSeconds - elapsed)
      setRemaining(left)

      if (left <= 10 && !warningFiredRef.current && onWarning) {
        warningFiredRef.current = true
        onWarning()
      }

      if (left <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true
        onTimeUp()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [totalSeconds, startTime, onTimeUp, onWarning])

  const percent = (remaining / totalSeconds) * 100
  const isWarning = remaining <= 10

  let barColor: string
  if (percent > 60) barColor = '#22c55e' // green
  else if (percent > 35) barColor = '#eab308' // yellow
  else if (percent > 15) barColor = '#f97316' // orange
  else barColor = '#ef4444' // red

  return (
    <div data-component="TimerBar" className={css({ width: '100%', px: '4' })}>
      <div
        className={css({
          position: 'relative',
          height: '12px',
          bg: 'gray.200',
          borderRadius: 'full',
          overflow: 'hidden',
        })}
      >
        <div
          style={{
            width: `${percent}%`,
            backgroundColor: barColor,
            height: '100%',
            borderRadius: '9999px',
            transition: 'width 0.1s linear',
            animation: isWarning ? 'pulse 0.8s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      <div
        className={css({
          textAlign: 'center',
          mt: '1',
          fontSize: 'sm',
          fontWeight: 'bold',
          color: isWarning ? 'red.600' : 'gray.600',
        })}
      >
        {Math.ceil(remaining)}s
      </div>
    </div>
  )
}
