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
 *      into the roomier clear gap beside the centered footprint.
 * A bed-centered single object is where auto-arrange would leave it anyway, so the
 * owned tower stays clear under THH's default (no `--arrange`) slice — verified
 * exit 0 with all filaments used, no THH-side change required.
 *
 * This is the multicolor path only. The single-filament export still rides
 * `meshesToThreeMf` unchanged (one object already slices clean).
 */
import { strToU8, zipSync } from 'fflate'
import type { BedSize } from '@eink/frames-engine/print-bundle'

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
// from the model so a mm of arrange jitter can't touch it.
const TOWER_W = 45
const TOWER_D = 40
const TOWER_GAP = 6

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
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length === 6) h += 'FF'
  return `#${h.toUpperCase()}`
}

/** Normalize to `#RRGGBB` for the slicer's `filament_colour` list. */
function filamentColor(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
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

/**
 * Pin the prime tower into the roomier clear gap beside a bed-centered footprint.
 * Tries the sides in descending free-room order (right / front / back / left),
 * takes the first whose reserve fits on the bed and clears every keep-out zone.
 * Not a packing algorithm — one object, one tower, pick the side with room.
 */
function placeWipeTower(bed: BedSize, obj: Box): { xMm: number; yMm: number } {
  const margin = bed.marginMm ?? 0
  const excludes: Box[] = (bed.exclude ?? []).map((e) => ({
    x0: e.xMm,
    y0: e.yMm,
    x1: e.xMm + e.wMm,
    y1: e.yMm + e.dMm,
  }))
  const cx = (obj.x0 + obj.x1) / 2
  const cy = (obj.y0 + obj.y1) / 2

  // candidate min-corners on each side, ordered by how much room that side has
  const sides = [
    { room: bed.wMm - margin - obj.x1, x: obj.x1 + TOWER_GAP, y: cy - TOWER_D / 2 }, // right
    { room: obj.y0 - margin, x: cx - TOWER_W / 2, y: obj.y0 - TOWER_GAP - TOWER_D }, // front
    { room: bed.dMm - margin - obj.y1, x: cx - TOWER_W / 2, y: obj.y1 + TOWER_GAP }, // back
    { room: obj.x0 - margin, x: obj.x0 - TOWER_GAP - TOWER_W, y: cy - TOWER_D / 2 }, // left
  ].sort((a, b) => b.room - a.room)

  for (const s of sides) {
    const x = clamp(s.x, margin, bed.wMm - margin - TOWER_W)
    const y = clamp(s.y, margin, bed.dMm - margin - TOWER_D)
    const rect: Box = { x0: x, y0: y, x1: x + TOWER_W, y1: y + TOWER_D }
    const onBed = x >= margin && y >= margin && rect.x1 <= bed.wMm - margin && rect.y1 <= bed.dMm - margin
    const clearObj = !intersects(rect, obj)
    const clearExcl = !excludes.some((e) => intersects(rect, e))
    if (onBed && clearObj && clearExcl) return { xMm: x, yMm: y }
  }
  throw new Error(
    'abacus is too large to fit a prime tower on the print bed — reduce the size or filament count'
  )
}

/**
 * Assemble co-registered per-filament bodies into one bed-centered printable
 * object with an owned prime tower. Multicolor only (`bodies.length >= 2`).
 */
export function assembleAbacus3mf(bodies: readonly AssemblyBody[], bed: BedSize): Assembled3mf {
  if (bodies.length < 2) {
    throw new Error('assembleAbacus3mf needs >= 2 filament bodies (single color rides meshesToThreeMf)')
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
  const tower = placeWipeTower(bed, objBox)

  // ---- 3D/3dmodel.model ----
  const childIds = bodies.map((_, i) => i + 2)
  const baseEntries = bodies
    .map((b, i) => `<base name="${escapeXml(b.label)}" displaycolor="${displayColor(b.colorHex)}"/>`)
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
  const projectSettings = JSON.stringify({
    filament_colour: bodies.map((b) => filamentColor(b.colorHex)),
    filament_map_mode: 'Manual',
    filament_map: bodies.map(() => '1'),
    wipe_tower_x: fmt(tower.xMm),
    wipe_tower_y: fmt(tower.yMm),
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
