'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

export interface SessionInfo {
  sessionId: string
  startTime: number
  endTime: number
  imageCount: number
}

export interface TimelineRangeSelectorProps {
  /** All images with timestamps */
  images: { timestamp: number; sessionId: string }[]
  /** Selection mode */
  mode: 'before' | 'after' | 'between'
  /** Before timestamp (exclusive) - images before this are selected */
  beforeTimestamp?: number
  /** After timestamp (exclusive) - images after this are selected */
  afterTimestamp?: number
  /** Callback when selection changes */
  onChange: (before?: number, after?: number) => void
}

export function TimelineRangeSelector({
  images,
  mode,
  beforeTimestamp,
  afterTimestamp,
  onChange,
}: TimelineRangeSelectorProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'before' | 'after' | null>(null)

  // Calculate timeline bounds with some padding
  const { minTime, maxTime, sessions } = useMemo(() => {
    if (images.length === 0) {
      const now = Date.now()
      return { minTime: now - 86400000, maxTime: now, sessions: [] }
    }

    const timestamps = images.map((i) => i.timestamp)
    const min = Math.min(...timestamps)
    const max = Math.max(...timestamps)
    const range = max - min
    const padding = Math.max(range * 0.05, 3600000) // At least 1 hour padding

    // Group by session
    const sessionMap = new Map<string, { times: number[]; count: number }>()
    for (const img of images) {
      const existing = sessionMap.get(img.sessionId)
      if (existing) {
        existing.times.push(img.timestamp)
        existing.count++
      } else {
        sessionMap.set(img.sessionId, { times: [img.timestamp], count: 1 })
      }
    }

    const sessionList: SessionInfo[] = []
    for (const [sessionId, data] of sessionMap) {
      sessionList.push({
        sessionId,
        startTime: Math.min(...data.times),
        endTime: Math.max(...data.times),
        imageCount: data.count,
      })
    }
    sessionList.sort((a, b) => a.startTime - b.startTime)

    return {
      minTime: min - padding,
      maxTime: max + padding,
      sessions: sessionList,
    }
  }, [images])

  const timeRange = maxTime - minTime

  // Convert timestamp to percentage position
  const timeToPercent = useCallback(
    (time: number) => {
      return ((time - minTime) / timeRange) * 100
    },
    [minTime, timeRange]
  )

  // Convert percentage position to timestamp
  const percentToTime = useCallback(
    (percent: number) => {
      return minTime + (percent / 100) * timeRange
    },
    [minTime, timeRange]
  )

  // Get position from mouse/touch event
  const getPositionFromEvent = useCallback((e: MouseEvent | TouchEvent) => {
    if (!trackRef.current) return 50
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const percent = ((clientX - rect.left) / rect.width) * 100
    return Math.max(0, Math.min(100, percent))
  }, [])

  // Handle mouse/touch move
  useEffect(() => {
    if (!dragging) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const percent = getPositionFromEvent(e)
      const time = percentToTime(percent)

      if (dragging === 'before') {
        if (mode === 'between' && afterTimestamp !== undefined) {
          // Ensure before > after for "between" mode
          onChange(Math.max(time, afterTimestamp + 60000), afterTimestamp)
        } else {
          onChange(time, afterTimestamp)
        }
      } else if (dragging === 'after') {
        if (mode === 'between' && beforeTimestamp !== undefined) {
          // Ensure after < before for "between" mode
          onChange(beforeTimestamp, Math.min(time, beforeTimestamp - 60000))
        } else {
          onChange(beforeTimestamp, time)
        }
      }
    }

    const handleUp = () => {
      setDragging(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [
    dragging,
    mode,
    beforeTimestamp,
    afterTimestamp,
    getPositionFromEvent,
    percentToTime,
    onChange,
  ])

  // Initialize knob positions if not set
  useEffect(() => {
    if (mode === 'before' && beforeTimestamp === undefined) {
      onChange(minTime + timeRange * 0.5, undefined)
    } else if (mode === 'after' && afterTimestamp === undefined) {
      onChange(undefined, minTime + timeRange * 0.5)
    } else if (mode === 'between') {
      if (afterTimestamp === undefined || beforeTimestamp === undefined) {
        onChange(minTime + timeRange * 0.7, minTime + timeRange * 0.3)
      }
    }
  }, [mode, beforeTimestamp, afterTimestamp, minTime, timeRange, onChange])

  // Calculate selected region
  const selectedRegion = useMemo(() => {
    if (mode === 'before' && beforeTimestamp !== undefined) {
      return { left: 0, right: 100 - timeToPercent(beforeTimestamp) }
    } else if (mode === 'after' && afterTimestamp !== undefined) {
      return { left: timeToPercent(afterTimestamp), right: 0 }
    } else if (
      mode === 'between' &&
      beforeTimestamp !== undefined &&
      afterTimestamp !== undefined
    ) {
      return {
        left: timeToPercent(afterTimestamp),
        right: 100 - timeToPercent(beforeTimestamp),
      }
    }
    return { left: 0, right: 0 }
  }, [mode, beforeTimestamp, afterTimestamp, timeToPercent])

  // Count images in selected range
  const selectedCount = useMemo(() => {
    return images.filter((img) => {
      if (mode === 'before' && beforeTimestamp !== undefined) {
        return img.timestamp < beforeTimestamp
      } else if (mode === 'after' && afterTimestamp !== undefined) {
        return img.timestamp > afterTimestamp
      } else if (
        mode === 'between' &&
        beforeTimestamp !== undefined &&
        afterTimestamp !== undefined
      ) {
        return img.timestamp > afterTimestamp && img.timestamp < beforeTimestamp
      }
      return false
    }).length
  }, [images, mode, beforeTimestamp, afterTimestamp])

  // Format timestamp for display
  const formatTime = useCallback((time: number) => {
    const date = new Date(time)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  // Generate colors for sessions
  const sessionColors = useMemo(() => {
    const colors = [
      'hsl(200, 70%, 50%)',
      'hsl(150, 70%, 45%)',
      'hsl(280, 60%, 55%)',
      'hsl(30, 80%, 50%)',
      'hsl(340, 70%, 55%)',
      'hsl(180, 60%, 45%)',
    ]
    const colorMap = new Map<string, string>()
    sessions.forEach((s, i) => {
      colorMap.set(s.sessionId, colors[i % colors.length])
    })
    return colorMap
  }, [sessions])

  return (
    <div data-component="timeline-range-selector" className={css({ userSelect: 'none' })}>
      {/* Timeline track */}
      <div
        ref={trackRef}
        className={css({
          position: 'relative',
          height: '80px',
          bg: 'gray.800',
          borderRadius: 'lg',
          overflow: 'hidden',
          cursor: 'pointer',
        })}
      >
        {/* Selected region highlight */}
        <div
          className={css({
            position: 'absolute',
            top: 0,
            bottom: 0,
            bg: 'red.500/20',
            borderLeft: selectedRegion.left > 0 ? '2px solid' : 'none',
            borderRight: selectedRegion.right > 0 ? '2px solid' : 'none',
            borderColor: 'red.500',
            pointerEvents: 'none',
          })}
          style={{
            left: `${selectedRegion.left}%`,
            right: `${selectedRegion.right}%`,
          }}
        />

        {/* Sessions */}
        <div
          className={css({
            position: 'absolute',
            top: '20px',
            left: 0,
            right: 0,
            height: '40px',
          })}
        >
          {sessions.map((session) => {
            const left = timeToPercent(session.startTime)
            const right = 100 - timeToPercent(session.endTime)
            const width = 100 - left - right
            const color = sessionColors.get(session.sessionId) || 'gray'

            return (
              <div
                key={session.sessionId}
                title={`Session ${session.sessionId.slice(0, 8)}: ${session.imageCount} images`}
                className={css({
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  borderRadius: 'md',
                  opacity: 0.8,
                  transition: 'opacity 0.15s',
                  _hover: { opacity: 1 },
                })}
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.5)}%`,
                  backgroundColor: color,
                }}
              >
                {/* Session label (only if wide enough) */}
                {width > 8 && (
                  <div
                    className={css({
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                      color: 'white',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {session.imageCount}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Knobs */}
        {(mode === 'before' || mode === 'between') && beforeTimestamp !== undefined && (
          <div
            data-element="knob-before"
            onMouseDown={() => setDragging('before')}
            onTouchStart={() => setDragging('before')}
            className={css({
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '20px',
              marginLeft: '-10px',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            })}
            style={{ left: `${timeToPercent(beforeTimestamp)}%` }}
          >
            {/* Knob handle */}
            <div
              className={css({
                width: '12px',
                height: '40px',
                bg: 'white',
                borderRadius: 'md',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                border: '2px solid',
                borderColor: dragging === 'before' ? 'blue.400' : 'gray.400',
                transition: 'border-color 0.15s',
                _hover: { borderColor: 'blue.400' },
              })}
            />
            {/* Time label */}
            <div
              className={css({
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                px: 2,
                py: 0.5,
                bg: 'gray.900',
                borderRadius: 'md',
                fontSize: 'xs',
                color: 'gray.300',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              })}
            >
              {formatTime(beforeTimestamp)}
            </div>
          </div>
        )}

        {(mode === 'after' || mode === 'between') && afterTimestamp !== undefined && (
          <div
            data-element="knob-after"
            onMouseDown={() => setDragging('after')}
            onTouchStart={() => setDragging('after')}
            className={css({
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '20px',
              marginLeft: '-10px',
              cursor: 'ew-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            })}
            style={{ left: `${timeToPercent(afterTimestamp)}%` }}
          >
            {/* Knob handle */}
            <div
              className={css({
                width: '12px',
                height: '40px',
                bg: 'white',
                borderRadius: 'md',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                border: '2px solid',
                borderColor: dragging === 'after' ? 'blue.400' : 'gray.400',
                transition: 'border-color 0.15s',
                _hover: { borderColor: 'blue.400' },
              })}
            />
            {/* Time label */}
            <div
              className={css({
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                px: 2,
                py: 0.5,
                bg: 'gray.900',
                borderRadius: 'md',
                fontSize: 'xs',
                color: 'gray.300',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              })}
            >
              {formatTime(afterTimestamp)}
            </div>
          </div>
        )}

        {/* Time axis labels */}
        <div
          className={css({
            position: 'absolute',
            bottom: '4px',
            left: '8px',
            fontSize: 'xs',
            color: 'gray.500',
          })}
        >
          {formatTime(minTime)}
        </div>
        <div
          className={css({
            position: 'absolute',
            bottom: '4px',
            right: '8px',
            fontSize: 'xs',
            color: 'gray.500',
          })}
        >
          {formatTime(maxTime)}
        </div>
      </div>

      {/* Selection info */}
      <div
        className={css({
          mt: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        })}
      >
        <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
          {mode === 'before' && 'Images before the marker will be deleted'}
          {mode === 'after' && 'Images after the marker will be deleted'}
          {mode === 'between' && 'Images between the markers will be deleted'}
        </div>
        <div
          className={css({
            px: 3,
            py: 1,
            bg: selectedCount > 0 ? 'red.900/50' : 'gray.800',
            borderRadius: 'full',
            fontSize: 'sm',
            fontWeight: 'bold',
            color: selectedCount > 0 ? 'red.300' : 'gray.500',
          })}
        >
          {selectedCount} images
        </div>
      </div>

      {/* Session legend */}
      {sessions.length > 0 && (
        <div className={css({ mt: 3 })}>
          <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 2 })}>Sessions:</div>
          <div className={css({ display: 'flex', flexWrap: 'wrap', gap: 2 })}>
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  bg: 'gray.800',
                  borderRadius: 'md',
                  fontSize: 'xs',
                })}
              >
                <div
                  className={css({
                    width: '10px',
                    height: '10px',
                    borderRadius: 'sm',
                  })}
                  style={{ backgroundColor: sessionColors.get(session.sessionId) }}
                />
                <span className={css({ color: 'gray.400' })}>{session.sessionId.slice(0, 8)}</span>
                <span className={css({ color: 'gray.500' })}>({session.imageCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
