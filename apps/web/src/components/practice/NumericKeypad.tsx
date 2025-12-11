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
 * Generate CSS for portrait keyboard (single row at bottom)
 */
function getPortraitStyles(isDark: boolean): string {
  return `
    .keypad-portrait-container {
      display: block;
    }
    .keypad-landscape-container {
      display: none;
    }
    @media (orientation: landscape) {
      .keypad-portrait-container {
        display: none;
      }
      .keypad-landscape-container {
        display: block;
      }
    }
    .keypad-portrait {
      width: 100%;
    }
    .keypad-portrait .simple-keyboard {
      background: ${isDark ? '#1a1a1a' : '#f5f5f5'};
      padding: 4px 2px;
      border-radius: 0;
      width: 100%;
      max-width: none;
    }
    .keypad-portrait .hg-row {
      display: flex;
      margin: 0;
    }
    .keypad-portrait .hg-button {
      height: 40px;
      flex: 1;
      margin: 0 1px;
      border-radius: 6px;
      background: ${isDark ? '#374151' : '#ffffff'};
      color: ${isDark ? '#f3f4f6' : '#1f2937'};
      border: 1px solid ${isDark ? '#4b5563' : '#d1d5db'};
      font-size: 18px;
      font-weight: 600;
      box-shadow: ${isDark ? '0 2px 0 #1f2937' : '0 2px 0 #9ca3af'};
    }
    .keypad-portrait .hg-button:active {
      background: #3b82f6;
      color: white;
      box-shadow: none;
      transform: translateY(2px);
    }
    .keypad-portrait .hg-button[data-skbtn="{bksp}"] {
      background: ${isDark ? '#7f1d1d' : '#fee2e2'};
      color: ${isDark ? '#fca5a5' : '#dc2626'};
      border-color: ${isDark ? '#991b1b' : '#fecaca'};
    }
    .keypad-portrait .hg-button[data-skbtn="{bksp}"]:active {
      background: #dc2626;
      color: white;
    }
    .keypad-portrait .hg-button[data-skbtn="{enter}"] {
      background: ${isDark ? '#14532d' : '#dcfce7'};
      color: ${isDark ? '#86efac' : '#16a34a'};
      border-color: ${isDark ? '#166534' : '#bbf7d0'};
    }
    .keypad-portrait .hg-button[data-skbtn="{enter}"]:active {
      background: #16a34a;
      color: white;
    }
  `
}

/**
 * Generate CSS for landscape keyboard (two columns on right)
 */
function getLandscapeStyles(isDark: boolean): string {
  return `
    .keypad-landscape .simple-keyboard {
      background: ${isDark ? '#1a1a1a' : '#f5f5f5'};
      padding: 4px;
      border-radius: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .keypad-landscape .hg-rows {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .keypad-landscape .hg-row {
      display: flex;
      flex: 1;
      margin: 0;
    }
    .keypad-landscape .hg-button {
      flex: 1;
      margin: 2px;
      border-radius: 6px;
      background: ${isDark ? '#374151' : '#ffffff'};
      color: ${isDark ? '#f3f4f6' : '#1f2937'};
      border: 1px solid ${isDark ? '#4b5563' : '#d1d5db'};
      font-size: 18px;
      font-weight: 600;
      box-shadow: ${isDark ? '0 2px 0 #1f2937' : '0 2px 0 #9ca3af'};
    }
    .keypad-landscape .hg-button:active {
      background: #3b82f6;
      color: white;
      box-shadow: none;
      transform: translateY(2px);
    }
    .keypad-landscape .hg-button[data-skbtn="{bksp}"] {
      background: ${isDark ? '#7f1d1d' : '#fee2e2'};
      color: ${isDark ? '#fca5a5' : '#dc2626'};
      border-color: ${isDark ? '#991b1b' : '#fecaca'};
    }
    .keypad-landscape .hg-button[data-skbtn="{bksp}"]:active {
      background: #dc2626;
      color: white;
    }
    .keypad-landscape .hg-button[data-skbtn="{enter}"] {
      background: ${isDark ? '#14532d' : '#dcfce7'};
      color: ${isDark ? '#86efac' : '#16a34a'};
      border-color: ${isDark ? '#166534' : '#bbf7d0'};
    }
    .keypad-landscape .hg-button[data-skbtn="{enter}"]:active {
      background: #16a34a;
      color: white;
    }
  `
}

/**
 * Responsive numeric keypad for mobile input during practice sessions.
 * Fixed position for maximum screen efficiency.
 *
 * Layout adapts to device orientation:
 * - Portrait: Single row fixed to bottom, edge-to-edge
 * - Landscape: Two columns fixed to right side, top-to-bottom
 */
export function NumericKeypad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled = false,
  showSubmitButton = true,
}: NumericKeypadProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const portraitKeyboardRef = useRef<any>(null)
  const landscapeKeyboardRef = useRef<any>(null)

  // Portrait layout: single row (no empty spacer - buttons flex to fill)
  const portraitLayout = {
    default: showSubmitButton
      ? ['1 2 3 4 5 6 7 8 9 0 {bksp} {enter}']
      : ['1 2 3 4 5 6 7 8 9 0 {bksp}'],
  }

  // Landscape layout: 6 rows, 2 columns (backspace spans full width when no submit)
  const landscapeLayout = {
    default: showSubmitButton
      ? ['1 6', '2 7', '3 8', '4 9', '5 0', '{bksp} {enter}']
      : ['1 6', '2 7', '3 8', '4 9', '5 0', '{bksp}'],
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
    <>
      <style>{getPortraitStyles(isDark)}</style>
      <style>{getLandscapeStyles(isDark)}</style>

      {/* Portrait mode: single row fixed to bottom */}
      <div
        data-component="numeric-keypad"
        data-layout="portrait"
        className={`keypad-portrait-container ${css({
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.300',
        })}`}
      >
        <div className="keypad-portrait">
          <Keyboard
            keyboardRef={(r) => (portraitKeyboardRef.current = r)}
            layout={portraitLayout}
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

      {/* Landscape mode: two columns fixed to right side */}
      <div
        data-component="numeric-keypad"
        data-layout="landscape"
        className={`keypad-landscape-container ${css({
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100px',
          zIndex: 1000,
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
          borderLeft: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.300',
        })}`}
      >
        <div className="keypad-landscape" style={{ height: '100%' }}>
          <Keyboard
            keyboardRef={(r) => (landscapeKeyboardRef.current = r)}
            layout={landscapeLayout}
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
    </>
  )
}

export default NumericKeypad
