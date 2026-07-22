'use client'

import { css } from '@styled/css'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const drawerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchCurrent, setTouchCurrent] = useState<number | null>(null)

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Touch event handlers for swipe-to-close
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
    setTouchCurrent(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    setTouchCurrent(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (touchStart === null || touchCurrent === null) {
      setTouchStart(null)
      setTouchCurrent(null)
      return
    }

    const distance = touchCurrent - touchStart
    const threshold = 100 // pixels

    // Swipe left to close
    if (distance < -threshold) {
      onClose()
    }

    setTouchStart(null)
    setTouchCurrent(null)
  }

  // Calculate transform for swipe animation
  const getTransform = () => {
    if (touchStart === null || touchCurrent === null) {
      return isOpen ? 'translateX(0)' : 'translateX(-100%)'
    }

    const distance = touchCurrent - touchStart
    // Only allow leftward swipes
    if (distance < 0) {
      return `translateX(${distance}px)`
    }
    return 'translateX(0)'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        data-component="mobile-drawer-backdrop"
        className={css({
          position: 'fixed',
          inset: 0,
          bg: 'rgba(0, 0, 0, 0.5)',
          zIndex: 40,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out',
        })}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        data-component="mobile-drawer"
        className={css({
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '90%',
          maxWidth: '400px',
          bg: isDark ? 'gray.800' : 'white',
          zIndex: 50,
          overflow: 'auto',
          boxShadow: '2xl',
          transition: touchStart === null ? 'transform 0.3s ease-in-out' : 'none',
        })}
        style={{
          transform: getTransform(),
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close button */}
        <div
          className={css({
            position: 'sticky',
            top: 0,
            right: 0,
            zIndex: 10,
            p: 4,
            display: 'flex',
            justifyContent: 'flex-end',
            bg: isDark ? 'gray.800' : 'white',
            borderBottom: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <button
            data-action="close-mobile-drawer"
            onClick={onClose}
            className={css({
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              rounded: 'full',
              bg: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.300' : 'gray.700',
              fontSize: 'xl',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                bg: isDark ? 'gray.600' : 'gray.300',
                transform: 'scale(1.05)',
              },
              _active: {
                transform: 'scale(0.95)',
              },
            })}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={css({ p: 4 })}>{children}</div>
      </div>
    </>
  )
}
