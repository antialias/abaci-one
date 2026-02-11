'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { parseTargetNumber } from './parseTargetNumber'

const PRESET_EMOJIS = ['⭐', '🚀', '💎', '🦄', '🌈', '🎯', '🔥', '🌸', '🐙', '🍕', '🎪', '🪐']

export type FindTheNumberGameState = 'idle' | 'active' | 'found'

interface FindTheNumberBarProps {
  onStart: (target: number, emoji: string) => void
  onGiveUp: () => void
  gameState: FindTheNumberGameState
  isDark: boolean
}

function getRandomEmoji(): string {
  return PRESET_EMOJIS[Math.floor(Math.random() * PRESET_EMOJIS.length)]
}

function formatNumber(val: number): string {
  const str = val.toString()
  if (str.includes('.') && str.split('.')[1].length > 3) {
    return val.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  }
  return str
}

export function FindTheNumberBar({
  onStart,
  onGiveUp,
  gameState,
  isDark,
}: FindTheNumberBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [displayNumber, setDisplayNumber] = useState<number | null>(null)
  const [displayEmoji, setDisplayEmoji] = useState(PRESET_EMOJIS[0])
  const inputRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLDivElement>(null)
  const prevGameStateRef = useRef(gameState)

  // Randomize emoji after mount to avoid hydration mismatch
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      setDisplayEmoji(getRandomEmoji())
    }
  }, [])

  // Celebration animation when found
  useEffect(() => {
    if (gameState === 'found' && prevGameStateRef.current === 'active' && numberRef.current) {
      numberRef.current.animate(
        [
          { transform: 'scale(1)', color: isDark ? '#e5e7eb' : '#1f2937' },
          { transform: 'scale(1.15)', color: '#10b981' },
          { transform: 'scale(1)', color: '#10b981' },
        ],
        { duration: 500, easing: 'ease-out', fill: 'forwards' },
      )
    }
    prevGameStateRef.current = gameState
  }, [gameState, isDark])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isEditing])

  const commitInput = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      // Empty input → return to idle
      setIsEditing(false)
      setInputValue('')
      return
    }
    const parsed = parseTargetNumber(trimmed)
    if (parsed !== null) {
      const emoji = getRandomEmoji()
      setDisplayNumber(parsed)
      setDisplayEmoji(emoji)
      setIsEditing(false)
      setInputValue('')
      onStart(parsed, emoji)
    }
    // Invalid input: stay in editing mode (let user fix it)
  }, [inputValue, onStart])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitInput()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setInputValue('')
    }
  }, [commitInput])

  const handleTapNumber = useCallback(() => {
    onGiveUp()
    setDisplayNumber(null)
    setIsEditing(true)
    setInputValue('')
  }, [onGiveUp])

  const handleTapPlaceholder = useCallback(() => {
    setIsEditing(true)
    setInputValue('')
  }, [])

  const textColor = isDark ? '#e5e7eb' : '#1f2937'
  const mutedColor = isDark ? 'rgba(156, 163, 175, 0.7)' : 'rgba(107, 114, 128, 0.7)'
  const borderColor = isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.8)'

  // Parse live for validation hint
  const parsed = inputValue.trim() ? parseTargetNumber(inputValue) : undefined
  const showInvalid = inputValue.trim().length > 0 && parsed === null

  return (
    <div
      data-component="find-the-number-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
        padding: '8px 16px',
        borderBottom: `1px solid ${borderColor}`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {isEditing ? (
        /* --- Editing: inline input --- */
        <div
          data-element="edit-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            width: '100%',
            maxWidth: 280,
          }}
        >
          <input
            ref={inputRef}
            data-element="number-input"
            type="text"
            inputMode="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitInput}
            onKeyDown={handleKeyDown}
            placeholder="type a number…"
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: showInvalid ? '#ef4444' : textColor,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${showInvalid ? '#ef4444' : (isDark ? 'rgba(99, 102, 241, 0.6)' : 'rgba(79, 70, 229, 0.5)')}`,
              outline: 'none',
              padding: '4px 0',
              caretColor: isDark ? '#818cf8' : '#4f46e5',
            }}
          />
          {showInvalid && (
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              try 3.14 or 1/3
            </span>
          )}
        </div>
      ) : displayNumber !== null ? (
        /* --- Active / Found: tappable number display --- */
        <div
          ref={numberRef}
          data-element="number-display"
          data-action="tap-to-reset"
          onClick={handleTapNumber}
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: gameState === 'found' ? '#10b981' : textColor,
            cursor: 'pointer',
            padding: '4px 16px',
            borderRadius: 12,
            transition: 'background 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)'
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          {displayEmoji} {formatNumber(displayNumber)}
        </div>
      ) : (
        /* --- Idle: tappable placeholder --- */
        <div
          data-element="placeholder"
          data-action="tap-to-start"
          onClick={handleTapPlaceholder}
          style={{
            fontSize: '1.1rem',
            fontWeight: 500,
            color: mutedColor,
            cursor: 'pointer',
            padding: '8px 16px',
            borderRadius: 12,
            transition: 'background 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onPointerEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)'
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = ''
          }}
        >
          {displayEmoji} tap to pick a number
        </div>
      )}
    </div>
  )
}
