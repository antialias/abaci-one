# Proposition Authoring Guide

A practical reference for implementing new propositions in the Euclid interactive tool. Covers every piece needed — geometry definition, tutorial scripting, exploration narration, and draggable point configuration.

## 1. Proposition Definition Checklist

Every proposition is a `PropositionDef` object exported from `propositions/propN.ts`. Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Proposition number (1-based) |
| `title` | yes | Short description shown in proof panel header |
| `givenElements` | yes | Starting geometry: points and segments |
| `steps` | yes | Ordered `PropositionStep[]` — the construction |
| `resultSegments` | no | Segments highlighted on completion + used for equality proof |
| `kind` | no | `'construction'` (Q.E.F.) or `'theorem'` (Q.E.D.) — default: construction |
| `draggablePointIds` | no | IDs of given points the user can drag post-completion |
| `computeGivenElements` | no | Factory for recomputing given elements during drag (needed for theorems with derived points like I.4) |
| `givenFacts` | no | Equality facts pre-loaded into the fact store |
| `givenAngles` | no | Angle arcs to render at vertices |
| `equalAngles` | no | Pairs of equal angles for matching tick marks |
| `theoremConclusion` | no | Text conclusion for theorems (bypasses fact-store display) |
| `superpositionFlash` | no | C.N.4 superposition animation config |
| `completionMessage` | no | Legacy field, rarely used |

## 2. Given Elements

Define starting geometry in `givenElements`:

```typescript
givenElements: [
  {
    kind: 'point',
    id: 'pt-A',        // Convention: pt-{label}
    x: -2, y: 0,       // World coordinates
    label: 'A',
    color: BYRNE.given, // Always BYRNE.given for starting points
    origin: 'given',
  },
  {
    kind: 'segment',
    id: 'seg-AB',       // Convention: seg-{from}{to}
    fromId: 'pt-A',
    toId: 'pt-B',
    color: BYRNE.given,
    origin: 'given',
  },
] as ConstructionElement[]
```

**Coordinate conventions:**
- Center the construction around origin
- Given line segments typically on y=0
- Leave room above for constructions (the viewport auto-centers with a +1.5 y offset)

## 3. Construction Steps

Each step is a `PropositionStep`:

```typescript
{
  instruction: 'Draw a circle centered at A through B', // Formal text for proof panel
  expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B' },
  highlightIds: ['pt-A', 'pt-B'],
  tool: 'compass',    // Auto-selects this tool | null for tap actions
  citation: 'Post.3', // Euclid citation key
}
```

**Expected action types:**
- `compass` — `{ centerId, radiusPointId }`
- `straightedge` — `{ fromId, toId }`
- `intersection` — `{ label?, ofA?, ofB?, beyondId? }` — use `ElementSelector` for ofA/ofB
- `macro` — `{ propId, inputPointIds, outputLabels? }` — invokes a previously proven proposition

**Tool values:** `'compass'`, `'straightedge'`, `'macro'`, `null` (for tap-to-mark intersections)

## 4. Tutorial Sub-Steps

Each construction step can have multiple tutorial sub-steps that guide the child through the gesture. Defined in `propositions/propNTutorial.ts`:

```typescript
export function getPropNTutorial(isTouch: boolean): TutorialSubStep[][] {
  return [
    // Step 0 sub-steps
    [
      {
        instruction: 'Tap point A to set the compass center', // UI text
        speech: 'First, tap on point A.',                      // TTS text
        hint: { type: 'pulse', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: 'Now tap point B to set the radius',
        speech: 'Now tap point B to open the compass.',
        hint: { type: 'pulse', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
    ],
    // Step 1 sub-steps...
  ]
}
```

**Key fields:**
- `instruction` — displayed in the proof panel guidance box
- `speech` — read aloud via TTS (can differ from instruction for natural speech)
- `hint` — visual hint: `{ type: 'pulse', pointId }`, `{ type: 'ring', ... }`, or `{ type: 'none' }`
- `advanceOn` — trigger to move to next sub-step: `{ kind: 'compass-phase', phase }` or `{ kind: 'macro-select', index }`

**Touch vs mouse:** The `isTouch` parameter lets you vary instruction text (e.g., "Tap" vs "Click").

## 5. Exploration Narration

Post-completion narration that plays during the drag exploration phase. Defined in `propositions/explorationNarration.ts`:

```typescript
EXPLORATION_NARRATION[N] = {
  introSpeech: 'You built an equilateral triangle! Now try dragging...',
  pointTips: [
    { pointId: 'pt-A', speech: 'Notice how all three sides stay equal...' },
    { pointId: 'pt-B', speech: 'Move B closer or farther away...' },
  ],
}
```

### Writing good intro speech

- Celebrate what the child just built (name the construction)
- Invite them to drag specific points
- Keep it under ~30 words

### Writing good per-point tips

Each tip plays once, on the first drag of that point. Good tips:

1. **Observe a geometric invariant** — "Notice all three sides stay equal no matter where A goes"
2. **Suggest an extreme case** — "What happens when AB gets really short?"
3. **Connect to the proposition's meaning** — "AF always equals BC, wherever A ends up"

Keep tips under ~25 words. Use the child's perspective — "you", "watch", "notice", "see how".

### Examples from existing propositions

See `explorationNarration.ts` for all 4 implemented propositions.

## 6. Draggable Points

Set `draggablePointIds` to enable post-completion drag:

```typescript
draggablePointIds: ['pt-A', 'pt-B'],
```

**Simple drag** (most constructions): Points move directly, segments between given points update automatically. The construction replays from scratch on each frame.

**Computed drag** (theorems like I.4): When given points have derived relationships (e.g., triangle DEF mirrors ABC), provide `computeGivenElements`:

```typescript
computeGivenElements: (positions) => {
  const A = positions.get('pt-A')!
  // ... compute derived points from dragged positions
  return [/* fresh givenElements array */]
},
```

This factory is called on every drag frame with a map of `pointId -> {x, y}`.

## 7. Fact Store & Proof

**Given facts** — pre-loaded equalities for theorems:

```typescript
givenFacts: [
  { left: { a: 'pt-A', b: 'pt-B' }, right: { a: 'pt-D', b: 'pt-E' }, statement: 'AB = DE' },
],
```

**Conclusion functions** — registered in `propositions/prop2Facts.ts` as `PROP_CONCLUSIONS[propId]`. Called when the proposition completes to derive final equality facts.

**Result segments** — segments whose equality is checked and displayed in the conclusion bar:

```typescript
resultSegments: [
  { fromId: 'pt-A', toId: 'pt-C' },
  { fromId: 'pt-C', toId: 'pt-B' },
],
```

## 8. Testing Checklist

For each new proposition, verify:

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] Construction completes with all steps valid
- [ ] Proof panel shows correct citations and equality facts
- [ ] Tutorial sub-steps advance correctly (compass/straightedge/macro phases)
- [ ] TTS reads each sub-step instruction
- [ ] On completion: exploration intro plays (not generic celebration)
- [ ] Each draggable point triggers its tip on first drag only
- [ ] Dragging replays construction correctly (no visual glitches)
- [ ] Rewind to any step works, then re-complete triggers narration again
- [ ] Point tips reset after rewind + re-complete
- [ ] Auto-complete (debug panel) works

### Registration checklist

After creating all files for a new proposition:

1. Add `PROP_N` to `PROPOSITIONS` in `EuclidCanvas.tsx`
2. Add `getPropNTutorial` to `TUTORIAL_GENERATORS` in `EuclidCanvas.tsx`
3. Add narration to `EXPLORATION_NARRATION` in `explorationNarration.ts`
4. Add conclusion function to `PROP_CONCLUSIONS` in `prop2Facts.ts` (if needed)
5. Add macro to `MACRO_REGISTRY` in `engine/macros.ts` (if this prop is used as a macro later)
