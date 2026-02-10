'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { css } from '../../../styled-system/css'
import { useTheme } from '@/contexts/ThemeContext'
import { Z_INDEX } from '@/constants/zIndex'

/**
 * User menu component for the navigation bar.
 *
 * Shows:
 * - Loading: skeleton placeholder
 * - Authenticated: avatar + name with dropdown (sign out)
 * - Guest/unauthenticated: "Sign In" button
 */
export function UserMenu() {
  const { data: session, status } = useSession()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Loading state
  if (status === 'loading') {
    return (
      <div
        data-element="user-menu-skeleton"
        className={css({
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.5)',
          animation: 'pulse 2s infinite',
        })}
      />
    )
  }

  // Authenticated user
  if (status === 'authenticated' && session?.user) {
    const user = session.user
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            data-element="user-menu-trigger"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '4px 8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease',
              _hover: {
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
              },
            })}
          >
            {user.image ? (
              <img
                src={user.image}
                alt={user.name ?? 'User'}
                referrerPolicy="no-referrer"
                className={css({
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                })}
              />
            ) : (
              <div
                className={css({
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'purple.600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                })}
              >
                {(user.name ?? user.email ?? '?')[0].toUpperCase()}
              </div>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="bottom"
            align="end"
            sideOffset={8}
            className={css({
              background: isDark
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.97), rgba(31, 41, 55, 0.97))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(249, 250, 251, 0.97))',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '8px',
              boxShadow: isDark
                ? '0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)'
                : '0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.2)',
              minWidth: '200px',
              zIndex: Z_INDEX.TOOLTIP,
            })}
          >
            {/* User info */}
            <div
              className={css({
                padding: '8px 12px',
                marginBottom: '4px',
              })}
            >
              {user.name && (
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: isDark ? 'white' : 'gray.900',
                  })}
                >
                  {user.name}
                </div>
              )}
              {user.email && (
                <div
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginTop: '2px',
                  })}
                >
                  {user.email}
                </div>
              )}
            </div>

            <DropdownMenu.Separator
              className={css({
                height: '1px',
                background: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 0.8)',
                margin: '4px 0',
              })}
            />

            <DropdownMenu.Item
              data-action="sign-out"
              onSelect={() => signOut({ callbackUrl: '/' })}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: isDark ? 'gray.300' : 'gray.700',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease',
                _hover: {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                  color: isDark ? 'red.300' : 'red.600',
                },
              })}
            >
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  // Guest / unauthenticated
  return (
    <Link
      href="/auth/signin"
      data-action="sign-in"
      className={css({
        display: 'flex',
        alignItems: 'center',
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: 'rgba(196, 181, 253, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        _hover: {
          backgroundColor: 'rgba(139, 92, 246, 0.35)',
          color: 'white',
        },
      })}
    >
      Sign In
    </Link>
  )
}
