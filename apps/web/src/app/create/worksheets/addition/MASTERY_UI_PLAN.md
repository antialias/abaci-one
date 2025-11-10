# Mastery Mode UI Plan

## Design Principles

1. **Transparency**: Always show what's in the mix and why
2. **Progressive disclosure**: Simple by default, detailed on demand
3. **Consistent patterns**: Reuse existing UI patterns (like difficulty preset dropdown)
4. **No surprises**: Clear indication when mastery mode changes behavior

---

## UI Components

### 1. Mode Selector (Top of Config Panel)

**Current**: Just shows "Smart" vs "Manual" mode tabs

**New**: Add third option for "Mastery"

```
┌─────────────────────────────────────────┐
│ ┌───────┬────────┬─────────┐            │
│ │ Smart │ Manual │ Mastery │            │
│ └───────┴────────┴─────────┘            │
│                   ^^^^^^^^^ NEW          │
└─────────────────────────────────────────┘
```

**Component**: `ModeSelector.tsx`

```typescript
<div data-component="mode-selector">
  <button
    data-mode="smart"
    className={css({ /* active styles if selected */ })}
    onClick={() => onChange({ mode: "smart", masteryMode: false })}
  >
    Smart
  </button>
  <button
    data-mode="manual"
    className={css({ /* active styles if selected */ })}
    onClick={() => onChange({ mode: "manual", masteryMode: false })}
  >
    Manual
  </button>
  <button
    data-mode="mastery"
    className={css({ /* active styles if selected */ })}
    onClick={() => onChange({ mode: "smart", masteryMode: true })}
  >
    Mastery
  </button>
</div>
```

---

### 2. Mastery Mode Panel (Replaces Smart/Manual Controls)

When mastery mode is active, replace the difficulty slider with mastery-specific controls.

```
┌─────────────────────────────────────────────────────────┐
│ Current Skill: Two-digit with ones regrouping       ✓   │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ 📊 Worksheet Mix (20 problems)                          │
│                                                          │
│ ┌──────────────────────────────────────────────┐        │
│ │ 15 problems  │ Two-digit + ones regrouping   │ 75%   │
│ │ (current)    │ Example: 38 + 27              │       │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ┌──────────────────────────────────────────────┐        │
│ │ 5 problems   │ Review: Mixed mastered skills │ 25%   │
│ │ (review)     │ • 2 problems: Single-digit    │       │
│ │              │ • 3 problems: Two-digit simple│       │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ⚙️ Scaffolding (recommended for this skill)             │
│ • Carry boxes when regrouping                           │
│ • Answer boxes always visible                           │
│ • Place value colors always visible                     │
│ • Ten-frames when regrouping                            │
│                                                          │
│ [ View All Skills ] [ Customize Mix ]                   │
└─────────────────────────────────────────────────────────┘
```

**Component**: `MasteryModePanel.tsx`

```typescript
interface MasteryModePanelProps {
  currentSkill: SkillDefinition;
  masteryStates: Map<SkillId, MasteryState>;
  totalProblems: number;
  onCustomize: () => void;
  onViewAllSkills: () => void;
}

export function MasteryModePanel({
  currentSkill,
  masteryStates,
  totalProblems,
  onCustomize,
  onViewAllSkills,
}: MasteryModePanelProps) {
  const masteredSkills = getMasteredSkills(masteryStates, currentSkill.operator);
  const currentCount = Math.floor(totalProblems * 0.75);
  const reviewCount = totalProblems - currentCount;

  // Calculate review breakdown (how review problems are distributed)
  const reviewBreakdown = calculateReviewBreakdown(masteredSkills, reviewCount);

  return (
    <div data-component="mastery-mode-panel">
      {/* Current skill header */}
      <div data-section="current-skill-header">
        <h3>{currentSkill.name}</h3>
        <p className={css({ fontSize: "0.875rem", color: "gray.600" })}>
          {currentSkill.description}
        </p>
      </div>

      {/* Worksheet mix visualization */}
      <div data-section="worksheet-mix">
        <h4>📊 Worksheet Mix ({totalProblems} problems)</h4>

        {/* Current skill block */}
        <div data-element="current-skill-block" className={css({
          border: "2px solid blue.500",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "0.5rem"
        })}>
          <div className={css({ display: "flex", justifyContent: "space-between" })}>
            <div>
              <strong>{currentCount} problems</strong>
              <span className={css({ color: "gray.600", marginLeft: "0.5rem" })}>
                (current)
              </span>
            </div>
            <div className={css({ fontWeight: "bold", color: "blue.600" })}>
              {Math.round((currentCount / totalProblems) * 100)}%
            </div>
          </div>
          <div className={css({ marginTop: "0.5rem" })}>
            <div>{currentSkill.name}</div>
            <div className={css({ fontSize: "0.875rem", color: "gray.600" })}>
              Example: {generateExampleProblem(currentSkill)}
            </div>
          </div>
        </div>

        {/* Review block */}
        <div data-element="review-block" className={css({
          border: "2px solid green.500",
          borderRadius: "8px",
          padding: "1rem"
        })}>
          <div className={css({ display: "flex", justifyContent: "space-between" })}>
            <div>
              <strong>{reviewCount} problems</strong>
              <span className={css({ color: "gray.600", marginLeft: "0.5rem" })}>
                (review)
              </span>
            </div>
            <div className={css({ fontWeight: "bold", color: "green.600" })}>
              {Math.round((reviewCount / totalProblems) * 100)}%
            </div>
          </div>

          {masteredSkills.length === 0 ? (
            <div className={css({ marginTop: "0.5rem", fontSize: "0.875rem", color: "gray.600" })}>
              No mastered skills yet. All problems will focus on current skill.
            </div>
          ) : (
            <div className={css({ marginTop: "0.5rem" })}>
              <div className={css({ fontWeight: "500" })}>
                Review: Mixed mastered skills
              </div>
              <ul className={css({ fontSize: "0.875rem", color: "gray.600", marginTop: "0.25rem" })}>
                {reviewBreakdown.map(({ skill, count }) => (
                  <li key={skill.id}>
                    • {count} problem{count > 1 ? 's' : ''}: {skill.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Scaffolding summary */}
      <div data-section="scaffolding-summary">
        <h4>⚙️ Scaffolding (recommended for this skill)</h4>
        <div className={css({ fontSize: "0.875rem" })}>
          {renderScaffoldingSummary(currentSkill.recommendedScaffolding, currentSkill.operator)}
        </div>
      </div>

      {/* Action buttons */}
      <div data-section="mastery-actions" className={css({
        display: "flex",
        gap: "0.5rem",
        marginTop: "1rem"
      })}>
        <button onClick={onViewAllSkills} className={css({ /* button styles */ })}>
          View All Skills
        </button>
        <button onClick={onCustomize} className={css({ /* button styles */ })}>
          Customize Mix
        </button>
      </div>
    </div>
  );
}
```

---

### 3. Collapsed Difficulty Summary (Like Current Presets)

When mastery mode is active, show a collapsed summary similar to the existing preset dropdown.

**Pattern**: Reuse the existing `DifficultyPresetDropdown` pattern but with mastery-specific content.

```
┌─────────────────────────────────────────────────────────┐
│ Difficulty: Mastery - Two-digit ones regrouping      ▼  │
│ ──────────────────────────────────────────────────────  │
│ 75% current skill, 25% review • Recommended scaffolding │
└─────────────────────────────────────────────────────────┘

[Click to expand]
        ↓

┌─────────────────────────────────────────────────────────┐
│ Difficulty: Mastery - Two-digit ones regrouping      ▲  │
│ ──────────────────────────────────────────────────────  │
│                                                          │
│ 📊 Worksheet Mix (20 problems)                          │
│                                                          │
│ ┌──────────────────────────────────────────────┐        │
│ │ 15 problems  │ Two-digit + ones regrouping   │ 75%   │
│ │ (current)    │ Example: 38 + 27              │       │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ┌──────────────────────────────────────────────┐        │
│ │ 5 problems   │ Review: Mixed mastered skills │ 25%   │
│ │ (review)     │ • 2 problems: Single-digit    │       │
│ │              │ • 3 problems: Two-digit simple│       │
│ └──────────────────────────────────────────────┘        │
│                                                          │
│ ⚙️ Scaffolding                                          │
│ Always: answer boxes, place value colors                │
│ When regrouping: carry boxes, ten-frames                │
│                                                          │
│ [ View All Skills ] [ Customize Mix ]                   │
└─────────────────────────────────────────────────────────┘
```

**Component**: `MasteryDifficultyDropdown.tsx`

```typescript
export function MasteryDifficultyDropdown({
  currentSkill,
  masteryStates,
  totalProblems,
  isExpanded,
  onToggle,
}: MasteryDifficultyDropdownProps) {
  const masteredSkills = getMasteredSkills(masteryStates, currentSkill.operator);
  const currentCount = Math.floor(totalProblems * 0.75);
  const reviewCount = totalProblems - currentCount;

  return (
    <div data-component="mastery-difficulty-dropdown">
      {/* Collapsed summary */}
      <button
        onClick={onToggle}
        data-element="dropdown-toggle"
        className={css({
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
          border: "1px solid",
          borderColor: "gray.300",
          borderRadius: "8px",
          backgroundColor: "white",
          cursor: "pointer",
          _hover: { backgroundColor: "gray.50" }
        })}
      >
        <div>
          <div className={css({ fontWeight: "600" })}>
            Difficulty: Mastery - {currentSkill.name}
          </div>
          <div className={css({ fontSize: "0.875rem", color: "gray.600", marginTop: "0.25rem" })}>
            {currentCount} current skill, {reviewCount} review
            {masteredSkills.length > 0 && ` from ${masteredSkills.length} mastered skill${masteredSkills.length > 1 ? 's' : ''}`}
            • Recommended scaffolding
          </div>
        </div>
        <div>{isExpanded ? "▲" : "▼"}</div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div data-element="dropdown-content" className={css({
          padding: "1rem",
          border: "1px solid",
          borderColor: "gray.300",
          borderTop: "none",
          borderBottomLeftRadius: "8px",
          borderBottomRightRadius: "8px"
        })}>
          <MasteryModePanel
            currentSkill={currentSkill}
            masteryStates={masteryStates}
            totalProblems={totalProblems}
            onCustomize={() => {/* Open customize modal */}}
            onViewAllSkills={() => {/* Open skills modal */}}
          />
        </div>
      )}
    </div>
  );
}
```

---

### 4. All Skills Modal

**Trigger**: "View All Skills" button

**Purpose**: Show complete skill progression and mastery state

```
┌─────────────────────────────────────────────────────────────┐
│ Skill Progression - Addition                            × │
│ ───────────────────────────────────────────────────────── │
│                                                             │
│ Single-digit Skills                                         │
│ ✓ No regrouping (3+5, 2+4)                                 │
│   Mastered on Jan 15, 2025                                  │
│                                                             │
│ ✓ Simple regrouping (7+8, 9+6)                             │
│   Mastered on Jan 22, 2025                                  │
│                                                             │
│ Two-digit Skills                                            │
│ ✓ No regrouping (23+45, 31+28)                             │
│   Mastered on Feb 1, 2025                                   │
│                                                             │
│ ► Ones place regrouping (38+27, 49+15)            ⭐       │
│   Current skill • 12 attempts • 78% accuracy                │
│   [Mark as Mastered]  [Practice This]                       │
│                                                             │
│ ○ Mixed regrouping (67+58, 84+73)                          │
│   Not started • Requires: ones place regrouping             │
│                                                             │
│ ⊘ Full regrouping (88+99, 76+67)                           │
│   Locked • Requires: mixed regrouping                       │
│                                                             │
│ Three-digit Skills                                          │
│ ⊘ No regrouping (234+451)                                  │
│   Locked • Requires: two-digit full regrouping              │
│                                                             │
│ ... (more skills)                                           │
│                                                             │
│ Progress: 3/11 skills mastered (27%)                        │
│                                                             │
│ [Close]                                                     │
└─────────────────────────────────────────────────────────────┘
```

**Component**: `AllSkillsModal.tsx`

```typescript
export function AllSkillsModal({
  operator,
  masteryStates,
  currentSkillId,
  onClose,
  onSelectSkill,
  onToggleMastery,
}: AllSkillsModalProps) {
  const skills = SKILL_DEFINITIONS.filter(s => s.operator === operator);
  const groupedSkills = groupSkillsByDigitLevel(skills);

  return (
    <Modal isOpen onClose={onClose} title={`Skill Progression - ${operator}`}>
      <div data-component="all-skills-modal">
        {Object.entries(groupedSkills).map(([level, skillsInLevel]) => (
          <div key={level} data-section={`skill-group-${level}`}>
            <h4>{level}</h4>

            {skillsInLevel.map(skill => {
              const state = masteryStates.get(skill.id);
              const isMastered = state?.isMastered ?? false;
              const isCurrent = skill.id === currentSkillId;
              const prereqsMet = checkPrerequisites(skill, masteryStates);

              return (
                <div
                  key={skill.id}
                  data-element="skill-card"
                  className={css({
                    padding: "1rem",
                    border: "1px solid",
                    borderColor: isCurrent ? "blue.500" : "gray.300",
                    borderRadius: "8px",
                    marginBottom: "0.5rem",
                    backgroundColor: isCurrent ? "blue.50" : "white"
                  })}
                >
                  <div className={css({ display: "flex", alignItems: "flex-start", gap: "0.5rem" })}>
                    {/* Status icon */}
                    <div className={css({ fontSize: "1.25rem" })}>
                      {isMastered ? "✓" : prereqsMet ? "►" : "⊘"}
                    </div>

                    {/* Skill info */}
                    <div className={css({ flex: 1 })}>
                      <div className={css({ display: "flex", alignItems: "center", gap: "0.5rem" })}>
                        <strong>{skill.name}</strong>
                        {isCurrent && <span className={css({ fontSize: "1.25rem" })}>⭐</span>}
                      </div>

                      <div className={css({ fontSize: "0.875rem", color: "gray.600", marginTop: "0.25rem" })}>
                        {skill.description}
                      </div>

                      {/* Mastery status */}
                      {isMastered && state?.masteredAt && (
                        <div className={css({ fontSize: "0.75rem", color: "green.600", marginTop: "0.25rem" })}>
                          Mastered on {formatDate(state.masteredAt)}
                        </div>
                      )}

                      {isCurrent && state && !isMastered && (
                        <div className={css({ fontSize: "0.75rem", color: "gray.600", marginTop: "0.25rem" })}>
                          Current skill • {state.totalAttempts} attempts • {Math.round((state.lastAccuracy ?? 0) * 100)}% accuracy
                        </div>
                      )}

                      {!isMastered && !isCurrent && !prereqsMet && (
                        <div className={css({ fontSize: "0.75rem", color: "gray.500", marginTop: "0.25rem" })}>
                          Locked • Requires: {skill.prerequisites.map(id => getSkillName(id)).join(", ")}
                        </div>
                      )}

                      {!isMastered && !isCurrent && prereqsMet && (
                        <div className={css({ fontSize: "0.75rem", color: "gray.600", marginTop: "0.25rem" })}>
                          Not started • Prerequisites met
                        </div>
                      )}

                      {/* Actions */}
                      {prereqsMet && (
                        <div className={css({ display: "flex", gap: "0.5rem", marginTop: "0.5rem" })}>
                          {!isMastered && (
                            <button
                              onClick={() => onToggleMastery(skill.id, true)}
                              className={css({ /* button styles */ })}
                            >
                              Mark as Mastered
                            </button>
                          )}
                          {isMastered && (
                            <button
                              onClick={() => onToggleMastery(skill.id, false)}
                              className={css({ /* button styles */ })}
                            >
                              Unmark
                            </button>
                          )}
                          {!isCurrent && (
                            <button
                              onClick={() => onSelectSkill(skill.id)}
                              className={css({ /* button styles */ })}
                            >
                              Practice This
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Progress summary */}
        <div data-section="progress-summary" className={css({
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "gray.100",
          borderRadius: "8px"
        })}>
          <strong>Progress: {calculateMasteredCount(masteryStates, operator)}/{skills.length} skills mastered ({calculateProgressPercentage(masteryStates, operator)}%)</strong>
        </div>
      </div>
    </Modal>
  );
}
```

---

### 5. Customize Mix Modal

**Trigger**: "Customize Mix" button

**Purpose**: Allow users to adjust mix percentages and manually select review skills

```
┌─────────────────────────────────────────────────────────────┐
│ Customize Worksheet Mix                                 × │
│ ───────────────────────────────────────────────────────── │
│                                                             │
│ Mix Ratio                                                   │
│ ┌─────────────────────────────────────────────┐            │
│ │ Current Skill: [====75%====]                │            │
│ │ Review:        [===25%===]                  │            │
│ │                                              │            │
│ │ Slider: 50% ←────●────→ 100%                │            │
│ │         (more review) (more current)         │            │
│ └─────────────────────────────────────────────┘            │
│                                                             │
│ Review Skills (auto-selected from mastered)                │
│ ☑ Single-digit no regrouping                               │
│ ☑ Single-digit simple regrouping                           │
│ ☑ Two-digit no regrouping                                  │
│                                                             │
│ [ Reset to Default ]  [ Apply ]  [ Cancel ]                │
└─────────────────────────────────────────────────────────────┘
```

**Component**: `CustomizeMixModal.tsx`

```typescript
export function CustomizeMixModal({
  currentSkill,
  masteredSkills,
  currentMixRatio,
  selectedReviewSkills,
  onApply,
  onClose,
}: CustomizeMixModalProps) {
  const [ratio, setRatio] = useState(currentMixRatio); // 0.5-1.0 (50%-100% current)
  const [reviewSkills, setReviewSkills] = useState(selectedReviewSkills);

  const currentPercentage = Math.round(ratio * 100);
  const reviewPercentage = 100 - currentPercentage;

  return (
    <Modal isOpen onClose={onClose} title="Customize Worksheet Mix">
      <div data-component="customize-mix-modal">
        {/* Mix ratio slider */}
        <div data-section="mix-ratio">
          <h4>Mix Ratio</h4>

          <div className={css({ marginBottom: "1rem" })}>
            <div className={css({ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" })}>
              <span>Current Skill: {currentPercentage}%</span>
              <span>Review: {reviewPercentage}%</span>
            </div>

            <input
              type="range"
              min="50"
              max="100"
              value={currentPercentage}
              onChange={(e) => setRatio(Number(e.target.value) / 100)}
              className={css({ width: "100%", marginTop: "0.5rem" })}
            />

            <div className={css({ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "gray.600", marginTop: "0.25rem" })}>
              <span>More review</span>
              <span>More current skill</span>
            </div>
          </div>
        </div>

        {/* Review skills selection */}
        <div data-section="review-skills">
          <h4>Review Skills {masteredSkills.length === 0 && "(none mastered yet)"}</h4>

          {masteredSkills.length > 0 ? (
            <div>
              <p className={css({ fontSize: "0.875rem", color: "gray.600", marginBottom: "0.5rem" })}>
                Select which mastered skills to include in review problems
              </p>

              {masteredSkills.map(skill => (
                <label
                  key={skill.id}
                  className={css({ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" })}
                >
                  <input
                    type="checkbox"
                    checked={reviewSkills.includes(skill.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setReviewSkills([...reviewSkills, skill.id]);
                      } else {
                        setReviewSkills(reviewSkills.filter(id => id !== skill.id));
                      }
                    }}
                  />
                  <span>{skill.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className={css({ fontSize: "0.875rem", color: "gray.600" })}>
              No mastered skills yet. Complete some skills to enable review mix.
            </p>
          )}
        </div>

        {/* Actions */}
        <div data-section="actions" className={css({
          display: "flex",
          gap: "0.5rem",
          marginTop: "1rem",
          justifyContent: "flex-end"
        })}>
          <button
            onClick={() => {
              setRatio(0.75);
              setReviewSkills(masteredSkills.map(s => s.id));
            }}
            className={css({ /* button styles */ })}
          >
            Reset to Default
          </button>
          <button onClick={onClose} className={css({ /* button styles */ })}>
            Cancel
          </button>
          <button
            onClick={() => onApply({ ratio, reviewSkills })}
            className={css({ /* button styles */ })}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

---

### 6. Inline Problem Attribution (Preview)

**In the worksheet preview**, add subtle indicators showing which problems are current vs review.

```
Preview:
┌─────────────────────────────────────────────┐
│ Problem 1                    [Current]     │
│    38                                       │
│  + 27                                       │
│  ----                                       │
│                                             │
├─────────────────────────────────────────────┤
│ Problem 2                    [Review: sd]  │
│     7                                       │
│   + 8                                       │
│  ----                                       │
└─────────────────────────────────────────────┘
```

**Implementation**: Add subtle badge or color coding to problem numbers in preview

```typescript
// In worksheet preview rendering
function renderProblemWithAttribution(problem: WorksheetProblem, index: number) {
  const isReview = problem.metadata?.isReview ?? false;
  const reviewSkillName = problem.metadata?.skillName;

  return (
    <div data-element="problem-card">
      <div className={css({ display: "flex", justifyContent: "space-between", alignItems: "center" })}>
        <span>Problem {index + 1}</span>
        {isReview ? (
          <span className={css({
            fontSize: "0.75rem",
            color: "green.600",
            backgroundColor: "green.50",
            padding: "0.125rem 0.5rem",
            borderRadius: "4px"
          })}>
            Review: {reviewSkillName}
          </span>
        ) : (
          <span className={css({
            fontSize: "0.75rem",
            color: "blue.600",
            backgroundColor: "blue.50",
            padding: "0.125rem 0.5rem",
            borderRadius: "4px"
          })}>
            Current
          </span>
        )}
      </div>
      {/* Problem rendering */}
    </div>
  );
}
```

---

## Observability Features Summary

### 1. **What's in the mix**
- Current skill count + percentage
- Review count + percentage
- Breakdown of review by skill (e.g., "2 single-digit, 3 two-digit")

### 2. **Why this mix**
- "Recommended scaffolding for this skill"
- "Prerequisites: [list]"
- "Next skill: [name] (after mastering this)"

### 3. **How it's distributed**
- Visual blocks showing current vs review ratio
- List showing exact count per review skill
- Example problems for each skill type

### 4. **Progress tracking**
- X/Y skills mastered
- Percentage complete
- Last practiced date
- Accuracy tracking

### 5. **Control transparency**
- Ability to customize mix ratio
- Ability to select specific review skills
- Ability to manually override mastery status
- Ability to skip to different skill

---

## Layout Integration

### Current Smart Mode Controls Location

```
ConfigPanel.tsx
  ├─ ModeSelector (Smart/Manual/Mastery) [NEW]
  ├─ if mode === 'smart' && !masteryMode
  │   └─ SmartModeControls (difficulty slider, make harder/easier)
  ├─ if mode === 'smart' && masteryMode
  │   └─ MasteryModePanel [NEW]
  └─ if mode === 'manual'
      └─ ManualModeControls (toggle switches)
```

### Collapsed State (Preset Dropdown Location)

Current location in `AdditionWorksheetClient.tsx`:

```typescript
{/* Difficulty preset dropdown (collapsed state) */}
{formState.mode === "smart" && !formState.masteryMode && (
  <DifficultyPresetDropdown ... />
)}

{formState.mode === "smart" && formState.masteryMode && (
  <MasteryDifficultyDropdown ... /> // NEW
)}
```

---

## Responsive Behavior

### Desktop (≥768px)
- Full panel with all details visible
- Modals centered, max-width 600px

### Tablet (480px - 768px)
- Compact panel, abbreviated text
- Modals full-width with padding

### Mobile (<480px)
- Stacked layout
- Abbreviated labels ("Cur: 15" instead of "Current: 15 problems")
- Full-screen modals

---

## Accessibility

1. **Keyboard navigation**: All modals and buttons keyboard-accessible
2. **Screen readers**: Proper ARIA labels on all interactive elements
3. **Color contrast**: Ensure blue/green badges meet WCAG AA standards
4. **Focus management**: Return focus to trigger button when modals close
5. **Status announcements**: Announce mastery status changes via aria-live

---

## Animation/Polish

1. **Smooth expand/collapse**: Dropdown transition (200ms ease-in-out)
2. **Progress indication**: Skill progress bar fills left-to-right
3. **Badge animations**: Subtle pulse on "current skill" indicator
4. **Modal transitions**: Fade in (150ms) + slide up slightly

---

## Data Flow

```
User selects Mastery Mode
    ↓
Load mastery states from API (/api/worksheets/mastery)
    ↓
Calculate current skill (findNextSkill)
    ↓
Load skill definition (SKILL_DEFINITIONS[currentSkillId])
    ↓
Calculate mix (75% current, 25% review breakdown)
    ↓
Update UI (MasteryModePanel shows mix details)
    ↓
Generate preview (generateMasteryWorksheet with metadata)
    ↓
Render preview with problem attribution badges
```

---

## Questions for You

1. **Should we show problem attribution in the final PDF?**
   - Option A: Only in preview (cleaner final product)
   - Option B: In PDF as subtle watermark/footer note
   - Option C: Configurable toggle

2. **Review skill selection behavior**
   - Auto-select all mastered skills (current plan)
   - Or default to "most recently mastered" only?

3. **Mix ratio bounds**
   - Current: 50-100% current skill (so 0-50% review)
   - Should we allow 100% review (no current skill practice)?

4. **Manual skill override behavior**
   - If user marks skill as mastered, should we auto-advance to next skill?
   - Or stay on current skill until they explicitly change?
