#!/usr/bin/env node
/**
 * Insertion sweep for the modular sliding-dovetail seam (Gitea #30, joint v3).
 *
 * The claim under test: two seated modules have a continuous rigid insertion
 * path — at EVERY relative Y offset from fully seated (r = 0) to fully apart
 * (r > outer_d), the male module translated +r must not interpenetrate the
 * female module, EXCEPT at the one designed elastic interference (the detent
 * ridge), which is measured as a deflection instead. The v3 graduation
 * invariant makes the rigid half true by construction (every station a key
 * passes after leaving its own berth is one graduation step larger, and female
 * depth is monotone non-decreasing toward the mouth — including the deep anchor
 * berth, whose flanks are the same 14° lines as the shallow runway's until they
 * clamp flat outside any smaller section's reach), and this script is the check
 * that the rendered solids agree.
 *
 * Method: ONE native render of `module_mid` (done outside this script), then
 * ONE WASM OpenSCAD run that imports that STL twice per offset and intersects
 * the pair at each offset, each pair displaced along X into its own bin. A
 * sentinel cube keeps the export non-empty so "no overlap anywhere" is
 * distinguishable from "render produced nothing". The output STL is parsed
 * here and signed volume is accumulated per bin (divergence theorem — the
 * same inversion-proof metric as signed-volume.mjs).
 *
 * The detent: every triangle whose centroid falls inside the ridge's own
 * bounding box (derived below from the scad's knobs, in the STATIONARY female's
 * frame — the ridge cannot move) is accounted separately. That volume is the
 * spring's designed interference, and the deepest such triangle gives the
 * deflection the male tongue takes. Nothing else lives in that box, and it is
 * the only masked region: a runway or berth collision reports as rigid
 * interference exactly as before.
 *
 * Pass:            node scripts/scad/insertion-sweep.mjs <mid.stl>
 * Negative control (a deliberately interfering render MUST collide — proves
 * the sweep can see): render module_mid with `-Dslide_relief=-0.3` (sinks the
 * runway floors 0.2 mm above the male rail depth, leaving the berths — and so
 * the detent — exactly where they are; joint_fit itself is assert-gated to the
 * coupon values on module passes, so negative fit is NOT a usable control
 * here), then:
 *                  node scripts/scad/insertion-sweep.mjs <mid-neg.stl> --expect-overlap
 * Custom offsets:  --offsets 0,0.5,1
 * Custom pitch:    --pitch 17.5   (sc_w of the render under test)
 * Custom fit:      --fit 0.11     (joint_fit of the render under test)
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
const SCAD_FILE = join(here, '..', '..', 'public', 'scad', 'abacus.scad')

// Must match the scad's sc_w for the render under test — the SLIDING module
// pitch at scale 1 defaults, which carries slide_edge_allow on each seam edge
// (the vertical-snap 15.5 does not apply here; that topology has no sweep).
// Exposed as --pitch so a non-default render cannot be swept at the wrong X.
const DEFAULT_PITCH = 17.5
// The detent's proud height is fit-dependent, so the keep-out box is too. The
// module passes are assert-gated to the coupon fits; 0.10 is the shipped one.
const DEFAULT_FIT = 0.1
// X spacing between bins. A displaced pair spans ~31 mm in X plus the male
// protrusion, so 60 keeps bins unambiguous for centroid binning.
const SPACING = 60
const SENTINEL_X = -300 // sentinel cube bin ≈ -5; also the parse sanity check
const VOL_EPS = 1e-6 // mm³; real interference is mm³-scale, mesh noise ~1e-9
// Margin on the detent keep-out box. Big enough to catch the interference
// solid's own facets whatever the mesh does with them, far too small to reach
// any other feature (the wedge sits mid-berth: the seat pinch ends 2 mm ahead
// of the front toe, the berth's rear station is 3 mm behind the rear one).
const DETENT_PAD = 0.05
// How close to slide_detent a reading has to be to count as "fully deflected".
// It is also a Y tolerance: on an 18° cam, being this shallow means being
// DEPTH_TOL·cot(in) of travel short of the crest, and the full-deflection bound
// below has to allow exactly that much or it fails a correct geometry.
const DEPTH_TOL = 0.02

/** The Y extent of one module — outer_d. Derived in the scad through a chain
 *  (s_fd ← s_hhi ← …) that is not worth restating here, and the module is a slab
 *  spanning exactly [0, outer_d], so the mesh is the honest source.
 *  Handles both STL flavours: the module renders ASCII (OpenSCAD 2021.01's
 *  default), while the sweep's own intersection pass comes back binary. The
 *  length test is the only reliable discriminator — a binary STL may also open
 *  with the word "solid". */
function meshYSpan(stl) {
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  const seen = (y) => {
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  if (stl.byteLength >= 84) {
    const dv = new DataView(stl.buffer, stl.byteOffset, stl.byteLength)
    const n = dv.getUint32(80, true)
    if (stl.byteLength === 84 + 50 * n) {
      for (let t = 0; t < n; t++) {
        const o = 84 + t * 50 + 12
        for (const k of [4, 16, 28]) seen(dv.getFloat32(o + k, true))
      }
      return hi - lo
    }
  }
  for (const m of stl.toString('latin1').matchAll(/^\s*vertex\s+\S+\s+(\S+)/gm)) seen(Number(m[1]))
  if (!Number.isFinite(lo)) throw new Error('could not read any vertices from the module STL')
  return hi - lo
}

/** The detent's geometry, read out of the scad rather than restated here — the
 *  ridge is a fixed feature of the STATIONARY module, so its box is the same at
 *  every offset. Mirrors slide_detent_ridge() and the stations above the assert
 *  cluster. */
function detentModel(fit, outerD) {
  const src = readFileSync(SCAD_FILE, 'utf8')
  const knob = (name) => {
    const m = src.match(new RegExp(`^${name}\\s*=\\s*(-?[\\d.]+)\\s*;`, 'm'))
    if (!m) throw new Error(`knob ${name} not found in abacus.scad`)
    return Number(m[1])
  }
  const cot = (deg) => 1 / Math.tan((deg * Math.PI) / 180)
  const sFh = knob('frame_h') * knob('scale_factor')
  const chamf = Math.min(knob('top_chamfer'), sFh * 0.4)
  const k0s = chamf + 1 + knob('slide_seat_clear')
  const depth = knob('slide_depth')
  const detent = knob('slide_detent')
  const outCot = cot(knob('slide_detent_out'))
  const inCot = cot(knob('slide_detent_in'))
  // The crest sits at the MIDDLE berth's mid-length, where the floor is flat and
  // known; the toes are worked back from it down each flank. slide_k0_m is
  // outer_d/2 − key/2, so the crest lands on outer_d/2 exactly — the middle of
  // the track, which is the whole point of the mid-track detent.
  const land = knob('slide_detent_l')
  const keyL = knob('slide_key_l')
  const yc = outerD / 2
  // The tongue's free tip, and with it the rear end of the relief channel: one
  // slot width behind the middle berth's seat pinch. Everything AHEAD of this
  // station passes the ridge inside the channel, on air — which is the claim the
  // ride bound below actually tests.
  const springY0 =
    yc - keyL / 2 - knob('slide_datum_relief') + knob('slide_pinch_l') + knob('slide_spring_slot')
  const y0 = yc - land / 2
  const y1 = yc + land / 2
  const proud = fit + detent // over the berth floor — no runway relief here
  const y00 = y0 - proud * outCot // front toe
  const yr = y1 + proud * inCot
  const h = knob('slide_detent_h')
  const crestX = depth - detent
  const floorX = depth + fit
  // The engaged wedge is everything between the crest and the rail's tip face:
  // widest at the berth floor, closing at cot(out) + cot(in) per mm toward the
  // crest. Width is linear in x, so the midpoint width times the engagement is
  // the area exactly — and the midpoint is stated as the floor width less what
  // has closed by there.
  const peakArea = detent * (yr - y00 - (floorX - (crestX + depth) / 2) * (outCot + inCot))
  return {
    k0s,
    springY0,
    detent,
    inCot,
    y0: y00,
    y1, // crest land's rear edge — the first station that can be fully deflected
    yr,
    yc,
    crestX,
    floorX,
    zLo: sFh / 2 - h,
    zHi: sFh / 2 + h,
    peakVol: peakArea * 2 * h,
  }
}

function defaultOffsets() {
  const rs = []
  for (let i = 0; i <= 40; i++) rs.push(+(i * 0.05).toFixed(2)) // 0 → 2
  for (let i = 9; i <= 56; i++) rs.push(+(i * 0.25).toFixed(2)) // 2.25 → 14
  for (let r = 15; r <= 106; r += 1) rs.push(r) // clear of the joint by ~100.5
  return rs
}

function parseArgs(argv) {
  const args = {
    mid: null,
    expectOverlap: false,
    offsets: null,
    pitch: DEFAULT_PITCH,
    fit: DEFAULT_FIT,
  }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--expect-overlap') args.expectOverlap = true
    else if (a === '--offsets') args.offsets = argv[++i].split(',').map(Number)
    else if (a === '--pitch') args.pitch = Number(argv[++i])
    else if (a === '--fit') args.fit = Number(argv[++i])
    else if (!args.mid) args.mid = resolve(a)
    else throw new Error(`unexpected argument: ${a}`)
  }
  if (!args.mid)
    throw new Error(
      'usage: insertion-sweep.mjs <module_mid.stl> [--expect-overlap] [--offsets a,b,c] [--pitch mm] [--fit mm]'
    )
  if (!(args.pitch > 0)) throw new Error('--pitch must be a positive number')
  if (!(args.fit >= 0)) throw new Error('--fit must be a non-negative number')
  if (args.offsets?.some((r) => !Number.isFinite(r)))
    throw new Error('--offsets must be comma-separated numbers')
  return args
}

/** Signed volume per X bin from a binary STL (80-byte header, u32 count, 50 B/tri),
 *  split into the rigid part and the detent's designed interference. `box` is in
 *  bin-local coordinates (the female module sits at local x = pitch). */
function binVolumes(stl, box) {
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
    const rec = bins.get(bin) ?? {
      v: 0,
      detent: 0,
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
    }
    const lx = (ax + bx + cx) / 3 - bin * SPACING
    const ly = (ay + by + cy) / 3
    const lz = (az + bz + cz) / 3
    const inDetent =
      box &&
      lx >= box.x0 &&
      lx <= box.x1 &&
      ly >= box.y0 &&
      ly <= box.y1 &&
      lz >= box.z0 &&
      lz <= box.z1
    if (inDetent) {
      rec.detent += v
      rec.minX = Math.min(rec.minX, ax - bin * SPACING, bx - bin * SPACING, cx - bin * SPACING)
      rec.maxX = Math.max(rec.maxX, ax - bin * SPACING, bx - bin * SPACING, cx - bin * SPACING)
    } else rec.v += v
    bins.set(bin, rec)
  }
  return { bins, facets: n }
}

async function main() {
  const args = parseArgs(process.argv)
  const offsets = args.offsets ?? defaultOffsets()
  const mid = readFileSync(args.mid)
  const d = detentModel(args.fit, meshYSpan(mid))
  // The ridge belongs to the module that does NOT move, so its box is fixed in
  // the bin's own frame — at the female's seam face, which sits at x = pitch.
  const box = {
    x0: args.pitch + d.crestX - DETENT_PAD,
    x1: args.pitch + d.floorX + DETENT_PAD,
    y0: d.y0 - DETENT_PAD,
    y1: d.yr + DETENT_PAD,
    z0: d.zLo - DETENT_PAD,
    z1: d.zHi + DETENT_PAD,
  }

  const scad = [
    `rs = [${offsets.join(', ')}];`,
    `for (i = [0 : len(rs) - 1])`,
    `  translate([${SPACING} * i, 0, 0])`,
    `    intersection() {`,
    `      translate([0, rs[i], 0]) import("/mid.stl");`,
    `      translate([${args.pitch}, 0, 0]) import("/mid.stl");`,
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
  const { bins, facets } = binVolumes(out, box)
  console.log(
    `sweep: ${offsets.length} offsets, ${facets} facets, ${((Date.now() - t0) / 1000).toFixed(1)}s`
  )

  const sentinelBin = Math.round(SENTINEL_X / SPACING)
  const sentinel = bins.get(sentinelBin)?.v ?? 0
  if (Math.abs(sentinel - 1) > 1e-3) {
    console.error(`FAIL sentinel cube missing or misparsed (V=${sentinel}) — sweep did not render`)
    process.exit(2)
  }

  const hits = []
  const detent = []
  for (let i = 0; i < offsets.length; i++) {
    const rec = bins.get(i) ?? { v: 0, detent: 0 }
    if (Math.abs(rec.v) > VOL_EPS) hits.push({ r: offsets[i], v: rec.v })
    // The tongue is pushed by however thick the wedge is where it is engaged: the
    // solid runs from the ridge surface out to the rail's tip face, so its own
    // X extent IS the deflection (and an upper bound on it before the crest is
    // covered, where the deepest point and the widest are not the same station).
    if (Math.abs(rec.detent) > VOL_EPS)
      detent.push({ r: offsets[i], v: rec.detent, depth: rec.maxX - rec.minX })
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
  console.log(
    `PASS all ${offsets.length} offsets rigid-clear (|V| ≤ ${VOL_EPS} mm³), detent excluded`
  )
  detentReport(d, detent, offsets)
}

/** The detent is the one place the modules are MEANT to interfere. Three claims:
 *  it is empty at the seat (the notch receives the ridge), it never asks the
 *  tongue for more than slide_detent of deflection, and it is reachable only by
 *  the TONGUE.
 *  That last one used to come free from rear entry — a ridge parked in the front
 *  berth is behind every section but A. Mid-track it is bought by the relief
 *  channel instead, so it has to be measured rather than assumed, and this is
 *  where: the ride may not begin before the tongue's own tip reaches the ridge's
 *  rear toe. Everything ahead of that tip is running the ridge down the channel,
 *  and if the channel were shallow or narrow by so much as a facet, interference
 *  would show up ~40 mm earlier in the stroke and this bound would catch it. A
 *  too-shallow channel does not even reach here: contact below the crest lands
 *  outside the keep-out box and reports as a RIGID collision, which is the
 *  louder failure and the right one. */
function detentReport(d, detent, offsets) {
  const fail = (msg) => {
    console.error(`FAIL detent: ${msg}`)
    process.exit(1)
  }
  if (detent.length === 0) fail('no interference at ANY offset — the ridge is missing')
  const seated = detent.find((h) => h.r === 0)
  if (seated) fail(`the seated pair interferes (${seated.v.toFixed(4)} mm³) — the notch misses`)
  const deepest = detent.reduce((a, b) => (b.depth > a.depth ? b : a))
  const biggest = detent.reduce((a, b) => (b.v > a.v ? b : a))
  if (Math.abs(deepest.depth - d.detent) > 0.02)
    fail(`peak deflection ${deepest.depth.toFixed(3)} mm ≠ slide_detent ${d.detent}`)
  if (Math.abs(biggest.v - d.peakVol) > 0.05)
    fail(`peak interference ${biggest.v.toFixed(3)} mm³ ≠ the wedge's ${d.peakVol.toFixed(3)} mm³`)
  const rideStart = Math.max(...detent.map((h) => h.r))
  const tipAtToe = d.yr - d.springY0
  if (rideStart > tipAtToe)
    fail(
      `interference at r=${rideStart} — the tongue's tip is still behind the ridge's rear toe ` +
        `(${tipAtToe.toFixed(3)}), so something ahead of the tongue is touching the ridge: ` +
        `the relief channel is not clearing it`
    )
  const fullAt = Math.max(...detent.filter((h) => h.depth > d.detent - DEPTH_TOL).map((h) => h.r))
  // The earliest the tongue can read as fully deflected: its tip at the crest
  // land's rear edge, plus the travel a DEPTH_TOL-shallow reading is worth.
  const tipAtCrest = d.y1 - d.springY0 + DEPTH_TOL * d.inCot
  if (fullAt > tipAtCrest)
    fail(
      `full deflection at r=${fullAt} — before the tongue's tip reaches the crest ` +
        `(${tipAtCrest.toFixed(3)})`
    )
  const firstBite = Math.min(...detent.map((h) => h.r))
  console.log(
    `PASS detent: ${detent.length} offsets ride the ridge, r ${rideStart} → ${firstBite}` +
      ` (bound ${tipAtToe.toFixed(3)}), peak ${deepest.depth.toFixed(3)} mm /` +
      ` ${biggest.v.toFixed(3)} mm³ at r ≤ ${fullAt} (bound ${tipAtCrest.toFixed(3)})`
  )
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(2)
})
