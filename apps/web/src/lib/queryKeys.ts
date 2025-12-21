/**
 * Query key factories for React Query
 *
 * These are used for both server-side prefetching and client-side queries.
 * Kept in a separate file (not 'use client') so they can be imported by server components.
 */

// Player query keys
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: () => [...playerKeys.lists()] as const,
  listWithSkillData: () => [...playerKeys.all, 'listWithSkillData'] as const,
  detail: (id: string) => [...playerKeys.all, 'detail', id] as const,
}

// Curriculum query keys
export const curriculumKeys = {
  all: ['curriculum'] as const,
  detail: (playerId: string) => [...curriculumKeys.all, playerId] as const,
}

// Session plan query keys
export const sessionPlanKeys = {
  all: ['sessionPlans'] as const,
  lists: () => [...sessionPlanKeys.all, 'list'] as const,
  list: (playerId: string) => [...sessionPlanKeys.lists(), playerId] as const,
  active: (playerId: string) => [...sessionPlanKeys.all, 'active', playerId] as const,
  detail: (planId: string) => [...sessionPlanKeys.all, 'detail', planId] as const,
}

// Session history query keys (for paginated history)
export const sessionHistoryKeys = {
  all: ['sessionHistory'] as const,
  list: (playerId: string) => [...sessionHistoryKeys.all, playerId] as const,
}
