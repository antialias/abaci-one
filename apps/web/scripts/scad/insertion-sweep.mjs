#!/usr/bin/env node
/**
 * Insertion sweep for the modular sliding-dovetail seam (Gitea #30, joint v3).
 *
 * The claim under test: two seated modules have a continuous rigid insertion
 * path — at EVERY relative Y offset from fully seated (r = 0) to fully apart
 * (r > outer_d), the male module translated +r must not interpenetrate the
 * female module. The v3 graduation invariant makes this true by construction
 * (every station a key passes after leaving its own berth is one graduation
 * step larger, and female depth is monotone non-decreasing toward the mouth),
 * and this script is the check that the rendered solids agree.
 *
 * Method: ONE native render of `module_mid` (done outside this script), then
 * ONE WASM OpenSCAD run that imports that STL twice per offset and intersects
 * the pair at each offset, each pair displaced along X into its own bin. A
 * sentinel cube keeps the export non-empty so "no overlap anywhere" is
 * distinguishable from "render produced nothing". The output STL is parsed
 * here and signed volume is accumulated per bin (divergence theorem — the
 * same inversion-proof metric as signed-volume.mjs).
 *
 * Pass:            node scripts/scad/insertion-sweep.mjs <mid.stl>
 * Negative control (a deliberately interfering render MUST collide — proves
 * the sweep can see): render module_mid with -Dslide_relief=-0.3 (sinks the
 * runway floors 0.2 mm above the male rail depth; note joint_fit itself is
 * assert-gated to the coupon values on module passes, so negative fit is NOT
 * a usable control here), then:
 *                  node scripts/scad/insertion-sweep.mjs <mid-neg.stl> --expect-overlap
 * Custom offsets:  --offsets 0,0.5,1
 *
 * The default grid is fine where the joint is tight (0–2 mm @ 0.05 for the
 * seating pinch, 2–14 mm @ 0.25 for berth-length travel) and coarse where
 * everything is runway (15–106 mm @ 1). Offsets are relative Y of the MALE
 * module (the pair pass's `pair_dy` convention: +Y = rearward = extraction).
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OPENSCAD_DIR = join(here, '..', '..', 'public', 'openscad')

// Must match the scad: sc_w (module pitch) at scale 1 defaults.
const PITCH = 15.5
// X spacing between bins. A displaced pair spans ~31 mm in X plus the male
// protrusion, so 60 keeps bins unambiguous for centroid binning.
const SPACING = 60
const SENTINEL_X = -300 // sentinel cube bin ≈ -5; also the parse sanity check
const VOL_EPS = 1e-6 // mm³; real interference is mm³-scale, mesh noise ~1e-9

function defaultOffsets() {
  const rs = []
  for (let i = 0; i <= 40; i++) rs.push(+(i * 0.05).toFixed(2)) // 0 → 2
  for (let i = 9; i <= 56; i++) rs.push(+(i * 0.25).toFixed(2)) // 2.25 → 14
  for (let r = 15; r <= 106; r += 1) rs.push(r) // clear of the joint by ~100.5
  return rs
}

function parseArgs(argv) {
  const args = { mid: null, expectOverlap: false, offsets: null }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--expect-overlap') args.expectOverlap = true
    else if (a === '--offsets') args.offsets = argv[++i].split(',').map(Number)
    else if (!args.mid) args.mid = resolve(a)
    else throw new Error(`unexpected argument: ${a}`)
  }
  if (!args.mid)
    throw new Error(
      'usage: insertion-sweep.mjs <module_mid.stl> [--expect-overlap] [--offsets a,b,c]'
    )
  return args
}

/** Signed volume per X bin from a binary STL (80-byte header, u32 count, 50 B/tri). */
function binVolumes(stl) {
  const dv = new DataView(stl.buffer, stl.byteOffset, stl.byteLength)
  const n = dv.getUint32(80, true)
  const bins = new Map()
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12 // skip normal
    const ax = dv.getFloat32(o, true),
      ay = dv.getFloat32(o + 4, true),
      az = dv.getFloat32(o + 8, true)
    const bx = dv.getFloat32(o + 12, true),
      by = dv.getFloat32(o + 16, true),
      bz = dv.getFloat32(o + 20, true)
    const cx = dv.getFloat32(o + 24, true),
      cy = dv.getFloat32(o + 28, true),
      cz = dv.getFloat32(o + 32, true)
    // a · (b × c) / 6
    const v = (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6
    const bin = Math.round((ax + bx + cx) / 3 / SPACING)
    bins.set(bin, (bins.get(bin) ?? 0) + v)
  }
  return { bins, facets: n }
}

async function main() {
  const args = parseArgs(process.argv)
  const offsets = args.offsets ?? defaultOffsets()
  const mid = readFileSync(args.mid)

  const scad = [
    `rs = [${offsets.join(', ')}];`,
    `for (i = [0 : len(rs) - 1])`,
    `  translate([${SPACING} * i, 0, 0])`,
    `    intersection() {`,
    `      translate([0, rs[i], 0]) import("/mid.stl");`,
    `      translate([${PITCH}, 0, 0]) import("/mid.stl");`,
    `    }`,
    `translate([${SENTINEL_X}, 0, 0]) cube(1);`,
  ].join('\n')

  const { default: OpenSCAD } = await import(join(OPENSCAD_DIR, 'openscad.js'))
  const wasmBinary = readFileSync(join(OPENSCAD_DIR, 'openscad.wasm'))
  const errs = []
  const inst = await OpenSCAD({
    wasmBinary,
    noInitialRun: true,
    print() {},
    printErr(l) {
      errs.push(l)
    },
  })
  inst.FS.writeFile('/mid.stl', mid)
  inst.FS.writeFile('/sweep.scad', scad)
  const t0 = Date.now()
  try {
    inst.callMain(['/sweep.scad', '-o', '/out.stl', '--export-format=binstl', '--backend=Manifold'])
  } catch (e) {
    // emscripten throws ExitStatus on nonzero exit; the real signal is stderr
    if (e?.name !== 'ExitStatus' || e.status !== 0) {
      const hard = errs.filter((l) => /ERROR/.test(l))
      if (hard.length) {
        console.error(hard.join('\n'))
        process.exit(2)
      }
    }
  }
  const out = inst.FS.readFile('/out.stl')
  const { bins, facets } = binVolumes(out)
  console.log(
    `sweep: ${offsets.length} offsets, ${facets} facets, ${((Date.now() - t0) / 1000).toFixed(1)}s`
  )

  const sentinelBin = Math.round(SENTINEL_X / SPACING)
  const sentinel = bins.get(sentinelBin) ?? 0
  if (Math.abs(sentinel - 1) > 1e-3) {
    console.error(`FAIL sentinel cube missing or misparsed (V=${sentinel}) — sweep did not render`)
    process.exit(2)
  }

  const hits = []
  for (let i = 0; i < offsets.length; i++) {
    const v = bins.get(i) ?? 0
    if (Math.abs(v) > VOL_EPS) hits.push({ r: offsets[i], v })
  }

  if (args.expectOverlap) {
    if (hits.length === 0) {
      console.error(
        'FAIL negative control: interference pair produced NO overlap — the sweep is blind'
      )
      process.exit(1)
    }
    for (const h of hits) console.log(`  overlap at r=${h.r}: ${h.v.toFixed(4)} mm³`)
    console.log(
      `PASS negative control: ${hits.length}/${offsets.length} offsets overlap as expected`
    )
    return
  }

  if (hits.length) {
    for (const h of hits) console.error(`  INTERFERENCE at r=${h.r}: ${h.v.toFixed(4)} mm³`)
    console.error(`FAIL ${hits.length}/${offsets.length} offsets interpenetrate`)
    process.exit(1)
  }
  console.log(`PASS all ${offsets.length} offsets rigid-clear (|V| ≤ ${VOL_EPS} mm³)`)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(2)
})
