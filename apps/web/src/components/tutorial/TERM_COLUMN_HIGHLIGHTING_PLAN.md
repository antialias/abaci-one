# Term-to-Column Highlighting Integration Plan

## Problem Statement

Currently, when users hover over mathematical terms in the decomposition display (e.g., "20" in "3475 + 25 = 3475 + 20 + 5"), the terms are highlighted with enhanced tooltips, but the corresponding abacus columns are not highlighted. This creates a disconnect between the mathematical explanation and the physical abacus visualization.

## Goal

Implement bidirectional highlighting where hovering over mathematical terms highlights the corresponding abacus columns, and vice versa, creating a cohesive learning experience that connects abstract math to concrete bead manipulation.

## Current Architecture Analysis

### Term Highlighting System (DecompositionWithReasons.tsx)

- **State**: `activeTerms: Set<number>` tracks hovered terms
- **Actions**: `addActiveTerm()`, `removeActiveTerm()` manage term states
- **Context**: `DecompositionContext` contains highlighting state
- **Scope**: Limited to decomposition component only
- **Data**: Has access to provenance data with `rhsPlace` information

### Column Highlighting System (TutorialPlayer.tsx)

- **State**: `customStyles` computed from `currentStep.highlightBeads`
- **Data**: `StepBeadHighlight[]` arrays specify column/bead styling
- **Mapping**: `placeValue` (0=ones, 1=tens) ↔ `columnIndex` (4=ones, 3=tens)
- **Scope**: Controls abacus visual display
- **Current**: Static highlighting based on tutorial step definition

## Technical Implementation Plan

### Phase 1: Context Bridge (Tutorial Context Extension)

**File**: `/src/components/tutorial/TutorialContext.tsx`

1. **Extend Interface**:

   ```typescript
   interface TutorialContextType {
     // ... existing fields
     activeTermIndices: Set<number>;
     setActiveTermIndices: (indices: Set<number>) => void;
     getColumnFromTermIndex: (termIndex: number) => number | null;
   }
   ```

2. **Add State Management**:

   ```typescript
   const [activeTermIndices, setActiveTermIndices] = useState<Set<number>>(
     new Set(),
   );
   ```

3. **Implement Mapping Function**:

   ```typescript
   const getColumnFromTermIndex = useCallback(
     (termIndex: number) => {
       const step = unifiedSteps[termIndex];
       if (!step?.provenance) return null;

       // Convert rhsPlace (0=ones, 1=tens) to columnIndex (4=ones, 3=tens)
       return 4 - step.provenance.rhsPlace;
     },
     [unifiedSteps],
   );
   ```

### Phase 2: Decomposition Integration

**File**: `/src/components/tutorial/DecompositionWithReasons.tsx`

1. **Remove Local State**:
   - Replace local `activeTerms` with context `activeTermIndices`
   - Update `addActiveTerm`/`removeActiveTerm` to call context functions

2. **Context Integration**:

   ```typescript
   const { activeTermIndices, setActiveTermIndices } = useTutorialContext();

   const addActiveTerm = (termIndex: number, segmentId?: string) => {
     setActiveTermIndices((prev) => new Set([...prev, termIndex]));
   };
   ```

### Phase 3: Abacus Integration

**File**: `/src/components/tutorial/TutorialPlayer.tsx`

1. **Dynamic Styles Calculation**:

   ```typescript
   const dynamicColumnHighlights = useMemo(() => {
     const highlights: Record<number, any> = {};

     activeTermIndices.forEach((termIndex) => {
       const columnIndex = getColumnFromTermIndex(termIndex);
       if (columnIndex !== null) {
         highlights[columnIndex] = {
           heaven: { fill: "#60a5fa", stroke: "#3b82f6", strokeWidth: 2 },
           earth: { fill: "#60a5fa", stroke: "#3b82f6", strokeWidth: 2 },
         };
       }
     });

     return highlights;
   }, [activeTermIndices, getColumnFromTermIndex]);
   ```

2. **Merge Highlighting Systems**:

   ```typescript
   const customStyles = useMemo(() => {
     const staticStyles = computeStaticHighlights(currentStep.highlightBeads);
     const dynamicStyles = dynamicColumnHighlights;

     return mergeHighlightStyles(staticStyles, dynamicStyles);
   }, [currentStep.highlightBeads, dynamicColumnHighlights]);
   ```

### Phase 4: Bidirectional Interaction

**File**: `/src/components/tutorial/TutorialPlayer.tsx`

1. **Abacus Hover Handler**:

   ```typescript
   const handleAbacusColumnHover = useCallback(
     (columnIndex: number, isHovering: boolean) => {
       if (isHovering) {
         // Find all terms that correspond to this column
         const relatedTerms = unifiedSteps
           .map((step, index) => ({ step, index }))
           .filter(
             ({ step }) =>
               step.provenance && 4 - step.provenance.rhsPlace === columnIndex,
           )
           .map(({ index }) => index);

         setActiveTermIndices(new Set(relatedTerms));
       } else {
         setActiveTermIndices(new Set());
       }
     },
     [unifiedSteps, setActiveTermIndices],
   );
   ```

## Data Flow Architecture

```
User hovers over "20" term
     ↓
DecompositionWithReasons detects hover
     ↓
Calls setActiveTermIndices([termIndex])
     ↓
TutorialContext updates activeTermIndices state
     ↓
TutorialPlayer recomputes customStyles
     ↓
AbacusReact highlights tens column (columnIndex 3)
```

## File Modifications Summary

1. **TutorialContext.tsx**: Add term-to-column mapping and shared state
2. **DecompositionWithReasons.tsx**: Remove local state, integrate with context
3. **TutorialPlayer.tsx**: Add dynamic column highlighting from active terms
4. **Types/Interfaces**: Extend context interface, add highlight merge utilities

## Testing Strategy

1. **Unit Tests**:
   - Term index to column mapping accuracy
   - Highlight merging logic (static + dynamic)
   - Context state management

2. **Integration Tests**:
   - Hover over "20" → tens column highlights
   - Hover over complement terms → ones column highlights
   - Multiple term selection → multiple column highlights

3. **E2E Tests**:
   - Full user interaction flow
   - Performance with complex decompositions
   - Visual regression testing

## Performance Considerations

1. **Memoization**: All mapping and style calculations are memoized
2. **Debouncing**: Consider debouncing hover events for smoother interaction
3. **Selective Updates**: Only recompute styles when activeTermIndices changes

## Migration Strategy

1. **Backward Compatibility**: Existing static highlighting continues to work
2. **Feature Flag**: Could be enabled/disabled via tutorial configuration
3. **Graceful Degradation**: Works without provenance data (no dynamic highlighting)

## Success Metrics

1. **Functional**: Terms correctly map to columns (100% accuracy)
2. **Performance**: No noticeable lag during hover interactions
3. **UX**: Students report better understanding of term-to-column relationships
4. **Technical**: No regressions in existing highlighting functionality
