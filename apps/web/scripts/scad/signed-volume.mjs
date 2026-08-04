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
//
// Both checks exit non-zero on failure so they can gate a shell pipeline.
// Disjointness rationale: two solids rendered together in one pass Nef-union;
// if they interpenetrate, the union loses volume vs the standalone sum. Equality
// (rel diff < 1e-6) proves zero volumetric overlap — the seam-joint contract.
import { readFileSync } from 'node:fs'

function volumeOf(path) {
  const buf = readFileSync(path)
  const isAscii = buf.subarray(0, 5).toString() === 'solid' && buf.toString('latin1').includes('facet')
  let vol = 0
  if (isAscii && !looksBinary(buf)) {
    const txt = buf.toString()
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g
    const v = []
    let m
    while ((m = re.exec(txt))) {
      v.push([+m[1], +m[2], +m[3]])
      if (v.length === 3) {
        vol += signedTet(v[0], v[1], v[2])
        v.length = 0
      }
    }
  } else {
    const n = buf.readUInt32LE(80)
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12 // skip normal
      const p = (k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)]
      vol += signedTet(p(0), p(1), p(2))
    }
  }
  return vol
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

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node signed-volume.mjs <part.stl> [pair.stl | part2.stl part3.stl …]')
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
