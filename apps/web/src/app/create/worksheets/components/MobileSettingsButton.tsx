'use client'

import { css } from '@styled/css'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import type { WorksheetFormState } from '../types'
import { generateSettingsSummary } from '../utils/settingsSummary'

interface MobileSettingsButtonProps {
  config: Partial<WorksheetFormState>
  onClick: () => void
}

const MARGIN = 16 // Safe margin from viewport edges
const STORAGE_KEY = 'mobile-settings-button-position'

export function MobileSettingsButton({ config, onClick }: MobileSettingsButtonProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { lines } = generateSettingsSummary(config)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: MARGIN, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPosition(parsed)
      } catch (e) {
        // Ignore invalid JSON
      }
    } else {
      // Default position: below nav and action button
      const navHeight = 60 // Approximate --app-nav-height
      const actionButtonArea = 80 // Generous estimate including padding
      setPosition({ x: MARGIN, y: navHeight + actionButtonArea })
    }
  }, [])

  // Save position to localStorage
  const savePosition = (pos: { x: number; y: number }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  }

  // Constrain position within viewport bounds
  const constrainPosition = (x: number, y: number) => {
    if (!buttonRef.current) return { x, y }

    const rect = buttonRef.current.getBoundingClientRect()

    // Calculate bounds - need to stay below the download/action button
    // Try to find the actual action button element to get its real height
    const actionButton = document.querySelector('[data-action="generate-worksheet"]')
    let actionButtonBottom = 0

    if (actionButton) {
      const actionRect = actionButton.getBoundingClientRect()
      actionButtonBottom = actionRect.bottom + MARGIN
    } else {
      // Fallback: estimate based on nav height + action button area
      const navHeight = 60 // Approximate --app-nav-height
      const actionButtonArea = 80 // More generous estimate including padding
      actionButtonBottom = navHeight + actionButtonArea
    }

    const minY = actionButtonBottom
    const maxX = window.innerWidth - rect.width - MARGIN
    const maxY = window.innerHeight - rect.height - MARGIN

    return {
      x: Math.max(MARGIN, Math.min(x, maxX)),
      y: Math.max(minY, Math.min(y, maxY)),
    }
  }

  // Handle drag start
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if clicking the button itself, not when opening
    if ((e.target as HTMLElement).closest('[data-summary-line]')) {
      return // Allow text selection
    }

    e.preventDefault()
    e.stopPropagation()

    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    }

    // Capture pointer to receive all events
    if (buttonRef.current) {
      buttonRef.current.setPointerCapture(e.pointerId)
    }
  }

  // Handle drag move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return

    e.preventDefault()
    e.stopPropagation()

    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    const newX = dragStartRef.current.startX + deltaX
    const newY = dragStartRef.current.startY + deltaY

    const constrained = constrainPosition(newX, newY)
    setPosition(constrained)
  }

  // Handle drag end
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return

    e.preventDefault()
    e.stopPropagation()

    setIsDragging(false)
    dragStartRef.current = null

    // Release pointer capture
    if (buttonRef.current) {
      buttonRef.current.releasePointerCapture(e.pointerId)
    }

    // Save final position
    savePosition(position)
  }

  // Handle click (only if not dragged)
  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    onClick()
  }

  return (
    <button
      ref={buttonRef}
      data-action="open-mobile-settings"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none', // Prevent default touch behaviors
      }}
      className={css({
        position: 'fixed',
        zIndex: 30,
        bg: isDark ? 'gray.800' : 'white',
        color: isDark ? 'gray.100' : 'gray.900',
        rounded: 'xl',
        p: '3',
        boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.300',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, background-color 0.2s',
        maxWidth: 'calc(100vw - 32px)',
        userSelect: 'none',
        _hover: {
          boxShadow: isDragging ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 6px 16px rgba(0, 0, 0, 0.2)',
          bg: isDark ? 'gray.750' : 'gray.50',
        },
      })}
      aria-label="Open worksheet settings (draggable)"
    >
      {/* Header with gear icon */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          mb: '2',
          fontSize: 'sm',
          fontWeight: 'bold',
          color: isDark ? 'gray.300' : 'gray.600',
        })}
      >
        <span className={css({ fontSize: 'lg' })}>⚙️</span>
        <span>Worksheet Settings</span>
      </div>

      {/* Summary lines */}
      <div
        className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          fontSize: 'xs',
          color: isDark ? 'gray.400' : 'gray.700',
        })}
      >
        {lines.map((line, i) => (
          <div key={i} className={css({ lineHeight: '1.4' })}>
            {line}
          </div>
        ))}
      </div>

      {/* Tap indicator */}
      <div
        className={css({
          mt: '2',
          pt: '2',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          fontSize: '2xs',
          color: isDark ? 'gray.500' : 'gray.500',
          textAlign: 'center',
        })}
      >
        Tap to customize
      </div>
    </button>
  )
}
