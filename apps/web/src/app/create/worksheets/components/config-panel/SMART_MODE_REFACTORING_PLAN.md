# SmartModeControls.tsx Refactoring Plan

## Current State
- **File size**: 1505 lines
- **Complexity**: Multiple large, self-contained UI sections embedded in one component
- **Issues**: Hard to maintain, test, and reuse

## Proposed Refactoring

### 1. Extract DifficultyPresetDropdown Component (~270 lines)
**Lines**: 275-546
**Purpose**: Dropdown for selecting difficulty presets
**Props**:
```typescript
interface DifficultyPresetDropdownProps {
  currentProfile: DifficultyLevel | null
  isCustom: boolean
  nearestEasier: DifficultyLevel | null
  nearestHarder: DifficultyLevel | null
  customDescription: React.ReactNode
  hoverPreview: { pAnyStart: number; pAllStart: number; displayRules: DisplayRules; matchedProfile: string | 'custom' } | null
  operator: 'addition' | 'subtraction' | 'mixed'
  onChange: (updates: { difficultyProfile: DifficultyLevel; pAnyStart: number; pAllStart: number; displayRules: DisplayRules }) => void
  isDark?: boolean
}
```

### 2. Extract MakeEasierHarderButtons Component (~240 lines)
**Lines**: 548-850
**Purpose**: Four-button layout for adjusting difficulty
**Props**:
```typescript
interface MakeEasierHarderButtonsProps {
  canMakeEasier: { recommended: boolean; alternative: boolean }
  canMakeHarder: { recommended: boolean; alternative: boolean }
  onEasier: (mode: DifficultyMode) => void
  onHarder: (mode: DifficultyMode) => void
  isDark?: boolean
}
```

### 3. Extract OverallDifficultySlider Component (~200 lines)
**Lines**: 859-1110
**Purpose**: Slider with preset markers for difficulty adjustment
**Props**:
```typescript
interface OverallDifficultySliderProps {
  overallDifficulty: number
  currentProfile: DifficultyLevel | null
  isCustom: boolean
  onChange: (difficulty: number) => void
  isDark?: boolean
}
```

### 4. Extract DifficultySpaceMap Component (~390 lines)
**Lines**: 1113-1505
**Purpose**: 2D visualization of difficulty space with interactive hover
**Props**:
```typescript
interface DifficultySpaceMapProps {
  currentState: { pAnyStart: number; pAllStart: number; displayRules: DisplayRules }
  hoverPoint: { x: number; y: number } | null
  setHoverPoint: (point: { x: number; y: number } | null) => void
  setHoverPreview: (preview: { pAnyStart: number; pAllStart: number; displayRules: DisplayRules; matchedProfile: string | 'custom' } | null) => void
  operator: 'addition' | 'subtraction' | 'mixed'
  isDark?: boolean
}
```

### 5. Create Shared Style Utilities
**File**: `src/app/create/worksheets/addition/components/config-panel/buttonStyles.ts`
**Purpose**: Reusable button style generators to reduce duplication

```typescript
export function getDifficultyButtonStyles(
  isEnabled: boolean,
  isDark: boolean,
  variant: 'primary' | 'secondary'
): CSSProperties {
  // Common button styling logic
}
```

## Benefits
1. **Maintainability**: Each component focuses on single responsibility
2. **Testability**: Smaller components are easier to test in isolation
3. **Reusability**: Components can be reused in other contexts (e.g., MasteryModePanel)
4. **Readability**: Main SmartModeControls becomes a clean composition
5. **Performance**: React can optimize smaller component trees better
6. **Dark mode**: Easier to audit and maintain consistent theming

## Refactored SmartModeControls Structure
```tsx
export function SmartModeControls({ formState, onChange, isDark }: SmartModeControlsProps) {
  // State and logic
  const [showDebugPlot, setShowDebugPlot] = useState(false)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<...>(null)

  // Computed values
  const currentProfile = getProfileFromConfig(...)
  const isCustom = currentProfile === null

  return (
    <div data-section="smart-mode">
      <DigitRangeSection {...} />

      <div data-section="difficulty">
        <DifficultyPresetDropdown {...} />
        <MakeEasierHarderButtons {...} />
        <OverallDifficultySlider {...} />
        <DifficultySpaceMap {...} />
      </div>

      <RegroupingFrequencyPanel {...} />
    </div>
  )
}
```

## Risks & Mitigation
- **Risk**: Breaking existing functionality
  - **Mitigation**: Extract one component at a time, test thoroughly
- **Risk**: Props become too complex
  - **Mitigation**: Create intermediate types, use composition patterns
- **Risk**: Performance regression from more components
  - **Mitigation**: Use React.memo where appropriate

## Implementation Steps
1. ✅ Create this plan document
2. Extract DifficultyPresetDropdown
3. Extract MakeEasierHarderButtons
4. Extract OverallDifficultySlider
5. Extract DifficultySpaceMap
6. Create shared button utilities
7. Test all components
8. Commit and push

## Questions for User
1. Should we proceed with this refactoring plan?
2. Any components you'd prefer to keep inline?
3. Any additional concerns or requirements?
