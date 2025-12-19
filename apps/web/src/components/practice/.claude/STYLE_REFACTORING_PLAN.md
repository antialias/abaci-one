# Practice App Style Refactoring Plan

## Current State Analysis

### Files Reviewed

- `ActiveSession.tsx` (1415 lines) - Main practice session component
- `VerticalProblem.tsx` (416 lines) - Vertical columnar problem display
- `HelpAbacus.tsx` (348 lines) - Interactive abacus with bead arrows
- `PracticeHelpOverlay.tsx` (297 lines) - Simplified help overlay for practice
- `PracticeHelpPanel.tsx` (537 lines) - Progressive help display panel
- `NumericKeypad.tsx` (141 lines) - Mobile numeric input
- `SessionSummary.tsx` (596 lines) - Post-session results
- `PlacementTest.tsx` (706 lines) - Skill assessment quiz
- `PlanReview.tsx` (553 lines) - Session plan approval screen
- `StudentSelector.tsx` (300 lines) - Student picker
- `ProgressDashboard.tsx` (640 lines) - Student home screen
- `decomposition/decomposition.css` (154 lines) - External CSS for decomposition

### Key Problems Identified

#### 1. **Massive Color Cascade Repetition**

Every component has similar patterns for dark/light mode colors:

```typescript
backgroundColor: isDark ? 'gray.800' : 'white',
color: isDark ? 'gray.200' : 'gray.800',
borderColor: isDark ? 'gray.600' : 'gray.200',
```

This is repeated 100+ times across files with subtle variations, making it:

- Hard to maintain consistency
- Easy to make mistakes (e.g., missing dark mode handling)
- Difficult to change the overall color scheme

#### 2. **No Shared Style Constants**

Common values are hardcoded everywhere:

- `borderRadius: '12px'` or `'8px'`
- `padding: '1rem'` or `'1.5rem'`
- `gap: '0.75rem'` or `'1.5rem'`
- `fontSize: '0.875rem'` or `'1rem'`

#### 3. **Feedback Color Logic Repeated**

Multiple components implement the same accuracy→color mapping:

```typescript
accuracy >= 0.8 ? "green" : accuracy >= 0.6 ? "yellow" : "red";
```

Found in: `SessionSummary.tsx`, `ProgressDashboard.tsx`, `PlacementTest.tsx`

#### 4. **Button Style Duplication**

Similar button styles appear in every component:

- Primary blue buttons
- Secondary gray buttons
- Danger/warning buttons
- Link-style buttons

#### 5. **Card/Container Style Duplication**

Every "card" or "section" has similar styling:

```typescript
padding: '1rem',
backgroundColor: isDark ? 'gray.800' : 'white',
borderRadius: '12px',
boxShadow: 'md',
border: '1px solid',
borderColor: isDark ? 'gray.700' : 'gray.200',
```

#### 6. **Status Badge Patterns**

Repeated patterns for mastery levels, skill states, feedback:

- `mastered` → green
- `practicing` → yellow
- `learning` → gray
- `focus`/`reinforce`/`review`/`challenge` → blue/orange/green/purple

#### 7. **Inline `<style>` in NumericKeypad**

The `NumericKeypad.tsx` uses inline CSS for react-simple-keyboard theming, which:

- Breaks the Panda CSS pattern
- Uses hardcoded hex values
- Duplicates dark/light mode logic

---

## Proposed Refactoring

### Phase 1: Create Shared Style Utilities

Create `src/components/practice/styles/` directory with:

#### A. `practiceTheme.ts` - Theme constants and utilities

```typescript
// Color scheme definitions
export const practiceColors = {
  // Base surfaces
  surface: { light: "white", dark: "gray.800" },
  surfaceMuted: { light: "gray.50", dark: "gray.700" },
  surfaceElevated: { light: "white", dark: "gray.800" },

  // Borders
  border: { light: "gray.200", dark: "gray.600" },
  borderMuted: { light: "gray.100", dark: "gray.700" },
  borderStrong: { light: "gray.300", dark: "gray.500" },

  // Text
  text: { light: "gray.800", dark: "gray.100" },
  textMuted: { light: "gray.600", dark: "gray.400" },
  textSubtle: { light: "gray.500", dark: "gray.500" },

  // Semantic colors for feedback
  success: { light: "green.100", dark: "green.900" },
  successText: { light: "green.700", dark: "green.200" },
  successBorder: { light: "green.200", dark: "green.700" },

  warning: { light: "yellow.100", dark: "yellow.900" },
  warningText: { light: "yellow.700", dark: "yellow.200" },
  warningBorder: { light: "yellow.200", dark: "yellow.700" },

  error: { light: "red.100", dark: "red.900" },
  errorText: { light: "red.700", dark: "red.200" },
  errorBorder: { light: "red.200", dark: "red.700" },

  info: { light: "blue.100", dark: "blue.900" },
  infoText: { light: "blue.700", dark: "blue.200" },
  infoBorder: { light: "blue.200", dark: "blue.700" },

  // Session part colors
  abacus: { light: "blue.50", dark: "blue.900" },
  abacusText: { light: "blue.700", dark: "blue.200" },
  abacusBorder: { light: "blue.200", dark: "blue.700" },

  visualization: { light: "purple.50", dark: "purple.900" },
  visualizationText: { light: "purple.700", dark: "purple.200" },
  visualizationBorder: { light: "purple.200", dark: "purple.700" },

  linear: { light: "orange.50", dark: "orange.900" },
  linearText: { light: "orange.700", dark: "orange.200" },
  linearBorder: { light: "orange.200", dark: "orange.700" },
};

// Helper to get themed color
export function themed<T extends keyof typeof practiceColors>(
  key: T,
  isDark: boolean,
): string {
  return practiceColors[key][isDark ? "dark" : "light"];
}

// Accuracy to semantic color
export function getAccuracyLevel(
  accuracy: number,
): "success" | "warning" | "error" {
  if (accuracy >= 0.8) return "success";
  if (accuracy >= 0.6) return "warning";
  return "error";
}
```

#### B. `practiceStyles.ts` - Reusable style recipes

```typescript
import { css } from "../../../../styled-system/css";
import { themed } from "./practiceTheme";

// Card container styles
export const cardStyles = (isDark: boolean) =>
  css({
    padding: "1.5rem",
    backgroundColor: themed("surface", isDark),
    borderRadius: "12px",
    boxShadow: "md",
    border: "1px solid",
    borderColor: themed("border", isDark),
  });

// Section container (less elevated than card)
export const sectionStyles = (isDark: boolean) =>
  css({
    padding: "1rem",
    backgroundColor: themed("surfaceMuted", isDark),
    borderRadius: "12px",
    border: "1px solid",
    borderColor: themed("borderMuted", isDark),
  });

// Primary button
export const primaryButtonStyles = (isDark: boolean) =>
  css({
    padding: "1rem",
    fontSize: "1.125rem",
    fontWeight: "bold",
    color: "white",
    backgroundColor: "blue.500",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    _hover: { backgroundColor: "blue.600" },
  });

// Secondary button
export const secondaryButtonStyles = (isDark: boolean) =>
  css({
    padding: "0.75rem",
    fontSize: "1rem",
    color: themed("text", isDark),
    backgroundColor: themed("surfaceMuted", isDark),
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    _hover: { backgroundColor: isDark ? "gray.600" : "gray.200" },
  });

// Ghost/link button
export const ghostButtonStyles = (isDark: boolean) =>
  css({
    padding: "0.5rem",
    fontSize: "0.875rem",
    color: themed("textMuted", isDark),
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    _hover: {
      color: themed("text", isDark),
      textDecoration: "underline",
    },
  });

// Badge/pill styles
export const badgeStyles = (
  variant: "success" | "warning" | "error" | "info" | "neutral",
  isDark: boolean,
) => {
  const colorMap = {
    success: {
      bg: themed("success", isDark),
      text: themed("successText", isDark),
    },
    warning: {
      bg: themed("warning", isDark),
      text: themed("warningText", isDark),
    },
    error: { bg: themed("error", isDark), text: themed("errorText", isDark) },
    info: { bg: themed("info", isDark), text: themed("infoText", isDark) },
    neutral: {
      bg: themed("surfaceMuted", isDark),
      text: themed("textMuted", isDark),
    },
  };
  const colors = colorMap[variant];
  return css({
    fontSize: "0.75rem",
    fontWeight: "medium",
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    backgroundColor: colors.bg,
    color: colors.text,
  });
};

// Progress bar
export const progressBarContainerStyles = (isDark: boolean) =>
  css({
    width: "100%",
    height: "8px",
    backgroundColor: isDark ? "gray.700" : "gray.200",
    borderRadius: "4px",
    overflow: "hidden",
  });

export const progressBarFillStyles = (
  isDark: boolean,
  variant: "success" | "info" = "success",
) =>
  css({
    height: "100%",
    backgroundColor:
      variant === "success"
        ? isDark
          ? "green.400"
          : "green.500"
        : isDark
          ? "blue.400"
          : "blue.500",
    borderRadius: "4px",
    transition: "width 0.5s ease",
  });
```

#### C. `practiceMixins.ts` - Composable style patterns

```typescript
// Flexbox layouts
export const centerStack = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
export const row = { display: "flex", alignItems: "center" };
export const spaceBetween = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

// Gap presets
export const gapXs = { gap: "0.25rem" };
export const gapSm = { gap: "0.5rem" };
export const gapMd = { gap: "0.75rem" };
export const gapLg = { gap: "1rem" };
export const gapXl = { gap: "1.5rem" };
export const gap2xl = { gap: "2rem" };

// Spacing presets
export const paddingXs = { padding: "0.25rem" };
export const paddingSm = { padding: "0.5rem" };
export const paddingMd = { padding: "1rem" };
export const paddingLg = { padding: "1.5rem" };
export const paddingXl = { padding: "2rem" };

// Border radius presets
export const roundedSm = { borderRadius: "6px" };
export const roundedMd = { borderRadius: "8px" };
export const roundedLg = { borderRadius: "12px" };
export const roundedFull = { borderRadius: "9999px" };

// Font size presets
export const textXs = { fontSize: "0.625rem" };
export const textSm = { fontSize: "0.75rem" };
export const textMd = { fontSize: "0.875rem" };
export const textLg = { fontSize: "1rem" };
export const textXl = { fontSize: "1.125rem" };
export const text2xl = { fontSize: "1.25rem" };
export const text3xl = { fontSize: "1.5rem" };
export const text4xl = { fontSize: "2rem" };
```

---

### Phase 2: Extract Component-Specific Patterns

#### A. `NumericKeypad` - Move inline CSS to Panda CSS

Convert the inline `<style>` block to use Panda CSS with theme tokens.

#### B. `ActiveSession` - Extract HUD styles

Create `HudBar.tsx` component with its own encapsulated styles.

#### C. `VerticalProblem` - Extract answer cell logic

The answer cell styling has complex conditional logic - extract to helper.

---

### Phase 3: Create Composite Components

#### A. `FeedbackBadge` - Reusable accuracy indicator

```typescript
<FeedbackBadge accuracy={0.85} /> // Shows "85%" with green background
```

#### B. `StatCard` - Reusable stat display

```typescript
<StatCard label="Accuracy" value="85%" variant="success" />
```

#### C. `PartTypeIndicator` - Session part badge

```typescript
<PartTypeIndicator type="abacus" showLabel={true} />
```

#### D. `SkillBadge` - Skill mastery indicator

```typescript
<SkillBadge skillName="Friends of 5" masteryLevel="practicing" />
```

---

### Phase 4: Migrate Components

1. **Start with leaf components** (least dependencies):
   - `NumericKeypad.tsx`
   - `StudentSelector.tsx`

2. **Then mid-level components**:
   - `VerticalProblem.tsx`
   - `HelpAbacus.tsx`
   - `SessionSummary.tsx`

3. **Finally complex components**:
   - `ActiveSession.tsx`
   - `PlacementTest.tsx`
   - `ProgressDashboard.tsx`

---

## Implementation Strategy

### No Breaking Changes

- Each component continues to work exactly as before
- Only internal style organization changes
- No visual differences

### Incremental Migration

1. Add new style utilities
2. Migrate one component at a time
3. Verify with visual regression (manual inspection)
4. Commit after each component

### Testing Approach

- No automated visual tests exist
- Manual inspection of light/dark mode for each component
- Storybook stories exist for most components - use those for verification

---

## Estimated Impact

### Before

- **~2500 lines** of repeated color/style logic across practice components
- **~150** instances of `isDark ? X : Y` patterns
- **~50** repeated button style blocks
- **~30** repeated card/container style blocks

### After

- **~300 lines** of shared utilities
- **~80%** reduction in color/style repetition
- Single source of truth for:
  - Color palette
  - Spacing scale
  - Border radius values
  - Button variants
  - Card/container styles
  - Badge/pill styles

---

## Risks and Mitigations

### Risk: Subtle visual differences

**Mitigation**: Side-by-side comparison in Storybook before/after

### Risk: Performance impact from style function calls

**Mitigation**: Panda CSS generates static classes at build time, no runtime cost

### Risk: Over-abstraction making styles harder to understand

**Mitigation**: Keep utilities simple and well-documented; avoid deep nesting

---

## Questions for Review

1. Should we also migrate the `decomposition/decomposition.css` to Panda CSS?
2. Do we want to create a Panda CSS recipe for the numeric keypad theme?
3. Should badge variants include purpose types (`focus`/`reinforce`/`review`/`challenge`)?
4. Is the proposed directory structure (`styles/`) acceptable, or should utilities go elsewhere?
