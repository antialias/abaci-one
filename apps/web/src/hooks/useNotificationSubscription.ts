'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { notificationSubscriptionKeys } from '@/lib/queryKeys'
import {
  registerServiceWorker,
  subscribeToPush,
  pushSubscriptionToJson,
} from '@/lib/notifications/register-sw'
import type { WebPushSubscriptionJson } from '@/db/schema'

interface Subscription {
  id: string
  playerId: string
  userId: string | null
  email: string | null
  pushSubscription: WebPushSubscriptionJson | null
  channels: { webPush?: boolean; email?: boolean; inApp?: boolean }
  status: string
}

interface SubscribeOptions {
  email?: string
  shareToken?: string
  enablePush?: boolean
}

function getStorageKey(playerId: string) {
  return `notification-sub:${playerId}`
}

function readLocalSub(playerId: string): Subscription | null {
  try {
    const raw = localStorage.getItem(getStorageKey(playerId))
    if (!raw) return null
    return JSON.parse(raw) as Subscription
  } catch {
    return null
  }
}

export function useNotificationSubscription(
  playerId: string | undefined,
  userId: string | undefined
) {
  const queryClient = useQueryClient()

  // Local state for anonymous subscriptions (can't query the API without auth)
  // Initialize from localStorage so anonymous subs survive page refresh
  const [localSubscription, setLocalSubscription] = useState<Subscription | null>(() => {
    if (userId || !playerId) return null
    if (typeof window === 'undefined') return null
    return readLocalSub(playerId)
  })

  // Fetch existing subscriptions (authenticated only)
  const subscriptionsQuery = useQuery({
    queryKey: notificationSubscriptionKeys.list(playerId ?? ''),
    queryFn: async (): Promise<Subscription[]> => {
      const res = await api(`notifications/subscriptions?playerId=${playerId}`)
      if (!res.ok) return []
      const data = await res.json()
      return data.subscriptions ?? []
    },
    enabled: !!playerId && !!userId,
    staleTime: 60 * 1000,
  })

  const serverSubscriptions = subscriptionsQuery.data ?? []
  const subscriptions = localSubscription ? [localSubscription] : serverSubscriptions
  const isSubscribed = subscriptions.length > 0

  // Check browser push support
  const pushSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const subscribeMutation = useMutation({
    mutationFn: async (options: SubscribeOptions) => {
      let pushSub: WebPushSubscriptionJson | undefined

      if (options.enablePush && pushSupported) {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          const registration = await registerServiceWorker()
          if (registration) {
            const keyRes = await api('notifications/vapid-public-key')
            const { vapidPublicKey } = await keyRes.json()
            if (!vapidPublicKey) {
              console.warn(
                '[useNotificationSubscription] VAPID public key not configured on server; skipping push subscription'
              )
            } else {
              const browserSub = await subscribeToPush(registration, vapidPublicKey)
              pushSub = pushSubscriptionToJson(browserSub)
            }
          }
        }
      }

      const body: Record<string, unknown> = {
        playerId,
        channels: {
          webPush: !!pushSub,
          email: !!options.email,
          inApp: !!userId,
        },
      }

      if (pushSub) body.pushSubscription = pushSub
      if (options.email) body.email = options.email
      if (options.shareToken) body.shareToken = options.shareToken

      const res = await api('notifications/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to subscribe' }))
        throw new Error(err.error || 'Failed to subscribe')
      }

      return res.json()
    },
    onSuccess: (data) => {
      if (userId && playerId) {
        // Authenticated: invalidate the server query
        queryClient.invalidateQueries({
          queryKey: notificationSubscriptionKeys.list(playerId),
        })
      } else if (data?.subscription) {
        // Anonymous: track locally since we can't query the API
        setLocalSubscription(data.subscription)
        // Persist to localStorage so it survives page refresh
        if (playerId) {
          try {
            localStorage.setItem(getStorageKey(playerId), JSON.stringify(data.subscription))
          } catch {
            // localStorage may be unavailable
          }
        }
      }
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const res = await api(`notifications/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to unsubscribe')
      return res.json()
    },
    onSuccess: () => {
      setLocalSubscription(null)
      // Clear localStorage for anonymous subscriptions
      if (playerId) {
        try {
          localStorage.removeItem(getStorageKey(playerId))
        } catch {
          // localStorage may be unavailable
        }
        queryClient.invalidateQueries({
          queryKey: notificationSubscriptionKeys.list(playerId),
        })
      }
    },
  })

  const subscribe = useCallback(
    (options: SubscribeOptions = {}) => subscribeMutation.mutate(options),
    [subscribeMutation]
  )

  const unsubscribe = useCallback(
    (subscriptionId: string) => unsubscribeMutation.mutate(subscriptionId),
    [unsubscribeMutation]
  )

  return {
    subscriptions,
    isSubscribed,
    isLoading: subscriptionsQuery.isLoading,
    pushSupported,
    subscribe,
    unsubscribe,
    subscribePending: subscribeMutation.isPending,
    unsubscribePending: unsubscribeMutation.isPending,
    subscribeError: subscribeMutation.error,
  }
}
