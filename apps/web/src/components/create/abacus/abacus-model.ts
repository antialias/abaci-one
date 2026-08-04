// Abacus Studio — pure parametric model logic (graduated verbatim from the
// off-stack bench's main.ts; see Gitea epic #5, Phase 0 #6).
//
// SPEC: apps/web/docs/abacus-studio/master-model-spec.md — anatomy, the
// locked-vs-proportional dimension model, and the constant-clearance proof this
// module's `derived()` implements.
//
// This module is framework-free and three-free: it turns the intent-knob
// parameter surface into the `-D` defines the OpenSCAD-WASM worker renders, and
// it carries the myabacus color / AMS-filament model plus the union-find shell
// classifier used to recolor a rendered STL without re-rendering. The viewer
// component owns all three.js; this file owns all geometry math + color mapping.
//
// INTENT KNOBS ONLY: every raw coordinate (frame_d, col_pitch, end_margin,
// earth_pitch, heaven_y, throw spans) is DERIVED here and in the .scad from the
// knobs (cols/earth/web/print_gap/throw/bar/shelf). Incoherent layouts are
// unrepresentable — the frame is built around wherever the beads land. The
// `clearance` + `print_gap` gaps are ABSOLUTE (held constant while everything
// else scales with `scale_factor`), which is what keeps the printed fit constant
// across sizes — the load-bearing result Phase 0 set out to prove.

// The canonical bead-color resolver, shared with the on-screen abacus. Imported
// from the React-free `./color` subpath so this module stays framework-free.
import { BEAD_COLOR_PALETTES, beadColorActive } from '@soroban/abacus-react/color'

// ---- parameters -------------------------------------------------------------
export const defaultParams = {
  // frame
  frame_h: 8,
  border_w: 5.25,
  corner_r: 4,
  // grid (everything else is derived from these)
  cols: 13,
  earth: 4,
  web: 2.5, // wall between channels        (→ col_pitch 13.0)
  print_gap: 2, // printed air between beads, absolute (→ rest pitch 10)
  throw: 10, // slide distance of a bead group (→ master's earth channel)
  bar: 7.5, // reckoning-bar clear width      (→ classic 90mm field)
  shelf: 7.75, // solid margin inside the field  (→ strip 13.0, tile-tight)
  // bead
  bead_dia: 10,
  bead_len: 8,
  bead_proud: 4,
  // locked (the mixed-scaling spine — stay constant as you scale)
  clearance: 0.25,
  top_chamfer: 1,
  marker_mm: 12,
  // myabacus style (abaci.one AbacusDisplayConfig projection)
  color_scheme: 'place-value',
  color_palette: 'default',
  scale_factor: 1.0,
  bead_shape: 'spool',
  frame_color: '#c9a26e',
  // filament palette (AMS): up to 8 loaded slots; every style role is quantized
  // onto them (see computeFilamentMap).
  filament_count: 8,
  filament_1: '#c9a26e',
  filament_2: '#f5f5f5',
  filament_3: '#111111',
  filament_4: '#2E86AB',
  filament_5: '#A23B72',
  filament_6: '#F18F01',
  filament_7: '#6A994E',
  filament_8: '#BC4B51',
  // Perimeter text (Gitea #28) — eight slots: 4 top-face rails + 4 outer side
  // walls, every one of them authorable as space-separated words.
  //
  // The two teaching aids are NOT stored per-rail. `aid_10`/`aid_5` hold the
  // INTENT ('off' | 'auto' | a named rail) and the rail is DERIVED on every
  // read by placeAids(). That's what makes 'auto' safe: which rails have room
  // changes with the column count (the top rail shrinks with `cols`, the sides
  // never do), so a stored rail plus an automatic placer would be two truths
  // free to disagree — the same argument that retired `feet_preset`. Nothing is
  // ever written back, so opening a saved design can't mutate it, detach
  // `synced`, or change its content hash.
  //
  // Pre-#28 designs stored `<rail>_preset` instead; design-snapshot.ts
  // translates those (an aid no rail claimed becomes 'off', not 'auto', so a
  // legacy design that deliberately blanked a rail stays blank).
  aid_10: 'auto',
  aid_5: 'auto',
  top_text: '',
  bottom_text: '',
  left_text: '',
  right_text: '',
  edge_front: '',
  edge_back: '',
  edge_left: '',
  edge_right: '',
  text_mode: 'inset',
  text_fill: 'rainbow',
  text_color: '#f5f5f5',
  text_size: 6,
  edge_text_size: 5,
  // feet (bottom face; absolute — real feet don't scale). feet_mode:
  // 'printed' = in-place TPU feet (the default: the print stands on them,
  // frame bottom on supports); 'adhesive' = empty pockets for stick-on feet;
  // 'none'. feet_retention (printed only): 'crossbar' threads a frame bar
  // through each foot — topologically captive; 'dovetail' = flare only.
  // Old saved designs carried `feet`/`feet_preset`/`retention` keys — those
  // names are gone, so the snapshot parser silently drops them and every
  // legacy design loads with these defaults (deliberate: printed feet are
  // the point of Gitea #23, and the old knobs were UI-unreachable).
  feet_mode: 'printed',
  feet_shape: 'circle',
  feet_w: 9,
  feet_depth: 1.5, // adhesive pocket depth (printed crossbar derives its own)
  feet_fit: 0.15,
  feet_undercut: 0,
  feet_span: 110, // max unsupported bottom run (mm @ scale 1) before mid feet
  feet_proud: 1.6, // printed: stand-off below the bottom face (absolute mm)
  feet_retention: 'crossbar',
  // modular columns — the AbacusLink prototype (docs/abacus-studio/
  // modular-columns-spec.md). 'mono' is the shipped one-piece abacus and every
  // derivation below reduces to its pre-modular form under it.
  //
  // 'modular' raises TWO DIMENSION FLOORS and nothing else in this revision: the
  // seam splits the inter-channel web down its middle (so each module keeps half
  // of it, and half of 2.5 is thinner than a printable wall), and the end strips
  // have to hold a latch tongue AND a foot pocket, which don't fit in the mono
  // border's 13 mm strip. The assembled abacus is still ONE solid — only the
  // link_coupon / link_column part passes emit modular geometry. See the scad's
  // note on analyzeShells for why the topology change waits.
  link_mode: 'mono',
  link_web: 4.5, // modular floor on `web` — 2.25 mm of wall per module
  link_border: 7.0, // modular floor on `border_w` — a 14.75 mm strip
  link_ramp: 8, // cam ramp °, off the tongue's travel; self-locking under ~16.7
  link_fit: 0.1, // per-face chevron groove clearance
  link_relief: 0.25, // flat-face standoff — the chevron flanks are the only contact
  link_bump: 1.1, // barb height = cam travel = the spread the joint can swallow
  link_slot_w: 1.4, // spring room past the tongue; must exceed link_bump
  link_foot_w: 6.35, // 1/4" bumper — the largest that clears the latch slot
  link_foot_d: 1.2,
  // toggles / quality
  show_frame: true,
  show_beads: true,
  show_markers: true,
  fn: 32,
}

export type Params = typeof defaultParams

// ---- project the app's AbacusDisplayConfig onto print params ----------------
// The toy opens showing the user's ACTUAL abacus: its column count and color
// identity carry over from their AbacusDisplayConfig (abacus_settings). This is
// a READ-ONLY projection — tweaking the toy never writes back to display
// settings. Only the abacus's IDENTITY maps (columns + colors); physical print
// size is intentionally NOT projected. The display `scaleFactor` is an on-screen
// zoom (someone who zoomed in for readability didn't ask for a giant print), so
// print size stays a deliberate fabrication choice made with the size knob.
//
// The input is a narrow structural type, not the react package's
// `AbacusDisplayConfig` — this module stays framework-free, and the caller
// passes just the four fields it reads.
export type DisplayConfigInput = {
  colorScheme: string
  colorPalette: string
  physicalAbacusColumns: number
}

// the scad asserts a 3-column floor; the app allows 1–21, so clamp the low end.
export const clampCols = (n: number): number => Math.max(3, Math.min(21, Math.round(n)))

export function paramsFromDisplayConfig(
  cfg: DisplayConfigInput,
  base: Params = defaultParams
): Params {
  return {
    ...base,
    cols: clampCols(cfg.physicalAbacusColumns),
    color_scheme: cfg.colorScheme,
    color_palette: cfg.colorPalette,
  }
}

// ---- perimeter text tokens --------------------------------------------------
// token → [string, fontIdx]; fontIdx 1 = Noto Emoji for emoji tokens (OpenSCAD
// has no per-glyph fallback, so mixed emoji+text inside ONE token will tofu).
export const tokenize = (s: string): [string, number][] =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => [t, /\p{Extended_Pictographic}/u.test(t) ? 1 : 0])

/** The four top-face rails, in the scad's rails() order. The four outer walls
 *  are words-only — no aid ever lands on a wall, whose glyph plane is a
 *  different orientation entirely and whose band is the frame height. */
export const TEXT_SLOTS = ['top', 'bottom', 'left', 'right'] as const
export type TextSlot = (typeof TEXT_SLOTS)[number]
export const SLOT_LABEL: Record<TextSlot, string> = {
  top: 'top rail',
  bottom: 'bottom rail',
  left: 'left side',
  right: 'right side',
}
/** Side rails are rotated ±90° (abacus.scad rails()), so their reading
 *  direction is a real cost the caption has to disclose. */
export const SLOT_READS: Partial<Record<TextSlot, string>> = {
  left: 'reads bottom→top',
  right: 'reads top→bottom',
}
export const slotWords = (p: Params, slot: TextSlot): string => p[`${slot}_text`]

export type AidKey = 'aid_10' | 'aid_5'
/** The two rail pairs. Placement is per-AXIS rather than per-rail so the aids
 *  stay MIRRORED — see aidPrefer. */
export type Axis = 'horizontal' | 'vertical'
export type Aid = {
  key: AidKey
  label: string
  tokens: string[]
  /** This aid's end of each axis: the rail it takes when the auto pair uses that
   *  axis. The horizontal pair is today's fixed layout exactly — friends-of-10
   *  on top, friends-of-5 on the bottom — so 'auto' reproduces it byte-for-byte
   *  wherever it still works (≥6 columns, where the glyph cap binds before the
   *  rail runs out). The vertical pair mirrors it across the frame. */
  home: Record<Axis, TextSlot>
}
export const AIDS: readonly Aid[] = [
  {
    key: 'aid_10',
    label: 'Friends of 10',
    tokens: ['1+9', '2+8', '3+7', '4+6', '5+5'],
    home: { horizontal: 'top', vertical: 'left' },
  },
  {
    key: 'aid_5',
    label: 'Friends of 5',
    tokens: ['1+4', '2+3', '3+2', '4+1'],
    home: { horizontal: 'bottom', vertical: 'right' },
  },
]
/** What 'auto' walks: this aid's end of the chosen axis, then the other aid's end
 *  of the same axis, then both ends of the far axis as a last resort.
 *
 *  Placing by axis rather than rail is what keeps the pair mirrored. Walking
 *  rails independently put friends-of-10 down the LEFT while friends-of-5 kept
 *  the BOTTOM at 5 columns — an L-shape around one corner, which reads as an
 *  accident rather than a layout. The far-axis tail only comes into play when the
 *  user's words already hold a rail. */
export const aidPrefer = (aid: Aid, axis: Axis): TextSlot[] => {
  const other = AIDS.find((a) => a.key !== aid.key) as Aid
  const far: Axis = axis === 'horizontal' ? 'vertical' : 'horizontal'
  return [aid.home[axis], other.home[axis], aid.home[far], other.home[far]]
}
export const AID_OPTS: readonly string[] = ['off', 'auto', ...TEXT_SLOTS]
/** Pre-#28 `<rail>_preset` ids → the aid they selected. Only design-snapshot.ts
 *  reads this; the UI has no notion of a per-rail preset any more. */
export const LEGACY_PRESET_AID: Record<string, AidKey> = {
  'friends-of-10': 'aid_10',
  'friends-of-5': 'aid_5',
}

// ---- derived layout — mirrors the scad's intent-knob chain EXACTLY -----------
// (same s_* math: clearance + print_gap absolute, everything else scales with S;
// shelf auto-grows so band+shelf always holds a corner ArUco tile).
export type Derived = {
  sShelf: number
  sCp: number
  sEm: number
  sEp: number
  sElo: number
  sEty: number
  sEhi: number
  sHlo: number
  sHhi: number
  sHy: number
  sFd: number
  mkI: number
  chamf: number
  frameW: number
  outerD: number
}
/** The modular dimension floors, mirroring the scad's `web_eff`/`border_w_eff`.
 *  `max` not assignment: a design that already asked for a fatter web or a wider
 *  brim keeps it — the floor raises, never lowers. Exported because the studio
 *  rail quotes the before/after size, and computing that a second time in the UI
 *  is how the readout and the geometry drift apart. */
export const isModular = (p: Params): boolean => p.link_mode === 'modular'
export const webEff = (p: Params): number => (isModular(p) ? Math.max(p.web, p.link_web) : p.web)
export const borderEff = (p: Params): number =>
  isModular(p) ? Math.max(p.border_w, p.link_border) : p.border_w

export const derived = (p: Params): Derived => {
  const S = p.scale_factor
  const cl = p.clearance
  const sBd = p.bead_dia * S
  const sBl = p.bead_len * S
  const sBw = borderEff(p) * S
  const sFh = p.frame_h * S
  const sCr = p.corner_r * S
  const chamf = Math.min(p.top_chamfer, sFh * 0.4)
  const mkI = Math.max(0, chamf, sCr <= 0 ? 0 : sCr - (sCr - chamf) / Math.SQRT2 - p.marker_mm / 9)
  const sShelf = Math.max(p.shelf * S, mkI + p.marker_mm - sBw)
  const sCp = sBd + 2 * cl + webEff(p) * S
  const sEm = sShelf + cl + sBd / 2
  const sEp = sBl + p.print_gap
  const sElo = sShelf + cl + sBl / 2
  const sEty = sElo + sEp * (p.earth - 1)
  const sEhi = sEty + p.throw * S
  const sHlo = sEhi + sBl + 2 * cl + p.bar * S
  const sHhi = sHlo + p.throw * S
  const sFd = sHhi + sBl / 2 + cl + sShelf
  const fieldW = 2 * sEm + (p.cols - 1) * sCp
  return {
    sShelf,
    sCp,
    sEm,
    sEp,
    sElo,
    sEty,
    sEhi,
    sHlo,
    sHhi,
    sHy: sHhi,
    sFd,
    mkI,
    chamf,
    frameW: fieldW + 2 * sBw,
    outerD: sFd + 2 * sBw,
  }
}
// OUTER dims: bead field (from cols) + the flush border band on each side.
export const frameW = (p: Params): number => derived(p).frameW
export const outerD = (p: Params): number => derived(p).outerD

// ---- -D defines the worker renders ------------------------------------------
// frame_w/frame_d and all pitches are intentionally NOT here — the .scad derives
// them from the intent knobs. scale_factor rides along as geometry; the color_* /
// bead_shape / frame_color style keys are JS-only (the STL is colorless — coloring
// happens in the viewer's recolor pass).
export const DEFINE_KEYS: (keyof Params)[] = [
  'frame_h',
  'border_w',
  'corner_r',
  'cols',
  'earth',
  'web',
  'print_gap',
  'throw',
  'bar',
  'shelf',
  'bead_dia',
  'bead_len',
  'bead_proud',
  'clearance',
  'top_chamfer',
  'marker_mm',
  'scale_factor',
  'text_mode',
  'text_fill',
  'text_color',
  'text_size',
  'edge_text_size',
  'feet_mode',
  'feet_shape',
  'feet_w',
  'feet_depth',
  'feet_fit',
  'feet_undercut',
  'feet_span',
  'feet_proud',
  'feet_retention',
  // The scad owns the modular floors and the joint's envelope; the joint's own
  // proportions (tooth depth, tongue length, barb setback) live in
  // abacus-link.scad as library constants and are deliberately NOT defines —
  // they are the interface, and an interface a caller can vary per render is not
  // one anybody can print a matching column against.
  'link_mode',
  'link_web',
  'link_border',
  'link_ramp',
  'link_fit',
  'link_relief',
  'link_bump',
  'link_slot_w',
  'link_foot_w',
  'link_foot_d',
  'show_frame',
  'show_beads',
  'show_markers',
]
/** The scad's eight token-vector params, in textSlots() order — rails() then
 *  walls(). */
export const TEXT_SLOT_DEFINES = [
  'text_top',
  'text_bottom',
  'text_left',
  'text_right',
  'edge_front',
  'edge_back',
  'edge_left',
  'edge_right',
] as const
export const definesFrom = (p: Params): string[] => [
  // JSON serialization doubles as OpenSCAD literal syntax for numbers, booleans,
  // quoted strings AND [string, fontIdx] token vectors.
  ...DEFINE_KEYS.map((k) => `-D${k}=${JSON.stringify(p[k])}`),
  // Straight off textSlots(), NOT a second derivation of the same eight slots.
  // It used to be one — and the day placement became derived, two copies would
  // have put the plate's ink on different rails than the viewer's preview tint,
  // with nothing to catch it (see textSlots).
  ...textSlots(p).map((toks, i) => `-D${TEXT_SLOT_DEFINES[i]}=${JSON.stringify(toks)}`),
]

/** Defines that can only ever change a PART PASS, never the assembled abacus.
 *  They still ride every render — the part passes need them, and a define the
 *  worker never sees is one the scad silently defaults — but they are excluded
 *  from the preview's dedup key below.
 *
 *  Without this, dragging the joint's cam-ramp slider re-solves the whole abacus
 *  on every step, for a model the knob provably cannot touch. The joint's
 *  ENVELOPE knobs (`link_mode`, `link_web`, `link_border`) are deliberately NOT
 *  in this list — those move the assembled abacus's own width and depth. */
export const PART_ONLY_DEFINE_KEYS: readonly (keyof Params)[] = [
  'link_ramp',
  'link_fit',
  'link_relief',
  'link_bump',
  'link_slot_w',
  'link_foot_w',
  'link_foot_d',
]

/** The dedup key the preview pump compares renders on. Same rule the color and
 *  filament knobs already follow (JS-only, never reach the scad, never re-solve):
 *  a knob that cannot change THIS render shouldn't force it. Lives here rather
 *  than in the hook so the "what actually moves the assembled geometry"
 *  judgement sits next to the params it is about. */
export const previewDedupKey = (p: Params): string => {
  const skip = new Set<string>(PART_ONLY_DEFINE_KEYS.map((k) => `-D${k}`))
  return definesFrom(p)
    .filter((d) => !skip.has(d.slice(0, d.indexOf('='))))
    .join('')
}

/** One export render request: the whole abacus (no pass) or a single `only=`
 *  part pass. The marker passes render JUST the four corner plugs, and
 *  `text_plugs` JUST the inset inlays, so the 3MF can carry each as its own
 *  filament body — a flush plug rendered into the main STL welds into the frame
 *  shell and is unsplittable. `feet` (Gitea #23) renders the TPU foot solids.
 *
 *  `text_plugs` carries a color GROUP because the inlay can span up to 5 inks
 *  (see textGroups); each group is one render, one body, one extruder. */
export type ExportPass =
  | { only: 'marker_black' | 'marker_white' | 'feet' }
  | { only: 'text_plugs'; group: number }

/** INSPECTION-only `only=` slices — one piece of the model rendered alone so it
 *  can be orbited, measured and test-printed (the Storybook parts bench). These
 *  are deliberately NOT `ExportPass` values: an export pass means "one filament
 *  body in the 3MF", and a lone bead or a channel cavity is not that. Both kinds
 *  ride the same `-Donly=` mechanism, hence the shared {@link exportDefines}.
 *
 *  The three bead slices split the bead at the belt, because the two halves
 *  answer different questions: `bead_capture` rides in the track and must never
 *  change, `bead_cap` is free to, and `bead_exposed` is the only part anyone
 *  ever sees (everything below the frame's top face is swallowed by it).
 *  Mirrors `abacus.scad`'s dispatch — keep the two lists in step. */
export const INSPECT_PARTS = [
  'bead',
  'bead_capture',
  'bead_cap',
  'bead_exposed',
  'channel',
  'frame',
  // The AbacusLink prototype slices. Inspection parts, but print-READY ones:
  // each emits two pieces in print pose, because what they test is the seam
  // between them. `link_coupon` is the joint alone (fast, fails fast on the cam
  // latch); `link_column` is two real column modules with their captive beads,
  // which is what answers whether halving the web disturbed capture.
  //
  // Both force the modular dimension floors on regardless of `link_mode` — a
  // coupon cut to the mono pitch would pass its own test and tell you nothing
  // about the abacus you'd actually print.
  'link_coupon',
  'link_column',
] as const
export type InspectPart = (typeof INSPECT_PARTS)[number]

/** Anything the worker can be asked to render as a single `only=` pass. */
export type RenderPass = ExportPass | { only: InspectPart }

/** The define list for one export render. Pure — and split out of the worker
 *  postMessage so the exact strings are testable: `-Dplug_group` is the one
 *  define whose absence fails SILENTLY (the scad's −1 default renders every
 *  token, so a typo'd name ships N identical copies of the whole inlay on N
 *  extruders instead of a partition). Emitted for the text pass only; the
 *  preview pump deliberately omits it and gets the unfiltered soup. */
export function exportDefines(p: Params, pass?: RenderPass): string[] {
  if (!pass) return definesFrom(p)
  const defs = [...definesFrom(p), `-Donly="${pass.only}"`]
  if (pass.only === 'text_plugs') defs.push(`-Dplug_group=${pass.group}`)
  return defs
}

// ---- myabacus color model ---------------------------------------------------
// Bead colors come from the shared canonical resolver (beadColorActive, imported
// above); this module only adds the print-side role → filament-slot mapping on
// top of it — no copied color tables. Re-export the palette table under its
// historical name so the viewer's plugRecolor keeps importing it from here.
export const COLOR_PALETTES: Record<string, string[]> = BEAD_COLOR_PALETTES
// The place-value role count = palette length. Deriving it (instead of a
// hardcoded 5) keeps beadRoleIndex in lockstep with the resolver's
// `placeValue % colors.length` by construction, not by coincidence.
const paletteLen = (palette: string): number =>
  (BEAD_COLOR_PALETTES[palette] ?? BEAD_COLOR_PALETTES.default).length
// A bead resolves role → intended hex → filament slot. Column i runs left→right;
// the rightmost column is the ones place (placeValue 0).
export const beadRoleIndex = (
  i: number,
  isHeaven: boolean,
  scheme: string,
  cols: number,
  palette: string
): number => {
  const pv = cols - 1 - i
  if (scheme === 'monochrome') return 0
  if (scheme === 'heaven-earth') return isHeaven ? 0 : 1
  if (scheme === 'alternating') return pv % 2 === 0 ? 0 : 1
  return pv % paletteLen(palette)
}
// Intended hex per role, sourced from the canonical resolver via a representative
// (placeValue, type) for each role — one role per palette entry for place-value,
// two for heaven-earth/alternating, one for monochrome. Feeds computeFilamentMap.
export const beadRoleColors = (scheme: string, palette: string): string[] => {
  const c = (placeValue: number, type: 'heaven' | 'earth'): string =>
    beadColorActive({ placeValue, type }, scheme, palette)
  if (scheme === 'monochrome') return [c(0, 'earth')]
  if (scheme === 'heaven-earth') return [c(0, 'heaven'), c(0, 'earth')]
  if (scheme === 'alternating') return [c(0, 'earth'), c(1, 'earth')]
  return Array.from({ length: paletteLen(palette) }, (_, pv) => c(pv, 'earth'))
}
export const beadRoleNames = (scheme: string): string[] =>
  scheme === 'monochrome'
    ? ['bead']
    : scheme === 'heaven-earth'
      ? ['heaven', 'earth']
      : scheme === 'alternating'
        ? ['even col', 'odd col']
        : ['1s', '10s', '100s', '1k', '10k']

// ---- filament mapping primitives (screen colors → AMS slots) ----------------
// The role-aware quantizer that consumes these — markers first, then frame, then
// bead roles distinct-first — moved to abacus-plan.ts (`materialize`); its legacy
// `computeFilamentMap` shape re-exports from there. This file keeps only the pure
// color primitives (distance, luminance, contrast, nearest-slot) that both the
// plan and the viewer's plug pass still share.
// Total by construction: color math is a leaf primitive called from the viewer,
// the plan quantizer, and the reconcile strip, so it must NEVER throw — a bad or
// missing hex (an unmapped role, an empty catalog slot, a partial config) has to
// degrade one swatch to neutral grey, not unwind React past the studio provider
// and blank the whole page. A genuine data fault is surfaced by the print panel's
// unavailable state; this guard just refuses to make it a render crash.
const NEUTRAL_RGB: [number, number, number] = [128, 128, 128]
export const hexRGB = (h: string): [number, number, number] => {
  let s = typeof h === 'string' ? h.replace('#', '') : ''
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return NEUTRAL_RGB
  const n = Number.parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
// redmean color distance — cheap and perceptually decent for spool picking
export const colorDist = (a: string, b: string): number => {
  const [r1, g1, b1] = hexRGB(a)
  const [r2, g2, b2] = hexRGB(b)
  const rm = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}
export const lum = (hex: string): number => {
  const [r, g, b] = hexRGB(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrastRatio = (a: string, b: string): number =>
  (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

// linear per-channel blend a→b (t=0 → a, t=1 → b), clamped to a valid hex.
export const mixHex = (a: string, b: string, t: number): string => {
  const A = hexRGB(a)
  const B = hexRGB(b)
  return `#${A.map((v, i) => {
    const c = Math.round(v + (B[i] - v) * t)
    return Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')
  }).join('')}`
}

// The expanded filament picker bathes in the DESIGNED role color, so its text
// must be chosen against that specific ground — as a coordinated set, not one
// label at a time (Gitea #17). pickerInk derives the WHOLE ink palette from one
// background: the ink polarity that actually contrasts (max of near-white /
// near-black — the crossover is luminance ≈0.18, not 0.5), a neutral ramp on
// that side (primary → soft → hairline, lerped toward the ground), and a caution
// tone in the same polarity's WARM pole (gold on dark grounds, brown on light).
// The warm tone is FLOORED: if it can't clear `floor`, it lerps back toward the
// neutral base until it does — so it degrades to a warm-neutral instead of the
// muddy fixed amber it replaced. Poles + floor are the only design constants;
// which tone and how light/dark it must be is solved per background.
export const INK_LIGHT = '#f8fafc'
export const INK_DARK = '#0b0f14'
export const WARM_LIGHT = '#ffd68a' // caution tone when the ink is light (dark grounds)
export const WARM_DARK = '#4a1e06' // caution tone when the ink is dark (light grounds)
export const PICKER_INK_FLOOR = 3.2 // WCAG ratio the caution label must clear

export type PickerInk = {
  light: boolean // true → light ink polarity (dark ground)
  fg: string // primary labels, selected/pin rings
  fgSoft: string // titles, footer, anchor section label
  fgHair: string // borders, hairlines
  warn: string // off-plate / support section labels
}

export const pickerInk = (bg: string, floor = PICKER_INK_FLOOR): PickerInk => {
  const light = contrastRatio(bg, INK_LIGHT) >= contrastRatio(bg, INK_DARK)
  const base = light ? INK_LIGHT : INK_DARK
  const warmIdeal = light ? WARM_LIGHT : WARM_DARK
  let warn = warmIdeal
  if (contrastRatio(bg, warn) < floor) {
    warn = base // fallback if even a hair of warmth won't clear the floor
    for (let t = 1; t >= 0; t -= 0.05) {
      const c = mixHex(base, warmIdeal, t)
      if (contrastRatio(bg, c) >= floor) {
        warn = c
        break
      }
    }
  }
  return {
    light,
    fg: base,
    fgSoft: mixHex(base, bg, 0.34),
    fgHair: mixHex(base, bg, 0.72),
    warn,
  }
}

export type FilamentMap = {
  slots: string[] // the loaded spools (filament_1..filament_count)
  frame: number // slot index per role ↓
  markerWhite: number
  markerBlack: number
  beadRoles: number[] // slot index per bead role (see beadRoleIndex)
  markerContrast: number // WCAG ratio of the mapped marker pair (CV wants ≥3)
  // Present iff the plan minted a feet role (feet_mode === 'printed'). Optional
  // so the feet-off map shape is unchanged (the snapshot pins it) and consumers
  // can't forget the printed-feet gate.
  feet?: number
  // Slot index per inset-text color group, dense over 0…G−1 (see textGroups —
  // the present groups are always a prefix, so this can never have holes).
  // Present iff the plan minted text roles (text_mode === 'inset' && anyTokens),
  // same conditional-key contract as `feet`: absent means "no inset text", which
  // is what lets the 3MF distinguish that from "text on slot 0".
  textRoles?: number[]
}
export const nearestSlot = (slots: string[], target: string, exclude = -1): number => {
  let best = 0
  let bd = Number.POSITIVE_INFINITY
  slots.forEach((s, idx) => {
    if (idx === exclude) return
    const d = colorDist(target, s)
    if (d < bd) {
      bd = d
      best = idx
    }
  })
  return best
}
// `computeFilamentMap` (the role → slot map) now lives in abacus-plan.ts as an
// adapter over `materialize`; import it from there.

// ---- ArUco corner marker bits (js-aruco2 'ARUCO' codeList) -------------------
// The abaci.one detector reads these; '1' → white cell, row 0 = top. IDs land on
// their matching frame corner: TL=0, TR=1, BR=2, BL=3.
export const MARKER_BITS = [
  '1000010000100001000010000', // id 0 → TL
  '1000010000100001000010111', // id 1 → TR
  '1000010000100001000001001', // id 2 → BR
  '1000010000100001000001110', // id 3 → BL
]

// ---- shell classifier -------------------------------------------------------
// Per-triangle shell membership + each shell's semantics, so a scheme/palette
// change recolors the existing geometry instantly (no re-render).
export type ShellInfo = { isFrame: boolean; i: number; isHeaven: boolean }
export type ShellAnalysis = { triShell: Int32Array; shellInfo: ShellInfo[] }

// union-find the STL's triangles into connected shells (frame + free beads), then
// map each bead shell's centroid back to its (column, heaven/earth) cell with the
// same layout the .scad uses. Frame = the one shell far wider than a column pitch.
// `positions` is the flat triangle-soup position array (9 floats per triangle).
export function analyzeShells(positions: ArrayLike<number>, p: Params): ShellAnalysis {
  const pos = positions
  const nTri = (pos.length / 9) | 0
  const Q = 100 // weld verts to a 0.01mm grid
  const vid = new Map<string, number>()
  const tvi = new Int32Array(nTri * 3)
  for (let t = 0; t < nTri; t++) {
    for (let c = 0; c < 3; c++) {
      const o = (t * 3 + c) * 3
      const k = `${Math.round(pos[o] * Q)},${Math.round(pos[o + 1] * Q)},${Math.round(
        pos[o + 2] * Q
      )}`
      let v = vid.get(k)
      if (v === undefined) {
        v = vid.size
        vid.set(k, v)
      }
      tvi[t * 3 + c] = v
    }
  }
  const parent = new Int32Array(vid.size)
  for (let i = 0; i < parent.length; i++) parent[i] = i
  const find = (a: number): number => {
    let x = a
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const uni = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  for (let t = 0; t < nTri; t++) {
    uni(tvi[t * 3], tvi[t * 3 + 1])
    uni(tvi[t * 3 + 1], tvi[t * 3 + 2])
  }

  type Box = { xmin: number; xmax: number; ymin: number; ymax: number }
  const rootIdx = new Map<number, number>()
  const boxes: Box[] = []
  const ts = new Int32Array(nTri)
  for (let t = 0; t < nTri; t++) {
    const r = find(tvi[t * 3])
    let si = rootIdx.get(r)
    if (si === undefined) {
      si = boxes.length
      rootIdx.set(r, si)
      boxes.push({ xmin: 1e9, xmax: -1e9, ymin: 1e9, ymax: -1e9 })
    }
    ts[t] = si
    const b = boxes[si]
    for (let c = 0; c < 3; c++) {
      const o = (t * 3 + c) * 3
      const x = pos[o]
      const y = pos[o + 1]
      if (x < b.xmin) b.xmin = x
      if (x > b.xmax) b.xmax = x
      if (y < b.ymin) b.ymin = y
      if (y > b.ymax) b.ymax = y
    }
  }

  // border offset: the bead field sits at (border_w, border_w) inside the outer rect
  const d = derived(p)
  const s_em = borderEff(p) * p.scale_factor + d.sEm
  const s_cp = d.sCp
  const s_hy = borderEff(p) * p.scale_factor + d.sHy
  const s_ep = d.sEp
  let frameSi = -1
  let frameSpan = 2 * s_cp // a shell must beat >1 column pitch to be the frame
  for (let si = 0; si < boxes.length; si++) {
    const sp = boxes[si].xmax - boxes[si].xmin
    if (sp > frameSpan) {
      frameSpan = sp
      frameSi = si
    }
  }

  const shellInfo = boxes.map((b, si): ShellInfo => {
    if (si === frameSi) return { isFrame: true, i: 0, isHeaven: false }
    const cx = (b.xmin + b.xmax) / 2
    const cy = (b.ymin + b.ymax) / 2
    const i = Math.max(0, Math.min(p.cols - 1, Math.round((cx - s_em) / s_cp)))
    return { isFrame: false, i, isHeaven: Math.abs(cy - s_hy) < s_ep * 0.5 }
  })
  return { triShell: ts, shellInfo }
}

// The filament slot a shell rides under the current scheme/palette + filament
// map. Frame rides its frame slot; each bead rides its role slot. Shared by the
// viewer's recolor pass (via shellHex) and the 3MF per-spool body split.
export const shellSlotIndex = (info: ShellInfo, p: Params, fm: FilamentMap): number =>
  info.isFrame
    ? fm.frame
    : fm.beadRoles[beadRoleIndex(info.i, info.isHeaven, p.color_scheme, p.cols, p.color_palette)]

// The intended hex for a shell under the current scheme/palette + filament map —
// the viewer converts this to a linear rgb triple via THREE.Color.
export const shellHex = (info: ShellInfo, p: Params, fm: FilamentMap): string =>
  fm.slots[shellSlotIndex(info, p, fm)]

// The print-plan ROLE KEY a shell belongs to (frame or a bead role), matching the
// keys PrintRole emits in abacus-plan.ts: 'frame' and `bead-${beadRoleIndex(...)}`.
// The single source of truth mapping addressable geometry → a mapping row, shared
// by the viewer's row→hero x-ray highlight (Gitea #17) and the hero→row raycaster
// (Gitea #18). Markers + inset text have no addressable render shell (baked into the
// frame recess / a separate plug pass), so they never resolve here.
export const shellRoleKey = (info: ShellInfo, p: Params): string =>
  info.isFrame
    ? 'frame'
    : `bead-${beadRoleIndex(info.i, info.isHeaven, p.color_scheme, p.cols, p.color_palette)}`

// The frame's role key — the one value shellRoleKey returns for the frame shell.
// Exposed so the marker-ghost predicate can ask "is the frame the emphasized part?"
// without hardcoding the literal in two places.
export const FRAME_ROLE_KEY = 'frame'
// The printed-feet role key (minted in abacus-plan.ts's materialize). No shell
// carries it — feet live in their own part pass — but the viewer's stud preview
// still asks "are the feet the emphasized part?" during an x-ray (Gitea #23).
export const FEET_ROLE_KEY = 'feet'

// ---- studio hover-lens pures (Gitea #17) ------------------------------------
// The two hover lenses (reveal designed colors / emphasize one role via x-ray) drive
// three imperative bits of the viewer: the hero caption text, the x-ray geometry
// split, and whether the marker decals fade with the frame. Those live inside the
// mount-once three.js closure, so the decision logic is factored out here as pure
// functions the closures call — and the tests pin.

export type EmphasisCaption = { text: string; active: boolean }

// The hero caption's text + active flag from the current lens state. Reveal (the
// designed-colors lens) wins over emphasis; emphasis only speaks when the hovered
// role actually lit a shell (`matched`) — a marker/text row resolves to no geometry,
// so it falls back to the resting announce rather than claiming to emphasize nothing.
export function emphasisCaption(
  revealing: boolean,
  label: string | null,
  matched: boolean
): EmphasisCaption {
  if (revealing) return { text: 'Your designed colors', active: true }
  if (label != null && matched) return { text: `Emphasizing ${label}`, active: true }
  return { text: 'Print preview · hover a swatch for your design', active: false }
}

export type XrayGroup = { start: number; count: number; materialIndex: number }

// Coalesce a per-triangle match mask into three.js geometry groups for the x-ray
// split: `match[t]` true → the emphasized part (material index 0, opaque), false →
// the ghosted rest (material index 1, translucent). Consecutive same-status triangles
// merge into one group. `start`/`count` are in VERTICES (3 per triangle, as
// BufferGeometry.addGroup wants). Empty input → no groups.
export function xrayGroups(match: ArrayLike<boolean>): XrayGroup[] {
  const groups: XrayGroup[] = []
  if (match.length === 0) return groups
  let start = 0
  let cur = match[0]
  for (let t = 1; t < match.length; t++) {
    if (match[t] !== cur) {
      groups.push({ start: start * 3, count: (t - start) * 3, materialIndex: cur ? 0 : 1 })
      start = t
      cur = match[t]
    }
  }
  groups.push({ start: start * 3, count: (match.length - start) * 3, materialIndex: cur ? 0 : 1 })
  return groups
}

// Should the ArUco marker decals fade with the frame during an x-ray? The markers
// are decals ON the frame's top face, so they follow the frame's emphasis state:
// ghost when a row highlight is x-raying the model AND the emphasized role isn't the
// frame itself (Gitea #17). No x-ray, or the frame IS the emphasized part → the
// markers stay opaque (they belong to the part in focus).
export function markersFollowFrameGhost(xrayOn: boolean, activeRole: string | null): boolean {
  return xrayOn && activeRole !== FRAME_ROLE_KEY
}

// ---- rail geometry + the auto-fit rule (mirror of abacus.scad) ---------------
/** The eight slots' endpoints and cross-band, in textSlots() order — the scad's
 *  rails() then walls(). ONE derivation, shared by tokenCenters (which tints the
 *  viewer's plug preview by nearest centroid) and the placement fit rule, so a
 *  layout change can't move one without the other. */
export type SlotGeom = { ax: number; ay: number; bx: number; by: number; z: number; band: number }
export function slotGeom(p: Params): SlotGeom[] {
  const S = p.scale_factor
  const d = derived(p)
  const W = d.frameW
  const D = d.outerD
  const r = p.corner_r * S
  const mkEnd = d.mkI + p.marker_mm + 2
  // strip_x == strip_y by construction in the scad; one number serves both.
  const strip = borderStrip(p)
  const zTop = p.frame_h * S
  const zEdge = zTop / 2
  const rail = strip - 2 * d.chamf
  const wall = zTop - 2 * d.chamf
  const g = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    z: number,
    band: number
  ): SlotGeom => ({ ax, ay, bx, by, z, band })
  return [
    g(mkEnd, D - strip / 2, W - mkEnd, D - strip / 2, zTop, rail),
    g(mkEnd, strip / 2, W - mkEnd, strip / 2, zTop, rail),
    g(strip / 2, mkEnd, strip / 2, D - mkEnd, zTop, rail),
    g(W - strip / 2, D - mkEnd, W - strip / 2, mkEnd, zTop, rail),
    g(r + 2, 0, W - r - 2, 0, zEdge, wall),
    g(W - r - 2, D, r + 2, D, zEdge, wall),
    g(0, D - r - 2, 0, r + 2, zEdge, wall),
    g(W, r + 2, W, D - r - 2, zEdge, wall),
  ]
}
export const slotSpan = (g: SlotGeom): number => Math.hypot(g.bx - g.ax, g.by - g.ay)

/** Half of m/(m+1) — the scad's `ink_frac`. Both this bound and the ink it is
 *  compared against are HALF-extents, hence the 0.5.
 *
 *  Holding an m-glyph token's ink to m/(m+1) of its pitch leaves exactly one
 *  character advance between neighbors. The scad used to use a flat 92%, which
 *  only guaranteed they never TOUCH: at 3 glyphs that leaves 0.26 of an advance
 *  between tokens — tighter than the space around the `+` inside `1+9` — so
 *  `1+9 2+8 …` reads as one number. Fixed ratio, so it never improved with
 *  size; it just stopped mattering from 7 columns up, where the glyph cap binds
 *  first and all the leftover pitch becomes gap anyway. */
export const inkFraction = (glyphs: number): number => (0.5 * glyphs) / (glyphs + 1)

/** Per-glyph ink half-advance and half-height in ems, for the aid tokens in
 *  DejaVu Sans Bold — MEASURED off the shipped
 *  `public/fonts/DejaVuSans-Bold.ttf` (hmtx advances + glyf bboxes), not
 *  guessed. `1+9` inks 2.053 em wide and 0.755 em tall, i.e. 0.342 em of
 *  half-advance per glyph; the five friends-of-10 facts span 0.342–0.347, so
 *  0.35 covers them all with a hair to spare. Digits are the calibration target
 *  on purpose: only the AIDS drive placement, and they are all digits and `+`.
 *  (Letters run wider — `MOM` is 0.443 — so a words-only rail is estimated
 *  optimistically. That costs nothing: the scad's own fit_sz still shrinks it
 *  correctly, and words never trigger a relocation.)
 *
 *  Still an ESTIMATE, deliberately: real metrics come from `textmetrics`, which
 *  only OpenSCAD has (the worker passes --enable=textmetrics), and the scad's
 *  no-metrics fallback is pessimistic enough to make every rail look unfit. So
 *  these decide a THRESHOLD — "is this rail worth rotating out of?" — and must
 *  never be surfaced as a millimetre figure we can't stand behind. */
const EM_HALF_ADVANCE = 0.35
const EM_HALF_HEIGHT = 0.38

/** Below this, a rotated side rail that clears it is worth the awkward reading
 *  direction — this is the whole relocation trigger. NOT a claim that 4.4 mm is
 *  unreadable: it's the point where the sideways rail becomes the better deal.
 *  Sized to sit off a cliff — at 5 columns the top rail estimates 4.2 mm (7%
 *  under) and at 6 it estimates 5.1 mm (14% over), so a few percent of metric
 *  error can't silently move the crossover. */
export const ROTATE_BELOW_MM = 4.5
/** And below THIS we say out loud that the writing will print small, whatever
 *  rail it ended up on. Only reachable when words have crowded the aid onto a
 *  short rail, or at a very small `scale_factor`. */
export const SMALL_PRINT_MM = 4

/** What the scad's fit_sz will land on for this rail, ESTIMATED (see
 *  EM_HALF_ADVANCE). `text_size` is a maximum, never a target: the rail shrinks
 *  to whichever of the two bounds binds — inter-token gap, or the solid strip's
 *  cross-band. */
export function estimateRailGlyphMm(p: Params, slot: TextSlot, tokens: readonly string[]): number {
  if (tokens.length === 0) return p.text_size
  const g = slotGeom(p)[TEXT_SLOTS.indexOf(slot)]
  const pitch = slotSpan(g) / tokens.length
  const widthCap = Math.min(
    ...tokens.map((t) => {
      const m = Math.max(1, t.length)
      return (inkFraction(m) * pitch) / (EM_HALF_ADVANCE * m)
    })
  )
  const bandCap = (g.band / 2 - 0.3) / EM_HALF_HEIGHT
  return Math.min(p.text_size, widthCap, bandCap)
}
/** Is this rail good enough to keep the writing horizontal? */
export const railFits = (p: Params, slot: TextSlot, tokens: readonly string[]): boolean =>
  estimateRailGlyphMm(p, slot, tokens) >= ROTATE_BELOW_MM

// ---- where the teaching aids go (Gitea #28) ---------------------------------
/** Why an aid ended up where it is. Drives the caption — the user is never told
 *  a rail moved without being told what moved it. */
export type AidReason =
  | 'off'
  | 'asked' // you named this rail
  | 'preferred' // 'auto' got its first choice (i.e. today's layout)
  | 'moved' // 'auto' rotated it onto a side rail for room
  | 'nowhere' // every rail is holding your words
export type AidPlacement = {
  aid: Aid
  slot: TextSlot | null
  intent: string
  /** Where 'auto' WOULD put this aid, holding everything else as it is. Equals
   *  `slot` when the intent already is 'auto'; the point is the other cases —
   *  a pinned or switched-off aid can still show its automatic answer, so "right
   *  side" and "auto — right side" can never be mistaken for each other. ONE
   *  derivation behind both the select's label and the caption's clause. */
  autoSlot: TextSlot | null
  /** the rail it landed on clears SMALL_PRINT_MM — an honesty flag, independent
   *  of `reason`: a rail can be the best available AND still print small */
  fits: boolean
  /** estimated glyph size on the chosen rail, mm; null when unplaced */
  mm: number | null
  reason: AidReason
}

/**
 * Which axis the auto-placed aids share.
 *
 * Horizontal is home: it's today's layout and it reads without tilting your
 * head. We rotate the pair onto the sides only when horizontal has actually
 * failed — some aid can't reach ROTATE_BELOW_MM there — AND rotating costs no
 * aid any glyph size. That second half is the important one: symmetry is never
 * bought with legibility. At 5 columns it comes free (friends-of-5 measures
 * 5.2 mm on the bottom rail but 6.0 mm on the right), so the pair rotates
 * together; at 19 columns the top rail is strictly roomier, so nothing moves.
 *
 * Only aids actually on 'auto' get a vote. A pinned aid is immovable, so letting
 * it drag the free one across the frame would mean overruling a measured
 * legibility win for the sake of tidiness.
 */
function autoAxis(p: Params, aids: readonly Aid[]): Axis {
  if (aids.length === 0) return 'horizontal'
  const mm = (axis: Axis, a: Aid): number => estimateRailGlyphMm(p, a.home[axis], a.tokens)
  if (aids.every((a) => mm('horizontal', a) >= ROTATE_BELOW_MM)) return 'horizontal'
  return aids.every((a) => mm('vertical', a) >= mm('horizontal', a)) ? 'vertical' : 'horizontal'
}

/**
 * Resolve both aids to rails. PURE, and called on every read rather than
 * written back — see the `aid_10` comment on defaultParams for why that's the
 * whole safety argument.
 *
 * One rule, in this order:
 *   1. WORDS WIN. A rail with words in it is the user's, full stop.
 *   2. A named rail is honoured verbatim, cramped or not — the caption says the
 *      writing will be small rather than overruling a deliberate choice. (If the
 *      user somehow names a rail that also has words, words still win and the aid
 *      falls through to 'auto'; the UI disables that field, so this needs a
 *      hand-edited param to reach.)
 *   3. 'auto' walks aidPrefer(aid, autoAxis(…)) and takes the first free rail
 *      that clears ROTATE_BELOW_MM; failing that, the first free rail at all —
 *      small writing beats no writing, and the caption says which it is.
 *   4. Two aids never share a rail. If nothing is free the aid is not placed —
 *      concatenating nine facts onto one rail would be worse than absent, and
 *      the caption can say so.
 *
 * `withAuto` is internal: the pass that answers "where would 'auto' have put
 * this?" for a pinned aid re-enters with it false, which bounds the recursion at
 * depth 1. Callers always want the default.
 */
export function placeAids(p: Params, withAuto = true): AidPlacement[] {
  const taken = new Set<TextSlot>(TEXT_SLOTS.filter((s) => tokenize(slotWords(p, s)).length > 0))
  const axis = autoAxis(
    p,
    AIDS.filter((a) => String(p[a.key]) === 'auto')
  )
  // The hypothetical: this aid on 'auto', everything else exactly as it is.
  const wouldAuto = (aid: Aid): TextSlot | null => {
    if (!withAuto) return null
    const asAuto: Params = { ...p }
    asAuto[aid.key] = 'auto'
    return placeAids(asAuto, false).find((x) => x.aid.key === aid.key)?.slot ?? null
  }
  const land = (
    aid: Aid,
    slot: TextSlot,
    intent: string,
    reason: AidReason,
    autoSlot: TextSlot | null
  ): AidPlacement => {
    taken.add(slot)
    const mm = estimateRailGlyphMm(p, slot, aid.tokens)
    return { aid, slot, intent, autoSlot, mm, fits: mm >= SMALL_PRINT_MM, reason }
  }
  return AIDS.map((aid) => {
    const intent = String(p[aid.key])
    if (intent === 'off') {
      const autoSlot = wouldAuto(aid)
      return { aid, slot: null, intent, autoSlot, mm: null, fits: true, reason: 'off' as AidReason }
    }
    const named = (TEXT_SLOTS as readonly string[]).includes(intent) ? (intent as TextSlot) : null
    if (named && !taken.has(named)) return land(aid, named, intent, 'asked', wouldAuto(aid))
    const free = aidPrefer(aid, axis).filter((s) => !taken.has(s))
    const slot = free.find((s) => railFits(p, s, aid.tokens)) ?? free[0] ?? null
    if (!slot) {
      const autoSlot = intent === 'auto' ? null : wouldAuto(aid)
      return { aid, slot: null, intent, autoSlot, mm: null, fits: false, reason: 'nowhere' }
    }
    // 'preferred' means today's layout — its horizontal home — not merely "first
    // choice", which now depends on the axis.
    const reason: AidReason = slot === aid.home.horizontal ? 'preferred' : 'moved'
    return land(aid, slot, intent, reason, intent === 'auto' ? slot : wouldAuto(aid))
  })
}

/** The caption sentence, or null when there is nothing worth saying (the aid is
 *  off, or 'auto' landed on its first choice and reads left-to-right). Lives here
 *  rather than in the rail so it's unit-testable without a DOM.
 *
 *  Deliberately says no millimetres: the size is an estimate (see
 *  EM_HALF_ADVANCE) and only OpenSCAD knows the real one. "Too small" and "will
 *  print small" are claims the estimate can carry; "4.2 mm" is not. */
export function aidNote(p: Params, place: AidPlacement): string | null {
  const { aid, slot, reason, fits, autoSlot } = place
  if (reason === 'off') return null
  if (!slot) return `Nowhere to put ${aid.label} — all four rails are holding your words.`
  const n = aid.tokens.length
  const where = `${aid.label} is on the ${SLOT_LABEL[slot]}`
  const reads = SLOT_READS[slot]
  const tail = reads ? ` It ${reads}.` : ''
  const small = fits ? '' : ` ${n} facts will print small there.`
  if (reason === 'moved') {
    return `${where}: ${n} facts print too small along the ${SLOT_LABEL[aid.home.horizontal]} at ${p.cols} columns.${tail}${small}`
  }
  if (reason === 'asked') {
    // Name the pin AS a pin, and say what letting go of it would do. Without
    // this the only tell that a rail was chosen by hand is the missing "auto —"
    // prefix in the select, which is far too quiet to carry the difference.
    const instead =
      autoSlot && autoSlot !== slot ? ` On 'auto' it would use the ${SLOT_LABEL[autoSlot]}.` : ''
    return `${where} because you pinned it there.${instead}${tail}${small}`
  }
  // 'preferred' — today's layout. Worth a word only if something is off about it.
  if (!fits) return `${where}, but ${n} facts print small at ${p.cols} columns.${tail}`
  return reads ? `${where}. It ${reads}.` : null
}

// ---- inset text-plug layout (QA for inlay fill colors) ----------------------
// The 8 token slots in the scad's own order — rails() (top, bottom, left, right)
// then walls() (front, back, left, right). Single source for every consumer:
// definesFrom, tokenCenters, anyTokens, and the color-group math below all read
// this, so the slot ORDER and the per-slot token index `k` mean the same thing
// everywhere — on the plate, in the plan, and in the preview's tint.
export function textSlots(p: Params): [string, number][][] {
  const placed = placeAids(p)
  const rail = (slot: TextSlot): [string, number][] => {
    const aid = placed.find((x) => x.slot === slot)?.aid
    return aid ? aid.tokens.map((t) => [t, 0] as [string, number]) : tokenize(slotWords(p, slot))
  }
  return [
    rail('top'),
    rail('bottom'),
    rail('left'),
    rail('right'),
    tokenize(p.edge_front),
    tokenize(p.edge_back),
    tokenize(p.edge_left),
    tokenize(p.edge_right),
  ]
}

// mirror of the scad rails()/walls() layout: token k of a slot sits at
// A + (B−A)·(k+0.5)/n, on the top face (z≈s_fh) or a wall (z=z_edge).
export type TokenCenter = { x: number; y: number; z: number; k: number }
export function tokenCenters(p: Params): TokenCenter[] {
  const geom = slotGeom(p)
  const centers: TokenCenter[] = []
  textSlots(p).forEach((toks, s) => {
    const { ax, ay, bx, by, z } = geom[s]
    toks.forEach((_, k) => {
      const f = (k + 0.5) / toks.length
      centers.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, z, k })
    })
  })
  return centers
}
export const anyTokens = (p: Params): boolean => textSlots(p).some((t) => t.length > 0)

// ---- inset text color groups (the print's ink partition) --------------------
// The scad colors a token by its index WITHIN ITS OWN RAIL:
//   tok_color(k) = text_fill == "rainbow" ? _palette(color_palette)[k % 5] : text_color
// so a "color group" is that `k % 5` under rainbow, or the single fill otherwise.
// Each group becomes one render pass (-Dplug_group=g), one plan role, and one
// 3MF body — which is what makes the inlay print in filament instead of coming
// out as a bare pocket.
//
// The modulus is pinned to abacus.scad's `tok_group`, NOT derived from
// paletteLen(): the scad hardcodes 5 and never receives color_palette
// (DEFINE_KEYS omits it — color() is inert on binstl), so reading a future
// 6-entry palette here would have TS ask for a group the scad can never match,
// and the render would come back empty. A test pins every palette to this length.
export const TEXT_RAINBOW_GROUPS = 5

/** The color group of one token, given its index WITHIN ITS OWN RAIL — the scad's
 *  `tok_group(k)`. The single place this `% 5` lives: the viewer's preview
 *  recolor, the plan's roles, and the export's `plug_group` passes must all agree
 *  on it or the plate disagrees with the screen. */
export const tokGroup = (p: Params, k: number): number =>
  p.text_fill === 'rainbow' ? k % TEXT_RAINBOW_GROUPS : 0

// Present groups are always the PREFIX 0…G−1: for one rail of n tokens,
// {k % 5 : k ∈ [0,n)} = {0 … min(n,5)−1}, and the union over rails keeps that
// shape. So G is just the longest rail, capped — and every downstream structure
// (FilamentMap.textRoles, the per-group render list) is a dense, hole-free array
// by construction.
export function textGroupCount(p: Params): number {
  const longest = textSlots(p).reduce((m, t) => Math.max(m, t.length), 0)
  if (longest === 0) return 0
  return p.text_fill === 'rainbow' ? Math.min(TEXT_RAINBOW_GROUPS, longest) : 1
}

/** `tokens` are the token strings this group inks, in rail order — the plan uses
 *  the first couple as the mapping row's label so a user can tell which writing
 *  a row controls ("1+9 2+8" reads better than "Text 3"). */
export type TextGroup = { g: number; hex: string; tokens: string[] }
export function textGroups(p: Params): TextGroup[] {
  const pal = COLOR_PALETTES[p.color_palette] ?? COLOR_PALETTES.default
  const rainbow = p.text_fill === 'rainbow'
  const slots = textSlots(p)
  return Array.from({ length: textGroupCount(p) }, (_, g) => ({
    g,
    hex: rainbow ? pal[g] : p.text_color,
    tokens: slots.flatMap((toks) => toks.filter((_, k) => tokGroup(p, k) === g).map(([t]) => t)),
  }))
}

/** Which color groups end up written NEXT TO EACH OTHER on the plate.
 *
 *  Derived from the real layout rather than reasoned about: tokens of one slot
 *  sit evenly along a single line (tokenCenters), so token k and k+1 touch, and
 *  the pair of groups they carry must not print in the same filament — two
 *  neighbouring words in one ink read as one word. Different slots are on
 *  different faces (four top rails + four walls) and never abut.
 *
 *  Reading it off `textSlots` instead of assuming `g, g±1` is what makes the
 *  WRAP correct for free: `tokGroup` is `k % 5`, so a slot of six or more tokens
 *  puts group 4 beside group 0, and that pair is a real neighbour too.
 *
 *  Symmetric, no self-edges (a group beside itself — single-fill text, or a slot
 *  long enough to repeat — is one ink by definition and not a defect).
 *  Result index = group id; always length `textGroupCount(p)`. */
export function textGroupNeighbors(p: Params): Set<number>[] {
  const nb = Array.from({ length: textGroupCount(p) }, () => new Set<number>())
  for (const toks of textSlots(p)) {
    for (let k = 1; k < toks.length; k++) {
      const a = tokGroup(p, k - 1)
      const b = tokGroup(p, k)
      if (a === b) continue
      nb[a].add(b)
      nb[b].add(a)
    }
  }
  return nb
}

// ---- feet layout mirror (Gitea #23) -----------------------------------------
// Mirror of the scad's FEET derivation chain (abacus.scad "feet pockets" block),
// for the viewer's foot-stud preview — same shape as tokenCenters: pure math,
// unit-testable with zero mocks. The scad stays the single source of truth for
// the PRINTED geometry (part pass `only="feet"`); this mirror only places studs.
// Like the scad, it computes unconditionally — callers gate on feet_mode.
export type FeetEffective = {
  mouth: number // pocket opening at the bottom face, z=0 (feet_w + 2·fit_eff)
  seat: number // widest section at depth — the dovetail flare (mouth + 2·undercut_eff)
  c: number // pocket-center inset from BOTH outer edges (seat clears the chamfered outline)
  depthEff: number // pocket depth into the frame (crossbar mode derives its own stack)
  proud: number // stand-off below z=0 — printed feet only (adhesive pockets are empty)
  crossbar: boolean // printed + crossbar retention: a frame bar threads each foot
  /** Crossbar was asked for but the frame is too thin to hide the bar, so the
   *  feet fall back to the dovetail flare. Drives the inspector's note. */
  crossbarTooThin: boolean
}
/** Pocket depth the crossbar stack needs: xbar_under + xbar_h + xbar_over. */
const XBAR_STACK = 1 + 1.6 + 1.2
export function feetEffective(p: Params): FeetEffective {
  const printed = p.feet_mode === 'printed'
  // printed feet weld (fit 0) and always keep a flare (a left-alone undercut of 0
  // upgrades to 0.35/side); adhesive uses the raw knobs — same as the scad.
  const fitEff = printed ? 0 : p.feet_fit
  const undercutEff = printed && p.feet_undercut === 0 ? 0.35 : p.feet_undercut
  const mouth = p.feet_w + 2 * fitEff
  const seat = mouth + 2 * undercutEff
  const half = seat / 2
  const d = derived(p)
  const sCr = p.corner_r * p.scale_factor
  const c =
    p.feet_shape === 'square'
      ? Math.max(d.chamf + 0.5 + half, sCr <= 0 ? 0 : half + sCr - (sCr - d.chamf) / Math.SQRT2)
      : Math.max(d.chamf + 0.5 + half, sCr <= 0 ? 0 : sCr - (sCr - d.chamf - half) / Math.SQRT2)
  // The bar stack is absolute but the frame it hides in scales, so below
  // s_fh = XBAR_STACK + 2 (S ≈ 0.725 at stock frame_h) the bar has nowhere to go
  // and retention degrades to the dovetail flare — same rule as the scad.
  const wants = printed && p.feet_retention === 'crossbar'
  const fits = XBAR_STACK + 2 <= p.frame_h * p.scale_factor
  const crossbar = wants && fits
  const depthEff = crossbar ? XBAR_STACK : p.feet_depth
  return {
    mouth,
    seat,
    c,
    depthEff,
    proud: printed ? p.feet_proud : 0,
    crossbar,
    crossbarTooThin: wants && !fits,
  }
}

// ---- where a foot pocket is allowed to live ---------------------------------
/** The solid border strip on the bottom face, in mm. This is the ONLY place a
 *  foot pocket can go: at every column the bead and end channels open through
 *  the bottom face, so the two border strips are the only unbroken material.
 *  Mirrors the scad's strip_x / strip_y (equal by construction).
 *
 *  `border_w * S + sShelf` collapses to a max() once sShelf is substituted —
 *  written that way here because it says the real thing: the strip is the
 *  border-plus-shelf band, unless the marker inset is what's actually holding
 *  it open. Only the first branch answers to the brim. */
export const borderStrip = (p: Params): number => {
  const d = derived(p)
  return Math.max((borderEff(p) + p.shelf) * p.scale_factor, d.mkI + p.marker_mm)
}

export type FeetFit = {
  fits: boolean
  /** the seat is wider than the strip can hold — a PLAN-view failure */
  tooWide: boolean
  /** the pocket is deeper than the slab can spare — a SECTION-view failure.
   *  Separate because the two have different remedies: only `tooWide` answers
   *  to the brim. */
  tooDeep: boolean
  /** what one pocket consumes of the strip: inset + half the seat + 0.8 wall */
  needs: number
  /** what the strip currently offers */
  has: number
  /** what the pocket consumes of the slab's height: its depth + a 2 mm web */
  needsDepth: number
  /** the slab's own height, frame_h · S */
  hasDepth: number
  /** smallest `border_w` that seats this foot AT THE CURRENT SIZE. null when the
   *  marker floor already dominates, i.e. widening the brim would change
   *  nothing — and null whenever the pocket is also too deep, since no brim
   *  makes the slab thicker. */
  minBorderW: number | null
  /** smallest `scale_factor` that seats it AT THE CURRENT BRIM. Solved by
   *  bisection rather than algebra because `needs` itself drifts with scale (the
   *  chamfer and corner radius do), so there is no clean closed form. */
  minScale: number | null
}

/** Mirror of the scad's three foot-pocket asserts:
 *    feet_c + feet_half + 0.8 <= strip_x   (end channels)
 *    feet_c + feet_half + 0.8 <= strip_y   (bead channels)
 *    feet_depth_eff + 2       <= s_fh      (web left above the pocket)
 *  The scad enforces these with assert(), which throws mid-export with a
 *  message written for whoever edits the scad. Mirroring them here is what lets
 *  the inspector refuse a foot BEFORE the export, and say which lever fixes it
 *  — the same job crossbarTooThin does for the crossbar.
 *
 *  The depth one matters as soon as the bumper presets exist: a bumper's
 *  thickness is real-world hardware and never scales, but the slab it sinks
 *  into is frame_h · S. A 1/8" bumper wants 3.59 mm of an 8 · S mm slab, so it
 *  needs S ≥ 0.449 — under the 0.5 slider floor, but a saved ?design= snapshot
 *  can carry any scale. */
export function feetFit(p: Params): FeetFit {
  const f = feetEffective(p)
  const needs = f.c + f.seat / 2 + 0.8
  const has = borderStrip(p)
  const needsDepth = f.depthEff + 2
  const hasDepth = p.frame_h * p.scale_factor
  const tooWide = needs > has
  const tooDeep = needsDepth > hasDepth
  const S = p.scale_factor
  const base = { tooWide, tooDeep, needs, has, needsDepth, hasDepth }
  if (!tooWide && !tooDeep) return { ...base, fits: true, minBorderW: null, minScale: null }
  // Inverting the brim is exact: mkI doesn't answer to border_w, so once the
  // border-plus-shelf branch is the binding one — which it must be, since the
  // strip already lost to `needs` and the strip is never below the marker floor
  // — border_w = needs/S − shelf lands the strip exactly on `needs`.
  // Offered only when width is the ONLY problem: the brim widens the strip, it
  // does not thicken the slab, so proposing it against a too-deep pocket would
  // send the user to a knob that cannot fix what's wrong.
  const wantBorder = needs / S - p.shelf
  // Size has no such inversion: `needs` drifts upward with scale too, because
  // the chamfer and corner radius do. Bisect instead. Size is the one lever
  // that moves both constraints, which is why it's the only remedy on offer
  // when the pocket is too deep.
  const seats = (s: number) => {
    const q = { ...p, scale_factor: s }
    const g = feetEffective(q)
    return g.c + g.seat / 2 + 0.8 <= borderStrip(q) && g.depthEff + 2 <= q.frame_h * q.scale_factor
  }
  let minScale: number | null = null
  if (seats(4)) {
    let lo = S
    let hi = 4
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (seats(mid)) hi = mid
      else lo = mid
    }
    minScale = hi
  }
  return {
    ...base,
    fits: false,
    minBorderW: tooWide && !tooDeep && wantBorder > p.border_w ? wantBorder : null,
    minScale,
  }
}

// ---- stick-on bumper presets ------------------------------------------------
export const IN_MM = 25.4
export type BumperPreset = {
  id: string
  /** Sold in inches, so the UI says inches; only the mm conversion reaches the
   *  model. Width is the footprint (diameter, or side for a square). */
  widthIn: number
  thickIn: number
  shape: 'circle' | 'square'
  /** Profile ABOVE the pocket. The geometry never sees it — a pocket only ever
   *  meets the bumper's flat base — but it is what tells the two 1/2" bumpers
   *  apart, and what decides whether the abacus stands on six points or six
   *  discs. Kept here so the label can be honest about which one you bought. */
  profile: 'dome' | 'flat'
}
/** The stick-on bumper range, smallest first. */
export const BUMPER_PRESETS: BumperPreset[] = [
  { id: 'd-250-062', widthIn: 1 / 4, thickIn: 1 / 16, shape: 'circle', profile: 'dome' },
  { id: 'd-312-125', widthIn: 5 / 16, thickIn: 1 / 8, shape: 'circle', profile: 'dome' },
  { id: 'd-375-125', widthIn: 3 / 8, thickIn: 1 / 8, shape: 'circle', profile: 'dome' },
  { id: 'f-437-125', widthIn: 7 / 16, thickIn: 1 / 8, shape: 'circle', profile: 'flat' },
  { id: 'f-500-125', widthIn: 1 / 2, thickIn: 1 / 8, shape: 'circle', profile: 'flat' },
  { id: 's-500-125', widthIn: 1 / 2, thickIn: 1 / 8, shape: 'square', profile: 'flat' },
]

/** Inches as the fraction the packet is labelled with, not a decimal: this
 *  hardware is sold as 1/16" and 1/2", so `0.063"` would be our arithmetic
 *  showing through. Sixteenths reduced — every size in the range is one. */
const inches = (v: number) => {
  const n = Math.round(v * 16)
  if (Math.abs(v * 16 - n) > 1e-9 || n <= 0) return `${v.toFixed(3)}`
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const g = gcd(n, 16)
  return g === 16 ? `${n / 16}` : `${n / g}/${16 / g}`
}
/** e.g. `3/8" × 1/8" dome` — two 1/2" bumpers differ only by round vs square,
 *  so the shape word is load-bearing, not decoration. */
export const bumperLabel = (b: BumperPreset): string =>
  `${inches(b.widthIn)}" × ${inches(b.thickIn)}" ${b.profile}${b.shape === 'square' ? ', square' : b.profile === 'flat' ? ', round' : ''}`

/** Params a bumper implies. The pocket is HALF the bumper's thickness: deep
 *  enough to locate it square and bury the adhesive layer, shallow enough that
 *  the other half stands proud as actual ride height (operator decision
 *  2026-07-30). A pocket as deep as the bumper is thick would seat it flush and
 *  defeat the point. */
export const bumperParams = (b: BumperPreset) => ({
  feet_shape: b.shape,
  feet_w: b.widthIn * IN_MM,
  feet_depth: (b.thickIn * IN_MM) / 2,
})
/** Stand-off the bumper actually gives, given the half-thickness pocket. */
export const bumperProud = (b: BumperPreset): number => (b.thickIn * IN_MM) / 2

/** Which preset the current params ARE, or null for hand-set dimensions. The
 *  selection is derived, never stored: `feet_preset` used to be a param and was
 *  deliberately retired (see defaultParams), so the dimensions stay the single
 *  source of truth and the label is a projection of them. */
export function matchBumper(p: Params): BumperPreset | null {
  return (
    BUMPER_PRESETS.find((b) => {
      const q = bumperParams(b)
      return (
        q.feet_shape === p.feet_shape &&
        Math.abs(q.feet_w - p.feet_w) < 0.02 &&
        Math.abs(q.feet_depth - p.feet_depth) < 0.02
      )
    }) ?? null
  )
}

// ---- brim (border width) presets --------------------------------------------
/** `border_w` is the flush band around the bead field — the "brim". It has never
 *  had a control, so every abacus printed so far used the 5.25 mm stock value.
 *  It matters here because it is half of what sets the border strip, and the
 *  strip is what decides whether a big stick-on bumper can be seated at all.
 *  Millimetres, not inches: unlike the bumpers this is our own geometry, not
 *  hardware someone sells by the fraction. */
export type BrimPreset = { id: string; label: string; border_w: number }
export const BRIM_PRESETS: BrimPreset[] = [
  { id: 'stock', label: 'standard — 5.25 mm', border_w: 5.25 },
  { id: 'wide', label: 'wide — 6.5 mm', border_w: 6.5 },
  { id: 'wider', label: 'extra wide — 8 mm', border_w: 8 },
  { id: 'widest', label: 'widest — 10 mm', border_w: 10 },
]
export const matchBrim = (p: Params): BrimPreset | null =>
  BRIM_PRESETS.find((b) => Math.abs(b.border_w - p.border_w) < 0.01) ?? null

// FEET_POS: 4 mandatory corners + PAIRS of intermediate feet splitting any
// bottom run that exceeds feet_span derated by S^(4/3) (strip stiffness ∝ S⁴).
// Order matches the scad exactly: corners, x-run pairs, y-run pairs.
export function feetPositions(p: Params): [number, number][] {
  const { c } = feetEffective(p)
  const d = derived(p)
  const W = d.frameW
  const D = d.outerD
  const spanEff = p.feet_span * p.scale_factor ** (4 / 3)
  const runX = W - 2 * c
  const runY = D - 2 * c
  const nx = Math.max(0, Math.ceil(runX / spanEff) - 1)
  const ny = Math.max(0, Math.ceil(runY / spanEff) - 1)
  const pos: [number, number][] = [
    [c, c],
    [W - c, c],
    [W - c, D - c],
    [c, D - c],
  ]
  for (let m = 1; m <= nx; m++)
    for (const e of [0, 1]) pos.push([c + (runX * m) / (nx + 1), e === 0 ? c : D - c])
  for (let m = 1; m <= ny; m++)
    for (const e of [0, 1]) pos.push([e === 0 ? c : W - c, c + (runY * m) / (ny + 1)])
  return pos
}
