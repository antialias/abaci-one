'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import Keyboard from 'react-simple-keyboard'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import 'react-simple-keyboard/build/css/index.css'
import './NumericKeypad.css'
import { css } from '../../../styled-system/css'
import {
  BKSP_KEY,
  ENTER_KEY,
  getLandscapeLayout,
  getPortraitLayout,
  keypadDisplay,
} from './numericKeypadConfig'

// Height of the portrait keypad (button height + padding)
const PORTRAIT_KEYPAD_HEIGHT = 48
// Width of the landscape keypad (on small screens)
const LANDSCAPE_KEYPAD_WIDTH = 100

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
 * Get CSS custom properties for keyboard theming
 */
function getKeypadCssVars(isDark: boolean): React.CSSProperties {
  return {
    '--keypad-bg': isDark ? '#1a1a1a' : '#f5f5f5',
    '--keypad-btn-bg': isDark ? '#374151' : '#ffffff',
    '--keypad-btn-color': isDark ? '#f3f4f6' : '#1f2937',
    '--keypad-btn-border': isDark ? '#4b5563' : '#d1d5db',
    '--keypad-btn-shadow': isDark ? '0 2px 0 #1f2937' : '0 2px 0 #9ca3af',
    '--keypad-bksp-bg': isDark ? '#7f1d1d' : '#fee2e2',
    '--keypad-bksp-color': isDark ? '#fca5a5' : '#dc2626',
    '--keypad-bksp-border': isDark ? '#991b1b' : '#fecaca',
    '--keypad-enter-bg': isDark ? '#14532d' : '#dcfce7',
    '--keypad-enter-color': isDark ? '#86efac' : '#16a34a',
    '--keypad-enter-border': isDark ? '#166534' : '#bbf7d0',
  } as React.CSSProperties
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
  const { setBottomOffset, setRightOffset } = useMyAbacus()

  // Set offsets for floating abacus when keypad is shown
  // This positions the abacus above/left of the keypad to avoid overlap
  // Portrait: bottom offset (keypad at bottom)
  // Landscape (small screens): right offset (keypad on right side)
  useEffect(() => {
    setBottomOffset(PORTRAIT_KEYPAD_HEIGHT)
    setRightOffset(LANDSCAPE_KEYPAD_WIDTH)
    return () => {
      setBottomOffset(0)
      setRightOffset(0)
    }
  }, [setBottomOffset, setRightOffset])

  // Get keyboard layouts from config
  const portraitLayout = getPortraitLayout(showSubmitButton)
  const landscapeLayout = getLandscapeLayout(showSubmitButton)

  const handleKeyPress = useCallback(
    (button: string) => {
      if (disabled) return

      if (button === BKSP_KEY) {
        onBackspace()
      } else if (button === ENTER_KEY) {
        onSubmit()
      } else if (/^[0-9]$/.test(button)) {
        onDigit(button)
      }
    },
    [disabled, onDigit, onBackspace, onSubmit]
  )

  // Memoize CSS variables to avoid re-creating object on every render
  const cssVars = useMemo(() => getKeypadCssVars(isDark), [isDark])

  return (
    <>
      {/* Portrait mode: single row fixed to bottom */}
      <div
        data-component="numeric-keypad"
        data-layout="portrait"
        style={cssVars}
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
            display={keypadDisplay}
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
        style={cssVars}
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
            display={keypadDisplay}
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
