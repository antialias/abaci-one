'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useState } from 'react'
import { ShareCodePanel } from '@/components/common'
import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import { useShareCode } from '@/hooks/useShareCode'
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
 * - View the family code with QR
 * - Copy code or link to clipboard
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
  }, [playerId])

  // Fetch on open
  useEffect(() => {
    if (isOpen && !familyCode && !isLoading) {
      fetchFamilyCode()
    }
  }, [isOpen, familyCode, isLoading, fetchFamilyCode])

  // Regenerate family code
  const handleRegenerate = useCallback(async () => {
    try {
      const response = await fetch(`/api/family/children/${playerId}/code`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate code')
      }
      setFamilyCode(data.familyCode)
      return data.familyCode
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate code')
      throw err
    }
  }, [playerId])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="family-code-modal-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            zIndex: Z_INDEX.TOOLTIP, // 15000 - above modals (10001) but below toasts (20000)
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          })}
        />
        <Dialog.Content
          data-component="family-code-modal"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: Z_INDEX.TOOLTIP,
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            _focus: { outline: 'none' },
          })}
        >
          {/* Close button */}
          <Dialog.Close asChild>
            <button
              type="button"
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
          </Dialog.Close>

          {isLoading ? (
            <div
              className={css({
                textAlign: 'center',
                padding: '40px 20px',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              Loading...
            </div>
          ) : error ? (
            <div
              className={css({
                textAlign: 'center',
                padding: '40px 20px',
                color: 'red.500',
              })}
            >
              {error}
            </div>
          ) : familyCode ? (
            <FamilyCodeContent
              code={familyCode}
              playerName={playerName}
              onRegenerate={handleRegenerate}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Inner content when family code is loaded
 */
function FamilyCodeContent({
  code,
  playerName,
  onRegenerate,
}: {
  code: string
  playerName: string
  onRegenerate: () => Promise<string>
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const shareCode = useShareCode({
    type: 'family',
    code,
    onRegenerate,
  })

  return (
    <div data-section="family-code-content">
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
        Share this code or QR with another parent to give them equal access to {playerName}&apos;s
        practice data.
      </p>

      <ShareCodePanel
        shareCode={shareCode}
        showRegenerate
        className={css({ padding: '0', border: 'none' })}
      />

      {/* Regeneration note */}
      <p
        className={css({
          fontSize: '0.75rem',
          color: isDark ? 'gray.600' : 'gray.400',
          marginTop: '12px',
          textAlign: 'center',
        })}
      >
        Generating a new code will invalidate the old one
      </p>
    </div>
  )
}
