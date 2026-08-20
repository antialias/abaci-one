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
export const JOINT_TYPES = ['vertical_snap', 'sliding_dovetail'] as const
export type JointType = (typeof JOINT_TYPES)[number]

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
  // Stepped mechanical retention for inset letters (GitHub #180): a hidden
  // neck + outset foot below the CV-locked 0.6 mm visible inlay, so letter
  // filaments no longer need to certify-weld to the frame (markers still do).
  // The app keeps this ON for every render — scad's own default is false so
  // legacy CLI renders stay fingerprint-identical (text-retention.test.ts
  // pins that asymmetry as intentional). ret_eps stays scad-only.
  text_retention: true,
  ret_shoulder: 1.0, // straight neck below the visible inlay (mm)
  ret_band: 0.8, // foot height (mm)
  ret_step: 0.6, // foot outset past the glyph outline (mm)
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
  // modular columns (Gitea #30). seam_mode is a real geometry knob, not a UI
  // toggle: 'modular' widens the column pitch by one full web per seam (each
  // module keeps a bead-capturing full-thickness edge wall) and swaps the
  // deliverable from one solid frame to a per-column module kit. It persists
  // in design snapshots so a reprint of one lost module comes from the same
  // topology the original kit did. joint_fit is the seam's one tuning knob —
  // per-side clearance on every mating face; the printed-coupon ritual walks
  // it toward 0/negative until seam wiggle dies. Old snapshots predate both
  // keys and parse to these defaults (mono, stock fit) — zero migration.
  seam_mode: 'mono',
  joint_type: 'vertical_snap' as JointType,
  joint_fit: 0.1,
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
  /** Mid-module width (the seam coupon's sc_w): bead + clearances + a full
   *  edge wall per side — a web, plus the sliding rail's edge allowance on that
   *  topology. Meaningful in modular mode; computed always. */
  scW: number
  /** End-module width (scad mod_we): border + field margin + half its column's
   *  channel + one full edge wall. 2·modWe + (cols−2)·scW === frameW exactly in
   *  modular mode — the identity the width tests pin. */
  modWe: number
}
export const derived = (p: Params): Derived => {
  const S = p.scale_factor
  const cl = p.clearance
  const sBd = p.bead_dia * S
  const sBl = p.bead_len * S
  const sBw = p.border_w * S
  const sFh = p.frame_h * S
  const sCr = p.corner_r * S
  const chamf = Math.min(p.top_chamfer, sFh * 0.4)
  const mkI = Math.max(0, chamf, sCr <= 0 ? 0 : sCr - (sCr - chamf) / Math.SQRT2 - p.marker_mm / 9)
  const sShelf = Math.max(p.shelf * S, mkI + p.marker_mm - sBw)
  // Modular pitch carries one FULL web per module edge (a half-web edge wall
  // couldn't capture beads), so each seam costs +web·S vs mono — the honest
  // price of modularity, paid here so every consumer (assembled width, the
  // shell classifier's bead-column matching, the panel's size delta) reads the
  // same number. The sliding rail buys its depth with a further edgeAllowance
  // per edge; like the scad's sc_wall that rides on joint_type alone, since a
  // mono render has no seam face to widen. scad mirror: sc_wall / the module
  // composition, not s_cp.
  const seamEdge =
    p.web * S + (p.joint_type === 'sliding_dovetail' ? SLIDING_DOVETAIL.edgeAllowance : 0)
  const sCp = sBd + 2 * cl + (p.seam_mode === 'modular' ? 2 * seamEdge : p.web * S)
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
    scW: sBd + 2 * cl + 2 * seamEdge,
    modWe: sBw + sEm + sBd / 2 + cl + seamEdge,
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
  'text_retention',
  'ret_shoulder',
  'ret_band',
  'ret_step',
  'feet_mode',
  'feet_shape',
  'feet_w',
  'feet_depth',
  'feet_fit',
  'feet_undercut',
  'feet_span',
  'feet_proud',
  'feet_retention',
  'seam_mode',
  'joint_type',
  'joint_fit',
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
 * They still ride every render because a define the worker never sees silently
 * falls back to the SCAD default. Keep this list empty unless a parameter is
 * proven not to affect any assembled topology: `joint_fit` changes sliding
 * groove entrances and topology-aware module foot pockets, so it belongs in
 * the preview identity. */
export const PART_ONLY_DEFINE_KEYS: readonly (keyof Params)[] = []

/** The dedup key the preview pump compares renders on. Same rule the color and
 *  filament knobs already follow (JS-only, never reach the scad, never re-solve):
 *  a knob that cannot change THIS render shouldn't force it. Lives here rather
 *  than in the hook so the "what actually moves the assembled geometry"
 *  judgement sits next to the params it is about. */
export const previewDedupKey = (p: Params): string => {
  const skip = new Set<string>(PART_ONLY_DEFINE_KEYS.map((k) => `-D${k}`))
  return definesFrom(p)
    .filter((d) => !skip.has(d.slice(0, d.indexOf('='))))
    .join('\u0001') // unambiguous separator — adjacent defines must not concatenate
}

/** One export render request: the whole abacus (no pass) or a single `only=`
 *  part pass. The marker passes render JUST the four corner plugs, and
 *  `text_plugs` JUST the inset inlays, so the 3MF can carry each as its own
 *  filament body — a flush plug rendered into the main STL welds into the frame
 *  shell and is unsplittable. `feet` (Gitea #23) renders the TPU foot solids.
 *
 *  `text_plugs` carries a color GROUP because the inlay can span up to 5 inks
 *  (see textGroups); each group is one render, one body, one extruder. The
 *  `module_left_text` / `module_right_text` passes are the same inlays cut to
 *  ONE end module's side slots and re-based module-local, so a group lands
 *  flush in the pocket that module carved — they seed bodies of the per-module
 *  3MFs, which is what makes them ExportPass and not ModulePass. */
export type ExportPass =
  | { only: 'marker_black' | 'marker_white' | 'feet' }
  | { only: 'text_plugs' | 'module_left_text' | 'module_right_text'; group: number }

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
  'seam_coupon',
  'seam_coupon_pair',
  'module_pair',
  'retention_coupon',
  'retention_coupon_plugs',
] as const
export type InspectPart = (typeof INSPECT_PARTS)[number]

/** Module-column passes (Gitea #30): the per-module renders the modular kit
 *  exporter requests — three PLA bodies (left/mid/right) and their three TPU
 *  feet sets. A third category on purpose: not `ExportPass` (those are bodies
 *  of the WHOLE-abacus 3MF; these each seed their own per-module 3MF), and not
 *  `InspectPart` (they ARE printable deliverables, not bench slices). Six
 *  explicit names rather than a `-Dmodule_role` define — a role define that
 *  went missing would silently render its scad default, the exact silent
 *  failure family `-Dplug_group` taught us about (see exportDefines). */
export const MODULE_PASSES = [
  'module_left',
  'module_mid',
  'module_right',
  'module_left_feet',
  'module_mid_feet',
  'module_right_feet',
] as const
export type ModulePass = (typeof MODULE_PASSES)[number]

/** Anything the worker can be asked to render as a single `only=` pass. */
export type RenderPass = ExportPass | { only: InspectPart } | { only: ModulePass }

/** The define list for one export render. Pure — and split out of the worker
 *  postMessage so the exact strings are testable: `-Dplug_group` is the one
 *  define whose absence fails SILENTLY (the scad's −1 default renders every
 *  token, so a typo'd name ships N identical copies of the whole inlay on N
 *  extruders instead of a partition). Emitted for the text pass only; the
 *  preview pump deliberately omits it and gets the unfiltered soup. */
export function exportDefines(p: Params, pass?: RenderPass): string[] {
  if (!pass) return definesFrom(p)
  const defs = [...definesFrom(p), `-Donly="${pass.only}"`]
  if ('group' in pass) defs.push(`-Dplug_group=${pass.group}`)
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

type ShellBox = { xmin: number; xmax: number; ymin: number; ymax: number }

// The weld-and-box core both shell classifiers share: union-find vertices onto a
// 0.01mm grid into connected shells, tag every triangle with its shell index,
// and give each shell its XY bounding box. Classification stays with each
// caller — the whole-abacus heuristic (analyzeShells) and the per-module export
// gate (analyzeModuleShells) read the same topology very differently.
function weldShellBoxes(positions: ArrayLike<number>): { ts: Int32Array; boxes: ShellBox[] } {
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

  const rootIdx = new Map<number, number>()
  const boxes: ShellBox[] = []
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
  return { ts, boxes }
}

/** The Studio's "take it apart" gap — mm of +X per seam in the exploded modular
 *  preview. View state only: it rides the render as `-Dexplode` and this
 *  classifier's third argument, never Params, so snapshots, content hashes and
 *  every export stay seated. */
export const EXPLODE_GAP = 12

// union-find the STL's triangles into connected shells (frame + free beads), then
// map each bead shell's centroid back to its (column, heaven/earth) cell with the
// same layout the .scad uses. Frame = the one shell far wider than a column pitch.
// `positions` is the flat triangle-soup position array (9 floats per triangle).
//
// `explode` mirrors the scad's view knob: module i (carrying column i) slides
// +i·explode, so a seated chain that welds into ONE frame shell becomes cols
// separate slabs. Exploded classification flips two rules and only those:
// frame = ANY shell spanning the full outer depth (each module qualifies; a
// bead never does), and the bead column pitch widens to sCp + explode.
export function analyzeShells(positions: ArrayLike<number>, p: Params, explode = 0): ShellAnalysis {
  const { ts, boxes } = weldShellBoxes(positions)

  // border offset: the bead field sits at (border_w, border_w) inside the outer rect
  const d = derived(p)
  const s_em = p.border_w * p.scale_factor + d.sEm
  const s_cp = d.sCp
  const s_hy = p.border_w * p.scale_factor + d.sHy
  const s_ep = d.sEp
  const exploded = explode > 0 && isModular(p)
  let frameSi = -1
  let frameSpan = 2 * s_cp // a shell must beat >1 column pitch to be the frame
  if (!exploded)
    for (let si = 0; si < boxes.length; si++) {
      const sp = boxes[si].xmax - boxes[si].xmin
      if (sp > frameSpan) {
        frameSpan = sp
        frameSi = si
      }
    }

  const shellInfo = boxes.map((b, si): ShellInfo => {
    if (exploded ? b.ymax - b.ymin >= d.outerD - 1 : si === frameSi)
      return { isFrame: true, i: 0, isHeaven: false }
    const cx = (b.xmin + b.xmax) / 2
    const cy = (b.ymin + b.ymax) / 2
    const pitch = s_cp + (exploded ? explode : 0)
    const i = Math.max(0, Math.min(p.cols - 1, Math.round((cx - s_em) / pitch)))
    return { isFrame: false, i, isHeaven: Math.abs(cy - s_hy) < s_ep * 0.5 }
  })
  return { triShell: ts, shellInfo }
}

/** Shell classifier for a PER-MODULE render (Gitea #30) — the export-time gate
 *  every module 3MF in the modular kit is built through.
 *
 *  Unlike {@link analyzeShells} (a render-time classifier that must always
 *  return something drawable), this path knows the module's exact expected
 *  topology — one frame body spanning the full outer depth plus exactly one
 *  column of free beads (1 heaven + `earth`) — and HARD-ERRORS on anything
 *  else. A mis-welded seam face, a stranded solid, or a missing bead in a kit
 *  export must stop the download, not silently ship a broken module.
 *
 *  Module renders are origin-local (every module_* pass renders at x=0), so
 *  the bead column sits at a KNOWN local x: the left end keeps the mono
 *  column-0 center (it is the mono frame's left slice, unshifted), while mid
 *  and right modules both put their column at scW/2 — the same translate
 *  identity the assembled CP5 preview pins (global column i at
 *  border + sEm + i·scW). `column` stamps the returned bead shells with the
 *  GLOBAL column this module instance will occupy, so {@link shellSlotIndex}
 *  inks them with that column's bead roles unchanged. */
export function analyzeModuleShells(
  positions: ArrayLike<number>,
  p: Params,
  kind: 'left' | 'mid' | 'right',
  column: number
): ShellAnalysis {
  const { ts, boxes } = weldShellBoxes(positions)
  const d = derived(p)
  const border = p.border_w * p.scale_factor
  const expectBeads = p.earth + 1
  if (boxes.length !== expectBeads + 1) {
    throw new Error(
      `the module_${kind} render has ${boxes.length} shells — expected ${
        expectBeads + 1
      } (1 frame + ${expectBeads} beads)`
    )
  }
  // The frame is the one shell spanning the full outer depth; a bead spans
  // about one bead length. Verified, not assumed — a truncated or split frame
  // body must not quietly become "the widest bead".
  let frameSi = 0
  for (let si = 1; si < boxes.length; si++) {
    if (boxes[si].ymax - boxes[si].ymin > boxes[frameSi].ymax - boxes[frameSi].ymin) frameSi = si
  }
  const frameSpan = boxes[frameSi].ymax - boxes[frameSi].ymin
  if (Math.abs(frameSpan - d.outerD) > 0.5) {
    throw new Error(
      `the module_${kind} frame shell spans ${frameSpan.toFixed(
        2
      )}mm of depth — expected the full ${d.outerD.toFixed(2)}mm`
    )
  }
  const cx0 = kind === 'left' ? border + d.sEm : d.scW / 2
  const sHy = border + d.sHy
  let heavens = 0
  const shellInfo = boxes.map((b, si): ShellInfo => {
    if (si === frameSi) return { isFrame: true, i: 0, isHeaven: false }
    const cx = (b.xmin + b.xmax) / 2
    if (Math.abs(cx - cx0) > d.sCp / 4) {
      throw new Error(
        `a module_${kind} bead shell centers at x=${cx.toFixed(
          2
        )}mm — expected the module's one column at x=${cx0.toFixed(2)}mm`
      )
    }
    const isHeaven = Math.abs((b.ymin + b.ymax) / 2 - sHy) < d.sEp * 0.5
    if (isHeaven) heavens++
    return { isFrame: false, i: column, isHeaven }
  })
  if (heavens !== 1) {
    throw new Error(`the module_${kind} render has ${heavens} heaven beads — expected exactly 1`)
  }
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
  | 'modular' // relocated to a side rail: the crossing rails don't print on modular columns
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
  // Modular columns print only the side rails (see MODULAR_TEXT_SLOT_INDICES),
  // so the vertical axis is the only one whose homes exist on the plate.
  if (isModular(p)) return 'vertical'
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
  // Modular columns print the side rails only; a slot that can't print is no
  // home for an aid, whether 'auto' walked there or the user pinned it — the
  // pin is honoured again the moment the design flips back to mono.
  const prints = (s: TextSlot): boolean => !isModular(p) || s === 'left' || s === 'right'
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
    if (named && !taken.has(named) && prints(named)) {
      return land(aid, named, intent, 'asked', wouldAuto(aid))
    }
    const free = aidPrefer(aid, axis).filter((s) => !taken.has(s) && prints(s))
    const slot = free.find((s) => railFits(p, s, aid.tokens)) ?? free[0] ?? null
    if (!slot) {
      const autoSlot = intent === 'auto' ? null : wouldAuto(aid)
      return { aid, slot: null, intent, autoSlot, mm: null, fits: false, reason: 'nowhere' }
    }
    // 'preferred' means today's layout — its horizontal home — not merely "first
    // choice", which now depends on the axis. A landing forced off a rail that
    // doesn't print (modular columns) outranks 'moved': the caption must name
    // the real mover, and it isn't glyph room.
    const reason: AidReason =
      (named && !prints(named)) || !prints(aid.home.horizontal)
        ? 'modular'
        : slot === aid.home.horizontal
          ? 'preferred'
          : 'moved'
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
  if (!slot)
    return isModular(p)
      ? `Nowhere to put ${aid.label} — both side rails are holding your words.`
      : `Nowhere to put ${aid.label} — all four rails are holding your words.`
  const n = aid.tokens.length
  const where = `${aid.label} is on the ${SLOT_LABEL[slot]}`
  const reads = SLOT_READS[slot]
  const tail = reads ? ` It ${reads}.` : ''
  const small = fits ? '' : ` ${n} facts will print small there.`
  if (reason === 'modular') {
    // Name the rail that ACTUALLY lost the aid — the user's pin if there was
    // one, its everyday home otherwise — and the real mover: crossing rails
    // don't print on snap-together columns.
    const lost = (TEXT_SLOTS as readonly string[]).includes(place.intent)
      ? (place.intent as TextSlot)
      : aid.home.horizontal
    return `${where}: the ${SLOT_LABEL[lost]} doesn't print on snap-together columns.${tail}${small}`
  }
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
/** The token-slot indices (TEXT_SLOT_DEFINES order) that survive modular mode:
 *  the side rails and end walls sit wholly inside the end modules (14 mm clear
 *  of the seam plane), so the modules carve them; the other four slots are laid
 *  out across the full frame width and would straddle every seam. */
export const MODULAR_TEXT_SLOT_INDICES: readonly number[] = [2, 3, 6, 7]

export function textSlots(p: Params): [string, number][][] {
  const placed = placeAids(p)
  const rail = (slot: TextSlot): [string, number][] => {
    const aid = placed.find((x) => x.slot === slot)?.aid
    return aid ? aid.tokens.map((t) => [t, 0] as [string, number]) : tokenize(slotWords(p, slot))
  }
  const all = [
    rail('top'),
    rail('bottom'),
    rail('left'),
    rail('right'),
    tokenize(p.edge_front),
    tokenize(p.edge_back),
    tokenize(p.edge_left),
    tokenize(p.edge_right),
  ]
  // Modular mode empties the seam-crossing slots HERE, at the single source —
  // defines, group counts, plan text roles, plug passes and tint centers all
  // follow without their own gates. Non-destructive: the words stay in params,
  // so flipping back to mono restores them untouched.
  if (!isModular(p)) return all
  return all.map((toks, i) => (MODULAR_TEXT_SLOT_INDICES.includes(i) ? toks : []))
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

/** Which color groups actually ink ONE end module's side slots (left = side
 *  rail 2 + end wall 6, right = 3 + 7), ascending. The per-module 3MF build
 *  needs this instead of textGroupCount because the two sides split the token
 *  population: a group whose tokens all sit on the other side legitimately
 *  ships no body in THIS module's 3MF — that's a partition, not a dropped
 *  render. The indices are exactly MODULAR_TEXT_SLOT_INDICES split by side;
 *  callers are modular-only (the kit build refuses mono designs upstream). */
export function sideTextGroups(p: Params, side: 'left' | 'right'): number[] {
  const idx = side === 'left' ? [2, 6] : [3, 7]
  const slots = textSlots(p)
  const present = new Set<number>()
  for (const i of idx) slots[i].forEach((_, k) => present.add(tokGroup(p, k)))
  return [...present].sort((a, b) => a - b)
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
  return Math.max((p.border_w + p.shelf) * p.scale_factor, d.mkI + p.marker_mm)
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

// ---- modular columns (Gitea #30) --------------------------------------------

export const isModular = (p: Params): boolean => p.seam_mode === 'modular'

/** The seam joint's fixed design constants — TS mirrors of the scad's knobs.
 *  These are NOT Params (they're the joint's identity, settled by the coupon
 *  ritual once, not per-design levers); the one per-design knob is joint_fit.
 *  seam-fit.test.ts regex-parses abacus.scad and pins every value here, the
 *  same drift guard seam-flexure-dfm.test.ts runs on the flexure knobs. */
export const SEAM = {
  jointTab: 4.5, // dovetail protrusion depth (X past the module face)
  jointNeck: 6, // dovetail neck width at the face
  jointFlare: 1, // per-side head widening — the pull-apart grab
  jointClipW: 4, // snap clip overall width (lives in the bar strip)
  jointClipL: 9.5, // clip protrusion depth; prong flex length = this − scSlot
  jointRidge: 0.2, // click ridge proud height
  scSlot: 1.5, // prong root web
  scProng: 1.2, // prong thickness (2 lines of the 0.6 wood-PLA nozzle)
  scSeat: 1.2, // positive bottom seat under every dovetail (CP1)
  scDeep: 0.3, // socket deepening past the tab tip — faces seat first
  mfWall: 1.6, // min wall: seam socket→foot pocket and pocket→seam face
  xbarEmbed: 2, // crossbar end reach past the seat into frame material
} as const

/** Fixed engineering identity for the rear-entry GRADUATED CONTINUOUS sliding
 * topology, mirrored as top-level SCAD constants (not Studio knobs). ONE male
 * rail runs the full seam in three Z-sizes (largest at the rear entry mouth,
 * smallest at the blind front stop) and rides one continuous female groove
 * whose only tight sections are the three seated berths — every rail section
 * clears every female station it passes by ≥ step/2 per side until the final
 * keyLength of travel. Every profile is centered in the slab; nothing in this
 * topology reaches the plate, so no part of the seam prints as a blade over a
 * sliver. The rear segment is the DEEP ANCHOR: deepDepth into the neighbor,
 * both flanks leaving the neck at angleDeg and then CLAMPED FLAT at deepFloor
 * and its mirror — symmetric about mid-slab, landing on a solid berth floor,
 * hooking on both lips with the per-side undercut the full-length teeth carry,
 * and spending its depth on bearing area rather than lip. Retention is the seat
 * itself: the berth-front pinch is a ~1.9° travel-direction taper, far inside
 * PLA's atan(µ)≈14° self-holding limit, so the joint seats with a firm push and
 * releases with a firm rearward tug — and a detent ridge makes that seat positive
 * rather than frictional. ONE flexure, and it is not an added finger: the male's
 * own front key, cut free as a tongue. The insertion sweep is collision-free at every
 * offset except that one designed interference, which is checked as a deflection
 * instead (female depth is monotone non-decreasing toward the mouth, and the rail
 * only ever sits rearward of its seat). */
export const SLIDING_DOVETAIL = {
  angleDeg: 14,
  maleDepth: 2, // full-length rail X depth — capped by the channel webs, which
  // edgeAllowance widens
  edgeAllowance: 1, // extra solid on EACH sliding module seam edge (+2 mm of
  // column spacing per assembled seam), spent entirely on tooth engagement: the
  // groove keeps the same backing wall a 1 mm rail had
  neck: 2.8, // MID segment Z neck; sizes are neck ± step
  step: 0.6, // Z graduation between adjacent rail sizes
  minBackingWall: 1.2,
  minLip: 1.2,
  keyLength: 8, // engaged (tight-berth) length per rail size
  funnel: 3, // relieved→tight approach funnel at each berth mouth
  pinch: 0.05, // final-seat X squeeze across the berth's front …
  pinchLength: 1.5, // … this much travel — the self-holding retention wedge
  floorRelief: 0.15, // runway floor relief past groove depth (loose travel)
  datumRelief: 0.2, // non-datum berth fronts stand off — ONE Y stop
  leadOut: 0.6, // ramp AHEAD of a berth's front, out to the runway. funnel does
  // this at a berth's REAR; nothing did it at the front, so the runway (cut
  // floorRelief deeper) butted the berth (pinch tighter) and left a rearward
  // facing ledge of floorRelief + pinch standing the berth's full height. Only
  // the next size DOWN is ever at those stations, so the ramp costs no travel
  seatClear: 0.02, // CAD gap at the front stop (print swell closes it)
  mouthFlare: 0.6, // rear-mouth Z flare beyond the pass-through size
  deepDepth: 9, // rear anchor X depth — bounded by the NEIGHBOUR's rear foot
  // pocket (sock + mfWall), NOT by the channel webs: the anchor never leaves
  // the solid back strip
  deepFloor: 1.8, // female berth floor under the anchor AND, mirrored about
  // mid-slab, the ceiling lip over it — ONE knob for both, which is what makes
  // the anchor symmetric. Nothing on the male sits below it, and the berth
  // never opens through the underside
  mouthLength: 2.5, // deep rear mouth flare length
  corner: 0.5, // anchor edge break — an inset in x/z hulled over the same run in
  // Y, so every broken face (underside included) is at exactly 45°
  anchorLead: 1.5, // B→anchor graduation run. The jump from a 2 mm rail to a
  // 9 mm one is the largest single face on the part — 7 mm of x by
  // (sFh − 2·deepFloor) of z, a cliff standing across the track — and at
  // `corner` it was barely broken at all. Same 45° inset break, given enough run
  // to BE the graduation instead of decorating it. Not the Y-blend the underside
  // can't have: an inset hulled over its own run is 45° everywhere, floor
  // included. Bounded by the z budget (the inset closes from floor AND ceiling,
  // so twice the lead has to leave a tip land) and by anchor bearing (the ramp
  // is inset for its whole run, so it bears on nothing)
  selfHoldMu: 0.25, // conservative PLA-on-PLA static friction lower bound
  // The detent — the click. A ridge on the female MIDDLE berth's floor drops into
  // a notch in the male's MIDDLE (B) section, at the mid-length of the track —
  // NOT out at the module's front corner, where the tongue's free end would be a
  // lever a thumb can reach and crack off, and never on the anchor (a spring
  // there would make the anchor itself a lever). Mid-track costs the kinematic
  // exclusivity a front-berth ridge got for free — rear entry means a female
  // feature at f is swept by every male section ahead of f — so exclusivity is
  // bought geometrically instead, by the relief channel below. The spring is the
  // male side: a Z-through slot behind the rail turns the B key plus its backing
  // skin into a cantilever tongue, so the female stays rigid and the ridge gets a
  // flat, known berth floor to stand on.
  detent: 0.15, // ridge engagement — how far the crest stands INSIDE the rail's
  // tip face at seat, which is also the deflection the tongue takes to pass it.
  // Bounded by TWO gates: the flexure's strain against the WHOLE tongue section
  // (see leaf below — skin plus rail is ~11× the skin's own second moment), and
  // the RETRACTION LIMIT, which is the non-obvious one. The female is the male
  // profile translated jointFit in +x, so the rail can back out of its groove
  // exactly jointFit before its own 14° flanks bottom on the groove's — refusing
  // to come out radially is the whole job of a dovetail — and the tongue cannot
  // deflect further than the rail it carries can retract. An insertion sweep is
  // blind to that: it measures the ridge's volume, not whether the rail has
  // anywhere to go
  detentRelief: 0.07, // middle berth NECK opened over the detent window, TOTAL
  // across both flanks (half per side). Converts to X retraction at
  // 1/(2·tan(angle)) — 0.07 of neck is 0.14 of extra room. Floor depth and flank
  // angle untouched, so neither the seat nor the undercut changes; it is purely
  // the sideways slack the deflecting tongue needs. The MIDDLE berth deliberately:
  // the front and anchor berths locate the module, so this is the one berth that
  // can afford to give up a sliver of Z grip — itself an argument for mid-track
  channelClear: 0.2, // relief channel half-width past the ridge, per side
  channelAir: 0.25, // gap between the ridge crest and the channel floor — the
  // margin every un-sprung section ahead of the tongue passes the ridge on. The
  // channel runs down the CENTRE of the rail's tip face, nose → tongue tip, and
  // is a tip-face feature only: the 14° flanks, which are what actually grip, are
  // never cut, so the small section keeps its full undercut
  detentLand: 0.6, // crest land in Y
  detentHalfHeight: 0.9, // ridge half-height in Z — the notch grown from it has
  // to stay off the rail's flanks at EVERY coupon fit, and 1.0 misses that gate
  // at 0.12
  detentOutDeg: 55, // front flank — the retention wall the male pulls out over
  detentInDeg: 18, // rear flank — the insertion cam
  detentSlop: 0.04, // flank-normal gap between ridge and notch at seat. NOT
  // joint_fit: joint_fit is running clearance for a sliding fit and a detent does
  // not run, it parks. Whatever is here is pure Y backlash before the retention
  // flank bites (slop/sin(out)), so it is held to the seat's tolerance rather than
  // the rail's — and it is still a real gap, so the click can never hold the seam
  // off its blind front stop
  springSlot: 0.8, // Z-THROUGH slot behind the rail that frees the tongue, and —
  // turned 90° at the tongue's tip and driven out through the seam face — the gap
  // that frees that tip. Both ends are inside the module now, so the slot is an L
  // in plan with a rounded blind root; it cannot move in x or y to dodge anything
  leafT: 1.2, // seam skin kept in front of the slot: the rail's backing, and the
  // tongue's root section with it
  springA: 11.25, // notch → root. The cantilever length, so the strain knob: ε
  // goes as 1/a², k as 1/a³. Set so the root lands ON scB0 — the bar strip is the
  // only solid the tongue can grow out of without a bead channel behind it to bow
  // into, and the gate below holds it there
  // Wood PLA's tensile modulus (MPa) and the conservative PLA-on-PLA static
  // friction bound the seat taper is judged against. Strain does not need either;
  // the assembly-force gate needs both, and the scad carries the same two.
  modulusMPa: 2500,
} as const

export const SLIDING_FIT_VALUES = [0.1, 0.11, 0.12] as const
export const slidingDovetailDerived = (jointFit: number) => {
  const c = SLIDING_DOVETAIL
  const angleRad = (c.angleDeg * Math.PI) / 180
  const tan = Math.tan(angleRad)
  const grooveDepth = c.maleDepth + jointFit // berth floor
  const deepestCut = grooveDepth + c.floorRelief // shallow runway/berth floor
  // The deep anchor pocket's X cut — what the module feet must stand clear of
  // (the scad's mf_sock on this topology).
  const deepPocketCut = c.deepDepth + jointFit + c.floorRelief
  const headOf = (neck: number) => neck + 2 * c.maleDepth * tan
  // Widest SHALLOW female Z opening: the large segment's relieved runway
  // (the deep mouth's Z-flare is derived from the remaining lip budget in the
  // scad, so it can never open wider than the lip gate allows).
  const runwayOpening = c.neck + c.step + 2 * (c.maleDepth + 2 * jointFit + c.floorRelief) * tan
  // The berth floor left under the deep anchor, which is ALSO the ceiling lip
  // over it — the profile is symmetric about mid-slab, so one number is both.
  const anchorFloor = c.deepFloor - jointFit
  // The deep mouth's Z-flare, spent out of that lip budget and capped at the
  // shallow mouth's step + flare (scad: the zf clamp in slide_pockets).
  const anchorMouthFlare = Math.min(c.step + c.mouthFlare, Math.max(0, anchorFloor - c.minLip))
  const runningClearance = jointFit * Math.sin(angleRad) // flank-normal, in-berth
  // A rail section passing any female station sized one graduation step up (per side).
  const passClearance = c.step / 2 + jointFit * tan
  const seatTaperDeg = (Math.atan(c.pinch / c.pinchLength) * 180) / Math.PI
  const selfHoldLimitDeg = (Math.atan(c.selfHoldMu) * 180) / Math.PI
  return {
    angleRad,
    tan,
    grooveDepth,
    deepestCut,
    deepPocketCut,
    necks: { s: c.neck - c.step, m: c.neck, l: c.neck + c.step },
    head: headOf(c.neck),
    headL: headOf(c.neck + c.step),
    runwayOpening,
    anchorFloor,
    anchorMouthFlare,
    runningClearance,
    passClearance,
    seatTaperDeg,
    selfHoldLimitDeg,
  }
}

/** An XZ cross-section of the seam, in the scad's coordinates: x = depth into
 *  the neighbour measured from the seam face, z = height off the build plate.
 *  Vertices run counter-clockwise, the ordering the scad's prism_xz needs. */
export type SeamProfile = [number, number][]

/** The male rail's full-length cross-section (scad slide_profile): a trapezoid
 *  centered on the slab, `neck` tall at the seam face, opening at angleDeg. */
export const slideProfile = (
  neck: number,
  sFh: number,
  depth: number = SLIDING_DOVETAIL.maleDepth
): SeamProfile => {
  const t = Math.tan((SLIDING_DOVETAIL.angleDeg * Math.PI) / 180)
  const cz = sFh / 2
  return [
    [0, cz - neck / 2],
    [depth, cz - neck / 2 - depth * t],
    [depth, cz + neck / 2 + depth * t],
    [0, cz + neck / 2],
  ]
}

/** The deep anchor's male cross-section (scad slide_deep_profile): the same
 *  trapezoid until each flank reaches deepFloor / its mirror, then CLAMPED flat
 *  to the tip. Symmetric about mid-slab, so both lips hook and the per-side
 *  undercut is fixed by the floor knob instead of growing with the bite.
 *  `corner` breaks the two long tip edges. `inset` shrinks floor, cap and tip
 *  while the seam root stays put — hulling an inset section `corner` behind a
 *  full one is what breaks each END of the anchor at 45°, underside included —
 *  and an inset deep enough to reach the neck leaves no flank to state. */
export const slideDeepProfile = (
  neck: number,
  sFh: number,
  inset = 0,
  corner = SLIDING_DOVETAIL.corner
): SeamProfile => {
  const c = SLIDING_DOVETAIL
  const t = Math.tan((c.angleDeg * Math.PI) / 180)
  const cz = sFh / 2
  const rb = cz - neck / 2
  const rt = cz + neck / 2
  const fl = c.deepFloor + inset
  const cap = sFh - c.deepFloor - inset
  const xb = Math.max(0, (rb - fl) / t)
  const xt = Math.max(0, (cap - rt) / t)
  const d = c.deepDepth - inset
  const k = Math.min(corner, (d - Math.max(xb, xt)) / 2, (cap - fl) / 2)
  return [
    [0, rb],
    ...(xb > 0 ? ([[xb, fl]] as SeamProfile) : []),
    [d - k, fl],
    [d, fl + k],
    [d, cap - k],
    [d - k, cap],
    ...(xt > 0 ? ([[xt, cap]] as SeamProfile) : []),
    [0, rt],
  ]
}

/** The female berth containing it (scad slide_deep_groove_profile): the same
 *  shape grown the file's way — flanks offset `fit` along +x (the uniform
 *  fit·sin(angle) flank-normal gap), floor and ceiling offset `fit` along ∓z,
 *  far wall pushed out by `xr`. `zflare` opens floor and ceiling — each with its
 *  own root corner, so neither corner moves — by the same amount at the rear
 *  mouth: it eases all four sides, which only became possible once the anchor
 *  landed on a floor instead of on the bed. The berth keeps deepFloor − fit of
 *  solid PLA underneath: the catch shelf, whose seam-edge lip hooks the male's
 *  bottom flank. */
export const slideDeepGrooveProfile = (
  neck: number,
  fit: number,
  sFh: number,
  xr = 0,
  zflare = 0
): SeamProfile => {
  const c = SLIDING_DOVETAIL
  const t = Math.tan((c.angleDeg * Math.PI) / 180)
  const cz = sFh / 2
  const d = c.deepDepth + fit + xr
  const rb = cz - neck / 2 - zflare
  const rt = cz + neck / 2 + zflare
  const fl = c.deepFloor - fit - zflare
  const cap = sFh - c.deepFloor + fit + zflare
  return [
    [-0.01, rb - (fit - 0.01) * t],
    [(rb - fl) / t - fit, fl],
    [d, fl],
    [d, cap],
    [(cap - rt) / t - fit, cap],
    [-0.01, rt + (fit - 0.01) * t],
  ]
}

/** The deep anchor's scale-dependent geometry — the only part of the sliding
 *  identity that is not scale-free, because the neck and the berth floor are
 *  absolute while the slab centerline is not. `flankRun` is where each flank
 *  clamps flat; `flatLength` is what is left of the bite to bear on, and the
 *  scad gates both (a slab tall enough to push flankRun past the tip would fold
 *  the profile on itself). */
export const slidingAnchorGeometry = (sFh: number) => {
  const c = SLIDING_DOVETAIL
  const t = Math.tan((c.angleDeg * Math.PI) / 180)
  const neck = c.neck + c.step // the anchor is always the LARGE graduation
  const rootBottom = sFh / 2 - neck / 2
  const undercut = rootBottom - c.deepFloor // per side; == capPlane − rootTop
  const flankRun = undercut / t
  return {
    neck,
    centerZ: sFh / 2,
    rootBottom,
    rootTop: sFh / 2 + neck / 2,
    floorPlane: c.deepFloor,
    capPlane: sFh - c.deepFloor,
    undercut,
    flankRun,
    flatLength: c.deepDepth - flankRun,
  }
}

/** An XY plan polygon in the scad's coordinates: x = depth into the neighbour
 *  measured from the seam face, y = along the seam from the module's front
 *  face. Extruded in Z — the detent's wedges are plan shapes, where every
 *  other seam profile in this file is a cross-section. */
export type SeamPlan = [number, number][]

/** The detent — the click, and the one flexure in this topology. The ridge sits
 *  in the MIDDLE berth, at the mid-length of the track: a berth floor is the one
 *  stretch of groove with a flat, known floor (the runway behind it is relieved
 *  and the berth's own front is the seat pinch), so the proud height is a
 *  constant, and mid-track keeps the tongue's free end buried ~48 mm from either
 *  end of the module where nothing can reach it to snap it off.
 *
 *  Mid-track gives up the exclusivity a front-berth ridge got free from rear
 *  entry — a female feature at f is swept by every male section ahead of f, and
 *  mid-track that is most of the rail — so exclusivity is bought geometrically:
 *  the RELIEF CHANNEL, a channelDepth-deep slot down the centre of the rail's TIP
 *  FACE from the nose to the tongue's tip, wide enough to clear the ridge by
 *  channelClear per side and deep enough to clear its crest by channelAir. Every
 *  un-sprung section runs past the ridge on air; contact begins only when the
 *  ridge reaches the tongue, a couple of millimetres before seat, so the click
 *  still lands on the seat. Tip face only — the 14° flanks are never cut.
 *
 *  The spring is the MALE side. An L-shaped Z-through slot behind the rail frees
 *  the B key and the leafT of skin backing it into one cantilever tongue: rooted
 *  at the slot's blind end on the solid bar strip, free at the short leg that
 *  cuts out through the seam face. Its bending SECTION is the whole tongue — skin
 *  AND the rail's own trapezoid, which is welded to it along the entire free
 *  length and carries ~11× the skin's second moment. Counting the skin alone is
 *  the same class of error as counting the female's backing strip without its
 *  groove lips, in the other direction. Strain is one gate; force is the second,
 *  because a click nobody can push home is as dead as one that cracks; the
 *  RETRACTION LIMIT (see detent/detentRelief) is the third, and it binds on the
 *  free TIP, which overswings the notch because a cantilever is straight past its
 *  load. All use the RIGID-ROOT cantilever: the wall the tongue roots into does
 *  rotate, making the real spring ~14% softer, and overstating both stiffness and
 *  strain is the safe direction. */
export const slidingDetentGeometry = (p: Params) => {
  const c = SLIDING_DOVETAIL
  const b = seamBands(p)
  const g = slidingDovetailDerived(p.joint_fit)
  const rad = (deg: number) => (deg * Math.PI) / 180
  const tanOut = Math.tan(rad(c.detentOutDeg))
  const tanIn = Math.tan(rad(c.detentInDeg))
  const cz = b.sFh / 2
  const k0S = b.d.chamf + 1 + c.seatClear // rail front datum
  const k0M = b.d.outerD / 2 - c.keyLength / 2 // A→B graduation
  const midY0 = k0M - c.datumRelief // the MIDDLE berth's front …
  const midY1 = k0M + c.keyLength + 0.3 // … and its rear
  const berthY1 = midY1 // the berth the ridge lives in
  const yc = k0M + c.keyLength / 2 // crest centre = the berth's mid-length,
  // which on this module lands on outerD / 2 exactly: the middle of the track
  const y0 = yc - c.detentLand / 2 // crest land [y0, y1]
  const y1 = yc + c.detentLand / 2
  const proud = p.joint_fit + c.detent // over the BERTH floor
  const y00 = y0 - proud / tanOut // front toe, on the berth floor
  const yr = y1 + proud / tanIn
  // The tongue's tip, and with it the relief channel's rear end: the slot's short
  // leg goes at the forward-most station that does NOT cut the middle berth's
  // seat pinch. One station splits rail from tongue — everything ahead of it is
  // un-sprung rail that must pass the ridge on air, everything behind it flexes.
  const channelY1 = midY0 + c.pinchLength
  const springY0 = channelY1 + c.springSlot
  const springA = c.springA // notch → the slot's blind root
  const springY1 = yc + springA
  const channelDepth = c.detent + c.channelAir // into the rail's tip face
  const channelWidth = 2 * (c.detentHalfHeight + c.channelClear) // … and in Z
  const floorX = g.grooveDepth // berth floor the ridge grows from
  const crestX = c.maleDepth - c.detent // crest, inside the rail's tip face
  const notchFloorX = crestX - p.joint_fit // rail left behind the notch
  // The retraction limit. Past its load a cantilever is straight, so the free tip
  // overswings the notch by 1.5·b/a and the TIP is what binds. Against it: the
  // jointFit the dovetail leaves before its 14° flanks bottom, plus what the
  // berth's neck relief converts to, at 1/(2·tan(angle)) per unit of neck.
  const tipOver = yc - springY0 // load → free tip
  const tipDefl = c.detent * (1 + (1.5 * tipOver) / springA)
  const retractRoom = p.joint_fit + c.detentRelief / (2 * g.tan)
  // The tongue's section, in x measured from the slot's inner face: the skin is a
  // rectangle at full slab height, the rail is the B trapezoid (neck at the seam
  // face, head at the tip). Moments are accumulated about x = 0 and shifted to
  // the centroid once, so no piece needs its own parallel-axis term.
  const wall = p.web * p.scale_factor + c.edgeAllowance
  const backing = wall - g.deepestCut // the FEMALE's post-groove wall, reported only
  const neckB = c.neck // the tongue carries the MIDDLE section now, not the small
  const headB = neckB + 2 * c.maleDepth * Math.tan(g.angleRad)
  const railArea = (c.maleDepth * (neckB + headB)) / 2
  const leafA = c.leafT * b.sFh + railArea
  const leafQ =
    (b.sFh * c.leafT ** 2) / 2 + c.leafT * railArea + c.maleDepth ** 2 * (neckB / 6 + headB / 3)
  const leafJ =
    (b.sFh * c.leafT ** 3) / 3 +
    c.leafT ** 2 * railArea +
    2 * c.leafT * c.maleDepth ** 2 * (neckB / 6 + headB / 3) +
    c.maleDepth ** 3 * (neckB / 12 + headB / 4)
  const leafX = leafQ / leafA // centroid depth
  const inertia = leafJ - leafA * leafX ** 2
  const leafC = Math.max(leafX, c.leafT + c.maleDepth - leafX) // outer fibre
  // Cantilever, loaded at the notch: δ = F·a³/(3EI) and M = F·a at the root, so
  // ε = M·c/(EI) drops E and I alike and the gate is 3·δ·c/a² (×100 for %).
  const strainPct = (300 * c.detent * leafC) / springA ** 2
  const stiffnessN = (3 * c.modulusMPa * inertia) / springA ** 3 // N/mm
  const forceN = stiffnessN * c.detent
  // Axial force at a flank: the spring load through a wedge of that angle to
  // the travel, with PLA's friction taken at the same conservative µ the seat
  // taper is judged against. Rearward (18°) is the insertion cam; forward (55°)
  // is the wall a pull has to climb.
  const cam = (deg: number) =>
    (forceN * (Math.tan(rad(deg)) + c.selfHoldMu)) / (1 - c.selfHoldMu * Math.tan(rad(deg)))
  return {
    k0S,
    k0M,
    midY0,
    midY1,
    y0: y00,
    crest0: y0,
    crest1: y1,
    rearToe: yr,
    crestY: yc,
    proud,
    floorX,
    crestX,
    notchFloorX,
    berthY1,
    springA,
    springY0,
    springY1,
    channelY1,
    channelDepth,
    channelWidth,
    tipOver,
    tipDefl,
    retractRoom,
    backing,
    leafA,
    leafX,
    leafC,
    inertia,
    strainPct,
    stiffnessN,
    forceN,
    seatForceN: cam(c.detentInDeg),
    partForceN: cam(c.detentOutDeg),
    /** Y free travel at seat before a flank bears: a y-shift of s closes a
     *  flank-normal gap by s·sin(flank). Forward is the blind stop's business,
     *  so the retention (out) flank's number is the click's backlash. */
    backlashOut: c.detentSlop / Math.sin(rad(c.detentOutDeg)),
    backlashIn: c.detentSlop / Math.sin(rad(c.detentInDeg)),
    /** the female wedge, standing off the berth floor. `fit` is the SAMPLE's, so
     *  a coupon plate's other fits can never leave the ridge floating over a
     *  floor cut somewhere else — the crest land stays pinned to the berth's
     *  mid-length and only the toes move with the floor. */
    ridge: (fit = p.joint_fit): SeamPlan => {
      const xf = c.maleDepth + fit
      const pr = xf - crestX
      return [
        [xf, y0 - pr / tanOut],
        [crestX, y0],
        [crestX, y1],
        [xf, y1 + pr / tanIn],
      ]
    },
    /** the male wedge: the ridge's two flank LINES, each stepped back detentSlop
     *  along its own normal, plus a `fit` of depth at the floor and of half-height
     *  in Z. The flanks are stated where the ridge's cross the rail's TIP face —
     *  the surface the notch is cut into. Read them off the ridge's toes on the
     *  groove floor instead and every flank gains (floor − tip)·cos(flank) it
     *  never asked for, which is backlash: the seam still seats on its blind front
     *  stop, but the click is loose against a pull by that much before it bites. */
    notch: (fit = p.joint_fit): SeamPlan => {
      const xt = c.maleDepth + 0.01
      const xc = crestX - fit
      const yf = y0 - c.detent / tanOut - c.detentSlop / Math.sin(rad(c.detentOutDeg))
      const yb = y1 + c.detent / tanIn + c.detentSlop / Math.sin(rad(c.detentInDeg))
      const front = (x: number) => yf - (x - c.maleDepth) / tanOut
      const rear = (x: number) => yb + (x - c.maleDepth) / tanIn
      return [
        [xt, front(xt)],
        [xc, front(xc)],
        [xc, rear(xc)],
        [xt, rear(xt)],
      ]
    },
    ridgeZ: [cz - c.detentHalfHeight, cz + c.detentHalfHeight] as [number, number],
    notchZ: [cz - c.detentHalfHeight - p.joint_fit, cz + c.detentHalfHeight + p.joint_fit] as [
      number,
      number,
    ],
    /** the L-shaped slot that frees the tongue (scad slide_spring_slot_cut), in
     *  the module's own x from its LEFT face. The LONG leg sits behind the seam
     *  skin on the male (right) edge and runs [channelY1, springY1], blind at both
     *  ends — the rounded root is the tongue's; the SHORT leg is the same width of
     *  Y turned 90° at channelY1 and driven out through the seam face, which is
     *  what frees the tongue's TIP. Both ends are inside the module, so nothing
     *  about this slot reaches an outer face in plan. Z-through — it opens the top
     *  face as well as the bottom. */
    slot: {
      x0: b.d.scW - c.leafT - c.springSlot,
      w: c.springSlot,
      y0: channelY1,
      y1: springY1,
      /** the short leg: [tipY0, tipY1] in Y, out through the seam face in x */
      tipY0: channelY1,
      tipY1: springY0,
    },
    /** the relief channel (scad slide_relief_channel), the feature that buys back
     *  the exclusivity mid-track gave up: a groove down the CENTRE of the rail's
     *  TIP FACE, from the nose to the tongue's tip, that every un-sprung section
     *  passes the ridge inside. Stated as the cut, in the rail's own x (depth from
     *  the seam face) and z about mid-slab. Tip face only — it stops channelDepth
     *  short of the flanks, so the 14° grip surfaces are untouched. */
    channel: {
      x0: c.maleDepth - channelDepth,
      d: channelDepth,
      y0: k0S,
      y1: springY0,
      z: [cz - channelWidth / 2, cz + channelWidth / 2] as [number, number],
    },
  }
}

/** The seam-relevant band edges and module widths, all in scad names — one
 *  derivation shared by seamFit, moduleFeetLayout and the CP5+ preview math so
 *  a verdict can never disagree with the geometry it's a verdict about. */
const seamBands = (p: Params) => {
  const d = derived(p)
  const S = p.scale_factor
  const sBw = p.border_w * S
  const sBl = p.bead_len * S
  const cl = p.clearance
  return {
    d,
    sFh: p.frame_h * S,
    scF1: sBw + d.sElo - sBl / 2 - cl, // front band [0, scF1]
    scB0: sBw + d.sEhi + sBl / 2 + cl, // bar band [scB0, scB1]
    scB1: sBw + d.sHlo - sBl / 2 - cl,
    scK0: sBw + d.sHhi + sBl / 2 + cl, // back band [scK0, outerD]
  }
}

/** The mid-module foot, derived exactly as the scad derives mf_*. Printed:
 *  capped at the 6.35 mm (1/4") stud class, floored by what actually fits
 *  between the seam socket's deepest cut and the seam face — joint dims are
 *  absolute while the module width scales, so the cap only binds near S = 1.
 *  Adhesive: the TRUE bumper width — bought hardware seats in a pocket of its
 *  own size or not at all, so `bumperFits` (the scad's stick-on assert) is the
 *  verdict instead of a silent cap. */
export type ModuleFeetLayout = {
  /** the derived foot width (side/diameter at the bottom face) */
  w: number
  mouth: number
  seat: number
  /** REAR pocket center X in module-local coords — centered in the band beside
   *  the socket (the socket is the rear anchor berth, a rear-strip feature) */
  x: number
  /** FRONT pocket center X — the rear's again. It was not, when the tongue was a
   *  front-corner cantilever: the spring slot ran out through the module's FRONT
   *  face, straight past this pocket, so the front foot had to be squeezed into
   *  its own band between the groove's deepest cut and the slot's inner face. The
   *  tongue is mid-track now, forty-odd millimetres behind the front foot, so the
   *  front strip's only obstruction is the groove again. */
  xFront: number
  /** that band's bounds, kept because the slot verdict still reads them: a scale
   *  that couldn't fit the band couldn't fit this pocket either */
  frontLo: number
  frontHi: number
  /** deepest seam-socket cut into module X (tab + fit + deepening) */
  sock: number
  /** the free width beside the socket a mid-module pocket can occupy */
  band: number
  /** w ≥ 4 — the scad's hard floor for a foot worth printing */
  fits: boolean
  /** both clearance walls ≥ 1.5: socket→pocket and pocket→seam face */
  walls: boolean
  /** printed only: the band (not the 6.35 class, not feet_w) decided `w` */
  capped: boolean
  /** adhesive only: the bought bumper truly fits the band. Printed feet derive
   *  their own width, so this is vacuously true there. */
  bumperFits: boolean
  /** smallest scale_factor that seats the bumper beside the socket (the band
   *  scales, the socket doesn't) — bisected like FeetFit.minScale; null when
   *  it already fits, or when even ×4 can't hold it */
  minScale: number | null
}
export function moduleFeetLayout(p: Params): ModuleFeetLayout {
  const d = derived(p)
  const f = feetEffective(p)
  const fitEff = f.mouth / 2 - p.feet_w / 2 // recover fit_eff without re-branching
  const undercutEff = (f.seat - f.mouth) / 2
  const printed = p.feet_mode === 'printed'
  const sock =
    p.joint_type === 'sliding_dovetail'
      ? slidingDovetailDerived(p.joint_fit).deepPocketCut
      : SEAM.jointTab + p.joint_fit + SEAM.scDeep
  const bandAt = (s: number) =>
    derived({ ...p, scale_factor: s }).scW - sock - 2 * SEAM.mfWall - 2 * undercutEff - 2 * fitEff
  const band = bandAt(p.scale_factor)
  const w = printed ? Math.min(p.feet_w, 6.35, band) : p.feet_w
  const mouth = w + 2 * fitEff
  const seat = mouth + 2 * undercutEff
  const x = (sock + d.scW) / 2
  const g = slidingDovetailDerived(p.joint_fit)
  const frontLo = g.deepestCut + SEAM.mfWall + seat / 2
  const frontHi =
    d.scW - SLIDING_DOVETAIL.leafT - SLIDING_DOVETAIL.springSlot - SEAM.mfWall - seat / 2
  const xFront = x // scad mf_x_front — see the type's note
  const bumperFits = printed || p.feet_w <= band
  let minScale: number | null = null
  if (!bumperFits && p.feet_w <= bandAt(4)) {
    let lo = p.scale_factor
    let hi = 4
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (p.feet_w <= bandAt(mid)) hi = mid
      else lo = mid
    }
    minScale = hi
  }
  return {
    w,
    mouth,
    seat,
    x,
    xFront,
    frontLo,
    frontHi,
    sock,
    band,
    fits: w >= 4,
    walls: x - seat / 2 - sock >= 1.5 && d.scW - x - seat / 2 >= 1.5,
    capped: printed && band < Math.min(p.feet_w, 6.35),
    bumperFits,
    minScale,
  }
}

/** Module-local foot centers for the viewer's stud preview, per module kind.
 *  Mid feet sit beside the seam socket at the MONO corner inset (scad MF_Y —
 *  same edge setback as every other foot); end modules keep the monolith's own
 *  corner feet, whose local X collapses to `modWe − c` for the right module
 *  (the mono frame width cancels out of frame_w − c − x0). */
export function moduleFeetPositions(p: Params, kind: 'left' | 'mid' | 'right'): [number, number][] {
  const d = derived(p)
  const { c } = feetEffective(p)
  const D = d.outerD
  if (kind === 'mid') {
    const { x, xFront } = moduleFeetLayout(p)
    return [
      [xFront, c],
      [x, D - c],
    ]
  }
  const x = kind === 'left' ? c : d.modWe - c
  return [
    [x, c],
    [x, D - c],
  ]
}

/** One printed foot of a modular design, in ASSEMBLED-frame coordinates — the
 *  same frame {@link feetPositions} answers in, so the viewer draws both kinds
 *  of design through one code path. */
export type ModuleFootStud = {
  x: number
  y: number
  /** This foot's own mouth width. Mid modules run the smaller ≤ 6.35 mm
   *  module-foot class (`moduleFeetLayout`), end modules keep the monolith's
   *  corner foot — one plate can carry both, so the size travels per stud. */
  mouth: number
  kind: 'left' | 'mid' | 'right'
}

/**
 * Every printed foot of a MODULAR design, laid out in the assembled frame.
 *
 * A modular kit's feet are NOT the monolith's: `module_feet` in the scad emits
 * exactly two per module — mid modules get `MF_XY` (beside the seam socket, in
 * the smaller foot class), end modules keep the monolith's own corner feet (0
 * and 3 on the left, 1 and 2 on the right) and nothing else. The mono
 * intermediate feet that split a long bottom run never appear: every seam
 * already lands a foot, so the run is split by construction.
 *
 * Modules abut with no added width (`2·modWe + (cols−2)·scW === frameW`), so a
 * module's origin is just the widths to its left — which is why the four end
 * studs come back exactly on the mono corners while the mid ones sit on the
 * seam pitch, not the mono foot pitch. Mirroring `feetPositions` here instead
 * would drift by a whole foot class and a socket's offset.
 *
 * `explode` is the studio's take-it-apart gap, and the feet have to ride it:
 * module i (carrying column i) slides +i·explode, exactly as the scad's own
 * `-Dexplode` moves the bodies. A stud left at its seated x would hang in the
 * opened seam — under a module that is no longer there.
 */
export function moduleFeetStuds(p: Params, explode = 0): ModuleFootStud[] {
  const d = derived(p)
  const endMouth = feetEffective(p).mouth
  const midMouth = moduleFeetLayout(p).mouth
  const e = isModular(p) ? explode : 0
  const studs: ModuleFootStud[] = []
  const add = (kind: 'left' | 'mid' | 'right', x0: number, mouth: number): void => {
    for (const [x, y] of moduleFeetPositions(p, kind)) studs.push({ x: x0 + x, y, mouth, kind })
  }
  add('left', 0, endMouth)
  for (let j = 0; j < p.cols - 2; j++) add('mid', d.modWe + j * d.scW + (j + 1) * e, midMouth)
  add('right', d.frameW - d.modWe + (p.cols - 1) * e, endMouth)
  return studs
}

/** One row of the seam-fit table: a TS mirror of one scad assert. `ok:false`
 *  means the corresponding module/coupon render would ABORT on that assert —
 *  which is why the panel blocks the kit and coupon downloads on any failure
 *  instead of letting the worker discover it mid-export. `knob` names the lever
 *  that fixes it, the same job FeetFit.minBorderW does for the mono feet. */
export type SeamVerdict = {
  code:
    | 'strain'
    | 'dove_walls'
    | 'clip_walls'
    | 'seat'
    | 'module_feet'
    | 'feet_bumper'
    | 'feet_socket'
    | 'feet_crossbar'
    | 'sliding_fit'
    | 'backing_wall'
    | 'z_lips'
    | 'datum_lead'
    | 'deep_backing'
    | 'deep_lip'
    | 'anchor_flanks'
    | 'anchor_flats'
    | 'anchor_lead_tip'
    | 'anchor_lead_bearing'
    | 'mouth_lip'
    | 'detent_flanks'
    | 'detent_rail'
    | 'detent_reach'
    | 'detent_pinch'
    | 'detent_retract'
    | 'detent_tip_land'
    | 'detent_channel_rail'
    | 'detent_channel_flanks'
    | 'detent_strain'
    | 'detent_push'
    | 'detent_backlash'
    | 'detent_skin'
    | 'detent_slot'
    | 'detent_slot_end'
    | 'feet_front_band'
    | 'retention'
  ok: boolean
  message: string
  knob: 'scale_factor' | 'joint_fit' | 'feet_w' | 'feet_mode' | 'none'
}
export type SeamFit = {
  /** every verdict passed — seam geometry renders without an assert abort */
  ok: boolean
  verdicts: SeamVerdict[]
  /** wood-PLA peak outer-fibre strain at worst intended engagement, in % —
   *  the number the flexure gate compares against wood PLA's ~1.5% break
   *  strain with 1.5× safety (so the gate line is 1.0). The snap clip's is
   *  knob-only; the sliding detent's rides scale_factor and joint_fit, because
   *  its leaf is the module's own channel wall rather than a printed finger. */
  strainPct: number
}

/** Mirror of every scad assert the seam geometry can trip, in scad order.
 *  Like feetFit this computes unconditionally — the feet rows pass trivially
 *  when feet are off, exactly as the scad's `!(mod_active && feet) || …`
 *  predicates do — and callers gate on seam_mode for WHEN to show it. */
function verticalSeamFit(p: Params): SeamFit {
  const b = seamBands(p)
  const mf = moduleFeetLayout(p)
  const feetOn = p.feet_mode !== 'none'
  const crossbar = feetEffective(p).crossbar
  const strainPct =
    (150 * SEAM.scProng * (SEAM.jointRidge + 0.05)) / (SEAM.jointClipL - SEAM.scSlot) ** 2
  const verdicts: SeamVerdict[] = [
    {
      code: 'strain',
      ok: strainPct <= 1.0,
      message:
        strainPct <= 1.0
          ? `snap-clip strain ${strainPct.toFixed(2)}% — safe for wood PLA (gate 1.0%)`
          : `snap-clip strain ${strainPct.toFixed(2)}% would crack wood PLA`,
      knob: 'none',
    },
    {
      code: 'dove_walls',
      ok:
        SEAM.jointNeck + 2 * (SEAM.jointFlare + p.joint_fit) + 3.2 <=
        Math.min(b.scF1, b.d.outerD - b.scK0),
      message: 'dovetail socket leaves <1.6 mm walls in the border strips',
      knob: 'scale_factor',
    },
    {
      code: 'clip_walls',
      ok: SEAM.jointClipW + 2 * (p.joint_fit + SEAM.jointRidge + 0.05) + 2.4 <= b.scB1 - b.scB0,
      message: 'clip socket leaves <1.2 mm walls in the bar strip',
      knob: 'scale_factor',
    },
    {
      code: 'seat',
      ok: SEAM.scSeat >= 0.6 && SEAM.scSeat + SEAM.jointTab + 1 <= b.sFh,
      message: 'bottom seat + 45° chamfer leave <1 mm of straight dovetail wall',
      knob: 'scale_factor',
    },
    {
      code: 'module_feet',
      ok: !feetOn || mf.fits,
      message: 'module feet don’t fit beside the seam socket',
      knob: 'scale_factor',
    },
    {
      code: 'feet_bumper',
      ok: !feetOn || mf.bumperFits,
      message: `stick-on bumper doesn’t fit beside the seam socket (${p.feet_w.toFixed(1)} mm into a ${Math.max(0, mf.band).toFixed(1)} mm band)`,
      knob: 'feet_w',
    },
    {
      code: 'feet_socket',
      ok: !feetOn || mf.walls,
      message: 'module foot pocket too close to the seam socket or the seam face',
      knob: 'feet_w',
    },
    {
      code: 'feet_crossbar',
      ok: !feetOn || !crossbar || feetEffective(p).c + mf.seat / 2 + SEAM.xbarEmbed + 0.8 <= b.scF1,
      message: 'module foot crossbar would break into the bead channel',
      knob: 'feet_w',
    },
  ]
  return { ok: verdicts.every((v) => v.ok), verdicts, strainPct }
}

function slidingSeamFit(p: Params): SeamFit {
  const b = seamBands(p)
  const mf = moduleFeetLayout(p)
  const g = slidingDovetailDerived(p.joint_fit)
  const c = SLIDING_DOVETAIL
  const a = slidingAnchorGeometry(b.sFh)
  const dt = slidingDetentGeometry(p)
  const feetOn = p.feet_mode !== 'none'
  const crossbar = feetEffective(p).crossbar
  const legalFit = SLIDING_FIT_VALUES.some((fit) => Math.abs(fit - p.joint_fit) < 1e-9)
  // scad sc_wall: the solid a modular edge carries, groove and slot both cut
  // from it.
  const seamWall = p.web * p.scale_factor + c.edgeAllowance
  const backingWall = seamWall - g.deepestCut
  const lip = (b.sFh - g.runwayOpening) / 2
  // The scad's Y stations, in the same names (slide_k0_s … slide_mouth0):
  // rail front datum, A→B graduation, shallow→deep taper start, deep mouth.
  const { chamf, outerD, scW } = b.d
  const k0S = chamf + 1 + c.seatClear
  const k0M = outerD / 2 - c.keyLength / 2
  const taper0 = b.scK0 + 0.3
  const anchor0 = taper0 + c.funnel + c.datumRelief
  const mouth0 = outerD - c.mouthLength
  // Mirror of the scad berth-layout assert: S berth + funnel + lead-out clear
  // the mid berth, mid berth + funnel clear the taper start, and taper + funnel
  // + pinch clear the deep mouth, each with slack.
  const layoutOk =
    k0S + c.keyLength + 0.3 + c.funnel + c.leadOut + 1 <= k0M - c.datumRelief &&
    k0M + c.keyLength + 0.3 + c.funnel + 1 <= taper0 &&
    taper0 + c.funnel + c.pinchLength + 2 <= mouth0
  // The pocket-vs-own-rail gate runs at the WORST legal fit, exactly as the
  // scad hardcodes 0.12 — that cut must clear at any coupon-calibrated
  // compensation. The lip gate reads the actual fit, like its scad assert: the
  // ceiling is the mirrored berth floor, so it is scale-free and the fit is the
  // only thing that eats it.
  const worstFit = Math.max(...SLIDING_FIT_VALUES)
  const deepBacking = scW - (c.deepDepth + worstFit + c.floorRelief)
  const deepLip = g.anchorFloor
  const verdicts: SeamVerdict[] = [
    {
      code: 'sliding_fit',
      ok: legalFit,
      message: legalFit
        ? `sliding compensation ${p.joint_fit.toFixed(2)} mm is coupon-calibrated`
        : 'sliding compensation must be 0.10, 0.11, or 0.12 mm',
      knob: 'joint_fit',
    },
    {
      code: 'backing_wall',
      ok: backingWall >= c.minBackingWall,
      message: `female groove leaves ${backingWall.toFixed(2)} mm backing wall (minimum ${c.minBackingWall.toFixed(2)} mm)`,
      knob: 'scale_factor',
    },
    {
      code: 'z_lips',
      ok: lip >= c.minLip,
      message: `large-segment runway leaves ${lip.toFixed(2)} mm top/bottom lips`,
      knob: 'scale_factor',
    },
    {
      code: 'datum_lead',
      ok: layoutOk,
      message: 'graduated berths, funnels and the deep anchor don’t fit along the module',
      knob: 'scale_factor',
    },
    {
      code: 'deep_backing',
      ok: deepBacking >= 2,
      message: `deep anchor pocket leaves ${deepBacking.toFixed(2)} mm before the module’s own rail (minimum 2 mm)`,
      knob: 'scale_factor',
    },
    {
      code: 'deep_lip',
      ok: deepLip >= c.minLip,
      message: `deep anchor berth floor — and the ceiling lip mirroring it — is ${deepLip.toFixed(2)} mm`,
      knob: 'joint_fit',
    },
    {
      code: 'anchor_flanks',
      ok: a.undercut >= 0.3,
      message: `deep anchor hooks ${a.undercut.toFixed(2)} mm per side between neck and berth floor (minimum 0.30 mm)`,
      knob: 'scale_factor',
    },
    {
      code: 'anchor_flats',
      ok: a.flatLength >= 1,
      message: `deep anchor flanks clamp flat ${a.flatLength.toFixed(2)} mm before the tip (minimum 1 mm) — a taller slab needs a shallower bite`,
      knob: 'scale_factor',
    },
    {
      code: 'anchor_lead_tip',
      ok: b.sFh - 2 * (c.deepFloor + c.anchorLead) >= 0.4,
      message: `B→anchor ramp closes to a ${(b.sFh - 2 * (c.deepFloor + c.anchorLead)).toFixed(2)} mm tip land (minimum 0.40 mm) — the inset eats the anchor from floor and ceiling at once`,
      knob: 'scale_factor',
    },
    {
      code: 'anchor_lead_bearing',
      ok: outerD - c.corner - (anchor0 + c.anchorLead) >= 6,
      message: `B→anchor ramp leaves ${(outerD - c.corner - (anchor0 + c.anchorLead)).toFixed(2)} mm of full-section anchor bearing (minimum 6 mm)`,
      knob: 'scale_factor',
    },
    {
      code: 'mouth_lip',
      ok: c.deepFloor - p.joint_fit - c.minLip >= 0,
      message: `deep mouth has ${(c.deepFloor - p.joint_fit - c.minLip).toFixed(2)} mm of flare budget over the berth floor lip`,
      knob: 'joint_fit',
    },
    {
      code: 'detent_flanks',
      ok:
        c.detentHalfHeight + p.joint_fit + 0.3 <=
        c.neck / 2 + dt.notchFloorX * Math.tan(g.angleRad),
      message:
        'detent notch would cut the rail flanks — the dovetail’s grip is what it must not touch',
      knob: 'joint_fit',
    },
    {
      code: 'detent_rail',
      ok: dt.notchFloorX >= 1.2,
      message: `detent notch leaves ${dt.notchFloorX.toFixed(2)} mm of rail depth behind it (minimum 1.2 mm)`,
      knob: 'joint_fit',
    },
    {
      code: 'detent_pinch',
      ok: dt.y0 >= dt.midY0 + c.pinchLength,
      message: 'detent ridge starts on the berth’s seat pinch, not on its floor',
      knob: 'scale_factor',
    },
    {
      code: 'detent_reach',
      ok: dt.rearToe <= dt.berthY1,
      message: `detent ridge ends ${(dt.berthY1 - dt.rearToe).toFixed(2)} mm inside the middle berth — past it it would stand on relieved runway`,
      knob: 'scale_factor',
    },
    {
      // The gate an insertion sweep is blind to: it measures the ridge's volume,
      // not whether the rail carrying the tongue has anywhere to retract to.
      code: 'detent_retract',
      ok: dt.tipDefl <= dt.retractRoom,
      message: `tongue’s tip swings ${dt.tipDefl.toFixed(3)} mm into the ${dt.retractRoom.toFixed(3)} mm the dovetail leaves it — past that the 14° flanks bottom out and the click stops being a flexure`,
      knob: 'joint_fit',
    },
    {
      code: 'detent_tip_land',
      ok: dt.springY0 < dt.y0,
      message: `tongue’s tip gap leaves ${(dt.y0 - dt.springY0).toFixed(2)} mm of land in front of the notch`,
      knob: 'scale_factor',
    },
    {
      code: 'detent_channel_rail',
      ok: dt.channelDepth + 1.2 <= c.maleDepth,
      message: `relief channel leaves ${(c.maleDepth - dt.channelDepth).toFixed(2)} mm of rail behind it (minimum 1.2 mm)`,
      knob: 'none',
    },
    {
      code: 'detent_channel_flanks',
      ok:
        dt.channelWidth / 2 + 0.3 <=
        (c.neck - c.step) / 2 + (c.maleDepth - dt.channelDepth) * Math.tan(g.angleRad),
      message:
        'relief channel would cut the small section’s flanks — it is a tip-face feature, and the 14° flanks are what grip',
      knob: 'none',
    },
    {
      code: 'detent_strain',
      ok: dt.strainPct <= 1.0,
      message:
        dt.strainPct <= 1.0
          ? `detent strain ${dt.strainPct.toFixed(2)}% — safe for wood PLA (gate 1.0%)`
          : `detent strain ${dt.strainPct.toFixed(2)}% would crack wood PLA`,
      knob: 'scale_factor',
    },
    {
      code: 'detent_push',
      ok: dt.seatForceN <= 15,
      message: `detent needs ${dt.seatForceN.toFixed(1)} N along the seam to push home (hand limit 15 N)`,
      knob: 'scale_factor',
    },
    {
      code: 'detent_backlash',
      ok: dt.backlashOut <= 0.05,
      message: `detent has ${dt.backlashOut.toFixed(3)} mm of free travel before the retention flank bites (limit 0.05 mm)`,
      knob: 'none',
    },
    {
      code: 'detent_skin',
      ok: c.leafT >= c.minBackingWall,
      message: `spring slot leaves the rail ${c.leafT.toFixed(2)} mm of backing skin (minimum ${c.minBackingWall})`,
      knob: 'none',
    },
    {
      code: 'detent_slot',
      ok: c.leafT + c.springSlot <= seamWall - c.minBackingWall,
      message: `spring slot leaves ${(seamWall - c.leafT - c.springSlot).toFixed(2)} mm of wall in front of the bead channel (minimum ${c.minBackingWall})`,
      knob: 'scale_factor',
    },
    {
      // The root has to land ON the bar strip: it is the only solid the tongue can
      // grow out of with no bead channel behind it to bow into. Past scB0 the slot
      // runs THROUGH that strip; short of scF1 the root is still in the front one.
      code: 'detent_slot_end',
      ok: dt.springY1 <= b.scB0 && dt.springY1 >= b.scF1,
      message:
        dt.springY1 > b.scB0
          ? `spring slot runs ${(dt.springY1 - b.scB0).toFixed(1)} mm through the bar strip the tongue is meant to root in`
          : dt.springY1 < b.scF1
            ? 'spring slot’s root is still in the front strip — the tongue is not rooted where it thinks it is'
            : `spring slot roots ${(b.scB0 - dt.springY1).toFixed(1)} mm inside the bar strip`,
      knob: 'scale_factor',
    },
    {
      code: 'retention',
      ok: g.seatTaperDeg <= g.selfHoldLimitDeg,
      message: `seat taper ${g.seatTaperDeg.toFixed(1)}° is self-holding (PLA µ ≥ ${c.selfHoldMu} → limit ${g.selfHoldLimitDeg.toFixed(0)}°), and the detent adds a ${dt.partForceN.toFixed(0)} N wall to climb`,
      knob: 'none',
    },
    {
      code: 'module_feet',
      ok: !feetOn || mf.fits,
      message: 'module feet don’t fit beside the sliding groove',
      knob: 'scale_factor',
    },
    {
      code: 'feet_bumper',
      ok: !feetOn || mf.bumperFits,
      message: `stick-on bumper doesn’t fit beside the sliding groove (${p.feet_w.toFixed(1)} mm into a ${Math.max(0, mf.band).toFixed(1)} mm band)`,
      knob: 'feet_w',
    },
    {
      code: 'feet_socket',
      ok: !feetOn || mf.walls,
      message: 'module foot pocket too close to the sliding groove or seam face',
      knob: 'feet_w',
    },
    {
      code: 'feet_crossbar',
      ok: !feetOn || !crossbar || feetEffective(p).c + mf.seat / 2 + SEAM.xbarEmbed + 0.8 <= b.scF1,
      message: 'module foot crossbar would break into the bead channel',
      knob: 'feet_w',
    },
    {
      code: 'feet_front_band',
      ok: !feetOn || mf.frontHi - mf.frontLo >= 1.5,
      message: `front module foot has ${(mf.frontHi - mf.frontLo).toFixed(2)} mm of band between the sliding groove and the spring slot (minimum 1.5 mm)`,
      knob: 'scale_factor',
    },
  ]
  // The one flexure: the tongue the detent notch rides on, at the engagement it
  // has to give up to let the ridge pass.
  return { ok: verdicts.every((v) => v.ok), verdicts, strainPct: dt.strainPct }
}

/** Topology dispatcher. The legacy branch is intentionally isolated above so its
 * arithmetic and verdict order remain byte-for-byte stable. */
export function seamFit(p: Params): SeamFit {
  return p.joint_type === 'sliding_dovetail' ? slidingSeamFit(p) : verticalSeamFit(p)
}
