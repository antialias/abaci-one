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
```

Exits non-zero on failure, so it can gate a pipeline. Sensitivity is proven:
at `joint_fit = −0.05` (deliberate interference) the pair check detects a
~17 mm³ deficit; at the shipped fit the rel diff is ~1e-7.

## Render recipes (OpenSCAD 2021.01 quirks)

- STL: `openscad -Donly='"seam_coupon"' -o out.stl public/scad/abacus.scad`
  (ASCII output; `-o /dev/null` fails — the exporter needs a suffixed filename).
- PNG: needs `--render` (preview mode dies with "Normalized tree > 100000
  elements" and emits an empty image) and the **6-arg** eye/center camera form —
  the 7-arg form plus `--viewall` renders blank:
  `openscad --render -Donly='"seam_coupon"' --camera=55,25,35,15.5,65,4 --imgsize=1200,900 -o out.png …`
- The `textmetrics` warning is harmless (2021.01 predates it; the file falls back).
- Mono byte-stability: after any scad change that should not affect the
  monolithic abacus, render the default (no `-Donly`) STL and compare its
  sha256 against the reference recorded before the change.
