# Superposition Interaction — Design Document

> Design doc for interactive triangle superposition in proof exploration steps.
> Tracks under [GitHub issue #122](https://github.com/antialias/abaci-one/issues/122).

---

## 1. What This Is

Euclid proved triangle congruence (Prop 4, SAS) by **superposition**: picking up one
triangle and placing it on top of the other. This is a physical operation, not an
abstract deduction. We implement it as an interactive proof step where the kid
physically drags one triangle onto the other, with the system handling rotation
automatically and the kid handling the flip explicitly when needed.

The superposition interaction is one of several new **proof exploration step** types
(alongside compass verification, angle overlay, and "because you built it" steps)
that replace the current passive `deriveConclusion()` fact dumps.

---

## 2. User Experience

### 2.1 The Full Sequence

The kid has just completed the construction steps (e.g., joined E to F). Now the
proof exploration begins. Earlier proof steps have already verified premises via
compass verification and angle overlay. This step is the climax — the congruence
discovery.

**Instruction panel**: *"Place triangle ABC onto triangle DEF"*

**What the kid sees:**

1. **Lift.** Triangle ABC's fill changes to look like a cut-out piece of paper —
   subtle border, slightly different fill from the construction lines. A drop shadow
   fades in underneath. The triangle scales up ~5% (it's "coming toward you"). The
   construction lines for ABC's sides remain on the canvas underneath, dimmed.
   Duration: ~300ms.

2. **Drag.** The kid drags the cutout freely across the canvas. The shadow tracks
   underneath (offset by ~4px down-right, blurred). Target triangle DEF pulses
   gently — a subtle breathing glow on its fill, inviting "put it here." The cutout
   follows the pointer with no latency (applied in RAF tick, not React state).

3. **Auto-rotation.** As the cutout approaches the target (center-to-center distance
   < 2× the triangle's circumradius), the system begins smoothly rotating the cutout
   to align corresponding edges. The rotation is proportional to proximity — closer
   = more aligned. The kid doesn't need to rotate manually. This mimics the natural
   self-alignment of puzzle pieces as you bring them close.

4. **Snap or Mismatch.** When the cutout is close enough (< 0.5× circumradius):
   - **Same orientation**: The cutout snaps into exact alignment over the target.
     Vertices coincide. The cutout settles (shadow fades, scale returns to 100%).
     DING! Congruence established. Cascading facts appear. → Jump to step 7.
   - **Opposite orientation**: The cutout lands but **doesn't fit**. The edges are
     close but visibly wrong — vertex C overshoots where F should be, or the cutout
     "bounces" gently off the target with a soft wobble. This mismatch must be
     viscerally obvious, not subtle.

5. **Flip prompt.** After the mismatch settles (~400ms), the instruction updates:
   *"Almost! It needs to be turned over. Tap to flip."* The cutout shows a subtle
   flip affordance (e.g., a curved arrow icon at its center, or the edges pulse in
   sequence suggesting rotation).

6. **Flip.** The kid taps the cutout. The flip animation plays (see §3 below).
   After the flip, the cutout is now mirrored. It snaps into alignment over the
   target. DING!

7. **Settle & cascade.** The cutout blends back into the canvas (border fades,
   shadow disappears, fill transitions to a shared highlight color on both
   triangles). The congruence fact appears in the proof panel: `△ABC ≅ △DEF`.
   Cascading equalities appear one by one with brief delays: `BC = EF`, then
   `∠ABC = ∠DEF`, then `∠ACB = ∠DFE`. Each cascading fact highlights its
   corresponding elements briefly.

### 2.2 Why the Mismatch Moment Matters

Don't skip it. Don't auto-flip. The mismatch is a **learning moment**.

A puzzle piece that's almost right but wrong is powerful. The kid recognizes
"something's off" and performs the corrective action. This is agency — they're
problem-solving, not following instructions. The "aha" when it finally snaps after
the flip is stronger because of the preceding failure.

For same-orientation cases where no flip is needed, the immediate snap is satisfying
in a different way. The contrast between "sometimes it just fits, sometimes you need
to flip" teaches orientation without ever using the word.

### 2.3 Mobile Considerations

On touch devices:
- Drag = finger drag (existing touch handling via `pointerdown/move/up`)
- Flip = tap the cutout while it's in mismatch state
- The cutout should be large enough to tap comfortably (at least 44×44px touch target)
- Consider: the kid's finger occludes the triangle during drag. The shadow and the
  target's pulsing glow should be visible around the finger.

---

## 3. The Flip Animation

### 3.1 The Core Problem

Two congruent triangles with opposite orientations (one CW, one CCW) cannot be
superimposed in 2D through rotation and translation alone. You must go through the
third dimension — pick it up, turn it over, place it back down.

### 3.2 Axis Selection

The flip rotates around the **line connecting two already-aligned vertices**. In
Prop 4 (SAS), where A↔D and B↔E are the matched vertices for the two given-equal
sides, the flip axis is the line AD (≈ the line DE after translation). This is
physically natural — imagine holding a piece of paper by one edge and flipping it
over that edge.

For propositions where the best axis isn't obvious from the SAS/ASA/SSS pattern,
use the line connecting the two vertices that are closest to their targets after
auto-rotation.

### 3.3 Animation Mechanics

The flip is a pseudo-3D effect achieved entirely in Canvas 2D:

```
t = 0.0   Full triangle, face up
t = 0.25  Triangle compressed perpendicular to axis (3/4 width)
t = 0.50  Edge-on: triangle collapses to a line along the axis
t = 0.75  Expanding again, but MIRRORED — the "back side" is visible
t = 1.0   Full triangle, face down (mirrored), settles into alignment
```

**Per-frame computation:**

```typescript
// For each vertex of the source triangle:
// 1. Project onto the flip axis
// 2. Compute the perpendicular displacement from the axis
// 3. Scale that displacement by cos(π * t)
// 4. The vertex position = projection + scaled displacement

function flipVertex(
  vertex: Vec2,
  axisPoint: Vec2,
  axisDir: Vec2,     // unit vector along flip axis
  t: number          // 0 → 1
): Vec2 {
  // Project vertex onto axis
  const toVertex = { x: vertex.x - axisPoint.x, y: vertex.y - axisPoint.y }
  const projLen = toVertex.x * axisDir.x + toVertex.y * axisDir.y
  const proj = { x: axisPoint.x + projLen * axisDir.x, y: axisPoint.y + projLen * axisDir.y }

  // Perpendicular displacement
  const perp = { x: vertex.x - proj.x, y: vertex.y - proj.y }

  // Scale perpendicular by cos(π·t) — collapses at t=0.5, mirrors for t>0.5
  const scale = Math.cos(Math.PI * t)

  return {
    x: proj.x + perp.x * scale,
    y: proj.y + perp.y * scale,
  }
}
```

At `t = 0.5`, `cos(π · 0.5) = 0` — all vertices collapse onto the axis (edge-on).
Past `t = 0.5`, `cos` goes negative — the perpendicular displacement inverts,
producing the mirror image.

### 3.4 Visual Depth Cues

To sell the "physical flip" feel:

- **Shadow.** During the flip, the drop shadow intensifies and spreads (the triangle
  is "higher off the page" at the midpoint). Shadow offset peaks at t=0.5.
  `shadowOffset = baseOffset + peakOffset * sin(π * t)`

- **Back-side shading.** For `t > 0.5`, the triangle fill shifts to a slightly
  different hue or adds a subtle crosshatch/grain pattern. This reinforces "you're
  looking at the other side." The shift should be gentle — too dramatic would be
  confusing.

- **Edge darkening at midpoint.** When the triangle is edge-on (`t ≈ 0.5`), draw
  the collapsed line slightly thicker and darker, simulating the visible edge of a
  piece of paper viewed from the side.

- **Easing.** Use ease-in-out (`0.5 - 0.5 * cos(π * t_raw)`) for the time parameter
  so the flip starts slow, accelerates through the midpoint, and decelerates into
  the settled position. Total duration: ~800ms.

### 3.5 Post-Flip Snap

After the flip completes, the now-mirrored cutout should be close to alignment with
the target (because auto-rotation already brought it close before the mismatch). A
final 200ms lerp snaps each vertex to its target position. The snap should feel
magnetic — ease-out-quad.

---

## 4. Orientation Detection

### 4.1 Cross Product Test

Triangle orientation (CW vs CCW) is determined by the cross product of two edge
vectors:

```typescript
function triangleOrientation(
  a: Vec2, b: Vec2, c: Vec2
): 'cw' | 'ccw' {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  // In screen coords (Y-down), positive cross = CW
  // In world coords (Y-up), positive cross = CCW
  return cross > 0 ? 'ccw' : 'cw'
}
```

### 4.2 When to Check

The orientation check happens when the cutout enters the snap zone (center distance
< snap threshold). Compare the orientation of the source triangle (in its current
dragged position, after auto-rotation) with the target triangle:

- Same orientation → snap directly
- Opposite orientation → mismatch bounce → await flip tap

### 4.3 Vertex Correspondence

The proposition definition specifies the vertex mapping:

```typescript
superposition: {
  src: ['pt-A', 'pt-B', 'pt-C'],   // source triangle
  tgt: ['pt-D', 'pt-E', 'pt-F'],   // target triangle
  mapping: [['pt-A', 'pt-D'], ['pt-B', 'pt-E'], ['pt-C', 'pt-F']],
}
```

The mapping determines:
- Which vertices should coincide after superposition
- The auto-rotation target (align src edges to tgt edges)
- The flip axis (line connecting two mapped vertex pairs)

---

## 5. Interaction State Machine

### 5.1 New Phase Type

```typescript
type SuperpositionPhase =
  | { tag: 'idle' }
  | { tag: 'lifting'; startTime: number }
  | { tag: 'dragging';
      srcTriIds: [string, string, string];
      tgtTriIds: [string, string, string];
      mapping: [string, string][];
      // Current world-space positions of the cutout vertices
      // (initially = source positions, updated by drag + auto-rotation)
      cutoutVertices: [Vec2, Vec2, Vec2];
      dragAnchor: Vec2;          // world pos of pointer at drag start
      initialCentroid: Vec2;     // centroid of source tri at drag start
    }
  | { tag: 'mismatched';
      cutoutVertices: [Vec2, Vec2, Vec2];
      srcTriIds: [string, string, string];
      tgtTriIds: [string, string, string];
      mapping: [string, string][];
      settleTime: number;        // when mismatch was detected
    }
  | { tag: 'flipping';
      startTime: number;
      axisPoint: Vec2;
      axisDir: Vec2;
      preFlipVertices: [Vec2, Vec2, Vec2];
      postFlipVertices: [Vec2, Vec2, Vec2];  // target positions after flip
      srcTriIds: [string, string, string];
      tgtTriIds: [string, string, string];
      mapping: [string, string][];
    }
  | { tag: 'snapping';
      startTime: number;
      fromVertices: [Vec2, Vec2, Vec2];
      toVertices: [Vec2, Vec2, Vec2];         // exact target positions
      srcTriIds: [string, string, string];
      tgtTriIds: [string, string, string];
      mapping: [string, string][];
    }
  | { tag: 'settled' }
```

### 5.2 Transitions

```
idle ──[step begins: superposition expected]──> lifting
  │
lifting ──[lift animation complete, 300ms]──> dragging
  │
dragging ──[pointer moves]──> dragging (update cutoutVertices + auto-rotation)
  │       ──[enters snap zone, same orientation]──> snapping
  │       ──[enters snap zone, opposite orientation]──> mismatched
  │       ──[pointer leaves snap zone]──> dragging (continue)
  │
mismatched ──[tap on cutout]──> flipping
  │          ──[drag resumes (pointer down + move)]──> dragging
  │
flipping ──[flip animation complete, 800ms]──> snapping
  │
snapping ──[snap lerp complete, 200ms]──> settled
  │
settled ──[facts established, step advances]──> idle
```

### 5.3 Integration with Tool Phase Manager

Add to `useToolPhaseManager.ts`:

```typescript
superpositionPhaseRef: MutableRefObject<SuperpositionPhase>
```

The superposition tool is NOT a user-selectable tool. It activates automatically
when the current step expects `{ type: 'superposition', ... }`. The tool phase
manager enters the superposition phase, and pointer events route to the
superposition handler instead of compass/straightedge.

During superposition, all other tool interactions are blocked (compass, straightedge,
extend, macro). The tool dock either hides or shows the superposition as the active
tool with a distinctive icon.

---

## 6. Rendering

### 6.1 Render Layer Position

Insert a new render layer between the existing layers:

```
Layer 6:  renderAngleArcs (existing)
Layer 6½: renderSuperpositionInteraction (NEW)     ← the interactive cutout
Layer 7:  renderSuperpositionFlash (existing)       ← the passive C.N.4 flash
```

The passive flash (layer 7) fires AFTER the interactive superposition completes, as
a celebratory visual. Or it may be replaced entirely by the interactive version.

### 6.2 What to Render by Phase

#### `lifting`
- Source triangle fill transitions from construction color to "paper" appearance
- Drop shadow fades in
- Scale interpolates from 1.0 to 1.05
- Construction lines for source sides dim to 30% opacity

#### `dragging`
- **Cutout polygon**: Filled with paper-like color (warm off-white, e.g., `#FFF8ED`),
  2px border in the source triangle's color, rounded joins
- **Drop shadow**: Dark polygon offset (4px, 4px), Gaussian blur ≈ 8px,
  `rgba(0,0,0,0.15)`
- **Target glow**: Target triangle fill pulses between `rgba(240,199,94,0.0)` and
  `rgba(240,199,94,0.12)` with period ~2s (sine wave)
- **Correspondence hints**: When cutout is within 3× circumradius of target, thin
  dashed lines connect corresponding vertices (cutout A → target D, etc.) at low
  opacity (~0.2). Helps guide the kid.
- **Source triangle "ghost"**: The original position of the source triangle remains
  as a faint dashed outline (the "hole" where the cutout was). This grounds the
  operation — the kid can see where it came from.

#### `mismatched`
- Cutout is positioned near target but offset/rotated incorrectly
- A brief wobble animation (2-3 oscillations over 400ms, damped sine on rotation)
- After wobble settles: cutout shows the flip affordance — a curved arrow icon
  rendered at the centroid, or the border pulses in sequence (vertex by vertex)
  suggesting "turn me over"
- Target triangle glow continues

#### `flipping`
- Cutout vertices computed per-frame via `flipVertex()` (§3.3)
- At `t < 0.5`: front face visible, shrinking perpendicular to axis
- At `t ≈ 0.5`: edge-on line, thicker stroke, peak shadow
- At `t > 0.5`: back face visible (slightly different fill, e.g., `#F5ECD7`),
  expanding to full mirrored shape
- Shadow offset peaks at midpoint: `4 + 8 * sin(π * t)` px

#### `snapping`
- Vertices lerp from post-flip positions to exact target positions
- Ease-out-quad over 200ms
- Shadow fades out during snap
- Border fades out

#### `settled`
- Both triangles share a unified highlight fill (the existing gold
  `#F0C75E` at low opacity)
- Vertex correspondence pulses fire (reuse existing `renderSuperpositionFlash`
  pulse logic)
- After 400ms: cascading facts begin appearing in proof panel

### 6.3 Canvas 2D Implementation Notes

All rendering uses the standard Canvas 2D context. Key techniques:

- **Drop shadow**: Render a second polygon at shadow offset with `ctx.filter =
  'blur(8px)'` or use `ctx.shadowBlur`/`ctx.shadowOffsetX/Y` (simpler but applies
  to all subsequent draws — save/restore context).
- **Dashed outlines**: `ctx.setLineDash([6, 4])` for the source ghost and
  correspondence lines.
- **Clipping for back-face**: No actual clipping needed. Just change fill color
  when `t > 0.5` in the flip.
- **Curved arrow icon**: Pre-computed path data, rendered at cutout centroid during
  mismatch phase.

---

## 7. Auto-Rotation Algorithm

### 7.1 Goal

As the cutout approaches the target, rotate it to align corresponding edges. The
kid only needs to drag in the right direction — the system handles orientation.

### 7.2 Computing Target Rotation

Given the vertex mapping (A↔D, B↔E, C↔F):

```typescript
function computeTargetRotation(
  srcVertices: [Vec2, Vec2, Vec2],    // current cutout positions
  tgtVertices: [Vec2, Vec2, Vec2],    // target triangle positions
): number {
  // Use the first edge pair (A→B vs D→E) to compute the rotation
  const srcAngle = Math.atan2(
    srcVertices[1].y - srcVertices[0].y,
    srcVertices[1].x - srcVertices[0].x,
  )
  const tgtAngle = Math.atan2(
    tgtVertices[1].y - tgtVertices[0].y,
    tgtVertices[1].x - tgtVertices[0].x,
  )
  return normalizeAngle(tgtAngle - srcAngle)
}
```

### 7.3 Proximity-Based Blending

The rotation is blended based on distance to the target:

```typescript
const dist = distance(cutoutCentroid, targetCentroid)
const radius = circumradius(targetTriangle)
const influence = clamp(1 - dist / (2 * radius), 0, 1)
// influence: 0 at 2× radius, 1 at centroid overlap

const currentRotation = getCurrentRotation(cutoutVertices)
const targetRotation = computeTargetRotation(srcVertices, tgtVertices)
const blendedRotation = lerpAngle(currentRotation, targetRotation, influence * influence)
// Quadratic easing: gentle onset, strong finish
```

Apply `blendedRotation` to all three cutout vertices around the cutout's centroid
each frame during drag.

---

## 8. Proposition Authoring

### 8.1 Step Definition

Add a new `ExpectedAction` variant:

```typescript
interface ExpectedSuperposition {
  type: 'superposition'
  src: [string, string, string]        // source triangle vertex IDs
  tgt: [string, string, string]        // target triangle vertex IDs
  mapping: [string, string][]          // vertex correspondence pairs
  establishes: {
    congruence: { statement: string }
    cascade: Array<{
      kind: 'segment-equality' | 'angle-equality'
      statement: string
      citation: Citation
    }>
  }
}
```

### 8.2 Example: Prop 4

```typescript
steps: [
  // ... construction steps and earlier proof verification steps ...
  {
    instruction: 'Place triangle {tri:ABC} onto triangle {tri:DEF}',
    expected: {
      type: 'superposition',
      src: ['pt-A', 'pt-B', 'pt-C'],
      tgt: ['pt-D', 'pt-E', 'pt-F'],
      mapping: [['pt-A', 'pt-D'], ['pt-B', 'pt-E'], ['pt-C', 'pt-F']],
      establishes: {
        congruence: { statement: '△ABC ≅ △DEF' },
        cascade: [
          { kind: 'segment-equality', statement: 'BC = EF', citation: { type: 'cn4' } },
          { kind: 'angle-equality', statement: '∠ABC = ∠DEF', citation: { type: 'cn4' } },
          { kind: 'angle-equality', statement: '∠ACB = ∠DFE', citation: { type: 'cn4' } },
        ],
      },
    },
    tool: 'superposition',
    citation: 'C.N.4',
  },
]
```

### 8.3 Tutorial Sub-Steps

```typescript
getTutorial(): TutorialSubStep[][] {
  return [
    // ... earlier steps ...
    [
      // Sub-step 0: intro
      {
        instruction: 'Two sides and the angle between them are equal. Let\'s see if the triangles match.',
        speech: 'Two sides and the angle between them are equal. Let us see if the triangles can be placed one upon the other.',
        hint: { type: 'triangle-highlight', ids: ['pt-A', 'pt-B', 'pt-C'] },
        advanceOn: { kind: 'superposition-phase', phase: 'dragging' },
      },
      // Sub-step 1: dragging
      {
        instruction: 'Drag triangle {tri:ABC} onto triangle {tri:DEF}',
        speech: 'Drag the triangle across.',
        hint: { type: 'arrow', from: 'tri-centroid-ABC', to: 'tri-centroid-DEF' },
        advanceOn: { kind: 'superposition-phase', phase: 'snapping' },
        // OR, if flip needed:
        // advanceOn: { kind: 'superposition-phase', phase: 'mismatched' },
      },
      // Sub-step 2: flip (conditional — only if orientations differ)
      {
        instruction: 'Almost! Tap the triangle to flip it over.',
        speech: 'Almost. It needs to be turned over. Tap it.',
        hint: { type: 'tap', target: 'cutout-centroid' },
        advanceOn: { kind: 'superposition-phase', phase: 'flipping' },
        conditional: 'needs-flip',  // only shown if orientation check fails
      },
      // Sub-step 3: settled
      {
        instruction: 'The triangles match perfectly!',
        speech: 'The triangles coincide. They are equal in every way.',
        hint: null,
        advanceOn: null, // manual advance or auto-advance after cascade
      },
    ],
  ]
}
```

---

## 9. Fact Establishment

### 9.1 Incremental, Not Bulk

When the superposition step reaches `settled`:

1. **Frame 0**: Congruence fact added to fact store:
   `addCongruenceFact(store, triSrc, triTgt, citation, statement, justification, atStep)`

2. **Frame +400ms**: First cascade fact (e.g., `BC = EF`)
3. **Frame +800ms**: Second cascade fact (e.g., `∠ABC = ∠DEF`)
4. **Frame +1200ms**: Third cascade fact (e.g., `∠ACB = ∠DFE`)

Each fact addition triggers:
- Proof panel update (fact row appears with slide-in animation)
- Brief highlight of corresponding geometry on canvas
- Audio cue (subtle chime, ascending pitch for each successive fact)

### 9.2 Replacing deriveConclusion

For propositions that use superposition, `deriveConclusion` is removed. Facts are
established by the superposition step itself. The step's `establishes` field defines
exactly which facts to add and in what order.

---

## 10. Drag Invariance After Superposition

### 10.1 Post-Completion Dragging

After the superposition step (and any remaining proof steps) complete, the kid can
drag given points. The existing drag replay system (`useDragGivenPoints` +
`replayConstruction`) already recomputes all facts on each frame.

The key addition: facts established by superposition must **also** be re-derived
during replay. This means the replay system needs to execute the superposition
step's fact establishment logic (checking that the congruence conditions still hold
with the new positions).

### 10.2 Visual Feedback During Drag

When dragging after a superposition:
- If the congruence conditions still hold: the proven equality marks stay visible
  (green checkmarks or colored arcs on equal angles/segments).
- If a condition breaks (kid drags a given point so that AB ≠ DE): the equality
  mark turns red, the congruence fact grays out, and dependent facts cascade to
  gray. This is dramatic and educational — "I broke the proof by changing what
  was given."

This connects to the existing `useDragTopologyTracking` system, which already
detects construction breakdowns and notifies the chat agent.

---

## 11. Edge Cases

### 11.1 Degenerate Triangles
If a triangle degenerates to a line (all three vertices collinear), the
superposition interaction should still work — the "cutout" is a line segment.
The flip axis is the line itself. This is unlikely in practice but should not crash.

### 11.2 Overlapping Triangles
If the source and target triangles already share vertices or overlap significantly
(e.g., in Prop 5 where the same triangle is compared to itself with swapped
vertices), the lift-and-drag sequence needs to clearly separate the cutout from the
underlying geometry. The dimming of source construction lines (§6.2) helps here.

### 11.3 Very Small or Very Large Triangles
Auto-fit the viewport before the superposition step begins if either triangle is
partially off-screen. Use the existing `computeAutoFit` system with bounds expanded
to include both triangles plus drag headroom.

### 11.4 Given Points on Cutout
If the source triangle includes given (draggable) points, those points should NOT
be draggable during the superposition interaction. The superposition phase locks
drag interaction until the step is settled.

---

## 12. Relationship to Existing Superposition Flash

The current `renderSuperpositionFlash.ts` is a passive 1.2-second animation that
fires after `deriveConclusion` dumps facts. It fills both triangles gold and pulses
vertex correspondence rings.

**After this work:**
- The passive flash may be retired entirely (the interactive superposition replaces
  its purpose).
- OR the passive flash fires as a brief celebratory coda after the interactive
  superposition settles, reinforcing the correspondence one more time. In this case,
  rename it to something like `renderSuperpositionCelebration` to distinguish it
  from the interactive system.

---

## 13. Implementation Sequence

### Step 1: State Machine & Phase Management
- Add `SuperpositionPhase` type to `types.ts`
- Add `superpositionPhaseRef` to `useToolPhaseManager` and `rafContext`
- Wire pointer events to superposition handler in `useToolInteraction`
- Block other tool interactions during superposition

### Step 2: Rendering — Lift & Drag
- Implement `renderSuperpositionInteraction` in a new render file
- Render cutout polygon with paper appearance, shadow, source ghost
- Render target glow
- Add to `renderFrame` layer sequence

### Step 3: Auto-Rotation & Snap
- Implement proximity-based rotation blending
- Implement snap detection and snap lerp animation
- Same-orientation case works end-to-end at this point

### Step 4: Orientation Detection & Mismatch
- Implement cross-product orientation check
- Implement mismatch wobble animation
- Render flip affordance

### Step 5: Flip Animation
- Implement `flipVertex` per-frame computation
- Implement back-face rendering
- Implement shadow intensification during flip
- Post-flip snap to target

### Step 6: Fact Establishment & Cascade
- Implement `ExpectedSuperposition` action type
- Wire settled state to incremental fact addition
- Implement cascade timing with proof panel updates
- Add `checkStep` validation for superposition steps

### Step 7: Tutorial Integration
- Add tutorial sub-step support for superposition phases
- Add speech/hints for each sub-step
- Handle conditional flip sub-step

### Step 8: Retrofit Prop 4
- Rewrite Prop 4 steps to use proof exploration sequence
- Replace `deriveConclusion` with interactive proof steps
- Verify end-to-end: construction → compass verify → angle overlay →
  superposition → cascade → drag invariance

---

## 14. Open Questions

1. **Rotation gesture on mobile?** Currently auto-rotation handles this. Should we
   also support a two-finger rotation gesture for kids who want to rotate manually?
   Probably not for v1 — adds complexity, and auto-rotation is more accessible.

2. **Sound design for the flip?** A satisfying "whoosh" or page-turn sound would
   reinforce the physicality. Need to source or synthesize appropriate audio.

3. **Back-face visual treatment?** Subtle difference (slightly different shade) vs.
   dramatic difference (visible paper grain, crosshatch). Needs playtesting. Start
   subtle; increase if kids don't notice the flip.

4. **Cascade timing?** 400ms between facts is a guess. May need to be slower for
   younger kids, faster for older ones. Consider making it proposition-configurable
   or adaptive.

5. **What happens if the kid drags the cutout to the wrong triangle?** (In
   propositions with multiple triangles on screen.) The snap zone should only
   activate near the correct target. Dragging elsewhere is free movement with no
   consequence.
