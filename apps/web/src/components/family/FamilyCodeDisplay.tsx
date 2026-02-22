'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [linkedParentCount, setLinkedParentCount] = useState<number>(0)
  const [maxParents, setMaxParents] = useState<number>(4)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
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
      setLinkedParentCount(data.linkedParentCount ?? 0)
      setMaxParents(data.maxParents ?? 4)
      setExpiresAt(data.expiresAt ?? null)
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
      setExpiresAt(data.expiresAt ?? null)
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
          aria-describedby={undefined}
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: Z_INDEX.TOOLTIP,
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            _focus: { outline: 'none' },
          })}
        >
          <Dialog.Title
            className={css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              borderWidth: 0,
            })}
          >
            Share Access to {playerName}
          </Dialog.Title>
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
              linkedParentCount={linkedParentCount}
              maxParents={maxParents}
              expiresAt={expiresAt}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Compute expiry status from an ISO expiry string
 */
function useExpiryStatus(expiresAt: string | null) {
  return useMemo(() => {
    if (!expiresAt) return { isExpired: false, daysRemaining: null, label: null }
    const expiry = new Date(expiresAt)
    const now = new Date()
    const msRemaining = expiry.getTime() - now.getTime()
    if (msRemaining <= 0) {
      return { isExpired: true, daysRemaining: 0, label: 'Expired' }
    }
    const days = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))
    const label = days === 1 ? 'Expires tomorrow' : `Expires in ${days}d`
    return { isExpired: false, daysRemaining: days, label }
  }, [expiresAt])
}

/**
 * Determine the severity color for the combined status line.
 * expired (red) > atCap or expiring ≤2 days (amber) > normal (gray)
 */
function useStatusSeverity({
  isExpired,
  daysRemaining,
  atCap,
}: {
  isExpired: boolean
  daysRemaining: number | null
  atCap: boolean
}): 'red' | 'amber' | 'gray' {
  if (isExpired) return 'red'
  if (atCap || (daysRemaining !== null && daysRemaining <= 2)) return 'amber'
  return 'gray'
}

const severityColors = {
  red: {
    light: { text: 'red.600', bg: 'red.50', border: 'red.200' },
    dark: { text: 'red.300', bg: 'red.900/40', border: 'red.700' },
  },
  amber: {
    light: { text: 'amber.700', bg: 'amber.50', border: 'amber.200' },
    dark: { text: 'amber.300', bg: 'amber.900/40', border: 'amber.700' },
  },
  gray: {
    light: { text: 'gray.600', bg: 'gray.50', border: 'gray.200' },
    dark: { text: 'gray.300', bg: 'gray.800', border: 'gray.700' },
  },
} as const

/**
 * Inner content when family code is loaded
 */
function FamilyCodeContent({
  code,
  playerName,
  onRegenerate,
  linkedParentCount,
  maxParents,
  expiresAt,
}: {
  code: string
  playerName: string
  onRegenerate: () => Promise<string>
  linkedParentCount: number
  maxParents: number
  expiresAt: string | null
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const shareCode = useShareCode({
    type: 'family',
    code,
    onRegenerate,
  })

  const atCap = linkedParentCount >= maxParents
  const { isExpired, daysRemaining, label: expiryLabel } = useExpiryStatus(expiresAt)
  const severity = useStatusSeverity({ isExpired, daysRemaining, atCap })
  const colors = severityColors[severity][isDark ? 'dark' : 'light']

  // Build the combined status text parts
  const statusParts: string[] = []
  statusParts.push(`${linkedParentCount}/${maxParents} parents`)
  if (expiryLabel) {
    statusParts.push(expiryLabel)
  }
  const statusText = statusParts.join(' · ')

  // Warning sub-text for critical states
  let warningText: string | null = null
  if (atCap) {
    warningText = 'Maximum parents reached'
  } else if (isExpired) {
    warningText = 'Regenerate the code to share again'
  }

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
          marginBottom: '12px',
        })}
      >
        Share this code or QR with another parent to give them equal access to {playerName}&apos;s
        practice data.
      </p>

      {/* Combined status line */}
      <div
        data-element="status-line"
        className={css({
          fontSize: '0.8125rem',
          textAlign: 'center',
          marginBottom: '10px',
          padding: '6px 12px',
          borderRadius: '8px',
          backgroundColor: colors.bg,
          color: colors.text,
          border: '1px solid',
          borderColor: colors.border,
          fontWeight: severity === 'red' ? 'bold' : 'normal',
        })}
      >
        {statusText}
        {warningText && (
          <div
            className={css({
              fontSize: '0.75rem',
              marginTop: '2px',
              fontWeight: 'medium',
            })}
          >
            {warningText}
          </div>
        )}
      </div>

      <div
        data-element="code-display-wrapper"
        className={css({
          opacity: isExpired ? 0.5 : 1,
          transition: 'opacity 0.2s',
        })}
      >
        <ShareCodePanel
          shareCode={shareCode}
          showRegenerate
          className={css({ padding: '0', border: 'none' })}
        />
      </div>
    </div>
  )
}
