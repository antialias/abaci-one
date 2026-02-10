'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { css } from '../../../../styled-system/css'
import { useTheme } from '@/contexts/ThemeContext'

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Server configuration error',
    description:
      'There is a problem with the authentication configuration. Please try again later or contact support.',
  },
  AccessDenied: {
    title: 'Access denied',
    description: 'You do not have permission to sign in. Please try a different account.',
  },
  Verification: {
    title: 'Link expired',
    description:
      'The sign-in link has expired or has already been used. Please request a new one.',
  },
  Default: {
    title: 'Something went wrong',
    description: 'An unexpected error occurred during sign-in. Please try again.',
  },
}

function ErrorContent() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const searchParams = useSearchParams()
  const errorCode = searchParams.get('error') ?? 'Default'
  const { title, description } = errorMessages[errorCode] ?? errorMessages.Default

  return (
    <main
      data-component="auth-error-page"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? 'gray.900' : 'gray.50',
        padding: '1rem',
      })}
    >
      <div
        className={css({
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          borderRadius: '16px',
          backgroundColor: isDark ? 'gray.800' : 'white',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          boxShadow: isDark
            ? '0 8px 24px rgba(0, 0, 0, 0.4)'
            : '0 8px 24px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        })}
      >
        <div
          className={css({
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            backgroundColor: isDark ? 'red.900/30' : 'red.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          })}
        >
          &#x26A0;
        </div>

        <h1
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.900',
            marginBottom: '0.75rem',
          })}
        >
          {title}
        </h1>

        <p
          className={css({
            fontSize: '0.9375rem',
            color: isDark ? 'gray.400' : 'gray.600',
            lineHeight: '1.5',
            marginBottom: '1.5rem',
          })}
        >
          {description}
        </p>

        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          })}
        >
          <Link
            href="/auth/signin"
            data-action="try-again"
            className={css({
              display: 'block',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'purple.600',
              color: 'white',
              fontSize: '0.9375rem',
              fontWeight: 500,
              textDecoration: 'none',
              textAlign: 'center',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: 'purple.700',
              },
            })}
          >
            Try signing in again
          </Link>

          <Link
            href="/"
            data-action="continue-as-guest"
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.500',
              textDecoration: 'none',
              _hover: {
                color: isDark ? 'gray.300' : 'gray.700',
                textDecoration: 'underline',
              },
            })}
          >
            Continue as guest
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
