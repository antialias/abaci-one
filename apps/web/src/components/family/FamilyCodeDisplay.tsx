'use client'

import { useCallback, useEffect, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../styled-system/css'

interface FamilyCodeDisplayProps {
  playerId: string
  playerName: string
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal to display and manage a child's family code
 *
 * Parents can:
 * - View the family code
 * - Copy it to clipboard
 * - Regenerate it (invalidates old code)
 */
export function FamilyCodeDisplay({
  playerId,
  playerName,
  isOpen,
  onClose,
}: FamilyCodeDisplayProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [familyCode, setFamilyCode] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Fetch family code when modal opens
  const fetchFamilyCode = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/family/children/${playerId}/code`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch family code')
      }
      setFamilyCode(data.familyCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch family code')
    } finally {
      setIsLoading(false)
    }
  }, [playerId])

  // Reset state when playerId changes (different student)
  useEffect(() => {
    setFamilyCode(null)
    setError(null)
    setCopied(false)
  }, [playerId])

  // Fetch on open
  useEffect(() => {
    if (isOpen && !familyCode && !isLoading) {
      fetchFamilyCode()
    }
  }, [isOpen, familyCode, isLoading, fetchFamilyCode])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!familyCode) return
    try {
      await navigator.clipboard.writeText(familyCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = familyCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [familyCode])

  // Regenerate family code
  const handleRegenerate = useCallback(async () => {
    setIsRegenerating(true)
    setError(null)
    try {
      const response = await fetch(`/api/family/children/${playerId}/code`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate code')
      }
      setFamilyCode(data.familyCode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code')
    } finally {
      setIsRegenerating(false)
    }
  }, [playerId])

  if (!isOpen) return null

  return (
    <div
      data-component="family-code-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.MODAL + 100, // Above parent modals when nested
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      })}
      onClick={onClose}
    >
      <div
        className={css({
          backgroundColor: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.800',
            marginBottom: '8px',
          })}
        >
          Share Access to {playerName}
        </h2>
        <p
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.600',
            marginBottom: '20px',
          })}
        >
          Share this code with another parent to give them equal access to {playerName}&apos;s
          practice data.
        </p>

        {isLoading ? (
          <div
            className={css({
              textAlign: 'center',
              padding: '20px',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Loading...
          </div>
        ) : error ? (
          <div
            className={css({
              textAlign: 'center',
              padding: '20px',
              color: 'red.500',
            })}
          >
            {error}
          </div>
        ) : (
          <>
            {/* Family Code Display */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              })}
            >
              <div
                data-element="family-code"
                className={css({
                  flex: 1,
                  padding: '16px',
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  letterSpacing: '0.1em',
                  color: isDark ? 'green.400' : 'green.600',
                })}
              >
                {familyCode}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                data-action="copy-family-code"
                className={css({
                  padding: '12px 16px',
                  backgroundColor: copied
                    ? isDark
                      ? 'green.700'
                      : 'green.500'
                    : isDark
                      ? 'blue.700'
                      : 'blue.500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  _hover: {
                    backgroundColor: copied
                      ? isDark
                        ? 'green.600'
                        : 'green.600'
                      : isDark
                        ? 'blue.600'
                        : 'blue.600',
                  },
                })}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            {/* Instructions */}
            <p
              className={css({
                fontSize: '0.8125rem',
                color: isDark ? 'gray.500' : 'gray.500',
                marginBottom: '20px',
              })}
            >
              The other parent will enter this code on their device to link to {playerName}.
            </p>

            {/* Regenerate button */}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              data-action="regenerate-family-code"
              className={css({
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: isDark ? 'gray.400' : 'gray.500',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.300',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: isRegenerating ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'gray.700' : 'gray.100',
                },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
            >
              {isRegenerating ? 'Regenerating...' : 'Generate New Code'}
            </button>
            <p
              className={css({
                fontSize: '0.75rem',
                color: isDark ? 'gray.600' : 'gray.400',
                marginTop: '8px',
                textAlign: 'center',
              })}
            >
              Generating a new code will invalidate the old one
            </p>
          </>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          data-action="close-family-code-modal"
          className={css({
            position: 'absolute',
            top: '12px',
            right: '12px',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: isDark ? 'gray.500' : 'gray.400',
            fontSize: '20px',
            lineHeight: 1,
            _hover: {
              color: isDark ? 'gray.300' : 'gray.600',
            },
          })}
        >
          ×
        </button>
      </div>
    </div>
  )
}
