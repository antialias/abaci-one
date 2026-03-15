# CMF Game Implementation Plan

## Game Name: `cmf-game` (Conservative Matrix Fields)

Display name: "Matrix Fields" | Icon: 🧮 | Category: `puzzle`

## How It Fits Into the Arcade

### Registration
- New directory: `apps/web/src/arcade-games/cmf-game/`
- Follows the standard game structure: `types.ts`, `Validator.ts`, `Provider.tsx`, `GameComponent.tsx`, `index.ts`
- Registers via `defineGame()` + `registerGame()` in `game-registry.ts`
- Validator registered in `validators.ts`
- Single-player game (like card-sorting), `maxPlayers: 1`
- `practiceBreakReady: true` with difficulty presets
- Scoreboard category: `puzzle`

### Game Phases (Standard Pattern)
1. **Setup Phase** — Pick difficulty level (controls polynomial complexity + grid size)
2. **Playing Phase** — The core CMF gameplay loop
3. **Results Phase** — Score breakdown, celebration, leaderboard entry

---

## Core Game Design

### State Machine

```
SETUP → PLAYING → RESULTS
         ↑   ↓
    (reset on new level)
```

### Config (`CmfGameConfig`)
```typescript
{
  difficulty: 'beginner' | 'linear' | 'quadratic'
  gridSize: 2 | 3 | 4         // (beginner=2, linear=3, quadratic=4)
  targetPoint: [number, number] // destination coordinate
}
```

### State (`CmfGameState`)
```typescript
{
  gamePhase: 'setup' | 'playing' | 'results'
  config: CmfGameConfig

  // The CMF definition (generated from difficulty)
  field: {
    // MX entries as polynomial coefficient arrays
    // MY entries as polynomial coefficient arrays
    // e.g. [[1,0,1], [0,1,0], [0,0,1], [1,0,0]] means:
    //   MX = [[x²+1, y], [1, x]]  (each entry is coefficients for [1, x, y, x², xy, y²])
    mxPolynomials: number[][]  // 4 entries (2x2 matrix), each a polynomial
    myPolynomials: number[][]  // 4 entries (2x2 matrix), each a polynomial
  }

  // Player's current work
  payload: [number, number]          // current vector
  position: [number, number]         // current grid position
  path: Array<{ dir: 'right' | 'up', from: [number, number] }>

  // For the proof challenge
  pathA: { steps: PathStep[], finalVector: [number, number] } | null
  pathB: { steps: PathStep[], finalVector: [number, number] } | null

  // Scoring
  stepsCompleted: number
  errorsCommitted: number
  startedAt: number
  hintsUsed: number
}
```

### Moves (`CmfGameMove`)
```typescript
| { type: 'START_GAME', playerId: string, data: { difficulty: string } }
| { type: 'SET_CONFIG', playerId: string, data: { field: string, value: unknown } }
| { type: 'EVALUATE_POLYNOMIAL', playerId: string, data: {
    matrixType: 'MX' | 'MY',
    entry: number,       // 0-3 (which matrix cell)
    answer: number       // player's computed value
  }}
| { type: 'MULTIPLY_VECTOR', playerId: string, data: {
    result: [number, number]  // player's computed result vector
  }}
| { type: 'TAKE_STEP', playerId: string, data: {
    direction: 'right' | 'up'
  }}
| { type: 'START_PATH_B', playerId: string, data: {} }  // begin the alternate path
| { type: 'CONFIRM_EQUALITY', playerId: string, data: {} }  // claim vectors match
| { type: 'GO_TO_SETUP', playerId: string, data: {} }
```

---

## Difficulty Progression

### Beginner (Constants Only)
- Polynomials are just constants: `f(x,y) = 3`
- Grid: 2×2 (start at (0,0), target (1,1))
- MX and MY are constant matrices — kids just learn matrix×vector multiplication
- The "field" is trivially conservative (constant matrices commute if they commute)
- **Skill focus**: What is a matrix? What is matrix-vector multiplication?

### Linear
- Polynomials are linear: `f(x,y) = ax + by + c`
- Grid: 3×3 (target (2,2))
- Now the matrix entries change at each grid point
- **Skill focus**: Evaluate `2x + 3` at x=1. Understand that the "machine" changes based on position.

### Quadratic
- Polynomials include `x²`, `xy`, `y²` terms
- Grid: 4×4 (target (3,3))
- Numbers get bigger, arithmetic is harder, but the proof structure is identical
- **Skill focus**: Full CMF mechanics. The commutativity condition is now non-trivial.

---

## UI Layout (Playing Phase)

```
┌──────────────────────────────────────────────────────┐
│  GRID (left 60%)           │  WORKSPACE (right 40%)  │
│                            │                         │
│  (3,3)  ·  ·  ·  ★        │  Current Position: (1,0)│
│  (2,3)  ·  ·  ·  ·        │                         │
│  (1,3)  ·  ·  ·  ·        │  Step: Right → (2,0)    │
│  (0,3)  ·  ·  ·  ·        │                         │
│  (3,2)  ·  ·  ·  ·        │  Build MX at (1,0):     │
│  ...                       │  ┌           ┐          │
│  (0,0)  ●  ·  ·  ·        │  │ [___] [___]│          │
│                            │  │ [___] [___]│          │
│  ● = current position      │  └           ┘          │
│  ★ = target                │                         │
│  ─ = completed path        │  Top-left: x² + y       │
│                            │  At (1,0): 1² + 0 = [_] │
│  [→ Right] [↑ Up]         │                         │
│                            │  Payload × Matrix:       │
│                            │  [1] × [7  2] = [___]   │
│                            │  [1]   [3  1]   [___]   │
│                            │                         │
└──────────────────────────────────────────────────────┘
```

### Key UI Components

1. **Grid Canvas** — Shows the coordinate grid, current position, target, drawn paths. Reuse coordinate conversion utilities from `toys/shared/`.

2. **Polynomial Evaluator** — Interactive fill-in-the-blank. Shows the polynomial expression, current (x,y), and an input field. KaTeX renders the math. Player types the number.

3. **Matrix Builder** — 2×2 grid of input fields. As polynomials are evaluated, values fill in (or player fills them).

4. **Vector Multiplier** — Shows the dot-product computation step by step. Player computes each row's dot product.

5. **Path Comparison Panel** — After both paths are complete, shows Path A final vector vs Path B final vector side by side.

---

## Scoring & Results

### Normalized Score (0-100)
```
baseScore = 100
- 5 per error (wrong polynomial eval, wrong multiplication)
- 2 per hint used
+ 10 bonus for completing proof (both paths match)
+ 10 bonus for zero errors
clamped to [0, 100]
```

### Results Report
- `customStats`: errors, hints, time, difficulty level, whether proof was completed
- `headline`: "Path Independence Proven!" / "Matrix Master!" / "Keep Practicing!"
- `celebrationType`: 'confetti' for proof completion, 'stars' otherwise

### Practice Break Config
```typescript
practiceBreakConfig: {
  suggestedConfig: { difficulty: 'beginner' },
  lockedFields: [],
  minDurationMinutes: 2,
  maxDurationMinutes: 10,
  difficultyPresets: {
    easy: { difficulty: 'beginner', gridSize: 2 },
    medium: { difficulty: 'linear', gridSize: 3 },
    hard: { difficulty: 'quadratic', gridSize: 4 },
  }
}
```

---

## Implementation Steps

### Phase 1: Core Types & Validator (server-safe, no React)
1. `types.ts` — Config, State, Move types with Zod schemas
2. `Validator.ts` — Pure game logic:
   - `getInitialState()` — Generate a valid conservative field for the chosen difficulty
   - `validateMove()` — Check polynomial evaluations, matrix multiplications, step validity
   - `isGameComplete()` — Both paths completed and equality confirmed
   - `getResultsReport()` — Scoring
3. `lib/cmf-math.ts` — Pure math utilities:
   - `evaluatePolynomial(coeffs, x, y)` — Evaluate polynomial at point
   - `buildMatrix(polynomials, x, y)` — Evaluate all 4 entries
   - `multiplyMatrixVector(matrix, vector)` — 2×2 × 2×1
   - `generateConservativeField(difficulty)` — Generate valid CMF polynomials
     (The key insight: for a 2×2 matrix field M_X, M_Y to be conservative,
      they must satisfy ∂M_X/∂y + M_X·M_Y = ∂M_Y/∂x + M_Y·M_X.
      We generate fields satisfying this constraint.)

### Phase 2: React UI
4. `Provider.tsx` — Local + Room providers wrapping `useArcadeSession`
5. `components/SetupPhase.tsx` — Difficulty picker
6. `components/GridCanvas.tsx` — Interactive grid with path drawing
7. `components/PolynomialEvaluator.tsx` — Fill-in-the-blank polynomial eval with KaTeX
8. `components/MatrixBuilder.tsx` — 2×2 matrix input grid
9. `components/VectorMultiplier.tsx` — Step-by-step dot product UI
10. `components/PathComparison.tsx` — Side-by-side final vectors
11. `components/PlayingPhase.tsx` — Orchestrates the step-by-step workflow
12. `components/ResultsPhase.tsx` — Score display
13. `GameComponent.tsx` — Phase router

### Phase 3: Registration & Integration
14. `index.ts` — `defineGame()` + export
15. Register in `game-registry.ts` and `validators.ts`
16. Add default config to `game-configs.ts`

### Phase 4: Polish
17. KaTeX rendering for all math expressions
18. Animations for vector transformation (payload morphing)
19. Sound effects via existing TTS/audio system
20. Mobile-responsive layout

---

## Conservative Field Generation Strategy

The hardest algorithmic problem is generating fields that are actually conservative. Strategy by difficulty:

### Beginner (commuting constant matrices)
Pick MX and MY as constant matrices that commute (AB = BA). Easy: use diagonal matrices, or scalar multiples of identity.

### Linear / Quadratic (potential-based generation)
A matrix field is conservative if it's the "derivative" of a matrix potential. Generate a matrix-valued function Φ(x,y) with polynomial entries, then derive:
- MX = ∂Φ/∂x
- MY = ∂Φ/∂y

This *guarantees* path independence (∫ from A to B = Φ(B) - Φ(A)), and the polynomials are automatically one degree lower than Φ. For quadratic difficulty, use cubic Φ entries → quadratic MX/MY entries.

This is elegant because:
1. It always produces valid conservative fields
2. The "proof" the kid discovers is a real theorem
3. We can verify answers by just checking Φ(target) - Φ(origin)
