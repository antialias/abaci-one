/**
 * Single-plate module-kit tests (Gitea #32, Phase A): the count → instance
 * expansion, footprint extraction off the gated soups, the RIGID-GROUP transform
 * (the piece with no upstream precedent — everything else is Frame Studio's
 * packer), the packed plate end to end, and the refusals that send an overfull
 * kit back to the zip.
 *
 * Fixtures follow module-kit.test.ts: synthetic triangle soups shaped the way
 * `analyzeModuleShells` reads them — one frame strip spanning the full outer
 * depth plus exactly one column of bead triangles at the module's known local x
 * — so a mid module's footprint really is scW × outerD and the plate's geometry
 * is the same triangles the zip would have shipped.
 */

import type { BedSize } from '@eink/frames-engine/print-bundle'
import { writeBinaryStl } from '@eink/frames-engine/stl'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { BAMBU_256_BED } from '../abacus-3mf-assembly'
import {
  buildKitPlateThreeMf,
  KitPlateFitError,
  type KitPlatePlacement,
  kitPlateInstances,
  type ModuleBasis,
  moduleBasis,
  packKitPlate,
  placeModuleBodies,
} from '../abacus-kit-plate'
import { defaultParams, derived, type FilamentMap, type Params } from '../abacus-model'
import { type ModuleExportParts, moduleSoups } from '../abacus-module-kit'

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
const tri = (x: number, y: number, z = 0): number[] => [
  x - 1,
  y - 1,
  z,
  x + 1,
  y - 1,
  z,
  x,
  y + 1,
  z,
]

/** Synthetic module soup: a frame strip spanning the full outer depth plus one
 *  column of beads (1 heaven + earth) at the module's known local x. */
function moduleSoup(pp: Params, kind: 'left' | 'mid' | 'right'): Float32Array {
  const d = derived(pp)
  const border = pp.border_w * pp.scale_factor
  const cx = kind === 'left' ? border + d.sEm : d.scW / 2
  const w = kind === 'mid' ? d.scW : d.modWe
  const tris: number[] = [
    ...[0, 0, 0, w, 0, 0, w, d.outerD, 0],
    ...[0, 0, 0, w, d.outerD, 0, 0, d.outerD, 0],
    ...tri(cx, border + d.sHy),
  ]
  for (let k = 0; k < pp.earth; k++) tris.push(...tri(cx, border + d.sElo + k * d.sEp))
  return new Float32Array(tris)
}

const moduleStl = (pp: Params, kind: 'left' | 'mid' | 'right'): ArrayBuffer =>
  toBuffer(writeBinaryStl(moduleSoup(pp, kind)))

/** A synthetic feet render: studs INSIDE the module footprint that dip below
 *  z=0, the way printed TPU feet stand the frame off the bed. */
const feetStl = (n = 3): ArrayBuffer => {
  const positions = new Float32Array(n * 9)
  for (let t = 0; t < n; t++) positions.set(tri(3 + t * 3, 10, -2), t * 9)
  return toBuffer(writeBinaryStl(positions))
}

/** A synthetic side-text render: one triangle inside the module footprint at a
 *  distinct x per group (so assertGroupsDiffer sees differing geometry). */
const textStlAt = (x: number): ArrayBuffer =>
  toBuffer(writeBinaryStl(new Float32Array(tri(x, 5, 1))))

const kitParts = (pp: Params, feet = false): ModuleExportParts => ({
  left: moduleStl(pp, 'left'),
  mid: moduleStl(pp, 'mid'),
  right: moduleStl(pp, 'right'),
  leftFeet: feet ? feetStl() : null,
  midFeet: feet ? feetStl() : null,
  rightFeet: feet ? feetStl() : null,
  leftText: [],
  rightText: [],
  params: pp,
})

const basesFor = (pp: Params, fm: FilamentMap, parts: ModuleExportParts) => ({
  left: moduleBasis(
    'left',
    moduleSoups({ body: parts.left, kind: 'left', column: 0, params: pp, filamentMap: fm })
  ),
  mid: moduleBasis(
    'mid',
    moduleSoups({ body: parts.mid, kind: 'mid', column: 1, params: pp, filamentMap: fm })
  ),
  right: moduleBasis(
    'right',
    moduleSoups({
      body: parts.right,
      kind: 'right',
      column: pp.cols - 1,
      params: pp,
      filamentMap: fm,
    })
  ),
})

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}
const rectOf = (pl: KitPlatePlacement): Rect => ({
  x0: pl.xMm,
  y0: pl.yMm,
  x1: pl.xMm + pl.wMm,
  y1: pl.yMm + pl.hMm,
})
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6

describe('kitPlateInstances (counts → placeable modules)', () => {
  it('expands a 13-column place-value kit into 13 modules with unique ids and labels', () => {
    const instances = kitPlateInstances(p(), fmPlace)
    expect(instances).toHaveLength(13)
    expect(new Set(instances.map((i) => i.id)).size).toBe(13)
    expect(new Set(instances.map((i) => i.label)).size).toBe(13)
    expect(instances[0]).toEqual({
      id: 'left',
      label: 'left end',
      kind: 'left',
      column: 0,
      file: 'module-left.3mf',
    })
    expect(instances.at(-1)).toEqual({
      id: 'right',
      label: 'right end',
      kind: 'right',
      column: 12,
      file: 'module-right.3mf',
    })
  })

  it('numbers mids across variants — eleven pieces is what comes off the plate', () => {
    const mids = kitPlateInstances(p(), fmPlace).filter((i) => i.kind === 'mid')
    expect(mids).toHaveLength(11)
    expect(mids.map((i) => i.label)).toEqual(
      Array.from({ length: 11 }, (_, k) => `mid ${k + 1} of 11`)
    )
    expect(mids.map((i) => i.id)).toEqual(Array.from({ length: 11 }, (_, k) => `mid-${k + 1}`))
  })

  it('carries each instance’s OWN column — bead color varies per column', () => {
    // 5 bead-slot variants covering 11 mid columns: 3 + 2 + 2 + 2 + 2, each
    // instance stamped with its variant's representative column.
    const mids = kitPlateInstances(p(), fmPlace).filter((i) => i.kind === 'mid')
    const runs: [number, number][] = []
    for (const m of mids) {
      const last = runs.at(-1)
      if (last && last[0] === m.column) last[1]++
      else runs.push([m.column, 1])
    }
    expect(runs).toEqual([
      [1, 3],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
    ])
    // and the variant identity rides the file, not the label
    expect(mids[0].file).toBe('module-mid-10s-x3.3mf')
    expect(mids.at(-1)?.file).toBe('module-mid-100s-x2.3mf')
  })

  it('a single-variant kit still numbers its eleven mids', () => {
    const mids = kitPlateInstances(p({ color_scheme: 'heaven-earth' }), fmHeavenEarth).filter(
      (i) => i.kind === 'mid'
    )
    expect(mids).toHaveLength(11)
    expect(mids.every((m) => m.column === 1 && m.file === 'module-mid-x11.3mf')).toBe(true)
    expect(mids[2].label).toBe('mid 3 of 11')
  })

  it('a lone mid drops the ordinal rather than reading "mid 1 of 1"', () => {
    const instances = kitPlateInstances(p({ cols: 3 }), fmPlace)
    expect(instances.map((i) => i.label)).toEqual(['left end', 'mid', 'right end'])
  })
})

describe('moduleBasis (footprints off the gated soups)', () => {
  const pp = p()
  const d = derived(pp)
  const parts = kitParts(pp)

  it('measures a mid module as one column wide by the full outer depth', () => {
    const basis = basesFor(pp, fmPlace, parts).mid
    expect(basis.wMm).toBeCloseTo(d.scW, 6)
    expect(basis.hMm).toBeCloseTo(d.outerD, 6)
    expect(basis).toMatchObject({ kind: 'mid', minX: 0, minY: 0 })
  })

  it('the ends are wider than a mid by their end wall', () => {
    const bases = basesFor(pp, fmPlace, parts)
    expect(bases.left.wMm).toBeCloseTo(d.modWe, 6)
    expect(bases.right.wMm).toBeCloseTo(d.modWe, 6)
    expect(bases.left.wMm).toBeGreaterThan(bases.mid.wMm)
  })

  it('takes the union of every soup that ships — a part pass can only grow it', () => {
    const feetParams = p({ feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmPlace, feet: 3 }
    const basisOf = (feet: ArrayBuffer) =>
      moduleBasis(
        'mid',
        moduleSoups({
          body: moduleStl(feetParams, 'mid'),
          feet,
          kind: 'mid',
          column: 1,
          params: feetParams,
          filamentMap: fm,
        })
      )
    // studs inside the frame's pockets leave the packed footprint alone …
    expect(basisOf(feetStl()).wMm).toBeCloseTo(derived(feetParams).scW, 6)
    // … but one that pokes proud of the frame widens the box the packer clears
    const proud = toBuffer(writeBinaryStl(new Float32Array(tri(-4, 10, -2))))
    const wide = basisOf(proud)
    expect(wide.minX).toBeCloseTo(-5, 6)
    expect(wide.wMm).toBeCloseTo(derived(feetParams).scW + 5, 6)
  })

  it('a feet render that is NOT printed never enters the footprint', () => {
    // same renders, adhesive feet: the gate drops the feet pass, so must the basis
    const proud = toBuffer(writeBinaryStl(new Float32Array(tri(-4, 10, -2))))
    const basis = moduleBasis(
      'mid',
      moduleSoups({
        body: moduleStl(pp, 'mid'),
        feet: proud,
        kind: 'mid',
        column: 1,
        params: pp,
        filamentMap: fmPlace,
      })
    )
    expect(basis.minX).toBe(0)
    expect(basis.wMm).toBeCloseTo(d.scW, 6)
  })
})

describe('placeModuleBodies (the rigid-group transform)', () => {
  // A two-body module: a 6 × 8 frame sitting at z=0, and a foot inside its
  // footprint dipping 2mm below it at a known XY offset.
  const basis: ModuleBasis = { kind: 'mid', minX: 10, minY: 20, wMm: 6, hMm: 8 }
  const frame = new Float32Array([10, 20, 0, 16, 20, 0, 16, 28, 0])
  const foot = new Float32Array([12, 22, -2, 13, 22, -2, 13, 23, -2])
  const bodies = [
    { slot: 0, positions: frame },
    { slot: 1, positions: foot },
  ]

  it('moves the module to its slot: min corner to (x, y), Z left to the container', () => {
    const [f, ft] = placeModuleBodies(bodies, basis, { xMm: 100, yMm: 50, rotated: false })
    expect([...f.positions]).toEqual([100, 50, 0, 106, 50, 0, 106, 58, 0])
    expect([...ft.positions]).toEqual([102, 52, -2, 103, 52, -2, 103, 53, -2])
    expect([f.slot, ft.slot]).toEqual([0, 1])
  })

  it('re-origins on ONE shared basis — a body never lands on its own corner', () => {
    const [, ft] = placeModuleBodies(bodies, basis, { xMm: 100, yMm: 50, rotated: false })
    // The bug this whole module exists to not have: per-body re-origin would put
    // the foot's own min corner at the placement corner, on top of the frame's.
    expect(ft.positions[0]).not.toBe(100)
    expect(ft.positions[1]).not.toBe(50)
  })

  it('turns the WHOLE module when the packer turns it', () => {
    const [f, ft] = placeModuleBodies(bodies, basis, { xMm: 100, yMm: 50, rotated: true })
    // (x, y) → (−y, x), re-origined on the GROUP box: x' = maxY − y + X, y' = x − minX + Y
    expect([...f.positions]).toEqual([108, 50, 0, 108, 56, 0, 100, 56, 0])
    expect([...ft.positions]).toEqual([106, 52, -2, 106, 53, -2, 105, 53, -2])
  })

  it('keeps every body registered to every other, turned or not', () => {
    for (const rotated of [false, true]) {
      const [f, ft] = placeModuleBodies(bodies, basis, { xMm: 100, yMm: 50, rotated })
      const before = [foot[0] - frame[0], foot[1] - frame[1], foot[2] - frame[2]]
      const after = [
        ft.positions[0] - f.positions[0],
        ft.positions[1] - f.positions[1],
        ft.positions[2] - f.positions[2],
      ]
      // A rigid motion: z and the in-plane distance survive, and the offset
      // itself rotates with the module rather than staying put.
      expect(after[2]).toBeCloseTo(before[2], 6)
      expect(Math.hypot(after[0], after[1])).toBeCloseTo(Math.hypot(before[0], before[1]), 6)
      expect(after.slice(0, 2)).toEqual(rotated ? [-before[1], before[0]] : [before[0], before[1]])
    }
  })

  it('lands the placed footprint exactly on its packed cell', () => {
    for (const rotated of [false, true]) {
      const placed = placeModuleBodies(bodies, basis, { xMm: 100, yMm: 50, rotated })
      const xs = placed.flatMap((b) => [...b.positions].filter((_, i) => i % 3 === 0))
      const ys = placed.flatMap((b) => [...b.positions].filter((_, i) => i % 3 === 1))
      expect(Math.min(...xs)).toBeCloseTo(100, 6)
      expect(Math.min(...ys)).toBeCloseTo(50, 6)
      expect(Math.max(...xs) - 100).toBeCloseTo(rotated ? basis.hMm : basis.wMm, 6)
      expect(Math.max(...ys) - 50).toBeCloseTo(rotated ? basis.wMm : basis.hMm, 6)
    }
  })
})

describe('packKitPlate (tower first, then the modules around it)', () => {
  const pp = p({ color_scheme: 'heaven-earth' })
  const parts = kitParts(pp)
  const bases = basesFor(pp, fmHeavenEarth, parts)
  const instances = kitPlateInstances(pp, fmHeavenEarth)

  it('lays all 13 modules on one 256 plate, none overlapping, all on the bed', () => {
    const { placements, tower, bed } = packKitPlate({ instances, bases })
    expect(placements.map((pl) => pl.id).sort()).toEqual(instances.map((i) => i.id).sort())
    const rects = placements.map(rectOf)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j])).toBe(false)
      }
      expect(rects[i].x0).toBeGreaterThanOrEqual(0)
      expect(rects[i].y0).toBeGreaterThanOrEqual(0)
      expect(rects[i].x1).toBeLessThanOrEqual(bed.wMm)
      expect(rects[i].y1).toBeLessThanOrEqual(bed.dMm)
    }
    expect(tower.wMm).toBeGreaterThan(0)
  })

  it('keeps the modules clear of the reserved tower and the printer keep-out', () => {
    const { placements, tower, bed } = packKitPlate({ instances, bases })
    const towerRect: Rect = {
      x0: tower.xMm,
      y0: tower.yMm,
      x1: tower.xMm + tower.wMm,
      y1: tower.yMm + tower.dMm,
    }
    const keepOuts: Rect[] = [
      towerRect,
      ...(bed.exclude ?? []).map((e) => ({
        x0: e.xMm,
        y0: e.yMm,
        x1: e.xMm + e.wMm,
        y1: e.yMm + e.dMm,
      })),
    ]
    for (const pl of placements) {
      for (const k of keepOuts) expect(overlaps(rectOf(pl), k)).toBe(false)
    }
    // the pin sits INSIDE its reservation — the tower spills below-left of it
    expect(tower.pinXMm).toBeGreaterThan(tower.xMm)
    expect(tower.pinYMm).toBeGreaterThan(tower.yMm)
    expect(tower.pinXMm).toBeLessThan(towerRect.x1)
    expect(tower.pinYMm).toBeLessThan(towerRect.y1)
  })

  it('reserves a wider ring when the plate will slice with supports', () => {
    const plain = packKitPlate({ instances, bases })
    const supported = packKitPlate({ instances, bases, supportsAtSlice: true })
    expect(supported.tower.wMm).toBeGreaterThan(plain.tower.wMm)
    expect(supported.tower.dMm).toBeGreaterThan(plain.tower.dMm)
  })

  it('refuses an overfull plate by name rather than dropping a module', () => {
    const smallBed: BedSize = { wMm: 150, dMm: 150 }
    let caught: KitPlateFitError | null = null
    try {
      packKitPlate({ instances, bases, bed: smallBed })
    } catch (err) {
      caught = err as KitPlateFitError
    }
    expect(caught).toBeInstanceOf(KitPlateFitError)
    expect(caught?.reason).toBe('overflow')
    expect(caught?.modules.length).toBeGreaterThan(0)
    // every named module is a real instance label, and the message names a knob
    for (const name of caught?.modules ?? []) {
      expect(instances.map((i) => i.label)).toContain(name)
    }
    expect(caught?.message).toMatch(/build plates/)
    expect(caught?.message).toMatch(/fewer columns|scale the design down|bigger bed/)
  })

  it('refuses a module too big for the bed even alone', () => {
    const big = p({ cols: 3, scale_factor: 3, color_scheme: 'heaven-earth' })
    const bigParts = kitParts(big)
    let caught: KitPlateFitError | null = null
    try {
      packKitPlate({
        instances: kitPlateInstances(big, fmHeavenEarth),
        bases: basesFor(big, fmHeavenEarth, bigParts),
      })
    } catch (err) {
      caught = err as KitPlateFitError
    }
    expect(caught?.reason).toBe('too-big')
    expect(caught?.modules).toContain('mid')
    expect(caught?.message).toMatch(/too big for this 256 × 256 mm bed/)
  })

  it('refuses when no rectangle is left for the purge tower', () => {
    let caught: KitPlateFitError | null = null
    try {
      packKitPlate({ instances, bases, bed: { wMm: 60, dMm: 60 } })
    } catch (err) {
      caught = err as KitPlateFitError
    }
    expect(caught?.reason).toBe('no-tower-room')
    expect(caught?.modules).toEqual([])
    expect(caught?.message).toMatch(/purge tower/)
  })
})

describe('buildKitPlateThreeMf (the whole kit as one plate)', () => {
  const pp = p({ color_scheme: 'heaven-earth' })

  const plateOf = (over: Partial<Parameters<typeof buildKitPlateThreeMf>[0]> = {}) =>
    buildKitPlateThreeMf({ parts: kitParts(pp), filamentMap: fmHeavenEarth, ...over })

  it('carries every module’s geometry, bucketed by filament slot', () => {
    const plate = plateOf()
    expect(plate.placements).toHaveLength(13)
    // each synthetic module is 2 frame + 1 heaven + 4 earth triangles, ×13
    expect(plate.bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 26 },
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 52 },
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 13 },
    ])
    expect([...plate.bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })

  it('ships the modules WHERE THEY WERE PACKED — no re-centering, no re-derived tower', () => {
    const plate = plateOf()
    const members = unzipSync(plate.bytes)
    const model = strFromU8(members['3D/3dmodel.model'])
    // the build item is a pure identity: the bodies already carry the layout
    expect(model).toContain('<item objectid="1000" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>')

    // and the geometry really spans the packed placements
    const verts = [...model.matchAll(/<vertex x="([-\d.]+)" y="([-\d.]+)"/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ])
    const rects = plate.placements.map(rectOf)
    expect(Math.min(...verts.map((v) => v[0]))).toBeCloseTo(Math.min(...rects.map((r) => r.x0)), 3)
    expect(Math.min(...verts.map((v) => v[1]))).toBeCloseTo(Math.min(...rects.map((r) => r.y0)), 3)
    expect(Math.max(...verts.map((v) => v[0]))).toBeCloseTo(Math.max(...rects.map((r) => r.x1)), 3)
    expect(Math.max(...verts.map((v) => v[1]))).toBeCloseTo(Math.max(...rects.map((r) => r.y1)), 3)

    // the tower is pinned at the reservation the packer left room for
    const settings = JSON.parse(strFromU8(members['Metadata/project_settings.config']))
    expect(Number(settings.wipe_tower_x)).toBeCloseTo(plate.tower.pinXMm, 3)
    expect(Number(settings.wipe_tower_y)).toBeCloseTo(plate.tower.pinYMm, 3)
    expect(plate.wipeTower?.pinMm).toEqual({ x: plate.tower.pinXMm, y: plate.tower.pinYMm })
  })

  it('every module lands on the bed, clear of its neighbours', () => {
    const plate = plateOf()
    const rects = plate.placements.map(rectOf)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j])).toBe(false)
      }
      expect(rects[i].x1).toBeLessThanOrEqual(BAMBU_256_BED.wMm)
      expect(rects[i].y1).toBeLessThanOrEqual(BAMBU_256_BED.dMm)
    }
  })

  it('runs each module through its own export gate — a footless module still refuses', () => {
    const feetParams = p({ color_scheme: 'heaven-earth', feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmHeavenEarth, feet: 2 }
    expect(() => buildKitPlateThreeMf({ parts: kitParts(feetParams), filamentMap: fm })).toThrow(
      /module_left_feet render is missing/
    )
  })

  it('flows printed feet onto the plate on their own slot, and drops the plate on them', () => {
    const feetParams = p({ color_scheme: 'heaven-earth', feet_mode: 'printed' })
    const fm: FilamentMap = { ...fmHeavenEarth, feet: 2 }
    const plate = buildKitPlateThreeMf({ parts: kitParts(feetParams, true), filamentMap: fm })
    // 3 foot triangles per module × 13 modules
    expect(plate.bodies.find((b) => b.slot === 2)).toMatchObject({ triangleCount: 39 })
    // The studs still sit 2mm below the frame plane in the mesh — the CONTAINER
    // lifts the whole plate onto the bed, which is what keeps the frame's z=0
    // plane (and the support-transition modifier pinned to it) where it belongs.
    const model = strFromU8(unzipSync(plate.bytes)['3D/3dmodel.model'])
    expect(model).toContain('<item objectid="1000" transform="1 0 0 0 1 0 0 0 1 0 0 2"/>')
  })

  it('flows inset side text onto the END modules only', () => {
    const textParams = p({
      color_scheme: 'heaven-earth',
      text_mode: 'inset',
      aid_10: 'off',
      aid_5: 'off',
      edge_left: 'L',
      edge_right: 'R',
    })
    const fm: FilamentMap = { ...fmHeavenEarth, textRoles: [2] }
    const plate = buildKitPlateThreeMf({
      parts: {
        ...kitParts(textParams),
        leftText: [{ group: 0, stl: textStlAt(3) }],
        rightText: [{ group: 0, stl: textStlAt(6) }],
      },
      filamentMap: fm,
    })
    // one inlay triangle per END module, and nothing on the eleven mids
    expect(plate.bodies.find((b) => b.slot === 2)).toMatchObject({ triangleCount: 2 })
  })

  it('refuses a mono design — a plate of modules is a modular export', () => {
    const mono = { ...pp, seam_mode: 'mono' as const }
    expect(() =>
      buildKitPlateThreeMf({ parts: kitParts(mono), filamentMap: fmHeavenEarth })
    ).toThrow(/seam_mode "mono"/)
  })

  it('refuses an overfull bed rather than shipping a partial kit', () => {
    expect(() => plateOf({ bed: { wMm: 150, dMm: 150 } })).toThrow(KitPlateFitError)
  })
})
