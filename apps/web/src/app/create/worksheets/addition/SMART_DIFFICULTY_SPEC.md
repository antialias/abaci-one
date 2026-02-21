# Smart Difficulty System - Technical Implementation Specification

**Status**: ✅ IMPLEMENTED (Phases 1-3 complete, Phase 4 testing in progress)
**Last Updated**: November 2025 - Spec updated to reflect actual implementation

> **Note**: This document has been updated to match the actual implementation. Key differences from original spec:
>
> - Uses **hybrid discrete/continuous architecture** (indices for navigation, scores for visualization)
> - Includes **DEBUG features** (clickable 2D graph, live change preview)
> - makeHarder/makeEasier operate on **discrete indices**, not continuous scores
> - Constraint enforcement at **multiple points** (navigation, graph clicks, validation)

## Overview

This document specifies the implementation of a smart difficulty system that:

1. Maps problem characteristics to pedagogical scaffolding decisions
2. Provides simple UI for difficulty selection with smart presets
3. Supports conditional per-problem display rules
4. Enables "Make Easier/Harder" intelligent adjustment with optional dimension focus
5. Enforces pedagogical constraints via diagonal progression band
6. Maintains functionality throughout implementation
7. **Includes DEBUG tools for testing and verification**

## Key Innovation: Constrained 2D Pedagogical Space

Unlike traditional 1D difficulty systems, this implementation treats difficulty as a **constrained 2D manifold** where:

- **Challenge** (regrouping complexity) and **Support** (scaffolding) are independent dimensions
- Valid combinations form a **diagonal band** where higher challenge requires lower support
- This constraint encodes pedagogical principles: advanced students doing complex work shouldn't need maximum scaffolding, and beginners with simple problems shouldn't work completely independently
- Teachers can navigate the space via smart diagonal progression (default) or focus on specific dimensions (challenge-only or support-only adjustment)

## Core Concepts

### Problem Characteristics (n-digit + p-digit)

For any addition problem `a + b`:

- **Digit counts**: How many digits in each operand
- **Regrouping**: Does any place value carry?
- **Regrouping complexity**: How many place values carry?
- **Result digits**: Does sum have more digits than inputs?

### Pedagogical Scaffolding

Display options serve as scaffolds that reduce cognitive load:

- **Carry boxes**: Structure for tracking regrouping
- **Answer boxes**: Guide for aligned digit placement
- **Place value colors**: Visual cue for place value relationships
- **Ten-frames**: Concrete representation of regrouping
- **Problem numbers**: Reference and progress tracking
- **Cell borders**: Visual organization

### Difficulty Mapping

Difficulty = f(regrouping_frequency, scaffolding_amount)

- More regrouping + less scaffolding = harder
- Less regrouping + more scaffolding = easier

---

## Data Models

### 1. Problem Metadata

```typescript
// File: src/app/create/worksheets/addition/problemAnalysis.ts (NEW)

interface ProblemMeta {
  a: number;
  b: number;
  digitsA: number;
  digitsB: number;
  maxDigits: number;
  sum: number;
  digitsSum: number;
  requiresRegrouping: boolean;
  regroupCount: number;
  regroupPlaces: ("ones" | "tens" | "hundreds")[];
}

function analyzeProblem(a: number, b: number): ProblemMeta {
  const digitsA = a.toString().length;
  const digitsB = b.toString().length;
  const maxDigits = Math.max(digitsA, digitsB);
  const sum = a + b;
  const digitsSum = sum.toString().length;

  // Analyze regrouping
  const aDigits = String(a).padStart(3, "0").split("").map(Number).reverse();
  const bDigits = String(b).padStart(3, "0").split("").map(Number).reverse();

  const regroupPlaces: ("ones" | "tens" | "hundreds")[] = [];
  const places = ["ones", "tens", "hundreds"] as const;

  for (let i = 0; i < 3; i++) {
    if (aDigits[i] + bDigits[i] >= 10) {
      regroupPlaces.push(places[i]);
    }
  }

  return {
    a,
    b,
    digitsA,
    digitsB,
    maxDigits,
    sum,
    digitsSum,
    requiresRegrouping: regroupPlaces.length > 0,
    regroupCount: regroupPlaces.length,
    regroupPlaces,
  };
}

export { analyzeProblem, type ProblemMeta };
```

### 2. Display Rules

```typescript
// File: src/app/create/worksheets/addition/displayRules.ts (NEW)

type RuleMode =
  | "always"
  | "never"
  | "whenRegrouping" // Show when problem requires any regrouping
  | "whenMultipleRegroups" // Show when 2+ place values regroup
  | "when3PlusDigits"; // Show when maxDigits >= 3

interface DisplayRules {
  carryBoxes: RuleMode;
  answerBoxes: RuleMode;
  placeValueColors: RuleMode;
  tenFrames: RuleMode;
  problemNumbers: RuleMode;
  cellBorders: RuleMode;
}

interface ResolvedDisplayOptions {
  showCarryBoxes: boolean;
  showAnswerBoxes: boolean;
  showPlaceValueColors: boolean;
  showTenFrames: boolean;
  showProblemNumbers: boolean;
  showCellBorder: boolean;
}

function evaluateRule(mode: RuleMode, problem: ProblemMeta): boolean {
  switch (mode) {
    case "always":
      return true;
    case "never":
      return false;
    case "whenRegrouping":
      return problem.requiresRegrouping;
    case "whenMultipleRegroups":
      return problem.regroupCount >= 2;
    case "when3PlusDigits":
      return problem.maxDigits >= 3;
  }
}

function resolveDisplayForProblem(
  rules: DisplayRules,
  problem: ProblemMeta,
): ResolvedDisplayOptions {
  return {
    showCarryBoxes: evaluateRule(rules.carryBoxes, problem),
    showAnswerBoxes: evaluateRule(rules.answerBoxes, problem),
    showPlaceValueColors: evaluateRule(rules.placeValueColors, problem),
    showTenFrames: evaluateRule(rules.tenFrames, problem),
    showProblemNumbers: evaluateRule(rules.problemNumbers, problem),
    showCellBorder: evaluateRule(rules.cellBorders, problem),
  };
}

export { evaluateRule, resolveDisplayForProblem };
export type { RuleMode, DisplayRules, ResolvedDisplayOptions };
```

### 3. Difficulty Profiles

```typescript
// File: src/app/create/worksheets/addition/difficultyProfiles.ts (NEW)

interface DifficultyProfile {
  name: string;
  label: string;
  description: string;
  regrouping: {
    pAllStart: number;
    pAnyStart: number;
  };
  displayRules: DisplayRules;
}

const DIFFICULTY_PROFILES: Record<string, DifficultyProfile> = {
  beginner: {
    name: "beginner",
    label: "Beginner",
    description:
      "Full scaffolding with no regrouping. Focus on learning the structure of addition.",
    regrouping: { pAllStart: 0, pAnyStart: 0 },
    displayRules: {
      carryBoxes: "always", // Show structure even when not needed
      answerBoxes: "always", // Guide digit placement
      placeValueColors: "always", // Reinforce place value concept
      tenFrames: "never", // No regrouping = not needed
      problemNumbers: "always", // Help track progress
      cellBorders: "always", // Visual organization
    },
  },

  earlyLearner: {
    name: "earlyLearner",
    label: "Early Learner",
    description:
      "Scaffolds appear when needed. Introduces occasional regrouping.",
    regrouping: { pAllStart: 0, pAnyStart: 0.25 },
    displayRules: {
      carryBoxes: "whenRegrouping", // Show scaffold only when needed
      answerBoxes: "always", // Still guide placement
      placeValueColors: "always", // Reinforce concepts
      tenFrames: "whenRegrouping", // Visual aid for new concept
      problemNumbers: "always",
      cellBorders: "always",
    },
  },

  intermediate: {
    name: "intermediate",
    label: "Intermediate",
    description: "Reduced scaffolding with regular regrouping practice.",
    regrouping: { pAllStart: 0.25, pAnyStart: 0.75 },
    displayRules: {
      carryBoxes: "whenRegrouping", // Still helpful for regrouping
      answerBoxes: "whenMultipleRegroups", // Only for complex problems
      placeValueColors: "whenRegrouping", // Only when it matters
      tenFrames: "whenRegrouping", // Concrete aid when needed
      problemNumbers: "always",
      cellBorders: "always",
    },
  },

  advanced: {
    name: "advanced",
    label: "Advanced",
    description: "Minimal scaffolding with frequent complex regrouping.",
    regrouping: { pAllStart: 0.5, pAnyStart: 0.9 },
    displayRules: {
      carryBoxes: "never", // Should internalize concept
      answerBoxes: "never", // Should know alignment
      placeValueColors: "when3PlusDigits", // Only for larger numbers
      tenFrames: "never", // Beyond concrete representations
      problemNumbers: "always",
      cellBorders: "always",
    },
  },

  expert: {
    name: "expert",
    label: "Expert",
    description: "No scaffolding. Frequent complex regrouping for mastery.",
    regrouping: { pAllStart: 0.5, pAnyStart: 0.9 },
    displayRules: {
      carryBoxes: "never",
      answerBoxes: "never",
      placeValueColors: "never",
      tenFrames: "never",
      problemNumbers: "always",
      cellBorders: "always",
    },
  },
};

const DIFFICULTY_PROGRESSION = [
  "beginner",
  "earlyLearner",
  "intermediate",
  "advanced",
  "expert",
] as const;

// =============================================================================
// 2D DIFFICULTY SYSTEM: Discrete Progressions with Pedagogical Constraints
// =============================================================================

/**
 * IMPLEMENTATION NOTE: Discrete vs Continuous
 *
 * This implementation uses DISCRETE PROGRESSIONS rather than continuous math.
 * Instead of calculating scores on a 0-10 scale, we use explicit arrays of
 * regrouping and scaffolding configurations (REGROUPING_PROGRESSION, SCAFFOLDING_PROGRESSION).
 *
 * Why discrete?
 * - Testable: Can trace exact path through difficulty space
 * - Predictable: No floating-point drift
 * - Debuggable: Visualizable as 2D grid
 * - Enables constraints: Can enforce pedagogical validity at each index
 *
 * The discrete system has:
 * - 19 regrouping levels (indices 0-18)
 * - 13 scaffolding levels (indices 0-12)
 * - Diagonal constraint band that limits valid (regrouping, scaffolding) pairs
 */

/**
 * Discrete Regrouping Progression (19 levels)
 * Each entry specifies { pAnyStart, pAllStart } for that difficulty level
 */
const REGROUPING_PROGRESSION = [
  { pAnyStart: 0.0, pAllStart: 0.0 }, // 0: No regrouping
  { pAnyStart: 0.1, pAllStart: 0.0 }, // 1: Rare regrouping
  { pAnyStart: 0.25, pAllStart: 0.0 }, // 2: Occasional (Early Learner)
  // ... 16 more levels up to ...
  { pAnyStart: 0.9, pAllStart: 0.5 }, // 18: Maximum regrouping (Expert)
];

/**
 * Discrete Scaffolding Progression (13 levels)
 * Each entry specifies DisplayRules for that support level
 * Index 0 = maximum scaffolding, Index 12 = no scaffolding
 */
const SCAFFOLDING_PROGRESSION = [
  {
    /* Full scaffolding - all 'always' */
  }, // 0: Beginner
  {
    /* High scaffolding - mostly 'always' */
  }, // 1
  {
    /* Conditional scaffolding */
  }, // 2: Early Learner
  // ... 9 more levels ...
  {
    /* No scaffolding - all 'never' */
  }, // 12: Expert
];

/**
 * Pedagogical Constraint Band
 *
 * Not all (regrouping, scaffolding) combinations are pedagogically valid.
 * The constraint band enforces: "Higher challenge requires lower support"
 *
 * Valid scaffolding range for each regrouping index:
 * - Regrouping 0-2:   Scaffolding 0-4   (simple problems need structure)
 * - Regrouping 3-5:   Scaffolding 0-6   (light regrouping, still need help)
 * - Regrouping 6-9:   Scaffolding 1-8   (medium regrouping, transitional)
 * - Regrouping 10-12: Scaffolding 3-11  (high regrouping, reducing support)
 * - Regrouping 13-15: Scaffolding 4-12  (higher regrouping, full range)
 * - Regrouping 16-18: Scaffolding 6-12  (max regrouping, prefer independence)
 *
 * This creates a diagonal band through the 2D space.
 */
function getValidScaffoldingRange(regroupingIdx: number): {
  min: number;
  max: number;
} {
  // Implementation as in difficultyProfiles.ts
}

/**
 * Calculate regrouping intensity on 0-10 scale (for UI visualization only)
 * Maps probability settings to single dimension for display purposes
 */
function calculateRegroupingIntensity(
  pAnyStart: number,
  pAllStart: number,
): number {
  // pAnyStart (occasional regrouping) contributes 70% of score
  // pAllStart (compound regrouping) contributes 30% of score
  // This reflects pedagogical importance: frequency matters more than compound complexity
  return pAnyStart * 7 + pAllStart * 3;
}

/**
 * Reverse mapping: Convert regrouping intensity back to probabilities
 * Uses pedagogical progression: introduce frequency first, then compound
 */
function intensityToRegrouping(intensity: number): {
  pAnyStart: number;
  pAllStart: number;
} {
  // Below 5: Focus on pAnyStart, keep pAllStart minimal
  if (intensity <= 5) {
    return {
      pAnyStart: Math.min(intensity / 7, 1),
      pAllStart: 0,
    };
  }

  // Above 5: pAnyStart near max, start increasing pAllStart
  const excessIntensity = intensity - 5;
  return {
    pAnyStart: Math.min(5 / 7 + excessIntensity / 14, 1),
    pAllStart: Math.min(excessIntensity / 10, 1),
  };
}

/**
 * Calculate scaffolding level on 0-10 scale
 * Higher number = LESS scaffolding = HARDER
 *
 * Each rule contributes based on:
 * - 'always' = 0 pts (max scaffolding)
 * - 'whenRegrouping' = 2 pts (conditional)
 * - 'whenMultipleRegroups' = 5 pts (sparse)
 * - 'when3PlusDigits' = 7 pts (rare)
 * - 'never' = 10 pts (no scaffolding)
 */
function calculateScaffoldingLevel(rules: DisplayRules): number {
  const ruleScores = {
    always: 0,
    whenRegrouping: 2,
    whenMultipleRegroups: 5,
    when3PlusDigits: 7,
    never: 10,
  };

  const weights = {
    carryBoxes: 1.5, // Most pedagogically important
    answerBoxes: 1.5, // Very important for alignment
    placeValueColors: 1.0, // Helpful but less critical
    tenFrames: 1.0, // Concrete visual aid
    problemNumbers: 0.2, // Organizational, not scaffolding
    cellBorders: 0.2, // Visual structure, not scaffolding
  };

  const weightedScores = [
    ruleScores[rules.carryBoxes] * weights.carryBoxes,
    ruleScores[rules.answerBoxes] * weights.answerBoxes,
    ruleScores[rules.placeValueColors] * weights.placeValueColors,
    ruleScores[rules.tenFrames] * weights.tenFrames,
    ruleScores[rules.problemNumbers] * weights.problemNumbers,
    ruleScores[rules.cellBorders] * weights.cellBorders,
  ];

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedAverage =
    weightedScores.reduce((a, b) => a + b, 0) / totalWeight;

  return Math.min(10, Math.max(0, weightedAverage));
}

/**
 * Reverse mapping: Convert scaffolding level to display rules
 * Uses pedagogical progression: reduce critical scaffolds last
 */
function levelToScaffoldingRules(level: number): DisplayRules {
  // Level 0-2: Full scaffolding
  if (level <= 2) {
    return {
      carryBoxes: "always",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: level < 1 ? "never" : "whenRegrouping", // Ten-frames only when regrouping introduced
      problemNumbers: "always",
      cellBorders: "always",
    };
  }

  // Level 2-4: Transition to conditional
  if (level <= 4) {
    return {
      carryBoxes: "whenRegrouping",
      answerBoxes: "always",
      placeValueColors: "always",
      tenFrames: "whenRegrouping",
      problemNumbers: "always",
      cellBorders: "always",
    };
  }

  // Level 4-6: Reduce non-critical scaffolds
  if (level <= 6) {
    return {
      carryBoxes: "whenRegrouping",
      answerBoxes: level < 5.5 ? "always" : "whenMultipleRegroups",
      placeValueColors: "whenRegrouping",
      tenFrames: "whenRegrouping",
      problemNumbers: "always",
      cellBorders: "always",
    };
  }

  // Level 6-8: Remove critical scaffolds
  if (level <= 8) {
    return {
      carryBoxes: level < 7 ? "whenRegrouping" : "never",
      answerBoxes: "never",
      placeValueColors: level < 7.5 ? "whenRegrouping" : "when3PlusDigits",
      tenFrames: "never",
      problemNumbers: "always",
      cellBorders: "always",
    };
  }

  // Level 8-10: Minimal to no scaffolding
  return {
    carryBoxes: "never",
    answerBoxes: "never",
    placeValueColors: level < 9 ? "when3PlusDigits" : "never",
    tenFrames: "never",
    problemNumbers: "always",
    cellBorders: "always",
  };
}

/**
 * Calculate Euclidean distance between two points in difficulty space
 */
function difficultyDistance(
  reg1: number,
  scaf1: number,
  reg2: number,
  scaf2: number,
): number {
  return Math.sqrt(Math.pow(reg1 - reg2, 2) + Math.pow(scaf1 - scaf2, 2));
}

/**
 * Find nearest preset profile to current state
 * Returns profile and distance
 */
function findNearestPreset(
  currentRegrouping: number,
  currentScaffolding: number,
  direction: "harder" | "easier" | "any",
): { profile: DifficultyProfile; distance: number } | null {
  const candidates = DIFFICULTY_PROGRESSION.map((name) => {
    const profile = DIFFICULTY_PROFILES[name];
    const regrouping = calculateRegroupingIntensity(
      profile.regrouping.pAnyStart,
      profile.regrouping.pAllStart,
    );
    const scaffolding = calculateScaffoldingLevel(profile.displayRules);
    const distance = difficultyDistance(
      currentRegrouping,
      currentScaffolding,
      regrouping,
      scaffolding,
    );

    // Calculate if this preset is harder or easier
    // Harder = higher regrouping OR lower scaffolding (higher scaffolding level number)
    const isHarder =
      regrouping > currentRegrouping || scaffolding > currentScaffolding;
    const isEasier =
      regrouping < currentRegrouping || scaffolding < currentScaffolding;

    return { profile, distance, regrouping, scaffolding, isHarder, isEasier };
  });

  // Filter by direction
  const filtered = candidates.filter((c) => {
    if (direction === "any") return true;
    if (direction === "harder") return c.isHarder;
    if (direction === "easier") return c.isEasier;
    return false;
  });

  if (filtered.length === 0) return null;

  // Find closest
  const nearest = filtered.reduce((a, b) => (a.distance < b.distance ? a : b));
  return { profile: nearest.profile, distance: nearest.distance };
}

/**
 * Movement Modes for Difficulty Adjustment
 *
 * Teachers can adjust difficulty in three ways:
 * - 'both': Smart diagonal navigation (default) - adjusts challenge and support together
 * - 'challenge': Horizontal movement - only changes problem complexity (regrouping)
 * - 'support': Vertical movement - only changes scaffolding level (visual aids)
 *
 * This allows teachers to be pedagogically precise:
 * - "Student ready for harder problems but still needs visual aids" → challenge-only
 * - "Student understands concept, time to remove training wheels" → support-only
 * - "Student struggling" → both (smart diagonal toward easier preset)
 */
type DifficultyMode = "both" | "challenge" | "support";

/**
 * IMPLEMENTATION NOTE: Hybrid Discrete/Continuous Architecture
 *
 * The system uses a HYBRID approach combining discrete and continuous representations:
 *
 * 1. DISCRETE INDICES for navigation (primary):
 *    - State is stored as indices: regroupingIdx (0-18), scaffoldingIdx (0-12)
 *    - Navigation operates on indices: increment/decrement with constraint checking
 *    - Enables precise control and prevents drift
 *
 * 2. CONTINUOUS SCORES for visualization/preset-finding (secondary):
 *    - Scores calculated from config: calculateRegroupingIntensity() → 0-10
 *    - Used for: finding nearest preset, overall difficulty bar, 2D graph visualization
 *    - NOT used for state updates (indices are source of truth)
 *
 * 3. CONSTRAINT ENFORCEMENT at multiple points:
 *    - During navigation: findNearestValidState() auto-corrects invalid states
 *    - On graph clicks: Maps click → indices → validates → applies constraints
 *    - Proactively: Current state validated before every move
 *
 * This hybrid approach gives us:
 * - Predictable, testable navigation (discrete indices)
 * - Smooth visualization and preset snapping (continuous scores)
 * - Guaranteed constraint satisfaction (validation at every step)
 */

/**
 * Make worksheet harder with optional dimension focus
 *
 * ACTUAL IMPLEMENTATION (index-based, not score-based):
 *
 * Algorithm (mode = 'both', smart diagonal):
 * 1. Find current indices: findRegroupingIndex(), findScaffoldingIndex()
 * 2. Validate via findNearestValidState() - auto-corrects if needed
 * 3. Check if at maximum (indices at progression.length - 1)
 * 4. Calculate scores for preset finding (continuous space)
 * 5. Find nearest harder preset using Euclidean distance
 * 6. Calculate gaps: targetRegroupingIdx - currentIdx, targetScaffoldingIdx - currentIdx
 * 7. Move in dimension with larger gap (or both if similar)
 * 8. Validate new indices, apply constraint if violated
 * 9. Look up actual config from progressions: REGROUPING_PROGRESSION[idx], SCAFFOLDING_PROGRESSION[idx]
 * 10. Check if result matches preset via getProfileFromConfig()
 *
 * Algorithm (mode = 'challenge'):
 * 1-2. Same (find and validate current indices)
 * 3. Increment regroupingIdx only
 * 4. Call clampScaffoldingToValidRange(newRegroupingIdx, currentScaffoldingIdx)
 * 5. Look up configs from progressions
 *
 * Algorithm (mode = 'support'):
 * 1-2. Same (find and validate current indices)
 * 3. Increment scaffoldingIdx only (higher = less support)
 * 4. Check isValidCombination(regroupingIdx, newScaffoldingIdx)
 * 5. Look up configs from progressions if valid
 *
 * @param currentState - Current difficulty configuration
 * @param mode - Which dimension(s) to adjust (default: 'both')
 */
function makeHarder(
  currentState: {
    pAnyStart: number;
    pAllStart: number;
    displayRules: DisplayRules;
  },
  mode: DifficultyMode = "both",
): {
  pAnyStart: number;
  pAllStart: number;
  displayRules: DisplayRules;
  difficultyProfile?: string;
  changeDescription: string;
} {
  // STEP 1: Find current indices in discrete progressions
  const currentRegroupingIdx = findRegroupingIndex(
    currentState.pAnyStart,
    currentState.pAllStart,
  );
  const currentScaffoldingIdx = findScaffoldingIndex(currentState.displayRules);

  // STEP 2: Validate current state (auto-correct if outside constraint band)
  const validCurrent = findNearestValidState(
    currentRegroupingIdx,
    currentScaffoldingIdx,
  );
  let newRegroupingIdx = validCurrent.regroupingIdx;
  let newScaffoldingIdx = validCurrent.scaffoldingIdx;

  // STEP 3: Check if at maximum
  if (
    newRegroupingIdx >= REGROUPING_PROGRESSION.length - 1 &&
    newScaffoldingIdx >= SCAFFOLDING_PROGRESSION.length - 1
  ) {
    return {
      ...currentState,
      changeDescription: "Already at maximum difficulty",
    };
  }

  // ... implementation continues with mode-specific logic ...
  // See difficultyProfiles.ts:739-906 for complete implementation
}

// NOTE: The full implementation is in difficultyProfiles.ts
// This spec shows the ALGORITHM, not the complete code

/**
 * Make worksheet easier with optional dimension focus (inverse of makeHarder)
 *
 * ACTUAL IMPLEMENTATION: Same index-based approach as makeHarder, but:
 * - Decrement indices instead of increment
 * - Find nearest EASIER preset
 * - Same constraint validation and mode-specific logic
 *
 * See difficultyProfiles.ts:921-1056 for complete implementation
 */
function makeEasier(
  currentState: {
    pAnyStart: number;
    pAllStart: number;
    displayRules: DisplayRules;
  },
  mode: DifficultyMode = "both",
): {
  pAnyStart: number;
  pAllStart: number;
  displayRules: DisplayRules;
  difficultyProfile?: string;
  changeDescription: string;
} {
  // ... inverse logic of makeHarder ...
  // See difficultyProfiles.ts:921-1056 for complete implementation
}

/**
 * Calculate overall difficulty on 0-10 scale for single-bar UI
 * Combines regrouping intensity and scaffolding level
 */
function calculateOverallDifficulty(
  pAnyStart: number,
  pAllStart: number,
  displayRules: DisplayRules,
): number {
  const regrouping = calculateRegroupingIntensity(pAnyStart, pAllStart);
  const scaffolding = calculateScaffoldingLevel(displayRules);
  return (regrouping + scaffolding) / 2;
}

/**
 * Describe what changed in scaffolding rules for user feedback
 */
function describeScaffoldingChange(
  oldRules: DisplayRules,
  newRules: DisplayRules,
  direction: "added" | "reduced",
): string {
  const changes: string[] = [];

  const fields: Array<keyof DisplayRules> = [
    "carryBoxes",
    "answerBoxes",
    "placeValueColors",
    "tenFrames",
  ];

  const labels = {
    carryBoxes: "carry boxes",
    answerBoxes: "answer boxes",
    placeValueColors: "place value colors",
    tenFrames: "ten-frames",
  };

  for (const field of fields) {
    if (oldRules[field] !== newRules[field]) {
      changes.push(labels[field]);
    }
  }

  if (changes.length === 0) return "Adjusted difficulty";

  const verb = direction === "added" ? "Added" : "Reduced";
  return `${verb} ${changes.join(", ")}`;
}

/**
 * Match config to known profile or return 'custom'
 */
function getProfileFromConfig(
  pAllStart: number,
  pAnyStart: number,
  displayRules?: DisplayRules,
): string {
  if (!displayRules) return "custom";

  for (const profile of Object.values(DIFFICULTY_PROFILES)) {
    const regroupMatch =
      Math.abs(profile.regrouping.pAllStart - pAllStart) < 0.05 &&
      Math.abs(profile.regrouping.pAnyStart - pAnyStart) < 0.05;

    const rulesMatch =
      JSON.stringify(profile.displayRules) === JSON.stringify(displayRules);

    if (regroupMatch && rulesMatch) {
      return profile.name;
    }
  }

  return "custom";
}

export {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  makeHarder,
  makeEasier,
  getProfileFromConfig,
  calculateRegroupingIntensity,
  calculateScaffoldingLevel,
  calculateOverallDifficulty,
  findNearestPreset,
  describeScaffoldingChange,
};
export type { DifficultyProfile };
```

#### Understanding the 2D Difficulty System

**Key Insight**: Difficulty is not a single number - it's a balance between two independent dimensions:

1. **Regrouping Intensity (0-10)**: How often problems require carrying
   - 0 = No regrouping
   - 3 = Occasional regrouping (~25% of problems)
   - 7 = Frequent regrouping (~70% of problems)
   - 10 = Nearly all problems regroup

2. **Scaffolding Level (0-10)**: How much help is provided
   - 0 = Full scaffolding (all hints shown)
   - 4 = Conditional scaffolding (hints when needed)
   - 7 = Minimal scaffolding (rare hints)
   - 10 = No scaffolding (no hints)

**Visualization of Preset Profiles in 2D Space**:

```
Scaffolding Level (0-10)
    ↑
 10 │                                     [Expert]
  9 │
  8 │
  7 │                            [Advanced]
  6 │
  5 │                  [Intermediate]
  4 │
  3 │
  2 │      [Early Learner]
  1 │ [Beginner]
  0 └───────────────────────────────────────────→ Regrouping (0-10)
    0     2     4     6     8    10
```

**Preset Profile Positions (2D Space)**:

- **Beginner** (0.0, 0.0): No regrouping, full scaffolding → **Overall: 0.0**
- **Early Learner** (1.75, 2.0): 25% regrouping, conditional scaffolding → **Overall: 1.9**
- **Intermediate** (5.25, 5.0): 75% regrouping, reduced scaffolding → **Overall: 5.1**
- **Advanced** (6.8, 7.5): 90% regrouping, minimal scaffolding → **Overall: 7.2**
- **Expert** (6.8, 9.0): 90% regrouping, no scaffolding → **Overall: 7.9**

**Single-Bar Overall Difficulty** (for UI):
The `calculateOverallDifficulty()` function averages regrouping and scaffolding to produce a single 0-10 score that's easy for teachers to understand.

**How makeHarder/makeEasier Work**:

1. **Calculate current position** in 2D space using the scoring functions
2. **Find nearest preset** in the requested direction (harder/easier)
3. **Snap to preset** if within 1.5 units (enables precise preset selection)
4. **Otherwise take pedagogical step**:
   - **makeHarder**: Increase complexity first (regrouping), then reduce support (scaffolding)
   - **makeEasier**: Add support first (scaffolding), then reduce complexity (regrouping)
5. **Return change description** for UI feedback

**Example Progression**:

Starting from **Beginner** (0, 0):

1. **Make Harder** → (1.0, 0.0): "Increased regrouping frequency to 14%"
2. **Make Harder** → (1.75, 2.0): "Reached Early Learner level" (snapped to preset)
3. **Make Harder** → (2.5, 2.0): "Increased regrouping frequency to 25%"
4. **Make Harder** → (2.5, 3.0): "Reduced carry boxes, answer boxes"
5. ... continues toward Intermediate preset

**Extensibility for New Scaffolding**:

To add a new scaffolding option (e.g., `showWorkingSpace`):

1. Add to `DisplayRules` interface
2. Add weight entry in `calculateScaffoldingLevel` (lines 311-318)
3. Add to `levelToScaffoldingRules` transitions (lines 339-397)
4. Algorithm automatically incorporates new dimension!

This design allows:

- Starting from any custom configuration
- Natural convergence toward pedagogical presets
- Adding new scaffolding types without rewriting makeHarder/makeEasier
- Clear user feedback about what changes

### 4. Config Schema v2

```typescript
// File: src/app/create/worksheets/config-schemas.ts (UPDATE)

// Add new schema version
export const additionConfigV2Schema = z.object({
  version: z.literal(2),
  problemsPerPage: z.number().int().positive(),
  cols: z.number().int().positive(),
  pages: z.number().int().positive(),
  orientation: z.enum(["portrait", "landscape"]),
  name: z.string(),
  pAnyStart: z.number().min(0).max(1),
  pAllStart: z.number().min(0).max(1),
  interpolate: z.boolean(),

  // V2: Display rules instead of individual booleans
  displayRules: z.object({
    carryBoxes: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
    answerBoxes: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
    placeValueColors: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
    tenFrames: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
    problemNumbers: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
    cellBorders: z.enum([
      "always",
      "never",
      "whenRegrouping",
      "whenMultipleRegroups",
      "when3PlusDigits",
    ]),
  }),

  // V2: Track which profile is active
  difficultyProfile: z.string().optional(), // 'beginner' | 'earlyLearner' | 'intermediate' | 'advanced' | 'expert' | 'custom'

  // V2: Remove individual display booleans (migrated to displayRules)
  // showCarryBoxes, showAnswerBoxes, etc. - REMOVED
});

export type AdditionConfigV2 = z.infer<typeof additionConfigV2Schema>;

// Update union to include v2
export const additionConfigSchema = z.discriminatedUnion("version", [
  additionConfigV1Schema,
  additionConfigV2Schema,
]);

export type AdditionConfig = z.infer<typeof additionConfigSchema>;

// Update defaults to v2
export const defaultAdditionConfig: AdditionConfigV2 = {
  version: 2,
  problemsPerPage: 20,
  cols: 5,
  pages: 1,
  orientation: "landscape",
  name: "",
  pAnyStart: 0.25,
  pAllStart: 0,
  interpolate: true,
  displayRules: DIFFICULTY_PROFILES.earlyLearner.displayRules,
  difficultyProfile: "earlyLearner",
};

// Migration: V1 -> V2
function migrateAdditionV1toV2(v1: AdditionConfigV1): AdditionConfigV2 {
  return {
    version: 2,
    problemsPerPage: v1.problemsPerPage,
    cols: v1.cols,
    pages: v1.pages,
    orientation: v1.orientation,
    name: v1.name,
    pAnyStart: v1.pAnyStart,
    pAllStart: v1.pAllStart,
    interpolate: v1.interpolate,

    // Convert legacy booleans to rules
    displayRules: {
      carryBoxes: v1.showCarryBoxes ? "always" : "never",
      answerBoxes: v1.showAnswerBoxes ? "always" : "never",
      placeValueColors: v1.showPlaceValueColors ? "always" : "never",
      tenFrames: v1.showTenFrames ? "whenRegrouping" : "never", // V1 likely had this as conditional
      problemNumbers: v1.showProblemNumbers ? "always" : "never",
      cellBorders: v1.showCellBorder ? "always" : "never",
    },

    // Mark as custom since we don't know if it matches a profile
    difficultyProfile: "custom",
  };
}

// Update main migration function
export function migrateAdditionConfig(rawConfig: unknown): AdditionConfigV2 {
  const parsed = additionConfigSchema.safeParse(rawConfig);

  if (!parsed.success) {
    console.warn(
      "Failed to parse addition config, using defaults:",
      parsed.error,
    );
    return defaultAdditionConfig;
  }

  const config = parsed.data;

  switch (config.version) {
    case 1:
      return migrateAdditionV1toV2(config);
    case 2:
      return config;
    default:
      console.warn(
        `Unknown addition config version: ${(config as any).version}`,
      );
      return defaultAdditionConfig;
  }
}
```

---

## Implementation Phases

### Phase 1: Infrastructure (Backend)

**Goal**: Add problem analysis and display rules without breaking existing functionality.

#### 1.1 Create Problem Analysis Module

**File**: `src/app/create/worksheets/addition/problemAnalysis.ts` (NEW)

```typescript
// Implementation as specified in Data Models section above
```

**Testing**:

```typescript
// Test cases
expect(analyzeProblem(23, 45)).toEqual({
  a: 23,
  b: 45,
  digitsA: 2,
  digitsB: 2,
  maxDigits: 2,
  sum: 68,
  digitsSum: 2,
  requiresRegrouping: false,
  regroupCount: 0,
  regroupPlaces: [],
});

expect(analyzeProblem(47, 38)).toEqual({
  a: 47,
  b: 38,
  digitsA: 2,
  digitsB: 2,
  maxDigits: 2,
  sum: 85,
  digitsSum: 2,
  requiresRegrouping: true,
  regroupCount: 1,
  regroupPlaces: ["ones"],
});

expect(analyzeProblem(99, 99)).toEqual({
  a: 99,
  b: 99,
  digitsA: 2,
  digitsB: 2,
  maxDigits: 2,
  sum: 198,
  digitsSum: 3,
  requiresRegrouping: true,
  regroupCount: 2,
  regroupPlaces: ["ones", "tens"],
});
```

#### 1.2 Create Display Rules Module

**File**: `src/app/create/worksheets/addition/displayRules.ts` (NEW)

Implementation as specified in Data Models section.

**Testing**:

```typescript
const problem = analyzeProblem(47, 38); // Requires ones regrouping

expect(evaluateRule("always", problem)).toBe(true);
expect(evaluateRule("never", problem)).toBe(false);
expect(evaluateRule("whenRegrouping", problem)).toBe(true);
expect(evaluateRule("whenMultipleRegroups", problem)).toBe(false);
expect(evaluateRule("when3PlusDigits", problem)).toBe(false);

const problem2 = analyzeProblem(99, 99); // Multiple regroups
expect(evaluateRule("whenMultipleRegroups", problem2)).toBe(true);

const problem3 = analyzeProblem(123, 45); // 3 digits
expect(evaluateRule("when3PlusDigits", problem3)).toBe(true);
```

#### 1.3 Create Difficulty Profiles

**File**: `src/app/create/worksheets/addition/difficultyProfiles.ts` (NEW)

Implementation as specified in Data Models section.

**Testing**:

```typescript
expect(DIFFICULTY_PROFILES.beginner.displayRules.carryBoxes).toBe("always");
expect(DIFFICULTY_PROFILES.expert.displayRules.carryBoxes).toBe("never");

expect(makeHarder("beginner").name).toBe("earlyLearner");
expect(makeEasier("expert").name).toBe("advanced");
expect(makeHarder("expert").name).toBe("expert"); // Can't go higher
expect(makeEasier("beginner").name).toBe("beginner"); // Can't go lower
```

#### 1.4 Update Config Schema to V2

**File**: `src/app/create/worksheets/config-schemas.ts` (UPDATE)

- Add `additionConfigV2Schema`
- Add V1→V2 migration function
- Update default config to V2
- Update `migrateAdditionConfig` to handle V2

**Testing**:

```typescript
// Test migration
const v1Config: AdditionConfigV1 = {
  version: 1,
  // ... all v1 fields
  showCarryBoxes: true,
  showAnswerBoxes: false,
  // ...
};

const v2 = migrateAdditionConfig(v1Config);
expect(v2.version).toBe(2);
expect(v2.displayRules.carryBoxes).toBe("always");
expect(v2.displayRules.answerBoxes).toBe("never");
expect(v2.difficultyProfile).toBe("custom");
```

#### 1.5 Update Types Module

**File**: `src/app/create/worksheets/addition/types.ts` (UPDATE)

```typescript
import type { AdditionConfigV2 } from "../config-schemas";
import type { ResolvedDisplayOptions } from "./displayRules";

// Update WorksheetConfig to use V2
export type WorksheetConfig = AdditionConfigV2 & {
  page: {
    wIn: number;
    hIn: number;
  };
  fontSize: number;
  date: string;
  seed: number;
};

// Add new type for problems with resolved display
export interface ProblemWithDisplay {
  a: number;
  b: number;
  display: ResolvedDisplayOptions;
}
```

**Checkpoint**: At this point, all new modules exist but nothing uses them yet. Existing functionality unchanged.

---

### Phase 2: Typst Generator Integration

**Goal**: Make Typst generator use per-problem display rules.

#### 2.1 Update Problem Stack Function

**File**: `src/app/create/worksheets/addition/typstHelpers.ts` (UPDATE)

Change `generateProblemStackFunction` to accept per-problem display flags:

```typescript
export function generateProblemStackFunction(cellSize: number): string {
  const cellSizeIn = `${cellSize}in`;
  const cellSizePt = cellSize * 72;

  return String.raw`
// Problem rendering function - UPDATED to accept per-problem flags
#let problem-stack(a, b, aT, aO, bT, bO, index-or-none, show-carries, show-answers, show-colors, show-ten-frames) = {
  stack(
    dir: ttb,
    spacing: 0pt,
    if show-numbers and index-or-none != none {
      align(top + left)[
        #box(inset: (left: 0.08in, top: 0.05in))[
          #text(size: ${(cellSizePt * 0.6).toFixed(1)}pt, weight: "bold")[\\##(index-or-none + 1).]
        ]
      ]
    },
    grid(
      columns: (0.5em, ${cellSizeIn}, ${cellSizeIn}, ${cellSizeIn}),
      gutter: 0pt,

      [],
      // Hundreds carry box
      if show-carries {
        if show-colors {
          diagonal-split-box(${cellSizeIn}, color-tens, color-hundreds)
        } else {
          box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt)[]
        }
      } else { v(${cellSizeIn}) },
      // Tens carry box
      if show-carries {
        if show-colors {
          diagonal-split-box(${cellSizeIn}, color-ones, color-tens)
        } else {
          box(width: ${cellSizeIn}, height: ${cellSizeIn}, stroke: 0.5pt)[]
        }
      } else { v(${cellSizeIn}) },
      [],

      // ... rest of function using show-carries, show-answers, show-colors, show-ten-frames
    )
  )
}
`;
}
```

#### 2.2 Update Typst Generator

**File**: `src/app/create/worksheets/addition/typstGenerator.ts` (UPDATE)

```typescript
import { analyzeProblem } from "./problemAnalysis";
import { resolveDisplayForProblem } from "./displayRules";

function generatePageTypst(
  config: WorksheetConfig,
  pageProblems: AdditionProblem[],
  problemOffset: number,
  rowsPerPage: number,
): string {
  // Analyze each problem and resolve display options
  const problemsWithMeta = pageProblems.map((p) => {
    const meta = analyzeProblem(p.a, p.b);
    const display = resolveDisplayForProblem(config.displayRules, meta);
    return {
      a: p.a,
      b: p.b,
      display,
    };
  });

  // Generate Typst code for each problem
  const problemsTypst = problemsWithMeta
    .map((p, i) => {
      const globalIndex = problemOffset + i;
      return `  {
    a: ${p.a},
    b: ${p.b},
    showCarries: ${p.display.showCarryBoxes},
    showAnswers: ${p.display.showAnswerBoxes},
    showColors: ${p.display.showPlaceValueColors},
    showTenFrames: ${p.display.showTenFrames},
  },`;
    })
    .join("\n");

  // ... rest of template generation

  return String.raw`
// addition-worksheet-page.typ (auto-generated)

#set page(...)
#set text(...)

#block(breakable: false)[

#let grid-stroke = ${config.displayRules.cellBorders === "always" ? '(thickness: 1pt, dash: "dashed", paint: gray.darken(20%))' : "none"}
#let heavy-stroke = 0.8pt
#let show-numbers = ${config.displayRules.problemNumbers === "always" ? "true" : "false"}

${generateTypstHelpers(cellSize)}
${generateProblemStackFunction(cellSize)}

#let problem-box(problem, index) = {
  let a = problem.a
  let b = problem.b
  let aT = calc.floor(calc.rem(a, 100) / 10)
  let aO = calc.rem(a, 10)
  let bT = calc.floor(calc.rem(b, 100) / 10)
  let bO = calc.rem(b, 10)

  // Extract per-problem display flags
  let showCarries = problem.showCarries
  let showAnswers = problem.showAnswers
  let showColors = problem.showColors
  let showTenFrames = problem.showTenFrames

  box(
    inset: 0pt,
    width: ${problemBoxWidth}in,
    height: ${problemBoxHeight}in
  )[
    #align(center + horizon)[
      #problem-stack(a, b, aT, aO, bT, bO, index, showCarries, showAnswers, showColors, showTenFrames)
    ]
  ]
}

#let problems = (
${problemsTypst}
)

// Header and grid...

] // End block
`;
}
```

**Testing**: Generate worksheets with different profiles, verify per-problem display rules apply correctly.

**Checkpoint**: Typst generator now respects per-problem display rules. V2 configs work correctly.

---

### Phase 3: UI Update

**Goal**: Replace regrouping panel with difficulty selector.

#### 3.1 Update ConfigPanel Component

**File**: `src/app/create/worksheets/addition/components/ConfigPanel.tsx` (UPDATE)

Remove old regrouping panel, add new difficulty selector:

```typescript
import { DIFFICULTY_PROFILES, DIFFICULTY_PROGRESSION, makeHarder, makeEasier, getProfileFromConfig } from '../difficultyProfiles'

// Inside ConfigPanel:
const currentProfile = formState.difficultyProfile || 'earlyLearner'
const profile = DIFFICULTY_PROFILES[currentProfile] || DIFFICULTY_PROFILES.earlyLearner

const canMakeEasier = DIFFICULTY_PROGRESSION.indexOf(currentProfile as any) > 0
const canMakeHarder = DIFFICULTY_PROGRESSION.indexOf(currentProfile as any) < DIFFICULTY_PROGRESSION.length - 1

return (
  <div data-component="config-panel" className={stack({ gap: '3' })}>
    {/* ... Student Name ... */}
    {/* ... Worksheet Layout ... */}

    {/* NEW: Difficulty Selector */}
    <div
      data-section="difficulty"
      className={css({
        bg: 'gray.50',
        border: '1px solid',
        borderColor: 'gray.200',
        rounded: 'xl',
        p: '3',
      })}
    >
      <div className={stack({ gap: '2.5' })}>
        <div className={css({
          fontSize: 'xs',
          fontWeight: 'semibold',
          color: 'gray.500',
          textTransform: 'uppercase',
          letterSpacing: 'wider',
        })}>
          Difficulty Level
        </div>

        {/* Overall Difficulty Visualization */}
        <div className={css({ mb: '3' })}>
          <div className={css({ fontSize: 'xs', fontWeight: 'medium', color: 'gray.700', mb: '2' })}>
            Overall Difficulty
          </div>

          {/* Difficulty bar with preset markers */}
          <div className={css({ position: 'relative', h: '12', bg: 'gray.100', rounded: 'full', px: '2' })}>
            {/* Preset markers */}
            {DIFFICULTY_PROGRESSION.map((profileName) => {
              const p = DIFFICULTY_PROFILES[profileName]
              const difficulty = calculateOverallDifficulty(
                p.regrouping.pAnyStart,
                p.regrouping.pAllStart,
                p.displayRules
              )
              const position = (difficulty / 10) * 100

              return (
                <div
                  key={profileName}
                  className={css({
                    position: 'absolute',
                    top: '50%',
                    left: `${position}%`,
                    transform: 'translate(-50%, -50%)',
                    w: '2',
                    h: '2',
                    bg: 'gray.400',
                    rounded: 'full',
                  })}
                  title={p.label}
                />
              )
            })}

            {/* Current position indicator */}
            {(() => {
              const currentDifficulty = calculateOverallDifficulty(
                formState.pAnyStart,
                formState.pAllStart,
                formState.displayRules
              )
              const position = (currentDifficulty / 10) * 100

              return (
                <div
                  className={css({
                    position: 'absolute',
                    top: '50%',
                    left: `${position}%`,
                    transform: 'translate(-50%, -50%)',
                    w: '4',
                    h: '4',
                    bg: 'brand.500',
                    rounded: 'full',
                    border: '2px solid',
                    borderColor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  })}
                />
              )
            })()}
          </div>

          {/* Status text */}
          <div className={css({ fontSize: '2xs', color: 'gray.600', textAlign: 'center', mt: '1.5' })}>
            {currentProfile === 'custom' ? (
              <>You're here (Custom) • {(() => {
                const nearest = findNearestPreset(
                  calculateRegroupingIntensity(formState.pAnyStart, formState.pAllStart),
                  calculateScaffoldingLevel(formState.displayRules),
                  'any'
                )
                return nearest ? `Moving toward ${nearest.profile.label}` : 'Custom settings'
              })()}</>
            ) : (
              <>You're at {profile.label} level</>
            )}
          </div>
        </div>

        {/* Difficulty level buttons */}
        <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap' })}>
          {DIFFICULTY_PROGRESSION.map((profileName) => {
            const p = DIFFICULTY_PROFILES[profileName]
            const isSelected = currentProfile === profileName

            return (
              <button
                key={profileName}
                onClick={() => {
                  onChange({
                    difficultyProfile: profileName,
                    displayRules: p.displayRules,
                    pAllStart: p.regrouping.pAllStart,
                    pAnyStart: p.regrouping.pAnyStart,
                  })
                }}
                className={css({
                  flex: '1 1 140px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                  p: '2',
                  border: '2px solid',
                  borderColor: isSelected ? 'brand.500' : 'gray.300',
                  bg: isSelected ? 'brand.50' : 'white',
                  rounded: 'lg',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    borderColor: 'brand.400',
                    transform: 'translateY(-1px)',
                  },
                })}
              >
                <div className={css({
                  fontSize: 'xs',
                  fontWeight: 'bold',
                  color: isSelected ? 'brand.700' : 'gray.700',
                })}>
                  {p.label}
                </div>
                <div className={css({
                  fontSize: '2xs',
                  color: isSelected ? 'brand.600' : 'gray.500',
                  lineHeight: '1.2',
                })}>
                  {p.description}
                </div>
              </button>
            )
          })}
        </div>

        {/* Make Easier/Harder split buttons with movement mode dropdown */}
        <div className={css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2',
          pt: '1',
          borderTop: '1px solid',
          borderColor: 'gray.200',
        })}>
          {/* Preview what will change */}
          <div className={css({ fontSize: '2xs', color: 'gray.600', textAlign: 'center' })}>
            {(() => {
              // Calculate preview for both mode (default)
              const harderResult = makeHarder({
                pAnyStart: formState.pAnyStart,
                pAllStart: formState.pAllStart,
                displayRules: formState.displayRules,
              }, 'both')

              const easierResult = makeEasier({
                pAnyStart: formState.pAnyStart,
                pAllStart: formState.pAllStart,
                displayRules: formState.displayRules,
              }, 'both')

              return (
                <div className={stack({ gap: '1' })}>
                  {canMakeEasier && (
                    <div>← Make Easier: {easierResult.changeDescription}</div>
                  )}
                  {canMakeHarder && (
                    <div>Make Harder →: {harderResult.changeDescription}</div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Split Buttons with Dropdown */}
          <div className={css({ display: 'flex', gap: '2' })}>
            {/* Make Easier Split Button */}
            <div className={css({ position: 'relative', flex: 1 })}>
              <div className={css({ display: 'flex', gap: '0' })}>
                {/* Main button - defaults to 'both' mode */}
                <button
                  onClick={() => handleDifficultyChange('both', 'easier')}
                  disabled={!canMakeEasier}
                  className={css({ /* main button styles */ })}
                >
                  ← Make Easier
                </button>
                {/* Dropdown arrow - reveals mode options */}
                <button
                  onClick={() => setEasierDropdownOpen(!easierDropdownOpen)}
                  disabled={!canMakeEasier}
                  className={css({ /* arrow button styles */ })}
                >
                  ▼
                </button>
              </div>

              {/* Dropdown Menu */}
              {easierDropdownOpen && (
                <div className={css({ /* dropdown menu styles */ })}>
                  <button onClick={() => handleDifficultyChange('both', 'easier')}>
                    <div>↙ Easier (both)</div>
                    <div>Simpler problems + more help</div>
                  </button>
                  <button onClick={() => handleDifficultyChange('challenge', 'easier')}>
                    <div>← Less challenge</div>
                    <div>Simpler problems only</div>
                  </button>
                  <button onClick={() => handleDifficultyChange('support', 'easier')}>
                    <div>↑ More support</div>
                    <div>Add visual aids only</div>
                  </button>
                </div>
              )}
            </div>

            {/* Make Harder Split Button */}
            <div className={css({ position: 'relative', flex: 1 })}>
              <div className={css({ display: 'flex', gap: '0' })}>
                {/* Main button - defaults to 'both' mode */}
                <button
                  onClick={() => handleDifficultyChange('both', 'harder')}
                  disabled={!canMakeHarder}
                  className={css({ /* main button styles */ })}
                >
                  Make Harder →
                </button>
                {/* Dropdown arrow - reveals mode options */}
                <button
                  onClick={() => setHarderDropdownOpen(!harderDropdownOpen)}
                  disabled={!canMakeHarder}
                  className={css({ /* arrow button styles */ })}
                >
                  ▼
                </button>
              </div>

              {/* Dropdown Menu */}
              {harderDropdownOpen && (
                <div className={css({ /* dropdown menu styles */ })}>
                  <button onClick={() => handleDifficultyChange('both', 'harder')}>
                    <div>↗ Harder (both)</div>
                    <div>Harder problems + less help</div>
                  </button>
                  <button onClick={() => handleDifficultyChange('challenge', 'harder')}>
                    <div>→ More challenge</div>
                    <div>Harder problems only</div>
                  </button>
                  <button onClick={() => handleDifficultyChange('support', 'harder')}>
                    <div>↓ Less support</div>
                    <div>Remove visual aids only</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ... Display Options (for now, keep as is - Phase 4 will add customize panel) ... */}
  </div>
)
```

#### 3.1b DEBUG Features (Power User / Development Tools)

The following features are implemented for debugging, testing, and ensuring correct navigation:

##### Live Change Preview

**Implementation**: ConfigPanel shows what "Make Harder" or "Make Easier" will do BEFORE clicking.

```typescript
// Calculate preview for both mode (default)
const harderResult = makeHarder({
  pAnyStart: formState.pAnyStart,
  pAllStart: formState.pAllStart,
  displayRules: formState.displayRules,
}, 'both')

// Display in UI
{canMakeHarder && (
  <div>Make Harder →: {harderResult.changeDescription}</div>
)}
```

**Purpose**:

- Helps users understand what will change before clicking
- Verifies that makeHarder/makeEasier return descriptive change messages
- Catches bugs in difficulty progression logic

##### Clickable 2D Graph (DEBUG Mode)

**Implementation**: ConfigPanel.tsx:769-850 - SVG graph with click handler

```typescript
const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
  // 1. Get mouse coordinates relative to SVG
  const rect = svg.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  // 2. Convert SVG coordinates to difficulty space (0-10)
  const regroupingIntensity = fromX(x)
  const scaffoldingLevel = fromY(y)

  // 3. Map to progression indices (0-18 regrouping, 0-12 scaffolding)
  const regroupingIdx = Math.round((regroupingIntensity / 10) * 18)
  const scaffoldingIdx = Math.round((scaffoldingLevel / 10) * 12)

  // 4. Apply pedagogical constraints
  const validState = findNearestValidState(regroupingIdx, scaffoldingIdx)

  // 5. Look up actual configs from progressions
  const newRegrouping = REGROUPING_PROGRESSION[validState.regroupingIdx]
  const newDisplayRules = SCAFFOLDING_PROGRESSION[validState.scaffoldingIdx]

  // 6. Check if matches a preset
  const matchedProfile = getProfileFromConfig(...)

  // 7. Update state
  onChange({ pAnyStart, pAllStart, displayRules, difficultyProfile })
}

<svg onClick={handleClick} className={css({ cursor: 'crosshair' })}>
  {/* 2D visualization with constraint band, current position, presets */}
</svg>
```

**Purpose**:

- **Debugging navigation**: Ensures you can always reach any valid difficulty state
- **Testing constraints**: Verifies constraint band is enforced correctly
- **Cycle detection**: Confirms no navigation dead ends or cycles
- **Visual verification**: Shows exact constraint band boundaries

**Future Polish** (if desired):

- Could become a power user feature for teachers who want precise control
- Would need better visual design (labels, tooltips, instructions)
- Currently styled with orange DEBUG borders to signal it's experimental

**Who needs this**:

- Developers debugging the difficulty system
- QA testing navigation completeness
- Potentially: advanced users who want direct difficulty control
- **Not needed by**: typical teachers (split buttons are sufficient)

#### 3.2 Update AdditionWorksheetClient

**File**: `src/app/create/worksheets/addition/components/AdditionWorksheetClient.tsx` (UPDATE)

Update to handle V2 config:

```typescript
// Ensure WorksheetFormState matches V2
type WorksheetFormState = Omit<AdditionConfigV2, "version"> & {
  rows: number;
  total: number;
  date: string;
};

// Update initialSettings to V2
const initialSettings = {
  ...props.initialSettings,
  // Ensure displayRules exists
  displayRules:
    props.initialSettings.displayRules ||
    DIFFICULTY_PROFILES.earlyLearner.displayRules,
  difficultyProfile: props.initialSettings.difficultyProfile || "earlyLearner",
};
```

#### 3.3 Update Page Component

**File**: `src/app/create/worksheets/addition/page.tsx` (UPDATE)

Ensure loadWorksheetSettings returns V2:

```typescript
async function loadWorksheetSettings(): Promise<
  Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
> {
  try {
    const viewerId = await getUserId()
    const [row] = await db.select()...

    if (!row) {
      // Return V2 defaults
      return {
        ...defaultAdditionConfig,
        seed: Date.now() % 2147483647,
      }
    }

    // Parse (auto-migrates V1->V2)
    const config = parseAdditionConfig(row.config)
    return {
      ...config,
      seed: Date.now() % 2147483647,
    }
  } catch (error) {
    return {
      ...defaultAdditionConfig,
      seed: Date.now() % 2147483647,
    }
  }
}
```

**Checkpoint**: UI now shows difficulty selector. Users can select profiles and use Make Easier/Harder. Everything still works.

---

### Phase 4: Testing & Polish

#### 4.1 Manual Testing Checklist

- [ ] Create new worksheet with each difficulty profile
- [ ] Verify problems render correctly with appropriate scaffolds
- [ ] Test Make Easier/Harder buttons
- [ ] Test profile selection
- [ ] Generate PDF and verify per-problem display rules
- [ ] Open old worksheet (V1), verify migration works
- [ ] Modify migrated worksheet, verify saves correctly
- [ ] Test with regrouping ON/OFF
- [ ] Test with different problems per page
- [ ] Test with different orientations

#### 4.2 Edge Cases

- [ ] All problems require regrouping (whenRegrouping should apply to all)
- [ ] No problems require regrouping (whenRegrouping should apply to none)
- [ ] Mix of 2-digit and 3-digit problems (when3PlusDigits)
- [ ] Problems with 0, 1, 2 regroups (whenMultipleRegroups)

#### 4.3 Performance

- [ ] Verify per-problem analysis doesn't slow down generation
- [ ] Check SSR preview generation time
- [ ] Check client-side worksheet generation time

---

## Future Enhancements (Phase 5+)

### Custom Rules Panel

Add collapsible "Customize" panel for power users:

- Expose individual display rules with Always/Never/Conditional toggles
- Show which conditions each Conditional mode checks
- "Save as Custom Profile" button

### Extended Problem Support

- Support for n-digit + p-digit where n, p > 2
- Add rule modes: `whenResultExceedsOperands`, `whenSpecificPlaceRegroups('tens')`
- Update UI to support 3+ digit problems

### Profile Management

- Allow users to save custom profiles
- Share profiles between worksheets
- Import/export profiles

---

## Migration Path for Existing Users

### What Happens to Existing Worksheets?

1. **V1 configs stored in database**:
   - On load, `parseAdditionConfig` auto-migrates V1→V2
   - Display booleans converted to rules
   - Marked as 'custom' profile
   - Everything continues to work

2. **User experience**:
   - Opens existing worksheet
   - Sees difficulty selector showing "Custom"
   - Can click any profile to switch
   - Can use Make Easier/Harder
   - Original settings preserved until changed

3. **No data loss**:
   - Migration is deterministic
   - All display preferences preserved
   - Regrouping settings unchanged

---

## Testing Strategy

### Unit Tests

```typescript
// problemAnalysis.test.ts
describe("analyzeProblem", () => {
  it("detects no regrouping", () => {
    expect(analyzeProblem(23, 45).requiresRegrouping).toBe(false);
  });

  it("detects single regrouping", () => {
    const meta = analyzeProblem(47, 38);
    expect(meta.requiresRegrouping).toBe(true);
    expect(meta.regroupCount).toBe(1);
    expect(meta.regroupPlaces).toEqual(["ones"]);
  });

  it("detects multiple regrouping", () => {
    const meta = analyzeProblem(99, 99);
    expect(meta.regroupCount).toBe(2);
    expect(meta.regroupPlaces).toContain("ones");
    expect(meta.regroupPlaces).toContain("tens");
  });
});

// displayRules.test.ts
describe("evaluateRule", () => {
  it("always returns true", () => {
    const problem = analyzeProblem(23, 45);
    expect(evaluateRule("always", problem)).toBe(true);
  });

  it("whenRegrouping depends on problem", () => {
    expect(evaluateRule("whenRegrouping", analyzeProblem(23, 45))).toBe(false);
    expect(evaluateRule("whenRegrouping", analyzeProblem(47, 38))).toBe(true);
  });
});

// config-schemas.test.ts
describe("migrateAdditionV1toV2", () => {
  it("converts booleans to rules", () => {
    const v1: AdditionConfigV1 = {
      version: 1,
      // ...
      showCarryBoxes: true,
      showAnswerBoxes: false,
    };

    const v2 = migrateAdditionV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.displayRules.carryBoxes).toBe("always");
    expect(v2.displayRules.answerBoxes).toBe("never");
  });
});
```

### Integration Tests

- Generate worksheet with each profile
- Verify PDF contains expected scaffolds
- Verify per-problem rules apply correctly

---

## Documentation

### User Documentation

#### For Teachers: Understanding Difficulty Levels

**Beginner**: Your student is just learning how to organize addition problems. All scaffolds are shown to build familiarity with the structure. No regrouping (carrying) yet.

**Early Learner**: Introduces the concept of regrouping (carrying). Scaffolds appear when needed to support this new concept. Visual aids like ten-frames help make regrouping concrete.

**Intermediate**: Regular practice with regrouping. Scaffolds shown strategically - only for problems that need them. Students are developing independence.

**Advanced**: Frequent regrouping practice with minimal scaffolding. Students should have internalized the concepts. Place value colors only for larger numbers.

**Expert**: Mastery level. No scaffolds - students work independently. Focus is on speed and accuracy with complex regrouping.

**Make Easier/Harder**: Automatically adjusts both problem complexity AND the amount of support provided. This ensures the challenge level increases gradually.

### Developer Documentation

#### Adding New Display Rules

1. Add new `RuleMode` to `displayRules.ts`:

```typescript
type RuleMode =
  | "always"
  | "never"
  // ... existing modes
  | "whenResultHasMoreDigits"; // NEW
```

2. Implement evaluation in `evaluateRule`:

```typescript
case 'whenResultHasMoreDigits':
  return problem.digitsSum > problem.maxDigits
```

3. Add to profiles as needed:

```typescript
const DIFFICULTY_PROFILES = {
  beginner: {
    // ...
    displayRules: {
      // ...
      someNewOption: "whenResultHasMoreDigits",
    },
  },
};
```

4. Update schema:

```typescript
const ruleModesSchema = z.enum([
  "always",
  "never",
  // ...
  "whenResultHasMoreDigits", // NEW
]);
```

#### Adding New Problem Metadata

1. Extend `ProblemMeta` in `problemAnalysis.ts`:

```typescript
interface ProblemMeta {
  // ... existing fields
  hasDoubleDigit: boolean; // NEW
}
```

2. Update `analyzeProblem`:

```typescript
function analyzeProblem(a: number, b: number): ProblemMeta {
  // ... existing analysis

  const hasDoubleDigit = String(a).includes("00") || String(b).includes("00");

  return {
    // ...
    hasDoubleDigit,
  };
}
```

3. Use in rule evaluation as needed

---

## File Structure Summary

```
src/app/create/worksheets/addition/
├── SMART_DIFFICULTY_SPEC.md          (this file)
├── problemAnalysis.ts                 (NEW - Phase 1.1)
├── displayRules.ts                    (NEW - Phase 1.2)
├── difficultyProfiles.ts              (NEW - Phase 1.3)
├── config-schemas.ts                  (UPDATE - Phase 1.4)
├── types.ts                           (UPDATE - Phase 1.5)
├── typstHelpers.ts                    (UPDATE - Phase 2.1)
├── typstGenerator.ts                  (UPDATE - Phase 2.2)
└── components/
    ├── ConfigPanel.tsx                (UPDATE - Phase 3.1)
    ├── AdditionWorksheetClient.tsx    (UPDATE - Phase 3.2)
    └── page.tsx                       (UPDATE - Phase 3.3)
```

---

## Success Criteria

- [ ] All existing worksheets continue to work (V1→V2 migration)
- [ ] New worksheets use smart difficulty profiles
- [ ] Per-problem display rules render correctly
- [ ] Make Easier/Harder buttons work intuitively
- [ ] Profile selection updates all relevant config
- [ ] PDF generation includes correct scaffolds per problem
- [ ] No performance degradation
- [ ] Code is well-tested and documented

---

## Rollout Plan

1. **Phase 1**: Merge infrastructure (backend only, no UI changes)
2. **Test**: Verify V2 configs work, migration works
3. **Phase 2**: Merge Typst generator updates
4. **Test**: Verify per-problem rules render correctly
5. **Phase 3**: Merge UI updates
6. **Test**: Full end-to-end testing
7. **Phase 4**: Polish and edge case fixes
8. **Deploy**: Release to production

---

## Pedagogical Constraint Band: Theoretical Foundation

### Why Constrain the 2D Space?

Most educational software treats difficulty as a one-dimensional slider. This system recognizes that difficulty has **two orthogonal components**:

1. **Challenge (Regrouping Complexity)**: Intrinsic cognitive load of the problem itself
2. **Support (Scaffolding Level)**: Extraneous cognitive load from visual aids and structure

However, not all combinations of challenge and support are pedagogically valid:

- **High Challenge + High Support**: Conflicting signals - giving hard problems while holding the student's hand prevents them from developing problem-solving strategies
- **Low Challenge + Low Support**: Pointless practice - simple problems with no scaffolding doesn't teach anything new

### The Constraint Band Solution

The diagonal band enforces: **As challenge increases, support must decrease**

This maps to established learning theory:

- **Zone of Proximal Development** (Vygotsky): Students need support when learning new concepts, but support should fade as mastery develops
- **Cognitive Load Theory** (Sweller): Balance intrinsic load (problem complexity) and extraneous load (poor instructional design)
- **Scaffolding Fading** (Wood, Bruner, Ross): Temporary supports should be removed as competence increases

### Visualization of Valid State Space

```
Scaffolding Level (Support) →
    0   1   2   3   4   5   6   7   8   9  10  11  12
 18  ·   ·   ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓  ← Maximum regrouping
 17  ·   ·   ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓
 16  ·   ·   ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓
 15  ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓
 14  ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓
 13  ·   ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓  ← High regrouping
 12  ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·
 11  ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·
 10  ·   ·   ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·  ← Medium-high
  9  ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·
  8  ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·
  7  ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·
  6  ·   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·  ← Medium regrouping
  5  ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·
  4  ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·
  3  ✓   ✓   ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·  ← Light regrouping
  2  ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·   ·   ·
  1  ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·   ·   ·
  0  ✓   ✓   ✓   ✓   ✓   ·   ·   ·   ·   ·   ·   ·   ·  ← No regrouping
    ↑
    Regrouping Level (Challenge)
```

- ✓ = Valid pedagogical state (within constraint band)
- · = Invalid state (violates pedagogical principles)

### Movement Modes: Pedagogical Precision

The split button interface allows teachers to express precise pedagogical intent:

**Scenario: Student struggling with regrouping**

- Click "Less challenge" (horizontal movement left) - reduces regrouping frequency while maintaining current scaffolding level
- Result: Easier problems, same amount of support

**Scenario: Student understands concept, needs to build independence**

- Click "Less support" (vertical movement down) - removes visual aids while maintaining problem complexity
- Result: Same difficulty problems, learning to work without training wheels

**Scenario: General adjustment needed**

- Click main button (diagonal movement) - smart adjustment of both dimensions
- Result: System navigates toward nearest appropriate preset

### Potential Research Contributions

This system makes testable claims about effective difficulty progression:

1. **Hypothesis 1**: Constrained progression produces better learning outcomes than unconstrained difficulty adjustment
2. **Hypothesis 2**: Giving teachers dimension-specific control (challenge vs support) improves differentiation effectiveness
3. **Hypothesis 3**: The constraint band can be learned from student performance data (reinforcement learning)

If validated, this could be publishable in:

- ACM Learning @ Scale
- International Journal of Artificial Intelligence in Education
- Learning Analytics & Knowledge Conference

**📄 For detailed publication strategy, timelines, and execution plan, see [PUBLICATION_PLAN.md](./PUBLICATION_PLAN.md)**

## Notes

- Always test with both new and migrated configs
- Keep existing functionality working at every step
- Add comprehensive logging for debugging
- Document any deviations from this spec
- Consider A/B testing constrained vs unconstrained difficulty systems
- Gather teacher feedback on movement mode utility
