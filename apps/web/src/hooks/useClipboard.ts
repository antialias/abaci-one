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
   * Copy text to clipboard. Resolves true on success, false when the
   * clipboard refused (permissions, insecure context) — callers that need a
   * fallback affordance branch on it; existing callers ignore it.
   */
  copy: (text: string) => Promise<boolean>

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
        return true
      } catch (error) {
        console.error('[useClipboard] Failed to copy to clipboard:', error)
        return false
      }
    },
    [timeout]
  )

  const reset = useCallback(() => {
    setCopied(false)
  }, [])

  return { copied, copy, reset }
}
