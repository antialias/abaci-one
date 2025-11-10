# Progression Path Pedagogy

## Overview

The mastery progression system guides students through addition skills using research-based pedagogical scaffolding. This document describes the improved progression path that starts with foundational skills before introducing regrouping/carrying.

## Key Pedagogical Principles

### 1. **Foundation Before Complexity**
Students must master basic addition (sums ≤ 9) before learning carrying. This builds:
- Number sense and fact fluency
- Confidence with the addition operation
- Mental calculation strategies

### 2. **Graduated Difficulty**
Three levels of regrouping difficulty:
- **0% regrouping** (pAnyStart: 0) - All sums ≤ 9 (e.g., 3+4, 5+2)
- **50% regrouping** (pAnyStart: 0.5) - Mixed practice
- **100% regrouping** (pAnyStart: 1.0) - All problems require carrying

### 3. **Scaffolding Cycle Pattern**
For each new complexity level (digit count):
1. **Full scaffolding** - Ten-frames + carry boxes + place value colors
2. **Fade scaffolding** - Remove ten-frames, keep structure
3. **Increase complexity** - Add more digits, reintroduce scaffolding

### 4. **Mastery-Based Progression**
Students advance when they demonstrate:
- **Accuracy**: 85-95% correct (varies by difficulty)
- **Volume**: Minimum 15-20 problems attempted
- **Consistency**: Sustained performance over multiple worksheets

## Current Progression Path

### Phase 0: Foundation (Steps 0-1)

#### Step 0: Basic Single-Digit Addition
**Config**: 1 digit, 0% regrouping, minimal scaffolding
```typescript
pAnyStart: 0      // All sums ≤ 9
tenFrames: 'never'
placeValueColors: 'never'
carryBoxes: 'never'
```

**Sample Problems**:
- 3 + 4 = 7
- 5 + 2 = 7
- 6 + 1 = 7
- 4 + 3 = 7

**Mastery**: 95% accuracy, 15 problems minimum

**Rationale**: Build foundational number sense and operation understanding without the cognitive load of regrouping.

#### Step 1: Mixed Single-Digit Practice
**Config**: 1 digit, 50% regrouping, conditional scaffolding
```typescript
pAnyStart: 0.5    // Half need carrying
tenFrames: 'never'
placeValueColors: 'whenRegrouping'
carryBoxes: 'whenRegrouping'
```

**Sample Problems**:
- 3 + 4 = 7 (no carrying)
- **8 + 7 = 15** (carrying) ← Carry box shown
- 5 + 2 = 7 (no carrying)
- **9 + 6 = 15** (carrying) ← Carry box shown

**Mastery**: 90% accuracy, 20 problems minimum

**Rationale**: Gradual introduction to carrying in mixed context. Students see both types of problems and begin to recognize when carrying is needed.

### Phase 1: Single-Digit Carrying (Steps 2-3)

#### Step 2: Full Scaffolding (100% regrouping)
**Config**: 1 digit, 100% regrouping, full visual support
```typescript
pAnyStart: 1.0    // All require carrying
tenFrames: 'whenRegrouping'  // ← TEN-FRAMES INTRODUCED
placeValueColors: 'always'
carryBoxes: 'whenRegrouping'
```

**Sample Problems**: (all show ten-frames)
- **8 + 7 = 15** 🔟🔟 (visual: 8 dots + 7 dots = full frame + 5 dots)
- **9 + 6 = 15** 🔟🔟
- **7 + 8 = 15** 🔟🔟

**Mastery**: 90% accuracy, 20 problems

**Rationale**: Ten-frames provide concrete visual representation of "making ten" (e.g., 8+7: take 2 from 7 to make 10, then add 5 more = 15). This supports the conceptual understanding of regrouping.

#### Step 3: Minimal Scaffolding
**Config**: 1 digit, 100% regrouping, ten-frames removed
```typescript
pAnyStart: 1.0
tenFrames: 'never'  // ← SCAFFOLDING FADED
placeValueColors: 'always'
carryBoxes: 'whenRegrouping'
```

**Mastery**: 90% accuracy, 20 problems

**Rationale**: Students internalize the carrying procedure and no longer need visual aids. The carry boxes remain to support procedural memory.

### Phase 2: Two-Digit Carrying (Steps 4-5)

**Same scaffolding cycle**, new digit range:
- Step 4: 2 digits, full scaffolding (ten-frames RETURN for new complexity)
- Step 5: 2 digits, minimal scaffolding (ten-frames fade)

**Sample Problems (Step 4)**:
- **27 + 18 = 45** (ones: 7+8=15, carrying to tens)
- **35 + 29 = 64** (ones: 5+9=14, carrying to tens)

**Rationale**: When complexity increases (more digits), scaffolding returns temporarily. This supports learning the new format while applying known carrying skills.

### Phase 3: Three-Digit Carrying (Steps 6-7)

**Same pattern**, 3 digits:
- Step 6: 3 digits, full scaffolding
- Step 7: 3 digits, minimal scaffolding

## Design Rationale

### Why Start with No Regrouping?

Research shows that:
1. **Cognitive Load**: Regrouping is a complex procedure. Students need to master basic addition first.
2. **Number Sense**: Understanding magnitude relationships (e.g., 7+3=10) supports later regrouping.
3. **Confidence**: Early success motivates continued practice.
4. **Diagnostic**: If students struggle with basic addition, regrouping will be impossible.

### Why Mixed Practice (50%)?

The transition step (Step 1) serves multiple purposes:
1. **Recognition Training**: Students learn to identify when carrying is needed
2. **Strategy Development**: Seeing both types helps students develop conditional reasoning
3. **Reduced Anxiety**: Not every problem is hard, maintaining motivation
4. **Real-World Realism**: Actual practice mixes problem types

### Why Ten-Frames?

Ten-frames are a research-validated manipulative that:
1. **Visualize Regrouping**: Clearly shows "making ten" (8 dots + 7 dots = full frame + 5)
2. **Support Subitizing**: Quick recognition of quantities up to 10
3. **Bridge Abstract/Concrete**: Connects symbolic notation to visual quantity
4. **Align with Base-10**: Naturally represents our number system

Example visualization:
```
8 + 7 = ?

[●●●●●]  ← Top frame (carry to next place)
[●●●●●]
[●●○○○]  ← Bottom frame (ones remaining)
[○○○○○]

8 dots + 7 dots = 10 dots (full frame) + 5 dots = 15
```

### Why Fade Scaffolding?

Scaffolding fading is essential for:
1. **Independence**: Students must eventually work without aids
2. **Efficiency**: Visual aids slow down calculation
3. **Transfer**: Skills must work in different contexts (tests, real life)
4. **Assessment**: Teacher needs to verify internalized understanding

## Future Extensions

### Multi-Carry Path (Not Yet Implemented)
Steps 8-13 would teach carrying in multiple places:
- 157 + 268 (carries in ones AND tens)
- 789 + 456 (carries in ones AND tens AND hundreds)

### Subtraction Path (Not Yet Implemented)
Similar progression for borrowing:
- Basic subtraction (no borrowing)
- Mixed practice
- Full borrowing with hints
- Fade borrowing hints

## Testing and Validation

When implementing changes to the progression path:

1. **Verify step numbering**: Sequential, 0-based, no gaps
2. **Check navigation**: Each step's next/previous IDs are correct
3. **Test mastery thresholds**: Reasonable accuracy requirements (85-95%)
4. **Validate configs**: All displayRules are defined, operator is correct
5. **User testing**: Have real students attempt the progression

## Implementation Notes

**File**: `src/app/create/worksheets/addition/progressionPath.ts`

**Key Constants**:
- `SINGLE_CARRY_PATH`: Array of ProgressionStep objects
- Each step has: id, stepNumber, technique, name, description, config, mastery criteria, navigation

**Helper Functions**:
- `getStepFromSliderValue()`: Map UI slider (0-100) to step
- `getSliderValueFromStep()`: Map step to slider position
- `findNearestStep()`: Match config to closest step
- `getStepById()`: Lookup step by ID

## References

- **Ten-Frames**: Van de Walle, J. A. (2004). Elementary and Middle School Mathematics
- **Scaffolding Fading**: Wood, D., Bruner, J. S., & Ross, G. (1976). The role of tutoring in problem solving
- **Mastery Learning**: Bloom, B. S. (1968). Learning for Mastery
- **Cognitive Load**: Sweller, J. (1988). Cognitive load during problem solving
