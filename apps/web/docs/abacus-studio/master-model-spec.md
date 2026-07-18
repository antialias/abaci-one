# Abacus Studio — Master Model Spec

*Reverse-engineered anatomy of the printable soroban, plus the locked-vs-proportional
dimension model that lets it scale without wobbling or seizing.*

This is the **Phase 0 (#6) deliverable**: the paper design the parametric model is
built on. It is not a historical record — it describes the model that ships today.

- **Source of truth (code):** [`src/components/create/abacus/abacus-model.ts`](../../src/components/create/abacus/abacus-model.ts)
  — framework-free `defaultParams` + `derived()`; the geometry itself is
  [`public/scad/abacus.scad`](../../public/scad/abacus.scad).
- **Empirical anchor:** the user's proven, printed master
  `~/projects/abacus/Soroban_Abacus.stl` — **186 × 90 × 6 mm**, **13 columns ×
  (1 heaven + 4 earth) = 65 beads**, rodless captive-track, 3-color. Everything
  below was reverse-engineered from it by connected-component bbox measurement +
  z-sweep cross-sections, then re-derived as parameters.
- **Epic:** Gitea #5. This doc closes #6's "reverse-engineered spec + dimension
  classification" deliverable.

> The in-app model is a **v3/v4 refinement** of the raw master, not a byte-clone:
> it adds a flush border band, adhesive feet, corner ArUco inlays, an auto-fit
> shelf, and a taller frame (`frame_h 8` vs the master slab's 6). The *invariants*
> — capture mechanism, column structure, bead geometry, and the mixed-scaling
> spine — are preserved. Default outer dimensions therefore differ slightly from
> the master (e.g. 192.5 mm wide vs 186); the master's **90 mm depth is reproduced
> exactly** by the derived chain at `scale_factor = 1`.

---

## 1. Anatomy

A soroban slab, printed **flat / face-up**, beads captured in tracks — **no rod,
no stick, no assembly**.

| Part | What it is |
|---|---|
| **Frame** | A slab (`frame_h` tall) wrapping the bead field in a flush border band (`border_w`), rounded corners (`corner_r`), a top chamfer. |
| **Columns** | `cols` Y-channels (default 13), each holding one vertical bead stack, spaced at the derived **column pitch**. |
| **Beads** | Per column: `1` heaven bead above the reckoning bar + `earth` (default 4) below it. `bead_dia` (X/Z) × `bead_len` (Y). Both counts are parametric so a suanpan 2+5 isn't boxed out later. |
| **Reckoning bar** | The solid divider between heaven and earth, `bar` wide. |
| **Shelf** | The solid margin inside the frame at each channel end (`shelf`); auto-grows so the band + shelf always holds a corner ArUco tile. |
| **ArUco corners** | Four flat ~0.6 mm inlays (IDs 0/1/2/3 at TL/TR/BR/BL) coplanar with the bead plane — the read-back fiducials (#12). |
| **Feet** | Adhesive-foot pockets on the bottom face, `feet_span` apart (anti-bend). Absolute — real feet don't scale. |

---

## 2. Capture mechanism — why it's rodless and print-in-place

Measured from the master frame's channel profile: each column is a **Y-channel =
the spool bead + clearance**, swept along Y. The bead is a **spool / dumbbell**:
a wide foot (dia ≈ `bead_dia`), a narrow **waist** (dia ≈ `bead_dia`/2) at
mid-height, and a wide belt above. The channel pinches to the waist width at
mid-height and opens back out above and below it.

So the bead's foot and belt **physically cannot pass the waist gap**: the bead is
**locked in Z** and only **slides in Y**. That single profile is the whole trick —
it's what makes the abacus captive *and* print-in-place *and* rod-free.

`clearance` is the gap between the bead and its track walls. It is the **locked
spine define** — an absolute value in millimeters that must not scale (see §4).
Too large → beads rattle; too small → beads fuse to the track during printing.

---

## 3. The intent-knob parameter surface

Every raw coordinate is **derived** from a small set of intent knobs — you never
place a wall or a bead center by hand. Defaults (from `defaultParams`):

| Knob | Default | Meaning |
|---|---:|---|
| `cols` | 13 | column count (clamped 3–21) |
| `earth` | 4 | earth beads per column |
| `web` | 2.5 mm | wall between adjacent channels (→ col pitch 13.0) |
| `throw` | 10 mm | slide distance of a bead group |
| `bar` | 7.5 mm | reckoning-bar clear width |
| `shelf` | 7.75 mm | solid margin inside the field at each channel end |
| `bead_dia` | 10 mm | bead diameter (X/Z) |
| `bead_len` | 8 mm | bead length along the slide axis (Y) |
| `bead_proud` | 4 mm | how far a bead stands above the frame face |
| `frame_h` | 8 mm | frame slab height |
| `border_w` | 5.25 mm | flush border band width |
| `corner_r` | 4 mm | corner radius |
| `top_chamfer` | 1 mm | top-edge chamfer |
| **`clearance`** | **0.25 mm** | **bead↔track gap — LOCKED, absolute** |
| **`print_gap`** | **2 mm** | **printed air between stacked beads — LOCKED, absolute** |
| `marker_mm` | 12 mm | ArUco tile size — LOCKED |
| `scale_factor` | 1.0 | overall print-size multiplier (the size knob) |
| `feet_span` | 110 mm | foot spacing — LOCKED, absolute |

`scale_factor` is a **fabrication choice** (how big to print), deliberately kept
separate from the on-screen zoom. `paramsFromDisplayConfig()` projects the user's
`AbacusDisplayConfig` (`physicalAbacusColumns → cols`, colors) onto these params
but **never** maps screen zoom onto `scale_factor`.

---

## 4. The locked vs proportional model — the load-bearing design

Author every dimension in **absolute mm** and multiply the *proportional* class by
`scale_factor` (`S`); never wrap the whole model in a uniform `scale()`. Two
classes:

### Locked — printer/physics constants, **do NOT scale with `S`**
These come from the printer and the physics of the joint, not the abacus's size:

| Locked dimension | Value | Why it can't scale |
|---|---:|---|
| `clearance` (bead↔track) | 0.25 mm | a bigger abacus doesn't want a looser joint; scaling it is what makes big ones rattle and small ones seize |
| `print_gap` (bead↔bead air) | 2 mm | the printer needs a fixed air gap to not fuse stacked beads |
| `top_chamfer` | 1 mm | a cosmetic/printability edge, size-independent |
| `marker_mm` (ArUco tile) | 12 mm | the camera + detector want a fixed fiducial size + quiet zone |
| `feet_span` / feet | 110 mm | real adhesive feet are a fixed physical part |

### Proportional — scale with `S`
`frame_h`, `border_w`, `corner_r`, `bead_dia`, `bead_len`, `web`, `throw`, `bar`,
`shelf`, and every margin. These make the abacus bigger or smaller.

### Where the locked floors come from — the printer profile (not a device)

The locked class is *checked against absolute-mm floors*, and those floors come
from a selectable **`PrinterProfile`**, **not from a connected printer**. Nozzle
diameter is printer *configuration*, not a design input; it's one field of a
profile that **defaults to a common-denominator FDM preset** (`fdm-0.4`: ~0.4 mm
nozzle / 0.2 mm layer). A design always solves **offline** against the default —
a printer never needs to be attached to manifest an STL. A connected printer
(Phase 2, #8/#9) only *enriches*: it auto-fills the nearest profile from the
capability doc and warns (non-blocking) at submit if the design doesn't suit that
specific device.

The default profile is defined to **reproduce today's baked `.scad` floors** — the
guards already in `abacus.scad` *are* an implicit 0.4 mm profile:

| Profile floor | Default (`fdm-0.4`) | Source in today's model |
|---|---:|---|
| min bead↔track clearance | 0.20 mm | `clearance` comment floor (`abacus.scad`); default `clearance 0.25` clears it |
| min channel wall | 1.20 mm | `assert(web·S ≥ 1.2)` |
| min structural feature | 2.00 mm | `assert(bar·S ≥ 2)` |
| min inlay depth | 0.60 mm | `inlay_d = 0.6` (3 layers @ 0.2 mm) |

Wider (`fdm-0.6`) and finer (`fdm-0.2`) presets raise/lower these floors together,
so the *same logical abacus* re-solves differently per profile (Fine prints
smaller before a wall collapses; Wide refuses the default 0.25 mm gap). The `#7`
solver is a pure `(params, profile) → verdict` function that **refuses below any
floor with a reason** (allowing contact, refusing only genuinely below-printable),
never emitting a seized model. Phase 0's job was to get the split right on paper
and prove it — done here and in the test (§5).

### The derived chain (knobs → coordinates)

`derived(p)` mirrors the `.scad`'s intent-knob chain exactly. The load-bearing
lines (with `cl = clearance`, `S = scale_factor`):

```
col pitch   sCp  = bead_dia·S + 2·cl + web·S      ← cl enters as a constant, unscaled
rest pitch  sEp  = bead_len·S + print_gap         ← print_gap enters unscaled
end margin  sEm  = shelf·S + cl + (bead_dia·S)/2
frame depth sFd  = … + bead_len·S/2 + cl + shelf·S
field width      = 2·sEm + (cols−1)·sCp
frame width      = fieldW + 2·border_w·S
```

Because `cl` and `print_gap` are **added, never multiplied by `S`**, the joint
tolerances stay fixed in absolute millimeters while the abacus grows.

---

## 5. Constant-clearance proof

The channel is `bead_dia + 2·clearance` wide, so the effective bead↔wall gap
recovers as `(sCp − web·S − bead_dia·S) / 2`. Substituting `sCp`:

```
(sCp − web·S − bead_dia·S)/2
  = (bead_dia·S + 2·cl + web·S − web·S − bead_dia·S)/2
  = (2·cl)/2  =  clearance    ← independent of S. QED.
```

Numerically, across five print sizes (computed from the shipped `derived()`):

| `scale_factor` | col pitch `sCp` | **channel clearance** | bead-air gap | frame width | outer depth |
|---:|---:|---:|---:|---:|---:|
| 0.6 | 8.00 | **0.250** | 2.00 | 128.5 | 73.5 |
| 1.0 | 13.00 | **0.250** | 2.00 | 192.5 | 100.5 |
| 1.5 | 19.25 | **0.250** | 2.00 | 285.5 | 147.25 |
| 2.0 | 25.50 | **0.250** | 2.00 | 378.5 | 194.0 |
| 3.0 | 38.00 | **0.250** | 2.00 | 564.5 | 287.5 |

Clearance and the inter-bead air gap are **flat** while every proportional
dimension grows — the exact opposite of the dead `scale([3,3,3])` model, which
scaled clearance along with everything else (why it wobbled large and seized
small).

**The mixed-scale fingerprint:** column pitch is `sCp(S) = S·(bead_dia + web) +
2·clearance` — a line with slope `bead_dia + web = 12.5` and a **non-zero
intercept `2·clearance = 0.5`**. A uniform scale would have zero intercept. That
intercept is the whole design, and it's asserted in code:
[`abacus-model.test.ts`](../../src/components/create/abacus/__tests__/abacus-model.test.ts)
→ *"mixed scaling — clearance is absolute, size is proportional (#6 spine)"*.

> Empirical caveat: the math proves the *model*. A physical two-size print
> (recommended: `S = 1.0` and `S ≈ 1.5`) is still the final confirmation that the
> chosen 0.25 mm survives the specific printer/filament — that print is the one
> remaining #6 acceptance box, and it's the user's step.

---

## 6. ArUco fiducial bridge (the read-back loop)

The four corner inlays make the printed abacus **machine-readable with zero
vision-code change**: the app already runs an ArUco → homography → per-column →
number pipeline expecting exactly IDs **0/1/2/3**. The `.scad` bakes those four
(js-aruco2 `'ARUCO'` dictionary; `MARKER_BITS` mirrors the 25-bit codes for the
on-screen preview), flat and coplanar with the bead plane.

`AbacusDisplayConfig.physicalAbacusColumns` is the single shared parameter across
all three surfaces — it sets how many columns you **print**, how many the paper
`AbacusMarkerSheet` labels, and how many the **camera** slices. Print N → read N.
Closing that loop end-to-end is #12's remaining work.

---

## 7. GO / NO-GO for Phase 1

**GO.** Phase 0's questions are answered:

- Topology is settled empirically (rodless print-in-place captive track; the
  master 3MF proves captive + AMS multi-color coexist).
- The mixed-scaling spine is designed, encoded in `derived()`, and proven constant
  across sizes (§5).
- The render harness is real and shipping in `apps/web` — **client WASM only**,
  the app server never runs OpenSCAD (the dead feature's one fatal flaw, avoided).
- `scale([3,3,3])` is retired: absolute mm + derived pitches, no uniform scale.

**Open (carried into Phase 1 / user):**

- The **solver** abstraction (`#7`): `PrinterProfile`-sourced locked-dimension
  floors (defaulted; connected-printer-enriches-not-gates) +
  refuse-below-minimum-with-reason. The split exists in the model; the *guard*
  does not (see §4 → the printer profile).
- Canonicalize the two divergent `getBeadColor` resolvers for print (`#7`).
- The physical two-size print through the real service (`#6`'s last box; user's
  step; `#8` stands up the proxy path).

### Harness gotchas (for whoever wires Phase 1)

- The OpenSCAD worker is a **same-origin ES module** at
  `public/openscad/scad-worker.js`; the engine + fonts are the bench's verbatim.
- **Fonts must be written into the worker's MEMFS `/fonts`** — no font ships with
  the engine, so `text()` renders *nothing* without
  `DejaVuSans-Bold.ttf` + `NotoEmoji-Regular.ttf`.
- The render loop **dedups on the scad `-D` defines**, not the whole params object:
  color/filament knobs are JS-only (not sent to the scad), so a pure color tweak
  leaves the key unchanged and re-color happens in three.js without a WASM solve.
- Every setting change **re-solves geometry** — the #9 print-dialog host must treat
  that as a data/prop update, never a remount (see epic #5 → *Cross-phase
  invariant: the print dialog survives a re-solve*).

---

## Appendix — default outer envelope at `scale_factor = 1`

13 columns, defaults as above: **192.5 mm wide × 100.5 mm deep**, `frame_h` 8 mm
(beads stand `bead_proud` 4 mm above → ~12 mm tall), 65 beads. The derived field
depth `sFd = 90.0 mm` reproduces the master's depth exactly; the extra width vs
the 186 mm master is the added flush border band (v3).
