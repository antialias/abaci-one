'use client'

import { useCallback } from 'react'
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

export function useNotificationSubscription(
  playerId: string | undefined,
  userId: string | undefined
) {
  const queryClient = useQueryClient()

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

  const isSubscribed = (subscriptionsQuery.data?.length ?? 0) > 0

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
        // Request notification permission
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          const registration = await registerServiceWorker()
          if (registration) {
            const browserSub = await subscribeToPush(registration)
            pushSub = pushSubscriptionToJson(browserSub)
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
    onSuccess: () => {
      if (playerId) {
        queryClient.invalidateQueries({
          queryKey: notificationSubscriptionKeys.list(playerId),
        })
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
      if (playerId) {
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
    subscriptions: subscriptionsQuery.data ?? [],
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
