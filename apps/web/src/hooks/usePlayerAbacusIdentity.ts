'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AbacusIdentity } from '@/db/schema/player-abacus-identity'
import { api } from '@/lib/queryClient'
import { playerAbacusIdentityKeys } from '@/lib/queryKeys'

interface AbacusIdentityResponse {
  identity: AbacusIdentity
}

async function fetchAbacusIdentity(playerId: string): Promise<AbacusIdentity> {
  const res = await api(`players/${playerId}/abacus-identity`)
  if (!res.ok) throw new Error('Failed to fetch abacus identity')
  const data: AbacusIdentityResponse = await res.json()
  return data.identity
}

async function saveAbacusIdentity(
  playerId: string,
  identity: AbacusIdentity
): Promise<AbacusIdentity> {
  const res = await api(`players/${playerId}/abacus-identity`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity }),
  })
  if (!res.ok) throw new Error('Failed to save abacus identity')
  const data: AbacusIdentityResponse = await res.json()
  return data.identity
}

/**
 * Hook: Fetch a player's "my abacus" identity (server answers the stock
 * defaults when the player has no saved row)
 */
export function usePlayerAbacusIdentity(playerId: string | null) {
  return useQuery({
    queryKey: playerAbacusIdentityKeys.detail(playerId ?? 'anonymous'),
    queryFn: () => fetchAbacusIdentity(playerId as string),
    enabled: Boolean(playerId),
    // Identity changes only via an explicit save — keep stale longer
    staleTime: 1000 * 60 * 30,
  })
}

/**
 * Hook: Save a player's abacus identity with optimistic update
 */
export function useSavePlayerAbacusIdentity(playerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (identity: AbacusIdentity) => saveAbacusIdentity(playerId, identity),
    onMutate: async (identity) => {
      await queryClient.cancelQueries({
        queryKey: playerAbacusIdentityKeys.detail(playerId),
      })

      const previous = queryClient.getQueryData<AbacusIdentity>(
        playerAbacusIdentityKeys.detail(playerId)
      )

      queryClient.setQueryData(playerAbacusIdentityKeys.detail(playerId), identity)

      return { previous }
    },
    onError: (_err, _identity, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(playerAbacusIdentityKeys.detail(playerId), context.previous)
      }
    },
    onSettled: (savedIdentity) => {
      if (savedIdentity) {
        queryClient.setQueryData(playerAbacusIdentityKeys.detail(playerId), savedIdentity)
      }
    },
  })
}
