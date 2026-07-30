/**
 * Multicolor abacus → ONE print-ready `.3mf` object (Gitea #5).
 *
 * WHY THIS EXISTS. The shared `meshesToThreeMf` emits one *separate* top-level
 * `<object>` per filament — perfect for the receipt path (QR pads nested in cover
 * wells), fatal for the abacus. The abacus prints IN PLACE: the beads are free
 * shells trapped in the frame's channels at 0.25 mm clearance. As four separate
 * objects, OrcaSlicer's auto-arrange pulls them apart (beads scatter out of the
 * frame) and its auto-placed prime tower lands in an invalid spot → the
 * multi-extruder gcode check rejects the plate (`exit 154`, "unprintable area").
 * Reproduced and root-caused on THH's sidecar 2026-07-23.
 *
 * WHAT THIS DOES INSTEAD. It welds the co-registered per-filament bodies into ONE
 * printable object — a `<components>` assembly that references each colored mesh
 * as a `<part>` carrying its `extruder` index — so the whole abacus translates as
 * a unit and the beads stay threaded. Then it OWNS the layout the way THH's slicer
 * won't do safely on its own:
 *   1. the object is centered on the target bed (build-item transform), and
 *   2. the prime tower is pinned (`wipe_tower_x/y` in `project_settings.config`)
 *      into a gap that clears the model.
 * A bed-centered single object is where auto-arrange would leave it anyway, so the
 * owned tower stays clear under THH's default (no `--arrange`) slice — verified
 * exit 0 with all filaments used, no THH-side change required.
 *
 * That last sentence holds only while supports are off. Turning them on makes Orca
 * hand the model back rotated a quarter turn, which is why `placeWipeTower` takes
 * the options — see SUPPORT_SKIRT.
 *
 * This is the multicolor path only. The single-filament export still rides
 * `meshesToThreeMf` unchanged (one object already slices clean).
 */

import type { BedSize } from '@eink/frames-engine/print-bundle'
import { strToU8, zipSync } from 'fflate'

/** A co-registered, single-filament body: its triangle soup (9 floats/tri, in the
 *  shared render pose) plus the filament it prints on. */
export interface AssemblyBody {
  /** Triangle soup — every triangle three consecutive (x,y,z) vertices, mm. */
  readonly positions: Float32Array
  /** Display/filament color: `#RGB`, `#RRGGBB`, or `#RRGGBBAA`. */
  readonly colorHex: string
  /** Object/part name shown in the slicer. */
  readonly label: string
  /** 1-based filament index (extruder / AMS slot) this body prints on. */
  readonly extruder: number
}

export interface Assembled3mf {
  readonly bytes: Uint8Array
  /** The pinned prime-tower min corner (mm, bed frame) — surfaced for tests. */
  readonly wipeTower: { readonly xMm: number; readonly yMm: number }
}

export interface Assemble3mfOpts {
  /** Bake support-enabling keys into `project_settings.config` (printed TPU feet,
   *  Gitea #23: the whole bottom face prints on plate-grown supports + interface).
   *  Also relaxes the >= 2 bodies guard: a printed-feet export must ride the
   *  assembly path even single-bodied (the no-TPU fallback merges feet into the
   *  frame slot), because a `meshesToThreeMf` file carries no project settings and
   *  a directly-sliced download would print the raised bottom face unsupported. */
  readonly support?: boolean
  /** Supports will be ON when the SUBMITTED print is sliced, for a reason other
   *  than printed feet — the operator's ticket style turned `enable_support` on,
   *  which any design can do. Placement only: nothing is baked into
   *  `project_settings.config` (a downloaded file must not inherit a print-panel
   *  setting), but the tower needs the wider gap, because supports grow the first
   *  layer past the model outline and a tower crowding that growth makes Orca
   *  re-arrange the plate — rotating the model out from under our pinned tower and
   *  killing the slice with "gcode path conflicts found between WipeTower and
   *  abacus" (exit 155). That is what prod hit on 2026-07-29. See SUPPORT_SKIRT.
   *  `support` implies this. */
  readonly supportsAtSlice?: boolean
}

/** The Bambu 256×256 plate (X1C / P1S / A1) with the front-left filament-cutter
 *  keep-out — the studio's multicolor/AMS target. Not fed from THH today (the wire
 *  carries no bed geometry); a printer-supplied `BedSize` can replace it later. */
export const BAMBU_256_BED: BedSize = {
  wMm: 256,
  dMm: 256,
  exclude: [{ xMm: 0, yMm: 0, wMm: 18, dMm: 28 }],
}

// Prime-tower footprint reserve. OrcaSlicer's default `prime_tower_width` (35 mm)
// slices to ~41×35 mm including its brim; we reserve a hair more and keep a gap
// from the model so a mm of arrange jitter can't touch it. Measured on THH's
// sidecar at 5 filaments: the tower's extrusion spans 42.0 × 38.6 mm.
const TOWER_W = 45
const TOWER_D = 40
const TOWER_GAP = 6

// Extra reserve once supports are on: the first layer stops being the model's own
// footprint. Supports grow outward from the overhangs they hold and take a brim, so
// extrusion reaches past the model outline — measured on THH's sidecar 2026-07-29
// from a printed-feet slice, 7.45 mm past the declared front edge (`brim_width` 5 +
// `support_object_xy_distance` 0.35 + the support's own outward reach). SUPPORT_SKIRT
// reserves that with a little headroom.
//
// WHY THIS MATTERS MORE THAN IT LOOKS — the exit-155 chain. TOWER_GAP alone is 6 mm,
// so once supports are on the tower's brim overlaps that growth. Orca then judges the
// plate layout invalid and AUTO-ARRANGES it; the CLI runs with `allow_rotations 1`
// (visible in cli.log), so arrange turns the model a quarter turn about bed centre.
// Our tower is pinned in absolute bed coordinates, so it does not follow — it ends up
// underneath the rotated model, and slicing dies with "gcode path conflicts found
// between WipeTower and abacus" (exit 155).
//
// The rotation is therefore a SYMPTOM, not a behaviour of supports: keep the layout
// valid and arrange never runs. Proof from two slices of the same model on the
// sidecar, differing only in the pin: tower (195, 200) printed 192.08 × 100.08 (our
// declared orientation), tower (200, 200) printed 100.08 × 192.08 (transposed). 5 mm
// of pin flipped it. So the fix is to widen the GAP, not to chase the rotated pose.
const SUPPORT_SKIRT = 8
// How far a cornered tower keeps off the bed edge. The reserve above covers the
// tower's own extrusion, but a tower pushed flush into the corner still trips the
// multi-extruder printable-area check (exit 154, "gcode in unprintable area") —
// measured on the sidecar. 16 mm back from both edges slices clean.
const TOWER_EDGE = 16

const ASSEMBLY_ID = 1000 // printable object id; child meshes take 2..N+1

/** Compact mm formatter: fixed 3-decimals (µm), trailing zeros trimmed. */
function fmt(v: number): string {
  let s = v.toFixed(3)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Normalize any accepted hex to a full 8-digit `#RRGGBBAA` (3MF displaycolor). */
function displayColor(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  if (h.length === 6) h += 'FF'
  return `#${h.toUpperCase()}`
}

/** Normalize to `#RRGGBB` for the slicer's `filament_colour` list. */
function filamentColor(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  return `#${h.slice(0, 6).toUpperCase()}`
}

/** Weld a body's triangle soup to indexed geometry (µm quantization) and emit the
 *  3MF `<vertices>`/`<triangles>` XML. Welding is per-body — bodies never merge. */
function emitBodyMesh(positions: Float32Array): { verts: string; tris: string } {
  const index = new Map<string, number>()
  const coords: number[] = []
  const tri: number[] = []
  const n = (positions.length / 9) | 0
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < 3; k++) {
      const o = t * 9 + k * 3
      const x = positions[o]
      const y = positions[o + 1]
      const z = positions[o + 2]
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`
      let id = index.get(key)
      if (id === undefined) {
        id = coords.length / 3
        index.set(key, id)
        coords.push(x, y, z)
      }
      tri.push(id)
    }
  }
  let verts = ''
  for (let i = 0; i < coords.length; i += 3) {
    verts += `<vertex x="${fmt(coords[i])}" y="${fmt(coords[i + 1])}" z="${fmt(coords[i + 2])}"/>`
  }
  let tris = ''
  for (let i = 0; i < tri.length; i += 3) {
    tris += `<triangle v1="${tri[i]}" v2="${tri[i + 1]}" v3="${tri[i + 2]}"/>`
  }
  return { verts, tris }
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
const intersects = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** Grow a box outwards by `d` on every side. */
function inflate(b: Box, d: number): Box {
  return { x0: b.x0 - d, y0: b.y0 - d, x1: b.x1 + d, y1: b.y1 + d }
}

/** The box turned a quarter turn about the bed centre — where Orca puts the model
 *  when it decides to re-orient it (see SUPPORT_SKIRT). */
function rotate90(b: Box, bed: BedSize): Box {
  const cx = bed.wMm / 2
  const cy = bed.dMm / 2
  const halfW = (b.x1 - b.x0) / 2
  const halfD = (b.y1 - b.y0) / 2
  return { x0: cx - halfD, y0: cy - halfW, x1: cx + halfD, y1: cy + halfW }
}

/**
 * Pin the prime tower into a gap that stays clear of the model.
 *
 * The tower goes beside the model: the sides are tried in descending free-room
 * order (right / front / back / left) and the first that fits on the bed and clears
 * every keep-out zone wins. With supports on, the keep-out is the model grown by
 * SUPPORT_SKIRT, so the gap widens — that is what keeps Orca from re-arranging the
 * plate and rotating the model out from under the pin (see SUPPORT_SKIRT).
 *
 * The corner fallback is a last resort for a footprint no side can hold, and for
 * the printed-feet reserve, which also treats the rotated pose as keep-out and so
 * usually has nothing but corners left. Not a packing algorithm: one object, one
 * tower, take the first spot that clears everything.
 */
function placeWipeTower(
  bed: BedSize,
  obj: Box,
  opts: Assemble3mfOpts = {}
): { xMm: number; yMm: number } {
  const margin = bed.marginMm ?? 0
  const excludes: Box[] = (bed.exclude ?? []).map((e) => ({
    x0: e.xMm,
    y0: e.yMm,
    x1: e.xMm + e.wMm,
    y1: e.yMm + e.dMm,
  }))
  const cx = (obj.x0 + obj.x1) / 2
  const cy = (obj.y0 + obj.y1) / 2

  // What the tower must stay off. Supports grow the first layer outward, so the
  // keep-out is the model plus SUPPORT_SKIRT — and the side candidates below hug
  // THAT box, which is the whole fix: supports simply widen the gap, keeping the
  // layout valid so Orca never auto-arranges (and so never rotates the model).
  const feetSupport = opts.support === true
  const grown = feetSupport || opts.supportsAtSlice === true ? inflate(obj, SUPPORT_SKIRT) : obj

  // The rotated pose is only reachable once the layout is ALREADY invalid, so a
  // wide enough gap makes it unreachable. The printed-feet path keeps defending
  // against it anyway: its reserve was verified on the sidecar at one specific
  // cornered pin, and re-placing it here would invalidate that without a fresh
  // slice to back the new spot. Worth unifying once the sidecar can run an A/B
  // again — cornering is itself close to the pins that trip arrange.
  const keepOut: Box[] = feetSupport ? [grown, rotate90(grown, bed)] : [grown]

  // candidate min-corners on each side, ordered by how much room that side has
  const sides = [
    { room: bed.wMm - margin - grown.x1, x: grown.x1 + TOWER_GAP, y: cy - TOWER_D / 2 }, // right
    { room: grown.y0 - margin, x: cx - TOWER_W / 2, y: grown.y0 - TOWER_GAP - TOWER_D }, // front
    { room: bed.dMm - margin - grown.y1, x: cx - TOWER_W / 2, y: grown.y1 + TOWER_GAP }, // back
    { room: grown.x0 - margin, x: grown.x0 - TOWER_GAP - TOWER_W, y: cy - TOWER_D / 2 }, // left
  ].sort((a, b) => b.room - a.room)

  const fits = (x: number, y: number): Box | null => {
    const rect: Box = { x0: x, y0: y, x1: x + TOWER_W, y1: y + TOWER_D }
    const onBed =
      x >= margin && y >= margin && rect.x1 <= bed.wMm - margin && rect.y1 <= bed.dMm - margin
    const clear = ![...keepOut, ...excludes].some((k) => intersects(rect, k))
    return onBed && clear ? rect : null
  }

  for (const s of sides) {
    const x = clamp(s.x, margin, bed.wMm - margin - TOWER_W)
    const y = clamp(s.y, margin, bed.dMm - margin - TOWER_D)
    if (fits(x, y)) return { xMm: x, yMm: y }
  }

  // No side works, which under supports is the normal case: the two poses cross
  // in the middle of the bed and leave only the corners. Push the tower right
  // into each bed corner — the far corner of a contested bed is exactly where you
  // want it — and keep whichever sits furthest from hot extrusion. Corners work
  // because the escape axis can differ per pose: the winner is typically "beside
  // the declared footprint AND past the end of the rotated one".
  const nearX = margin + TOWER_EDGE
  const farX = bed.wMm - margin - TOWER_EDGE - TOWER_W
  const nearY = margin + TOWER_EDGE
  const farY = bed.dMm - margin - TOWER_EDGE - TOWER_D
  const corners = [
    { x: farX, y: farY },
    { x: nearX, y: farY },
    { x: farX, y: nearY },
    { x: nearX, y: nearY },
  ]
  let best: { xMm: number; yMm: number; room: number } | null = null
  for (const c of corners) {
    const rect = fits(c.x, c.y)
    if (!rect) continue
    const room = Math.min(
      ...[...keepOut, ...excludes].map((k) =>
        Math.max(k.x0 - rect.x1, rect.x0 - k.x1, k.y0 - rect.y1, rect.y0 - k.y1)
      )
    )
    if (!best || room > best.room) best = { xMm: c.x, yMm: c.y, room }
  }
  if (best) return { xMm: best.xMm, yMm: best.yMm }

  throw new Error(
    'abacus is too large to fit a prime tower on the print bed — reduce the size or filament count'
  )
}

/**
 * Assemble co-registered per-filament bodies into one bed-centered printable
 * object with an owned prime tower. Multicolor only (`bodies.length >= 2`).
 */
export function assembleAbacus3mf(
  bodies: readonly AssemblyBody[],
  bed: BedSize,
  opts: Assemble3mfOpts = {}
): Assembled3mf {
  if (bodies.length === 0) {
    throw new Error('assembleAbacus3mf needs at least one filament body')
  }
  if (bodies.length < 2 && !opts.support) {
    throw new Error(
      'assembleAbacus3mf needs >= 2 filament bodies (single color rides meshesToThreeMf)'
    )
  }

  // Merged bounding box across every body (shared render pose).
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of bodies) {
    const p = b.positions
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < minX) minX = p[i]
      if (p[i] > maxX) maxX = p[i]
      if (p[i + 1] < minY) minY = p[i + 1]
      if (p[i + 1] > maxY) maxY = p[i + 1]
      if (p[i + 2] < minZ) minZ = p[i + 2]
    }
  }

  // Center the footprint on the bed and drop it to z=0.
  const bedCx = bed.wMm / 2
  const bedCy = bed.dMm / 2
  const tx = bedCx - (minX + maxX) / 2
  const ty = bedCy - (minY + maxY) / 2
  const tz = -minZ

  const objBox: Box = {
    x0: bedCx - (maxX - minX) / 2,
    y0: bedCy - (maxY - minY) / 2,
    x1: bedCx + (maxX - minX) / 2,
    y1: bedCy + (maxY - minY) / 2,
  }
  const tower = placeWipeTower(bed, objBox, opts)

  // ---- 3D/3dmodel.model ----
  const childIds = bodies.map((_, i) => i + 2)
  const baseEntries = bodies
    .map(
      (b, i) => `<base name="${escapeXml(b.label)}" displaycolor="${displayColor(b.colorHex)}"/>`
    )
    .join('')
  const objectsXml = bodies
    .map((b, i) => {
      const { verts, tris } = emitBodyMesh(b.positions)
      // object-level pid/pindex paints the whole body for core-3MF slicers
      // (PrusaSlicer/Cura); Bambu/Orca color comes from the part `extruder` below.
      return `<object id="${childIds[i]}" type="model" pid="1" pindex="${i}"><mesh><vertices>${verts}</vertices><triangles>${tris}</triangles></mesh></object>`
    })
    .join('')
  const componentsXml = childIds
    .map((id) => `<component objectid="${id}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`)
    .join('')
  const assemblyXml = `<object id="${ASSEMBLY_ID}" type="model"><components>${componentsXml}</components></object>`
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources><basematerials id="1">${baseEntries}</basematerials>${objectsXml}${assemblyXml}</resources>` +
    `<build><item objectid="${ASSEMBLY_ID}" transform="1 0 0 0 1 0 0 0 1 ${fmt(tx)} ${fmt(ty)} ${fmt(tz)}"/></build>` +
    `</model>`

  // ---- Metadata/model_settings.config (Bambu/Orca per-part extruder) ----
  const partsXml = bodies
    .map(
      (b, i) =>
        `<part id="${childIds[i]}" subtype="normal_part"><metadata key="name" value="${escapeXml(b.label)}"/><metadata key="extruder" value="${b.extruder}"/></part>`
    )
    .join('')
  const modelSettings =
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>` +
    `<object id="${ASSEMBLY_ID}"><metadata key="name" value="abacus"/>${partsXml}</object>` +
    `</config>`

  // ---- Metadata/project_settings.config (owned tower + filament pin) ----
  // `filament_map` pins every filament to AMS group 1 (single-extruder X1C/A1) —
  // defeats Orca's filament-grouping rejection (exit 156). THH re-sets these on its
  // side; we include them so a directly-sliced download is correct too.
  //
  // The support block (printed feet, Gitea #23) is the same belt: THH re-derives
  // support policy from the ticket style, but a direct download must slice with
  // the bottom face supported on its own. `support_on_build_plate_only` is load-
  // bearing — nothing may grow inside the bead channels or on the beads; the only
  // support this print wants rises plate→bottom-face. `support_interface_filament`
  // is deliberately absent: the interface spool isn't a 3MF body, THH owns that
  // key (computed from ticket filament order).
  const projectSettings = JSON.stringify({
    filament_colour: bodies.map((b) => filamentColor(b.colorHex)),
    filament_map_mode: 'Manual',
    filament_map: bodies.map(() => '1'),
    wipe_tower_x: fmt(tower.xMm),
    wipe_tower_y: fmt(tower.yMm),
    ...(opts.support
      ? {
          enable_support: '1',
          support_type: 'normal(auto)',
          support_on_build_plate_only: '1',
          support_interface_top_layers: '2',
          support_top_z_distance: '0.2',
        }
      : {}),
  })

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    `</Types>`
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>` +
    `</Relationships>`

  const bytes = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    '3D/3dmodel.model': strToU8(model),
    'Metadata/model_settings.config': strToU8(modelSettings),
    'Metadata/project_settings.config': strToU8(projectSettings),
  })

  return { bytes, wipeTower: tower }
}
