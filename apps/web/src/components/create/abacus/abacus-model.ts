// Abacus Studio — pure parametric model logic (graduated verbatim from the
// off-stack bench's main.ts; see Gitea epic #5, Phase 0 #6).
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
  // perimeter text: 4 top-face rails (preset or custom tokens) + 4 side walls
  top_preset: 'friends-of-10',
  top_text: '',
  bottom_preset: 'friends-of-5',
  bottom_text: '',
  left_preset: 'custom',
  left_text: '',
  right_preset: 'custom',
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
  // adhesive feet (bottom face; absolute — real feet don't scale)
  feet: true,
  feet_preset: 'circle 9',
  feet_shape: 'circle',
  feet_w: 9,
  feet_depth: 1.5,
  feet_fit: 0.15,
  retention: 'none',
  feet_undercut: 0,
  feet_span: 110, // max unsupported bottom run (mm @ scale 1) before mid feet
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
export const TEXT_PRESETS: Record<string, string[]> = {
  'friends-of-10': ['1+9', '2+8', '3+7', '4+6', '5+5'],
  'friends-of-5': ['1+4', '2+3', '3+2', '4+1'],
}
export const PRESET_OPTS = ['custom', ...Object.keys(TEXT_PRESETS)]

// common stick-on foot sizes; sizes above ~10 need a bigger border_w (the scad
// asserts). Pick 'custom' (or touch any knob) to free-edit.
export const FEET_PRESETS: Record<
  string,
  { feet_shape: string; feet_w: number; feet_depth: number }
> = {
  'circle 8': { feet_shape: 'circle', feet_w: 8, feet_depth: 1.2 },
  'circle 9': { feet_shape: 'circle', feet_w: 9, feet_depth: 1.5 },
  'circle 10': { feet_shape: 'circle', feet_w: 10, feet_depth: 1.5 },
  'square 8': { feet_shape: 'square', feet_w: 8, feet_depth: 1.2 },
}

// token → [string, fontIdx]; fontIdx 1 = Noto Emoji for emoji tokens (OpenSCAD
// has no per-glyph fallback, so mixed emoji+text inside ONE token will tofu).
export const tokenize = (s: string): [string, number][] =>
  s
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => [t, /\p{Extended_Pictographic}/u.test(t) ? 1 : 0])
export const slotTokens = (preset: string, custom: string): [string, number][] =>
  preset !== 'custom' && TEXT_PRESETS[preset]
    ? TEXT_PRESETS[preset].map((t) => [t, 0] as [string, number])
    : tokenize(custom)

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
  const sCp = sBd + 2 * cl + p.web * S
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
  'feet',
  'feet_shape',
  'feet_w',
  'feet_depth',
  'feet_fit',
  'feet_undercut',
  'feet_span',
  'show_frame',
  'show_beads',
  'show_markers',
]
export const definesFrom = (p: Params): string[] => [
  // JSON serialization doubles as OpenSCAD literal syntax for numbers, booleans,
  // quoted strings AND [string, fontIdx] token vectors.
  ...DEFINE_KEYS.map((k) => `-D${k}=${JSON.stringify(p[k])}`),
  `-Dtext_top=${JSON.stringify(slotTokens(p.top_preset, p.top_text))}`,
  `-Dtext_bottom=${JSON.stringify(slotTokens(p.bottom_preset, p.bottom_text))}`,
  `-Dtext_left=${JSON.stringify(slotTokens(p.left_preset, p.left_text))}`,
  `-Dtext_right=${JSON.stringify(slotTokens(p.right_preset, p.right_text))}`,
  `-Dedge_front=${JSON.stringify(tokenize(p.edge_front))}`,
  `-Dedge_back=${JSON.stringify(tokenize(p.edge_back))}`,
  `-Dedge_left=${JSON.stringify(tokenize(p.edge_left))}`,
  `-Dedge_right=${JSON.stringify(tokenize(p.edge_right))}`,
]

// ---- myabacus color model (mirror of abacus.scad bead_color / AbacusReact) ---
export const COLOR_PALETTES: Record<string, string[]> = {
  default: ['#2E86AB', '#A23B72', '#F18F01', '#6A994E', '#BC4B51'],
  colorblind: ['#0173B2', '#DE8F05', '#CC78BC', '#029E73', '#D55E00'],
  mnemonic: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
  grayscale: ['#000000', '#404040', '#808080', '#b0b0b0', '#d0d0d0'],
  nature: ['#4E79A7', '#F28E2C', '#E15759', '#76B7B2', '#59A14F'],
}
// A bead resolves role → intended hex → filament slot. Column i runs left→right;
// the rightmost column is the ones place (placeValue 0).
export const beadRoleIndex = (
  i: number,
  isHeaven: boolean,
  scheme: string,
  cols: number
): number => {
  const pv = cols - 1 - i
  if (scheme === 'monochrome') return 0
  if (scheme === 'heaven-earth') return isHeaven ? 0 : 1
  if (scheme === 'alternating') return pv % 2 === 0 ? 0 : 1
  return pv % 5
}
export const beadRoleColors = (scheme: string, palette: string): string[] =>
  scheme === 'monochrome'
    ? ['#000000']
    : scheme === 'heaven-earth'
      ? ['#F18F01', '#2E86AB']
      : scheme === 'alternating'
        ? ['#1E88E5', '#43A047']
        : (COLOR_PALETTES[palette] ?? COLOR_PALETTES.default)
export const beadRoleNames = (scheme: string): string[] =>
  scheme === 'monochrome'
    ? ['bead']
    : scheme === 'heaven-earth'
      ? ['heaven', 'earth']
      : scheme === 'alternating'
        ? ['even col', 'odd col']
        : ['1s', '10s', '100s', '1k', '10k']

// ---- filament mapping (screen colors → AMS slots) ---------------------------
// The printer has filament_count loaded spools; every printed color region must
// ride one of them. Mapping is role-aware: markers first (CV reads them — black
// gets the darkest-fit slot, white the lightest-fit DISTINCT slot), then frame =
// nearest, then bead roles pick nearest UNUSED-by-beads slots (distinct-first),
// reusing only once slots run out.
export const hexRGB = (h: string): [number, number, number] => {
  let s = h.replace('#', '')
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('')
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

export type FilamentMap = {
  slots: string[] // the loaded spools (filament_1..filament_count)
  frame: number // slot index per role ↓
  markerWhite: number
  markerBlack: number
  beadRoles: number[] // slot index per bead role (see beadRoleIndex)
  markerContrast: number // WCAG ratio of the mapped marker pair (CV wants ≥3)
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
export function computeFilamentMap(p: Params): FilamentMap {
  const slots: string[] = []
  for (let n = 1; n <= Math.max(1, Math.min(8, p.filament_count)); n++)
    slots.push(p[`filament_${n}` as 'filament_1'])
  const nearest = (target: string, exclude = -1): number => nearestSlot(slots, target, exclude)
  const markerBlack = nearest('#000000')
  const markerWhite = slots.length > 1 ? nearest('#ffffff', markerBlack) : markerBlack
  const frame = nearest(p.frame_color)
  const usedByBeads = new Set<number>()
  const beadRoles = beadRoleColors(p.color_scheme, p.color_palette).map((target) => {
    let best = -1
    let bd = Number.POSITIVE_INFINITY
    slots.forEach((s, idx) => {
      if (usedByBeads.has(idx)) return
      const d = colorDist(target, s)
      if (d < bd) {
        bd = d
        best = idx
      }
    })
    if (best < 0) best = nearest(target) // more roles than slots → reuse nearest
    usedByBeads.add(best)
    return best
  })
  return {
    slots,
    frame,
    markerWhite,
    markerBlack,
    beadRoles,
    markerContrast: contrastRatio(slots[markerWhite], slots[markerBlack]),
  }
}

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
  const s_em = p.border_w * p.scale_factor + d.sEm
  const s_cp = d.sCp
  const s_hy = p.border_w * p.scale_factor + d.sHy
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

// The intended hex for a shell under the current scheme/palette + filament map —
// the viewer converts this to a linear rgb triple via THREE.Color. Frame rides
// its frame slot; each bead rides its role slot.
export const shellHex = (info: ShellInfo, p: Params, fm: FilamentMap): string =>
  info.isFrame
    ? fm.slots[fm.frame]
    : fm.slots[fm.beadRoles[beadRoleIndex(info.i, info.isHeaven, p.color_scheme, p.cols)]]

// ---- inset text-plug layout (QA for inlay fill colors) ----------------------
// mirror of the scad rails()/walls() layout: token k of a slot sits at
// A + (B−A)·(k+0.5)/n, on the top face (z≈s_fh) or a wall (z=z_edge).
export type TokenCenter = { x: number; y: number; z: number; k: number }
export function tokenCenters(p: Params): TokenCenter[] {
  const S = p.scale_factor
  const d = derived(p)
  const W = d.frameW
  const D = d.outerD
  const r = p.corner_r * S
  const mkEnd = d.mkI + p.marker_mm + 2
  const stripX = p.border_w * S + d.sShelf
  const stripY = stripX
  const zTop = p.frame_h * S
  const zEdge = (p.frame_h * S) / 2
  const rails: [ReturnType<typeof slotTokens>, number, number, number, number, number][] = [
    [slotTokens(p.top_preset, p.top_text), mkEnd, D - stripY / 2, W - mkEnd, D - stripY / 2, zTop],
    [slotTokens(p.bottom_preset, p.bottom_text), mkEnd, stripY / 2, W - mkEnd, stripY / 2, zTop],
    [slotTokens(p.left_preset, p.left_text), stripX / 2, mkEnd, stripX / 2, D - mkEnd, zTop],
    [slotTokens(p.right_preset, p.right_text), W - stripX / 2, D - mkEnd, W - stripX / 2, mkEnd, zTop],
    [tokenize(p.edge_front), r + 2, 0, W - r - 2, 0, zEdge],
    [tokenize(p.edge_back), W - r - 2, D, r + 2, D, zEdge],
    [tokenize(p.edge_left), 0, D - r - 2, 0, r + 2, zEdge],
    [tokenize(p.edge_right), W, r + 2, W, D - r - 2, zEdge],
  ]
  const centers: TokenCenter[] = []
  for (const [toks, ax, ay, bx, by, z] of rails)
    toks.forEach((_, k) => {
      const f = (k + 0.5) / toks.length
      centers.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, z, k })
    })
  return centers
}
export const anyTokens = (p: Params): boolean =>
  [
    slotTokens(p.top_preset, p.top_text),
    slotTokens(p.bottom_preset, p.bottom_text),
    slotTokens(p.left_preset, p.left_text),
    slotTokens(p.right_preset, p.right_text),
    tokenize(p.edge_front),
    tokenize(p.edge_back),
    tokenize(p.edge_left),
    tokenize(p.edge_right),
  ].some((t) => t.length > 0)
