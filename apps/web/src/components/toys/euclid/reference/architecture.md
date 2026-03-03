# Euclid Toy — Architecture Reference

> Written March 2026. Covers the recipe system, adapter layer, ghost/ceremony pipeline,
> rendering architecture, and dual authoring patterns as implemented for Propositions I.1–I.7.

---

## 1. System Overview

The architecture follows a **"define once, derive everywhere"** principle for
construction propositions. A single `ConstructionRecipe` definition feeds into
a pure evaluator, whose trace is then consumed by multiple adapter functions:

```
                        ConstructionRecipe
                              │
                     evaluateRecipe()
                              │
                      ConstructionTrace
                              │
            ┌─────────┬───────┼────────┬──────────────┐
            │         │       │        │              │
     recipeToMacroDef │  traceToGhost  │    recipeToConclusion
            │         │    Layers      │              │
        MacroDef  recipeToPreview  GhostLayer[]  deriveConclusion
            │         │                │              │
        macro      cursor          ceremony       proof
       engine      preview         system         panel
```

### Major Subsystems

| Subsystem | Location | One-liner |
|-----------|----------|-----------|
| Recipe engine | `engine/recipe/` | Declarative construction definitions + pure evaluator |
| Adapters | `engine/recipe/adapters.ts` | Recipe → macro / preview / ghost / proof derivations |
| Step derivation | `engine/recipe/deriveSteps.ts` | Recipe + annotations → student-facing `PropositionStep[]` |
| Macro engine | `engine/macros.ts` | Executes macro tools (point selection → geometry mutation) |
| Macro preview | `engine/macroPreview.ts`, `render/renderMacroPreview.ts` | Live cursor preview of macro results |
| Ghost construction | `render/renderGhostGeometry.ts` | Depth-based visualization of macro internals |
| Ceremony system | `EuclidCanvas.tsx` (RAF tick) | Timed reveal of ghost layers with draw animations |
| Construction render | `render/renderConstruction.ts` | Main geometry: circles, segments, points, highlights |
| Tool overlay | `render/renderToolOverlay.ts` | Compass physics, straightedge friction, extend preview |
| Proof / facts | `engine/factStore.ts` | Equality facts derived from constructions |
| Tutorial engine | per-proposition `getTutorial()` | Step-by-step guidance with tool hints |

---

## 2. Recipe System (`engine/recipe/`)

### Philosophy

A `ConstructionRecipe` is the **single source of truth** for a construction
proposition. It declaratively defines what to build, what it proves, and how
to animate the reveal. Everything else — macro execution, cursor preview,
ghost layers, proof derivation, student-facing steps — is derived from it.

### `ConstructionRecipe` (`engine/recipe/types.ts`)

```typescript
interface ConstructionRecipe {
  propId: number                     // e.g. 1 for Proposition I.1
  label: string                      // "Equilateral triangle (I.1)"
  inputSlots: RecipeInputSlot[]      // Named input points with roles
  distinctInputPairs: [number, number][]  // Pairs that must not coincide
  ops: RecipeOp[]                    // Construction steps
  exports: Array<{                   // Public outputs
    ref: Ref
    kind: 'point' | 'segment'
    outputLabelKey?: string          // Relabel key for parent recipes
  }>
  facts: RecipeFact[]                // Proof chain
  ceremony: CeremonySpec             // Ghost reveal authoring
  degenerateCases?: Array<{          // Coincident-input special handling
    condition: { coincident: [Ref, Ref] }
    ops: RecipeOp[]
    ceremony?: CeremonySpec
  }>
}
```

Each `RecipeInputSlot` binds a single-letter `Ref` (e.g. `'A'`) to a semantic
`role` and a construction-state ID (`givenId: 'pt-A'`).

### `RecipeOp` Variants

Five op kinds, each corresponding to an axiom or prior result:

| Kind | Axiom | Fields | What it does |
|------|-------|--------|--------------|
| `segment` | Post.1 | `from`, `to` (Refs) | Join two points with a line segment |
| `circle` | Post.3 | `center`, `radiusPoint` (Refs) | Describe a circle |
| `intersection` | Def.15 | `of: [src, src]`, `prefer`, `output` | Mark where two loci meet |
| `produce` | Post.2 | `from`, `through`, `until` (circle ID), `output` | Extend a line to meet a circle |
| `apply` | "By I.n" | `recipeId`, `inputs`, `outputs` | Invoke a proven proposition |

`IntersectionSource` is either a string (op ID) or `{ segmentRefs: [Ref, Ref] }`
for inline segment references. The `prefer` field chooses `'upper'` or `'lower'`
intersection when two exist.

### `RecipeFact` and `RecipeCitation`

Facts declare the proof chain — equalities that follow from the construction:

```typescript
type RecipeFact = RecipeDistanceFact | RecipeAngleFact

// Each fact has:
//   left/right   — the two sides of the equality
//   citation     — why they're equal
//   statementTemplate / justificationTemplate — display text with {Ref} holes
```

Citation types: `def15` (circle radius), `cn1` (transitivity), `cn3` (subtraction),
`prop` (previous proposition).

### `CeremonySpec`

Controls ghost reveal animation:

```typescript
interface CeremonySpec {
  revealGroups: string[][]      // Groups of op IDs revealed sequentially
  narrationTemplate: string     // Template with {ref} substitution for TTS
}
```

### `OpAnnotations`

Per-op metadata for step derivation, keyed by `op.id`:

```typescript
interface OpAnnotation {
  instruction: string           // "{pt:A}", "{seg:XY}", "{prop:n|label}" templates
  tool: 'compass' | 'straightedge' | 'macro' | 'move' | 'point' | 'extend' | null
  citation?: string             // e.g. 'Post.1', 'Def.15'
  highlightIds?: string[]       // Construction IDs to highlight
  expectedOverride?: ExpectedAction  // Override auto-derived action
}

type OpAnnotations = Record<string, OpAnnotation>
```

### `evaluateRecipe()` (`engine/recipe/evaluate.ts`)

Pure function. Takes a recipe, concrete input positions, and a registry
(for resolving `apply` ops recursively). Returns a `ConstructionTrace`:

```typescript
function evaluateRecipe(
  recipe: ConstructionRecipe,
  inputPositions: Pt[],
  registry: RecipeRegistry
): ConstructionTrace | null
```

### `ConstructionTrace` (`engine/recipe/types.ts`)

```typescript
interface ConstructionTrace {
  recipe: ConstructionRecipe
  inputPositions: Pt[]
  pointMap: Map<Ref, Pt>              // All computed point positions
  circleMap: Map<string, ResolvedCircle>
  segmentMap: Map<string, ResolvedSegment>
  opTraces: OpTrace[]                 // Per-op geometry for rendering
  degenerate: boolean                 // Whether a degenerate case was used
}
```

Returns `null` when geometry is impossible (e.g. non-intersecting circles).
Handles degenerate cases by switching to the recipe's alternate `ops` list.
Resolves `apply` ops recursively, producing nested `ConstructionTrace`s.

### `RecipeRegistry` (`engine/recipe/definitions/registry.ts`)

```typescript
export const RECIPE_REGISTRY: RecipeRegistry = {
  1: RECIPE_PROP_1,
  2: RECIPE_PROP_2,
  3: RECIPE_PROP_3,
}
```

### Example: Proposition I.1

Prop I.1 (equilateral triangle) defines two input points A, B, then:
1. `circle` centered at A through B
2. `circle` centered at B through A
3. `intersection` of the two circles → apex C
4. `segment` C→A
5. `segment` C→B

Two facts prove AC=AB (Def.15, circle-A) and BC=BA (Def.15, circle-B).
Ceremony reveals circle-A first, then circle-B, with narration.

See `engine/recipe/definitions/prop1.ts` for the full definition.

---

## 3. Adapter Layer (`engine/recipe/adapters.ts`)

Six adapter functions convert recipes/traces into forms consumed by other systems:

### `recipeToMacroDef(recipe, registry) → MacroDef`

Generates a `MacroDef` (macro engine input) from a recipe. Maps input slots
to macro inputs and derives the execution logic from recipe ops.

### `recipeToPreview(recipe, registry) → (inputs: Pt[]) => MacroPreviewResult | null`

Returns a closure that, given concrete input positions, evaluates the recipe
and splits the trace into `ghostElements` (supporting construction) and
`resultElements` (exported outputs) for the cursor preview system.

### `recipeToConclusion(recipe) → (store, state, atStep) => EqualityFact[]`

Returns a closure that derives proof-panel facts from the recipe's `facts`
array by resolving `Ref`s to construction-state point IDs.

### `traceToGhostLayers(trace, recipe, baseDepth, refToId, state, inputPointIds, outputLabels?) → GhostLayer[]`

Converts a `ConstructionTrace` into `GhostLayer[]` for the ghost rendering
system. Handles recursive traces from `apply` ops by incrementing depth.
Maps `CeremonySpec.revealGroups` (op IDs) to element index groups.
Resolves narration templates by substituting point labels.

### `applyTraceFacts(recipe, factStore, atStep, refToId, conclusionOnly?) → EqualityFact[]`

Pushes recipe facts into the fact store. When `conclusionOnly` is true,
only the final export-relevant facts are applied (used during ceremony to
avoid premature proof-panel updates for intermediate construction steps).

### `deriveSteps(recipe, annotations) → PropositionStep[]` (`engine/recipe/deriveSteps.ts`)

Converts recipe ops + annotations into student-facing `PropositionStep[]`.
Filters to annotated ops only (export-only segments without annotations are
skipped). Each step gets an `ExpectedAction` derived from the op kind unless
`expectedOverride` is set in the annotation.

---

## 4. Ghost Construction System

Ghost geometry visualizes the **internal dependencies** of macro propositions —
the circles, segments, and points that a macro constructs internally but that
don't appear as first-class construction elements.

### Types (`types.ts`)

```typescript
type GhostElement = GhostCircle | GhostSegment | GhostPoint

interface GhostLayer {
  propId: number           // Which proposition's internals
  depth: number            // 1 = direct macro, 2 = dependency's dependency, ...
  elements: GhostElement[] // Lightweight geometry (no IDs)
  atStep: number           // Construction step that produced this layer
  revealGroups?: number[][] // Element indices grouped for sequential reveal
  keyNarration?: string    // TTS text when layer finishes (depth-1 only)
}
```

### Rendering (`render/renderGhostGeometry.ts`)

```typescript
function renderGhostGeometry(
  ctx, ghostLayers, viewport, w, h,
  hoveredMacroStep,    // Step index being hovered in sidebar
  opacities,           // LERP'd per-element opacity map (persists across frames)
  ceremonyRevealCounts?,  // Map<layerKey, groupCount> for ceremony mode
  elementAnims?,       // Per-element draw animation state
  now?
): boolean  // true if still animating
```

**Opacity controls:**

| Constant | Value | Purpose |
|----------|-------|---------|
| `ghostBaseOpacity` | 0.2 | Faint watermark at rest |
| `ghostFalloff` | 0.75 | Depth multiplier: `depthFactor = max(0, 1 - falloff * (depth - 1))` |

In **normal mode**, hovered steps brighten to `min(1, baseOpacity * 4)`.
In **ceremony mode**, revealed groups render at `0.75 * depthFactor`;
unrevealed groups are invisible.

All opacity changes use LERP (15% per frame, ~150ms transitions).

**Draw animations** during ceremony:
- **Circle**: clockwise sweep from top (−π/2), progressing over duration
- **Segment**: ease-out interpolation along the line
- **Point**: instant (no animation)

---

## 5. Macro Cursor Preview

When the macro tool is in `selecting` phase, a live preview shows what the
construction will produce before the user commits.

### Types (`engine/macroPreview.ts`)

```typescript
interface MacroPreviewResult {
  ghostElements: GhostElement[]   // Supporting construction (faint)
  resultElements: GhostElement[]  // Output geometry (brighter)
}
```

### `buildMacroPreviewPositions()` (`render/renderMacroPreview.ts`)

Builds the array of input positions for preview evaluation:
- Already-selected points: from construction state
- Next-to-select (primary unbound): snapped point or raw cursor position
- Future unbound inputs: cursor + screen-space offsets

Extracted as a separate function so the auto-fit system can compute preview
bounds without duplicating position logic.

### `renderMacroPreview()` (`render/renderMacroPreview.ts`)

Renders three layers:

1. **Bound point highlights** — 12px rings around already-selected points,
   colored by input index from Byrne palette

2. **Unbound point markers**:
   - Primary (next-to-select): 7px filled circle with pulsing ring, label in dark pill
   - Future inputs: 5px filled circles with small labels

3. **Preview ghost geometry**:
   - Ghost elements at `max(0.1, baseOpacity * 1.25)` opacity
   - Result elements at `max(0.15, baseOpacity * 2)` opacity
   - Dashed circles/segments

Returns `true` when pointer is present (continuous animation for pulse rings).

The preview transitions smoothly to the ghost ceremony on commit because
depth-1 ghost layers are pre-revealed in the ceremony, maintaining visual
continuity.

---

## 6. Ceremony System

The ceremony is a timed animation that reveals ghost construction layers after
a macro commits, making the "black box" transparent.

### `MacroCeremonyState` (`types.ts`)

```typescript
interface MacroCeremonyState {
  // Ordered reveal sequence, deepest-depth first
  sequence: Array<{ layerKey: string; groupIndex: number; msDelay: number }>
  revealed: number              // How many entries have been revealed
  lastRevealMs: number          // Timestamp of last reveal

  // Narration
  narrationText: string
  narrationFired: boolean

  // Completion timing
  allShownMs: number | null     // When all groups were shown (null = not yet)
  postNarrationDelayMs: number  // Delay after allShownMs before advancing

  // Deferred step-advance closure
  advanceStep: () => void

  // Depth-1 layers visible from frame 1 (continuity from cursor preview)
  preRevealedLayers: Map<string, number>

  // Per-element draw animation state: key = `${layerKey}:${elementIdx}`
  elementAnims: Map<string, { startMs: number; durationMs: number }>

  // Macro output elements hidden until ceremony completes
  hiddenElementIds: Set<string>
}
```

### Lifecycle

**1. Creation** (on macro commit in `EuclidCanvas.tsx`):
- Pre-reveal depth-1 layers (they were visible as cursor preview)
- Build timed sequence for deeper layers, sorted **deepest-first**
  (dependencies revealed before the result that uses them)
- Timing: 400ms initial pause, then each group's draw duration + 200ms gap
- Store macro output element IDs in `hiddenElementIds`

**2. Tick** (RAF loop each frame):
- **Reveal phase**: check if next sequence entry's delay has elapsed.
  Increment `revealed`, create `elementAnims` entries:
  - Circle: 700ms draw duration
  - Segment: 400ms draw duration
  - Point: 0ms (instant)
- **Narration phase**: once `allShownMs` is set and narration hasn't fired,
  trigger TTS for `narrationText`
- **Advance phase**: after `postNarrationDelayMs` (1200ms default),
  call `advanceStep()` — reveals solid construction elements, clears
  `hiddenElementIds`, sets `macroRevealRef.current = null`

**3. Cleanup**: ceremony ref is nulled, hidden element IDs cleared,
ghost layers remain visible as static watermarks.

### Timing Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Initial pause | 400ms | Breathing room before first group |
| Inter-group gap | 200ms | Pause between reveal groups |
| Circle draw | 700ms | Sweep animation duration |
| Segment draw | 400ms | Ease-out animation duration |
| Post-narration delay | 1200ms | Wait after TTS before advancing |

---

## 7. Rendering Pipeline Overview

### RAF Loop (`EuclidCanvas.tsx`, `draw()` function)

Each frame proceeds through three phases:

**Phase A — Observation and Tick:**
- Tool phase transitions (compass, straightedge, extend)
- `tickMacroAnimation()` — element reveal progress
- Ceremony tick — group reveals, narration, step advance
- Tutorial hint visibility tracking
- Tool overlay idle bob animation

**Phase B — Viewport Auto-fit:**
- Compute construction bounds (all points, circles, segments)
- Expand for active arc sweep, ghost layers, macro preview geometry
- LERP viewport center + PPU toward target with damping
- Hard constraint: keep compass tip visible during sweep

**Phase C — Render** (gated by `needsDrawRef.current`):

| Order | Function | Source file | What it draws |
|-------|----------|-------------|---------------|
| 1 | `renderConstruction()` | `render/renderConstruction.ts` | Background, circles, segments, points, snaps, candidates, result highlights, draggable pulse ripples |
| 2 | `renderProductionSegments()` | `render/renderProductionSegments.ts` | Post.2 extension intersection visuals |
| 3 | `renderGhostGeometry()` | `render/renderGhostGeometry.ts` | Dependency scaffolding (depth-based, ceremony-aware) |
| 4 | `renderMacroPreview()` | `render/renderMacroPreview.ts` | Unbound markers + live ghost preview |
| 5 | `renderEqualityMarks()` | `render/renderEqualityMarks.ts` | Tick marks on equal-length segments |
| 6 | `renderAngleArcs()` | `render/renderAngleArcs.ts` | Given angle arcs + equal angle tick marks |
| 7 | `renderSuperpositionFlash()` | `render/renderSuperpositionFlash.ts` | C.N.4 triangle overlay animation |
| 8 | `renderDragInvitation()` | `render/renderConstruction.ts` | Post-completion "drag to explore" text |
| 9 | `renderChatHighlight()` | `render/renderChatHighlight.ts` | Golden glow on chat-hovered entities |
| 10 | `renderChatHighlight()` (voice) | `render/renderChatHighlight.ts` | Voice tool call highlights |
| 11 | `renderToolOverlay()` | `render/renderToolOverlay.ts` | Compass body, straightedge body, extend ray |
| 12 | `renderTutorialHint()` | `render/renderTutorialHint.ts` | Top-layer hint text + arrows |

### Key Refs

| Ref | Type | Drives |
|-----|------|--------|
| `ghostLayersRef` | `GhostLayer[]` | Ghost rendering — replaced on each macro mutation |
| `macroRevealRef` | `MacroCeremonyState \| null` | Ceremony system — ticked each frame, nulled on completion |
| `macroPhaseRef` | `MacroPhase` | Macro tool state: `idle` / `choosing` / `selecting` |
| `macroAnimationRef` | `MacroAnimation \| null` | Element reveal animation during macro execution |
| `extendPhaseRef` | `ExtendPhase` | Extend tool state: `idle` / `base-set` / `extending` |
| `needsDrawRef` | `boolean` | Render gate — skip canvas draw when nothing changed |

### Tool Overlay System (brief)

`renderToolOverlay()` renders physical tool bodies that follow the cursor:
- **Compass**: two-legged body with hinge, leg spread computed from phase
  (idle → center-set → radius-set → sweeping)
- **Straightedge**: friction physics on trailing end (viscous drag, angular
  velocity, torque integration, stability-constrained β)
- **Extend ray**: semi-transparent ray from base through endpoint during
  `extending` phase

---

## 8. Dual Authoring Patterns

### Pattern A: Recipe-Based (Propositions I.1–I.3)

For **construction propositions** where the result is fully determined by
geometric steps.

**Define:**
1. `ConstructionRecipe` in `engine/recipe/definitions/propN.ts`
2. `OpAnnotations` in the same file

**Everything else is derived:**
- `deriveSteps(recipe, annotations)` → `PropositionStep[]`
- `recipeToMacroDef()` → `MacroDef` for the macro engine
- `recipeToPreview()` → cursor preview function
- `recipeToConclusion()` → proof panel derivation
- `traceToGhostLayers()` → ghost layers with ceremony
- `applyTraceFacts()` → fact store updates

**Registration:**
1. Add recipe to `RECIPE_REGISTRY` in `engine/recipe/definitions/registry.ts`
2. Create `PropositionDef` in `propositions/propN.ts` using derived steps
3. Add to `PROP_REGISTRY` in `propositions/registry.ts`

### Pattern B: Manual (Propositions I.4–I.7)

For **theorem propositions** or propositions with unique interaction patterns
(superposition, given angles, extend tool).

**Define directly:**
- `steps: PropositionStep[]` — handwritten step array with explicit
  `ExpectedAction` per step
- `deriveConclusion()` — hand-coded fact derivation function
- Proposition-specific fields: `kind: 'theorem'`, `givenFacts`,
  `givenAngles`, `equalAngles`, `superpositionFlash`, `computeGivenElements`

**Registration:**
1. Create `PropositionDef` in `propositions/propN.ts`
2. Add to `PROP_REGISTRY` in `propositions/registry.ts`

### When to Use Which

| Criterion | Recipe (Pattern A) | Manual (Pattern B) |
|-----------|-------------------|-------------------|
| Proposition type | Construction | Theorem |
| Geometry fully deterministic | Yes | May have given elements |
| Used as a macro by later props | Yes | No (macros only from recipes) |
| Needs custom interaction | No | Yes (superposition, extend, etc.) |
| Proof derivation | From `RecipeFact[]` | Hand-coded `deriveConclusion` |

### Comparison

| Aspect | Recipe | Manual |
|--------|--------|--------|
| Step source | `deriveSteps(recipe, annotations)` | Inline `steps: [...]` |
| Macro definition | `recipeToMacroDef()` | N/A |
| Cursor preview | `recipeToPreview()` | N/A |
| Ghost layers | `traceToGhostLayers()` | N/A |
| Conclusion | `recipeToConclusion()` | `deriveConclusion()` |
| Ceremony | From `CeremonySpec` | N/A |

---

## Appendix: File Map

```
euclid/
├── EuclidCanvas.tsx                    # Main canvas: RAF loop, event handling, ceremony tick
├── types.ts                            # GhostElement, GhostLayer, MacroCeremonyState, etc.
├── engine/
│   ├── macros.ts                       # MacroDef, macro execution
│   ├── macroPreview.ts                 # MacroPreviewResult, MACRO_PREVIEW_REGISTRY
│   ├── factStore.ts                    # Equality fact storage
│   └── recipe/
│       ├── types.ts                    # ConstructionRecipe, RecipeOp, RecipeFact, etc.
│       ├── evaluate.ts                 # evaluateRecipe() → ConstructionTrace
│       ├── adapters.ts                 # recipeToMacroDef, recipeToPreview, traceToGhostLayers, etc.
│       ├── deriveSteps.ts              # deriveSteps() → PropositionStep[]
│       └── definitions/
│           ├── registry.ts             # RECIPE_REGISTRY
│           ├── prop1.ts                # I.1 equilateral triangle
│           ├── prop2.ts                # I.2 transfer distance
│           └── prop3.ts                # I.3 cut off equal
├── propositions/
│   ├── registry.ts                     # PROP_REGISTRY
│   ├── prop1.ts … prop7.ts            # PropositionDef per proposition
├── render/
│   ├── renderConstruction.ts           # Main geometry + drag invitation
│   ├── renderGhostGeometry.ts          # Ghost layers with depth/ceremony
│   ├── renderMacroPreview.ts           # Cursor preview (3 layers), buildMacroPreviewPositions
│   ├── renderToolOverlay.ts            # Compass/straightedge/extend bodies
│   ├── renderEqualityMarks.ts          # Tick marks on equal segments
│   ├── renderAngleArcs.ts             # Angle arcs and marks
│   ├── renderSuperpositionFlash.ts     # C.N.4 overlay
│   ├── renderProductionSegments.ts     # Post.2 extensions
│   ├── renderTutorialHint.ts           # Hint arrows and text
│   ├── renderChatHighlight.ts          # Entity glow from chat
│   └── buildFinalStates.ts            # Completion state computation
└── reference/
    ├── book1-foundations.md             # Definitions, postulates, common notions
    ├── book1-propositions.md           # All 48 propositions
    ├── book1-dependency-graph.md       # Proposition dependency DAG
    ├── pedagogy-and-design.md          # Original design notes (partially outdated)
    ├── authoring-guide.md              # Manual authoring guide (Pattern B only)
    └── architecture.md                 # ← This document
```
