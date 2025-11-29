# User Warning Improvements for Problem Space Constraints

## Current Implementation

### Warning Banner (Implemented)

**Location:** Preview pane, centered overlay
**Component:** `DuplicateWarningBanner.tsx`
**Trigger:** When `duplicateRisk !== 'none'` (ratio ≥ 0.3)

**Strengths:**

- ✅ Visible and prominent
- ✅ Dismissable
- ✅ Shows in preview (where user sees the actual worksheet)
- ✅ Provides actionable recommendations
- ✅ Collapsible details for advanced users

**Weaknesses:**

- ❌ Reactive (shown after user has configured)
- ❌ Can be dismissed and forgotten
- ❌ Not shown in mastery+mixed mode
- ❌ No visual feedback in config panel
- ❌ Requires user to generate preview first

---

## Recommended Improvements

### 1. Proactive Config Panel Indicator (HIGH PRIORITY)

**Where:** Next to pages/problemsPerPage sliders in ConfigPanel
**When:** Live update as user adjusts settings
**Why:** Prevents users from creating invalid configs in the first place

#### Design

```typescript
interface ProblemSpaceIndicator {
  estimatedSpace: number;
  requestedProblems: number;
  status: "plenty" | "tight" | "insufficient";
  color: "green" | "yellow" | "red";
}
```

**Visual appearance:**

```
┌─ Problems Per Page ────────────────┐
│ [──────●──────] 20                 │
│                                     │
│ Problem Space: ~4,050 available   │ ← Green text
│ ✓ Plenty of unique problems       │
└────────────────────────────────────┘

┌─ Problems Per Page ────────────────┐
│ [──────────●──────] 50              │
│                                     │
│ Problem Space: ~45 available       │ ← Yellow text
│ ⚠ Limited unique problems          │
└────────────────────────────────────┘

┌─ Problems Per Page ────────────────┐
│ [────────────●──] 100               │
│                                     │
│ Problem Space: ~45 available       │ ← Red text
│ ✕ Insufficient - duplicates likely │
│ → Try increasing digit range       │
└────────────────────────────────────┘
```

**Implementation:**

```typescript
// In ConfigPanel component
const estimatedSpace = useMemo(() => {
  return estimateUniqueProblemSpace(
    formState.digitRange,
    formState.pAnyStart,
    formState.operator,
  );
}, [formState.digitRange, formState.pAnyStart, formState.operator]);

const requestedProblems = formState.problemsPerPage * formState.pages;
const ratio = requestedProblems / estimatedSpace;

const spaceIndicator: ProblemSpaceIndicator = {
  estimatedSpace,
  requestedProblems,
  status: ratio < 0.5 ? "plenty" : ratio < 0.8 ? "tight" : "insufficient",
  color: ratio < 0.5 ? "green" : ratio < 0.8 ? "yellow" : "red",
};
```

**Files to modify:**

- `components/config-panel/ConfigPanel.tsx` (or respective sections)
- Possibly create `components/config-panel/ProblemSpaceIndicator.tsx`

---

### 2. Slider Constraints with Visual Feedback (MEDIUM PRIORITY)

**Where:** Pages and problemsPerPage sliders
**When:** User drags slider past recommended limits
**Why:** Prevents invalid configurations while allowing override

#### Design

**Visual feedback:**

- Green track: Safe range (0-50% of space)
- Yellow track: Caution range (50-80% of space)
- Red track: Over limit (80%+ of space)

**Dynamic max values:**

- Suggest max pages based on current settings
- Show "soft limit" vs "hard limit"
- Allow override with confirmation

**Example:**

```
┌─ Pages ────────────────────────────┐
│ [──●──|───────] 2 pages            │ ← Slider in yellow zone
│      ↑                              │
│   Recommended max: 2                │
│   (45 unique problems available)    │
│                                     │
│ [Continue anyway] [Reduce to 1]    │
└────────────────────────────────────┘
```

**Implementation:**

```typescript
const recommendedMaxPages = Math.floor((estimatedSpace * 0.5) / problemsPerPage)

// Slider shows visual zones
<Slider
  value={formState.pages}
  max={10} // Hard limit
  onChange={handlePagesChange}
  zones={[
    { end: recommendedMaxPages, color: 'green' },
    { end: recommendedMaxPages * 1.6, color: 'yellow' },
    { end: 10, color: 'red' }
  ]}
/>
```

---

### 3. Smart Mode Suggestion (MEDIUM PRIORITY)

**Where:** Config panel when user selects constrained settings
**When:** High pages + constrained digit range + manual mode
**Why:** Educate users about Smart Mode's auto-scaling benefits

#### Design

```
┌─ Mode Selection ──────────────────────────────────┐
│ ○ Smart Mode (Recommended for varied difficulty) │
│ ● Manual Mode                                     │
│                                                    │
│ 💡 Tip: Smart Mode automatically scales           │
│    difficulty and maximizes problem variety       │
│    [Switch to Smart Mode]                         │
└───────────────────────────────────────────────────┘
```

**Trigger conditions:**

- Manual mode selected
- Pages > 2
- Digit range narrow (min === max)
- High regrouping probability (pAnyStart > 0.8)
- Duplicate risk >= medium

**Implementation:**

```typescript
const shouldSuggestSmartMode =
  formState.mode === 'manual' &&
  formState.pages > 2 &&
  formState.digitRange.min === formState.digitRange.max &&
  formState.pAnyStart > 0.8 &&
  duplicateRisk >= 'medium'

{shouldSuggestSmartMode && (
  <SmartModeSuggestion onSwitch={() => setMode('smart')} />
)}
```

---

### 4. Download-Time Confirmation (LOW PRIORITY)

**Where:** Modal before generating PDF
**When:** User dismissed warning AND extreme duplicate risk
**Why:** Last chance to prevent user frustration

#### Design

```
┌─ Confirm Download ─────────────────────────────┐
│                                                 │
│ ⚠️  Warning: Duplicate Problems Detected       │
│                                                 │
│ Your configuration will produce:                │
│ • 200 requested problems                        │
│ • Only 45 unique problems available             │
│ • ~155 duplicates (78% of worksheet)            │
│                                                  │
│ This may not provide enough practice variety.   │
│                                                  │
│ Recommendations:                                 │
│ • Reduce to 1-2 pages                           │
│ • Increase digit range from 1 to 2              │
│ • Lower regrouping to 50%                       │
│                                                  │
│ [Go Back] [Download Anyway]                     │
└─────────────────────────────────────────────────┘
```

**Trigger conditions:**

- User clicked Download
- Duplicate risk is extreme (ratio >= 1.5)
- Warning was previously dismissed (or never shown)

**Implementation:**

```typescript
// In PreviewCenter.tsx handleGenerate
const handleGenerate = async () => {
  if (duplicateRisk === "extreme" && (isDismissed || !warningsShown)) {
    setShowDownloadConfirmModal(true);
    return;
  }

  await onGenerate();
};
```

---

### 5. Tooltip on Regrouping Slider (LOW PRIORITY)

**Where:** Regrouping probability slider
**When:** Hover or focus
**Why:** Contextual education about regrouping constraints

#### Design

```
┌─ Regrouping Probability ──────────────────────┐
│ [────────────────●] 100%                    ⓘ │ ← Hover for tooltip
└────────────────────────────────────────────────┘

Tooltip appears:
┌────────────────────────────────────────────┐
│ 100% Regrouping with 1-Digit Problems      │
│                                            │
│ This limits unique problems to only 45.    │
│ Consider:                                  │
│ • Reducing to 50% regrouping               │
│ • Increasing to 2-digit problems           │
└────────────────────────────────────────────┘
```

**Conditional display:**

- Only show warning tooltip when:
  - `digitRange.max === 1`
  - `pAnyStart > 0.8`

**Implementation:**

```typescript
const showRegroupingWarning =
  formState.digitRange.max === 1 && formState.pAnyStart > 0.8

<Slider
  label="Regrouping Probability"
  value={formState.pAnyStart}
  tooltip={showRegroupingWarning ? (
    <RegroupingConstraintTooltip digitRange={formState.digitRange} />
  ) : undefined}
/>
```

---

### 6. Digit Range Recommendations (MEDIUM PRIORITY)

**Where:** Digit range selector
**When:** User selects 1-digit with high pages count
**Why:** Proactive suggestion before problem space constraint hits

#### Design

```
┌─ Digit Range ─────────────────────────────────┐
│ Min: [1▼]  Max: [1▼]                          │
│                                                │
│ ℹ️  1-digit problems have limited variety     │
│    For 5+ pages, consider:                    │
│    • Min: 1, Max: 2 (mixed 1-2 digit)         │
│    • Min: 2, Max: 2 (all 2-digit)             │
│                                                │
│    [Quick Apply: 1-2 digits]                  │
└────────────────────────────────────────────────┘
```

**Trigger conditions:**

- `digitRange.max === 1`
- `pages >= 5`

**Implementation:**

```typescript
const shouldSuggestDigitRangeIncrease =
  formState.digitRange.max === 1 && formState.pages >= 5

{shouldSuggestDigitRangeIncrease && (
  <DigitRangeRecommendation
    onApply={() => setDigitRange({ min: 1, max: 2 })}
  />
)}
```

---

### 7. Mixed Mode Mastery Validation (LOW PRIORITY)

**Where:** Preview banner or config panel
**When:** Mastery + mixed mode selected
**Why:** Currently shows no validation, which could be confusing

#### Design

**Option A: Simple info message**

```
ℹ️  Mixed Mastery Mode
Problem space not validated (uses separate skill configs for +/−)
```

**Option B: Rough estimation**

```
ℹ️  Mixed Mastery Mode
~2,025 addition problems + ~550 subtraction problems available
(Separate configs - validation approximate)
```

**Trigger conditions:**

- `mode === 'mastery'`
- `operator === 'mixed'`

**Implementation:**

Currently skipped in `WorksheetPreviewContext.tsx:53-56`.

Two approaches:

**Approach 1 - Info Only:**

```typescript
if (mode === "mastery" && operator === "mixed") {
  setWarnings([
    "ℹ️ Mixed Mastery Mode uses separate skill-based configs for addition and subtraction. Problem space validation is disabled.",
  ]);
  return;
}
```

**Approach 2 - Rough Estimation:**

```typescript
if (mode === "mastery" && operator === "mixed") {
  // Get separate estimates (need to access skill configs)
  const addSpace = estimateUniqueProblemSpace(
    additionSkill.digitRange,
    additionSkill.pAnyStart,
    "addition",
  );
  const subSpace = estimateUniqueProblemSpace(
    subtractionSkill.digitRange,
    subtractionSkill.pAnyStart,
    "subtraction",
  );

  const total = addSpace + subSpace;
  const requested = problemsPerPage * pages;

  if (requested > total * 0.8) {
    setWarnings([
      `Mixed Mastery Mode: ~${addSpace} addition + ~${subSpace} subtraction problems available. Validation is approximate.`,
    ]);
  }
  return;
}
```

---

## Implementation Priority

### Phase 1 - High Impact, Low Effort

1. **Config Panel Indicator** - Shows live problem space estimate
2. **Digit Range Recommendations** - Suggests 2-digit when user selects many 1-digit pages

### Phase 2 - Medium Impact, Medium Effort

3. **Slider Visual Feedback** - Color-coded zones for safe/caution/danger
4. **Smart Mode Suggestion** - Educates about Smart Mode benefits
5. **Tooltip on Regrouping Slider** - Contextual help for 1-digit + 100% regrouping

### Phase 3 - Nice to Have

6. **Download Confirmation** - Last-chance warning for extreme cases
7. **Mixed Mastery Validation** - Rough estimation or info message

---

## Component Structure

Suggested new components to create:

```
components/config-panel/
├── ProblemSpaceIndicator.tsx      # Live space estimate with color coding
├── SmartModeSuggestion.tsx        # Suggests switching to Smart Mode
├── DigitRangeRecommendation.tsx   # Suggests increasing digit range
└── RegroupingConstraintTooltip.tsx # Warning tooltip for constrained settings

components/modals/
└── DownloadConfirmModal.tsx       # Pre-download warning for extreme risk
```

---

## User Education Opportunities

### Tooltips and Help Text

**Regrouping Probability:**

```
"The percentage of problems that involve carrying (addition) or borrowing
(subtraction). Higher percentages with limited digit ranges may result in
fewer unique problems."
```

**Digit Range:**

```
"1-digit: 0-9 (very limited variety)
2-digit: 10-99 (good variety)
3-digit: 100-999 (excellent variety)

For worksheets with many problems, use 2+ digits."
```

**Pages:**

```
"Each page contains {problemsPerPage} problems.
{estimatedSpace} unique problems available with current settings."
```

### Onboarding/Tutorial

Add a brief tutorial or info modal explaining:

- What "problem space" means
- Why digit range matters
- How regrouping probability affects uniqueness
- When to use Smart Mode vs Manual Mode

---

## Testing Plan

For each improvement:

1. **Visual regression:** Screenshot before/after
2. **Interaction testing:** Verify all states (plenty/tight/insufficient)
3. **Edge case testing:**
   - 1-digit 100% regrouping (45 problems)
   - 2-digit 100% regrouping (~3,700 problems)
   - Mixed mode with mastery
4. **Accessibility:** Keyboard navigation, screen reader labels
5. **Mobile responsive:** Touch-friendly, readable on small screens

---

## Analytics (Future Consideration)

Track user behavior to measure effectiveness:

```typescript
analytics.track("Warning Shown", {
  duplicateRisk: "high",
  estimatedSpace: 45,
  requestedProblems: 100,
  digitRange: { min: 1, max: 1 },
  pAnyStart: 1.0,
});

analytics.track("Warning Dismissed", {
  duplicateRisk: "high",
});

analytics.track("Config Adjusted After Warning", {
  change: "increased_digit_range",
  from: { min: 1, max: 1 },
  to: { min: 1, max: 2 },
});

analytics.track("Downloaded Despite Warning", {
  duplicateRisk: "extreme",
});
```

Use this data to:

- Identify most common problematic configurations
- Measure warning effectiveness
- Improve recommendation accuracy

---

## Summary

**Current state:** Reactive warning in preview pane (good, but not enough)

**Ideal state:** Multi-layered approach

1. **Proactive** - Config panel shows live feedback
2. **Preventive** - Visual slider constraints guide users
3. **Educational** - Tooltips and suggestions explain why
4. **Protective** - Last-chance confirmation for extreme cases

**Impact:**

- Fewer confused users ("why so many duplicates?")
- Better worksheet quality
- Reduced support requests
- Improved user confidence in the tool
