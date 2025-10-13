import { useCallback, useState } from 'react'

export interface UseClipboardOptions {
  /**
   * Timeout in milliseconds to reset the copied state
   * @default 1500
   */
  timeout?: number
}

export interface UseClipboardReturn {
  /**
   * Whether the text was recently copied
   */
  copied: boolean

  /**
   * Copy text to clipboard
   */
  copy: (text: string) => Promise<void>

  /**
   * Reset the copied state manually
   */
  reset: () => void
}

/**
 * Hook for copying text to clipboard with visual feedback
 *
 * @example
 * ```tsx
 * const { copied, copy } = useClipboard()
 *
 * <button onClick={() => copy('Hello!')}>
 *   {copied ? 'Copied!' : 'Copy'}
 * </button>
 * ```
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { timeout = 1500 } = options
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => {
          setCopied(false)
        }, timeout)
      } catch (error) {
        console.error('[useClipboard] Failed to copy to clipboard:', error)
      }
    },
    [timeout]
  )

  const reset = useCallback(() => {
    setCopied(false)
  }, [])

  return { copied, copy, reset }
}
