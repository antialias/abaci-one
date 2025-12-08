'use client'

import { useCallback, useRef } from 'react'
import Keyboard from 'react-simple-keyboard'
import { useTheme } from '@/contexts/ThemeContext'
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
  /** Whether to show the submit/checkmark button (hidden during auto-submit mode) */
  showSubmitButton?: boolean
}

/**
 * Generate CSS variables for keyboard theming
 * Uses Panda CSS tokens converted to CSS custom properties
 */
function getKeyboardThemeStyles(isDark: boolean): string {
  return `
    .practice-numeric-keyboard .simple-keyboard {
      background: var(--colors-${isDark ? 'gray-800' : 'gray-50'});
      border-radius: 12px;
      padding: 8px;
      border: 1px solid var(--colors-${isDark ? 'gray-700' : 'gray-200'});
    }
    .practice-numeric-keyboard .hg-button {
      height: 56px;
      border-radius: 8px;
      background: var(--colors-${isDark ? 'gray-700' : 'white'});
      color: var(--colors-${isDark ? 'gray-100' : 'gray-800'});
      border: 1px solid var(--colors-${isDark ? 'gray-600' : 'gray-200'});
      font-size: 24px;
      font-weight: 600;
      box-shadow: ${isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'};
      transition: all 0.1s ease;
      flex: 1;
      margin: 3px;
    }
    .practice-numeric-keyboard .hg-button:active {
      background: var(--colors-blue-500);
      color: white;
      transform: scale(0.95);
    }
    .practice-numeric-keyboard .hg-button[data-skbtn="{bksp}"] {
      background: var(--colors-${isDark ? 'red-900' : 'red-100'});
      color: var(--colors-${isDark ? 'red-300' : 'red-600'});
      border-color: var(--colors-${isDark ? 'red-800' : 'red-200'});
    }
    .practice-numeric-keyboard .hg-button[data-skbtn="{bksp}"]:active {
      background: var(--colors-red-600);
      color: white;
    }
    .practice-numeric-keyboard .hg-button[data-skbtn="{enter}"] {
      background: var(--colors-${isDark ? 'green-900' : 'green-100'});
      color: var(--colors-${isDark ? 'green-300' : 'green-600'});
      border-color: var(--colors-${isDark ? 'green-800' : 'green-200'});
    }
    .practice-numeric-keyboard .hg-button[data-skbtn="{enter}"]:active {
      background: var(--colors-green-600);
      color: white;
    }
    .practice-numeric-keyboard .hg-button[data-skbtn="{empty}"] {
      visibility: hidden;
      pointer-events: none;
    }
    .practice-numeric-keyboard .hg-row {
      display: flex;
      justify-content: center;
      margin-bottom: 2px;
    }
  `
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
  showSubmitButton = true,
}: NumericKeypadProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const keyboardRef = useRef<any>(null)

  // Numeric layout - conditionally include submit button
  // When submit is hidden, we use a spacer {empty} to maintain grid alignment
  const layout = {
    default: showSubmitButton
      ? ['1 2 3', '4 5 6', '7 8 9', '{bksp} 0 {enter}']
      : ['1 2 3', '4 5 6', '7 8 9', '{bksp} 0 {empty}'],
  }

  const display = {
    '{bksp}': '\u232B', // Unicode backspace symbol
    '{enter}': '\u2713', // Unicode checkmark
    '{empty}': '', // Empty spacer
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
      <style>{getKeyboardThemeStyles(isDark)}</style>
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
