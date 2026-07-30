// abacus.scad — Abacus Studio parametric master (bench v1: CAPTIVE TRACK)
// ---------------------------------------------------------------------------
// Reverse-engineered from ~/projects/abacus/simplified.abacus.stl by
// connected-component bbox measurement + z-sweep cross-sections (see SPEC.md).
//
// CAPTURE MECHANISM (measured from the master frame's channel profile): each
// column is a Y-channel = the SPOOL bead + clearance, swept along Y. The spool
// has a wide foot (dia≈bead_dia), a narrow WAIST (dia≈bead_dia/2) at mid-height,
// and a wide belt above. The channel therefore pinches to the waist width at
// z≈3 and opens back out above/below it — so the bead's foot and belt physically
// cannot pass the waist gap: the bead is locked in Z and only slides in Y.
// Rodless, print-in-place. `clearance` is the LOCKED spine define — an ABSOLUTE
// gap held constant while proportional dims scale (never uniform scale()).
//
// PRINT-IN-PLACE: print FLAT on the bed as-is (frame bottom = z0). Beads are free
// shells (clearance gap ⇒ topologically separate) already trapped in their tracks
// — no assembly, no supports (the spool dome and channel walls stay under ~45°).
//
// MYABACUS STYLE CONFIG (abaci.one AbacusDisplayConfig / abacus_settings — see the
// `myabacus style` block below). Mapped to the print to the extent it doesn't foul
// the captive geometry:
//   physicalAbacusColumns -> cols        (functional: column count DRIVES width)
//   colorScheme           -> color_scheme  } per-bead color() — additive, no geom
//   colorPalette          -> color_palette }  change; feeds a future 3MF per-part
//   scaleFactor           -> scale_factor   (scales PROPORTIONAL dims; clearance held)
//   beadShape             -> bead_shape     (STUB: capture needs the spool → deferred)
// Intentionally NOT mapped (on-screen only / N/A to a physical abacus): hideInactive
// Beads, coloredNumerals/showNumbers, animated, interactive, gestures, sound*.
//
// Origin-clean at the OUTER rect: [0,frame_w] x [0,outer_d] x [0,frame_h], +z up.
// The bead field sits at (border_w, border_w) inside the flush border band.

/* ===== proportional dims (scale with the abacus) =====
   INTENT KNOBS ONLY. Every raw coordinate the old surface exposed (frame_d,
   col_pitch, end_margin, earth_pitch, earth_top_y, heaven_y, earth_lo/hi,
   heaven_lo) is now DERIVED below — the knobs say what the user MEANS (how
   many beads, how thick a wall, how far a bead throws) and the model composes
   itself coherently. An overlapping / incoherent layout is unrepresentable. */
frame_h     = 8;     // slab (was 6): stiffness ∝ t³ ⇒ 2.37×; beads stand bead_proud*S proud
border_w    = 5.25;  // slim flush band AROUND the field. The ArUco tiles + text rails
                     // live on band+shelf as ONE solid strip; the shelf auto-grows
                     // if band+shelf can't hold a corner tile (see s_shelf)
corner_r    = 4;     // outer vertical-corner rounding (kid-safety)
cols        = 13;    // column count — DRIVES the width (frame_w is derived)
earth       = 4;     // earth beads per column (soroban: 4)
web         = 2.5;   // solid wall between neighboring channels → col_pitch is
                     // bead + fit + web  (2.5 ⇒ pitch 13.0, the master's)
print_gap   = 2;     // printed air between stacked beads (ABSOLUTE — print
                     // physics, like clearance) → rest pitch = bead_len + this
throw       = 10;    // how far a bead group slides between set/unset (the feel;
                     // 10 ⇒ the master's earth channel exactly)
bar         = 7.5;   // reckoning-bar clear width: solid strip between the earth
                     // and heaven channel openings (master ~5.5; 7.5 keeps the
                     // classic 90mm field with throw 10)
shelf       = 7.75;  // solid margin INSIDE the field on all four sides (channel
                     // end → field edge): the tile/text/feet shelf. 7.75 ⇒
                     // strip 13.0 = contact-tight tiles at border_w 5.25
bead_dia    = 10;    // XZ belt diameter (measured x=z=10); scales the spool outline
bead_len    = 8;     // Y extent = slide axis (measured y=8)
bead_proud  = 4;     // dome tip above the top face (master hat: 10−6 frame = 4);
                     // the dome section stretches so a thicker slab can't swallow it

/* ===== locked dims (CONSTANT across sizes — the spine) ===== */
clearance   = 0.25;  // print gap on every captive face (was 0.35 — beads wobbled;
                     // floor ≈0.20 for a 0.4mm nozzle, below that beads fuse)
top_chamfer = 1;     // top rim edge-break (45°) — nozzle-scale, held absolute
marker_mm   = 12;    // ArUco tile edge (full 9-module tile) — CV-locked, absolute
marker_inset = 0;    // EXTRA tile inset floor (mk_i below derives the real one: the
                     // tile hugs the chamfer line and the corner arc trims its
                     // quiet-zone corner — set >0 only to push tiles further in)
inlay_d     = 0.6;   // color-inlay depth (markers, inset text) — matches the master

/* ===== feet (bottom face; ABSOLUTE — real feet don't scale) =====
   feet_mode picks the fabrication story:
   - "printed": in-place TPU feet. The foot solid (the only="feet" part pass)
     fills the pocket and stands proud below the bottom face (feet_proud);
     the whole print then stands on its feet while the frame's bottom face
     prints on supports + interface. The pocket welds to the foot (fit 0)
     and always keeps a dovetail flare; feet_retention="crossbar" further
     runs a frame bar THROUGH the foot at mid-depth so the foot is a closed
     loop around frame geometry — topologically captive, cannot fall out.
   - "adhesive": empty seat pockets for stick-on feet (the classic). The wall
     flares CONTINUOUSLY from the mouth (at the face) out to a wider seat
     floor — a dovetail, not a step — so with feet_undercut > 0 the rim
     overhangs the foot's base edge and mechanically grabs it (press the
     compliant foot in past the mouth).
   - "none": no pockets at all. */
feet_mode     = "printed"; // printed | adhesive | none
feet_shape    = "circle";  // circle | square (the foot's footprint)
feet_w        = 9;         // foot diameter / square side (the FOOT itself)
feet_depth    = 1.5;       // ADHESIVE pocket depth (printed crossbar derives its own)
feet_fit      = 0.15;      // adhesive per-side mouth clearance (printed welds: 0)
feet_undercut = 0;         // adhesive per-side dovetail flare (seat = mouth + 2·this);
                           // printed mode upgrades a left-alone 0 to 0.35/side
feet_span     = 110;       // max unsupported bottom run between feet, mm AT scale 1
                           // (derated by S^(4/3) — see the FEET_POS napkin below);
                           // lower it for soft filament / sparse infill
feet_proud    = 1.6;       // printed: stand-off below the bottom face (ABSOLUTE mm;
                           // ≈8 layers @0.2 = support base + interface + z gap)
feet_retention = "crossbar"; // printed: crossbar (linked loop) | dovetail (flare only)

/* ===== myabacus style (driven by abaci.one AbacusDisplayConfig) ===== */
color_scheme  = "place-value";  // monochrome | place-value | heaven-earth | alternating
color_palette = "default";      // default | colorblind | mnemonic | grayscale | nature
scale_factor  = 1.0;            // multiplies PROPORTIONAL dims; clearance stays absolute
bead_shape    = "spool";        // STUB — diamond|circle|square are display-only; the
                                // captive print needs the spool, so shape is deferred
frame_color   = "#c9a26e";      // one filament for the frame (not in AbacusDisplayConfig)

/* ===== perimeter text (Phase C) =====
   Eight slots — four TOP-FACE rails in the border band + four outer SIDE-WALL
   slots. Each slot is a vector of [string, fontIdx] tokens (fontIdx into FONTS;
   the bench picks 1 = Noto Emoji for emoji tokens). Tokens spread evenly along
   the rail; left rail reads bottom→top, right top→bottom. Empty = off. */
text_top    = [];   // top-face, far side (above heaven)
text_bottom = [];   // top-face, near side
text_left   = [];   // top-face, left rail (rotated 90°)
text_right  = [];   // top-face, right rail (rotated −90°)
edge_front  = [];   // outer wall, y=0
edge_back   = [];   // outer wall, y=outer_d
edge_left   = [];   // outer wall, x=0
edge_right  = [];   // outer wall, x=frame_w
text_mode   = "inset";    // emboss (raised, beveled, frame color) | inset (flush inlay)
text_fill   = "rainbow";  // inset plug coloring: single | rainbow (palette per token)
text_color  = "#f5f5f5";  // single-fill inlay color
text_size      = 6;  // top-face glyph size (mm; must fit strip_y — see rails)
edge_text_size = 5;  // side-wall glyph size (mm; ≤ frame_h − 2·chamfer flat band)
emboss_h    = 0.6;   // raised height (kept ≤0.6: wall glyphs are tiny cantilevers)
bevel       = 0.25;  // emboss edge-break (one offset step ≈ a print layer)
FONTS = ["DejaVu Sans:style=Bold", "Noto Emoji"];

/* ===== toggles / quality ===== */
show_frame   = true;
show_beads   = true;
show_markers = true;   // ArUco corner pockets in the border band
inlay_plugs  = false;  // true → also model the white/black inlay solids (3MF export
                       // path). false → pockets only: the bench STL shows markers as
                       // engravings (flush plugs would WELD into the frame shell and
                       // vanish — color() is inert on binstl; see SPEC).
only         = "";     // part passes: "" | "marker_black" | "marker_white" | "text_plugs" | "feet"
                       // "feet" renders the printed foot solids (pocket fill + stand-off,
                       // crossbar voided) — emitted UNCONDITIONALLY; the TS caller gates.
fn           = 40;   // worker passes -Dfn=...; wire it to $fn
$fn = fn;

/* ===== derived layout =====
   scale_factor multiplies every PROPORTIONAL dim (frame, pitches, bead, y-positions);
   `clearance` and `print_gap` are deliberately excluded so print gaps stay absolute
   as the abacus grows — the mixed-scaling spine. All downstream geometry uses the
   s_* working dims, every one of which now composes from the intent knobs. */
S      = scale_factor;
s_fh   = frame_h * S;
s_bd   = bead_dia * S;   s_bl  = bead_len * S;
s_bw   = border_w * S;   s_cr  = corner_r * S;
chamf  = min(top_chamfer, s_fh * 0.4);      // effective top-rim chamfer

/* effective tile inset: the tile hugs the top-face edge (inset = chamf) and the
   rounded-corner arc TRIMS its white quiet-zone corner — the tile 2D is clipped
   to the top-face outline, so the frame corner rounds right through the marker
   corner (the mockup look). Only the BLACK data ring must stay whole: its outer
   corner sits one module (marker_mm/9) inside the tile corner, and must stay
   inside the top-face arc of radius s_cr−chamf centered (s_cr, s_cr)
   ⇒ i + marker_mm/9 ≥ s_cr − (s_cr−chamf)/√2. The arc + chamfer grow with
   scale while the tile is locked, so the tile slides inward as needed
   (scale-up never refuses — it has more room). mk_i ≥ chamf also guarantees
   the corner-trim arc meets the tile edges tangentially or not at all. */
mk_i    = max(marker_inset, chamf,
              s_cr <= 0 ? 0 : s_cr - (s_cr - chamf) / sqrt(2) - marker_mm / 9);
mk_c    = mk_i + marker_mm / 2;             // marker center ← outer edges (7)
mk_end  = mk_i + marker_mm + 2;             // text rails start past the tiles (15)

/* the shelf AUTO-GROWS so band + shelf always holds a corner tile: what used to
   be a refusing assert is now a derivation — tiles fit by construction, and the
   tile edge lands exactly ON the channel wall when shelf is at the tile bound. */
s_shelf = max(shelf * S, mk_i + marker_mm - s_bw);
strip_x = s_bw + s_shelf;                   // solid strip, left/right  (13.0)
strip_y = s_bw + s_shelf;                   // solid strip, front/back  (13.0)
m_x     = s_shelf;                          // field-local margins == the shelf
m_y     = s_shelf;

/* the column: pitch, printed rest stack (all DOWN = reading 0), travel spans.
   Earth channel = rest stack + throw; then the bar; then the heaven channel =
   one bead + throw, resting UP (also 0). The field depth FALLS OUT of the
   stack — there is no way to position beads outside the frame or through the
   bar, because the frame is built around wherever the beads landed. */
s_cp   = s_bd + 2 * clearance + web * S;    // column pitch (13.0 at defaults)
s_em   = s_shelf + clearance + s_bd / 2;    // field edge → first column center
s_ep   = s_bl + print_gap;                  // printed inter-bead rest pitch (10)
s_elo  = s_shelf + clearance + s_bl / 2;    // bottom-most earth center   (12)
s_ety  = s_elo + s_ep * (earth - 1);        // top earth rest center      (42)
s_ehi  = s_ety + throw * S;                 // earth top-of-travel        (52)
s_hlo  = s_ehi + s_bl + 2 * clearance + bar * S;  // heaven bottom-of-travel (68)
s_hhi  = s_hlo + throw * S;                 // heaven top-of-travel       (78)
s_hy   = s_hhi;                             // heaven rest = fully up (reads 0)
s_fd   = s_hhi + s_bl / 2 + clearance + s_shelf;  // FIELD DEPTH — derived (90)
field_w   = 2 * s_em + (cols - 1) * s_cp;   // bead-field width follows column count
frame_w   = field_w + 2 * s_bw;             // OUTER width  (192.5 at defaults)
outer_d   = s_fd + 2 * s_bw;                // OUTER depth  (100.5 at defaults)

/* coherence floors — the few things intent knobs could still under-specify */
assert(web * S >= 1.2,  "web thinner than a printable wall — raise web");
assert(bar * S >= 2,    "reckoning bar too thin to survive — raise bar");
assert(throw * S >= 2,  "throw < 2mm: beads can't express set/unset — raise throw");
/* feet pockets: corner-tucked like the markers. feet_c (pocket center
   ← both outer edges) is derived so the SEAT — the widest section, at depth —
   clears the bottom-face outline (inset chamf, corner arc radius s_cr−chamf;
   the square shape additionally needs its corner point inside that arc), and
   the asserts keep a real wall to the bead channels, which open through the
   bottom face — a breakthrough would break capture, so feet get no
   contact allowance. */
feet         = feet_mode != "none";
feet_printed = feet_mode == "printed";
assert(feet_mode == "printed" || feet_mode == "adhesive" || feet_mode == "none",
       "feet_mode must be printed | adhesive | none");
assert(feet_retention == "crossbar" || feet_retention == "dovetail",
       "feet_retention must be crossbar | dovetail");
assert(!feet_printed || (feet_proud >= 0.4 && feet_proud <= 5),
       "feet_proud outside the printable band (0.4–5 mm)");
/* printed feet WELD to the pocket (no fit gap) and always keep a retention
   flare: a left-alone feet_undercut of 0 upgrades to 0.35/side, a deliberate
   non-zero knob wins. Adhesive mode uses the raw knobs — byte-identical to
   the pre-feet_mode geometry. */
feet_fit_eff      = feet_printed ? 0 : feet_fit;
feet_undercut_eff = feet_printed && feet_undercut == 0 ? 0.35 : feet_undercut;
feet_mouth = feet_w + 2 * feet_fit_eff;
feet_seat  = feet_mouth + 2 * feet_undercut_eff;
feet_half  = feet_seat / 2;
feet_c     = feet_shape == "square"
  ? max(chamf + 0.5 + feet_half,
        s_cr <= 0 ? 0 : feet_half + s_cr - (s_cr - chamf) / sqrt(2))
  : max(chamf + 0.5 + feet_half,
        s_cr <= 0 ? 0 : s_cr - (s_cr - chamf - feet_half) / sqrt(2));
/* crossbar retention (printed): a small frame bar spans the pocket at
   mid-depth, ends merged into the surrounding wall; the TPU foot prints
   under, around, and over it — a chain link. In-place co-printing makes the
   topology free (each layer, PLA and TPU mutually support the next), so the
   enclosed bar needs no supports. Fuse math (design review, Gitea #23): the
   2×1.6 PLA bar snaps at ~40–60 N per foot — ≥4× over real abuse — and a
   snapped bar degrades to dovetail+weld, never to loose. */
xbar_w     = 2;    // bar width across the pocket (lobes = (feet_mouth − xbar_w)/2)
xbar_h     = 1.6;  // bar height
xbar_under = 1;    // TPU below the bar (the bar's print bed)
xbar_over  = 1.2;  // TPU above the bar (the shear strap that closes the loop)
xbar_embed = 2;    // bar end reach past the seat, rooting into the frame
xbar_stack = xbar_under + xbar_h + xbar_over;  // pocket depth the bar needs
/* The bar stack is ABSOLUTE (feet are real-world hardware, never scaled by S)
   but the frame it hides in is not: s_fh = frame_h·S. Below S ≈ 0.725 the stack
   plus the ≥2 mm web is taller than the whole frame, so the crossbar simply has
   nowhere to live and retention falls back to the dovetail flare — which fits
   the entire size range. Degrading here rather than asserting keeps the bottom
   third of the size slider renderable; feetEffective() mirrors this exactly so
   the studio can say so in the inspector. */
feet_crossbar  = feet_printed && feet_retention == "crossbar" && xbar_stack + 2 <= s_fh;
feet_depth_eff = feet_crossbar ? xbar_stack : feet_depth;
assert(!feet_crossbar || feet_mouth - xbar_w >= 2,
       "crossbar leaves the TPU lobes too thin — grow feet_w or shrink xbar_w");
assert(!feet || feet_c + feet_half + 0.8 <= strip_x,
       "feet pockets would cut the end channels — smaller feet_w or bigger border_w");
assert(!feet || feet_c + feet_half + 0.8 <= strip_y,
       "feet pockets would cut the bead channels — smaller feet_w or bigger border_w");
assert(!feet || feet_depth_eff + 2 <= s_fh,
       "feet pocket leaves too thin a web above — shrink feet_depth, grow frame_h/size, or feet_retention=dovetail");
/* anti-bend intermediate feet (napkin): at any column the channels open through
   BOTH faces, so only the two solid border strips carry long-axis bending —
   I ≈ 2·strip_y·s_fh³/12 ≈ 1.1e3 mm⁴ at defaults. A mid-span hand press
   F ≈ 25 N on PLA printed 3–4 walls + ~40% infill (E_eff ≈ 2 GPa) sags
   δ = F·L³/(48·E·I) ≈ 1.3 mm over the corner-only 180 mm span — visible bend.
   Capping δ at 0.3 mm ⇒ L ≤ (48·E·I·δ/F)^(1/3) ≈ 110 mm = feet_span. Both
   strip width and s_fh grow ∝ S, so I ∝ S⁴ and the cap derates ∝ S^(4/3).
   Corners are mandatory; PAIRS of intermediate feet split any run that exceeds
   the cap (both long edges, and the short edges on a deep enough frame). They
   sit on the same solid strips as the corners, so the channel-margin asserts
   above cover every pocket. */
feet_span_eff = feet_span * pow(S, 4 / 3);
feet_runx = frame_w - 2 * feet_c;
feet_runy = outer_d - 2 * feet_c;
feet_nx   = max(0, ceil(feet_runx / feet_span_eff) - 1);
feet_ny   = max(0, ceil(feet_runy / feet_span_eff) - 1);
FEET_POS = concat(
  [[feet_c, feet_c], [frame_w - feet_c, feet_c],
   [frame_w - feet_c, outer_d - feet_c], [feet_c, outer_d - feet_c]],
  [for (m = [1 : 1 : feet_nx], e = [0, 1])
     [feet_c + feet_runx * m / (feet_nx + 1), e == 0 ? feet_c : outer_d - feet_c]],
  [for (m = [1 : 1 : feet_ny], e = [0, 1])
     [e == 0 ? feet_c : frame_w - feet_c, feet_c + feet_runy * m / (feet_ny + 1)]]);

/* colx/earthy stay FIELD-LOCAL; the field is placed at (s_bw, s_bw) inside the
   outer rect — channels + beads ride a single translate([s_bw, s_bw, 0]). */
function colx(i)   = s_em + i * s_cp;
function earthy(j) = s_ety - j * s_ep;

/* ===== per-bead color (abaci.one AbacusReact getBeadColor — the persisted palettes).
   Physical beads are all present ⇒ no inactive-gray / highlight-gold branches. Column i
   runs left→right; the rightmost column is the ones place (placeValue 0). */
function place_value(i) = (cols - 1) - i;
function _palette(name) =
    name == "colorblind" ? ["#0173B2","#DE8F05","#CC78BC","#029E73","#D55E00"] :
    name == "mnemonic"   ? ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd"] :
    name == "grayscale"  ? ["#000000","#404040","#808080","#b0b0b0","#d0d0d0"] :
    name == "nature"     ? ["#4E79A7","#F28E2C","#E15759","#76B7B2","#59A14F"] :
                           ["#2E86AB","#A23B72","#F18F01","#6A994E","#BC4B51"];  // default
function bead_color(i, is_heaven) =
    color_scheme == "monochrome"   ? "#000000" :
    color_scheme == "heaven-earth" ? (is_heaven ? "#F18F01" : "#2E86AB") :
    color_scheme == "alternating"  ? (place_value(i) % 2 == 0 ? "#1E88E5" : "#43A047") :
    /* place-value */                _palette(color_palette)[place_value(i) % 5];

/* ===== master-matched "spool" bead =====
   Measured from the STL (headless z-sweep of the isolated bead shell): the bead is
   NOT a bicone. Its X-Z silhouette is a dumbbell — dia-10 foot, a dia-5 WAIST at
   z3, a dia-10 belt at z5.5..7, domed to the top — while its Y extent is a flat 8
   (independent of X: at the waist it is 5 wide in X but still 8 in Y). So it is the
   intersection of an X-Z outline prism and a Y-Z outline prism, NOT a revolve/squash.
   BASE_* are the measured half+mirror outlines for dia=10, z=10, len=8; they scale
   with bead_dia (x,z) and bead_len (y). `grow` offsets both outlines by an absolute
   amount → the clearance-grown cavity (clearance stays constant regardless of size). */
BASE_XZ = [[0,0],[5,0],[5,0.5],[2.5,3],[5,5.5],[5,7],[2.5,9.5],[1.4,9.9],[0,10],
           [-1.4,9.9],[-2.5,9.5],[-5,7],[-5,5.5],[-2.5,3],[-5,0.5],[-5,0]];
BASE_YZ = [[0,0],[4,0],[4,7],[3.84,7.5],[3.68,8],[3.44,8.5],[3.06,9],[2.4,9.5],[1.3,9.9],[0,10],
           [-1.3,9.9],[-2.4,9.5],[-3.06,9],[-3.44,8.5],[-3.68,8],[-3.84,7.5],[-4,7],[-4,0]];
sx = s_bd / 10;   // scales the X-Z outline (x and z) — includes scale_factor
sy = s_bl / 8;    // scales the Y-Z outline (y); its z still scales with sx
/* dome stretch: the profile's dome section (base z 7..10, above the belt) remaps
   so the tip clears the top face by bead_proud·scale — the master's 4mm hat
   regardless of frame_h. Foot/waist/belt (z ≤ 7) are capture-critical and never
   move; a taller dome is STEEPER (less overhang) so it prints at least as well,
   and the channel sweep reuses the same profile so the roof follows. */
bead_ztop = (s_fh + bead_proud * scale_factor) / sx;   // in base-profile units
assert(bead_ztop > 8, "bead dome would collapse below the belt — raise bead_proud or lower frame_h");
function bz(z) = z <= 7 ? z : 7 + (z - 7) * (bead_ztop - 7) / 3;
module prism_xz(pts, grow, thick)             // cross-section in X-Z, extruded along Y
  rotate([90, 0, 0]) linear_extrude(height = thick, center = true) offset(r = grow) polygon(pts);
module prism_yz(pts, grow, thick)             // cross-section in Y-Z, extruded along X
  rotate([90, 0, 90]) linear_extrude(height = thick, center = true) offset(r = grow) polygon(pts);
module bead_solid(grow = 0)
  intersection() {
    prism_xz([for (p = BASE_XZ) [p[0] * sx, bz(p[1]) * sx]], grow, s_bd * 4);
    prism_yz([for (p = BASE_YZ) [p[0] * sy, bz(p[1]) * sx]], grow, s_bd * 4);
  }
module bead(cx, cy) translate([cx, cy, 0]) bead_solid(0);

/* channel cavity for one column: the bead grown by clearance, SWEPT along y0..y1
   as a STEPPED UNION of cavity copies (step <= 2mm, so copies overlap). Each copy
   independently guarantees the full cavity cross-section locally ⇒ robust clearance
   the whole travel. (A single hull() of the two ends pinches the mid cross-section
   to ~0 margin and fuses columns — don't.) grow=clearance offsets both outlines, so
   the cavity is the bead ⊕ clearance on every face, centered on the bead. */
module channel(cx, y0, y1) {
  n = max(1, ceil((y1 - y0) / 2));
  for (k = [0 : n])
    translate([cx, y0 + (y1 - y0) * k / n, 0]) bead_solid(clearance);
  /* vertical-walled chimney ABOVE the belt (base z 7 = belt top). With frame_h
     above the belt, the swept dome alone would neck the opening inward toward
     the rim (~0.6 mm/side at defaults) — a funnel the MASTER never had (its
     6 mm face tops out below the belt), and the visible tan gap between the
     ArUco tiles and the cuts. The chimney keeps the opening at full belt width
     all the way to the rim, so the surface edge of the cut lands exactly ON
     strip_x / strip_y — the tile contact line is real AT THE SURFACE. Capture
     is untouched: bead lift was never limited by that roof but by the foot
     rising into the waist slope (~0.25 mm), same as the master. The belt band
     is already vertical at ±5·sx, so the wall is one flat plane from
     z = 5.5·sx up through the rim. */
  translate([cx, (y0 + y1) / 2, 7 * sx - 0.01])
    linear_extrude(s_fh)
      offset(r = clearance)
        square([10 * sx, y1 - y0 + 8 * sy], center = true);
}

/* ===== ArUco corner markers (js-aruco2 'ARUCO' dict — abaci.one CV) =====
   Tile = 9×9 modules: 1-module white quiet ring + 1-module black border ring +
   5×5 data. Bit code[y*5+x]=='1' → WHITE cell ('0' → black), row-major, data
   origin top-left. Corner→ID: TL=0 TR=1 BR=2 BL=3 (arucoDetection.ts:109).
   Bit strings below are AR.Dictionary('ARUCO').codeList[0..3] verbatim.
   Tiles are TUCKED into the corners (mk_i from both outer edges = the chamfer
   line at defaults), overlapping band + field margin — NOT centered on the
   band, so the band can be slim. The frame's rounded corner TRIMS each tile's
   white quiet-zone corner (2D clip to top_face_2d); mk_i guarantees the black
   data ring survives the trim whole. The CV homography uses the four tile
   CENTERS: a (frame_w − 2·mk_c) × (outer_d − 2·mk_c) rectangle (180×88 at
   defaults); abaci.one's ColumnMargins absorbs the offsets. Inlay is FLAT
   (flush at z=s_fh, depth inlay_d) — coplanar with the bead plane ⇒ no CV
   parallax; mk_i + the asserts above keep the tile clear of the channels. */
MARKER_BITS = [
  "1000010000100001000010000",   // id 0 → TL
  "1000010000100001000010111",   // id 1 → TR
  "1000010000100001000001001",   // id 2 → BR
  "1000010000100001000001110"    // id 3 → BL
];
MARKER_POS = [
  [mk_c,           outer_d - mk_c],   // TL
  [frame_w - mk_c, outer_d - mk_c],   // TR
  [frame_w - mk_c, mk_c],             // BR
  [mk_c,           mk_c]              // BL
];

module marker_black_2d(id) {           // border ring + '0' data cells (row y=0 = top)
  m = marker_mm / 9;
  difference() { square(7 * m, center = true); square(5 * m, center = true); }
  for (y = [0 : 4], x = [0 : 4])
    if (MARKER_BITS[id][y * 5 + x] == "0")
      translate([(x - 2) * m, (2 - y) * m]) square(m + 0.02, center = true);
}
module marker_white_2d(id)             // quiet ring + '1' data cells = tile − black
  difference() { square(9 * marker_mm / 9, center = true); marker_black_2d(id); }

module top_face_2d()                   // the flat top face: rounded rect − chamfer
  offset(delta = -chamf) rounded_rect(frame_w, outer_d, s_cr);

/* pocket + plugs are clipped IN 2D to the top-face outline: the rounded corner
   trims the quiet-zone corner, and neither pocket nor plug ever cuts into the
   chamfer bevel (the top outline is the narrowest z-slice the inlay spans). */
module marker_pocket(k)                // carve for the whole tile, up through the rim
  translate([0, 0, s_fh - inlay_d])
    linear_extrude(s_fh) intersection() {
      translate([MARKER_POS[k][0], MARKER_POS[k][1]])
        square(marker_mm, center = true);
      top_face_2d();
    }
module marker_plug(k, black)
  translate([0, 0, s_fh - inlay_d])
    linear_extrude(inlay_d) intersection() {
      translate([MARKER_POS[k][0], MARKER_POS[k][1]])
        if (black) marker_black_2d(k); else marker_white_2d(k);
      top_face_2d();
    }

/* ===== perimeter text geometry =====
   RAILS: top-face slots as [tokens, ax, ay, bx, by, rot] — token k sits at
   A+(B−A)·(k+.5)/n, glyph rotated `rot`. Rails run BETWEEN the corner markers.
   WALLS: side-wall slots as [tokens, rz, ax, ay, bx, by] — the glyph plane is
   rotate([90,0,rz]) at the wall, local +z = outward normal, laid out so text
   reads left→right for a viewer facing that wall.
   Emboss = raised emboss_h with a one-step bevel (welds into the frame shell,
   frame color). Inset = inlay_d pocket + flush plug (single color or rainbow
   per token) — plugs only modeled when inlay_plugs (they'd weld in the STL). */
function rails() = [   // centered on the full solid strip (band + field margin)
  [text_top,    mk_end, outer_d - strip_y/2,  frame_w - mk_end, outer_d - strip_y/2,   0],
  [text_bottom, mk_end, strip_y/2,            frame_w - mk_end, strip_y/2,             0],
  [text_left,   strip_x/2, mk_end,            strip_x/2, outer_d - mk_end,            90],
  [text_right,  frame_w - strip_x/2, outer_d - mk_end,  frame_w - strip_x/2, mk_end, -90]
];
wall_pad = 2;
function walls() = [
  [edge_front,    0,  s_cr + wall_pad, 0,          frame_w - s_cr - wall_pad, 0],
  [edge_back,   180,  frame_w - s_cr - wall_pad, outer_d,  s_cr + wall_pad, outer_d],
  [edge_left,   -90,  0, outer_d - s_cr - wall_pad,  0, s_cr + wall_pad],
  [edge_right,   90,  frame_w, s_cr + wall_pad,  frame_w, outer_d - s_cr - wall_pad]
];
z_edge = s_fh / 2;  // wall glyph centerline — flat wall band is [chamf, s_fh−chamf]

/* ===== overflow-proof auto-fit glyph sizing =====
   text_size / edge_text_size are MAXIMA, not absolutes. Each slot's effective
   size shrinks (never grows) so that (a) every token's ink stays inside the
   slot's cross-band — wall glyphs inside [chamf, s_fh−chamf], rail glyphs
   inside the solid strip minus the rim chamfer — and (b) neighbors can never
   collide: each token's ink width ≤ 92% of the per-token pitch. Uses REAL
   glyph metrics (textmetrics — worker passes --enable=textmetrics); metrics
   scale linearly with size, so one probe at the requested size yields the
   exact shrink factor. Ink half-extents are measured from the anchor on BOTH
   sides (halign/valign "center" centers the layout box, not the ink), so
   asymmetric ascender/descender strings still fit. Falls back to a
   conservative per-char estimate if the builtin is unavailable. */
tm_probe = textmetrics(text = "0", size = 10, font = FONTS[0]);
tm_ok    = !is_undef(tm_probe) && is_num(tm_probe.advance[0]);
function ink(t, f, sz) =            // [x half-extent, y half-extent] of the ink
  tm_ok ? let (m = textmetrics(text = t, size = sz, font = f,
                               halign = "center", valign = "center"))
            [max(abs(m.position[0]), abs(m.position[0] + m.size[0])),
             max(abs(m.position[1]), abs(m.position[1] + m.size[1]))]
        : [0.55 * sz * len(t), 0.85 * sz];
function fit_sz(toks, req, pitch, band) =
  len(toks) == 0 ? req :
  req * min(1, min(concat(
    [for (t = toks) 0.46 * pitch     / max(0.001, ink(t[0], FONTS[t[1]], req)[0])],
    [for (t = toks) (band / 2 - 0.3) / max(0.001, ink(t[0], FONTS[t[1]], req)[1])])));
function rail_sz(r) = fit_sz(r[0], text_size,
  norm([r[3] - r[1], r[4] - r[2]]) / max(1, len(r[0])),
  (r[5] == 0 ? strip_y : strip_x) - 2 * chamf);
function wall_sz(r) = fit_sz(r[0], edge_text_size,
  norm([r[4] - r[2], r[5] - r[3]]) / max(1, len(r[0])),
  s_fh - 2 * chamf);

module tok2d(tokens, k, sz)
  text(tokens[k][0], size = sz, font = FONTS[tokens[k][1]],
       halign = "center", valign = "center");
function tok_color(k) =
  text_fill == "rainbow" ? _palette(color_palette)[k % 5] : text_color;

module rail_tok_2d(r, k) {   // one top-face token, positioned in the XY plane
  f = (k + 0.5) / len(r[0]);
  translate([r[1] + (r[3] - r[1]) * f, r[2] + (r[4] - r[2]) * f])
    rotate(r[5]) tok2d(r[0], k, rail_sz(r));
}
module wall_tok_at(r, k) {   // wall transform for token k; children in local frame
  f = (k + 0.5) / len(r[0]);
  translate([r[2] + (r[4] - r[2]) * f, r[3] + (r[5] - r[3]) * f, z_edge])
    rotate([90, 0, r[1]]) children();
}

module text_pockets() {      // inset mode: carved from the frame
  for (r = rails()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    translate([0, 0, s_fh - inlay_d]) linear_extrude(inlay_d + s_fh) rail_tok_2d(r, k);
  for (r = walls()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    wall_tok_at(r, k) translate([0, 0, -inlay_d])
      linear_extrude(inlay_d + 1) tok2d(r[0], k, wall_sz(r));
}
module text_plugs() {        // inset mode: flush colored inlays (3MF path)
  for (r = rails()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    color(tok_color(k)) translate([0, 0, s_fh - inlay_d])
      linear_extrude(inlay_d) rail_tok_2d(r, k);
  for (r = walls()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    color(tok_color(k)) wall_tok_at(r, k) translate([0, 0, -inlay_d])
      linear_extrude(inlay_d) tok2d(r[0], k, wall_sz(r));
}
module text_emboss() {       // emboss mode: raised + beveled, welds to the frame
  for (r = rails()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    translate([0, 0, s_fh - 0.1]) {
      linear_extrude(0.1 + emboss_h - bevel) rail_tok_2d(r, k);
      translate([0, 0, 0.1 + emboss_h - bevel]) linear_extrude(bevel)
        offset(delta = -bevel) rail_tok_2d(r, k);
    }
  for (r = walls()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    wall_tok_at(r, k) translate([0, 0, -0.1]) {
      linear_extrude(0.1 + emboss_h - bevel) tok2d(r[0], k, wall_sz(r));
      translate([0, 0, 0.1 + emboss_h - bevel]) linear_extrude(bevel)
        offset(delta = -bevel) tok2d(r[0], k, wall_sz(r));
    }
}

/* ===== frame v3 =====
   Flush border band (s_bw) around the bead field; one continuous flat top face
   at z=s_fh. Outer vertical corners rounded (corner_r); BOTH rims edge-broken
   by 45° chamfers (top_chamfer, absolute) — top for kid-safety, bottom so the
   underside edge matches (user call; costs a 1mm bed-contact inset, fine).
   No raised features anywhere — beads stay maximally accessible. */
module rounded_rect(w, d, r) {
  if (r > 0) offset(r = r) offset(delta = -r) square([w, d]);
  else square([w, d]);
}
module outer_solid() {
  if (chamf > 0.01)
    hull() {
      translate([0, 0, chamf]) linear_extrude(s_fh - 2 * chamf)
        rounded_rect(frame_w, outer_d, s_cr);
      linear_extrude(0.01)
        offset(delta = -chamf) rounded_rect(frame_w, outer_d, s_cr);
      translate([0, 0, s_fh - 0.01]) linear_extrude(0.01)
        offset(delta = -chamf) rounded_rect(frame_w, outer_d, s_cr);
    }
  else
    linear_extrude(s_fh) rounded_rect(frame_w, outer_d, s_cr);
}
module feet_pocket_at(k) {   // mouth at z=0, seat floor at z=feet_depth_eff (dovetail)
  translate([FEET_POS[k][0], FEET_POS[k][1], -0.01]) {
    if (feet_shape == "circle")
      cylinder(h = feet_depth_eff + 0.01, d1 = feet_mouth, d2 = feet_seat);
    else
      linear_extrude(feet_depth_eff + 0.01, scale = feet_seat / feet_mouth)
        square(feet_mouth, center = true);
  }
}
/* The retention bar runs ALONG the border strip its foot sits on (FEET_POS
   order: 4 corners, then bottom/top-strip pairs, then left/right-strip pairs)
   so both rooted ends stay in solid strip material — never hanging into a
   bead channel. Corner bars can poke past the outer wall; frame() clips them
   flush against outer_solid(). Same solid is SUBTRACTED from the foot with
   zero shrink (marker-plug precedent): coincident PLA/TPU faces, no gap. */
function xbar_along_x(k) = k < 4 + 2 * feet_nx;
module xbar_at(k) {
  xlen = feet_seat + 2 * xbar_embed;
  translate([FEET_POS[k][0], FEET_POS[k][1], xbar_under]) {
    if (xbar_along_x(k))
      translate([-xlen / 2, -xbar_w / 2, 0]) cube([xlen, xbar_w, xbar_h]);
    else
      translate([-xbar_w / 2, -xlen / 2, 0]) cube([xbar_w, xlen, xbar_h]);
  }
}
/* The printed foot (only="feet" part pass): the pocket-filling frustum —
   coincident with feet_pocket_at, zero shrink — plus a straight stand-off of
   the MOUTH cross-section below the face (two stacked primitives on purpose:
   one continuous taper from −feet_proud would change the mouth diameter at
   z=0), minus the crossbar the frame threads through it. */
module foot_at(k) {
  difference() {
    translate([FEET_POS[k][0], FEET_POS[k][1], 0]) union() {
      translate([0, 0, -feet_proud]) {
        if (feet_shape == "circle") cylinder(h = feet_proud + 0.01, d = feet_mouth);
        else linear_extrude(feet_proud + 0.01) square(feet_mouth, center = true);
      }
      if (feet_shape == "circle")
        cylinder(h = feet_depth_eff, d1 = feet_mouth, d2 = feet_seat);
      else
        linear_extrude(feet_depth_eff, scale = feet_seat / feet_mouth)
          square(feet_mouth, center = true);
    }
    if (feet_crossbar) xbar_at(k);
  }
}
module frame() {   // two children = implicit union (keeps the no-bar CSG tree
                   // EXACTLY the pre-#23 one — adhesive mode stays byte-stable)
  difference() {
    outer_solid();
    translate([s_bw, s_bw, 0])            // bead field lives at (s_bw, s_bw)
      for (i = [0 : cols - 1]) {
        channel(colx(i), s_elo, s_ehi);
        channel(colx(i), s_hlo, s_hhi);
      }
    if (show_markers) for (k = [0 : 3]) marker_pocket(k);
    if (text_mode == "inset") text_pockets();
    if (feet) for (k = [0 : len(FEET_POS) - 1]) feet_pocket_at(k);
  }
  // the crossbars are FRAME geometry threading the foot pockets; added back
  // after the carve, clipped so corner bars end flush at the outer wall.
  if (feet_crossbar)
    intersection() {
      outer_solid();
      for (k = [0 : len(FEET_POS) - 1]) xbar_at(k);
    }
}

/* ===== assemble ===== (color() is preview/3MF only — ignored by binstl, no geom change) */
if (only == "marker_black")      for (k = [0 : 3]) color("black") marker_plug(k, true);
else if (only == "marker_white") for (k = [0 : 3]) color("white") marker_plug(k, false);
else if (only == "text_plugs")   text_plugs();
else if (only == "feet")         for (k = [0 : len(FEET_POS) - 1]) color("#1f2937") foot_at(k);
else {
  if (show_frame) {
    color(frame_color) {
      frame();
      if (text_mode == "emboss") text_emboss();
    }
    if (show_markers && inlay_plugs)
      for (k = [0 : 3]) {
        color("white") marker_plug(k, false);
        color("black") marker_plug(k, true);
      }
    if (text_mode == "inset" && inlay_plugs) text_plugs();
  }
  if (show_beads) translate([s_bw, s_bw, 0])
    for (i = [0 : cols - 1]) {
      for (j = [0 : earth - 1]) color(bead_color(i, false)) bead(colx(i), earthy(j));
      color(bead_color(i, true)) bead(colx(i), s_hy);
    }
}
