# Modular Columns — the AbacusLink interface

**Status:** design proposal. Nothing here ships yet. The mechanism is specified
and sized; the numbers below are analytical and need one coupon print to confirm
(see §9). The existing monolith is untouched and stays the default.

**Companion files**
- `apps/web/public/scad/abacus-link.scad` — the joint geometry + a printable
  two-piece test coupon. Geometry source of truth for the joint.
- `apps/web/src/components/create/abacus/abacus-link.ts` — the TS mirror of the
  joint's derived chain and its fit guards, same relationship `derived()` and
  `feetEffective()` have to `abacus.scad`.
- `master-model-spec.md` — the monolith this builds on. Read §1 (anatomy) and §4
  (locked vs proportional) first; this document assumes both.

---

## 0. The idea

One column = one printed module. Modules snap together; special left and right
end caps carry their half of the frame. An abacus becomes a **stack** instead of
a slab.

The product case writes itself: the abacus grows with the kid one place value at
a time, columns are swappable, and a specialty column is a thing you can make,
trade, or sell. Three consequences are less obvious and are worth as much:

1. **Single-extruder full colour.** Today a multicolour abacus needs an AMS and
   `abacus-plan.ts` quantizes every bead role onto ≤ 8 loaded spools. A stack of
   modules is N separate objects, so a colour change is a *plate* change, not a
   layer change. Anyone with a bone-stock printer can make a place-value-coloured
   abacus by printing four modules in blue, three in red, and so on. The whole
   filament-quantization apparatus becomes optional rather than load-bearing.
2. **Failure is cheap.** A failed 6-hour monolith is a 6-hour loss. A failed
   module is 25 minutes. This matters enormously for classrooms and print farms.
3. **A column is a complete product.** One module with four earth beads and one
   heaven bead is a legitimate toy on its own — and it's the natural free/sample
   SKU, the thing you hand a kid to see if the interface feels good.

And one real cost, stated up front: **the abacus grows ~14% wider and 3.5 mm
deeper** — 192.5 × 100.5 mm becomes 220.0 × 104.0 mm at 13 columns (§5).

---

## 1. What is actually hard

Split a slab into segments and you have replaced material with joints. Take each
load direction in turn, in the frame of the monolith (X = long axis / column
direction, Y = bead slide axis, Z = thickness):

| Load | Resisted by | Lever arm available at a seam | Verdict |
|---|---|---|---|
| **X separation** (pulling columns apart) | latch tension | — | easy, positive interlock |
| **M_z** — in-plane splay | X tension/compression couple | **100.5 mm** (front strip ↔ back strip) | trivially easy |
| **M_x** — torsion about the long axis | Z-shear couple | **~90 mm** (front strip ↔ back strip) | easy, given Z-shear capacity |
| **M_y** — sag about the long axis | X tension/compression couple | **8 mm** (`frame_h`) | **the whole problem** |

Everything except M_y has a lever arm an order of magnitude larger than the slab
is thick, because the abacus is 100 mm deep and only 8 mm tall. M_y is the one
direction where the joint's couple arm is the slab thickness, and that is the
entire structural design problem. The rest of this document is about M_y.

### Where the joint can even have features

A seam plane is 100.5 mm of Y, but the module is only *thick* in three places —
everywhere else the bead channels open through both faces and the seam is two
1.25 mm channel walls face to face. In outer coordinates at defaults:

```
Y   0.0 ─────── 13.0    STATION F   front strip   (border band + shelf)
   13.0 ─────── 61.5    earth channel — walls only
   61.5 ─────── 69.0    STATION B   the reckoning bar
   69.0 ─────── 87.5    heaven channel — walls only
   87.5 ────── 100.5    STATION K   back strip
```

**F, B and K are the only places a joint feature can reach into X.** They are
also, conveniently, spread across the full depth — 100 mm between F and K is a
huge torsional lever arm for free.

(Those coordinates are the monolith's, at `border_w` 5.25. Modular mode widens
the border and the two strips grow to 14.75 mm — see §5 for why it has to.)

---

## 2. The load case that sets the spec

Three things want stiffness, and only one of them is structural.

**(a) Sag between feet.** The monolith already concedes this: `feet_span = 110`
comes from capping mid-span deflection at 0.3 mm under a 25 N hand press. But
modular columns each carry their own feet, so **the unsupported run collapses
from 110 mm to one column pitch**. This load case gets *easier*, not harder. The
whole `feet_span` / intermediate-feet derivation in `abacus.scad` becomes dead
code in modular mode.

**(b) Handling.** Picked up by one end, waved, twisted. Nothing breaks, but a
stack that visibly droops or creaks reads as a toy that fell apart, and the
product story is the opposite of that.

**(c) Marker coplanarity — the real spec.** `arucoDetection.ts` finds four
corner markers and fits a **homography**, which assumes the four points are
coplanar. TL and BL live on the left end cap, TR and BR on the right. If the
stack twists, TL/BR rise while TR/BL fall, the planarity assumption breaks, and
the rectification skews — silently. Not noise: a *systematic* misread of column
positions.

Two useful facts fall out of thinking about it this way:

- **A uniform seam gap is free.** N identical gaps just make the marker rectangle
  slightly larger, and a homography maps the measured rectangle onto the model
  rectangle — a uniform scale error is absorbed exactly. What the CV cannot
  absorb is *non-uniform* gaps and *out-of-plane* warp.
- **The seams are a gift to the CV.** They are high-contrast lines at exactly
  known pitch, running the full depth. That is a free column-registration signal
  the monolith does not have.

So the spec is not "as stiff as the monolith." It is:

> **Keep the four marker centres coplanar under handling, and keep the top faces
> of adjacent modules flush and rattle-free.**

---

## 3. The key result: a *closed* joint is as stiff as the material it replaces

This is the observation the whole design hangs on, so here it is with numbers.

At a column centre the monolith's bending section is only the three solid
stations, `b = 13 + 7.5 + 13 = 33.5 mm` at `h = 8`:

```
I_column-centre = 33.5 · 8³ / 12  ≈  1.4 × 10³ mm⁴
```

At a **seam plane** the section is the full depth — stations *plus* the channel
walls, which are continuous there:

```
I_seam = 100.5 · 8³ / 12  ≈  4.3 × 10³ mm⁴
```

The seam is a *locally strong* station, three times the section of the weakest
part of the monolith. So the joint doesn't have to be clever; it has to be
**closed**. The rotational stiffness one pitch of monolith provides is

```
k_θ = E·I/p = 2000 MPa · 1429 mm⁴ / 13 mm ≈ 2.2 × 10⁵ N·mm/rad
```

A butt joint held in compression behaves as a bed of springs of contact modulus
κ over its face, giving `k_θ = κ · I_seam`, so matching the monolith needs

```
κ ≥ 2.2e5 / 4288 ≈ 51 N/mm³
```

Two pressed FDM faces have asperities on the order of 0.02 mm that close under a
few MPa — κ in the hundreds of N/mm³. **An order of magnitude of margin.** A
closed, preloaded butt joint is not a compromise; it is as stiff as the slab.

### Which means the problem is not stiffness. It is *gapping*.

A joint under moment M with axial preload P over face area A stays fully closed
while the bending stress at the extreme fibre stays under the preload stress:

```
M · c / I_seam  ≤  P / A        with c = 4, A = 804 mm²
⇒  M_gap = P · h/6 = 1.33 · P        [N·mm per N of preload]
```

Once it gaps, the joint becomes a hinge, and hinges in series are how a stack
turns into a chain. Suppose the latch retains with a residual clearance `c` —
the assembly play any snap fit needs to go together. The joint can hinge by

```
θ ≈ c / h
```

At a modest `c = 0.05 mm` and `h = 8`, that's 0.36° **per joint**. Cantilever a
13-column stack from one end and let all twelve joints hinge: the far end lands

```
Σ θ·(L − xᵢ)  =  0.00625 rad × 1170 mm  ≈  7.3 mm      [linkHingeDroop, pinned]
```

out of plane. Seven millimetres of droop from five hundredths of a millimetre of
latch slop, and that is with a *good* snap fit. This single number is why the
obvious design — puzzle tabs and a click — does not work, and it dictates
everything in §4:

> **The latch must not merely retain. It must drive the seam shut, and the
> assembled clearance must be zero regardless of the manufactured clearance.**

---

## 4. The joint: chevron for Z, cam latch for X

Two mechanisms, one job each, and — this is the constraint that kills most
designs — **both must print flat with no supports**, because the beads are
captive print-in-place and the build orientation is not negotiable.

That rules out a great deal. Any feature that reaches sideways in X has a
horizontal underside. Any Z undercut is an overhang. What *is* free is anything
prismatic in Z (vertical walls print perfectly) and anything whose faces stay
within 45° of vertical.

### 4a. Chevron — Z registration and Z shear

Each seam face carries a **two-tooth chevron** running along Y: an isosceles
ridge on one face, the matching groove on the other.

```
        ← X →                    tooth height  h_t = 4.0 mm   (frame_h / 2)
   ╱▔▔▔╲        z = 8            tooth depth   d_t = 1.6 mm
  ╱     ╲                        flank angle   arctan(1.6/2) = 38.7° from vertical
  ╲     ╱       z = 4            self-support limit is 45° → 6.3° of margin
   ╲___╱        z = 0
```

- **Printable.** Every flank is 38.7° off vertical, comfortably inside the
  self-supporting limit, in both the ridge and the groove.
- **Self-centring in Z.** You physically cannot assemble two modules with their
  top faces out of step — the teeth won't mesh. This is what guarantees marker
  coplanarity, and it does it by construction rather than by tolerance.
- **Locks Z shear.** Sliding 0.1 mm in Z requires the modules to separate by
  0.08 mm in X (`Δx = Δz · d_t / (h_t/2)`). With X locked, Z is locked. Torsion,
  which is Z-shear across the 100 mm F↔K span, is therefore carried by geometry,
  not friction.
- Lives at stations F, B, K only. A 1.6 mm ridge cannot sit on a 2.25 mm channel
  wall, and the wall regions are **relieved by 0.3 mm** so nothing there can hold
  the real contact pads off their seats. That relief is visible from above as a
  fine line down the middle of each web — which is exactly the right thing to
  look like, given the product is "these are separate columns."

### 4b. Cam latch — X preload and take-up

At stations F and K, a **cantilever flexure** rooted in the module's right face
reaches into a pocket in the neighbour's left face.

- The beam runs along **Y**, the hook protrudes in **X**, and every surface is
  vertical — prismatic in Z, therefore support-free by construction, and 8 mm
  tall, therefore very stiff about the axis that matters.
- The engaging face is **not perpendicular to X**. It is a ramp at **α = 8°** to
  the flexure's travel direction. As the spring drives the hook in, the ramp
  pulls the two modules together in X.

That inclined face is the whole trick:

```
take-up   Δx  =  t · tan α       1.1 mm of barb travel → 0.155 mm of X take-up
force     Fx  =  Fn / tan α      7.4 N of spring → 52.8 N of clamp per station
self-lock     tan 8° = 0.141  <  μ_PLA ≈ 0.3   (friction angle 16.7°)
```

- **Assembled clearance is zero, by construction.** The flexure keeps advancing
  until the chevron flanks bottom out. Manufacturing spread is consumed by
  flexure travel, not by joint slop — 0.155 mm of it, against the ±0.1 mm a
  well-tuned FDM printer varies by. This is the fix for the 7.3 mm droop.
- **The preload is the SEATED force, not the full-travel force.** What a seam
  holds depends on how far the barb still had to go when the chevron bottomed —
  nominally half the barb height. Quoting full travel would overstate the
  preload by exactly 2×, which is the sort of error that survives all the way to
  a part that feels loose in the hand. `linkMechanics()` reports both, and the
  full-travel figure is labelled as what it actually is: the insertion peak, and
  the deflection the tongue's fibre stress has to be checked at (41 MPa, against
  PLA's ~55 MPa yield, and transient).
- **Self-locking.** At 8° the joint cannot be driven open by load; it can only be
  released by pushing the flexure back. Under overload the load path becomes
  bearing on the wedge face (~6 × 5 mm of PLA at 40 MPa ≈ 1200 N), so the joint
  gets stronger rather than hinging.
- **Creep-compensating.** PLA under sustained preload creeps, and a bolted joint
  would slowly loosen. A *spring-driven wedge* does the opposite: as the material
  relaxes, the flexure advances the wedge and the clamp is maintained. The one
  mechanism that would otherwise be the long-term risk is the one that answers it.
- **Deliberate release.** The flexure's free end continues to a **button on the
  outer wall** — front wall at station F, back wall at station K. Squeeze both,
  and the column releases. Two-handed, impossible by accident, obvious once shown.

### 4c. Station B — passive key

Mid-depth, unreachable from outside, so no latch and no button. Station B gets
the chevron and a close-fitting alignment tongue only. It contributes Z-shear
capacity and compression-side bearing, and it braces the free ends of the two
channel walls. F and K do all the retaining.

**One tongue per station, not two.** Doubling up would double the clamp, but the
release poke has to reach a tongue from an outer wall, and the second tongue's
shoulder is exactly the material the second bore would have to drill through. A
seam gets its two tongues by having two *stations* instead — front strip
released from the front wall, back strip from the back wall. Which is also what
makes release two-handed, and two-handed is what makes it impossible by accident.

### 4d. Preload budget

`M_gap = P · h/6` from §3, at the shipped geometry (13 columns, 15 mm pitch,
L = 195 mm, ~130 g). Clamp per seam is **105.7 N**, so `M_gap` = **141 N·mm**:

| Case | M at worst joint | P needed | |
|---|---|---|---|
| 25 N press, foot under every column | 94 N·mm | 70 N | **closed** |
| Carried by one end, static | 125 N·mm | 94 N | **closed** |
| 25 N press, feet every 3rd column | 281 N·mm | 211 N | opens onto the wedge |
| Carried by one end, shaken at 3 g | 374 N·mm | 281 N | opens onto the wedge |
| Deliberate two-handed bend, 50 N mid-span | 2438 N·mm | 1828 N | opens onto the wedge |

So preload buys the two cases the abacus actually lives in — sitting on a table
being used, and being carried — and those are the ones where "as stiff as the
slab" has to be literally true. **Everything past that is not a failure, it is a
different regime:** the joint opens onto the self-locking wedge face and carries
the rest in bearing (≈ 1200 N of PLA in shear before anything breaks). It gets
softer, it does not come apart, and because the cam re-seats on release, it does
not stay bent. That is the correct behaviour for a thing a child will lean on.

The ramp is the knob that trades the two halves of this against each other, and
all three rungs of the coupon sweep are legal geometries:

| `link_ramp` | take-up | clamp / seam |
|---|---|---|
| 8° *(default)* | 0.155 mm | 106 N |
| 12° | 0.234 mm | 70 N |
| 16° | 0.315 mm | 52 N |

More take-up means more printer spread swallowed; less clamp means a lower
threshold before the wedge takes over. Which end of that is right is a question
about real printers, which is why it is a sweep and not a decision.

---

## 5. What it costs: the web bump

The seam splits the web between channels down its middle, so each module carries
a 1.25 mm half-wall where the monolith had a continuous 2.5 mm one. That is too
thin: the earth channel's wall spans 48.5 mm unsupported between stations F and
B, and at 1.25 mm its lateral stiffness is

```
k = 192·E·I/L³ = 192 · 2000 · (8·1.25³/12) / 48.5³  ≈  4.4 N/mm
```

— a 1 N sideways push on a bead bows the wall a quarter of a millimetre. Beads
would feel loose and columns would rub.

**Modular mode raises `web` from 2.5 to 4.5**, giving each module a 2.25 mm
half-wall:

```
k = 192 · 2000 · (8·2.25³/12) / 48.5³  ≈  25.5 N/mm     per wall
```

and, because two walls now flank each channel where the monolith had one:

```
2 · 2.25³ = 22.8    vs.    2.5³ = 15.6        →  1.46× stiffer than the monolith
```

The channel walls end up **stiffer than the monolith's**, not weaker. The price
is pitch:

```
col_pitch   13.0 → 15.0 mm
13 columns  192.5 → 220.0 mm outer width      (+14.3%)
            (field_w = 2·13.0 + 12·15.0 = 206, plus 2 × the widened border)
```

That is the honest cost of modularity and it is the main thing to weigh. Note it
gets cheaper as the abacus gets bigger: `web` scales with `S` while the printable
wall minimum does not, so **modular mode has a size floor** — below roughly
`S = 0.8` the half-wall stops being printable. That degradation has precedent in
this model: `feet_crossbar` already falls back to a dovetail below `S ≈ 0.725`
rather than refusing to render.

### Foot pockets, and the second thing this costs

Each module gets its own foot pockets at stations F and K, on the bottom face.
Writing the collision guard as a real box-disjoint test rather than a one-axis
check (`linkFit` → `foot-hits-slot`) immediately turned up something the
eyeball missed: **the foot and the latch cannot share the strip on X.** The slot
runs from the seam out to x = 8.2 of a 15 mm pitch, leaving 6.8 mm of clear
width — less than even the smallest `BUMPER_PRESETS` entry needs with walls.

So they are separated on **Y** instead: outer wall, then the latch, then the
foot inboard of it. That does not fit in the monolith's 13 mm strip either, so
modular mode also raises **`border_w` 5.25 → 7.0**, giving a 14.75 mm strip:

```
outer depth   100.5 → 104.0 mm      (+3.5)
foot preset   capped at 1/4" (6.35 mm) — the largest that clears the slot
```

The widened border is not pure cost: it also widens the ArUco tile shelf and
adds bending material exactly where §1 says all the bending material is.

The existing `feetFit()` guard needs a modular variant that measures against the
module rather than the frame; `linkFit()` is that guard for the joint's half.

Two consequences:
- Every column standing on its own rubber feet is what collapses load case (a) —
  and over-constraint is a non-issue because rubber bumpers are compliant, so 26
  feet self-level rather than rock.
- 26 bumpers is a lot to peel and stick. The pocket should be an **affordance on
  every module, not an obligation** — stick them on the ends and every third
  column and the abacus is still flat and still quiet. Note from §4d that this
  is exactly the configuration that drops out of the fully-closed regime under a
  hand press, so "feet everywhere" and "as stiff as the slab" are the same
  choice. Worth saying so in the studio rather than leaving it to be discovered.

---

## 6. What modularity does *not* touch

Worth stating loudly, because it's the main derisking argument:

**The captive-track geometry is untouched.** A bead channel never crosses a seam.
Each module owns its complete channel with full-thickness walls on both sides, so
the spool profile, the waist capture, the `clearance` spine, and the constant-
clearance proof in `master-model-spec.md` §5 all carry over verbatim. Capture is
intra-module.

This is also why the seam goes down the **middle** of the web rather than along a
channel wall. The alternative — each module owning one full web and borrowing its
neighbour's — keeps the 13 mm pitch and needs no web bump, but a lone module
would have an open-sided channel and its beads would fall out. That kills both
"a column is a complete product" and safe shipping, and it makes bead retention
depend on assembly tolerance. Not worth 26 mm of width.

---

## 7. Architecture

The interface, not the parts, is the product. Name it **AbacusLink** and version
it, because a secondhand market for specialty columns is a compatibility promise.

### The interface contract

Frozen by the interface (a specialty column may not vary these):
- column pitch, frame height, outer depth
- the Y layout — shelf, earth channel span, bar position, heaven channel span
- the chevron profile, the latch geometry, the foot pocket positions
- the top-face plane

Free (this is where a specialty column lives):
- everything inside the channel: bead count within the envelope, bead colours,
  bead shape, markings, a decimal-point column, a blank spacer, a counting frame,
  a column that isn't an abacus column at all

**Open question, and it's the big one:** the Y layout is derived from the bead
stack (`s_fd` falls out of `earth`, `throw`, `bar`). Freezing it means a 5-earth
column or a 2-heaven suanpan column can never be link-compatible unless the
envelope is generous from day one. See §8.

### Code changes

Additive throughout. The monolith stays the default and stays byte-stable.

- **`Params`** gains `link_mode: 'mono' | 'modular'` and `web_modular: 4.5`.
  `derived()` and the scad both take `web_eff = link_mode == 'modular' ?
  max(web, web_modular) : web`. One knob, mirrored the way `feet_*` already is.
- **New part passes.** `only="column"` with `-Dcolumn_index=i`, plus
  `only="end_left"` / `only="end_right"`. These slot straight into the existing
  `ExportPass` / `INSPECT_PARTS` vocabulary and are pinned by
  `export-defines.test.ts` like every other pass.
- **`abacus-link.ts`** — the derived chain for the joint plus `linkFit()`, the
  mirror of the scad's asserts, exactly as `feetEffective()` / `feetFit()` mirror
  the foot asserts today. This is what lets the inspector refuse a bad
  combination *before* an export and name the knob that fixes it.
- **`abacus-3mf-assembly.ts` — the one genuinely disruptive change.** That module
  exists to weld everything into *one* object so OrcaSlicer's auto-arrange can't
  scatter the captive beads. Modular needs **N objects, each internally welded**
  (a module plus its own beads plus its own markers), which puts arrange back on
  the table for object *placement*. The saving grace: 13 modules at 15 × 101 mm
  tile to 195 × 101 mm, so a full abacus still fits one 256 mm plate. The
  existing project-file trick (`Metadata/project_settings.config` ⇒
  `need_arrange=0`) still applies; the transform now has to be computed per
  object instead of once.
- **`abacus-plan.ts`** is unaffected in v1 and gets *less* load-bearing over
  time: per-module colour makes AMS quantization optional rather than required.
- **`intentOf` / the paper lane** are entirely unaffected. Column count is column
  count.
- **Snapshot schema.** `link_mode` is one additive key; the existing parser drops
  unknowns, so old designs load as `mono`. **Per-column identity is not needed
  for v1** — a modular abacus where every module is identical except its colour
  needs no schema change at all. Swappable *specialty* columns eventually want
  `AbacusDesign.columns: ColumnSpec[]` instead of a scalar `cols`, and that is a
  real migration. Deliberately deferred.

---

## 8. Decisions I need from you

1. **Size classes vs. continuous scale — the consequential one.** A secondhand
   market needs a *frozen* interface, and `scale_factor` is a continuum. My
   recommendation: modular mode offers a small number of named, frozen classes
   (say `LINK-15` at S = 1.0 and `LINK-22` at S ≈ 1.5) and refuses arbitrary
   scales; monolith keeps the continuous slider. Alternative is that every abacus
   is its own island, which forfeits most of the point.
2. **The size bump** (§5). Accept 220.0 × 104.0 mm for 13 columns, or trade some
   of it back by accepting a floppier channel wall / a smaller foot?
3. **Swapping a middle column requires sliding columns off one end.** I think
   that is fine and even good — place value grows *leftward*, so the common
   operation ("add a place value") only ever touches the left end cap. A
   lift-straight-out design is possible but gives up the chevron, and with it the
   Z registration that guarantees marker coplanarity. Confirm?
4. **Bead-envelope generosity** (§7). Freeze the Y layout at today's 4-earth /
   1-heaven soroban, or pad the envelope now so a 5-earth or 2-heaven suanpan
   column can be link-compatible later? Padding costs depth on every abacus ever
   printed; not padding closes the door permanently.
5. **Feet**: pocket on every module (my recommendation — affordance, not
   obligation), or only on the end caps plus every Nth column?

---

## 9. Validation, in order

Nothing here should be believed before the coupon prints. There is no headless
OpenSCAD in this repo, so **none of the geometry is CI-verifiable** — the `.scad`
has not been through an evaluator even once. What *is* verified is the arithmetic
in `abacus-link.ts` (21 tests), including both of the joint's silent failure
modes: relief that lets the flats bottom out before the chevron seats, and a foot
pocket overlapping the latch slot. Both of those render, slice, print and click
together while being wrong, which is why they are pinned in CI rather than left
to the scad's `assert()`.

0. **Render it.** `part="coupon"` through the studio's worker or desktop
   OpenSCAD, and confirm every `assert` passes and the mesh is manifold. This
   step has not been done.
1. **Coupon** (`abacus-link.scad`, `part="coupon"`) — two half-modules carrying
   one full interface. Print, then measure: seam gap (target **0.00 mm** at the
   chevron flanks, ~0.12 mm at the relieved flats — the whole point of the cam),
   Z step across the seam (target < 0.05 mm), insertion force (predicted ~15 N
   peak), release force, and retention force to failure. Sweep `link_ramp` over
   8° / 12° / 16° and `link_fit` over three values on one plate — all three ramp
   rungs are legal geometries, so the sweep is a define change and nothing else.
2. **Cycle life** — 100 insert/release cycles on one coupon, re-measure seam gap.
   The flexure root is the fatigue site.
3. **Creep** — leave a coupon clamped for a week at room temperature and
   re-measure. The prediction in §4b is that the seam gap stays 0.00 because the
   flexure takes up the relaxation. If it doesn't, the material choice changes
   (PETG / PLA+) before the design does.
4. **Five-column stack + two end caps** — cantilever droop from one end, twist
   under a hand couple, and marker coplanarity measured through the *real*
   `arucoDetection.ts` pipeline against a monolith of the same column count. That
   comparison is the acceptance test.
5. Only then integrate into `abacus.scad`.
