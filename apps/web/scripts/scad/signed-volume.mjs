// Signed STL volume via the divergence theorem — the scad harness's one
// inversion-proof metric: an inside-out (miswound) region subtracts instead of
// adding, so a "looks fine in preview" polyhedron with reversed faces shows up
// as a wrong TOTAL, which no screenshot can. Handles binary and ASCII STL
// (OpenSCAD 2021.01 exports ASCII).
//
// Usage:
//   node signed-volume.mjs part.stl                 → volume of one file
//   node signed-volume.mjs single.stl pair.stl      → disjointness: pair == 2×single
//   node signed-volume.mjs whole.stl a.stl b.stl …  → additivity: whole == a+b+…
//   node signed-volume.mjs --same ref.stl new.stl   → geometric fingerprint match
//
// All checks exit non-zero on failure so they can gate a shell pipeline.
// Disjointness rationale: two solids rendered together in one pass Nef-union;
// if they interpenetrate, the union loses volume vs the standalone sum. Equality
// (rel diff < 1e-6) proves zero volumetric overlap — the seam-joint contract.
//
// --same rationale: OpenSCAD 2021.01's STL export is NOT byte-reproducible —
// two solo renders of the IDENTICAL mono source give different sha256s (arc
// tessellation comes out phase-jittered run to run), so hashing the file can't
// detect drift. A phase-shifted regular-polygon arc has exactly the same area
// and volume, so volume + surface area at 1e-9 relative tolerance IS invariant
// across renders of the same solid while any real edit (a moved pocket, an
// added seat) shows up at ~1e-3. Facet count and bbox are reported for the eye
// (bbox jitters up to ~0.015 mm when an arc's extreme vertex moves phase).
import { readFileSync } from 'node:fs'

function statsOf(path) {
  const buf = readFileSync(path)
  const isAscii = buf.subarray(0, 5).toString() === 'solid' && buf.toString('latin1').includes('facet')
  const s = {
    vol: 0,
    area: 0,
    facets: 0,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }
  const tri = (a, b, c) => {
    s.vol += signedTet(a, b, c)
    s.area += triArea(a, b, c)
    s.facets++
    for (const p of [a, b, c])
      for (let k = 0; k < 3; k++) {
        if (p[k] < s.min[k]) s.min[k] = p[k]
        if (p[k] > s.max[k]) s.max[k] = p[k]
      }
  }
  if (isAscii && !looksBinary(buf)) {
    const txt = buf.toString()
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g
    const v = []
    let m
    while ((m = re.exec(txt))) {
      v.push([+m[1], +m[2], +m[3]])
      if (v.length === 3) {
        tri(v[0], v[1], v[2])
        v.length = 0
      }
    }
  } else {
    const n = buf.readUInt32LE(80)
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12 // skip normal
      const p = (k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)]
      tri(p(0), p(1), p(2))
    }
  }
  return s
}
function volumeOf(path) {
  return statsOf(path).vol
}
function triArea(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const x = u[1] * v[2] - u[2] * v[1]
  const y = u[2] * v[0] - u[0] * v[2]
  const z = u[0] * v[1] - u[1] * v[0]
  return Math.sqrt(x * x + y * y + z * z) / 2
}
function looksBinary(buf) {
  const n = buf.length >= 84 ? buf.readUInt32LE(80) : -1
  return buf.length === 84 + n * 50
}
function signedTet(a, b, c) {
  return (
    (a[0] * (b[1] * c[2] - c[1] * b[2]) - b[0] * (a[1] * c[2] - c[1] * a[2]) + c[0] * (a[1] * b[2] - b[1] * a[2])) / 6
  )
}

const argv = process.argv.slice(2)
if (argv[0] === '--same') {
  const [ref, cur] = argv.slice(1)
  if (!ref || !cur) {
    console.error('usage: node signed-volume.mjs --same ref.stl new.stl')
    process.exit(2)
  }
  const a = statsOf(ref)
  const b = statsOf(cur)
  const relV = Math.abs(b.vol - a.vol) / Math.abs(a.vol)
  const relA = Math.abs(b.area - a.area) / a.area
  const bboxD = Math.max(
    ...a.min.map((v, k) => Math.abs(v - b.min[k])),
    ...a.max.map((v, k) => Math.abs(v - b.max[k]))
  )
  console.log(`ref: vol ${a.vol.toFixed(3)} mm³  area ${a.area.toFixed(3)} mm²  facets ${a.facets}`)
  console.log(`new: vol ${b.vol.toFixed(3)} mm³  area ${b.area.toFixed(3)} mm²  facets ${b.facets}`)
  console.log(`rel diff: vol ${relV.toExponential(2)}  area ${relA.toExponential(2)}  |  bbox Δ ${bboxD.toFixed(4)} mm  facets Δ ${b.facets - a.facets}  (informational)`)
  const ok = relV < 1e-9 && relA < 1e-9
  console.log(ok ? 'SAME SOLID ✓' : 'GEOMETRY DRIFTED ✗')
  process.exit(ok ? 0 : 1)
}
const files = argv
if (files.length === 0) {
  console.error('usage: node signed-volume.mjs [--same ref.stl new.stl] | <part.stl> [pair.stl | part2.stl part3.stl …]')
  process.exit(2)
}
const vols = files.map((f) => volumeOf(f))
const TOL = 1e-6

if (files.length === 1) {
  console.log(`${files[0]}: ${vols[0].toFixed(3)} mm³`)
} else if (files.length === 2) {
  const [single, pair] = vols
  console.log(`single: ${single.toFixed(3)} mm³`)
  console.log(`pair:   ${pair.toFixed(3)} mm³  (2×single = ${(2 * single).toFixed(3)})`)
  const rel = Math.abs(pair - 2 * single) / (2 * single)
  const ok = rel < TOL
  console.log(`rel diff: ${(rel * 100).toExponential(2)} %  →  ${ok ? 'DISJOINT ✓' : 'OVERLAP/FUSION ✗'}`)
  process.exit(ok ? 0 : 1)
} else {
  const [whole, ...parts] = vols
  const sum = parts.reduce((a, b) => a + b, 0)
  console.log(`whole: ${whole.toFixed(3)} mm³`)
  console.log(`parts: ${parts.map((v) => v.toFixed(3)).join(' + ')} = ${sum.toFixed(3)} mm³`)
  const rel = Math.abs(whole - sum) / sum
  const ok = rel < TOL
  console.log(`rel diff: ${(rel * 100).toExponential(2)} %  →  ${ok ? 'ADDITIVE ✓' : 'OVERLAP/GAP ✗'}`)
  process.exit(ok ? 0 : 1)
}
