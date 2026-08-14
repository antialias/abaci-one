# scad verification harness

Local-only tools for verifying `public/scad/abacus.scad` geometry. **No headless
OpenSCAD exists in CI** — every geometry change is verified on a dev machine with
the `openscad` CLI (2021.01 on PATH; the app bundle is `OpenSCAD-2021.01.app`,
not `OpenSCAD.app`) and the checks below. The TS test suite pins *arithmetic*
mirrors of the geometry (see `src/components/create/abacus/__tests__/`); these
scripts are the only thing that evaluates the actual solids.

Referenced from the model spec: [`docs/abacus-studio/master-model-spec.md`](../../docs/abacus-studio/master-model-spec.md).

## signed-volume.mjs

Signed STL volume via the divergence theorem — the one inversion-proof metric
(a miswound region *subtracts*, so it can't hide). Three modes:

```bash
# volume of one part
node scripts/scad/signed-volume.mjs coupon.stl

# seam disjointness: a pair rendered seated must be exactly 2× one module —
# any volumetric interpenetration at the seam shows as a deficit
node scripts/scad/signed-volume.mjs coupon.stl pair.stl

# additivity: whole == sum of parts (e.g. module body + TPU feet must not overlap)
node scripts/scad/signed-volume.mjs union.stl body.stl feet.stl

# fingerprint: same solid across two renders (volume + area at 1e-9 rel) —
# THE mono-drift check; see "Mono render stability" below for why not sha256
node scripts/scad/signed-volume.mjs --same mono-before.stl mono-after.stl
```

Exits non-zero on failure, so it can gate a pipeline. Sensitivity is proven:
at `joint_fit = −0.05` (deliberate interference) the pair check detects a
~17 mm³ deficit; at the shipped fit the rel diff is ~1e-7.

## insertion-sweep.mjs

Rigid-path proof for the rear-entry graduated sliding rail: render one
`module_mid` STL, then import it twice at 181 relative-Y offsets and require
zero positive-volume intersection at every one of them — everywhere except the
one place the seam is *designed* to interfere (the detent, below).

```bash
openscad -Dseam_mode='"modular"' -Djoint_type='"sliding_dovetail"' \
  -Djoint_fit=0.10 -Donly='"module_mid"' \
  -o /tmp/slide-mid-010.stl public/scad/abacus.scad
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-010.stl

# a bounded diagnosis, and any non-default render (pitch = sc_w)
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-010.stl \
  --offsets 0,0.5,1 --pitch 17.5
```

The sliding module pitch is **17.5** at stock scale, not the vertical-snap
15.5: each sliding seam edge carries `slide_edge_allow` on top of its web.
Sweeping at the wrong pitch measures nothing, so `--pitch` exists — and the
sweep's own threshold stays at 1e-6 mm³, because seated modules touch on
coincident planes only, which contributes no volume.

What the sweep confirms is that female cross-sections are NESTED toward the
mouth, not merely deeper in X: every station a section passes contains its
whole XZ profile. That includes the deep anchor berth, whose flanks are the
same 14° lines as the shallow runway's until they clamp flat at the berth
floor — outside the reach of any section that sweeps through it.

Every graduation on the rail is a ramp, and each is ramped by whichever side
has the room. On the female, `slide_lead_out` ramps the relieved runway down
onto the next berth's front profile (`slide_funnel` already did this at a
berth's rear; without the lead-out the runway — cut `slide_relief` deeper — butted
the berth's pinched front and left a `slide_relief + slide_pinch` ledge facing
the incoming rail). On the male, `slide_anchor_lead` is the B→anchor
graduation: the jump from a 2 mm rail to a 9 mm one is the largest single face
on the part, and running the existing 45° inset break out to 1.5 mm trades
about half of that face for a ramp. Both are free of travel cost — only a
smaller section is ever at those stations — and the sweep is what says so.

The one graduation that CANNOT be ramped further is the female shallow→deep
taper at `slide_taper0`: it has to gain 6.8 mm of depth in the 3 mm between the
back strip's start (`sc_k0`, where the bead-channel webs end and a 9 mm cut
first becomes legal) and the anchor berth's front. Its ~66° face is the front
wall of the anchor pocket, and it is load-bearing on the layout, not a defect.

### The detent (the one designed interference)

The seam carries a snap detent: a wedge on the floor of the female MIDDLE BERTH
that drops into a notch in the male rail's middle (B) section, at the mid-length
of the track. It is an elastic interference, so a rigid sweep would report it as
a collision — the script instead derives the ridge's own bounding box from the
scad's knobs (`--fit` picks the render's compensation; the crest station comes
from the mesh's own Y span, because `slide_detent_yc` lands on `outer_d / 2`
exactly), accounts every triangle inside it separately, and checks it as a
*deflection*:

- the seated pair (r = 0) must be empty inside the box — the notch receives the
  ridge, or the seam does not close;
- peak deflection must equal `slide_detent`, and peak volume the wedge's own —
  the tongue is never asked for more than the engagement;
- the ride must start no earlier than the TONGUE'S TIP reaching the ridge's rear
  toe, and full deflection no earlier than the tip reaching the crest. On the
  front-berth version those bounds were the rail nose's and they held for free
  (rear entry means a female feature at Y is met only by male sections seated at
  or ahead of it). Mid-track that exclusivity is gone — A and B both sweep the
  crest station — so these two bounds are now *measurements of the relief
  channel*, and they are the only thing that proves it works.

The crest sits at the berth's mid-length rather than out on the runway, so the
floor under it is flat and known and the proud height is `joint_fit +
slide_detent` — a constant, not something that rides `slide_relief`.

**The relief channel** is what buys back the exclusivity: `slide_ch_*` cuts a
shallow groove down the CENTRE of the rail's TIP FACE, from the nose to the
tongue's tip, clearing the ridge by `slide_ch_clear` per side in Z and
`slide_ch_air` under the crest. Every section ahead of the tongue runs past the
ridge on air; contact begins only when the ridge reaches the tongue, ~2.7 mm
before seat. It is a tip-face feature only — the 14° flanks, which are what
actually grip, are never cut — so the small section keeps its full undercut.

The spring is not a printed finger, and it is not the female: `slide_spring_slot`
is an L-shaped Z-through slot behind the male rail, so the B key plus the
`slide_leaf_t` of seam skin behind it become one cantilever tongue — rooted at
the blind end on the solid bar strip (`slide_spring_y1` lands on `sc_b0`), free
at the short leg that cuts out through the seam face at `slide_spring_y0`. Both
ends are inside the module, ~48 mm from either face, which is the point: the
earlier front-corner version put the tongue's free end at the module's front
corner, where a thumb could reach it and snap it off.

**The retraction limit — the gate this harness is structurally blind to.**
`slide_groove_profile` builds the female by translating the male profile
`joint_fit` in +X, so the rail can back out of its groove exactly `joint_fit`
before its own 14° flanks bottom on the groove's, and the tongue cannot deflect
further than the rail it carries can retract. A sweep measures the ridge's
*volume*, not whether the rail has anywhere to go, so it will happily pass a
design whose flanks wedge solid. That gate lives in the scad
(`slide_tip_defl <= slide_retract_room`) and in `seamFit`'s `detent_retract`
verdict. Two things it accounts for that are easy to miss: peak deflection is the
free TIP's, not the notch's (past its load a cantilever is straight, so the tip
overswings by `1.5·b/a`), and the room is bought by `slide_detent_relief`, which
opens the middle berth's NECK — not its floor, not its angle — over the run the
deflected tongue occupies.

The strain gate on the cantilever is a scad assert too (see the detent cluster),
so a knob change that would over-strain it aborts the render rather than
printing. What that gate does **not** model: it assumes a rigid root. The seam
wall the tongue grows out of rotates under the same moment, which makes the real
spring roughly 14% softer than the assert's number — the conservative direction
for strain and for the 15 N push gate alike. It also ignores the slot's rounded
blind end, which spreads the root over a few millimetres instead of a plane.
Nothing in this harness measures the real deflection; only a printed coupon does.

The rear mouth flare is symmetric now that the anchor lands on a berth floor:
it eases the floor and the ceiling as well as the two flanks, all four out of
the same lip budget.

Four independent negative controls. The first two MUST report overlap (otherwise
the sweep is blind and its pass means nothing):

```bash
# runway: sinks the female floors below the male rail depth. The berths — and
# so the detent — are untouched by slide_relief, so the shipped detent knobs
# stand and this control is purely about the runway.
openscad -Dseam_mode='"modular"' -Djoint_type='"sliding_dovetail"' \
  -Djoint_fit=0.10 -Dslide_relief=-0.3 -Donly='"module_mid"' \
  -o /tmp/slide-mid-neg-runway.stl public/scad/abacus.scad
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-neg-runway.stl --expect-overlap

# seated berths incl. the deep anchor: over-squeezes the seat pinch
openscad -Dseam_mode='"modular"' -Djoint_type='"sliding_dovetail"' \
  -Djoint_fit=0.10 -Dslide_pinch=0.35 -Donly='"module_mid"' \
  -o /tmp/slide-mid-neg-seat.stl public/scad/abacus.scad
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-neg-seat.stl --expect-overlap
```

The other two prove the relief channel is load-bearing — starve it and the
un-sprung sections start hitting the ridge tens of millimetres too early. These
land in the DETENT bucket, not the rigid one, so run them as a **plain sweep**:
`--expect-overlap` is the wrong harness and will report the run as a failure of
the wrong check. Each should fail with "the relief channel is not clearing it",
at a ride start ~47–48 against a bound of 2.97.

```bash
# crest clearance: the ridge now scrapes the channel floor
openscad -Dseam_mode='"modular"' -Djoint_type='"sliding_dovetail"' \
  -Djoint_fit=0.10 -Dslide_ch_air=-0.05 -Donly='"module_mid"' \
  -o /tmp/slide-mid-neg-chair.stl public/scad/abacus.scad
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-neg-chair.stl

# Z clearance: the channel is narrower than the ridge
openscad -Dseam_mode='"modular"' -Djoint_type='"sliding_dovetail"' \
  -Djoint_fit=0.10 -Dslide_ch_clear=-0.15 -Donly='"module_mid"' \
  -o /tmp/slide-mid-neg-chclear.stl public/scad/abacus.scad
node scripts/scad/insertion-sweep.mjs /tmp/slide-mid-neg-chclear.stl
```

`joint_fit` itself is assert-gated to the coupon values on module passes, so a
negative fit is not a usable control here.

**Additivity at large coordinates is quantization-limited.** OpenSCAD's ASCII
STL prints 6 significant digits, so x≈200 mm vertices carry ~0.001 mm of
quantization vs ~1e-5 mm near the origin. Measured 2026-08-04: the identical
`module_mid` renders 10868.450 mm³ at the origin but 10868.217 mm³ translated
to x=181 — a 0.233 mm³ shift from translation alone. A full 13-column modular
assembly (222.5 mm wide) therefore misses parts-sum additivity by ~1.6 mm³
(rel ~1e-5) even with perfectly disjoint seams. To prove seam cleanliness,
check pairs/small assemblies rendered near the origin (each seam type is
additive at ~1e-7; a cols=3 assembly at ~2e-7) — do not chase the whole-row
deficit, and do not loosen the 1e-6 threshold to make it "pass".

## The CLI is not the engine that ships — always overlap, never abut

**This harness renders with a different CSG engine than the app does.** The `openscad`
CLI here is 2021.01, CGAL only. `public/openscad/` is a 2025.03.25 WASM build and
`scad-worker.js` runs it with `--backend=Manifold`. Every guarantee below is a
CGAL guarantee; the geometry a user actually looks at is Manifold's.

The two disagree on **exactly abutting solids**. Two pieces of a `union()` that
share a face plane with zero overlap are welded by CGAL's Nef representation and
vanish; Manifold keeps the shared face. Inside a *void* — a pocket built as a
union and then subtracted — that surviving face is a coincident triangle pair
standing across the cavity: a wall of literally zero width, invisible to a slicer,
plainly visible in the viewer. This shipped once (2026-08-13): the shallow→deep
taper ended at `slide_taper0 + slide_funnel` and `slide_deep_zone` began at the
same station, and the studio drew a partition between the anchor berth and the
runway ahead of it. CGAL-rendered STLs of the same source were spotless.

So: **every piece of a pocket or a rail overlaps its neighbour by 0.01**, which is
why the `± 0.01` litter the seam modules. It is not decoration, and a junction
that "looks cleaner" without one is the bug.

To check, render through the shipped engine and audit the mesh — a closed,
manifold solid has no coincident pairs, no boundary edges and no flipped faces:

```js
// node: same loader insertion-sweep.mjs uses
const { default: OpenSCAD } = await import('public/openscad/openscad.js')
const inst = await OpenSCAD({ wasmBinary, noInitialRun: true })
inst.callMain(['/abacus.scad', '-o', '/out.stl', '--export-format=asciistl',
               '--backend=Manifold', '-Donly="module_mid"', /* … */])
```

then group the triangles by sorted-rounded vertex key (a key with two triangles
is a zero-width sheet) and by undirected edge (an edge with one triangle is a
boundary; with more than two, non-manifold). At the shipped knobs `module_mid`
scores 0/0/0 at every coupon fit, as does the assembled row.

Note also that Manifold emits **no degenerate triangles** where CGAL leaves
hundreds, so a sliver census on a CGAL export tells you nothing about the render.

## Render recipes (OpenSCAD 2021.01 quirks)

- STL: `openscad -Donly='"seam_coupon"' -o out.stl public/scad/abacus.scad`
  (ASCII output; `-o /dev/null` fails — the exporter needs a suffixed filename).
- PNG: needs `--render` (preview mode dies with "Normalized tree > 100000
  elements" and emits an empty image) and the **6-arg** eye/center camera form —
  the 7-arg form plus `--viewall` renders blank:
  `openscad --render -Donly='"seam_coupon"' --camera=55,25,35,15.5,65,4 --imgsize=1200,900 -o out.png …`
- The `textmetrics` warning is harmless (2021.01 predates it; the file falls back).
- **Assert gating needs STL export.** A failed top-level `assert` exits 1 on STL
  export but exits **0** on `.csg` export (which writes a 1-byte file) — so
  negative-control runs must export STL, and fast `.csg` eval runs must grep the
  log for `ERROR:` instead of trusting the exit code. An aborted render also
  leaves any existing `-o` file untouched, so a sweep run straight after one
  silently measures the PREVIOUS geometry: delete the target (or stop on a
  nonzero exit) before believing a control's verdict.
- Any top-level scad variable can be forced with `-D` for negative controls
  (e.g. `-Dsc_seat=5` to trip the bottom-seat assert at default scale).
- **Boolean ops on imported STLs crash CGAL** (`SNC_FM_decorator.h` assertion) —
  a z-slice wrapper that `import()`s an exported mesh does not work. For
  through-hole checks, render from source with an orthographic straight-down
  camera instead: `--projection=o --camera=cx,cy±0.01,-240,cx,cy,4` (the ±0.01
  dodges the degenerate up-vector; ortho zoom scales with eye distance).
- **Mono render stability — do NOT sha256 the STL.** OpenSCAD 2021.01's STL
  export is not byte-reproducible: two solo renders of the *identical* mono
  source produced different sha256s (measured 2026-08-04: four renders, four
  hashes; arc tessellation comes out phase-jittered run to run while volume,
  surface area, facet count and bbox all match exactly). After any scad change
  that should not affect the monolithic abacus, render the default (no
  `-Donly`) STL and run `signed-volume.mjs --same reference.stl new.stl`
  instead — a phase-shifted arc polygon is volume- and area-invariant, so the
  fingerprint passes across renders of the same solid and fails at ~1e-3 for
  any real edit.
