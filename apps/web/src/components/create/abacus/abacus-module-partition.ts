// Triangle-soup partition by module (Gitea #44, "animate the assembly").
//
// The studio renders a modular design ALWAYS exploded (`-Dexplode=EXPLODE_GAP`),
// because the scad implements explode as a pure per-module translation: module i
// sits at x0(i) + i·explode and nothing else changes. In that render every module
// is a disjoint set of shells, so the viewer can hand each module's triangles to
// its own THREE.Group and pose the chain itself — no WASM on the toggle, and the
// exploded render's coordinates ARE each group's local frame.
//
// What the viewer needs from a soup + a per-triangle module tag is a stable
// reordering that makes each module a CONTIGUOUS range, so one shared set of
// geometry attributes can serve every module through a per-module drawRange.
// That is a counting sort, and it lives here (pure, no three.js) so it can be
// tested without a WebGL context.

/** A module's slice of the reordered soup, in TRIANGLES (the viewer multiplies
 *  by 3 for `setDrawRange`, which counts vertices). */
export type ModuleRange = { start: number; count: number }

export type TrianglePartition = {
  /** `order[k]` = the ORIGINAL index of the triangle that lands at slot k. */
  order: Uint32Array
  /** One entry per module; the ranges tile `[0, nTri)` in module order. */
  ranges: ModuleRange[]
}

/**
 * Stable counting sort of triangle indices by module.
 *
 * `modules === 1` (a mono design, or a seated chain the classifier can't
 * attribute) accepts anything — including the classifier's −1 "no module" — and
 * returns the identity order in one range. With more than one module every
 * triangle must carry a real module index: a −1 there would mean the viewer is
 * about to drop geometry on the floor, so it throws rather than render a
 * silently incomplete abacus.
 */
export function partitionTriangles(
  triModule: ArrayLike<number>,
  modules: number
): TrianglePartition {
  const m = Math.max(1, modules | 0)
  const n = triModule.length
  const order = new Uint32Array(n)
  if (m === 1) {
    for (let t = 0; t < n; t++) order[t] = t
    return { order, ranges: [{ start: 0, count: n }] }
  }
  const counts = new Int32Array(m)
  for (let t = 0; t < n; t++) {
    const k = triModule[t]
    if (!(k >= 0 && k < m)) {
      throw new Error(
        `triangle ${t} has module ${k}, outside 0..${m - 1} — the exploded shell classifier left it unattributed`
      )
    }
    counts[k]++
  }
  const ranges: ModuleRange[] = []
  const cursor = new Int32Array(m)
  let at = 0
  for (let i = 0; i < m; i++) {
    cursor[i] = at
    ranges.push({ start: at, count: counts[i] })
    at += counts[i]
  }
  // one forward pass = stable: within a module, triangles keep their input order
  for (let t = 0; t < n; t++) order[cursor[triModule[t]]++] = t
  return { order, ranges }
}

/** Reorder a flat triangle-soup position array (9 floats per triangle) by
 *  `order`. Vertex order inside a triangle is preserved, so winding — and
 *  therefore `computeVertexNormals` — is unchanged. */
export function permuteTriangles(positions: ArrayLike<number>, order: Uint32Array): Float32Array {
  const out = new Float32Array(order.length * 9)
  for (let k = 0; k < order.length; k++) {
    const src = order[k] * 9
    const dst = k * 9
    for (let c = 0; c < 9; c++) out[dst + c] = positions[src + c]
  }
  return out
}

/** Reorder a per-triangle Int32 tag (triShell, plug token ids) by the same
 *  `order`, so it keeps indexing the permuted soup. */
export function permuteInt32(a: ArrayLike<number>, order: Uint32Array): Int32Array {
  const out = new Int32Array(order.length)
  for (let k = 0; k < order.length; k++) out[k] = a[order[k]]
  return out
}
