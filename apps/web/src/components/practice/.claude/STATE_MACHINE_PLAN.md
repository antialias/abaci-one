# Practice Session State Machine Refactor Plan

## Problem Statement

Multiple independent boolean flags (`isPaused`, `isSubmitting`, `isTransitioning`) combined with attempt state create implicit states and scattered conditions. We need a state machine with **atomic migration** - no legacy state coexisting with state machine state.

## Current State Inventory

**Session-level (ActiveSession.tsx):**

- `isPaused: boolean`
- `isSubmitting: boolean`
- `isTransitioning: boolean`
- `outgoingAttempt: OutgoingAttempt | null`

**Attempt-level (useProblemAttempt.ts):**

- `feedback: 'none' | 'correct' | 'incorrect'`
- `manualSubmitRequired: boolean`
- `rejectedDigit: string | null`
- `helpTermIndex: number | null`

## Proposed Phase Type

```typescript
type InteractionPhase =
  | { phase: "loading" }
  | { phase: "inputting"; attempt: ProblemAttempt }
  | { phase: "helpMode"; attempt: ProblemAttempt; helpContext: HelpContext }
  | { phase: "submitting"; attempt: ProblemAttempt }
  | {
      phase: "showingFeedback";
      attempt: ProblemAttempt;
      result: "correct" | "incorrect";
    }
  | {
      phase: "transitioning";
      outgoing: OutgoingAttempt;
      incoming: ProblemAttempt;
    }
  | {
      phase: "paused";
      resumePhase: Exclude<InteractionPhase, { phase: "paused" }>;
    };

interface HelpContext {
  termIndex: number;
  currentValue: number;
  targetValue: number;
  term: number;
}
```

## State Transition Diagram

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    v                                         │
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌───────────┐ │
│ loading │───>│inputting │───>│submitting│───>│showingFeed│─┘
└─────────┘    └──────────┘    └──────────┘    │   back    │
                    │               ^          └───────────┘
                    │               │                │
                    v               │                │ (if incorrect,
               ┌──────────┐        │                │  end of part)
               │ helpMode │────────┘                │
               └──────────┘                         v
                                              ┌───────────┐
                                              │transitioning│──> inputting
                                              └───────────┘
                                              (if correct &
                                               more problems)

Any phase (except paused) ──pause──> paused ──resume──> previous phase
```

## Migration Strategy: Atomic Steps

Each step is a complete, testable unit. **No step leaves dual state management.**

### Step 1: Create hook skeleton with tests

- Create `useInteractionPhase.ts` with type definitions
- Create test file with phase transition tests
- Hook is complete but not yet integrated
- **Commit**: "feat: add useInteractionPhase hook with tests"

### Step 2: Migrate `isSubmitting` + `feedback`

- Phase handles: `inputting` → `submitting` → `showingFeedback`
- DELETE `isSubmitting` useState from ActiveSession
- DELETE `feedback` from ProblemAttempt (now in phase)
- Update all UI that checked these flags to use phase
- **Commit**: "refactor: migrate submitting/feedback state to phase machine"

### Step 3: Migrate `isTransitioning` + `outgoingAttempt`

- Phase handles: `showingFeedback` → `transitioning` → `inputting`
- DELETE `isTransitioning` useState
- DELETE `outgoingAttempt` useState
- Outgoing data now lives in `{ phase: 'transitioning', outgoing, incoming }`
- **Commit**: "refactor: migrate transition state to phase machine"

### Step 4: Migrate `helpTermIndex`

- Phase handles: `inputting` ↔ `helpMode`
- DELETE `helpTermIndex` from ProblemAttempt
- `helpContext` now lives in `{ phase: 'helpMode', helpContext }`
- **Commit**: "refactor: migrate help mode state to phase machine"

### Step 5: Migrate `isPaused`

- Phase handles: `* → paused → resumePhase`
- DELETE `isPaused` useState
- Previous phase stored in `{ phase: 'paused', resumePhase }`
- **Commit**: "refactor: migrate pause state to phase machine"

### Step 6: Clean up ProblemAttempt

- Review what's left in ProblemAttempt
- Should only contain input-level state: `userAnswer`, `correctionCount`, `rejectedDigit`, `startTime`, etc.
- Remove any redundant derived state
- **Commit**: "refactor: simplify ProblemAttempt to input-only state"

## Critical Rules

1. **No dual state**: When phase machine manages X, delete the old X immediately
2. **Tests before migration**: Write failing tests for the new behavior, then migrate
3. **One aspect per step**: Each commit migrates one conceptual piece
4. **All tests pass**: Each commit leaves tests green
5. **No "temporary" bridges**: No helper functions that translate between old and new

## What Stays in ProblemAttempt

After migration, `ProblemAttempt` becomes purely about **input state for the current answer**:

```typescript
interface ProblemAttempt {
  problem: GeneratedProblem;
  slotIndex: number;
  partIndex: number;
  startTime: number;
  userAnswer: string;
  correctionCount: number;
  manualSubmitRequired: boolean; // derived from correctionCount
  rejectedDigit: string | null; // transient animation state
}
```

Removed from ProblemAttempt (now in phase):

- `feedback` → phase is `showingFeedback`
- `helpTermIndex` → phase is `helpMode`
- `confirmedTermCount` → part of `helpContext` in `helpMode` phase
