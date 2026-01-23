# React Query Best Practices

**This app uses React Query (@tanstack/react-query) for ALL server state management.**

## Golden Rules

1. **NEVER use `fetch()` directly in components** - Always use React Query hooks
2. **NEVER use `router.refresh()` after mutations** - Invalidate queries instead
3. **NEVER use `useState` for server data** - Use `useQuery` or `useSuspenseQuery`
4. **ALWAYS invalidate related queries after mutations** - This keeps the UI in sync
5. **ALWAYS check `src/hooks/` first** - A hook likely already exists for what you need

---

## When to Use React Query

| Scenario | Use React Query? | Pattern |
|----------|-----------------|---------|
| Fetching data from API | YES | `useQuery` or `useSuspenseQuery` |
| Mutating data (POST/PUT/DELETE) | YES | `useMutation` with invalidation |
| Form submission | YES | `useMutation` |
| Loading state | YES | `query.isLoading` or `mutation.isPending` |
| Error state | YES | `query.error` or `mutation.error` |
| Polling/real-time data | YES | `useQuery` with `refetchInterval` |
| Local UI state (open/closed, selected tab) | NO | `useState` is fine |
| Form input values | NO | `useState` or form library |

---

## Query Keys

**All query keys are defined in `src/lib/queryKeys.ts`**

Query keys enable:
- Automatic cache invalidation after mutations
- SSR prefetching
- Related queries to stay in sync

### Pattern: Query Key Factories

```typescript
// src/lib/queryKeys.ts
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  detail: (id: string) => [...playerKeys.all, 'detail', id] as const,
}

export const curriculumKeys = {
  all: ['curriculum'] as const,
  detail: (playerId: string) => [...curriculumKeys.all, playerId] as const,
}
```

### Using Query Keys

```typescript
// In hooks
import { curriculumKeys } from '@/lib/queryKeys'

useQuery({
  queryKey: curriculumKeys.detail(playerId),
  queryFn: () => fetchCurriculum(playerId),
})

// In mutations - invalidate by key
queryClient.invalidateQueries({
  queryKey: curriculumKeys.detail(playerId),
})
```

### Adding New Query Keys

When adding a new data type, add its keys to `src/lib/queryKeys.ts`:

```typescript
export const myFeatureKeys = {
  all: ['my-feature'] as const,
  list: () => [...myFeatureKeys.all, 'list'] as const,
  detail: (id: string) => [...myFeatureKeys.all, 'detail', id] as const,
}
```

---

## Hook Structure Pattern

**Reference implementation: `src/hooks/usePlayerCurriculum.ts`**

### Standard Hook Structure

```typescript
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { myFeatureKeys } from '@/lib/queryKeys'

// Re-export keys for consumers
export { myFeatureKeys } from '@/lib/queryKeys'

// ============================================================================
// Types
// ============================================================================

export interface MyData {
  id: string
  name: string
}

// ============================================================================
// API Functions (keep private to this file)
// ============================================================================

async function fetchMyData(id: string): Promise<MyData> {
  const response = await api(`my-feature/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`)
  }
  return response.json()
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch data with loading/error states
 */
export function useMyDataQuery(id: string | null) {
  return useQuery({
    queryKey: myFeatureKeys.detail(id ?? ''),
    queryFn: () => fetchMyData(id!),
    enabled: !!id,  // Don't fetch if id is null
  })
}

/**
 * Fetch data with Suspense (for SSR prefetching)
 */
export function useMyDataSuspense(id: string) {
  return useSuspenseQuery({
    queryKey: myFeatureKeys.detail(id),
    queryFn: () => fetchMyData(id),
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Update data
 */
export function useUpdateMyData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const response = await api(`my-feature/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error('Failed to update')
      return response.json()
    },
    // CRITICAL: Invalidate related queries!
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: myFeatureKeys.detail(id),
      })
    },
  })
}

// ============================================================================
// Invalidation Hooks (for cross-component cache management)
// ============================================================================

/**
 * Get a function to invalidate cache from anywhere
 * Useful when mutations happen outside this hook's context
 */
export function useInvalidateMyData() {
  const queryClient = useQueryClient()

  return (id: string) => {
    queryClient.invalidateQueries({
      queryKey: myFeatureKeys.detail(id),
    })
  }
}
```

---

## Mutation Patterns

### Basic Mutation with Invalidation

```typescript
export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const response = await api(`items/${itemId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => {
      // Invalidate the list so it refetches without the deleted item
      queryClient.invalidateQueries({
        queryKey: itemKeys.list(),
      })
    },
  })
}
```

### Optimistic Updates (Instant UI feedback)

Use when you want the UI to update immediately before the server responds:

```typescript
export function useToggleFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ itemId, isFavorite }: { itemId: string; isFavorite: boolean }) => {
      const response = await api(`items/${itemId}/favorite`, {
        method: 'POST',
        body: JSON.stringify({ isFavorite }),
      })
      if (!response.ok) throw new Error('Failed')
      return response.json()
    },

    // Step 1: Optimistically update cache BEFORE API call
    onMutate: async ({ itemId, isFavorite }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: itemKeys.detail(itemId) })

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData(itemKeys.detail(itemId))

      // Optimistically update
      queryClient.setQueryData(itemKeys.detail(itemId), (old: Item | undefined) => {
        if (!old) return old
        return { ...old, isFavorite }
      })

      return { previousData }
    },

    // Step 2: Rollback on error
    onError: (_err, { itemId }, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(itemKeys.detail(itemId), context.previousData)
      }
    },

    // Step 3: Always refetch to ensure sync
    onSettled: (_, __, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) })
    },
  })
}
```

### Cross-Query Invalidation

When a mutation affects multiple queries:

```typescript
export function useCompleteSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sessionId, playerId }: { sessionId: string; playerId: string }) => {
      // ... API call
    },
    onSuccess: (_, { playerId }) => {
      // Invalidate multiple related queries
      queryClient.invalidateQueries({ queryKey: curriculumKeys.detail(playerId) })
      queryClient.invalidateQueries({ queryKey: sessionHistoryKeys.list(playerId) })
      queryClient.invalidateQueries({ queryKey: skillMetricsKeys.player(playerId) })
    },
  })
}
```

---

## Using Hooks in Components

### Query Hook Usage

```typescript
function MyComponent({ playerId }: { playerId: string }) {
  const { data, isLoading, error } = usePlayerCurriculumQuery(playerId)

  if (isLoading) return <Spinner />
  if (error) return <Error message={error.message} />
  if (!data) return null

  return <div>{data.curriculum?.currentLevel}</div>
}
```

### Mutation Hook Usage

```typescript
function MyComponent({ playerId }: { playerId: string }) {
  const updateMutation = useUpdateMyData()

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: playerId, name: 'New Name' })
      // Success! Cache is already invalidated by the hook
    } catch (error) {
      // Handle error
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={updateMutation.isPending}
    >
      {updateMutation.isPending ? 'Saving...' : 'Save'}
    </button>
  )
}
```

### Using Mutation Variables for Loading States

```typescript
function ItemList({ items }: { items: Item[] }) {
  const deleteMutation = useDeleteItem()

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          {item.name}
          <button
            onClick={() => deleteMutation.mutate(item.id)}
            disabled={deleteMutation.isPending}
          >
            {/* Show loading only for the specific item being deleted */}
            {deleteMutation.isPending && deleteMutation.variables === item.id
              ? 'Deleting...'
              : 'Delete'}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

---

## Common Anti-Patterns

### ❌ WRONG: Using fetch() directly

```typescript
// BAD - cache won't update, no loading states
const handleSave = async () => {
  await fetch('/api/items', { method: 'POST', body: JSON.stringify(data) })
  router.refresh() // Does NOT invalidate React Query cache!
}
```

### ✅ CORRECT: Using mutation hook

```typescript
// GOOD - cache invalidates, loading state available
const createMutation = useCreateItem()

const handleSave = async () => {
  await createMutation.mutateAsync(data)
  // Cache is automatically invalidated by the hook
}
```

### ❌ WRONG: Manual loading state

```typescript
// BAD - duplicates React Query's built-in state
const [isLoading, setIsLoading] = useState(false)

const handleSave = async () => {
  setIsLoading(true)
  await createMutation.mutateAsync(data)
  setIsLoading(false)
}
```

### ✅ CORRECT: Using mutation state

```typescript
// GOOD - use the mutation's built-in state
const handleSave = () => createMutation.mutate(data)

// In JSX
<button disabled={createMutation.isPending}>
  {createMutation.isPending ? 'Saving...' : 'Save'}
</button>
```

### ❌ WRONG: useState for server data

```typescript
// BAD - data can become stale, no automatic refetching
const [data, setData] = useState(null)

useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData)
}, [])
```

### ✅ CORRECT: Using useQuery

```typescript
// GOOD - automatic caching, refetching, and staleness management
const { data, isLoading, error } = useQuery({
  queryKey: ['data'],
  queryFn: () => fetch('/api/data').then(r => r.json()),
})
```

---

## Query Key Relationships

**Ensure mutations invalidate the right queries:**

| When you mutate... | Invalidate these keys |
|--------------------|----------------------|
| Player curriculum | `curriculumKeys.detail(playerId)` |
| Skill mastery | `curriculumKeys.detail(playerId)`, `skillMetricsKeys.player(playerId)` |
| Session completion | `curriculumKeys.detail(playerId)`, `sessionHistoryKeys.list(playerId)` |
| Classroom settings | `classroomKeys.detail(classroomId)` |
| Player enrollment | `classroomKeys.enrollments(classroomId)`, `playerKeys.enrolledClassrooms(playerId)` |
| Version history | `versionHistoryKeys.session(sessionId)` |

---

## Checklist Before Writing Data Fetching Code

- [ ] Is there already a hook in `src/hooks/` for this data?
- [ ] Am I using query keys from `src/lib/queryKeys.ts`?
- [ ] For queries: Am I using `useQuery` (not `fetch` + `useState`)?
- [ ] For mutations: Does it invalidate all affected query keys?
- [ ] Am I using `mutation.isPending` instead of manual loading state?
- [ ] Am I NOT using `router.refresh()` for cache updates?

---

## Historical Context

**These bugs have occurred from not following React Query patterns:**

1. **SkillsTab "Mark Current" button (2025-12-20)**: Used `fetch` + `router.refresh()` instead of mutation hook. Skills list showed stale data until page reload.

2. **Version History tab (2025-01)**: Initially used `useState` + `fetch()`. History tab didn't update when new versions were created until switching to `useVersionHistory` hook with proper invalidation.

**When in doubt, check how `src/hooks/usePlayerCurriculum.ts` is structured - it's the reference implementation.**
