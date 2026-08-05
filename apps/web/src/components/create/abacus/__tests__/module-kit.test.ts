/**
 * Modular print-kit tests (Gitea #30, CP6): the per-module shell classifier's
 * hard-error contract, the per-module 3MF build (bead shells inked with the
 * GLOBAL column's roles, feet merged like the mono export), the kit plan's
 * bead-slot dedupe math, and the kit zip end to end.
 *
 * Fixtures follow the abacus-3mf.test.ts pattern: synthetic triangle soups
 * shaped the way the classifier reads them — here one frame strip spanning the
 * full outer depth plus exactly one column of bead triangles at the module's
 * KNOWN local x (left end keeps the mono column-0 center; mid and right both
 * sit at scW/2 — the CP5 translate identity).
 */
import { writeBinaryStl } from '@eink/frames-engine/stl'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import {
  analyzeModuleShells,
  defaultParams,
  derived,
  type FilamentMap,
  type Params,
} from '../abacus-model'
import {
  buildModuleKit,
  buildModuleThreeMf,
  kitFilename,
  type ModuleExportParts,
  moduleKitPlan,
} from '../abacus-module-kit'

const p = (over: Partial<Params> = {}): Params => ({
  ...defaultParams, // 13 cols, earth 4, place-value/default, scale 1
  seam_mode: 'modular',
  feet_mode: 'adhesive', // feet-path tests opt back in explicitly
  text_mode: 'emboss',
  ...over,
})

// place-value map with every role on its own slot (frame on 0)
const fmPlace: FilamentMap = {
  slots: ['#c9a26e', '#e11', '#e22', '#e33', '#e44', '#e55'],
  frame: 0,
  markerWhite: 0,
  markerBlack: 0,
  beadRoles: [1, 2, 3, 4, 5],
  markerContrast: 21,
}

const fmHeavenEarth: FilamentMap = {
  slots: ['#c9a26e', '#f5f5f5', '#111111', '#2e86ab'],
  frame: 0,
  markerWhite: 1,
  markerBlack: 2,
  beadRoles: [3, 1], // heaven → 3, earth → 1
  markerContrast: 21,
}

const toBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

/** A small isolated triangle whose bounding-box centroid is exactly (x, y). */
const beadTri = (x: number, y: number): number[] => [x - 1, y - 1, 0, x + 1, y - 1, 0, x, y + 1, 0]

/** Synthetic module soup: a frame strip spanning the full outer depth plus one
 *  column of beads (1 heaven + earth) at the module's known local x. Opts poke
 *  holes for the negative tests. */
function moduleSoup(
  pp: Params,
  kind: 'left' | 'mid' | 'right',
  opts: { dropEarth?: number; extra?: [number, number]; frameY0?: number } = {}
): Float32Array {
  const d = derived(pp)
  const border = pp.border_w * pp.scale_factor
  const cx = kind === 'left' ? border + d.sEm : d.scW / 2
  const w = kind === 'mid' ? d.scW : d.modWe
  const y0 = opts.frameY0 ?? 0
  const tris: number[] = [
    // frame: two triangles sharing an edge → one shell spanning y0…outerD
    ...[0, y0, 0, w, y0, 0, w, d.outerD, 0],
    ...[0, y0, 0, w, d.outerD, 0, 0, d.outerD, 0],
    // the module's one column: heaven on the heaven row, earths on theirs
    ...beadTri(cx, border + d.sHy),
  ]
  for (let k = 0; k < pp.earth - (opts.dropEarth ?? 0); k++) {
    tris.push(...beadTri(cx, border + d.sElo + k * d.sEp))
  }
  if (opts.extra) tris.push(...beadTri(opts.extra[0], opts.extra[1]))
  return new Float32Array(tris)
}

const moduleStl = (
  pp: Params,
  kind: 'left' | 'mid' | 'right',
  opts?: Parameters<typeof moduleSoup>[2]
): ArrayBuffer => toBuffer(writeBinaryStl(moduleSoup(pp, kind, opts)))

/** A synthetic feet part render: `n` disjoint triangles (never classified). */
const feetStl = (n = 3): ArrayBuffer => {
  const positions = new Float32Array(n * 9)
  for (let t = 0; t < n; t++) positions.set(beadTri(t * 3, -5), t * 9)
  return toBuffer(writeBinaryStl(positions))
}

const emptyStl = (): ArrayBuffer => toBuffer(writeBinaryStl(new Float32Array(0)))

describe('analyzeModuleShells (the per-module export gate)', () => {
  it('classifies a mid module: one frame + one column of beads stamped with the global column', () => {
    const pp = p()
    const { shellInfo } = analyzeModuleShells(moduleSoup(pp, 'mid'), pp, 'mid', 7)
    expect(shellInfo).toHaveLength(2 + pp.earth) // frame + heaven + 4 earths
    expect(shellInfo.filter((s) => s.isFrame)).toHaveLength(1)
    const beads = shellInfo.filter((s) => !s.isFrame)
    expect(beads.every((b) => b.i === 7)).toBe(true)
    expect(beads.filter((b) => b.isHeaven)).toHaveLength(1)
  })

  it('knows the left end keeps the mono column-0 center (and mid does not)', () => {
    const pp = p()
    // the same left-end soup classifies fine as 'left'…
    expect(() => analyzeModuleShells(moduleSoup(pp, 'left'), pp, 'left', 0)).not.toThrow()
    // …and hard-errors as 'mid', where the column belongs at scW/2
    expect(() => analyzeModuleShells(moduleSoup(pp, 'left'), pp, 'mid', 1)).toThrow(
      /bead shell centers at/
    )
  })

  it('hard-errors on a missing bead (shell count)', () => {
    const pp = p()
    expect(() =>
      analyzeModuleShells(moduleSoup(pp, 'mid', { dropEarth: 1 }), pp, 'mid', 1)
    ).toThrow(/has 5 shells — expected 6/)
  })

  it('hard-errors on a stray shell away from the module column', () => {
    const pp = p()
    const d = derived(pp)
    // right shell count (a dropped earth swapped for a stray), wrong place
    const soup = moduleSoup(pp, 'mid', {
      dropEarth: 1,
      extra: [d.scW / 2 + d.sCp, pp.border_w * pp.scale_factor + d.sElo],
    })
    expect(() => analyzeModuleShells(soup, pp, 'mid', 1)).toThrow(/bead shell centers at/)
  })

  it('hard-errors on two heaven beads', () => {
    const pp = p()
    const d = derived(pp)
    const border = pp.border_w * pp.scale_factor
    const soup = moduleSoup(pp, 'mid', { dropEarth: 1, extra: [d.scW / 2, border + d.sHy + 1] })
    expect(() => analyzeModuleShells(soup, pp, 'mid', 1)).toThrow(/2 heaven beads/)
  })

  it('hard-errors on a frame body that does not span the full outer depth', () => {
    const pp = p()
    expect(() => analyzeModuleShells(moduleSoup(pp, 'mid', { frameY0: 10 }), pp, 'mid', 1)).toThrow(
      /frame shell spans/
    )
  })
})

describe('buildModuleThreeMf', () => {
  it('inks bead shells with the GLOBAL column roles (place-value)', () => {
    const pp = p()
    // column 1 → place value 11 → role 11 % 5 = 1 → slot 2; heaven rides the same
    // role under place-value, so frame + one merged bead body
    const { bodies } = buildModuleThreeMf({
      body: moduleStl(pp, 'mid'),
      kind: 'mid',
      column: 1,
      params: pp,
      filamentMap: fmPlace,
    })
    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 },
      { slot: 2, label: 'Filament 3', colorHex: '#e22', triangleCount: 5 },
    ])
  })

  it('the same mid render re-inks per column (the variant mechanism)', () => {
    const pp = p()
    const body = moduleStl(pp, 'mid')
    const at = (column: number) =>
      buildModuleThreeMf({ body, kind: 'mid', column, params: pp, filamentMap: fmPlace })
        .bodies.filter((b) => b.slot !== 0)
        .map((b) => b.slot)
    expect(at(1)).toEqual([2]) // pv 11 → role 1
    expect(at(2)).toEqual([1]) // pv 10 → role 0
  })

  it('splits heaven from earth when the scheme does', () => {
    const pp = p({ color_scheme: 'heaven-earth' })
    const { bodies } = buildModuleThreeMf({
      body: moduleStl(pp, 'mid'),
      kind: 'mid',
      column: 3,
      params: pp,
      filamentMap: fmHeavenEarth,
    })
    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 },
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 4 }, // earths
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 }, // heaven
    ])
  })

  it('merges printed feet into the feet slot and forces the assembly path', () => {
    const pp = p({ color_scheme: 'heaven-earth', feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmHeavenEarth, feet: 2 }
    const out = buildModuleThreeMf({
      body: moduleStl(pp, 'mid'),
      feet: feetStl(3),
      kind: 'mid',
      column: 3,
      params: pp,
      filamentMap: fm,
    })
    expect(out.bodies.find((b) => b.slot === 2)).toMatchObject({ triangleCount: 3 })
    expect(out.wipeTower).not.toBeNull()
  })

  it('refuses a footless module 3MF when feet are printed', () => {
    const pp = p({ feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmPlace, feet: 3 }
    const base = { body: moduleStl(pp, 'mid'), kind: 'mid' as const, column: 1, params: pp }
    expect(() => buildModuleThreeMf({ ...base, filamentMap: fmPlace })).toThrow(/no feet slot/)
    expect(() => buildModuleThreeMf({ ...base, filamentMap: fm })).toThrow(
      /module_mid_feet render is missing/
    )
    expect(() => buildModuleThreeMf({ ...base, filamentMap: fm, feet: emptyStl() })).toThrow(
      /came back empty/
    )
  })

  it('collapses to a plain single-filament 3MF when every role rides one slot (no feet)', () => {
    const pp = p()
    const mono: FilamentMap = { ...fmPlace, beadRoles: [0, 0, 0, 0, 0] }
    const out = buildModuleThreeMf({
      body: moduleStl(pp, 'mid'),
      kind: 'mid',
      column: 1,
      params: pp,
      filamentMap: mono,
    })
    expect(out.bodies).toHaveLength(1)
    expect(out.wipeTower).toBeNull()
    expect([...out.bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('moduleKitPlan (bead-slot dedupe)', () => {
  it('13-col place-value: 5 mid variants summing to 11, first-seen left→right', () => {
    const entries = moduleKitPlan(p(), fmPlace)
    expect(entries[0]).toEqual({ kind: 'left', column: 0, count: 1, file: 'module-left.3mf' })
    expect(entries.at(-1)).toEqual({
      kind: 'right',
      column: 12,
      count: 1,
      file: 'module-right.3mf',
    })
    const mids = entries.filter((e) => e.kind === 'mid')
    expect(mids).toHaveLength(5)
    expect(mids.reduce((n, e) => n + e.count, 0)).toBe(11)
    // column 1 is pv 11 → role '10s'; roles 1s/10s repeat 3× among pv 1…11
    expect(mids.map((e) => e.file)).toEqual([
      'module-mid-10s-x3.3mf',
      'module-mid-1s-x2.3mf',
      'module-mid-10k-x2.3mf',
      'module-mid-1k-x2.3mf',
      'module-mid-100s-x2.3mf',
    ])
    expect(mids[0].column).toBe(1)
  })

  it('monochrome collapses to one unlabeled mid variant', () => {
    const entries = moduleKitPlan(
      p({ color_scheme: 'monochrome' }),
      { ...fmPlace, beadRoles: [0] } // one role
    )
    const mids = entries.filter((e) => e.kind === 'mid')
    expect(mids).toEqual([{ kind: 'mid', column: 1, count: 11, file: 'module-mid-x11.3mf' }])
  })

  it('heaven-earth is one variant too (every column shares the signature)', () => {
    const mids = moduleKitPlan(p({ color_scheme: 'heaven-earth' }), fmHeavenEarth).filter(
      (e) => e.kind === 'mid'
    )
    expect(mids).toEqual([{ kind: 'mid', column: 1, count: 11, file: 'module-mid-x11.3mf' }])
  })

  it('roles pinned onto one spool merge into one variant with a joined label', () => {
    // 1s+10s share a spool, 100s+1k share another, 10k alone
    const merged: FilamentMap = { ...fmPlace, beadRoles: [5, 5, 6, 6, 7], slots: [] }
    const mids = moduleKitPlan(p(), merged).filter((e) => e.kind === 'mid')
    expect(mids.map((e) => [e.file, e.count])).toEqual([
      ['module-mid-10s+1s-x5.3mf', 5],
      ['module-mid-10k-x2.3mf', 2],
      ['module-mid-1k+100s-x4.3mf', 4],
    ])
  })

  it('sanitizes multi-word role names in filenames', () => {
    const mids = moduleKitPlan(p({ color_scheme: 'alternating' }), {
      ...fmPlace,
      beadRoles: [1, 2],
    }).filter((e) => e.kind === 'mid')
    expect(mids.map((e) => e.file)).toEqual([
      'module-mid-odd-col-x6.3mf', // column 1 is pv 11 → odd
      'module-mid-even-col-x5.3mf',
    ])
  })
})

describe('buildModuleKit', () => {
  const kitParts = (pp: Params, feet = false): ModuleExportParts => ({
    left: moduleStl(pp, 'left'),
    mid: moduleStl(pp, 'mid'),
    right: moduleStl(pp, 'right'),
    leftFeet: feet ? feetStl() : null,
    midFeet: feet ? feetStl() : null,
    rightFeet: feet ? feetStl() : null,
    params: pp,
  })

  it('zips one 3MF per plan entry plus a README with the print counts', () => {
    const pp = p({ color_scheme: 'heaven-earth' })
    const kit = buildModuleKit({ parts: kitParts(pp), filamentMap: fmHeavenEarth })

    expect(kit.filename).toBe('abacus-modular-kit-13col-x1-fit0.1.zip')
    const members = unzipSync(kit.bytes)
    expect(Object.keys(members).sort()).toEqual([
      'README.txt',
      'module-left.3mf',
      'module-mid-x11.3mf',
      'module-right.3mf',
    ])
    // each member 3MF is itself a zip
    for (const name of Object.keys(members)) {
      if (!name.endsWith('.3mf')) continue
      expect([...members[name].slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    }
    const readme = strFromU8(members['README.txt'])
    expect(readme).toContain('module-mid-x11.3mf')
    expect(readme).toContain('print x 11')
    expect(readme).toContain('joint fit 0.1 mm')
    expect(kit.modules.map((m) => m.count)).toEqual([1, 11, 1])
  })

  it('printed feet flow into every member', () => {
    const pp = p({ color_scheme: 'heaven-earth', feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmHeavenEarth, feet: 2 }
    const kit = buildModuleKit({ parts: kitParts(pp, true), filamentMap: fm })
    for (const m of kit.modules) {
      expect(m.bodies.some((b) => b.slot === 2)).toBe(true)
    }
  })

  it('refuses to build a kit from a mono design', () => {
    const pp = { ...p(), seam_mode: 'mono' as const }
    expect(() => buildModuleKit({ parts: kitParts(pp), filamentMap: fmHeavenEarth })).toThrow(
      /seam_mode "mono"/
    )
  })

  it('kitFilename sweep-encodes cols, scale and fit', () => {
    expect(kitFilename(p({ cols: 7, scale_factor: 0.9, joint_fit: 0.05 }))).toBe(
      'abacus-modular-kit-7col-x0.9-fit0.05.zip'
    )
  })
})
