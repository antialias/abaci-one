'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../../styled-system/css'

/**
 * Join family by code page
 *
 * Flow:
 * 1. Validate the family code
 * 2. Show the child's name
 * 3. Confirm to link the child to the current user
 */
export default function JoinFamilyPage({ params }: { params: { code: string } }) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const code = params.code.toUpperCase()

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [playerName, setPlayerName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLink = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/family/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyCode: code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link child')
      }

      setPlayerName(data.player?.name || 'Child')
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link child')
      setStatus('error')
    }
  }, [code])

  const handleGoToPractice = useCallback(() => {
    router.push('/practice')
  }, [router])

  return (
    <div
      data-component="join-family-page"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bg: isDark ? 'gray.900' : 'gray.50',
        padding: '20px',
      })}
    >
      <div
        className={css({
          bg: isDark ? 'gray.800' : 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '450px',
          width: '100%',
          boxShadow: 'lg',
        })}
      >
        {status === 'success' ? (
          // Success state
          <div data-section="link-success" className={css({ textAlign: 'center' })}>
            <div className={css({ fontSize: '48px', marginBottom: '16px' })}>🎉</div>
            <h1
              className={css({
                fontSize: '24px',
                fontWeight: 'bold',
                color: isDark ? 'green.300' : 'green.600',
                marginBottom: '8px',
              })}
            >
              Successfully Linked!
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '24px',
              })}
            >
              You now have access to <strong>{playerName}</strong>&apos;s practice data.
            </p>
            <button
              type="button"
              onClick={handleGoToPractice}
              className={css({
                width: '100%',
                padding: '14px',
                bg: isDark ? 'green.600' : 'green.500',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              })}
            >
              Go to Practice
            </button>
          </div>
        ) : (
          // Confirmation form
          <>
            <h1
              className={css({
                fontSize: '24px',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.900',
                marginBottom: '8px',
              })}
            >
              Link Child to Your Account
            </h1>
            <p
              className={css({
                color: isDark ? 'gray.400' : 'gray.600',
                marginBottom: '24px',
              })}
            >
              Someone has shared access to their child with you. Click below to add them to your
              account.
            </p>

            {/* Code display */}
            <div
              className={css({
                padding: '16px',
                bg: isDark ? 'purple.900/30' : 'purple.50',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: isDark ? 'purple.700' : 'purple.200',
                marginBottom: '24px',
                textAlign: 'center',
              })}
            >
              <span
                className={css({
                  color: isDark ? 'gray.400' : 'gray.500',
                  fontSize: '14px',
                })}
              >
                Family Code:
              </span>
              <div
                className={css({
                  fontFamily: 'monospace',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  color: isDark ? 'purple.300' : 'purple.600',
                  marginTop: '4px',
                })}
              >
                {code}
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div
                className={css({
                  padding: '12px 16px',
                  bg: isDark ? 'red.900/30' : 'red.50',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isDark ? 'red.700' : 'red.200',
                  marginBottom: '16px',
                })}
              >
                <p
                  className={css({
                    color: isDark ? 'red.300' : 'red.600',
                    fontSize: '14px',
                  })}
                >
                  {error}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className={css({ display: 'flex', gap: '12px' })}>
              <button
                type="button"
                onClick={() => router.push('/practice')}
                disabled={status === 'loading'}
                className={css({
                  flex: 1,
                  padding: '14px',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLink}
                disabled={status === 'loading'}
                className={css({
                  flex: 2,
                  padding: '14px',
                  bg: isDark ? 'purple.600' : 'purple.500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: status === 'loading' ? 'wait' : 'pointer',
                  opacity: status === 'loading' ? 0.7 : 1,
                })}
              >
                {status === 'loading' ? 'Linking...' : 'Link Child to My Account'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
