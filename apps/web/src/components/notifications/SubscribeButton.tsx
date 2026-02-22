'use client'

import { useState } from 'react'
import { css } from '../../../styled-system/css'
import { useNotificationSubscription } from '@/hooks/useNotificationSubscription'

interface SubscribeButtonProps {
  playerId: string
  playerName: string
  userId?: string
  /** Required for anonymous (share-link) subscriptions */
  shareToken?: string
  /** Variant controls size and styling */
  variant?: 'prominent' | 'subtle'
}

/**
 * Subscribe button for practice notifications.
 *
 * - Authenticated users: one-click subscribe (push + in-app)
 * - Anonymous users: email input + optional push permission
 */
export function SubscribeButton({
  playerId,
  playerName,
  userId,
  shareToken,
  variant = 'prominent',
}: SubscribeButtonProps) {
  const {
    isSubscribed,
    subscriptions,
    subscribe,
    unsubscribe,
    subscribePending,
    unsubscribePending,
    subscribeError,
    pushSupported,
  } = useNotificationSubscription(playerId, userId)

  const [email, setEmail] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)

  const isAuthenticated = !!userId

  if (isSubscribed) {
    const sub = subscriptions[0]
    return (
      <div
        data-component="subscribe-button"
        data-state="subscribed"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        })}
      >
        <span
          className={css({
            fontSize: variant === 'subtle' ? '0.8125rem' : '0.875rem',
            color: 'green.600',
            _dark: { color: 'green.400' },
          })}
        >
          Subscribed
        </span>
        <button
          type="button"
          onClick={() => sub && unsubscribe(sub.id)}
          disabled={unsubscribePending}
          data-action="unsubscribe"
          className={css({
            fontSize: variant === 'subtle' ? '0.75rem' : '0.8125rem',
            color: 'gray.500',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            _hover: { color: 'gray.700', _dark: { color: 'gray.300' } },
          })}
        >
          {unsubscribePending ? 'Removing...' : 'Unsubscribe'}
        </button>
      </div>
    )
  }

  // Authenticated: one-click subscribe
  if (isAuthenticated) {
    return (
      <div data-component="subscribe-button" data-state="not-subscribed">
        <button
          type="button"
          onClick={() => subscribe({ enablePush: pushSupported })}
          disabled={subscribePending}
          data-action="subscribe"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding:
              variant === 'subtle' ? '0.375rem 0.75rem' : '0.625rem 1.25rem',
            fontSize: variant === 'subtle' ? '0.8125rem' : '0.9375rem',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'blue.500',
            color: 'white',
            transition: 'background-color 0.2s',
            _hover: { backgroundColor: 'blue.600' },
            _disabled: {
              opacity: 0.6,
              cursor: 'not-allowed',
            },
          })}
        >
          {subscribePending
            ? 'Subscribing...'
            : `Notify me when ${playerName} practices`}
        </button>
        {subscribeError && (
          <p
            className={css({
              fontSize: '0.8125rem',
              color: 'red.500',
              marginTop: '0.5rem',
            })}
          >
            {subscribeError.message}
          </p>
        )}
      </div>
    )
  }

  // Anonymous: email input + subscribe
  return (
    <div data-component="subscribe-button" data-state="anonymous">
      {!showEmailInput ? (
        <button
          type="button"
          onClick={() => setShowEmailInput(true)}
          data-action="show-email-input"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding:
              variant === 'subtle' ? '0.375rem 0.75rem' : '0.625rem 1.25rem',
            fontSize: variant === 'subtle' ? '0.8125rem' : '0.9375rem',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'blue.500',
            color: 'white',
            transition: 'background-color 0.2s',
            _hover: { backgroundColor: 'blue.600' },
          })}
        >
          Get notified next time
        </button>
      ) : (
        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '360px',
          })}
        >
          <p
            className={css({
              fontSize: '0.875rem',
              color: 'text.secondary',
            })}
          >
            Get notified when {playerName} practices:
          </p>
          <div className={css({ display: 'flex', gap: '0.5rem' })}>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-element="email-input"
              className={css({
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: 'gray.300',
                _dark: {
                  borderColor: 'gray.600',
                  backgroundColor: 'gray.800',
                  color: 'white',
                },
              })}
            />
            <button
              type="button"
              onClick={() =>
                subscribe({
                  email,
                  shareToken,
                  enablePush: pushSupported,
                })
              }
              disabled={subscribePending || !email}
              data-action="subscribe-anonymous"
              className={css({
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'blue.500',
                color: 'white',
                _hover: { backgroundColor: 'blue.600' },
                _disabled: {
                  opacity: 0.6,
                  cursor: 'not-allowed',
                },
              })}
            >
              {subscribePending ? '...' : 'Subscribe'}
            </button>
          </div>
          {subscribeError && (
            <p className={css({ fontSize: '0.8125rem', color: 'red.500' })}>
              {subscribeError.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
