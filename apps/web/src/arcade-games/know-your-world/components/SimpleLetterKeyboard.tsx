'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import { css } from '@styled/css'

interface SimpleLetterKeyboardProps {
  /** Whether to show uppercase or lowercase letters */
  uppercase: boolean
  /** Called when a letter is pressed */
  onKeyPress: (letter: string) => void
  /** Whether the keyboard is in dark mode */
  isDark?: boolean
  /** Force show keyboard even on non-touch devices (for testing/storybook) */
  forceShow?: boolean
}

/**
 * Hook to detect if the device is primarily touch-based (mobile/tablet)
 * Returns true only for devices where touch is the primary input method
 */
export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    // Check if device is primarily touch-based
    // 1. Has touch capability
    // 2. Is a mobile/tablet device (no fine pointer like mouse)
    const checkTouchDevice = () => {
      const hasTouchCapability =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
        navigator.msMaxTouchPoints > 0

      // Check if the device has no fine pointer (mouse)
      // This helps distinguish touch-only devices from laptops with touchscreens
      const hasNoFinePointer = !window.matchMedia('(pointer: fine)').matches

      // Also check for coarse pointer (finger/touch)
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches

      setIsTouchDevice(hasTouchCapability && (hasNoFinePointer || hasCoarsePointer))
    }

    checkTouchDevice()

    // Re-check on resize (in case device mode changes, e.g., responsive testing)
    window.addEventListener('resize', checkTouchDevice)
    return () => window.removeEventListener('resize', checkTouchDevice)
  }, [])

  return isTouchDevice
}

/**
 * A simple on-screen keyboard for mobile devices.
 * Shows only letters (no numbers, no shift, no special keys).
 * Matches the case of the displayed region name.
 * Only renders on touch-based devices (mobile/tablet).
 */
export function SimpleLetterKeyboard({
  uppercase,
  onKeyPress,
  isDark = false,
  forceShow = false,
}: SimpleLetterKeyboardProps) {
  const keyboardRef = useRef<any>(null)
  const isTouchDevice = useIsTouchDevice()

  // Define a letters-only layout (no space bar - region names don't have spaces in first 3 chars)
  const layout = {
    default: uppercase
      ? ['Q W E R T Y U I O P', 'A S D F G H J K L', 'Z X C V B N M']
      : ['q w e r t y u i o p', 'a s d f g h j k l', 'z x c v b n m'],
  }

  const handleKeyPress = useCallback(
    (button: string) => {
      onKeyPress(button)
    },
    [onKeyPress]
  )

  // Prevent keyboard from stealing focus and causing issues
  useEffect(() => {
    // The keyboard should not focus anything
    const keyboard = keyboardRef.current
    if (keyboard?.keyboardDOM) {
      keyboard.keyboardDOM.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault()
      })
      keyboard.keyboardDOM.addEventListener('touchstart', (e: TouchEvent) => {
        e.preventDefault()
      })
    }
  }, [])

  // Don't render on non-touch devices (desktop with mouse/keyboard) unless forceShow is true
  if (!isTouchDevice && !forceShow) {
    return null
  }

  // Use actual CSS color values since Panda tokens don't work in nested selectors
  const colors = {
    keyboardBg: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    keyboardBorder: isDark ? '#475569' : '#cbd5e1',
    buttonBg: isDark ? '#334155' : '#f1f5f9',
    buttonColor: isDark ? '#ffffff' : '#0f172a',
    buttonBorder: isDark ? '#475569' : '#cbd5e1',
    buttonActiveBg: isDark ? '#2563eb' : '#3b82f6',
  }

  return (
    <div
      data-element="simple-letter-keyboard"
      className={css({
        width: '100%',
      })}
    >
      <style>{`
        .simple-letter-keyboard .simple-keyboard {
          background: ${colors.keyboardBg};
          border-radius: 12px;
          padding: 8px;
          border: 1px solid ${colors.keyboardBorder};
        }
        .simple-letter-keyboard .hg-button {
          height: 44px;
          border-radius: 6px;
          background: ${colors.buttonBg};
          color: ${colors.buttonColor};
          border: 1px solid ${colors.buttonBorder};
          font-size: 18px;
          font-weight: 600;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: all 0.1s ease;
          min-width: 28px;
          flex: 1;
          margin: 2px;
        }
        .simple-letter-keyboard .hg-button:active {
          background: ${colors.buttonActiveBg};
          color: white;
          transform: scale(0.95);
        }
        .simple-letter-keyboard .hg-row {
          display: flex;
          justify-content: center;
          margin-bottom: 2px;
        }
      `}</style>
      <div className="simple-letter-keyboard">
        <Keyboard
          keyboardRef={(r) => (keyboardRef.current = r)}
          layout={layout}
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
