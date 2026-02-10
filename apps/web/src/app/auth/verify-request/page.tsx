'use client'

import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { useTheme } from '@/contexts/ThemeContext'

export default function VerifyRequestPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <main
      data-component="verify-request-page"
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
            backgroundColor: isDark ? 'purple.900/30' : 'purple.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          })}
        >
          &#x2709;
        </div>

        <h1
          className={css({
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: isDark ? 'white' : 'gray.900',
            marginBottom: '0.75rem',
          })}
        >
          Check your email
        </h1>

        <p
          className={css({
            fontSize: '0.9375rem',
            color: isDark ? 'gray.400' : 'gray.600',
            lineHeight: '1.5',
            marginBottom: '1.5rem',
          })}
        >
          We sent you a sign-in link. Click the link in your email to continue.
        </p>

        <Link
          href="/"
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'purple.400' : 'purple.600',
            textDecoration: 'none',
            fontWeight: 500,
            _hover: {
              textDecoration: 'underline',
            },
          })}
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
