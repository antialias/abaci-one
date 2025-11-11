# Mastery Progression Example: Single-Carry Technique

This shows the complete progression for learning the **single-carry** technique, demonstrating how scaffolding cycles as complexity increases.

## The Pattern: Scaffolding Fade Cycles

For each new complexity level:

1. **WITH scaffolding** - Learn the pattern with visual support
2. **WITHOUT scaffolding** - Internalize the concept
3. **Next complexity WITH scaffolding** - Apply to harder problems with support again
4. Repeat

## Complete Single-Carry Progression (12 objectives)

### Phase 1: Single-Digit Carrying (Entry Level)

#### Objective 1: Single-digit with ten-frames

- **Technique**: single-carry
- **Complexity**: sd-with-regroup (1-digit, 100% regrouping)
- **Scaffolding**: FULL
- **Config**:
  - digitRange: {min: 1, max: 1}
  - pAnyStart: 1.0, pAllStart: 0
  - tenFrames: 'whenRegrouping' ✓ (shows for all since all regroup)
  - carryBoxes: 'whenRegrouping' ✓
- **Example problems**: 7+8, 9+6, 8+5 (all with ten-frames)
- **Next**: Objective 2 (same complexity, less scaffolding)

#### Objective 2: Single-digit without ten-frames

- **Technique**: single-carry
- **Complexity**: sd-with-regroup (1-digit, 100% regrouping)
- **Scaffolding**: PARTIAL (no ten-frames)
- **Config**:
  - digitRange: {min: 1, max: 1}
  - pAnyStart: 1.0, pAllStart: 0
  - tenFrames: 'never' ✗ (removed)
  - carryBoxes: 'whenRegrouping' ✓ (still showing)
- **Example problems**: 7+8, 9+6, 8+5 (no ten-frames)
- **Next**: Objective 3 (higher complexity, reintroduce scaffolding)

---

### Phase 2: Two-Digit Carrying (Ones Place Only)

#### Objective 3: Two-digit ones-carry with ten-frames

- **Technique**: single-carry
- **Complexity**: td-ones-regroup (2-digit, ones only)
- **Scaffolding**: FULL (scaffolding RETURNS for new complexity!)
- **Config**:
  - digitRange: {min: 2, max: 2}
  - pAnyStart: 1.0, pAllStart: 0
  - tenFrames: 'whenRegrouping' ✓ (BACK!)
  - carryBoxes: 'whenRegrouping' ✓
- **Example problems**: 38+27 (with ten-frames), 49+15, 56+28
- **Why ten-frames return?** New complexity = need visual support again
- **Next**: Objective 4 (same complexity, fade scaffolding)

#### Objective 4: Two-digit ones-carry without ten-frames

- **Technique**: single-carry
- **Complexity**: td-ones-regroup (2-digit, ones only)
- **Scaffolding**: PARTIAL
- **Config**:
  - digitRange: {min: 2, max: 2}
  - pAnyStart: 1.0, pAllStart: 0
  - tenFrames: 'never' ✗
  - carryBoxes: 'whenRegrouping' ✓
- **Example problems**: 38+27 (no ten-frames), 49+15, 56+28
- **Next**: Objective 5 (higher complexity, reintroduce scaffolding)

---

### Phase 3: Two-Digit Carrying (Mixed/All Places)

#### Objective 5: Two-digit mixed-carry with ten-frames

- **Technique**: single-carry → multi-carry transition
- **Complexity**: td-mixed-regroup (2-digit, 70% any, 30% all)
- **Scaffolding**: FULL
- **Config**:
  - digitRange: {min: 2, max: 2}
  - pAnyStart: 0.7, pAllStart: 0.3
  - tenFrames: 'whenRegrouping' ✓
  - carryBoxes: 'whenRegrouping' ✓
- **Example problems**: Mix of 38+27 (ones), 57+68 (all), 23+45 (none)
- **Next**: Objective 6

#### Objective 6: Two-digit mixed-carry without ten-frames

- **Technique**: multi-carry (if pAllStart > 0)
- **Complexity**: td-mixed-regroup
- **Scaffolding**: PARTIAL
- **Config**:
  - tenFrames: 'never' ✗
  - carryBoxes: 'whenRegrouping' ✓
- **Next**: Objective 7 (higher complexity, reintroduce scaffolding)

---

### Phase 4: Three-Digit Carrying (Ones Place Only)

#### Objective 7: Three-digit ones-carry with ten-frames

- **Technique**: single-carry
- **Complexity**: xd-ones-regroup (3-digit, ones only)
- **Scaffolding**: FULL (scaffolding RETURNS again!)
- **Config**:
  - digitRange: {min: 3, max: 3}
  - pAnyStart: 1.0, pAllStart: 0
  - tenFrames: 'whenRegrouping' ✓ (BACK AGAIN!)
  - carryBoxes: 'whenRegrouping' ✓
- **Example problems**: 138+227, 549+315
- **Why ten-frames again?** 3-digit is new complexity, needs support
- **Next**: Objective 8

#### Objective 8: Three-digit ones-carry without ten-frames

- **Technique**: single-carry
- **Complexity**: xd-ones-regroup
- **Scaffolding**: PARTIAL
- **Config**:
  - tenFrames: 'never' ✗
  - carryBoxes: 'whenRegrouping' ✓
- **Next**: Objective 9

---

### Phase 5: Three-Digit Multi-Carry

#### Objective 9: Three-digit multi-carry with ten-frames

- **Technique**: multi-carry
- **Complexity**: xd-multi-regroup (3-digit, 2+ places)
- **Scaffolding**: FULL
- **Config**:
  - digitRange: {min: 3, max: 3}
  - pAnyStart: 1.0, pAllStart: 0.5
  - tenFrames: 'whenRegrouping' ✓
  - carryBoxes: 'whenMultipleRegroups' (adjusted)
- **Example problems**: 687+458, 879+264
- **Next**: Objective 10

#### Objective 10: Three-digit multi-carry without ten-frames

- **Technique**: multi-carry
- **Complexity**: xd-multi-regroup
- **Scaffolding**: MINIMAL
- **Config**:
  - tenFrames: 'never' ✗
  - carryBoxes: 'whenMultipleRegroups'
- **Next**: Objective 11

---

### Phase 6: Four-Digit (Advanced)

#### Objective 11: Four-digit with scaffolding

- **Technique**: multi-carry
- **Complexity**: xxd-mixed (4-digit)
- **Scaffolding**: FULL (for new complexity)
- **Config**:
  - digitRange: {min: 4, max: 4}
  - tenFrames: 'whenRegrouping' ✓ (might be useful)
  - carryBoxes: 'whenMultipleRegroups'
- **Note**: At this level, ten-frames might be less useful (too many digits)
- **Next**: Objective 12

#### Objective 12: Four-digit minimal scaffolding

- **Technique**: multi-carry
- **Complexity**: xxd-mixed
- **Scaffolding**: MINIMAL
- **Config**:
  - tenFrames: 'never' ✗
  - carryBoxes: 'whenMultipleRegroups'
- **Next**: Five-digit, or MASTERED!

---

## Key Insights

### 1. Scaffolding Cycles

Ten-frames appear 6 times in this progression (objectives 1, 3, 5, 7, 9, 11), not just once!

### 2. Gradual Fade at Each Level

Pattern: WITH → WITHOUT → (next complexity) WITH → WITHOUT

### 3. Two Dimensions of Progress

- **Horizontal**: Fade scaffolding (full → partial → minimal)
- **Vertical**: Increase complexity (1-digit → 2-digit → 3-digit → 4-digit)

### 4. Spiral Curriculum

Students encounter the same technique multiple times with:

- Increasing complexity
- Decreasing scaffolding
- Building mastery through repetition with variation

### 5. NOT a Linear Progression

This is NOT: "learn with ten-frames, then never see them again"
This IS: "cycle between scaffolded and unscaffolded practice as difficulty increases"

## Implementation in UI

Instead of showing 12 separate "skills", we could show:

```
Technique: Single-place Carrying
├─ 1-digit (with support) ✓
├─ 1-digit (independent) ✓
├─ 2-digit ones (with support) ✓
├─ 2-digit ones (independent) ← currently practicing
├─ 2-digit mixed (with support)
├─ 2-digit mixed (independent)
├─ 3-digit ones (with support)
└─ ...
```

Or even more compact:

```
Single-place Carrying
├─ 1-digit: ✓✓ (mastered)
├─ 2-digit: ✓○ (scaffolding fading...)
├─ 3-digit: ○○ (not started)
```

Where ✓○ means "mastered with scaffolding, practicing without"
