'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { isValidShareId } from '@/lib/generateShareId'

interface LoadShareCodeModalProps {
  isOpen: boolean
  onClose: () => void
  isDark: boolean
}

/**
 * Modal for entering a share code to load a shared worksheet
 *
 * Users can type in a 7-character share code (printed under QR codes on worksheets)
 * to load the shared worksheet configuration.
 */
export function LoadShareCodeModal({ isOpen, onClose, isDark }: LoadShareCodeModalProps) {
  const router = useRouter()
  const [shareCode, setShareCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-alphanumeric characters and convert to string
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7)
    setShareCode(value)
    setError(null)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Validate share code format
      if (!isValidShareId(shareCode)) {
        setError('Invalid share code. Share codes are 7 characters (letters and numbers).')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Check if the share exists
        const response = await fetch(`/api/worksheets/share/${shareCode}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Share code not found. Please check the code and try again.')
          } else {
            setError('Failed to load shared worksheet. Please try again.')
          }
          return
        }

        // Navigate to the shared worksheet page
        router.push(`/worksheets/shared/${shareCode}`)
        onClose()
      } catch (err) {
        console.error('Error loading share code:', err)
        setError('Failed to load shared worksheet. Please check your connection.')
      } finally {
        setIsLoading(false)
      }
    },
    [shareCode, router, onClose]
  )

  if (!isOpen) return null

  return (
    <div
      data-component="load-share-code-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        p: '4',
      })}
      onClick={onClose}
    >
      <div
        className={css({
          bg: isDark ? 'gray.800' : 'white',
          rounded: 'xl',
          shadow: 'xl',
          maxW: 'md',
          w: 'full',
          p: '6',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className={stack({ gap: '4' })}>
            {/* Header */}
            <div>
              <h2
                className={css({
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.100' : 'gray.900',
                  mb: '2',
                })}
              >
                Load Shared Worksheet
              </h2>
              <p
                className={css({
                  fontSize: 'md',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                Enter the 7-character share code printed under the QR code on a worksheet to load
                it.
              </p>
            </div>

            {/* Share Code Input */}
            <div>
              <label
                htmlFor="share-code-input"
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  color: isDark ? 'gray.300' : 'gray.700',
                  mb: '2',
                })}
              >
                Share Code
              </label>
              <input
                id="share-code-input"
                type="text"
                value={shareCode}
                onChange={handleInputChange}
                placeholder="e.g., k7mP2qR"
                autoComplete="off"
                autoFocus
                className={css({
                  w: 'full',
                  px: '4',
                  py: '3',
                  fontSize: 'xl',
                  fontFamily: 'mono',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  textTransform: 'none',
                  bg: isDark ? 'gray.900' : 'gray.50',
                  border: '2px solid',
                  borderColor: error
                    ? 'red.500'
                    : shareCode.length === 7
                      ? 'green.500'
                      : isDark
                        ? 'gray.600'
                        : 'gray.300',
                  rounded: 'lg',
                  color: isDark ? 'gray.100' : 'gray.900',
                  outline: 'none',
                  transition: 'all 0.2s',
                  _focus: {
                    borderColor: isDark ? 'brand.400' : 'brand.500',
                    boxShadow: `0 0 0 3px ${isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
                  },
                  _placeholder: {
                    color: isDark ? 'gray.500' : 'gray.400',
                    letterSpacing: '0.1em',
                  },
                })}
              />
              <div
                className={css({
                  mt: '2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                })}
              >
                <span
                  className={css({
                    fontSize: 'sm',
                    color: isDark ? 'gray.500' : 'gray.500',
                  })}
                >
                  {shareCode.length}/7 characters
                </span>
                {shareCode.length === 7 && !error && (
                  <span
                    className={css({
                      fontSize: 'sm',
                      color: 'green.500',
                    })}
                  >
                    ✓ Valid format
                  </span>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                className={css({
                  p: '3',
                  bg: isDark ? 'red.900/30' : 'red.50',
                  border: '1px solid',
                  borderColor: isDark ? 'red.700' : 'red.200',
                  rounded: 'lg',
                  color: isDark ? 'red.300' : 'red.600',
                  fontSize: 'sm',
                })}
              >
                {error}
              </div>
            )}

            {/* Help Text */}
            <div
              className={css({
                p: '4',
                bg: isDark ? 'gray.700/50' : 'blue.50',
                rounded: 'lg',
                fontSize: 'sm',
                color: isDark ? 'gray.300' : 'gray.700',
              })}
            >
              <strong>Where to find the share code:</strong>
              <ul className={css({ mt: '2', ml: '4', listStyle: 'disc' })}>
                <li>Look at the top-right corner of a printed worksheet</li>
                <li>The share code is printed below the QR code</li>
                <li>It's 7 characters: letters and numbers (e.g., k7mP2qR)</li>
              </ul>
            </div>

            {/* Actions */}
            <div
              className={css({
                display: 'flex',
                gap: '3',
                flexDirection: 'row-reverse',
                pt: '2',
              })}
            >
              <button
                type="submit"
                disabled={shareCode.length !== 7 || isLoading}
                className={css({
                  px: '6',
                  py: '3',
                  bg: shareCode.length === 7 ? 'brand.600' : isDark ? 'gray.600' : 'gray.300',
                  color: shareCode.length === 7 ? 'white' : isDark ? 'gray.400' : 'gray.500',
                  fontSize: 'md',
                  fontWeight: 'bold',
                  rounded: 'lg',
                  cursor: shareCode.length === 7 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  opacity: isLoading ? 0.7 : 1,
                  _hover: shareCode.length === 7 ? { bg: 'brand.700' } : {},
                })}
              >
                {isLoading ? 'Loading...' : 'Load Worksheet'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className={css({
                  px: '6',
                  py: '3',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  fontSize: 'md',
                  fontWeight: 'medium',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    bg: isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
