'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

const UNDO_TIMEOUT = 5000 // 5 seconds to undo

export interface PendingDeletion {
  id: string
  title: string
  createdAt: number
}

export interface DeleteToastProps {
  deletion: PendingDeletion
  onUndo: (deletion: PendingDeletion) => void
  onConfirm: (deletion: PendingDeletion) => void
}

export function DeleteToast({ deletion, onUndo, onConfirm }: DeleteToastProps) {
  const [progress, setProgress] = useState(100)
  const [isPaused, setIsPaused] = useState(false)
  const startTimeRef = useRef(Date.now())
  const remainingTimeRef = useRef(UNDO_TIMEOUT)

  useEffect(() => {
    if (isPaused) return

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, remainingTimeRef.current - elapsed)
      const progressPercent = (remaining / UNDO_TIMEOUT) * 100

      setProgress(progressPercent)

      if (remaining <= 0) {
        onConfirm(deletion)
      }
    }

    const interval = setInterval(tick, 50)
    tick()

    return () => clearInterval(interval)
  }, [deletion, isPaused, onConfirm])

  const handleMouseEnter = useCallback(() => {
    remainingTimeRef.current = (progress / 100) * UNDO_TIMEOUT
    setIsPaused(true)
  }, [progress])

  const handleMouseLeave = useCallback(() => {
    startTimeRef.current = Date.now()
    setIsPaused(false)
  }, [])

  const handleUndo = useCallback(() => {
    onUndo(deletion)
  }, [deletion, onUndo])

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={css({
        position: 'relative',
        backgroundColor: { base: 'gray.800', _dark: 'gray.800' },
        borderRadius: 'lg',
        padding: '4',
        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        border: '1px solid',
        borderColor: { base: 'gray.700', _dark: 'gray.700' },
        minWidth: '280px',
        maxWidth: '360px',
        overflow: 'hidden',
      })}
    >
      {/* Progress bar */}
      <div
        className={css({
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: 'gray.700',
        })}
      >
        <div
          className={css({
            height: '100%',
            backgroundColor: 'red.500',
            transition: isPaused ? 'none' : 'width 0.05s linear',
          })}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
        <div className={css({ fontSize: 'xl' })}>🗑️</div>
        <div className={css({ flex: 1, minWidth: 0 })}>
          <div
            className={css({
              color: 'gray.100',
              fontWeight: 'medium',
              marginBottom: '2',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            })}
          >
            Deleted "{deletion.title}"
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className={css({
              paddingX: '3',
              paddingY: '1',
              backgroundColor: 'blue.600',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'sm',
              fontWeight: 'medium',
              _hover: { backgroundColor: 'blue.500' },
            })}
          >
            Undo
          </button>
        </div>
      </div>
    </div>
  )
}

export interface DeleteToastContainerProps {
  deletions: PendingDeletion[]
  onUndo: (deletion: PendingDeletion) => void
  onConfirm: (deletion: PendingDeletion) => void
}

export function DeleteToastContainer({ deletions, onUndo, onConfirm }: DeleteToastContainerProps) {
  if (deletions.length === 0) return null

  return (
    <div
      className={css({
        position: 'fixed',
        bottom: '4',
        right: '4',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
      })}
    >
      {deletions.map((deletion) => (
        <DeleteToast key={deletion.id} deletion={deletion} onUndo={onUndo} onConfirm={onConfirm} />
      ))}
    </div>
  )
}
