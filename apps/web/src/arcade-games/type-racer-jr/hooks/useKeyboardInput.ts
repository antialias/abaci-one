'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseKeyboardInputOptions {
  /** Whether input is active */
  enabled: boolean
  /** Called when a letter key is pressed */
  onKeyPress: (letter: string) => void
}

/**
 * Listens for physical keyboard a-z input.
 * Returns whether a physical keyboard has been detected.
 */
export function useKeyboardInput({ enabled, onKeyPress }: UseKeyboardInputOptions) {
  const [hasPhysicalKeyboard, setHasPhysicalKeyboard] = useState(false)
  const onKeyPressRef = useRef(onKeyPress)
  onKeyPressRef.current = onKeyPress

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Only accept single letter keys a-z
      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        setHasPhysicalKeyboard(true)
        onKeyPressRef.current(e.key.toLowerCase())
      }
    },
    [enabled]
  )

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, handleKeyDown])

  return { hasPhysicalKeyboard }
}
