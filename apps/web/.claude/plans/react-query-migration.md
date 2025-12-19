# Plan: Migrate Dashboard to React Query

## Problem Statement

`DashboardClient.tsx` has 3 direct `fetch()` calls that bypass React Query:

1. `handleStartOver` - abandons session
2. `handleSaveManualSkills` - sets mastered skills
3. `handleRefreshSkill` - refreshes skill recency

These use `router.refresh()` to update data, but this doesn't work reliably because:

- `router.refresh()` re-runs server components but doesn't guarantee client state updates
- The React Query cache is not invalidated, so other components see stale data
- There's a race condition between navigation and data refresh

## Root Cause

`DashboardClient` receives data as **server-side props** and doesn't use React Query hooks:

```typescript
// Current: Props-based data
export function DashboardClient({
  activeSession,  // Server prop - stale after mutations
  skills,         // Server prop - stale after mutations
  ...
}: DashboardClientProps) {
```

Meanwhile, React Query mutations exist in `useSessionPlan.ts` and `usePlayerCurriculum.ts` but aren't used here.

## Solution: Use React Query Hooks with Server Props as Initial Data

### Pattern: Hydrate React Query from Server Props

```typescript
// New: Use hooks with server props as initial data
export function DashboardClient({
  activeSession: initialActiveSession,
  skills: initialSkills,
  ...
}: DashboardClientProps) {
  // Use React Query with server props as initial data
  const { data: activeSession } = useActiveSessionPlan(studentId, initialActiveSession)

  // Use mutation instead of direct fetch
  const abandonMutation = useAbandonSession()

  const handleStartOver = useCallback(async () => {
    if (!activeSession) return
    setIsStartingOver(true)
    try {
      await abandonMutation.mutateAsync({ playerId: studentId, planId: activeSession.id })
      router.push(`/practice/${studentId}/configure`)
    } catch (error) {
      console.error('Failed to start over:', error)
    } finally {
      setIsStartingOver(false)
    }
  }, [activeSession, studentId, abandonMutation, router])
```

## Implementation Steps

### Step 1: Add Missing React Query Mutation for Skills

**File:** `src/hooks/usePlayerCurriculum.ts`

The skills mutations (`setMasteredSkills`, `refreshSkillRecency`) aren't currently exported. Add them:

```typescript
/**
 * Hook: Set mastered skills (manual skill management)
 */
export function useSetMasteredSkills() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      masteredSkillIds,
    }: {
      playerId: string;
      masteredSkillIds: string[];
    }) => {
      const res = await api(`curriculum/${playerId}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masteredSkillIds }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to set mastered skills");
      }
      return res.json();
    },
    onSuccess: (_, { playerId }) => {
      // Invalidate curriculum to refetch skills
      queryClient.invalidateQueries({
        queryKey: curriculumKeys.detail(playerId),
      });
    },
  });
}

/**
 * Hook: Refresh skill recency (mark as recently practiced)
 */
export function useRefreshSkillRecency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      playerId,
      skillId,
    }: {
      playerId: string;
      skillId: string;
    }) => {
      const res = await api(`curriculum/${playerId}/skills`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to refresh skill");
      }
      return res.json();
    },
    onSuccess: (_, { playerId }) => {
      queryClient.invalidateQueries({
        queryKey: curriculumKeys.detail(playerId),
      });
    },
  });
}
```

### Step 2: Update DashboardClient to Use React Query

**File:** `src/app/practice/[studentId]/dashboard/DashboardClient.tsx`

1. Add imports:

```typescript
import {
  useAbandonSession,
  useActiveSessionPlan,
} from "@/hooks/useSessionPlan";
import {
  useSetMasteredSkills,
  useRefreshSkillRecency,
} from "@/hooks/usePlayerCurriculum";
```

2. Use hooks with server props as initial data:

```typescript
export function DashboardClient({
  studentId,
  player,
  curriculum,
  skills,
  recentSessions,
  activeSession: initialActiveSession,
  currentPracticingSkillIds,
  problemHistory,
  initialTab = 'overview',
}: DashboardClientProps) {
  // Use React Query for active session (server prop as initial data)
  const { data: activeSession } = useActiveSessionPlan(studentId, initialActiveSession)

  // Mutations
  const abandonMutation = useAbandonSession()
  const setMasteredSkillsMutation = useSetMasteredSkills()
  const refreshSkillMutation = useRefreshSkillRecency()
```

3. Replace direct fetch handlers:

```typescript
const handleStartOver = useCallback(async () => {
  if (!activeSession) return;
  setIsStartingOver(true);
  try {
    await abandonMutation.mutateAsync({
      playerId: studentId,
      planId: activeSession.id,
    });
    router.push(`/practice/${studentId}/configure`);
  } catch (error) {
    console.error("Failed to start over:", error);
  } finally {
    setIsStartingOver(false);
  }
}, [activeSession, studentId, abandonMutation, router]);

const handleSaveManualSkills = useCallback(
  async (masteredSkillIds: string[]) => {
    await setMasteredSkillsMutation.mutateAsync({
      playerId: studentId,
      masteredSkillIds,
    });
    setShowManualSkillModal(false);
  },
  [studentId, setMasteredSkillsMutation],
);

const handleRefreshSkill = useCallback(
  async (skillId: string) => {
    await refreshSkillMutation.mutateAsync({
      playerId: studentId,
      skillId,
    });
  },
  [studentId, refreshSkillMutation],
);
```

4. Remove router.refresh() calls - they're no longer needed.

### Step 3: Add Skills Query Hook (Optional Enhancement)

For full consistency, skills should also come from React Query. Add to `usePlayerCurriculum.ts`:

```typescript
export function usePlayerSkills(
  playerId: string,
  initialData?: PlayerSkillMastery[],
) {
  return useQuery({
    queryKey: [...curriculumKeys.detail(playerId), "skills"],
    queryFn: async () => {
      const res = await api(`curriculum/${playerId}`);
      if (!res.ok) throw new Error("Failed to fetch curriculum");
      const data = await res.json();
      return data.skills as PlayerSkillMastery[];
    },
    initialData,
    staleTime: initialData ? 30000 : 0,
  });
}
```

Then in DashboardClient:

```typescript
const { data: skills } = usePlayerSkills(studentId, initialSkills);
```

### Step 4: Ensure QueryClient Provider Wraps Practice Pages

**File:** `src/app/practice/[studentId]/layout.tsx` (or similar)

Verify that `QueryClientProvider` is available. It should be in the root layout, but verify:

```typescript
// src/app/providers.tsx or similar
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: true,
    },
  },
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

## Files to Modify

| File                                                         | Changes                                              |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| `src/hooks/usePlayerCurriculum.ts`                           | Add `useSetMasteredSkills`, `useRefreshSkillRecency` |
| `src/app/practice/[studentId]/dashboard/DashboardClient.tsx` | Use React Query hooks, remove direct fetch           |

## Testing Checklist

- [ ] Click "Start Over" → session abandons, UI updates immediately
- [ ] Click "Start Over" → navigate to /configure works
- [ ] Click "Start Over" → if navigation fails, dashboard shows no active session
- [ ] Manage Skills → save changes → Skills tab updates immediately
- [ ] Refresh skill recency → skill card updates (staleness warning clears)
- [ ] Multiple browser tabs → mutation in one reflects in other after refocus

## Why This Works

1. **Server props hydrate React Query cache** - No loading flash on initial render
2. **Mutations update cache** - `abandonMutation.mutateAsync()` sets active session to `null`
3. **Components read from cache** - `useActiveSessionPlan` returns fresh data
4. **No router.refresh() needed** - React Query manages state, not Next.js
5. **Consistent across components** - Any component using these hooks sees the same data

## Rollout Risk

Low risk:

- Existing hooks already tested in other practice components
- Server props still provide initial data (no loading states)
- Incremental change - only DashboardClient affected
