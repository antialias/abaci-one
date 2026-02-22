'use client'

import { useCallback } from 'react'
import { css } from '../../../../styled-system/css'
import type { KeyboardLayout } from '../types'

interface OnScreenKeyboardProps {
  onKeyPress: (letter: string) => void
  highlightedLetter?: string
  layout?: KeyboardLayout
}

const LAYOUTS: Record<KeyboardLayout, string[][]> = {
  qwerty: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ],
  dvorak: [
    ['p', 'y', 'f', 'g', 'c', 'r', 'l'],
    ['a', 'o', 'e', 'u', 'i', 'd', 'h', 't', 'n', 's'],
    ['q', 'j', 'k', 'x', 'b', 'm', 'w', 'v', 'z'],
  ],
  abc: [
    ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
    ['j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r'],
    ['s', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
  ],
}

/**
 * On-screen keyboard for touch devices.
 * Supports QWERTY, Dvorak, and ABC layouts.
 */
export function OnScreenKeyboard({
  onKeyPress,
  highlightedLetter,
  layout = 'qwerty',
}: OnScreenKeyboardProps) {
  const handlePress = useCallback(
    (letter: string) => {
      onKeyPress(letter)
    },
    [onKeyPress]
  )

  const rows = LAYOUTS[layout]

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
      {rows.map((row, rowIdx) => (
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
                  flex: '1 1 0',
                  maxWidth: '44px',
                  minHeight: '48px',
                  fontSize: '18px',
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
