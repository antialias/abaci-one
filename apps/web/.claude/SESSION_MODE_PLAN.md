# Session Mode Unified Architecture

## Problem Statement

The current architecture has three independent BKT computations:

1. Dashboard computes BKT locally for skill cards
2. Modal computes BKT locally for "Targeting: X" preview
3. Session planner computes BKT when generating problems

This creates potential mismatches where the modal shows one thing but the session planner does another ("rug-pulling").

Additionally, students see conflicting signals:

- Header: "Addition: +1 (Direct Method)"
- Tutorial notice: "You've unlocked: +1 = +5 - 4"
- Targeting: "+3 = +5 - 2"

## Solution: Unified SessionMode

A single `SessionMode` object computed once and used everywhere:

- Dashboard (what banner to show)
- Modal (what CTA to display)
- Session planner (what problems to generate)

### Key Principles

1. **No rug-pulling**: Whatever the modal shows IS what configures problem generation
2. **Transparent blocking**: When remediation blocks promotion, student knows why
3. **Single source of truth**: One computation, used everywhere

## SessionMode Type Definition

```typescript
interface SkillInfo {
  skillId: string;
  displayName: string;
  pKnown: number; // 0-1 probability
}

type SessionMode =
  | {
      type: "remediation";
      weakSkills: SkillInfo[];
      focusDescription: string;
      // What promotion is being blocked
      blockedPromotion?: {
        nextSkill: SkillInfo;
        reason: string; // "Strengthen +3 and +5-2 first"
      };
    }
  | {
      type: "progression";
      nextSkill: SkillInfo;
      tutorialRequired: boolean;
      focusDescription: string;
    }
  | {
      type: "maintenance";
      focusDescription: string; // "All skills strong - mixed practice"
    };
```

## UI States

### Dashboard Banner Area

**Progression Mode:**

```
┌────────────────────────────────────────────────────────────┐
│ 🌟 New Skill Unlocked!                                     │
│ You're ready to learn: +5 - 4                              │
│                        [Start Practice]                    │
└────────────────────────────────────────────────────────────┘
```

**Remediation Mode (with blocked promotion):**

```
┌────────────────────────────────────────────────────────────┐
│ 🔒 Almost there!                                           │
│ Strengthen +3 and +5-2 to unlock: +5 - 4                   │
│ Progress: ████████░░ 80%                                   │
│                        [Practice Now]                      │
└────────────────────────────────────────────────────────────┘
```

**Maintenance Mode:**

```
┌────────────────────────────────────────────────────────────┐
│ ✨ All skills strong!                                      │
│ Keep practicing to maintain mastery                        │
│                        [Practice]                          │
└────────────────────────────────────────────────────────────┘
```

### Modal CTA Area

**Progression Mode:**

```
┌────────────────────────────────────────────────────────────┐
│ 🌟 You've unlocked: +5 - 4                                 │
│    Start with a quick tutorial                             │
│ ┌────────────────────────────────────────────────────────┐ │
│ │            🎓 Begin Tutorial →                         │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**Remediation Mode:**

```
┌────────────────────────────────────────────────────────────┐
│ 💪 Strengthening weak skills                               │
│    Targeting: +3, +5-2                                     │
│    Then you'll unlock: +5 - 4                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │               Let's Go! →                              │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. Dashboard loads → GET /api/curriculum/{playerId}/session-mode
                   → Returns SessionMode (computed once)
                   → Dashboard displays appropriate banner

2. User clicks "Start Practice" → Modal opens
                                → Modal receives SAME SessionMode
                                → Displays matching CTA

3. User clicks "Let's Go!" → generateSessionPlan(sessionMode)
                           → Session planner uses the SAME mode
                           → Problems generated match what modal showed
```

## Implementation Files

### New Files

- `src/lib/curriculum/session-mode.ts` - Core `getSessionMode()` function
- `src/hooks/useSessionMode.ts` - React Query hook
- `src/app/api/curriculum/[playerId]/session-mode/route.ts` - API endpoint
- `src/components/practice/SessionModeBanner.tsx` - Unified banner component
- `src/stories/SessionModeBanner.stories.tsx` - Storybook stories

### Modified Files

- `src/components/practice/StartPracticeModal.tsx` - Use SessionMode instead of local BKT
- `src/app/practice/[studentId]/dashboard/DashboardClient.tsx` - Use SessionModeBanner
- `src/lib/curriculum/session-planner.ts` - Accept SessionMode as input
- `src/hooks/useNextSkillToLearn.ts` - Deprecate or derive from useSessionMode

## Implementation Order

1. Create `SessionMode` types and `getSessionMode()` function
2. Create API endpoint
3. Create `useSessionMode()` hook
4. Create `SessionModeBanner` component with all 3 modes
5. Add Storybook stories for all states
6. Update Dashboard to use new banner
7. Update Modal to use SessionMode
8. Update session planner to accept SessionMode
9. Remove duplicate BKT computations
10. Test end-to-end flow
