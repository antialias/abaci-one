# Euclid Interactive — Pedagogy & Design Notes

## Design Inspiration: Byrne's Euclid (1847)

Oliver Byrne's edition replaces letter-based references (line AB, angle BAC) with
color-coded geometric elements inline with the proof text. The four primary colors
(red, blue, yellow, black) are assigned to different lines, angles, and shapes so
that the reader can track corresponding elements between diagram and proof without
any letter-labeling overhead.

### What makes Byrne's approach effective:
1. **Externalizes cognitive load** — colors do the work of mapping proof text to diagram
2. **Multiple representations reinforce each other** — visual + symbolic + verbal
3. **Eliminates "which line is AB?" friction** — the biggest barrier for beginners
4. **Beautiful** — the strong geometric aesthetic creates intrinsic motivation

### How to adapt for interactive:
- Use a Byrne-inspired color palette (saturated primaries + black)
- Color-code geometric elements consistently within each proposition
- Proof text uses inline colored shapes/icons that match the diagram
- When the user hovers proof text, the corresponding element highlights in the diagram
- When the user taps a diagram element, the proof text that references it highlights
- During constructions, newly created elements get their color assignment as they appear

## Pedagogical Approach

### Core Principle: Construction Before Theorem

Euclid himself structures Book I this way — you learn to BUILD things before you
learn to PROVE things about them. Our interactive should honor this:

1. **Construction propositions** = the student performs the construction
   - Virtual compass and straightedge tools
   - Each step is validated (did you draw the right circle? did you connect the right points?)
   - The construction "materializes" as the student completes it
   - Color-coded as new elements appear

2. **Theorem propositions** = the student explores and then follows the proof
   - Manipulable diagrams (drag vertices, watch properties hold)
   - Step-by-step proof walkthrough with diagram highlighting
   - Each proof step references its dependency (clickable link to that proposition)

### Progression Design

The 48 propositions form a natural curriculum. The dependency graph gives us a
partial order — the student must complete prerequisites before advancing. But
there's flexibility in the order of independent propositions.

**Suggested progression tracks:**

Track A — "The Constructor" (construction-focused):
I.1 -> I.2 -> I.3 -> I.9 -> I.10 -> I.11 -> I.12 -> I.22 -> I.23 -> I.31 -> I.42 -> I.44 -> I.45 -> I.46

Track B — "The Prover" (theorem-focused):
I.4 -> I.5 -> I.6 -> I.7 -> I.8 -> I.15 -> I.16 -> I.26 -> I.27 -> I.29 -> I.32 -> I.34 -> I.47 -> I.48

Track C — "The Full Journey" (all 48 in topological order):
I.1 -> I.2 -> I.3 -> I.4 -> I.5 -> I.6 -> I.7 -> I.8 -> I.9 -> I.10 -> I.11 -> I.12 ->
I.13 -> I.14 -> I.15 -> I.16 -> I.17 -> I.18 -> I.19 -> I.20 -> I.21 -> I.22 -> I.23 ->
I.24 -> I.25 -> I.26 -> I.27 -> I.28 -> I.29 -> I.30 -> I.31 -> I.32 -> I.33 -> I.34 ->
I.35 -> I.36 -> I.37 -> I.38 -> I.39 -> I.40 -> I.41 -> I.42 -> I.43 -> I.44 -> I.45 ->
I.46 -> I.47 -> I.48

### Key Pedagogical Moments

**I.1 — The First Construction**
This is the onboarding moment. The student learns to use the compass and straightedge.
Draw circle centered at A through B. Draw circle centered at B through A. Mark intersection C.
Draw lines CA and CB. An equilateral triangle appears. Magic.

**I.4 — SAS Congruence (Superposition)**
Controversial! Euclid "places one triangle on the other." We can make this interactive
by literally animating one triangle sliding and rotating onto the other. This makes
superposition intuitive rather than hand-wavy.

**I.5 — Pons Asinorum**
"The Bridge of Asses" — historically where weak students got stuck. Our interactive
should make this accessible. The proof involves extending the equal sides and creating
auxiliary triangles. Color-coding is critical here to keep track of which triangles are
being compared.

**I.29 — The Parallel Postulate Enters**
This is a huge conceptual moment. We should call it out: "Up to now, everything we've
proved works in ANY geometry — Euclidean, hyperbolic, or elliptic. But from this point
forward, we're using the parallel postulate, and we're in Euclid's flat geometry only."
Maybe offer a toggle to show what happens in hyperbolic geometry?

**I.32 — Angle Sum = 180 Degrees**
Let the student drag any vertex of a triangle and watch the three angles always sum to
180. Then walk through the proof with the parallel line construction.

**I.47 — The Pythagorean Theorem**
THE climax. The proof is geometric and visual — squares literally constructed on each
side, perpendicular dropped, rectangles shown equal to squares. Byrne's visual approach
is especially powerful here. The student should FEEL why it's true, not just see symbols.

**I.48 — The Converse**
A satisfying ending. Construct a right triangle with the same legs, apply I.47, use SSS.
The circle is complete.

## Interactive Mechanics

### Virtual Tools

**Straightedge:**
- Click two points (or a point and a direction) to draw a line/segment
- Can extend existing lines (Post.2)
- Lines are infinite conceptually but rendered to viewport edge (like the ruler laser beams)

**Compass:**
- Click center point, click radius point -> draws circle
- "Collapsing compass" by default (matches Euclid's Post.3)
- After I.3 is completed, optionally unlock "rigid compass" as a convenience

**Point Marking:**
- Tap intersection of two elements to mark a point
- Intersections glow/pulse when available
- Points get auto-labeled (A, B, C, ...) in construction order

### Validation System

For construction propositions, the system needs to validate each step:
- "Draw a circle centered at A through B" — check: is there a circle with center A, radius AB?
- "Join C and A" — check: is there a line segment from C to A?
- The system should be tolerant of order variations (there are often multiple valid orderings)
- Each step highlights what the student should do next (with optional hints)
- When all steps complete, the construction "solidifies" with Byrne-style coloring

### Proof Walkthrough System

For theorem propositions:
- The diagram is pre-constructed (or the student constructs it first)
- Proof text appears step by step
- Each step highlights the relevant diagram elements
- Dependencies are clickable ("by I.4" links to that proposition)
- The student can tap "why?" on any step to see the referenced proposition
- "Given" elements are one color, "constructed" elements another, "conclusion" a third

## Color Palette (Byrne-Inspired)

Based on Byrne's original but adjusted for accessibility and screen rendering:

```
Primary geometric elements:
- Red:    #E15759  (lines, segments)
- Blue:   #4E79A7  (lines, segments)
- Yellow: #F0C75E  (areas, angles)
- Black:  #1A1A2E  (given lines, text)

Secondary / UI:
- Orange: #F28E2B  (angle arcs)
- Green:  #59A14F  (equal marks, tick marks)
- Gray:   #9C9C9C  (construction lines, guidelines)
- White:  #FAFAF0  (background — warm, paper-like)

States:
- Glow/highlight: element + opacity pulse
- Hover: slight size increase + brighter saturation
- Selected: thick outline + Byrne color assignment
```

## Technical Considerations

### Geometric Engine Requirements

The interactive needs a geometry engine that can:
1. Represent points, lines (infinite), segments, rays, circles
2. Compute intersections (line-line, line-circle, circle-circle)
3. Track construction dependencies (point C exists because circles A and B intersect)
4. Validate geometric relationships (is this angle right? are these lines parallel?)
5. Support dragging with constraint propagation

`@flatten-js/core` (already in dependencies) handles items 1-2 well.
Items 3-5 need custom logic.

### Construction State Model

```typescript
type GeometricObject =
  | { type: 'point'; id: string; label: string; x: number; y: number; constructedBy: ConstructionStep }
  | { type: 'line'; id: string; through: [string, string]; constructedBy: ConstructionStep }
  | { type: 'segment'; id: string; endpoints: [string, string]; constructedBy: ConstructionStep }
  | { type: 'circle'; id: string; center: string; radiusPoint: string; constructedBy: ConstructionStep }
  | { type: 'arc'; id: string; center: string; from: string; to: string; constructedBy: ConstructionStep }

type ConstructionStep =
  | { tool: 'given'; description: string }
  | { tool: 'straightedge'; action: 'join' | 'extend'; points: string[] }
  | { tool: 'compass'; center: string; radiusPoint: string }
  | { tool: 'intersection'; of: [string, string]; which: 'first' | 'second' | 'only' }
  | { tool: 'derived'; from: string; operation: 'bisect' | 'perpendicular' | 'parallel' }

type Construction = {
  objects: GeometricObject[]
  steps: ConstructionStep[]
  currentStep: number
}
```

### Proposition Data Model

```typescript
type PropositionType = 'construction' | 'theorem'

type Proposition = {
  id: number                           // 1-48
  type: PropositionType
  title: string                        // "Construct an equilateral triangle on a given line"
  statement: string                    // Full Euclid statement
  dependencies: {
    propositions: number[]             // e.g., [3, 4] for Prop 5
    postulates: number[]               // e.g., [1, 2]
    commonNotions: number[]            // e.g., [1, 3]
    definitions: number[]              // e.g., [20]
  }
  givenElements: GeometricObject[]     // Starting configuration
  constructionSteps?: ConstructionStep[] // For construction propositions
  proofSteps: ProofStep[]              // Proof walkthrough
  byrnePalette: Record<string, string> // Element ID -> color assignment
}

type ProofStep = {
  text: string                         // Proof text with element references
  highlightElements: string[]          // Element IDs to highlight
  justification: {
    type: 'proposition' | 'postulate' | 'commonNotion' | 'definition' | 'hypothesis'
    id: number
  }
}
```

## Future Extensions

### Beyond Book I
Books II-IV are natural continuations:
- Book II: Geometric algebra (completing the square, etc.)
- Book III: Circle theory (tangents, inscribed angles)
- Book IV: Regular polygon constructions (pentagon, hexagon, 15-gon)

### Non-Euclidean Toggle
Since Props 1-28 hold in absolute geometry, we could offer:
- A "hyperbolic mode" using the Poincare disk model
- Show how the same constructions look different
- Dramatically illustrate what the parallel postulate actually does
- I.32 fails spectacularly in hyperbolic geometry — angle sum < 180

### Connection to Coordinate Plane Toy
"The triangle you just constructed in Euclid? Here's what it looks like in
Cartesian coordinates." Bridge between synthetic and analytic geometry.

### Proof Authoring
Advanced mode: the student writes their own proofs by selecting which
proposition/postulate/CN justifies each step. The system validates the logic chain.
