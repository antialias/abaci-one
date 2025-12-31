# Session Report Page Redesign Plan

**Created**: December 31, 2024
**Status**: Approved, ready for implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Design Decisions](#design-decisions)
3. [Current State Analysis](#current-state-analysis)
4. [Target Architecture](#target-architecture)
5. [Layout Specifications](#layout-specifications)
6. [Component Specifications](#component-specifications)
7. [Data Loading Changes](#data-loading-changes)
8. [Skill Name Resolution](#skill-name-resolution)
9. [Photo Feature: Offline Work Pipeline](#photo-feature-offline-work-pipeline)
10. [Implementation Phases](#implementation-phases)
11. [Files Reference](#files-reference)

---

## Overview

The session report page (`/practice/[studentId]/summary`) displays results after a practice session. The redesign aims to:

1. **Better visual organization** - separate celebration/stats from analysis from evidence
2. **Surface relevant information** - remove technical jargon, use human-readable skill names
3. **Better horizontal space usage** - multi-column layout on desktop
4. **Serve all user types** - students, teachers, and parents with a single unified design
5. **Support offline practice pipeline** - photos as first-class evidence leading to AI processing

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Small screen navigation | **Scrollspy nav** - fixed element showing current section, clickable to scroll | Not tabs - scrolling is sufficient, just need section awareness |
| Photo AI processing | **Build placeholders now**, actual implementation later | Pipeline not ready, but UI should hint at future capability |
| Teacher mode toggle | **No** - single design for everyone | Avoid complexity, make design work universally |
| Historical trends | **Use all sessions** (not limited to recent N) | More data = better trends |
| Skill name mapping | **Yes** - use `SKILL_CATEGORIES` from `src/constants/skillCategories.ts` | Single source of truth exists |

---

## Current State Analysis

### Current Component Structure

```
page.tsx (Server Component)
├── Data Loading (parallel Promise.all)
│   ├── getPlayer()
│   ├── getActiveSessionPlan()
│   ├── getMostRecentCompletedSession()
│   └── getRecentSessionResults()
│
└── SummaryClient.tsx (Client Component)
    ├── SessionModeBannerProvider
    ├── PageWithNav
    ├── PracticeSubNav
    ├── ContentBannerSlot
    │
    ├── [IF session && hasProblems]
    │   └── SessionSummary.tsx (MONOLITHIC - 890 lines)
    │       ├── Header (date or celebration)
    │       ├── Practice Type Badges
    │       ├── Stats Grid
    │       ├── Session Details
    │       ├── Skills Practiced (collapsible)
    │       ├── Response Timing (auto-pause stats) ← KEEP
    │       ├── Problems to Review
    │       └── AllProblemsSection
    │
    ├── Photos Section
    ├── StartPracticeModal
    └── FullscreenCamera
```

### Identified Issues

1. **Technical jargon exposed**: BKT, skill IDs like "fiveComplements.4=5-1" (note: auto-pause timing info is useful and kept)
2. **No historical context**: Single session view with no trends
3. **Poor horizontal space usage**: Single column, max-width 600px
4. **Monolithic component**: SessionSummary.tsx is 890 lines
5. **Photo feature is secondary**: Should be first-class for offline workflow
6. **No mobile section navigation**: Long scroll with no orientation

### Bugs Found

1. Session duration shows "0 minutes" for short sessions
2. `studentId` prop unused in SessionSummary
3. Photo upload depends on session existing
4. Date formatting can fail on edge cases

---

## Target Architecture

### New Component Structure

```
SummaryPage (Server Component)
├── Data Loading
│   ├── getPlayer()
│   ├── getActiveSessionPlan()
│   ├── getMostRecentCompletedSession()
│   ├── getAllCompletedSessions()        ← NEW: for trends
│   └── getRecentSessionResults()
│
└── SummaryClient (Client Component)
    ├── SessionModeBannerProvider
    ├── PageWithNav
    ├── PracticeSubNav
    │
    ├── ScrollspyNav (mobile only)       ← NEW
    │
    ├── [data-section="overview"]
    │   └── SessionHero                   ← NEW (extracted)
    │       ├── Date Header (or Celebration)
    │       ├── Stats Row (accuracy, score, duration)
    │       ├── Practice Type Badges
    │       └── TrendIndicator            ← NEW
    │
    ├── [data-section="skills"]
    │   └── SkillsPanel                   ← NEW (extracted)
    │       └── Category bars (collapsible to individual skills)
    │
    ├── [data-section="review"]
    │   └── ProblemsToReviewPanel         ← NEW (extracted)
    │       └── Simplified problem cards (max 5, expandable)
    │
    ├── [data-section="evidence"]
    │   └── EvidencePanel                 ← NEW
    │       ├── OfflineWorkSection        ← NEW (photos)
    │       │   ├── Photo thumbnails (150px, clickable)
    │       │   ├── Upload zone
    │       │   ├── Processing placeholder
    │       │   └── "Coming Soon" hint
    │       └── AllProblemsSection (existing, relocated)
    │
    ├── PhotoLightbox                     ← NEW (full-size view)
    └── StartPracticeModal (existing)
```

---

## Layout Specifications

### Desktop (≥1200px): Two-Column Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PracticeSubNav                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │                               │  │                                     │ │
│  │      SESSION HERO             │  │         SKILLS PANEL                │ │
│  │   (Celebration + Score)       │  │    (Category breakdowns)            │ │
│  │                               │  │                                     │ │
│  │   📅 Tuesday, December 31     │  │   Basic Operations          ████░ 8/10│
│  │                               │  │   5-Complements (Add)       ███░░ 6/8 │
│  │   ┌─────┬─────┬─────┐        │  │   10-Complements (Add)      ██░░░ 3/5 │
│  │   │ 85% │12/14│ 8m  │        │  │                                     │ │
│  │   │acc  │right│time │        │  ├─────────────────────────────────────┤ │
│  │   └─────┴─────┴─────┘        │  │                                     │ │
│  │                               │  │    PROBLEMS TO REVIEW               │ │
│  │   🧮 Abacus  🧠 Visualize     │  │                                     │ │
│  │                               │  │   #4  ❌ 23 + 18 = 31 (was 41)     │ │
│  │   ↑ 5% from last session      │  │       Skill: 10-complement         │ │
│  │                               │  │                                     │ │
│  └───────────────────────────────┘  │   #9  ⏱️ 45 − 17 = 28 (slow)       │ │
│                                      │       Took 12s (avg: 5s)           │ │
│  ┌───────────────────────────────┐  │                                     │ │
│  │                               │  │   [Show all 3 problems]             │ │
│  │    OFFLINE WORK (Photos)      │  │                                     │ │
│  │                               │  └─────────────────────────────────────┘ │
│  │   ┌─────┐ ┌─────┐ ┌─────┐    │                                         │
│  │   │ 📷  │ │ 📷  │ │  +  │    │                                         │
│  │   └─────┘ └─────┘ └─────┘    │                                         │
│  │                               │                                         │
│  │   🔮 Coming: Auto-analyze     │                                         │
│  │                               │                                         │
│  ├───────────────────────────────┤                                         │
│  │                               │                                         │
│  │   ▼ All Problems (14)         │                                         │
│  │                               │                                         │
│  └───────────────────────────────┘                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Grid specification**:
- Left column: ~45% width, contains Hero + Evidence
- Right column: ~55% width, contains Skills + Review
- Gap: 1.5rem
- Max container width: 1400px
- Padding: 1.5rem

### Tablet (768-1199px): Stacked with Full Width

```
┌──────────────────────────────────────────────────────────────┐
│  SESSION HERO (full width)                                   │
│  📅 Dec 31  │  85% accuracy  │  12/14 correct  │  8 min      │
│  🧮 Abacus  🧠 Visualize     │  ↑ 5% from last              │
└──────────────────────────────────────────────────────────────┘
┌────────────────────────────┐  ┌────────────────────────────┐
│   Skills Practiced         │  │   Problems to Review       │
│   (full category list)     │  │   (max 5, expandable)      │
└────────────────────────────┘  └────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│   Offline Work (Photos) + All Problems                       │
└──────────────────────────────────────────────────────────────┘
```

### Mobile (<768px): Single Column + Scrollspy

```
┌────────────────────────────┐
│  SESSION HERO              │
│  85% • 12/14 • 8 min       │
│  ↑ 5% from last session    │
└────────────────────────────┘
┌────────────────────────────┐
│  Skills Practiced          │
│  (collapsible categories)  │
└────────────────────────────┘
┌────────────────────────────┐
│  Problems to Review (3)    │
│  (expandable list)         │
└────────────────────────────┘
┌────────────────────────────┐
│  Offline Work              │
│  (photos + upload)         │
└────────────────────────────┘
┌────────────────────────────┐
│  ▼ All Problems (14)       │
└────────────────────────────┘

╔════════════════════════════╗
║ Overview │ Skills │ Review ║  ← Fixed scrollspy nav
║    ●     │        │        ║
╚════════════════════════════╝
```

---

## Component Specifications

### 1. ScrollspyNav

**File**: `src/components/practice/ScrollspyNav.tsx`

**Purpose**: Fixed navigation element on mobile showing current section

**Props**:
```typescript
interface ScrollspyNavProps {
  sections: Array<{
    id: string      // e.g., "overview"
    label: string   // e.g., "Overview"
  }>
}
```

**Behavior**:
- Fixed to bottom of viewport (above any existing bottom nav)
- Uses `IntersectionObserver` to detect current section
- Dot indicator under current section label
- Click label → smooth scroll to section
- Only visible on mobile (< 768px)
- z-index: use `Z_INDEX.FLOATING_UI` from constants

**Visual**:
```
┌────────────────────────────────────────────────────┐
│  Overview    Skills    Review    Evidence          │
│      ●                                             │
└────────────────────────────────────────────────────┘
```

Height: 48px, background: white/gray.900 (theme-aware), subtle top shadow

---

### 2. SessionHero

**File**: `src/components/practice/SessionHero.tsx`

**Purpose**: Top section with celebration (if just completed) + key stats

**Props**:
```typescript
interface SessionHeroProps {
  session: SessionPlan
  studentName: string
  justCompleted: boolean
  trends: SessionTrends | null
  isDark: boolean
}
```

**Contents**:
1. **Header**: Either celebration (when `justCompleted`) or session date
2. **Stats Row**: Three stat cards (Accuracy, Score, Duration)
3. **Practice Type Badges**: Icons + labels for session types
4. **Trend Indicator**: "↑ 5% from last session" (when trends available)

**Celebration Header** (when `justCompleted`):
```
┌─────────────────────────────────────────────┐
│               🌟                            │
│     Great Work, Tommy!                      │
│     Outstanding! You are a math champion!   │
└─────────────────────────────────────────────┘
```
- Background color based on accuracy (green/yellow/orange)
- Emoji based on accuracy (🌟 ≥90%, 🎉 ≥80%, 👍 ≥60%, 💪 <60%)

**Date Header** (when not `justCompleted`):
```
┌─────────────────────────────────────────────┐
│     Tuesday, December 31, 2024              │
└─────────────────────────────────────────────┘
```

**Stats Row**:
```
┌───────────┬───────────┬───────────┐
│    85%    │   12/14   │   8 min   │
│  Accuracy │  Correct  │  Duration │
└───────────┴───────────┴───────────┘
```
- Accuracy: Color-coded (green ≥80%, yellow ≥60%, orange <60%)
- Duration: Show "< 1 min" instead of "0 min" for short sessions

**Practice Type Badges**:
```
🧮 Abacus    🧠 Visualize
```
- Use `PRACTICE_TYPES` from `src/constants/practiceTypes.ts`

**Trend Indicator**:
```
↑ 5% from last session
```
- Green arrow up / red arrow down
- Only show if previous session exists
- Show delta as percentage points

---

### 3. TrendIndicator

**File**: `src/components/practice/TrendIndicator.tsx`

**Purpose**: Small component showing comparison to previous session

**Props**:
```typescript
interface TrendIndicatorProps {
  current: number       // Current accuracy (0-1)
  previous: number | null  // Previous accuracy (0-1), null if no previous
  label?: string        // Default: "from last session"
  isDark: boolean
}
```

**Display**:
- `↑ 5%` (green) when improved
- `↓ 3%` (red) when declined
- `→ Same` (gray) when within 1%
- Nothing when `previous` is null

---

### 4. SkillsPanel

**File**: `src/components/practice/SkillsPanel.tsx`

**Purpose**: Skills breakdown by category with human-readable names

**Props**:
```typescript
interface SkillsPanelProps {
  results: SlotResult[]
  isDark: boolean
}
```

**Key changes from current implementation**:
1. Use `getCategoryDisplayName()` instead of hardcoded `SKILL_CATEGORY_NAMES`
2. Use `getSkillDisplayName()` for individual skills
3. Keep collapsible categories (using `<details>`)
4. Remove BKT mastery percentages (internal metric)

**Display**:
```
Skills Practiced
────────────────────────────────────────────
▼ Basic Operations                    ████░ 8/10
    Direct Addition (1-4)             ███░░ 5/6
    Heaven Bead (5)                   ████░ 3/4

▶ Five Complements (Addition)         ███░░ 6/8

▶ Ten Complements (Addition)          ██░░░ 3/5
```

- Progress bars: neutral blue color (not accuracy-based coloring)
- Categories sorted by `CATEGORY_PRIORITY` from skillCategories.ts

---

### 5. ProblemsToReviewPanel

**File**: `src/components/practice/ProblemsToReviewPanel.tsx`

**Purpose**: List of problems needing attention with annotations

**Props**:
```typescript
interface ProblemsToReviewPanelProps {
  problems: ProblemNeedingAttention[]
  results: SlotResult[]  // For auto-pause calculation
  skillMasteries: Record<string, SkillBktResult>
  totalProblems: number
  isDark: boolean
}
```

**Key changes from current implementation**:
1. **Keep** auto-pause timing section (Response Timing)
2. **Keep** annotated ProblemToReview component (with skill breakdown per term)
3. **Show ALL problems needing attention** - no arbitrary limit (wrong, slow, help-used)
4. **Use human-readable skill names** when showing weak skills (via getSkillDisplayName)

**Distinction from AllProblemsSection**:
- **ProblemsToReviewPanel**: Problems needing attention (flagged for review)
- **AllProblemsSection**: Every problem in the session (complete list, collapsed by default)

**Note**: The existing ProblemToReview component with its progressive disclosure, part type indicators, purpose explanations, and timing details is preserved.

**All correct state**:
```
┌─────────────────────────────────────────────┐
│               🎉                            │
│     Perfect! All problems correct.          │
└─────────────────────────────────────────────┘
```

---

### 6. OfflineWorkSection

**File**: `src/components/practice/OfflineWorkSection.tsx`

**Purpose**: Photos of offline practice work + upload zone

**Props**:
```typescript
interface OfflineWorkSectionProps {
  sessionId: string | null
  playerId: string
  photos: SessionAttachment[]
  onPhotosChange: () => void  // Trigger refetch
  isDark: boolean
}
```

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│  📝 Offline Practice                                │
│                                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌─────────────────┐ │
│  │       │ │       │ │       │ │  + Add Work     │ │
│  │  📷   │ │  📷   │ │  📷   │ │                 │ │
│  │       │ │       │ │  [x]  │ │  Tap to upload  │ │
│  └───────┘ └───────┘ └───────┘ │  photos of work │ │
│                                └─────────────────┘ │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ 🔮 Coming Soon                                  ││
│  │                                                 ││
│  │ We'll soon analyze your worksheets and         ││
│  │ automatically track problems completed,         ││
│  │ just like online practice!                     ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

**Photo thumbnails**:
- Size: 150px × 150px (larger than current 100px)
- Clickable → opens PhotoLightbox
- Delete button on hover (× in corner)
- Border radius: 8px

**Upload zone**:
- Dashed border when empty
- Drag & drop support
- Camera button for mobile
- "Tap to upload photos of work"

**Coming Soon placeholder**:
- Subtle background (gray.50 / gray.800)
- 🔮 emoji
- Brief explanation of future AI feature
- Always visible (not collapsible)

---

### 7. PhotoLightbox

**File**: `src/components/practice/PhotoLightbox.tsx`

**Purpose**: Full-screen photo viewer with navigation

**Props**:
```typescript
interface PhotoLightboxProps {
  photos: SessionAttachment[]
  initialIndex: number
  isOpen: boolean
  onClose: () => void
}
```

**Features**:
- Full-screen overlay (z-index: modal level)
- Image centered and scaled to fit
- Left/right arrows for navigation (keyboard too)
- Close button (× or click outside)
- Current photo indicator (1 of 3)
- Pinch-to-zoom on mobile (optional, can skip for MVP)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│                                              [×]    │
│                                                     │
│     ◄                  📷                     ►     │
│                                                     │
│                                                     │
│                      1 / 3                          │
└─────────────────────────────────────────────────────┘
```

---

## Data Loading Changes

### New Server Function

**File**: `src/lib/curriculum/server.ts`

Add:
```typescript
export async function getAllCompletedSessions(playerId: string): Promise<SessionPlan[]> {
  return db.query.sessionPlans.findMany({
    where: and(
      eq(schema.sessionPlans.playerId, playerId),
      eq(schema.sessionPlans.status, 'completed')
    ),
    orderBy: (plans, { desc }) => [desc(plans.completedAt)],
  })
}
```

### Updated page.tsx

```typescript
const [player, activeSession, allSessions, problemHistory] = await Promise.all([
  getPlayer(studentId),
  getActiveSessionPlan(studentId),
  getAllCompletedSessions(studentId),  // Changed from getMostRecentCompletedSession
  getRecentSessionResults(studentId, 100),
])

// Derive what we need
const completedSession = allSessions[0] ?? null
const previousSession = allSessions[1] ?? null
const sessionToShow = activeSession?.startedAt ? activeSession : completedSession

// Calculate trends
const trends = calculateSessionTrends(sessionToShow, previousSession, allSessions)
```

### Trend Calculation Types

**File**: `src/lib/curriculum/trends.ts` (NEW)

```typescript
export interface SessionTrends {
  // Comparison to last session
  accuracyDelta: number | null        // e.g., 0.05 for +5%
  previousAccuracy: number | null

  // This week stats
  weekSessions: number
  weekProblems: number
  weekAccuracy: number

  // All-time stats
  totalSessions: number
  totalProblems: number
  avgAccuracy: number

  // Streak (consecutive days with practice)
  currentStreak: number
}

export function calculateSessionTrends(
  current: SessionPlan | null,
  previous: SessionPlan | null,
  allSessions: SessionPlan[]
): SessionTrends | null
```

---

## Skill Name Resolution

### New Utility File

**File**: `src/utils/skillDisplay.ts`

```typescript
import { SKILL_CATEGORIES, type SkillCategoryKey } from '@/constants/skillCategories'

/**
 * Get human-readable display name for a full skill ID
 *
 * @example
 * getSkillDisplayName("fiveComplements.4=5-1") // "+4 = +5 - 1"
 * getSkillDisplayName("basic.directAddition")  // "Direct Addition (1-4)"
 */
export function getSkillDisplayName(fullSkillId: string): string {
  const dotIndex = fullSkillId.indexOf('.')
  if (dotIndex === -1) return fullSkillId

  const category = fullSkillId.slice(0, dotIndex)
  const shortKey = fullSkillId.slice(dotIndex + 1)

  const categoryData = SKILL_CATEGORIES[category as SkillCategoryKey]
  if (!categoryData) return shortKey || fullSkillId

  const skills = categoryData.skills as Record<string, string>
  return skills[shortKey] || shortKey || fullSkillId
}

/**
 * Get category display name from category ID
 *
 * @example
 * getCategoryDisplayName("fiveComplements") // "Five Complements (Addition)"
 * getCategoryDisplayName("tenComplementsSub") // "Ten Complements (Subtraction)"
 */
export function getCategoryDisplayName(categoryId: string): string {
  const categoryData = SKILL_CATEGORIES[categoryId as SkillCategoryKey]
  return categoryData?.name || categoryId
}

/**
 * Parse a full skill ID into category and short key
 */
export function parseSkillId(fullSkillId: string): { category: string; shortKey: string } {
  const dotIndex = fullSkillId.indexOf('.')
  if (dotIndex === -1) {
    return { category: '', shortKey: fullSkillId }
  }
  return {
    category: fullSkillId.slice(0, dotIndex),
    shortKey: fullSkillId.slice(dotIndex + 1),
  }
}
```

### Source of Truth

The canonical skill names are in `src/constants/skillCategories.ts`:

```typescript
// Category names
SKILL_CATEGORIES.basic.name = 'Basic Skills'
SKILL_CATEGORIES.fiveComplements.name = 'Five Complements (Addition)'
SKILL_CATEGORIES.tenComplements.name = 'Ten Complements (Addition)'
SKILL_CATEGORIES.fiveComplementsSub.name = 'Five Complements (Subtraction)'
SKILL_CATEGORIES.tenComplementsSub.name = 'Ten Complements (Subtraction)'
SKILL_CATEGORIES.advanced.name = 'Advanced Multi-Column Operations'

// Individual skill names (examples)
SKILL_CATEGORIES.basic.skills.directAddition = 'Direct Addition (1-4)'
SKILL_CATEGORIES.basic.skills.heavenBead = 'Heaven Bead (5)'
SKILL_CATEGORIES.fiveComplements.skills['4=5-1'] = '+4 = +5 - 1'
SKILL_CATEGORIES.tenComplements.skills['9=10-1'] = '+9 = +10 - 1'
SKILL_CATEGORIES.tenComplementsSub.skills['-9=+1-10'] = '-9 = +1 - 10'
```

---

## Photo Feature: Offline Work Pipeline

### Current State (What We Build Now)

Photos are uploaded and displayed as evidence of offline practice.

**UI includes**:
1. Larger thumbnails (150px)
2. Click to view full-size (PhotoLightbox)
3. Delete functionality
4. "Coming Soon" placeholder explaining future AI analysis

### Future State (Placeholder For Now)

```
Photos → AI Processing → Problem Extraction → Results Generation → BKT Integration
         ↓
    Same format as online sessions
         ↓
    Full stats, skill tracking, mastery updates
```

**Photo states** (data model for future):
- `uploaded` - Photo saved, not yet analyzed
- `processing` - AI analyzing (show spinner)
- `processed` - Analysis complete (show ✓, link to results)
- `failed` - Could not analyze (show ⚠️)

**Current implementation**: All photos are `uploaded` state. No processing yet.

---

## Implementation Phases

### Phase 1: Foundation + Skill Display

**Goal**: Create utility functions and see skill names update across the app

**Deliverables**:
1. `src/utils/skillDisplay.ts` - skill name resolution utilities
2. Update `SessionSummary.tsx` to use new utilities instead of hardcoded names
3. Update `SkillsPanel` section in SessionSummary to show human-readable names

**Testable outcome**:
- Visit `/practice/[studentId]/summary`
- Skills section shows "Five Complements (Addition)" instead of "fiveComplements"
- Individual skills show "+4 = +5 - 1" instead of "4=5-1"

**Files to create/modify**:
- CREATE: `src/utils/skillDisplay.ts`
- MODIFY: `src/components/practice/SessionSummary.tsx`

---

### Phase 2: PhotoLightbox + Delete

**Goal**: Photos are viewable full-size and deletable

**Deliverables**:
1. `src/components/practice/PhotoLightbox.tsx`
2. Add delete button to photo thumbnails
3. Add click-to-expand to photo thumbnails
4. Larger thumbnails (150px)

**Testable outcome**:
- Visit summary page with photos
- Click photo → opens full-size lightbox
- Navigate between photos with arrows
- Close lightbox with × or Escape
- Hover photo → shows delete button
- Delete photo → removes it

**Files to create/modify**:
- CREATE: `src/components/practice/PhotoLightbox.tsx`
- MODIFY: `src/app/practice/[studentId]/summary/SummaryClient.tsx` (photos section)

---

### Phase 3: Clarify Problem Sections

**Goal**: Ensure clear distinction between "Problems to Review" and "All Problems"

**Two distinct sections**:
1. **Problems to Review** - Shows ALL problems needing attention (wrong, slow, help-used). No limit - if there are 15 wrong problems, show all 15. These are the ones the student/teacher needs to focus on.
2. **All Problems** (AllProblemsSection) - Shows every problem in the session, typically collapsed. Useful for reviewing the complete session.

**Deliverables**:
1. Verify "Problems to Review" shows all flagged problems (no arbitrary limit)
2. Ensure "All Problems" section is clearly labeled and collapsible
3. Human-readable skill names throughout (already done in Phase 1)

**Note**: Auto-pause timing section and annotated ProblemToReview are kept as-is (user preference).

**Testable outcome**:
- Visit summary page after completing session with many mistakes
- "Problems to Review" shows ALL wrong/slow/help-used problems (no limit)
- "All Problems" section shows complete session (collapsed by default)
- Clear visual distinction between the two sections
- Skill names are human-readable ("+9 = +10 - 1")

**Files to modify**:
- `src/components/practice/SessionSummary.tsx` (verify no limits, clarify labels)

---

### Phase 4: Extract SessionHero + Trends

**Goal**: Top section is extracted and shows historical comparison

**Deliverables**:
1. `src/components/practice/SessionHero.tsx`
2. `src/components/practice/TrendIndicator.tsx`
3. `src/lib/curriculum/trends.ts` - trend calculation
4. Update `page.tsx` to load all sessions
5. Fix "0 minutes" bug (show "< 1 min")

**Testable outcome**:
- Visit summary page
- Stats section is visually the same but code is cleaner
- Duration shows "< 1 min" for short sessions
- If previous session exists, shows "↑ 5% from last session" or similar
- Works correctly for first-ever session (no trend shown)

**Files to create/modify**:
- CREATE: `src/components/practice/SessionHero.tsx`
- CREATE: `src/components/practice/TrendIndicator.tsx`
- CREATE: `src/lib/curriculum/trends.ts`
- MODIFY: `src/app/practice/[studentId]/summary/page.tsx`
- MODIFY: `src/app/practice/[studentId]/summary/SummaryClient.tsx`

---

### Phase 5: Extract SkillsPanel + ProblemsPanel

**Goal**: Skills and problems sections are separate components

**Deliverables**:
1. `src/components/practice/SkillsPanel.tsx`
2. `src/components/practice/ProblemsToReviewPanel.tsx`
3. Update SummaryClient to use new components

**Testable outcome**:
- Visit summary page
- Skills section works exactly as before (but cleaner code)
- Problems section works exactly as before (but cleaner code)
- No visual changes, just code organization

**Files to create/modify**:
- CREATE: `src/components/practice/SkillsPanel.tsx`
- CREATE: `src/components/practice/ProblemsToReviewPanel.tsx`
- MODIFY: `src/app/practice/[studentId]/summary/SummaryClient.tsx`

---

### Phase 6: OfflineWorkSection + Coming Soon

**Goal**: Photos section is extracted with future pipeline placeholder

**Deliverables**:
1. `src/components/practice/OfflineWorkSection.tsx`
2. "Coming Soon" placeholder UI
3. Integrate PhotoLightbox

**Testable outcome**:
- Visit summary page
- Photos section has new title "Offline Practice"
- "Coming Soon" box visible explaining future AI analysis
- Photos still uploadable/viewable/deletable

**Files to create/modify**:
- CREATE: `src/components/practice/OfflineWorkSection.tsx`
- MODIFY: `src/app/practice/[studentId]/summary/SummaryClient.tsx`

---

### Phase 7: Multi-Column Layout

**Goal**: Desktop uses horizontal space properly

**Deliverables**:
1. Two-column grid layout for desktop (≥1200px)
2. Adjusted tablet layout (768-1199px)
3. Mobile stays single column

**Testable outcome**:
- Desktop: Hero + Evidence on left, Skills + Review on right
- Tablet: Full-width hero, then 2-col skills/review, then evidence
- Mobile: Single column (no change)
- Resize browser to test breakpoints

**Files to modify**:
- `src/app/practice/[studentId]/summary/SummaryClient.tsx`

---

### Phase 8: ScrollspyNav for Mobile

**Goal**: Mobile users can navigate between sections

**Deliverables**:
1. `src/components/practice/ScrollspyNav.tsx`
2. Add `data-section` attributes to sections
3. Integrate scrollspy on mobile only

**Testable outcome**:
- Mobile viewport: fixed nav bar at bottom
- Shows "Overview | Skills | Review | Evidence"
- Dot indicator shows current section on scroll
- Tap label → smooth scrolls to section
- Desktop: scrollspy nav is hidden

**Files to create/modify**:
- CREATE: `src/components/practice/ScrollspyNav.tsx`
- MODIFY: `src/app/practice/[studentId]/summary/SummaryClient.tsx`

---

### Phase 9: Cleanup + Delete SessionSummary

**Goal**: Remove old monolithic component, final polish

**Deliverables**:
1. Delete `src/components/practice/SessionSummary.tsx`
2. Delete unused `onPracticeAgain` references (already removed)
3. Update component index exports
4. Final responsive testing
5. Run pre-commit

**Testable outcome**:
- All functionality works as before
- Codebase is cleaner (no 890-line monolith)
- Types check, lint passes
- Mobile, tablet, desktop all work

**Files to modify**:
- DELETE: `src/components/practice/SessionSummary.tsx`
- MODIFY: `src/components/practice/index.ts` (exports)

---

## Files Reference

### Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `src/utils/skillDisplay.ts` | 1 | Skill name resolution |
| `src/components/practice/PhotoLightbox.tsx` | 2 | Full-size photo viewer |
| `src/components/practice/SessionHero.tsx` | 4 | Top stats section |
| `src/components/practice/TrendIndicator.tsx` | 4 | Historical comparison |
| `src/lib/curriculum/trends.ts` | 4 | Trend calculations |
| `src/components/practice/SkillsPanel.tsx` | 5 | Skills breakdown |
| `src/components/practice/ProblemsToReviewPanel.tsx` | 5 | Review section |
| `src/components/practice/OfflineWorkSection.tsx` | 6 | Photos + upload |
| `src/components/practice/ScrollspyNav.tsx` | 8 | Mobile section nav |

### Files to Modify

| File | Phases | Changes |
|------|--------|---------|
| `src/components/practice/SessionSummary.tsx` | 1, 3 | Use skill utilities, add problem limiting |
| `src/app/practice/[studentId]/summary/page.tsx` | 4 | Load all sessions |
| `src/app/practice/[studentId]/summary/SummaryClient.tsx` | 2, 4-8 | New layout, components |
| `src/components/practice/index.ts` | 9 | Update exports |

### Files to Delete

| File | Phase | Reason |
|------|-------|--------|
| `src/components/practice/SessionSummary.tsx` | 9 | Replaced by smaller components |

---

## Success Criteria

The redesign is complete when:

1. ✅ Skills show human-readable names ("Five Complements (Addition)" not "fiveComplements")
2. ✅ No BKT percentages visible (internal metric)
3. ✅ Auto-pause timing info preserved (Response Timing section)
4. ✅ Annotated problem display preserved (ProblemToReview with progressive disclosure)
5. ✅ Photos viewable full-size with lightbox
6. ✅ Photos deletable
7. ✅ "Coming Soon" placeholder for AI analysis
8. ✅ Historical trend indicator ("↑ 5% from last session")
9. ✅ Desktop uses 2-column layout
10. ✅ Mobile has scrollspy navigation
11. ✅ Duration shows "< 1 min" not "0 min"
12. ✅ "Problems to Review" shows ALL flagged problems (no limit)
13. ✅ "All Problems" section shows complete session (collapsed)
14. ✅ All tests pass, lint clean
15. ✅ SessionSummary.tsx deleted (code split into smaller components)
