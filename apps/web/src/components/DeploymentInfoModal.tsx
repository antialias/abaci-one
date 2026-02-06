'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Info, X } from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { css } from '../../styled-system/css'

interface DeploymentInfoModalProps {
  children: React.ReactNode
  externalOpen?: boolean
  onExternalOpenChange?: (open: boolean) => void
}

export function DeploymentInfoModal({
  children,
  externalOpen,
  onExternalOpenChange,
}: DeploymentInfoModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  // Use external control if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = onExternalOpenChange || setInternalOpen
  const toggleOpen = useCallback(() => setOpen(!open), [open, setOpen])

  useEffect(() => {
    // Keyboard shortcut: Cmd/Ctrl + Shift + I
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        toggleOpen()
      }
    }

    const gesture = {
      tracking: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      lastX: 0,
      lastY: 0,
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture.tracking = false
        return
      }

      const touch = event.touches[0]
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const cornerThresholdX = viewportWidth * 0.15
      const cornerThresholdY = viewportHeight * 0.15

      if (touch.clientX <= cornerThresholdX && touch.clientY <= cornerThresholdY) {
        gesture.tracking = true
        gesture.startX = touch.clientX
        gesture.startY = touch.clientY
        gesture.startTime = performance.now()
        gesture.lastX = touch.clientX
        gesture.lastY = touch.clientY
      } else {
        gesture.tracking = false
      }
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!gesture.tracking) {
        return
      }

      if (event.touches.length !== 1) {
        gesture.tracking = false
        return
      }

      const touch = event.touches[0]
      gesture.lastX = touch.clientX
      gesture.lastY = touch.clientY
    }

    const handleTouchCancel = () => {
      gesture.tracking = false
    }

    const handleTouchEnd = (event: TouchEvent) => {
      if (!gesture.tracking) {
        return
      }

      const { startX, startY, startTime } = gesture
      const touch = event.changedTouches[0]
      const endX = touch?.clientX ?? gesture.lastX
      const endY = touch?.clientY ?? gesture.lastY
      const elapsed = performance.now() - startTime

      gesture.tracking = false

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const bottomThresholdX = viewportWidth * 0.85
      const bottomThresholdY = viewportHeight * 0.85
      const minimumDistance = Math.hypot(endX - startX, endY - startY)
      const diagonal = Math.hypot(viewportWidth, viewportHeight)
      const minimumRequiredDistance = diagonal * 0.25

      if (
        endX >= bottomThresholdX &&
        endY >= bottomThresholdY &&
        minimumDistance >= minimumRequiredDistance &&
        elapsed <= 1500
      ) {
        toggleOpen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchCancel)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchCancel)
    }
  }, [toggleOpen])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
            animation: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          })}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: { base: 'white', _dark: 'gray.900' },
            borderRadius: 'lg',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '6',
            width: '90vw',
            maxWidth: '500px',
            maxHeight: '85vh',
            overflow: 'auto',
            zIndex: 9999,
            animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          })}
        >
          <Dialog.Title
            className={css({
              fontSize: 'xl',
              fontWeight: 'semibold',
              marginBottom: '4',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              color: { base: 'gray.900', _dark: 'gray.100' },
            })}
          >
            <Info size={24} />
            Deployment Information
          </Dialog.Title>

          {children}

          <div
            className={css({
              marginTop: '6',
              paddingTop: '4',
              borderTop: '1px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              fontSize: 'sm',
              color: { base: 'gray.600', _dark: 'gray.400' },
              textAlign: 'center',
            })}
          >
            Press{' '}
            <kbd
              className={css({
                fontFamily: 'mono',
                backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                padding: '0.5 1.5',
                borderRadius: 'sm',
                border: '1px solid',
                borderColor: { base: 'gray.300', _dark: 'gray.600' },
                color: { base: 'gray.700', _dark: 'gray.300' },
              })}
            >
              ⌘⇧I
            </kbd>{' '}
            or{' '}
            <kbd
              className={css({
                fontFamily: 'mono',
                backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
                padding: '0.5 1.5',
                borderRadius: 'sm',
                border: '1px solid',
                borderColor: { base: 'gray.300', _dark: 'gray.600' },
                color: { base: 'gray.700', _dark: 'gray.300' },
              })}
            >
              Ctrl⇧I
            </kbd>{' '}
            to toggle
          </div>

          <Dialog.Close
            className={css({
              position: 'absolute',
              top: '4',
              right: '4',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'md',
              padding: '2',
              color: { base: 'gray.700', _dark: 'gray.300' },
              cursor: 'pointer',
              border: 'none',
              backgroundColor: 'transparent',
              _hover: {
                backgroundColor: { base: 'gray.100', _dark: 'gray.800' },
              },
            })}
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
