'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { css } from '../../../../styled-system/css'
import { useTheme } from '@/contexts/ThemeContext'

export default function SignInPage() {
  const { resolvedTheme } = useTheme()
  const router = useRouter()
  const isDark = resolvedTheme === 'dark'
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState<'google' | 'email' | null>(null)

  const handleGoogleSignIn = async () => {
    setIsLoading('google')
    await signIn('google', { callbackUrl: '/' })
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setIsLoading('email')
    // Use redirect: false to avoid NextAuth's server-side redirect
    // which uses the internal localhost:3000 origin behind the proxy
    const result = await signIn('nodemailer', {
      email: email.trim(),
      redirect: false,
      callbackUrl: '/',
    })
    if (result?.ok) {
      router.push('/auth/verify-request')
    } else {
      setIsLoading(null)
    }
  }

  return (
    <main
      data-component="signin-page"
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
        })}
      >
        {/* Branding */}
        <div className={css({ textAlign: 'center', marginBottom: '2rem' })}>
          <h1
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'white' : 'gray.900',
              marginBottom: '0.5rem',
            })}
          >
            Abaci One
          </h1>
          <p
            className={css({
              fontSize: '0.875rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            Sign in to access your students and practice data from any device
          </p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading !== null}
          data-action="google-signin"
          className={css({
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
            backgroundColor: isDark ? 'gray.700' : 'white',
            color: isDark ? 'white' : 'gray.700',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              backgroundColor: isDark ? 'gray.600' : 'gray.50',
              borderColor: isDark ? 'gray.500' : 'gray.400',
            },
            _disabled: {
              opacity: 0.6,
              cursor: 'not-allowed',
            },
          })}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          {isLoading === 'google' ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {/* Divider */}
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            margin: '1.5rem 0',
          })}
        >
          <div
            className={css({
              flex: 1,
              height: '1px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
            })}
          />
          <span
            className={css({
              fontSize: '0.8125rem',
              color: isDark ? 'gray.500' : 'gray.400',
              fontWeight: 500,
            })}
          >
            or
          </span>
          <div
            className={css({
              flex: 1,
              height: '1px',
              backgroundColor: isDark ? 'gray.700' : 'gray.200',
            })}
          />
        </div>

        {/* Email Sign In */}
        <form onSubmit={handleEmailSignIn}>
          <label
            htmlFor="email"
            className={css({
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isDark ? 'gray.300' : 'gray.700',
              marginBottom: '0.375rem',
            })}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            data-element="email-input"
            className={css({
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              backgroundColor: isDark ? 'gray.700' : 'white',
              color: isDark ? 'white' : 'gray.900',
              fontSize: '0.9375rem',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              _focus: {
                borderColor: 'purple.500',
              },
              _placeholder: {
                color: isDark ? 'gray.500' : 'gray.400',
              },
            })}
          />
          <button
            type="submit"
            disabled={isLoading !== null || !email.trim()}
            data-action="email-signin"
            className={css({
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'purple.600',
              color: 'white',
              fontSize: '0.9375rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              _hover: {
                backgroundColor: 'purple.700',
              },
              _disabled: {
                opacity: 0.6,
                cursor: 'not-allowed',
              },
            })}
          >
            {isLoading === 'email' ? 'Sending link...' : 'Send magic link'}
          </button>
        </form>

        {/* Continue as guest */}
        <div className={css({ textAlign: 'center', marginTop: '1.5rem' })}>
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
