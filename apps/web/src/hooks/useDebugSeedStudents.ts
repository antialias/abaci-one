'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { debugKeys } from '@/lib/queryKeys'
import type { ProfileInfo, ProfileCategory } from '@/lib/seed/types'

// ── Query types ────────────────────────────────────────────────────────────────

interface SeedProfilesResponse {
  profiles: ProfileInfo[]
  categories: ProfileCategory[]
}

interface EmbeddingStatus {
  cached: boolean
  stale: boolean
  profileCount: number
  cachedAt: string | null
}

interface SeededStudentInfo {
  playerId: string
  seededAt: string
}

interface SearchResult {
  name: string
  similarity: number
}

// ── Queries ────────────────────────────────────────────────────────────────────

/** Fetch available seed profiles */
export function useSeedProfiles() {
  return useQuery({
    queryKey: debugKeys.seedProfiles(),
    queryFn: async (): Promise<SeedProfilesResponse> => {
      const res = await api('debug/seed-students')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })
}

/** Fetch embedding status for semantic search */
export function useEmbeddingStatus() {
  return useQuery({
    queryKey: debugKeys.seedEmbeddingStatus(),
    queryFn: async (): Promise<EmbeddingStatus> => {
      const res = await api('debug/seed-students/embeddings')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
  })
}

/** Fetch previously-seeded students */
export function useSeededStudents() {
  return useQuery({
    queryKey: debugKeys.seededStudents(),
    queryFn: async (): Promise<Record<string, SeededStudentInfo>> => {
      const res = await api('debug/seed-students/seeded')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.seeded ?? {}
    },
  })
}

/** Semantic search for profiles (only enabled when query is >= 3 chars) */
export function useSeedProfileSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: debugKeys.seedSearch(trimmed),
    queryFn: async (): Promise<Map<string, number>> => {
      const res = await api(`debug/seed-students/search?q=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const map = new Map<string, number>()
      for (const r of (data.results ?? []) as SearchResult[]) {
        map.set(r.name, r.similarity)
      }
      return map
    },
    enabled: trimmed.length >= 3,
    // Keep previous results visible while refetching a new query
    placeholderData: (prev) => prev,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/** Regenerate search embeddings */
export function useRegenerateEmbeddings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<EmbeddingStatus> => {
      const res = await api('debug/seed-students/embeddings', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.setQueryData(debugKeys.seedEmbeddingStatus(), data)
    },
  })
}

/** Start seeding students (returns a background task ID) */
export function useSeedStudents() {
  return useMutation({
    mutationFn: async (
      profileNames: string[]
    ): Promise<{ taskId: string; profileCount: number }> => {
      const res = await api('debug/seed-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: profileNames }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
  })
}

/** Create a debug practice session */
export function useCreateDebugPracticeSession() {
  return useMutation({
    mutationFn: async (params: {
      preset: string
      setupOnly: boolean
    }): Promise<{
      setupOnly?: boolean
      playerId?: string
      playerName?: string
      redirectUrl?: string
    }> => {
      const res = await api('debug/practice-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
  })
}

/** Fetch build info */
export function useBuildInfo() {
  return useQuery({
    queryKey: debugKeys.buildInfo(),
    queryFn: async (): Promise<Record<string, unknown>> => {
      const res = await fetch('/api/build-info')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })
}

/** Sync billing from Stripe */
export function useBillingSync() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<{ sessionId: string }> => {
      const res = await api('debug/billing-sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    },
    onSuccess: () => {
      // billingKeys is imported in the component that uses this
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
  })
}

/** Reset billing subscription */
export function useBillingReset() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const res = await api('debug/billing-reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] })
    },
  })
}
