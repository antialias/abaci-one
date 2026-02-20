'use client'

import { useEffect, useCallback } from 'react'

export interface ShortcutEntry {
  key: string
  description: string
}

interface KeyboardShortcutsOverlayProps {
  shortcuts: ShortcutEntry[]
  onClose: () => void
  isDark: boolean
}

/**
 * Modal overlay showing a list of keyboard shortcuts.
 * Press `?` to open (handled by parent), `Esc` or click backdrop to close.
 */
export function KeyboardShortcutsOverlay({
  shortcuts,
  onClose,
  isDark,
}: KeyboardShortcutsOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      data-element="keyboard-shortcuts-overlay"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        data-element="keyboard-shortcuts-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#e2e8f0' : '#1e293b',
          borderRadius: 12,
          padding: '20px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxWidth: 360,
          width: '90%',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16 }}>Keyboard Shortcuts</span>
          <button
            data-action="close-shortcuts"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            &times;
          </button>
        </div>
        {shortcuts.map(({ key, description }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 0',
            }}
          >
            <kbd
              style={{
                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                color: isDark ? '#e2e8f0' : '#334155',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {key}
            </kbd>
            <span style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', marginLeft: 12 }}>
              {description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
