# AdditionWorksheetClient Refactoring Plan

## Problem Statement

`AdditionWorksheetClient.tsx` has grown to **971 lines** and contains multiple concerns:

- State management (form state, debounced state, generation status, auto-save)
- UI layout (orientation panel, generate button, preview)
- Business logic (validation, PDF generation, settings persistence)
- Helper functions (date formatting, column calculations)

This violates the Single Responsibility Principle and makes the component hard to maintain, test, and reason about.

## Goals

1. **Reduce file size** to under 300 lines
2. **Separate concerns** into focused, reusable components
3. **Improve testability** by isolating logic from UI
4. **Maintain existing functionality** without breaking changes
5. **Enable easier future enhancements** (e.g., new worksheet types)

## Current Component Structure

```
AdditionWorksheetClient (971 lines)
├── State Management
│   ├── formState (immediate updates)
│   ├── debouncedFormState (delayed preview updates)
│   ├── generationStatus ('idle' | 'generating' | 'error')
│   ├── error (string | null)
│   ├── lastSaved (Date | null)
│   └── isSaving (boolean)
├── Effects
│   ├── Debounce preview updates (500ms)
│   ├── Auto-save settings (1000ms)
│   └── Debug logging
├── Handlers
│   ├── handleFormChange (with seed regeneration logic)
│   ├── handleGenerate (validation, API call, PDF download)
│   └── handleNewGeneration (reset error state)
├── Helper Functions
│   ├── getDefaultDate() (date formatting)
│   └── getDefaultColsForProblemsPerPage() (layout calculations)
└── UI Sections
    ├── ConfigPanel (left column)
    ├── Orientation Panel (right column, top)
    ├── Generate Button (right column, middle)
    └── WorksheetPreview (right column, bottom)
```

## Proposed Component Breakdown

### Phase 1: Extract UI Components (Low Risk)

#### 1.1 Extract `OrientationPanel.tsx`

**Lines to extract**: 392-828 (437 lines)
**Responsibility**: Orientation, pages, problems per page controls
**Props**:

```typescript
interface OrientationPanelProps {
  orientation: "portrait" | "landscape";
  problemsPerPage: number;
  pages: number;
  cols: number;
  onOrientationChange: (orientation: "portrait" | "landscape") => void;
  onProblemsPerPageChange: (count: number) => void;
  onPagesChange: (pages: number) => void;
}
```

**Extracted logic**:

- `getDefaultColsForProblemsPerPage()` helper → move to this component
- Orientation button click handlers
- Pages button click handlers
- Radix dropdown with grid visualizations
- Total problems badge calculation

**Benefits**:

- Removes 437 lines from main component
- Encapsulates all orientation/layout controls
- Easier to test grid layout logic
- Reusable for other worksheet types

#### 1.2 Extract `GenerateButton.tsx`

**Lines to extract**: 830-891 (62 lines)
**Responsibility**: Trigger worksheet generation
**Props**:

```typescript
interface GenerateButtonProps {
  status: "idle" | "generating" | "error";
  onGenerate: () => void;
}
```

**Benefits**:

- Removes 62 lines from main component
- Cleaner separation of generation UI from logic
- Easier to add loading states, progress indicators

#### 1.3 Extract `GenerationErrorDisplay.tsx`

**Lines to extract**: 908-965 (58 lines)
**Responsibility**: Show generation errors
**Props**:

```typescript
interface GenerationErrorDisplayProps {
  error: string | null;
  visible: boolean;
  onRetry: () => void;
}
```

**Benefits**:

- Removes 58 lines from main component
- Encapsulates error UI
- Reusable for other error scenarios

### Phase 2: Extract Business Logic (Medium Risk)

#### 2.1 Create `useWorksheetState.ts` Hook

**Lines to extract**: 46-231 (186 lines)
**Responsibility**: Manage worksheet state with debouncing and seed regeneration
**Interface**:

```typescript
interface UseWorksheetStateReturn {
  formState: WorksheetFormState;
  debouncedFormState: WorksheetFormState;
  updateFormState: (updates: Partial<WorksheetFormState>) => void;
}

function useWorksheetState(
  initialSettings: Omit<WorksheetFormState, "date" | "rows" | "total">,
): UseWorksheetStateReturn;
```

**Extracted logic**:

- Form state initialization with derived calculations (rows, total)
- Debounced state for preview updates (500ms delay)
- Seed regeneration when problem settings change
- StrictMode double-render handling with refs

**Benefits**:

- Removes 186 lines from main component
- Separates state management from UI
- Easier to test state transitions
- Can be reused for other worksheet types

#### 2.2 Create `useWorksheetGeneration.ts` Hook

**Lines to extract**: 256-315 (60 lines)
**Responsibility**: Handle PDF generation workflow
**Interface**:

```typescript
interface UseWorksheetGenerationReturn {
  status: "idle" | "generating" | "error";
  error: string | null;
  generate: (config: WorksheetFormState) => Promise<void>;
  reset: () => void;
}

function useWorksheetGeneration(): UseWorksheetGenerationReturn;
```

**Extracted logic**:

- Generation status state ('idle', 'generating', 'error')
- Error state management
- Validation before generation
- API call to `/api/create/worksheets/addition`
- PDF blob download logic
- Error handling

**Benefits**:

- Removes 60 lines from main component
- Encapsulates generation workflow
- Easier to test API interactions
- Can add retry logic, progress tracking

#### 2.3 Create `useWorksheetAutoSave.ts` Hook

**Lines to extract**: 122-209 (88 lines)
**Responsibility**: Auto-save worksheet settings to server
**Interface**:

```typescript
interface UseWorksheetAutoSaveReturn {
  isSaving: boolean;
  lastSaved: Date | null;
}

function useWorksheetAutoSave(
  formState: WorksheetFormState,
  worksheetType: "addition",
): UseWorksheetAutoSaveReturn;
```

**Extracted logic**:

- Auto-save timer (1000ms debounce)
- Settings persistence API call
- Save status tracking (isSaving, lastSaved)
- StrictMode double-render handling
- Silent error handling

**Benefits**:

- Removes 88 lines from main component
- Separates persistence concerns
- Easier to test auto-save behavior
- Can be reused for other worksheet types

### Phase 3: Extract Utility Functions (Low Risk)

#### 3.1 Create `src/app/create/worksheets/addition/utils/dateFormatting.ts`

**Lines to extract**: 18-27 (10 lines)
**Exports**:

```typescript
export function getDefaultDate(): string;
```

**Benefits**:

- Removes 10 lines from main component
- Reusable date formatting utility
- Easier to test date formatting
- Centralized date formatting logic

#### 3.2 Create `src/app/create/worksheets/addition/utils/layoutCalculations.ts`

**Lines to extract**: 233-254 (22 lines)
**Exports**:

```typescript
export function getDefaultColsForProblemsPerPage(
  problemsPerPage: number,
  orientation: "portrait" | "landscape",
): number;

export function calculateDerivedState(
  problemsPerPage: number,
  pages: number,
  cols: number,
): { rows: number; total: number };
```

**Benefits**:

- Removes 22 lines from main component
- Encapsulates layout calculation logic
- Easier to test grid calculations
- Can add more layout utilities

### Phase 4: Simplified Main Component

After all extractions, `AdditionWorksheetClient.tsx` should be:

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../../../styled-system/css'
import { container, grid, stack } from '../../../../../../styled-system/patterns'
import { ConfigPanel } from './ConfigPanel'
import { WorksheetPreview } from './WorksheetPreview'
import { OrientationPanel } from './OrientationPanel'
import { GenerateButton } from './GenerateButton'
import { GenerationErrorDisplay } from './GenerationErrorDisplay'
import { useWorksheetState } from '../hooks/useWorksheetState'
import { useWorksheetGeneration } from '../hooks/useWorksheetGeneration'
import { useWorksheetAutoSave } from '../hooks/useWorksheetAutoSave'
import { getDefaultDate } from '../utils/dateFormatting'
import type { WorksheetFormState } from '../types'

interface AdditionWorksheetClientProps {
  initialSettings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  initialPreview?: string[]
}

export function AdditionWorksheetClient({
  initialSettings,
  initialPreview,
}: AdditionWorksheetClientProps) {
  const t = useTranslations('create.worksheets.addition')

  // State management (formState, debouncedFormState, updateFormState)
  const { formState, debouncedFormState, updateFormState } = useWorksheetState(initialSettings)

  // Generation workflow (status, error, generate, reset)
  const { status, error, generate, reset } = useWorksheetGeneration()

  // Auto-save (isSaving, lastSaved)
  const { isSaving, lastSaved } = useWorksheetAutoSave(formState, 'addition')

  // Generate handler with date injection
  const handleGenerate = async () => {
    await generate({
      ...formState,
      date: getDefaultDate(),
    })
  }

  return (
    <PageWithNav navTitle={t('navTitle')} navEmoji="📝">
      <div data-component="addition-worksheet-page" className={css({ minHeight: '100vh', bg: 'gray.50' })}>
        <div className={container({ maxW: '7xl', px: '4', py: '8' })}>
          {/* Header */}
          <div className={stack({ gap: '6', mb: '8' })}>
            <div className={stack({ gap: '2', textAlign: 'center' })}>
              <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', color: 'gray.900' })}>
                {t('pageTitle')}
              </h1>
              <p className={css({ fontSize: 'lg', color: 'gray.600' })}>
                {t('pageSubtitle')}
              </p>
            </div>
          </div>

          {/* Two-column layout */}
          <div className={grid({ columns: { base: 1, lg: 2 }, gap: '8', alignItems: 'start' })}>
            {/* Left column: ConfigPanel */}
            <div className={stack({ gap: '3' })}>
              <div data-section="config-panel" className={css({ bg: 'white', rounded: '2xl', shadow: 'card', p: '8' })}>
                <ConfigPanel formState={formState} onChange={updateFormState} />
              </div>

              {/* Settings saved indicator */}
              <div data-element="settings-status" className={css({ fontSize: 'sm', color: 'gray.600', textAlign: 'center', py: '2' })}>
                {isSaving ? (
                  <span className={css({ color: 'gray.500' })}>Saving settings...</span>
                ) : lastSaved ? (
                  <span className={css({ color: 'green.600' })}>
                    ✓ Settings saved at {lastSaved.toLocaleTimeString()}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right column: Orientation, Generate, Preview */}
            <div className={stack({ gap: '8' })}>
              <OrientationPanel
                orientation={formState.orientation || 'portrait'}
                problemsPerPage={formState.problemsPerPage || 15}
                pages={formState.pages || 1}
                cols={formState.cols || 3}
                onOrientationChange={(orientation) => updateFormState({ orientation })}
                onProblemsPerPageChange={(problemsPerPage) => updateFormState({ problemsPerPage })}
                onPagesChange={(pages) => updateFormState({ pages })}
              />

              <GenerateButton status={status} onGenerate={handleGenerate} />

              <div data-section="preview-panel" className={css({ bg: 'white', rounded: '2xl', shadow: 'card', p: '6' })}>
                <WorksheetPreview formState={debouncedFormState} initialData={initialPreview} />
              </div>
            </div>
          </div>

          {/* Error Display */}
          <GenerationErrorDisplay error={error} visible={status === 'error'} onRetry={reset} />
        </div>
      </div>
    </PageWithNav>
  )
}
```

**New size**: ~100 lines (down from 971 lines)

## Implementation Steps

### Step 1: Create Directory Structure

```bash
src/app/create/worksheets/addition/
├── components/
│   ├── AdditionWorksheetClient.tsx (main component)
│   ├── ConfigPanel.tsx (existing)
│   ├── WorksheetPreview.tsx (existing)
│   ├── OrientationPanel.tsx (NEW)
│   ├── GenerateButton.tsx (NEW)
│   └── GenerationErrorDisplay.tsx (NEW)
├── hooks/
│   ├── useWorksheetState.ts (NEW)
│   ├── useWorksheetGeneration.ts (NEW)
│   └── useWorksheetAutoSave.ts (NEW)
└── utils/
    ├── dateFormatting.ts (NEW)
    └── layoutCalculations.ts (NEW)
```

### Step 2: Extract in Order (Safest → Riskiest)

1. **Extract utilities** (dateFormatting, layoutCalculations)
   - Low risk: Pure functions, easy to test
   - No state dependencies

2. **Extract UI components** (OrientationPanel, GenerateButton, GenerationErrorDisplay)
   - Low risk: Presentational components
   - Props clearly defined

3. **Extract hooks** (useWorksheetState, useWorksheetGeneration, useWorksheetAutoSave)
   - Medium risk: Contains business logic
   - Requires careful state handling

4. **Refactor main component** (AdditionWorksheetClient)
   - Low risk: Just wiring up extracted pieces
   - Should be straightforward

### Step 3: Testing Strategy

For each extraction:

1. Create new file
2. Move code to new file
3. Update imports in main component
4. Run `npm run type-check` to verify TypeScript
5. Run `npm run lint` to verify code quality
6. Manually test in browser
7. Commit with clear message

**DO NOT** commit all changes at once. Each extraction should be a separate commit.

### Step 4: Post-Refactoring Verification

After all extractions:

1. Run full test suite (if exists)
2. Manual testing of all features:
   - Orientation switching
   - Problems per page dropdown
   - Pages buttons
   - Generate PDF workflow
   - Error handling
   - Auto-save persistence
   - Preview updates

## Migration Checklist

- [ ] Step 1: Create directory structure
- [ ] Extract `utils/dateFormatting.ts`
- [ ] Extract `utils/layoutCalculations.ts`
- [ ] Extract `OrientationPanel.tsx`
- [ ] Extract `GenerateButton.tsx`
- [ ] Extract `GenerationErrorDisplay.tsx`
- [ ] Extract `hooks/useWorksheetState.ts`
- [ ] Extract `hooks/useWorksheetGeneration.ts`
- [ ] Extract `hooks/useWorksheetAutoSave.ts`
- [ ] Refactor `AdditionWorksheetClient.tsx` to use extracted pieces
- [ ] Run `npm run pre-commit` to verify quality
- [ ] Manual testing of all features
- [ ] Update documentation if needed

## Expected Benefits

### Code Quality

- **Reduced complexity**: Main component from 971 → ~100 lines
- **Single Responsibility**: Each component/hook has one clear purpose
- **Better testability**: Isolated logic easier to unit test
- **Improved readability**: Clear separation of concerns

### Developer Experience

- **Easier maintenance**: Smaller files easier to understand
- **Faster iteration**: Changes isolated to specific files
- **Better IntelliSense**: Smaller files load faster in editor
- **Clearer git diffs**: Changes don't touch massive files

### Future Enhancements

- **Reusability**: Hooks and utils can be used for other worksheet types
- **Extensibility**: Easy to add new features to specific sections
- **Parallel development**: Different developers can work on different components
- **Testing**: Can add unit tests for each isolated piece

## Risks and Mitigations

### Risk 1: Breaking existing functionality

**Mitigation**: Extract one piece at a time, test thoroughly, commit frequently

### Risk 2: State synchronization issues

**Mitigation**: Keep state management hooks simple, avoid complex dependencies

### Risk 3: Props drilling

**Mitigation**: Use custom hooks to encapsulate state, pass minimal props

### Risk 4: Regression in auto-save behavior

**Mitigation**: Test auto-save thoroughly, keep debounce logic identical

### Risk 5: Loss of debug logging

**Mitigation**: Keep console.log statements in extracted hooks during development

## Success Criteria

- [ ] Main component under 150 lines
- [ ] All TypeScript checks pass
- [ ] All linting checks pass
- [ ] All existing functionality works identically
- [ ] No new errors in browser console
- [ ] Auto-save still works as expected
- [ ] PDF generation still works as expected
- [ ] Preview updates still debounced correctly
- [ ] Orientation/layout controls work identically

## Timeline Estimate

- **Phase 1 (UI extractions)**: 2-3 hours
- **Phase 2 (Logic extractions)**: 3-4 hours
- **Phase 3 (Utilities)**: 30 minutes
- **Phase 4 (Main component)**: 1-2 hours
- **Testing and polish**: 1-2 hours

**Total**: 8-12 hours of focused work

## Notes

- This refactoring should NOT change any user-facing behavior
- All existing features must continue to work exactly as before
- Focus on extraction, not rewriting
- Keep git history clean with descriptive commit messages
- Run `npm run pre-commit` before every commit
- Test manually after each extraction
