# Remediation CTA Plan

## Overview

Add special "fancy" treatment to the StartPracticeModal when the student is in remediation mode (has weak skills that need strengthening). This mirrors the existing tutorial CTA treatment.

## Current Tutorial CTA Treatment (lines 1311-1428)

When `sessionMode.type === 'progression' && tutorialRequired`:

1. **Visual Design:**
   - Green gradient background with border
   - 🌟 icon
   - "You've unlocked: [skill name]" heading
   - "Start with a quick tutorial" subtitle
   - Green gradient button: "🎓 Begin Tutorial →"

2. **Behavior:**
   - Replaces the regular "Let's Go!" button
   - Clicking opens the SkillTutorialLauncher

## Proposed Remediation CTA

When `sessionMode.type === 'remediation'`:

1. **Visual Design:**
   - Amber/orange gradient background with border (warm "focus" colors)
   - 💪 icon (strength/building)
   - "Time to build strength!" heading
   - "Focusing on [N] skills that need practice" subtitle
   - Show weak skill badges with pKnown percentages
   - Amber gradient button: "💪 Start Focus Practice →"

2. **Behavior:**
   - Replaces the regular "Let's Go!" button
   - Clicking goes straight to practice (no separate launcher needed)
   - The session will automatically target weak skills via sessionMode

## Implementation Steps

### Step 1: Add remediation detection

```typescript
// Derive whether to show remediation CTA
const showRemediationCta = sessionMode.type === 'remediation' && sessionMode.weakSkills.length > 0
```

### Step 2: Create RemediationCta component section

Add after the Tutorial CTA section (line ~1428), or restructure to have a single "special CTA" section that handles both cases.

```tsx
{/* Remediation CTA - Weak skills need strengthening */}
{showRemediationCta && !showTutorialGate && (
  <div
    data-element="remediation-cta"
    className={css({...})}
    style={{
      background: isDark
        ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.08) 100%)'
        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(234, 88, 12, 0.05) 100%)',
      border: `2px solid ${isDark ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.2)'}`,
    }}
  >
    {/* Info section */}
    <div className={css({...})}>
      <span>💪</span>
      <div>
        <p>Time to build strength!</p>
        <p>Focusing on {weakSkills.length} skill{weakSkills.length > 1 ? 's' : ''} that need practice</p>
      </div>
    </div>

    {/* Weak skills badges */}
    <div className={css({...})}>
      {sessionMode.weakSkills.slice(0, 4).map((skill) => (
        <span key={skill.skillId} className={css({...})}>
          {skill.displayName} ({Math.round(skill.pKnown * 100)}%)
        </span>
      ))}
      {sessionMode.weakSkills.length > 4 && (
        <span>+{sessionMode.weakSkills.length - 4} more</span>
      )}
    </div>

    {/* Integrated start button */}
    <button
      data-action="start-focus-practice"
      onClick={handleStart}
      disabled={isStarting}
      style={{
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      }}
    >
      {isStarting ? 'Starting...' : (
        <>
          <span>💪</span>
          <span>Start Focus Practice</span>
          <span>→</span>
        </>
      )}
    </button>
  </div>
)}
```

### Step 3: Update start button visibility logic

Change from:
```tsx
{!showTutorialGate && (
  <button>Let's Go! →</button>
)}
```

To:
```tsx
{!showTutorialGate && !showRemediationCta && (
  <button>Let's Go! →</button>
)}
```

## Visual Comparison

| Mode | Icon | Color Theme | Heading | Button Text |
|------|------|-------------|---------|-------------|
| Tutorial | 🌟 | Green | "You've unlocked: [skill]" | "🎓 Begin Tutorial →" |
| Remediation | 💪 | Amber | "Time to build strength!" | "💪 Start Focus Practice →" |
| Normal | - | Blue | "Ready to practice?" | "Let's Go! →" |

## Files to Modify

1. `apps/web/src/components/practice/StartPracticeModal.tsx`
   - Add `showRemediationCta` derived state
   - Add Remediation CTA section (similar structure to Tutorial CTA)
   - Update regular start button visibility condition

## Testing Considerations

1. Storybook stories should cover:
   - Remediation mode with 1 weak skill
   - Remediation mode with 3+ weak skills
   - Remediation mode with 5+ weak skills (overflow)

2. The existing `StartPracticeModal.stories.tsx` already has sessionMode mocks - add remediation variants.

## Accessibility

- Ensure proper ARIA labels on the remediation CTA
- Color contrast should meet WCAG guidelines (amber text on amber background needs checking)
- Screen reader should announce the focus practice intent
