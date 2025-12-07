'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { useCallback, useRef } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { css } from '../../../styled-system/css'

interface NumericKeypadProps {
  /** Called when a digit is pressed */
  onDigit: (digit: string) => void
  /** Called when backspace is pressed */
  onBackspace: () => void
  /** Called when submit/enter is pressed */
  onSubmit: () => void
  /** Whether the keyboard is disabled */
  disabled?: boolean
  /** Current input value (for display feedback) */
  currentValue?: string
}

/**
 * Numeric keypad for mobile input during practice sessions.
 * Uses react-simple-keyboard for touch-friendly digit entry.
 */
export function NumericKeypad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled = false,
  currentValue = '',
}: NumericKeypadProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const keyboardRef = useRef<any>(null)

  // Numeric layout with backspace and submit
  const layout = {
    default: ['1 2 3', '4 5 6', '7 8 9', '{bksp} 0 {enter}'],
  }

  const display = {
    '{bksp}': '⌫',
    '{enter}': '✓',
  }

  const handleKeyPress = useCallback(
    (button: string) => {
      if (disabled) return

      if (button === '{bksp}') {
        onBackspace()
      } else if (button === '{enter}') {
        onSubmit()
      } else if (/^[0-9]$/.test(button)) {
        onDigit(button)
      }
    },
    [disabled, onDigit, onBackspace, onSubmit]
  )

  return (
    <div
      data-component="numeric-keypad"
      className={css({
        width: '100%',
        maxWidth: '320px',
        margin: '0 auto',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      })}
    >
      <style>{`
        .practice-numeric-keyboard .simple-keyboard {
          background: ${isDark ? '#1f2937' : '#f8fafc'};
          border-radius: 12px;
          padding: 8px;
          border: 1px solid ${isDark ? '#374151' : '#e2e8f0'};
        }
        .practice-numeric-keyboard .hg-button {
          height: 56px;
          border-radius: 8px;
          background: ${isDark ? '#374151' : 'white'};
          color: ${isDark ? '#f3f4f6' : '#1e293b'};
          border: 1px solid ${isDark ? '#4b5563' : '#e2e8f0'};
          font-size: 24px;
          font-weight: 600;
          box-shadow: ${isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'};
          transition: all 0.1s ease;
          flex: 1;
          margin: 3px;
        }
        .practice-numeric-keyboard .hg-button:active {
          background: #3b82f6;
          color: white;
          transform: scale(0.95);
        }
        .practice-numeric-keyboard .hg-button[data-skbtn="{bksp}"] {
          background: ${isDark ? '#7f1d1d' : '#fee2e2'};
          color: ${isDark ? '#fca5a5' : '#dc2626'};
          border-color: ${isDark ? '#991b1b' : '#fecaca'};
        }
        .practice-numeric-keyboard .hg-button[data-skbtn="{bksp}"]:active {
          background: #dc2626;
          color: white;
        }
        .practice-numeric-keyboard .hg-button[data-skbtn="{enter}"] {
          background: ${isDark ? '#14532d' : '#dcfce7'};
          color: ${isDark ? '#86efac' : '#16a34a'};
          border-color: ${isDark ? '#166534' : '#bbf7d0'};
        }
        .practice-numeric-keyboard .hg-button[data-skbtn="{enter}"]:active {
          background: #16a34a;
          color: white;
        }
        .practice-numeric-keyboard .hg-row {
          display: flex;
          justify-content: center;
          margin-bottom: 2px;
        }
      `}</style>
      <div className="practice-numeric-keyboard">
        <Keyboard
          keyboardRef={(r) => (keyboardRef.current = r)}
          layout={layout}
          display={display}
          onKeyPress={handleKeyPress}
          theme="hg-theme-default simple-keyboard"
          physicalKeyboardHighlight={false}
          physicalKeyboardHighlightPress={false}
          disableButtonHold={true}
          stopMouseDownPropagation={true}
          stopMouseUpPropagation={true}
        />
      </div>
    </div>
  )
}

export default NumericKeypad
