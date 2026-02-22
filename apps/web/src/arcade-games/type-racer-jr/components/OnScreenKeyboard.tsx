'use client'

import { useCallback } from 'react'
import { css } from '../../../../styled-system/css'

interface OnScreenKeyboardProps {
  onKeyPress: (letter: string) => void
  highlightedLetter?: string
}

// ABC alphabetical layout (not QWERTY — 5yo don't know QWERTY)
const ROWS = [
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  ['h', 'i', 'j', 'k', 'l', 'm', 'n'],
  ['o', 'p', 'q', 'r', 's', 't', 'u'],
  ['v', 'w', 'x', 'y', 'z'],
]

/**
 * On-screen ABC keyboard for touch devices.
 * Letters arranged alphabetically, not QWERTY.
 */
export function OnScreenKeyboard({ onKeyPress, highlightedLetter }: OnScreenKeyboardProps) {
  const handlePress = useCallback(
    (letter: string) => {
      onKeyPress(letter)
    },
    [onKeyPress]
  )

  return (
    <div
      data-component="OnScreenKeyboard"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        p: '3',
        bg: 'gray.100',
        borderRadius: 'xl',
        maxWidth: '500px',
        mx: 'auto',
        width: '100%',
      })}
    >
      {ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className={css({
            display: 'flex',
            gap: '4px',
            justifyContent: 'center',
          })}
        >
          {row.map((letter) => {
            const isHighlighted = letter === highlightedLetter
            return (
              <button
                key={letter}
                type="button"
                onClick={() => handlePress(letter)}
                data-action="type-letter"
                data-letter={letter}
                className={css({
                  minWidth: '44px',
                  minHeight: '56px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  border: '2px solid',
                  borderRadius: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  _active: {
                    transform: 'scale(0.92)',
                  },
                })}
                style={{
                  backgroundColor: isHighlighted ? '#dbeafe' : 'white',
                  borderColor: isHighlighted ? '#3b82f6' : '#d1d5db',
                  color: isHighlighted ? '#1d4ed8' : '#374151',
                  boxShadow: isHighlighted ? '0 0 8px rgba(59, 130, 246, 0.3)' : undefined,
                }}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
