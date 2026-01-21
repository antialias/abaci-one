# React Query Mutations Reference

**CRITICAL: Mutations must invalidate related queries. Using `fetch()` + `router.refresh()` will NOT update the React Query cache.**

## The Failure Pattern

```typescript
// ❌ WRONG - This causes stale UI!
const handleRefreshSkill = useCallback(
  async (skillId: string) => {
    const response = await fetch(`/api/curriculum/${studentId}/skills`, {
      method: "PATCH",
      body: JSON.stringify({ skillId }),
    });
    router.refresh(); // Does NOT invalidate React Query cache!
  },
  [studentId, router],
);
```

**Why this fails:**
- `router.refresh()` triggers a Next.js server re-render
- But React Query maintains its own cache on the client
- The cached data stays stale until the query naturally refetches
- User sees outdated UI until they reload the page

## The Correct Pattern

### Step 1: Check if a mutation hook already exists

Look in `src/hooks/` for existing mutation hooks:

- `usePlayerCurriculum.ts` - curriculum mutations (`useRefreshSkillRecency`, `useSetMasteredSkills`)
- `useSessionPlan.ts` - session plan mutations
- `useRoomData.ts` - arcade room mutations

### Step 2: Use the existing hook

```typescript
// ✅ CORRECT - Use the mutation hook
import { useRefreshSkillRecency } from "@/hooks/usePlayerCurriculum";

function MyComponent({ studentId }) {
  const refreshSkillRecency = useRefreshSkillRecency();

  const handleRefreshSkill = useCallback(
    async (skillId: string) => {
      await refreshSkillRecency.mutateAsync({ playerId: studentId, skillId });
    },
    [studentId, refreshSkillRecency],
  );

  // Use mutation state for loading indicators
  const isRefreshing = refreshSkillRecency.isPending
    ? refreshSkillRecency.variables?.skillId
    : null;
}
```

### Step 3: If no hook exists, create one with proper invalidation

```typescript
// In src/hooks/usePlayerCurriculum.ts
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
      const response = await api(`curriculum/${playerId}/skills`, {
        method: "PATCH",
        body: JSON.stringify({ skillId }),
      });
      if (!response.ok) throw new Error("Failed to refresh skill");
      return response.json();
    },
    // THIS IS THE CRITICAL PART - invalidate affected queries!
    onSuccess: (_, { playerId }) => {
      queryClient.invalidateQueries({
        queryKey: curriculumKeys.detail(playerId),
      });
    },
  });
}
```

## Query Key Relationships

**Always ensure mutations invalidate the right query keys:**

| Mutation              | Must Invalidate                    |
| --------------------- | ---------------------------------- |
| Skill mastery changes | `curriculumKeys.detail(playerId)`  |
| Session plan updates  | `sessionPlanKeys.active(playerId)` |
| Player settings       | `curriculumKeys.detail(playerId)`  |
| Room settings         | `roomKeys.detail(roomId)`          |

**Query keys are defined in:** `src/lib/queryKeys.ts`

## Red Flags

If you find yourself:
- Using `fetch()` directly in a component for mutations
- Calling `router.refresh()` after a data mutation
- Creating `useState` for loading states instead of using `mutation.isPending`

**STOP.** Look for an existing mutation hook or create one with proper cache invalidation.

## Historical Context

**This exact bug has occurred multiple times:**

1. **SkillsTab "Mark Current" button (2025-12-20)**: Used `fetch` + `router.refresh()` instead of `useRefreshSkillRecency`. Skills list showed stale data until page reload.

2. **Similar patterns exist elsewhere** - always check before adding new mutation logic.

## Checklist Before Writing Mutation Code

1. [ ] Is there already a mutation hook in `src/hooks/`?
2. [ ] Does the mutation invalidate the correct query key?
3. [ ] Am I using `mutation.isPending` instead of manual loading state?
4. [ ] Am I NOT using `router.refresh()` for cache updates?
