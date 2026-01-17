'use client'

import { useCallback, useMemo, useRef } from 'react'
import Keyboard from 'react-simple-keyboard'
import { useTheme } from '@/contexts/ThemeContext'
import 'react-simple-keyboard/build/css/index.css'
import './KidNumberInput.css'
import { css } from '../../../../styled-system/css'

// Special key identifiers for react-simple-keyboard
const BKSP_KEY = '{bksp}'

// Keyboard layouts
function getPortraitLayout() {
  return {
    default: [`1 2 3 4 5 6 7 8 9 0 ${BKSP_KEY}`],
  }
}

function getLandscapeLayout() {
  return {
    default: ['1 6', '2 7', '3 8', '4 9', '5 0', BKSP_KEY],
  }
}

const keypadDisplay = {
  [BKSP_KEY]: '⌫',
}

/**
 * Get CSS custom properties for keyboard theming
 */
function getKeypadCssVars(isDark: boolean): React.CSSProperties {
  return {
    '--kid-keypad-bg': isDark ? '#1a1a1a' : '#f5f5f5',
    '--kid-keypad-btn-bg': isDark ? '#374151' : '#ffffff',
    '--kid-keypad-btn-color': isDark ? '#f3f4f6' : '#1f2937',
    '--kid-keypad-btn-border': isDark ? '#4b5563' : '#d1d5db',
    '--kid-keypad-btn-shadow': isDark ? '0 2px 0 #1f2937' : '0 2px 0 #9ca3af',
    '--kid-keypad-bksp-bg': isDark ? '#7f1d1d' : '#fee2e2',
    '--kid-keypad-bksp-color': isDark ? '#fca5a5' : '#dc2626',
    '--kid-keypad-bksp-border': isDark ? '#991b1b' : '#fecaca',
  } as React.CSSProperties
}

export type FeedbackState = 'none' | 'correct' | 'incorrect'

export interface KidNumberInputProps {
  /** Current input value */
  value: string
  /** Called when a digit is pressed */
  onDigit: (digit: string) => void
  /** Called when backspace is pressed */
  onBackspace: () => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Placeholder text when value is empty */
  placeholder?: string
  /** Current feedback state for visual styling */
  feedback?: FeedbackState
  /** Whether to show the on-screen keypad (default: true) */
  showKeypad?: boolean
  /** Layout mode: 'fixed' positions keypad at screen edge, 'inline' renders in place */
  keypadMode?: 'fixed' | 'inline'
  /** Size of the display */
  displaySize?: 'sm' | 'md' | 'lg' | 'xl'
}

/**
 * Kid-friendly number input with large touch targets and visual feedback.
 *
 * Features:
 * - Large, easy-to-tap number buttons
 * - Responsive layout (portrait/landscape)
 * - Visual feedback for correct/incorrect
 * - Theme support (light/dark mode)
 * - Keyboard input support
 *
 * @example
 * ```tsx
 * <KidNumberInput
 *   value={input}
 *   onDigit={(d) => setInput(prev => prev + d)}
 *   onBackspace={() => setInput(prev => prev.slice(0, -1))}
 *   feedback={isCorrect ? 'correct' : isWrong ? 'incorrect' : 'none'}
 * />
 * ```
 */
export function KidNumberInput({
  value,
  onDigit,
  onBackspace,
  disabled = false,
  placeholder = '?',
  feedback = 'none',
  showKeypad = true,
  keypadMode = 'fixed',
  displaySize = 'xl',
}: KidNumberInputProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const portraitKeyboardRef = useRef<any>(null)
  const landscapeKeyboardRef = useRef<any>(null)

  const handleKeyPress = useCallback(
    (button: string) => {
      if (disabled) return

      if (button === BKSP_KEY) {
        onBackspace()
      } else if (/^[0-9]$/.test(button)) {
        onDigit(button)
      }
    },
    [disabled, onDigit, onBackspace]
  )

  // Memoize CSS variables
  const cssVars = useMemo(() => getKeypadCssVars(isDark), [isDark])

  // Display size styles
  const displaySizeStyles = {
    sm: { fontSize: '2xl', padding: '2 4', minWidth: '60px' },
    md: { fontSize: '4xl', padding: '3 6', minWidth: '80px' },
    lg: { fontSize: '6xl', padding: '4 8', minWidth: '120px' },
    xl: { fontSize: '7xl', padding: '4 10', minWidth: '140px' },
  }

  const sizeStyle = displaySizeStyles[displaySize]

  // Feedback colors
  const getFeedbackStyles = () => {
    switch (feedback) {
      case 'correct':
        return {
          background: 'linear-gradient(135deg, #10b981, #059669)',
          borderColor: '#059669',
          animation: 'kid-input-correct 0.3s ease-out',
        }
      case 'incorrect':
        return {
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          borderColor: '#dc2626',
          animation: 'kid-input-shake 0.3s ease-out',
        }
      default:
        return {
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderColor: '#6366f1',
        }
    }
  }

  const feedbackStyles = getFeedbackStyles()

  return (
    <div
      data-component="kid-number-input"
      data-feedback={feedback}
      data-disabled={disabled}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4',
      })}
    >
      {/* Display area */}
      <div
        data-element="input-display"
        style={{
          ...feedbackStyles,
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
          border: `3px solid ${feedbackStyles.borderColor}`,
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.15s ease-out',
          ...sizeStyle,
        }}
        className={css({
          fontSize: sizeStyle.fontSize as any,
          padding: sizeStyle.padding as any,
          minWidth: sizeStyle.minWidth,
        })}
      >
        {value || placeholder}
      </div>

      {/* On-screen keypad */}
      {showKeypad &&
        (keypadMode === 'fixed' ? (
          <>
            {/* Portrait mode: single row fixed to bottom */}
            <div
              data-element="keypad-portrait"
              style={cssVars}
              className={`kid-keypad-portrait-container ${css({
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
              <div className="kid-keypad-portrait">
                <Keyboard
                  keyboardRef={(r) => (portraitKeyboardRef.current = r)}
                  layout={getPortraitLayout()}
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
              data-element="keypad-landscape"
              style={cssVars}
              className={`kid-keypad-landscape-container ${css({
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
              <div className="kid-keypad-landscape" style={{ height: '100%' }}>
                <Keyboard
                  keyboardRef={(r) => (landscapeKeyboardRef.current = r)}
                  layout={getLandscapeLayout()}
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
        ) : (
          /* Inline mode: keypad renders in place */
          <div
            data-element="keypad-inline"
            style={cssVars}
            className={`kid-keypad-inline ${css({
              opacity: disabled ? 0.5 : 1,
              pointerEvents: disabled ? 'none' : 'auto',
              width: '100%',
              maxWidth: '400px',
            })}`}
          >
            <Keyboard
              layout={{
                default: ['1 2 3', '4 5 6', '7 8 9', `${BKSP_KEY} 0`],
              }}
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
        ))}
    </div>
  )
}

export default KidNumberInput
