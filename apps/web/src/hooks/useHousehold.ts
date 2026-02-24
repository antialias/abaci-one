'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { householdKeys } from '@/lib/queryKeys'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HouseholdSummary {
  id: string
  name: string
  ownerId: string
  role: 'owner' | 'member'
  memberCount: number
}

interface HouseholdMember {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  role: 'owner' | 'member'
  joinedAt: string
}

interface HouseholdDetail {
  id: string
  name: string
  ownerId: string
  createdAt: string
  members: HouseholdMember[]
}

export interface HouseholdSuggestion {
  userId: string
  name: string | null
  email: string | null
  image: string | null
  /** Names of shared children */
  sharedChildren: string[]
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchHouseholds(): Promise<{ households: HouseholdSummary[] }> {
  const res = await api('households')
  if (!res.ok) throw new Error('Failed to fetch households')
  return res.json()
}

async function fetchHouseholdDetail(
  id: string
): Promise<{ household: HouseholdDetail; suggestions: HouseholdSuggestion[] }> {
  const res = await api(`households/${id}`)
  if (!res.ok) throw new Error('Failed to fetch household')
  return res.json()
}

async function createHouseholdApi(
  name: string
): Promise<{ household: { id: string; name: string } }> {
  const res = await api('households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to create household')
  }
  return res.json()
}

async function addMemberApi(householdId: string, params: { userId?: string; email?: string }) {
  const res = await api(`households/${householdId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to add member')
  }
  return res.json()
}

async function removeMemberApi(householdId: string, userId: string) {
  const res = await api(`households/${householdId}/members/${userId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to remove member')
  }
  return res.json()
}

async function updateHouseholdApi(householdId: string, body: Record<string, unknown>) {
  const res = await api(`households/${householdId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update household')
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** List the current user's households */
export function useHouseholds() {
  return useQuery({
    queryKey: householdKeys.list(),
    queryFn: fetchHouseholds,
    select: (data) => data.households,
  })
}

/** Get a single household with full member details and suggestions */
export function useHousehold(id: string | undefined) {
  return useQuery({
    queryKey: id ? householdKeys.detail(id) : householdKeys.list(),
    queryFn: () => (id ? fetchHouseholdDetail(id) : Promise.reject('No id')),
    enabled: !!id,
    select: (data) => ({ ...data.household, suggestions: data.suggestions }),
  })
}

/** Mutations for household management */
export function useHouseholdMutations() {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: householdKeys.all })
  }

  const create = useMutation({
    mutationFn: (name: string) => createHouseholdApi(name),
    onSuccess: invalidateAll,
  })

  const addMember = useMutation({
    mutationFn: (params: { householdId: string; userId?: string; email?: string }) =>
      addMemberApi(params.householdId, {
        userId: params.userId,
        email: params.email,
      }),
    onSuccess: invalidateAll,
  })

  const removeMember = useMutation({
    mutationFn: (params: { householdId: string; userId: string }) =>
      removeMemberApi(params.householdId, params.userId),
    onSuccess: invalidateAll,
  })

  const rename = useMutation({
    mutationFn: (params: { householdId: string; name: string }) =>
      updateHouseholdApi(params.householdId, { name: params.name }),
    onSuccess: invalidateAll,
  })

  const transferOwnership = useMutation({
    mutationFn: (params: { householdId: string; newOwnerId: string }) =>
      updateHouseholdApi(params.householdId, { newOwnerId: params.newOwnerId }),
    onSuccess: invalidateAll,
  })

  return { create, addMember, removeMember, rename, transferOwnership }
}
