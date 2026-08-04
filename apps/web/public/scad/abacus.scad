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

/* ===== modular columns — the AbacusLink prototype (see
   docs/abacus-studio/modular-columns-spec.md) =====
   "mono" is the shipped one-piece abacus and is BYTE-STABLE: every derivation
   below reduces to its pre-modular form when link_mode == "mono".

   "modular" does exactly ONE thing in this revision — it raises two dimension
   floors so the design on screen is the one the joint coupon is cut from. The
   assembled abacus is still rendered as a single solid; only the `only=`
   part passes (link_coupon, link_column) emit modular geometry. That is
   deliberate: analyzeShells() identifies the frame as "the one shell wider than
   a column pitch", which every column module fails, so making the assembly N
   solids breaks the viewer's whole recolor pass. That comes after the coupon
   proves the latch.

   Why the two floors: the seam splits the web between channels down its middle,
   so each module keeps only half of it, and half of 2.5 is thinner than a
   printable wall. And the front/back strips have to hold a latch tongue AND a
   foot pocket, which do not fit in the mono border's 13.0 mm strip. */
link_mode   = "mono";   // mono | modular
link_web    = 4.5;      // modular floor on `web` — 2.25 mm of wall per module
link_border = 7.0;      // modular floor on `border_w` — a 14.75 mm strip
link_ramp   = 8;        // cam ramp, degrees off the tongue's travel. SELF-LOCKING
                        // REQUIRES < ~16.7 (atan of PLA-on-PLA friction).
link_fit    = 0.10;     // per-face chevron groove clearance
link_relief = 0.25;     // flat-face standoff — the chevron flanks are the ONLY
                        // contact, so nothing else may hold them off their seat
link_bump   = 1.1;      // barb height = cam travel = the spread the joint can
                        // swallow (take-up = link_bump · tan(link_ramp))
link_slot_w = 1.4;      // spring room on the tongue's far side. MUST exceed
                        // link_bump or the barb can't deflect past the throat.
link_foot_w = 6.35;     // 1/4" stick-on bumper — the largest that clears the slot
link_foot_d = 1.2;
assert(link_mode == "mono" || link_mode == "modular",
       "link_mode must be mono | modular");

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
                       // Plus the AbacusLink prototype slices — "link_coupon" |
                       // "link_column" — which are inspection parts too, but
                       // print-ready ones: each emits TWO pieces in print pose so
                       // the seam between them is what you test.
                       // "feet" renders the printed foot solids (pocket fill + stand-off,
                       // crossbar voided) — emitted UNCONDITIONALLY; the TS caller gates.
                       // Plus the INSPECTION slices — "bead" | "bead_capture" | "bead_cap"
                       // | "bead_exposed" | "channel" | "frame" — which are not filament
                       // bodies, just one piece rendered alone for the Storybook bench.
                       // Both sets are dispatched at the bottom of this file; the full
                       // vocabulary is pinned against the TS side by export-defines.test.ts.
plug_group   = -1;     // "text_plugs" pass filter: −1 = every token (one soup, what the
                       // on-screen preview wants); 0..4 = only the tokens whose tok_group
                       // matches, so the 3MF export can put each ink color on its own
                       // extruder. A pocket needs a plug of ITS color to print filled.
fn           = 40;   // worker passes -Dfn=...; wire it to $fn
$fn = fn;

/* ===== derived layout =====
   scale_factor multiplies every PROPORTIONAL dim (frame, pitches, bead, y-positions);
   `clearance` and `print_gap` are deliberately excluded so print gaps stay absolute
   as the abacus grows — the mixed-scaling spine. All downstream geometry uses the
   s_* working dims, every one of which now composes from the intent knobs. */
/* The modular floors. Derived HERE, not up with the knobs, because they read
   `only`: a link part pass IS modular geometry — asking for the coupon while
   link_mode still says "mono" would otherwise hand you a coupon cut to a pitch
   no modular abacus will ever have, which is the sort of fixture that passes its
   test and teaches you nothing.
   max() rather than assignment, so a design that already asked for a fatter web
   or a wider brim keeps it — the floor raises, never lowers. */
// Written as a predicate over its argument rather than testing `only` inline,
// because export-defines.test.ts pins the part vocabulary by scanning this file
// for comparisons against `only`, and requires exactly ONE dispatch branch per
// name. A second comparison here would read as a duplicate branch — so the
// chain at the bottom of the file stays the single mention of each.
function is_link_part(o) = o == "link_coupon" || o == "link_column";
link_part    = is_link_part(only);
modular      = link_mode == "modular" || link_part;
web_eff      = modular ? max(web, link_web) : web;
border_w_eff = modular ? max(border_w, link_border) : border_w;

S      = scale_factor;
s_fh   = frame_h * S;
s_bd   = bead_dia * S;   s_bl  = bead_len * S;
s_bw   = border_w_eff * S;   s_cr  = corner_r * S;
chamf  = min(top_chamfer, s_fh * 0.4);      // effective top-rim chamfer

/* The modular-column joint. A LIBRARY — it emits nothing and only defines
   modules/functions, so including it costs a mono render exactly nothing. */
include <abacus-link.scad>

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
s_cp   = s_bd + 2 * clearance + web_eff * S;  // column pitch (13.0 mono, 15.0 modular)
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
/* In modular mode the seam halves the web, so the wall that has to survive is
   half of it — which is what gives modular mode a size floor the monolith
   does not have. Same shape as the feet_crossbar degrade: the joint is the
   thing with an absolute minimum, inside a frame that scales. */
assert(web_eff * S / (modular ? 2 : 1) >= 1.2,
       modular
         ? "modular half-web thinner than a printable wall — raise size or link_web"
         : "web thinner than a printable wall — raise web");
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
   BASE_* are the measured half+mirror outlines for dia=10, len=8; they scale
   with bead_dia (x,z) and bead_len (y). `grow` offsets both outlines by an absolute
   amount → the clearance-grown cavity (clearance stays constant regardless of size).

   The bead is TWO pieces that meet at the belt top (base z 7 = BEAD_CAPTURE_Z):

     z ≤ 7   CAPTURE — foot, waist, belt: the part that rides in the channel.
             The prism intersection below, with the measured outline verbatim.
             This is what holds the bead on the rod and what `channel()` carves
             the cavity from, it is printed and known good, and NOTHING here
             moves. The cross-section stays a rectangle because that is what the
             validated fit was measured against.

     z > 7   EXPOSED — the hat. Lofted with a SUPERELLIPTICAL section instead of
             the intersection's rectangle, and carrying the master's own 3 mm
             dome. See "exposed cap" below. */
BEAD_CAPTURE_Z = 7;                            // belt top: the capture/exposed line
BASE_XZ = [[0,0],[5,0],[5,0.5],[2.5,3],[5,5.5],[5,BEAD_CAPTURE_Z],
           [-5,BEAD_CAPTURE_Z],[-5,5.5],[-2.5,3],[-5,0.5],[-5,0]];
BASE_YZ = [[0,0],[4,0],[4,BEAD_CAPTURE_Z],[-4,BEAD_CAPTURE_Z],[-4,0]];
sx = s_bd / 10;   // scales the X-Z outline (x and z) — includes scale_factor
sy = s_bl / 8;    // scales the Y-Z outline (y); its z still scales with sx
module prism_xz(pts, grow, thick)             // cross-section in X-Z, extruded along Y
  rotate([90, 0, 0]) linear_extrude(height = thick, center = true) offset(r = grow) polygon(pts);
module prism_yz(pts, grow, thick)             // cross-section in Y-Z, extruded along X
  rotate([90, 0, 90]) linear_extrude(height = thick, center = true) offset(r = grow) polygon(pts);

/* ===== exposed cap (everything above the belt) =====
   Two things were wrong with the hat and both are ABOVE the capture line, so
   both are fixed here without touching a single dimension the channel sees.

   1. SECTION. The old bead was `intersection(prism_xz, prism_yz)` all the way
      up, and that intersection makes every horizontal cross-section a RECTANGLE
      — four hard edges running the full height and converging in a four-sided
      pyramid (measured: 31 distinct face normals in the whole solid, corner gap
      0.000 at every height; there was no curved surface on it anywhere). That
      rectangle is an artifact of how the master was measured, not of the master:
      the z-sweep recorded max-X and max-Y independently, and reconstructing the
      section as their product is an ASSUMPTION. Here the section is a
      superellipse |x/rx|^n + |y/ry|^n = 1 instead — n = 2 is an ellipse, n = 4
      a squircle, n → ∞ recovers the old rectangle.

   2. HEIGHT. frame_h went 6 → 8 for stiffness while bead_proud stayed 4, so the
      tip must now reach z 12 while the master's cap is only 3 mm tall. The old
      code stretched the dome 3 → 5 mm, taking the flank from 45° to 59° — that
      is where "pointy" came from. Instead the master's 3 mm dome is kept
      VERBATIM and the vertical belt band under it is what grows. That is not a
      compromise, it is literally the master's own exposed geometry: with
      frame_h 6 the master showed 1 mm of straight belt above the face and then
      its 3 mm dome, and so does this. The extra belt is hidden inside the
      chimney, which already opens the full belt width from z 7 to the rim. */
bead_section_n = 4;                            // 2 = ellipse, 4 = squircle, ∞ = the old rectangle
bead_ztop      = (s_fh + bead_proud * scale_factor) / sx;   // in base-profile units
bead_belt_top  = bead_ztop - 3;                // the master's 3 mm dome sits on the belt
assert(bead_ztop >= 10,
       "bead cap needs frame_h + bead_proud·scale ≥ 10·(bead_dia/10) — raise bead_proud or lower frame_h");
/* The rectangle→superellipse handover. It runs from the belt top to the frame's
   top face, i.e. entirely INSIDE the frame: the corners are already gone by the
   time the bead emerges, so nothing visible carries a seam and nothing below the
   belt is touched. The section only ever shrinks across it (a superellipse is
   strictly inside its bounding rectangle), so the cavity cannot bind on it and
   it prints as an inward chamfer, never an overhang. */
BEAD_BLEND_TOP = min(s_fh / sx, bead_belt_top);
/* The dome, resampled from the measured anchors with a monotone cubic in z(r)
   — z(r) and not r(z) because dr/dz → -∞ at the apex and a fit there invents a
   point. Every measured anchor is reproduced exactly; these rows just fill in
   between them, which the old 3-segment X-Z table never did (its dome was one
   straight 45° flank from the belt to well past half height — the "edge"). */
CAP_RX = [[5.0,0.0],[4.8741,0.1289],[4.68,0.3378],[4.4495,0.5975],[4.1937,0.8939],
          [3.9197,1.2121],[3.6329,1.5355],[3.3378,1.8463],[3.0385,2.1263],[2.7387,2.3584],
          [2.4416,2.5293],[2.1505,2.668],[1.8683,2.7829],[1.598,2.8642],[1.3419,2.9069],
          [1.1027,2.9307],[0.8825,2.9475],[0.6833,2.9599],[0.5069,2.9698],[0.3549,2.9781],
          [0.2286,2.9853],[0.1293,2.9913],[0.0577,2.996]];
CAP_RY = [[4.0,0.0],[3.8993,0.3148],[3.744,0.8136],[3.5596,1.2777],[3.3549,1.6335],
          [3.1357,1.9203],[2.9063,2.1439],[2.6703,2.3338],[2.4308,2.484],[2.1909,2.6031],
          [1.9533,2.7102],[1.7204,2.7989],[1.4947,2.8642],[1.2784,2.9028],[1.0736,2.9255],
          [0.8822,2.9422],[0.706,2.9549],[0.5466,2.9649],[0.4055,2.9734],[0.2839,2.9807],
          [0.1829,2.9871],[0.1034,2.9924],[0.0461,2.9965]];
function _cap_seg(tbl, dz) = max(0, min(len(tbl) - 2,
    len([for (k = [0 : len(tbl) - 2]) if (tbl[k][1] <= dz) 1]) - 1));
function _cap_r(tbl, dz) = let (i = _cap_seg(tbl, dz), a = tbl[i], b = tbl[i + 1])
    a[0] + (b[1] == a[1] ? 0 : (b[0] - a[0]) * (dz - a[1]) / (b[1] - a[1]));
function cap_rx(z) = z <= bead_belt_top ? 5 : _cap_r(CAP_RX, z - bead_belt_top);
function cap_ry(z) = z <= bead_belt_top ? 4 : _cap_r(CAP_RY, z - bead_belt_top);
function cap_blend(z) = let (u = BEAD_BLEND_TOP <= BEAD_CAPTURE_Z ? 1 :
      max(0, min(1, (z - BEAD_CAPTURE_Z) / (BEAD_BLEND_TOP - BEAD_CAPTURE_Z))))
    u * u * (3 - 2 * u);                       // smoothstep: no crease at either end
/* Ring vertices. The angle list is ANCHORED ON THE RECTANGLE'S CORNER (a sample
   lands exactly on it) and is shared by every ring, so at blend = 0 the ring
   reproduces the capture body's section exactly — no chamfer, no lip where the
   two solids meet — and vertices stack vertically instead of drifting.

   The count is FIXED rather than derived from `fn`, so the previewed bead is the
   printed bead. 32 around a 5 mm radius is a 0.024 mm sagitta — an order of
   magnitude under a 0.4 mm nozzle — so letting `fn = 64` double it would buy
   triangles, not smoothness. */
bead_facets = 32;                              // snapped to the nearest multiple of 8, min 16
CAP_Q = max(2, round(bead_facets / 8));        // 8·CAP_Q facets around
function _cap_blk(a0, c) = concat([for (k = [0:CAP_Q-1]) a0 + (c - a0) * k / CAP_Q],
                                  [for (k = [0:CAP_Q-1]) c + (a0 + 90 - c) * k / CAP_Q]);
function cap_angles(rx, ry) = let (ca = atan2(ry, rx))
    concat(_cap_blk(0, ca), _cap_blk(90, 180 - ca),
           _cap_blk(180, 180 + ca), _cap_blk(270, 360 - ca));
CAP_T = cap_angles(5 * sx, 4 * sy);
function _cap_rect(t, rx, ry) = let (c = cos(t), s = sin(t),
    d = min(rx / max(abs(c), 1e-9), ry / max(abs(s), 1e-9))) [d * c, d * s];
function _cap_se(t, rx, ry) = let (c = cos(t), s = sin(t))
    [rx * sign(c) * pow(abs(c), 2 / bead_section_n),
     ry * sign(s) * pow(abs(s), 2 / bead_section_n)];
function _cap_ring(z, grow) =
  let (rx = cap_rx(z) * sx + grow, ry = cap_ry(z) * sy + grow, b = cap_blend(z))
  [for (t = CAP_T) let (R = _cap_rect(t, rx, ry), E = _cap_se(t, rx, ry))
     [R[0] + (E[0] - R[0]) * b, R[1] + (E[1] - R[1]) * b, z * sx]];
/* Ring heights: a hair below the belt top (so the loft OVERLAPS the capture body
   rather than sharing a face with it), the handover band, the belt top, then the
   dome's own rows. CAP_RX[0] is dropped because bead_belt_top already covers it.
   Both row counts are SAMPLING, not shape — CAP_RX/CAP_RY stay the profile of
   record and are interpolated at whatever heights land here. The blend rows are
   buried inside the chimney (nothing above `s_fh` is affected by their count),
   and the dome rows are read against the 0.2 mm layer height: 12 across a 3 mm
   cap is a row every 0.25 mm, already finer than the slicer can print. */
bead_blend_rows = 3;
bead_dome_rows  = 12;
CAP_RINGS = concat(
    [BEAD_CAPTURE_Z - 0.02],
    BEAD_BLEND_TOP > BEAD_CAPTURE_Z
      ? [for (k = [0 : bead_blend_rows - 1])
           BEAD_CAPTURE_Z + (BEAD_BLEND_TOP - BEAD_CAPTURE_Z) * k / bead_blend_rows] : [],
    BEAD_BLEND_TOP < bead_belt_top ? [BEAD_BLEND_TOP] : [],   // the blend lands ON the face
    [bead_belt_top],
    [for (k = [1 : bead_dome_rows])
       bead_belt_top + CAP_RX[round((len(CAP_RX) - 1) * k / bead_dome_rows)][1]]);
/* One polyhedron, not a stack of hull()s: the cavity sweep instantiates the bead
   dozens of times per column and CSG cost there is what decides render time.
   Walls are triangulated because a lofted quad is not planar. */
module cap_solid(grow = 0) {
  F = len(CAP_T);
  M = len(CAP_RINGS);
  // Build each ring ONCE. Inlining `_cap_ring(...)[k]` into the points loop
  // would evaluate the whole F-point ring F times per level — O(M·F²) `pow`
  // calls, which cost ~1.3 s PER BEAD in the evaluator (65× that is a minute,
  // and it dwarfs the CSG). Hoisted it is O(M·F): ~40 ms for the same mesh.
  RINGS = [for (z = CAP_RINGS) _cap_ring(z, grow)];
  polyhedron(
    points = concat([for (r = RINGS, p = r) p],
                    [[0, 0, bead_ztop * sx + grow]]),
    /* WINDING: OpenSCAD wants each face CLOCKWISE as seen from OUTSIDE, which is
       the same as saying its right-hand-rule normal points INWARD. CAP_T runs
       counter-clockwise seen from +z, so the outward-looking orders are the ones
       below. Get this backwards and nothing complains — Manifold happily builds
       a consistently inside-out solid, and the implicit union with the capture
       body then SUBTRACTS the cap instead of adding it. `bead_solid` fell to
       460 - 282 = 179 mm³ that way. A support-function or bounding-box check
       cannot see it (both are winding-blind) and neither can an abs() volume;
       only the SIGNED volume can, so that is what the harness reports. */
    faces = concat(
      [[for (k = [0:F-1]) k]],                                                     // floor
      [for (i = [0:M-2], k = [0:F-1]) let (a = i*F + k, b = i*F + (k+1)%F) [a, b+F, b]],
      [for (i = [0:M-2], k = [0:F-1]) let (a = i*F + k, b = i*F + (k+1)%F) [a, a+F, b+F]],
      [for (k = [0:F-1]) let (a = (M-1)*F + k, b = (M-1)*F + (k+1)%F) [a, F*M, b]]), // apex
    convexity = 8);
}

/* `cap = false` drops the exposed hat. The channel cavity does not need it: the
   chimney below already opens the full belt width + clearance from the belt top
   to above the bead tip, and the grown cap never exceeds that, so omitting it
   leaves the cavity identical while keeping the swept union cheap. */
module bead_solid(grow = 0, cap = true) {
  intersection() {
    prism_xz([for (p = BASE_XZ) [p[0] * sx, p[1] * sx]], grow, s_bd * 4);
    prism_yz([for (p = BASE_YZ) [p[0] * sy, p[1] * sx]], grow, s_bd * 4);
  }
  if (cap) cap_solid(grow);
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
    translate([cx, y0 + (y1 - y0) * k / n, 0]) bead_solid(clearance, cap = false);
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
   inside the solid strip minus the rim chamfer — and (b) adjacent tokens read
   as SEPARATE words: an m-glyph token's ink is held to m/(m+1) of its pitch,
   which leaves a gap of one full character advance between neighbors.

   That second bound used to be a flat 92% of pitch, which only guaranteed
   neighbors never TOUCH. Where width binds, 92% of pitch spent on 3 glyphs
   makes one advance 0.307·pitch and the inter-token gap 0.26 advances —
   NARROWER than the whitespace around the `+` inside `1+9`, so proximity
   groups the wrong things and a 4-column friends-of-10 rail reads
   `1+92+83+74+65+5`. Deriving the bound from the glyph count instead states
   the real intent in the token's own units, and it costs nothing from 7
   columns up, where text_size caps first and all the slack is gap anyway.
   (Measured against the shipped DejaVuSans-Bold.ttf: `1+9` inks 2.05 em wide,
   so a 5-fact rail needs ~17 mm of pitch to hold 6 mm glyphs.)

   Uses REAL glyph metrics (textmetrics — worker passes --enable=textmetrics);
   metrics scale linearly with size, so one probe at the requested size yields
   the exact shrink factor. Ink half-extents are measured from the anchor on
   BOTH sides (halign/valign "center" centers the layout box, not the ink), so
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
// half of m/(m+1) — ink() and the bounds are both HALF-extents. The TS mirror
// is inkFraction() in abacus-model.ts.
function ink_frac(t) = 0.5 * len(t) / (len(t) + 1);
function fit_sz(toks, req, pitch, band) =
  len(toks) == 0 ? req :
  req * min(1, min(concat(
    [for (t = toks) ink_frac(t[0]) * pitch / max(0.001, ink(t[0], FONTS[t[1]], req)[0])],
    [for (t = toks) (band / 2 - 0.3)       / max(0.001, ink(t[0], FONTS[t[1]], req)[1])])));
function rail_sz(r) = fit_sz(r[0], text_size,
  norm([r[3] - r[1], r[4] - r[2]]) / max(1, len(r[0])),
  (r[5] == 0 ? strip_y : strip_x) - 2 * chamf);
function wall_sz(r) = fit_sz(r[0], edge_text_size,
  norm([r[4] - r[2], r[5] - r[3]]) / max(1, len(r[0])),
  s_fh - 2 * chamf);

module tok2d(tokens, k, sz)
  text(tokens[k][0], size = sz, font = FONTS[tokens[k][1]],
       halign = "center", valign = "center");
// Which ink color token k (index WITHIN ITS OWN RAIL) belongs to. The TS mirror
// is textGroups() in abacus-model.ts — the 5 is pinned there too, deliberately
// NOT read from the palette length: color_palette never reaches this file.
function tok_group(k) = text_fill == "rainbow" ? k % 5 : 0;
function tok_color(k) =
  text_fill == "rainbow" ? _palette(color_palette)[tok_group(k)] : text_color;
function tok_wanted(k) = plug_group < 0 || tok_group(k) == plug_group;

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
  for (r = rails()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1]) if (tok_wanted(k))
    color(tok_color(k)) translate([0, 0, s_fh - inlay_d])
      linear_extrude(inlay_d) rail_tok_2d(r, k);
  for (r = walls()) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1]) if (tok_wanted(k))
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
// mouth at z=0, seat floor at z=feet_depth_eff (dovetail). Split from
// feet_pocket_at so the modular column pass can seat a bumper at its OWN
// per-module position without a second copy of the pocket profile.
module feet_pocket_xy(x, y, mouth = undef, seat = undef, depth = undef) {
  m = is_undef(mouth) ? feet_mouth : mouth;
  st = is_undef(seat) ? feet_seat : seat;
  dp = is_undef(depth) ? feet_depth_eff : depth;
  translate([x, y, -0.01]) {
    if (feet_shape == "circle")
      cylinder(h = dp + 0.01, d1 = m, d2 = st);
    else
      linear_extrude(dp + 0.01, scale = st / m) square(m, center = true);
  }
}
module feet_pocket_at(k) feet_pocket_xy(FEET_POS[k][0], FEET_POS[k][1]);
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
/* ===== modular column parts (AbacusLink prototype) ========================
   Two `only=` slices, both cut from the CURRENT design's derived dims — so what
   goes on the plate is a true proxy for the abacus on screen, not a fixture with
   its own numbers that could drift from it.

   THE THREE STATIONS. A seam plane is the full outer_d deep, but the module is
   only THICK in three places; everywhere else the seam is two channel walls face
   to face, far too thin to carry a joint feature. Those three are the front
   strip, the reckoning bar, and the back strip, and they fall out of the same
   derivation the channels do rather than being measured off a drawing:

     [outer edge, mirror dir, y0, y1]   dir 0 = chevron but no latch (the bar has
                                        no outer wall to be released from)  */
function link_stations() = [
  [0,       1, 0,                     strip_y],
  [0,       0, s_bw + s_ehi + s_bl / 2 + clearance,
               s_bw + s_hlo - s_bl / 2 - clearance],
  [outer_d, -1, outer_d - strip_y,    outer_d]
];
/* Per-module foot seats: one on each end strip, pushed inboard of the latch slot
   in Y (they cannot clear it in X — the slot eats the seam end of the strip, and
   what is left over is narrower than the smallest bumper). Measured off the
   slot's FAR edge, which is link_slot_w past the tongue — not off the barb,
   which is on the near side and would put the pocket through the slot.
   linkFit()'s foot-hits-slot guard is the mirror of this arithmetic, and
   link_assert's station check is what keeps the pair inside the strip. */
function link_foot_y() =
  link_beam_y0 + link_beam_t + link_slot_w + 0.8 + link_foot_w / 2;
// ALWAYS an adhesive seat — straight-walled, mouth == seat — whatever feet_mode
// says. The monolith's "printed" mode co-prints TPU feet into dovetailed pockets
// with a crossbar threaded through them; doing that per module is a separate
// unsolved problem (each foot would need its own TPU body in a per-module 3MF),
// and the prototype's question is about the joint, not about feet. So a modular
// column gets a bumper seat, and feet_mode only decides whether it gets one.
module link_column_feet() {
  fy = link_foot_y();
  for (y = [fy, outer_d - fy])
    feet_pocket_xy(s_cp / 2, y, link_foot_w, link_foot_w, link_foot_d);
}

/* ONE column module: its own complete channel with a full-thickness wall on both
   sides, so capture never crosses a seam and the validated spool/track geometry
   is untouched. Male on the right face, female on the left — every module the
   same handedness, so they chain. */
module link_column() {
  difference() {
    union() {
      cube([s_cp, outer_d, s_fh]);
      translate([s_cp, 0, 0])
        link_male_face(s_fh, link_stations(), link_ramp, link_bump);
    }
    // the column's two channels, at the module's own centre
    translate([0, s_bw, 0]) {
      channel(s_cp / 2, s_elo, s_ehi);
      channel(s_cp / 2, s_hlo, s_hhi);
    }
    link_female_face(s_fh, link_stations(), link_ramp, link_bump,
                     link_slot_w, link_relief, link_fit);
    // the flat-face relief: the chevron flanks are the only contact, so the rest
    // of the seam is held clear. Cut from the female face only — one side of the
    // pair carries the whole standoff.
    translate([-0.01, -0.1, -0.01]) cube([link_relief + 0.01, outer_d + 0.2, s_fh + 0.02]);
    if (feet) link_column_feet();
  }
}

/* This module's own beads — free shells in its own channels, exactly as the
   assembly emits them. The point of printing a PAIR is to confirm that halving
   the web didn't disturb capture, and you cannot see that without the beads. */
module link_column_beads() translate([0, s_bw, 0]) {
  // coloured as the ones place (place_value 0), so a module previewed alone
  // looks like the column it would actually be at the right-hand end.
  for (j = [0 : earth - 1])
    color(bead_color(cols - 1, false)) bead(s_cp / 2, earthy(j));
  color(bead_color(cols - 1, true)) bead(s_cp / 2, s_hy);
}

/* The joint coupon: the same interface on two plain blocks of one pitch. No
   channels, no beads — it exists to fail fast on the latch alone, in a quarter
   of the time a column pair takes. Only the front station, since that is the one
   with a release bore. */
function link_coupon_stations() = [[0, 1, 0, strip_y]];
module link_coupon_male() {
  union() {
    cube([s_cp, strip_y, s_fh]);
    translate([s_cp, 0, 0])
      link_male_face(s_fh, link_coupon_stations(), link_ramp, link_bump);
  }
}
module link_coupon_female() {
  difference() {
    cube([s_cp, strip_y, s_fh]);
    link_female_face(s_fh, link_coupon_stations(), link_ramp, link_bump,
                     link_slot_w, link_relief, link_fit);
    translate([-0.01, -0.1, -0.01]) cube([link_relief + 0.01, strip_y + 0.2, s_fh + 0.02]);
  }
}

/* The two plates, in PRINT POSE: two pieces laid out flat and clear of each
   other, ready to slice as they stand. The gap clears the male face's tongue,
   which reaches link_beam_l − |link_beam_x0| past its module's right wall.

   The guards run HERE — at the one moment somebody is about to spend filament —
   rather than at file scope, where they would fire on every mono render too. */
module link_plate_guard() {
  link_assert(s_fh, s_cp, strip_y, link_ramp, link_fit, link_relief,
              link_bump, link_slot_w);
  // The foot's guards live in this file, not the library: the library is
  // deliberately foot-agnostic (a specialty column may seat something else
  // entirely), so where the bumper goes is the CONSUMER's business — and so is
  // checking it still fits once the latch has taken its half of the strip.
  assert(!feet || link_foot_y() + link_foot_w / 2 + 0.8 <= strip_y,
         "per-module foot pocket runs off the end strip — raise link_border or use a smaller bumper");
  assert(link_foot_w / 2 + 0.8 <= s_cp / 2,
         "per-module foot wider than the module — smaller link_foot_w, or raise link_web");
}
function link_plate_gap() = s_cp + link_beam_l + link_beam_x0 + 5;

module link_coupon_plate() {
  link_plate_guard();
  color(frame_color) link_coupon_male();
  translate([link_plate_gap(), 0, 0]) color(frame_color) link_coupon_female();
}

// A PAIR, so the seam itself is what you test — and each module carries its own
// beads, because whether halving the web disturbed capture is the other half of
// the question and you cannot see it without them.
module link_column_plate() {
  link_plate_guard();
  for (m = [0, 1]) translate([m * link_plate_gap(), 0, 0]) {
    color(frame_color) link_column();
    if (show_beads) link_column_beads();
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
/* ---- inspection slices (the Storybook parts bench) ------------------------
   NOT filament bodies — the four passes above each become one body in the 3MF,
   these do not. They render ONE piece of the model in isolation so it can be
   orbited, measured and test-printed on its own. Everything here composes the
   same modules the assembly does, so a slice can never drift from what ships.
   Consumed by AbacusPartBench / abacus-parts.stories.tsx (`INSPECT_PARTS`).

   The three bead slices exist because the bead is TWO solids joined at the belt
   (see "exposed cap" above) and the two halves answer different questions:
   `bead_capture` is the part that rides in the track and must never change,
   `bead_cap` is the part that is free to, and `bead_exposed` is the only part
   anyone ever SEES — everything below `s_fh` is swallowed by the frame. */
else if (only == "bead")         color(frame_color) bead_solid(0);
else if (only == "bead_capture") color(frame_color) bead_solid(0, cap = false);
else if (only == "bead_cap")     color(frame_color) cap_solid(0);
else if (only == "bead_exposed")
  color(frame_color) intersection() {
    bead_solid(0);
    translate([-s_bd * 2, -s_bd * 2, s_fh]) cube(s_bd * 4);   // keep only what clears the face
  }
/* The channel is the NEGATIVE — the cavity carved out of the frame, i.e. the
   bead grown by `clearance` and swept through its travel, plus the chimney. It
   is the shape of the track, so it is what a fit question is asked of. Centered
   on the origin rather than at its column, and one earth channel's travel. */
else if (only == "channel")      color(frame_color) channel(0, -(s_ehi - s_elo) / 2, (s_ehi - s_elo) / 2);
else if (only == "frame")        color(frame_color) frame();
/* ---- the AbacusLink prototype slices, in PRINT POSE -----------------------
   Both emit two pieces laid out flat and clear of each other, ready to slice as
   they stand — the parts bench and the studio's download hand these straight to
   a plate. The gap clears the male face's tongue, which reaches a full
   link_beam_l − |link_beam_x0| past its module's right wall.

   These render regardless of link_mode: asking for the coupon IS asking for the
   modular geometry, and refusing unless a mode toggle happened to be on would be
   a trap. link_assert() runs here, so a bad joint knob fails loudly at the one
   moment somebody is about to spend filament on it. */
else if (only == "link_coupon")  link_coupon_plate();
else if (only == "link_column")  link_column_plate();
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
