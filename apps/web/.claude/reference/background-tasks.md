# Background Task System

Long-running operations (worksheet parsing, vision training) run as background tasks with real-time progress via Socket.IO and database persistence for page-reload recovery.

## Architecture

```
Client (Browser)                    Server
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│ POST /api/.../task│────▶│ createTask()         │────▶│ SQLite       │
│                  │     │   └─ handler(handle)  │     │ (tasks +     │
│ Socket.IO client │◀───▶│ Socket.IO server     │◀───▶│  events)     │
│   task:subscribe │     │   (Redis adapter)    │     └──────────────┘
│   task:event     │     └─────────────────────┘
└──────────────────┘
```

**Flow:**
1. Client POSTs to a task route → route calls `createTask()` → returns task ID
2. Client connects to Socket.IO and sends `task:subscribe` with task ID
3. Handler runs asynchronously, emitting events via `handle.emit()` / `handle.emitTransient()`
4. Events broadcast to all subscribers in the `task:{id}` Socket.IO room
5. Persisted events replay to late-joining clients (page reload)

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/task-manager.ts` | Core: `createTask()`, `TaskHandle`, lifecycle hooks, timeouts, zombie cleanup |
| `src/lib/tasks/events.ts` | Typed event definitions per task type |
| `src/lib/tasks/worksheet-parse.ts` | Worksheet initial parse handler |
| `src/lib/tasks/worksheet-reparse.ts` | Selective problem re-parse handler |
| `src/lib/tasks/flowchart-generate.ts` | Flowchart generation handler (LLM → definition + mermaid) |
| `src/lib/tasks/flowchart-refine.ts` | Flowchart refinement handler (LLM → updated definition) |
| `src/socket-server.ts` | Socket.IO integration: task rooms, event replay, zombie cleanup on startup |
| `src/db/schema/background-tasks.ts` | DB schema: `background_tasks` + `background_task_events` tables |
| `src/contexts/WorksheetParsingContext.tsx` | Client: Socket.IO subscription, state machine, cache updates |
| `src/hooks/useBackgroundTask.ts` | Generic client hook for any task type |
| `src/app/admin/tasks/page.tsx` | Admin UI: task list, event log, filters, failure stats |

---

## Event System

### Two Categories

**Lifecycle events** — emitted by task-manager, same for all task types:
- `started` — task status changed to `running`
- `progress` — progress update (DB writes throttled to every 3s)
- `completed` — task finished successfully
- `failed` — task finished with error
- `cancelled` — task was cancelled by user

**Domain events** — emitted by handlers, specific to each task type:
- `parse_started`, `parse_complete`, `parse_error`, etc.
- Defined as discriminated unions in `src/lib/tasks/events.ts`

### `emit()` vs `emitTransient()`

| Method | DB Write | Socket.IO | Replay | Use For |
|--------|----------|-----------|--------|---------|
| `handle.emit(event)` | Yes | Yes | Yes | State changes, completion, errors |
| `handle.emitTransient(event)` | No | Yes | No | Streaming tokens, reasoning text |

**Rule:** Use `emitTransient` for high-frequency events (LLM token streaming) to avoid hammering the database. Use `emit` for events that should survive page reload.

### Event Typing

Events use discriminated unions with a `type` field. `TaskHandle` is generic over its event type, so TypeScript enforces that handlers can only emit events from their declared union:

```typescript
// In events.ts
export type WorksheetParseEvent =
  | { type: 'parse_started'; attachmentId: string; modelConfigId: string }
  | { type: 'parse_complete'; data: unknown; status: string }
  | { type: 'parse_error'; error: string }

// In handler — only WorksheetParseEvent events are allowed
const handle: TaskHandle<WorksheetParseOutput, WorksheetParseEvent> = ...
handle.emit({ type: 'parse_started', attachmentId: '...' }) // OK
handle.emit({ type: 'unknown_event' })                       // TypeScript error
```

---

## Error Handling

### Handler errors

Throw from the handler — `createTask()` catches it and calls `failTask()`:

```typescript
async (handle, input) => {
  const data = await fetchData()
  if (!data) throw new Error('Data not found')  // → task fails, 'failed' event emitted
  handle.complete(data)
}
```

### Domain-level errors

Use `handle.emit()` with a domain error event, then re-throw to fail the task:

```typescript
try {
  result = await callLLM(...)
} catch (error) {
  handle.emit({ type: 'parse_error', error: error.message })  // domain event for client
  await updateDB(...)  // update attachment status
  throw error          // re-throw to fail the task (lifecycle 'failed' event)
}
```

### What happens on failure

1. Handler throws → `createTask` catches
2. Checks task is still `running` (not already completed/cancelled)
3. Calls `failTask()` → updates DB status to `failed` → emits `failed` lifecycle event
4. `onTaskFailed` lifecycle hook fires (for logging/monitoring)
5. Client receives `failed` event → updates UI to show error

### Zombie detection

On server startup, `cleanupZombieTasks()` marks any `running`/`pending` tasks as `failed` with error "Task interrupted by server restart". This handles pod restarts/crashes.

### Timeouts

Each task type has a configurable timeout (default 5 minutes). If a task exceeds its timeout while still `running`, it's automatically failed:

```typescript
// In task-manager.ts
const taskTimeouts: Partial<Record<TaskType, number>> = {
  'worksheet-parse': 5 * 60 * 1000,
  'vision-training': 30 * 60 * 1000,
}
```

---

## Adding a New Task Type

### Checklist

1. **Add task type** to `TaskType` union in `src/db/schema/background-tasks.ts`
2. **Define events** in `src/lib/tasks/events.ts`:
   - Add a discriminated union type (e.g., `MyTaskEvent`)
   - Add to `TaskEventMap`
3. **Create handler** at `src/lib/tasks/my-task.ts`:
   - Define input/output interfaces
   - Export a `startMyTask(input)` function that calls `createTask()`
4. **Create API route** at `src/app/api/.../task/route.ts`:
   - POST: validate input, call `startMyTask()`, return `{ taskId }`
   - GET (optional): check for active task of this type
5. **Create client hook** or use `useBackgroundTask<MyOutput>(taskId)` directly
6. **Add timeout** in `task-manager.ts` `taskTimeouts` if non-default
7. **Test**: demo page, failure path, page reload recovery

### Minimal Example (~50 lines)

**Handler** (`src/lib/tasks/my-task.ts`):
```typescript
import { createTask } from '../task-manager'
import type { MyTaskEvent } from './events'

interface MyInput { url: string }
interface MyOutput { result: string }

export async function startMyTask(input: MyInput): Promise<string> {
  return createTask<MyInput, MyOutput, MyTaskEvent>(
    'my-task',
    input,
    async (handle, { url }) => {
      handle.setProgress(10, 'Fetching data...')
      handle.emit({ type: 'fetch_started', url })

      const data = await fetch(url).then(r => r.json())
      handle.setProgress(80, 'Processing...')

      handle.emit({ type: 'fetch_complete', itemCount: data.length })
      handle.complete({ result: `Processed ${data.length} items` })
    }
  )
}
```

**API Route** (`src/app/api/my-task/route.ts`):
```typescript
import { NextResponse } from 'next/server'
import { startMyTask } from '@/lib/tasks/my-task'

export async function POST(req: Request) {
  const { url } = await req.json()
  const taskId = await startMyTask({ url })
  return NextResponse.json({ taskId })
}
```

**Client**:
```typescript
const { taskId, startTask } = useBackgroundTask<MyOutput>()
// startTask calls POST, gets taskId, auto-subscribes via Socket.IO
// taskId triggers useBackgroundTask which handles events + replay
```

---

## Monitoring

### Lifecycle hooks

Registered in `socket-server.ts` on startup:

```typescript
registerTaskHooks({
  onTaskCreated: (taskId, type) => console.log(`TASK_CREATED ${type} ${taskId}`),
  onTaskFailed: (taskId, type, error) => console.error(`TASK_FAILED ${type} ${taskId} ${error}`),
})
```

### Admin UI

`/admin/tasks` provides:
- Task list with status/type filters
- Per-task event log with color-coded event types
- 24-hour failure rate per task type
- Real-time updates via Socket.IO

### Structured logs

All task lifecycle events are logged to stdout with `[TaskManager]` prefix:
```
[TaskManager] Task abc123 (worksheet-parse) created
[TaskManager] Task abc123 completed
[TaskManager] TASK_FAILED id=xyz789 type=worksheet-parse error=Timeout
[TaskManager] Cleaned up 2 zombie task(s) from previous instance
```

---

## Client Integration Patterns

### Generic (any task type)

Use `useBackgroundTask<TOutput>(taskId)` from `src/hooks/useBackgroundTask.ts`. Handles Socket.IO subscription, event replay, and state tracking.

### Task-specific (worksheet parsing)

`WorksheetParsingContext` wraps `useBackgroundTask` with domain-specific state management:
- State machine (`src/lib/worksheet-parsing/state-machine.ts`) tracks streaming phases
- Progressive problem highlighting as results stream in
- Optimistic React Query cache updates
- Automatic reconnection to in-progress tasks on page reload

### Page reload recovery

1. Component mounts → checks API for active task of this type
2. If found → calls `subscribeToTask(taskId, attachmentId)`
3. Socket.IO server replays all persisted events
4. Client rebuilds state from replayed events
