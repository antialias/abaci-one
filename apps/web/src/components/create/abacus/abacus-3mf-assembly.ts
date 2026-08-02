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
 * Both survive THH's slice for the same reason: a 3MF that carries
 * `Metadata/project_settings.config` is a *project* file, and Orca skips arrange
 * entirely for one (`need_arrange=0` in the log). So our transform and our pin are
 * honoured as written — verified exit 0 with all filaments used, no THH-side change
 * required. Centering is for bed margin, not for surviving arrange; it's the
 * pre-fix files, which shipped no `Metadata/`, that got arranged and scattered.
 *
 * That last sentence holds only while the gap is wide enough. With supports on the
 * first layer reaches past the model outline while the tower's own brim reaches back
 * toward it; in a 6 mm gap the two extrusions meet and Orca's post-slice conflict
 * check fails the plate (exit 155). That is why `placeWipeTower` takes the options
 * — see SUPPORT_SKIRT.
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
  /** Orca's wipe_tower_x/y pin (mm, bed frame) — surfaced for the THH job contract. */
  readonly wipeTower: { readonly xMm: number; readonly yMm: number }
}

export interface WipeTowerProfileGeometry {
  readonly profile: string
  readonly envelopeMm: {
    readonly minX: number
    readonly minY: number
    readonly maxX: number
    readonly maxY: number
  }
  readonly process: {
    readonly prime_tower_width: number
    readonly prime_tower_brim_width: number
    readonly wipe_tower_wall_type: string
  }
}

/** Download/back-compat twin of THH's v1 bounded profile. The print path replaces this
 * with the selected printer's advertised copy, so a deploy can update geometry without
 * an Abaci release. */
export const DEFAULT_WIPE_TOWER_PROFILE: WipeTowerProfileGeometry = {
  profile: 'orca-rectangle-60-v1',
  envelopeMm: { minX: -4, minY: -4, maxX: 66, maxY: 56 },
  process: {
    prime_tower_width: 60,
    prime_tower_brim_width: 3,
    wipe_tower_wall_type: 'rectangle',
  },
}

export interface Assemble3mfOpts {
  /** Bounded profile advertised by the selected THH printer. */
  readonly wipeTower?: WipeTowerProfileGeometry
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
   *  setting), but the tower needs a wider gap, because supports push the first
   *  layer past the model outline and Orca's post-slice conflict check rejects a
   *  plate whose tower extrusion touches the model's — "gcode path conflicts found
   *  between WipeTower and abacus" (exit 155). That is what prod hit on 2026-07-29.
   *  See SUPPORT_SKIRT. `support` implies this. */
  readonly supportsAtSlice?: boolean
}

/** Download fallback. Print submission uses the selected printer's live bed geometry. */
export const BAMBU_256_BED: BedSize = {
  wMm: 256,
  dMm: 256,
  exclude: [{ xMm: 0, yMm: 0, wMm: 18, dMm: 28 }],
}

const TOWER_GAP = 6

// Extra reserve once supports are on: the first layer stops being the model's own
// footprint. Support material grows outward from the overhangs it holds, so extrusion
// reaches past the model outline. Measured 2026-07-29 from THH's supports-on slice
// (the `Support` feature's extents vs the declared object box): 1.47 mm on the sides,
// 5.32 mm at the front, 1.32 mm at the back. SUPPORT_SKIRT reserves the worst case
// with headroom.
//
// WHY 1.5 mm MATTERS MORE THAN IT LOOKS — the exit-155 chain. The gap has to hold two
// growths, not one: the model's, and the tower's own brim (`prime_tower_brim_width` 3,
// which extends back toward the model). TOWER_GAP alone is 6 mm, so with supports on
// prod was left ~1.5 mm of real clearance, and a model brim (`brim_width` 5, auto_brim)
// closes even that. Orca's post-slice `gcode path conflicts check` then fails the
// plate: "gcode path conflicts found between WipeTower and abacus" (exit 155).
// Widening the gap is what Orca's own error text prescribes — "try moving the wipe
// tower further from other models".
//
// NOT A ROTATION. An earlier version of this comment claimed supports make Orca
// re-arrange and rotate the plate; that was a measurement error on our side (the
// `Outer wall` extents include the prime tower, so moving the pin changed the bounding
// box and looked like a transposed model). Two direct observations from our own slice
// disprove it: the log says `before arrange, need_arrange=0` — arrange never runs on a
// 3MF project — and the model printed at its declared min corner (declared 90.25,77.75
// vs printed 90.46,75.96), in its declared orientation. Distance is the only lever.
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

/**
 * Pin the prime tower into a gap that stays clear of the model.
 *
 * The tower goes beside the model: the sides are tried in descending free-room
 * order (right / front / back / left) and the first that fits on the bed and clears
 * every keep-out zone wins. With supports on, the keep-out is the model grown by
 * SUPPORT_SKIRT, so the gap widens far enough that the tower's brim can never reach
 * the model's support extrusion (see SUPPORT_SKIRT).
 *
 * The rectangle being packed is THH's pin-relative reservation — not
 * `prime_tower_width`, and not a guessed min corner. That distinction is the whole
 * contract: Orca's real bbox extends on both sides of its x/y pin and changes with
 * purge inputs. THH verifies the output remains within this reservation.
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
  const profile = opts.wipeTower ?? DEFAULT_WIPE_TOWER_PROFILE
  const envelope = profile.envelopeMm
  const pinMidX = (envelope.minX + envelope.maxX) / 2
  const pinMidY = (envelope.minY + envelope.maxY) / 2

  // What the tower must stay off. Supports push the first layer outward, so the
  // keep-out is the model plus SUPPORT_SKIRT — and the side candidates below hug
  // THAT box, which is the whole fix: supports simply widen the gap, so the tower's
  // brim and the model's support extrusion can never meet.
  const supportSkirt = opts.support === true || opts.supportsAtSlice === true ? SUPPORT_SKIRT : 0
  const grown = supportSkirt > 0 ? inflate(obj, supportSkirt) : obj
  const keepOut: Box[] = [grown]

  // Candidate PINS on each side, ordered by free room. Convert the desired reservation
  // edge back through its pin-relative offset; wipe_tower_x/y is not the bbox min corner.
  const sides = [
    {
      room: bed.wMm - margin - grown.x1,
      x: grown.x1 + TOWER_GAP - envelope.minX,
      y: cy - pinMidY,
    }, // right
    {
      room: grown.y0 - margin,
      x: cx - pinMidX,
      y: grown.y0 - TOWER_GAP - envelope.maxY,
    }, // front
    {
      room: bed.dMm - margin - grown.y1,
      x: cx - pinMidX,
      y: grown.y1 + TOWER_GAP - envelope.minY,
    }, // back
    {
      room: grown.x0 - margin,
      x: grown.x0 - TOWER_GAP - envelope.maxX,
      y: cy - pinMidY,
    }, // left
  ].sort((a, b) => b.room - a.room)

  const fits = (pinX: number, pinY: number): Box | null => {
    const rect: Box = {
      x0: pinX + envelope.minX,
      y0: pinY + envelope.minY,
      x1: pinX + envelope.maxX,
      y1: pinY + envelope.maxY,
    }
    const onBed =
      rect.x0 >= margin &&
      rect.y0 >= margin &&
      rect.x1 <= bed.wMm - margin &&
      rect.y1 <= bed.dMm - margin
    const clear = ![...keepOut, ...excludes].some((k) => intersects(rect, k))
    return onBed && clear ? rect : null
  }

  for (const s of sides) {
    const x = clamp(s.x, margin - envelope.minX, bed.wMm - margin - envelope.maxX)
    const y = clamp(s.y, margin - envelope.minY, bed.dMm - margin - envelope.maxY)
    if (fits(x, y)) return { xMm: x, yMm: y }
  }

  // No side works: push the reservation into each bed corner and keep whichever sits
  // furthest from hot extrusion. This is a last resort for unusually full plates.
  const nearX = margin + TOWER_EDGE - envelope.minX
  const farX = bed.wMm - margin - TOWER_EDGE - envelope.maxX
  const nearY = margin + TOWER_EDGE - envelope.minY
  const farY = bed.dMm - margin - TOWER_EDGE - envelope.maxY
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
    // Direct-download slices use the same bounded shape as API prints. THH owns and
    // re-applies these on submit; embedding them here keeps the standalone 3MF honest.
    prime_tower_width: fmt(
      (opts.wipeTower ?? DEFAULT_WIPE_TOWER_PROFILE).process.prime_tower_width
    ),
    prime_tower_brim_width: fmt(
      (opts.wipeTower ?? DEFAULT_WIPE_TOWER_PROFILE).process.prime_tower_brim_width
    ),
    wipe_tower_wall_type: (opts.wipeTower ?? DEFAULT_WIPE_TOWER_PROFILE).process
      .wipe_tower_wall_type,
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
