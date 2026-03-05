import { useRef, useEffect, useCallback } from 'react'

/**
 * Keeps a chat input focused across send → stream → idle cycles.
 *
 * When `disabled={isStreaming}` kicks in, the browser blurs the input.
 * This hook snapshots whether the input had focus before the send,
 * then restores focus once streaming finishes.
 *
 * Also provides `preventFocusLoss` — put it on `onMouseDown` of buttons
 * (like the send button) that should not steal focus from the input.
 */
export function useChatInputFocus(
  inputRef: React.RefObject<HTMLInputElement | null>,
  isStreaming: boolean
) {
  const hadFocusRef = useRef(false)

  /** Call right before sending to snapshot the focus state. */
  const markFocusBeforeSend = useCallback(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      hadFocusRef.current = true
    }
  }, [inputRef])

  /** Put on `onMouseDown` of the send button to prevent it from stealing focus. */
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  // Restore focus when streaming ends
  useEffect(() => {
    if (!isStreaming && hadFocusRef.current) {
      hadFocusRef.current = false
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isStreaming, inputRef])

  return { markFocusBeforeSend, preventFocusLoss }
}
