# Arcade Session Implementation Plan

## Overview

Implement modal arcade session state that persists across tabs and devices, ensuring users return to their active game with full state synchronization.

## Key Requirements

1. **WebSocket-based real-time sync** managed in Next.js server
2. **TTL-based automatic cleanup** (24-hour default, configurable)
3. **Auto-resume**: Users taken directly to active game with exact state
4. **Exit button**: Prominent in mini nav (reloading/navigating returns to game until explicit exit)
5. **Route migration**: Move games from `/games/{name}` to `/arcade/{name}`
6. **Cross-device sync**: Same session across all devices for same account (guest or permanent)
7. **Server-side validation**: All game moves validated server-side with optimistic client updates
8. **Rollback UX**: User-friendly feedback when server rejects moves

---

## Architecture Overview

```
┌─────────────┐                    ┌─────────────┐
│   Client A  │                    │   Client B  │
│  (Desktop)  │                    │  (Mobile)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. Make move (optimistic UI)     │
       ├──────────────────────────────────┤
       │                                  │
       │ 2. WebSocket: Send move          │
       ├─────────────┐                    │
       │             ▼                    │
       │      ┌─────────────┐             │
       │      │ Next.js WS  │             │
       │      │   Server    │             │
       │      │  Validates  │             │
       │      │  + Persists │             │
       │      └──────┬──────┘             │
       │             │                    │
       │ 3a. Accepted│                    │
       │◄────────────┤                    │
       │             │ 3b. Broadcast      │
       │             ├────────────────────►│
       │             │                    │ 4. Sync UI
       │             │                    │
       │      OR                          │
       │ 3a. Rejected (+ server state)    │
       │◄────────────┤                    │
       │ 4. Rollback + Toast              │
```

---

## Phase 1: Database Schema

### New Table: `arcade_sessions`

```typescript
// apps/web/src/db/schema/arcade-sessions.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const arcadeSessions = sqliteTable("arcade_sessions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // Session metadata
  currentGame: text("current_game", {
    enum: [
      "memory-lightning",
      "battle-arena",
      "complement-race",
      "master-organizer",
    ],
  }).notNull(),

  gameUrl: text("game_url").notNull(), // e.g., '/arcade/matching'

  // Game state (JSON blob)
  gameState: text("game_state", { mode: "json" }).notNull(),

  // Active players snapshot (for quick access)
  activePlayers: text("active_players", { mode: "json" }).notNull(),

  // Timing & TTL
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), // TTL-based

  // Status
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),

  // Version for optimistic locking
  version: integer("version").notNull().default(1),
});

export type ArcadeSession = typeof arcadeSessions.$inferSelect;
export type NewArcadeSession = typeof arcadeSessions.$inferInsert;
```

### Migration

```bash
pnpm drizzle-kit generate:sqlite
pnpm drizzle-kit migrate
```

---

## Phase 2: WebSocket Server

### Dependencies

```bash
pnpm add socket.io socket.io-client
```

### Custom Server Setup

**File: `apps/web/server.js`**

```javascript
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initializeSocketServer } = require("./src/lib/socket-server");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  initializeSocketServer(server);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
```

**Update `package.json`:**

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js"
  }
}
```

### Socket Server Implementation

**File: `apps/web/src/lib/socket-server.ts`**

```typescript
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { getGameValidator } from "./game-validation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("🔌 Client connected:", socket.id);

    // Join user's personal room
    socket.on("join-arcade-session", async ({ userId }) => {
      socket.join(`arcade:${userId}`);
      console.log(`👤 User ${userId} joined their arcade room`);

      // Send current session state
      const session = await db.query.arcadeSessions.findFirst({
        where: eq(schema.arcadeSessions.userId, userId),
      });

      if (session?.isActive) {
        socket.emit("session-state", session);
      }
    });

    // Handle game moves with validation
    socket.on(
      "game-move",
      async ({ userId, gameType, move, clientVersion }) => {
        try {
          // 1. Fetch current server state
          const session = await db.query.arcadeSessions.findFirst({
            where: eq(schema.arcadeSessions.userId, userId),
          });

          if (!session?.isActive) {
            socket.emit("move-rejected", {
              error: "No active session",
              move,
            });
            return;
          }

          // 2. Check version (optimistic locking)
          if (session.version !== clientVersion) {
            socket.emit("move-rejected", {
              error: "State out of sync",
              serverState: JSON.parse(session.gameState),
              serverVersion: session.version,
              move,
            });
            return;
          }

          const currentState = JSON.parse(session.gameState);

          // 3. Validate move
          const validator = getGameValidator(gameType);
          const validation = validator.validateMove(currentState, move);

          if (!validation.valid) {
            socket.emit("move-rejected", {
              error: validation.error,
              move,
              serverState: currentState,
              serverVersion: session.version,
            });
            console.warn(`❌ Move rejected for ${userId}:`, validation.error);
            return;
          }

          // 4. Apply validated move
          const newState = validation.updatedState!;
          const newVersion = session.version + 1;

          // 5. Save to database
          await db
            .update(schema.arcadeSessions)
            .set({
              gameState: JSON.stringify(newState),
              lastActivityAt: new Date(),
              expiresAt: calculateExpiresAt(24), // Reset TTL
              version: newVersion,
            })
            .where(eq(schema.arcadeSessions.userId, userId));

          // 6. Acknowledge to sender
          socket.emit("move-accepted", {
            move,
            version: newVersion,
          });

          // 7. Broadcast to other devices
          socket.to(`arcade:${userId}`).emit("game-state-updated", {
            state: newState,
            move,
            version: newVersion,
          });

          console.log(`✅ Move accepted for ${userId}:`, move.type);
        } catch (error) {
          console.error("Error processing move:", error);
          socket.emit("move-rejected", {
            error: "Server error",
            move,
          });
        }
      },
    );

    // Handle arcade exit
    socket.on("exit-arcade", async ({ userId }) => {
      await db
        .update(schema.arcadeSessions)
        .set({ isActive: false })
        .where(eq(schema.arcadeSessions.userId, userId));

      io.to(`arcade:${userId}`).emit("arcade-exited");
      console.log(`🚪 User ${userId} exited arcade`);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Client disconnected:", socket.id);
    });
  });

  return io;
}

function calculateExpiresAt(ttlHours: number = 24): Date {
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}
```

---

## Phase 3: Shared Game Validation (Isomorphic)

### Validation Types

**File: `apps/web/src/lib/game-validation/types.ts`**

```typescript
export interface GameMove {
  type: string; // 'FLIP_CARD' | 'MATCH_FOUND' | etc.
  playerId: string;
  timestamp: number;
  data: any;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  updatedState?: any;
}

export interface GameValidator {
  validateMove(currentState: any, move: GameMove): ValidationResult;
  applyMove(currentState: any, move: GameMove): any;
}
```

### Example: Matching Game Validator

**File: `apps/web/src/lib/game-validation/matching-validator.ts`**

```typescript
import { GameValidator, GameMove, ValidationResult } from "./types";
import { MemoryPairsState } from "@/app/arcade/matching/context/types";

export class MatchingGameValidator implements GameValidator {
  validateMove(
    currentState: MemoryPairsState,
    move: GameMove,
  ): ValidationResult {
    switch (move.type) {
      case "FLIP_CARD": {
        const { cardId } = move.data;

        const card = currentState.cards.find((c) => c.id === cardId);
        if (!card) {
          return { valid: false, error: "Card not found" };
        }

        if (card.matched) {
          return { valid: false, error: "Card already matched" };
        }

        if (currentState.flippedCards.length >= 2) {
          return { valid: false, error: "Too many cards flipped" };
        }

        if (currentState.currentPlayer !== move.playerId) {
          return { valid: false, error: "Not your turn" };
        }

        const updatedState = this.applyMove(currentState, move);
        return { valid: true, updatedState };
      }

      case "MATCH_FOUND": {
        const { cardIds } = move.data;

        const flippedIds = currentState.flippedCards.map((c) => c.id);
        if (!cardIds.every((id: string) => flippedIds.includes(id))) {
          return { valid: false, error: "Cards not flipped" };
        }

        const [card1, card2] = cardIds.map((id: string) =>
          currentState.cards.find((c) => c.id === id),
        );

        if (!this.isMatch(card1, card2, currentState.gameType)) {
          return { valid: false, error: "Cards do not match" };
        }

        const updatedState = this.applyMove(currentState, move);
        return { valid: true, updatedState };
      }

      default:
        return { valid: false, error: "Unknown move type" };
    }
  }

  applyMove(currentState: MemoryPairsState, move: GameMove): MemoryPairsState {
    switch (move.type) {
      case "FLIP_CARD":
        const card = currentState.cards.find((c) => c.id === move.data.cardId)!;
        return {
          ...currentState,
          flippedCards: [...currentState.flippedCards, card],
        };

      case "MATCH_FOUND":
        return {
          ...currentState,
          matchedPairs: currentState.matchedPairs + 1,
          scores: {
            ...currentState.scores,
            [move.playerId]: (currentState.scores[move.playerId] || 0) + 1,
          },
          flippedCards: [],
        };

      default:
        return currentState;
    }
  }

  private isMatch(card1: any, card2: any, gameType: string): boolean {
    if (gameType === "abacus-numeral") {
      return card1.number === card2.number && card1.type !== card2.type;
    }
    if (gameType === "complement-pairs") {
      return card1.number + card2.number === card1.targetSum;
    }
    return false;
  }
}
```

### Validator Registry

**File: `apps/web/src/lib/game-validation/index.ts`**

```typescript
import { MatchingGameValidator } from "./matching-validator";
import { GameValidator } from "./types";

export function getGameValidator(gameType: string): GameValidator {
  switch (gameType) {
    case "battle-arena":
      return new MatchingGameValidator();
    case "memory-lightning":
      // TODO: Implement MemoryQuizValidator
      throw new Error("Memory quiz validator not implemented");
    case "complement-race":
      // TODO: Implement ComplementRaceValidator
      throw new Error("Complement race validator not implemented");
    default:
      throw new Error(`Unknown game type: ${gameType}`);
  }
}
```

---

## Phase 4: Client WebSocket Integration

### WebSocket Hook

**File: `apps/web/src/hooks/useArcadeSocket.ts`**

```typescript
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useArcadeSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!socket) {
      socket = io({
        path: "/api/socket",
        autoConnect: true,
      });

      socket.on("connect", () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);
      });

      socket.on("disconnect", () => {
        console.log("❌ WebSocket disconnected");
        setIsConnected(false);
      });
    }

    return () => {
      // Don't disconnect - keep socket alive across re-renders
    };
  }, []);

  return { socket, isConnected };
}
```

### Optimistic Game State Hook

**File: `apps/web/src/hooks/useOptimisticGameState.ts`**

```typescript
import { useReducer, useEffect, useCallback } from "react";
import { useArcadeSocket } from "./useArcadeSocket";
import { GameMove } from "@/lib/game-validation/types";
import { getGameValidator } from "@/lib/game-validation";
import { showMoveRejectedToast } from "@/components/MoveRejectedToast";

interface OptimisticState<T> {
  committed: T;
  optimistic: T;
  pendingMoves: GameMove[];
  version: number;
}

type Action<T> =
  | { type: "APPLY_OPTIMISTIC"; move: GameMove; gameType: string }
  | { type: "COMMIT_MOVE"; move: GameMove; version: number }
  | { type: "ROLLBACK_MOVE"; move: GameMove; serverState: T; version: number }
  | { type: "SYNC_SERVER_STATE"; state: T; version: number };

function optimisticReducer<T>(
  state: OptimisticState<T>,
  action: Action<T>,
): OptimisticState<T> {
  switch (action.type) {
    case "APPLY_OPTIMISTIC": {
      const validator = getGameValidator(action.gameType);
      const result = validator.applyMove(state.optimistic, action.move);

      return {
        ...state,
        optimistic: result,
        pendingMoves: [...state.pendingMoves, action.move],
      };
    }

    case "COMMIT_MOVE":
      return {
        ...state,
        committed: state.optimistic,
        pendingMoves: state.pendingMoves.filter(
          (m) => m.timestamp !== action.move.timestamp,
        ),
        version: action.version,
      };

    case "ROLLBACK_MOVE":
      return {
        committed: action.serverState,
        optimistic: action.serverState,
        pendingMoves: [],
        version: action.version,
      };

    case "SYNC_SERVER_STATE":
      if (state.pendingMoves.length === 0) {
        return {
          committed: action.state,
          optimistic: action.state,
          pendingMoves: [],
          version: action.version,
        };
      }
      return {
        ...state,
        committed: action.state,
        version: action.version,
      };

    default:
      return state;
  }
}

export function useOptimisticGameState<T>(
  initialState: T,
  gameType: string,
  userId: string,
) {
  const { socket } = useArcadeSocket();

  const [state, dispatch] = useReducer<
    React.Reducer<OptimisticState<T>, Action<T>>
  >(optimisticReducer, {
    committed: initialState,
    optimistic: initialState,
    pendingMoves: [],
    version: 0,
  });

  const applyMove = useCallback(
    (move: GameMove) => {
      dispatch({ type: "APPLY_OPTIMISTIC", move, gameType });

      socket?.emit("game-move", {
        userId,
        gameType,
        move,
        clientVersion: state.version,
      });
    },
    [socket, userId, gameType, state.version],
  );

  useEffect(() => {
    if (!socket) return;

    socket.on("move-accepted", ({ move, version }) => {
      console.log("✅ Move accepted:", move.type);
      dispatch({ type: "COMMIT_MOVE", move, version });
    });

    socket.on(
      "move-rejected",
      ({ error, move, serverState, serverVersion }) => {
        console.warn("❌ Move rejected:", error);
        showMoveRejectedToast(error);
        dispatch({
          type: "ROLLBACK_MOVE",
          move,
          serverState,
          version: serverVersion,
        });
      },
    );

    socket.on("game-state-updated", ({ state: newState, version }) => {
      console.log("🔄 State synced from another device");
      dispatch({
        type: "SYNC_SERVER_STATE",
        state: newState,
        version,
      });
    });

    return () => {
      socket.off("move-accepted");
      socket.off("move-rejected");
      socket.off("game-state-updated");
    };
  }, [socket]);

  return {
    state: state.optimistic,
    committedState: state.committed,
    applyMove,
    isPending: state.pendingMoves.length > 0,
    version: state.version,
  };
}
```

---

## Phase 5: API Routes

### GET /api/arcade-session

**File: `apps/web/src/app/api/arcade-session/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getViewerId } from "@/lib/viewer";

export async function GET() {
  try {
    const viewerId = await getViewerId();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    });

    if (!user) {
      return NextResponse.json({ session: null });
    }

    const session = await db.query.arcadeSessions.findFirst({
      where: eq(schema.arcadeSessions.userId, user.id),
    });

    if (!session?.isActive) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Failed to fetch arcade session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    );
  }
}
```

### POST /api/arcade-session

```typescript
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId();
    const body = await req.json();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [session] = await db
      .insert(schema.arcadeSessions)
      .values({
        userId: user.id,
        currentGame: body.currentGame,
        gameUrl: body.gameUrl,
        gameState: JSON.stringify(body.gameState),
        activePlayers: JSON.stringify(body.activePlayers),
        startedAt: now,
        lastActivityAt: now,
        expiresAt,
        isActive: true,
        version: 1,
      })
      .onConflictDoUpdate({
        target: schema.arcadeSessions.userId,
        set: {
          currentGame: body.currentGame,
          gameUrl: body.gameUrl,
          gameState: JSON.stringify(body.gameState),
          activePlayers: JSON.stringify(body.activePlayers),
          lastActivityAt: now,
          expiresAt,
          isActive: true,
          version: sql`${schema.arcadeSessions.version} + 1`,
        },
      })
      .returning();

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Failed to create/update session:", error);
    return NextResponse.json(
      { error: "Failed to save session" },
      { status: 500 },
    );
  }
}
```

### DELETE /api/arcade-session

```typescript
export async function DELETE() {
  try {
    const viewerId = await getViewerId();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.guestId, viewerId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db
      .update(schema.arcadeSessions)
      .set({ isActive: false })
      .where(eq(schema.arcadeSessions.userId, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to end session:", error);
    return NextResponse.json(
      { error: "Failed to end session" },
      { status: 500 },
    );
  }
}
```

---

## Phase 6: Navigation Guard & Auto-Resume

### Arcade Guard Hook

**File: `apps/web/src/hooks/useArcadeGuard.ts`**

```typescript
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useArcadeSocket } from "./useArcadeSocket";

export function useArcadeGuard() {
  const router = useRouter();
  const { socket } = useArcadeSocket();

  const { data: sessionData, isLoading } = useQuery({
    queryKey: ["arcadeSession"],
    queryFn: async () => {
      const res = await fetch("/api/arcade-session");
      if (!res.ok) return null;
      const data = await res.json();
      return data.session;
    },
  });

  useEffect(() => {
    if (isLoading || !sessionData) return;

    const currentPath = window.location.pathname;

    // If there's an active session and we're not already there
    if (sessionData.isActive && sessionData.gameUrl !== currentPath) {
      console.log("🎮 Resuming active game:", sessionData.gameUrl);
      router.replace(sessionData.gameUrl);
    }

    // Join socket room for this session
    if (socket) {
      socket.emit("join-arcade-session", {
        userId: sessionData.userId,
      });
    }
  }, [sessionData, isLoading, router, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on("arcade-exited", () => {
      console.log("🚪 Arcade exited from another device");
      router.push("/games");
    });

    return () => {
      socket.off("arcade-exited");
    };
  }, [socket, router]);

  return { session: sessionData, isLoading };
}
```

### Apply to Pages

Use in:

- `/arcade/page.tsx`
- `/arcade/matching/page.tsx`
- `/arcade/memory-quiz/page.tsx`
- `/arcade/complement-race/page.tsx`

```typescript
export default function MatchingPage() {
  useArcadeGuard() // Auto-redirects if different game active

  return <MatchingGame />
}
```

---

## Phase 7: Exit Button in Mini Nav

**File: `apps/web/src/components/PageWithNav.tsx`**

Update to add exit button:

```typescript
import { useArcadeSocket } from '@/hooks/useArcadeSocket'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function PageWithNav({ emphasizeGameContext, ...props }) {
  const { socket } = useArcadeSocket()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { mutate: exitArcade } = useMutation({
    mutationFn: async () => {
      await fetch('/api/arcade-session', { method: 'DELETE' })
    },
    onSuccess: () => {
      socket?.emit('exit-arcade', { userId: /* get from context */ })
      queryClient.invalidateQueries(['arcadeSession'])
      router.push('/games')
    },
  })

  return (
    <div>
      {emphasizeGameContext && (
        <button
          onClick={() => exitArcade()}
          className={css({
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            bg: 'red.500',
            color: 'white',
            px: '4',
            py: '2',
            rounded: 'lg',
            fontWeight: 'bold',
            cursor: 'pointer',
            _hover: { bg: 'red.600' },
          })}
        >
          🚪 Exit Game
        </button>
      )}
      {/* Rest of nav */}
    </div>
  )
}
```

---

## Phase 8: Route Migration

### Move Games to /arcade/\*

```bash
# Create new directories
mkdir -p apps/web/src/app/arcade/matching
mkdir -p apps/web/src/app/arcade/memory-quiz
mkdir -p apps/web/src/app/arcade/complement-race

# Move game files
mv apps/web/src/app/games/matching/* apps/web/src/app/arcade/matching/
mv apps/web/src/app/games/memory-quiz/* apps/web/src/app/arcade/memory-quiz/
mv apps/web/src/app/games/complement-race/* apps/web/src/app/arcade/complement-race/

# Keep /games as landing page
# apps/web/src/app/games/page.tsx remains
```

### Update Game URLs

**File: `apps/web/src/components/GameSelector.tsx`**

```typescript
export const GAMES_CONFIG = {
  "memory-lightning": {
    // ...
    url: "/arcade/memory-quiz", // Changed from /games/memory-quiz
  },
  "battle-arena": {
    // ...
    url: "/arcade/matching", // Changed from /games/matching
  },
  "complement-race": {
    // ...
    url: "/arcade/complement-race", // Changed from /games/complement-race
  },
  // ...
};
```

---

## Phase 9: TTL & Session Cleanup

### Cleanup Utility

**File: `apps/web/src/lib/arcade-session-cleanup.ts`**

```typescript
import { db, schema } from "@/db";
import { lt } from "drizzle-orm";

export async function cleanupExpiredSessions() {
  const now = new Date();
  const deleted = await db
    .delete(schema.arcadeSessions)
    .where(lt(schema.arcadeSessions.expiresAt, now))
    .returning();

  console.log(`🧹 Cleaned up ${deleted.length} expired arcade sessions`);
  return deleted;
}
```

### Cron API Route

**File: `apps/web/src/app/api/cron/cleanup-sessions/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/arcade-session-cleanup";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaned = await cleanupExpiredSessions();
  return NextResponse.json({
    success: true,
    cleanedCount: cleaned.length,
  });
}
```

### Vercel Cron Config

**File: `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-sessions",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Phase 10: User Feedback (Toast/UI)

### Toast for Rejected Moves

**File: `apps/web/src/components/MoveRejectedToast.tsx`**

```typescript
import { toast } from "sonner";

export function showMoveRejectedToast(error: string) {
  const userFriendlyMessage = getUserFriendlyError(error);

  toast.error("Move Invalid", {
    description: userFriendlyMessage,
    duration: 3000,
    action: {
      label: "Got it",
      onClick: () => {},
    },
  });
}

function getUserFriendlyError(error: string): string {
  const errorMap: Record<string, string> = {
    "Card already matched": "That card has already been matched!",
    "Too many cards flipped": "Please wait for cards to flip back",
    "Not your turn": "Wait for your turn!",
    "Cards do not match":
      "Those cards don't match - server verification failed",
    "Card not found": "Invalid card selection",
    "State out of sync": "Game state was updated by another device",
  };

  return errorMap[error] || "Invalid move - please try again";
}
```

### Pending State UI

In game components:

```typescript
const { state, applyMove, isPending } = useOptimisticGameState(
  initialState,
  'battle-arena',
  userId
)

return (
  <div className={css({
    opacity: isPending ? 0.7 : 1,
    pointerEvents: isPending ? 'none' : 'auto',
    transition: 'opacity 0.2s'
  })}>
    {isPending && (
      <div className={css({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        bg: 'white',
        p: 4,
        rounded: 'lg',
        shadow: 'lg',
      })}>
        ⏳ Verifying move...
      </div>
    )}
    {/* Game UI */}
  </div>
)
```

---

## Implementation Checklist

### Database & Schema

- [ ] Create `arcade_sessions` table schema
- [ ] Generate and run migration
- [ ] Add TTL cleanup utility
- [ ] Create cron job for cleanup

### WebSocket Infrastructure

- [ ] Install socket.io dependencies
- [ ] Create custom Next.js server
- [ ] Implement socket server with rooms
- [ ] Add move validation in socket handlers

### Game Validation

- [ ] Create validation types/interfaces
- [ ] Implement MatchingGameValidator
- [ ] Create validator registry
- [ ] Add validators for other games (memory-quiz, complement-race)

### Client Integration

- [ ] Create useArcadeSocket hook
- [ ] Create useOptimisticGameState hook
- [ ] Implement optimistic reducer with rollback
- [ ] Add socket event listeners

### API Routes

- [ ] GET /api/arcade-session
- [ ] POST /api/arcade-session
- [ ] DELETE /api/arcade-session

### Navigation & UX

- [ ] Create useArcadeGuard hook
- [ ] Apply guard to all arcade pages
- [ ] Add exit button to mini nav
- [ ] Create move rejection toast component
- [ ] Add pending state UI

### Route Migration

- [ ] Move /games/matching → /arcade/matching
- [ ] Move /games/memory-quiz → /arcade/memory-quiz
- [ ] Move /games/complement-race → /arcade/complement-race
- [ ] Update GAMES_CONFIG URLs
- [ ] Keep /games as landing page

### Testing

- [ ] Test single device reload (should resume)
- [ ] Test multi-tab sync
- [ ] Test cross-device sync
- [ ] Test exit button (all devices)
- [ ] Test move rejection/rollback
- [ ] Test TTL cleanup
- [ ] Test version conflicts

---

## Success Criteria

1. ✅ User starts game in tab A, opens tab B → sees same game
2. ✅ User reloads page → returns to exact game state
3. ✅ User starts game on desktop, opens mobile → synced state
4. ✅ Invalid move → rejected with user-friendly message, UI rolls back
5. ✅ Exit button → all tabs/devices return to /games
6. ✅ Sessions older than 24h → automatically cleaned up
7. ✅ All game routes under /arcade/\*

---

## Notes

- **Version locking**: Prevents concurrent edits from different devices causing conflicts
- **Optimistic updates**: UI feels instant, server validates asynchronously
- **Shared validators**: Same logic client & server = consistent behavior
- **TTL**: Automatic cleanup prevents database bloat
- **WebSocket rooms**: Efficient broadcast to user's devices only

---

## Critical Design Decision: Guest ID vs User ID

### The Problem (Discovered During Implementation)

The system has TWO different user identifiers:

1. **`users.guestId`** (UUID from cookie) - What the frontend knows about
   - Stored in HttpOnly cookie
   - Returned by `getViewerId()`
   - Used throughout the API layer
   - Example: `149e3e7e-4006-4a17-9f9f-28b0ec188c28`

2. **`users.id`** (Auto-generated CUID) - Database primary key
   - Auto-generated via `createId()` from `@paralleldrive/cuid2`
   - Used for foreign key relationships
   - Example: `m2rb9gjhhqp2fky171quf1lj`

### Database Schema

```typescript
// apps/web/src/db/schema/users.ts
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  guestId: text("guest_id").notNull().unique(),
  // ...
});

// apps/web/src/db/schema/arcade-sessions.ts
export const arcadeSessions = sqliteTable("arcade_sessions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }), // FK to users.id, NOT guestId
  // ...
});
```

### Why Two IDs?

1. **Guest accounts can upgrade to permanent accounts**
   - `guestId` remains stable (from cookie)
   - But user might get a real email/name later
   - Internal `id` stays the same through the upgrade

2. **Database normalization**
   - Primary keys should be immutable
   - `guestId` comes from external source (cookie)
   - `id` is internally controlled

### The Wrong Approach (Initial Bug)

```typescript
// ❌ WRONG - Tries to use guestId as primary key
await db.insert(schema.users).values({
  id: guestId, // UUID as PK
  guestId: guestId, // Same UUID
});

await db.insert(schema.arcadeSessions).values({
  userId: guestId, // FK constraint fails!
});
```

**Why it fails:**

- User already exists with `id=m2rb9gjhhqp2fky171quf1lj` and `guestId=149e3e7e-...`
- Code tries to insert with `id=149e3e7e-...`
- `onConflictDoNothing()` sees the guestId UNIQUE conflict and skips
- Then tries to create session with `userId=149e3e7e-...`
- But FK expects `users.id`, which is `m2rb9gjhhqp2fky171quf1lj`, not the guestId
- **FOREIGN KEY constraint failed**

### The Correct Approach (Translation Layer)

```typescript
// ✅ CORRECT - Translate guestId → users.id at database boundary
async function getUserIdFromGuestId(
  guestId: string,
): Promise<string | undefined> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, guestId),
    columns: { id: true },
  });
  return user?.id;
}

export async function createArcadeSession(options: CreateSessionOptions) {
  // Find or create user by guestId
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, options.userId), // userId is actually guestId here
  });

  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({
        guestId: options.userId, // Let id auto-generate
      })
      .returning();
    user = newUser;
  }

  // Use the actual database ID for FK
  await db.insert(schema.arcadeSessions).values({
    userId: user.id, // ✅ Actual database ID, not guestId
    // ...
  });
}
```

### API Layer Convention

**The API layer uses `guestId` as the user identifier:**

```typescript
// apps/web/src/lib/viewer.ts
export async function getViewerId(): Promise<string> {
  const viewer = await getViewer();

  switch (viewer.kind) {
    case "user":
      return viewer.session!.user!.id;
    case "guest":
      return viewer.guestId; // ← Returns guestId for guests
  }
}
```

All WebSocket events, API routes, and hooks use this `viewerId` (which is `guestId` for guests).

### Implementation Rules

1. **Frontend/API Layer**: Always use `guestId` (from `getViewerId()`)
2. **Database Boundary**: Translate `guestId` → `users.id` before any FK operations
3. **Never use `guestId` in foreign key constraints** - always use `users.id`
4. **Helper function pattern**: Create `getUserIdFromGuestId()` helpers in database utilities

### Files Updated to Fix This

- `apps/web/src/lib/arcade/session-manager.ts` - Added translation layer
  - `getUserIdFromGuestId()` helper function
  - `createArcadeSession()` now looks up actual user ID
  - `getArcadeSession()` translates guestId before query
  - `applyGameMove()` uses translated ID (via getArcadeSession)
  - `deleteArcadeSession()` uses translated ID (via getArcadeSession)
