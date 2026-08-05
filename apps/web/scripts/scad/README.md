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
  log for `ERROR:` instead of trusting the exit code.
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
