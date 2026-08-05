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

/* ===== modular seam — SPIKE (Gitea #30) =====
   Phase-0 coupon for the modular (per-column, snap-together) abacus. The
   coupon is a single-column mini-module: dovetail TABS on its right face,
   matching SOCKETS in its left face, a snap CLIP in the bar strip — so TWO
   PRINTS OF THE SAME PART snap into a chain (that IS the module topology;
   print three and you have a two-seam torture test).

   The physics that sizes everything (epic #30): the monolithic slab is so
   overstiff (~1e7 N·mm² about the weak axis) that joint COMPLIANCE is nearly
   free — what a kid feels is BACKLASH. So the seam is designed to seat with
   zero free play, `joint_fit` is the one tuning knob, and the go/no-go
   ritual is: print two, click, wiggle, reprint tighter until the wiggle dies.

   All three joint features are VERTICAL prisms: modules drop in from above
   like jigsaw pieces, so any MIDDLE column lifts straight out once its clip
   releases — no unzipping the chain to swap the hundreds column. The clip
   runs full s_fh height; the dovetails stop sc_seat above the bottom on a
   solid socket floor (the positive seat: downward slide-through is
   impossible by geometry, seated Z is a hard stop, and only upward — the
   intentional removal direction — is left to the clip ridge). Everything
   prints flat with no supports; every flexing feature bends within the
   layer plane (the strong orientation).
   Joint dims are ABSOLUTE (a fit contract between prints, like clearance —
   two modules at different scale_factor must still mate at the seam). */
seam_mode     = "mono"; // "mono" = one solid frame (every render today);
                       // "modular" = the final assembly instantiates per-column
                       // modules instead (CP5). Until that lands this knob is
                       // deliberately INERT — the TS model already sends it so
                       // the define vocabulary can't drift from the scad's.
joint_fit     = 0.1;   // per-side clearance on every seam mating face. 0.1 =
                       // first-print default; walk toward 0 (or negative)
                       // until backlash dies. Also deepens the click: ridge
                       // engagement = joint_ridge − joint_fit + 0.05.
joint_tab     = 4.5;   // dovetail protrusion depth (X past the module face)
joint_neck    = 6;     // dovetail neck width (Y, measured at the face)
joint_flare   = 1;     // per-side head widening — the pull-apart grab (~12.5°)
joint_clip_w  = 4;     // snap clip overall width (Y; lives in the bar strip)
joint_clip_l  = 9.5;   // clip protrusion depth. Prong flex length L = this −
                       // sc_slot; click strain 1.5·t·δ/L² is gated against
                       // WOOD PLA (the house filament, ~1.5% strain at break —
                       // it SNAPS where plain PLA bends): 0.70% at defaults
                       // incl. tuning headroom = 2.1× margin. The assert by
                       // sc_prong refuses geometry wood PLA would crack.
joint_ridge   = 0.2;   // click ridge proud height (0 = no click, friction only)

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
only         = "";     // part passes: "" | "marker_black" | "marker_white" | "text_plugs"
                       // | "module_left_text" | "module_right_text" | "feet"
                       // "feet" renders the printed foot solids (pocket fill + stand-off,
                       // crossbar voided) — emitted UNCONDITIONALLY; the TS caller gates.
                       // The module_*_text passes are the end modules' side-slot inlays,
                       // module-local, for the kit 3MFs (plug_group applies to all three
                       // text passes). Plus the INSPECTION slices — "bead" | "bead_capture"
                       // | "bead_cap" | "bead_exposed" | "channel" | "frame" | "seam_coupon"
                       // | "seam_coupon_pair" | "module_pair" — not filament bodies, just
                       // one piece rendered alone for the Storybook bench — and the six
                       // MODULE passes ("module_{left,mid,right}[_feet]") the kit renders.
                       // All sets are dispatched at the bottom of this file; the full
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

/* rs/ws select WHICH rails()/walls() entries to emit (index lists; defaults =
   all eight slots, i.e. the mono behavior, byte-identically). The end modules
   pass their own side only ([2]=left, [3]=right): a module must never carve a
   token laid out on the full mono frame_w — the top/bottom rails and the
   front/back walls straddle every seam, so a member of those slots inside a
   module render would be a half-glyph fragment. Selection at the call site
   makes that unrepresentable; the seam-crossing slots stay mono-only. */
module text_pockets(rs = [0, 1, 2, 3], ws = [0, 1, 2, 3]) { // inset: carved from the frame
  for (si = rs) let (r = rails()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    translate([0, 0, s_fh - inlay_d]) linear_extrude(inlay_d + s_fh) rail_tok_2d(r, k);
  for (si = ws) let (r = walls()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    wall_tok_at(r, k) translate([0, 0, -inlay_d])
      linear_extrude(inlay_d + 1) tok2d(r[0], k, wall_sz(r));
}
module text_plugs(rs = [0, 1, 2, 3], ws = [0, 1, 2, 3]) { // inset: flush colored inlays (3MF path)
  for (si = rs) let (r = rails()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1]) if (tok_wanted(k))
    color(tok_color(k)) translate([0, 0, s_fh - inlay_d])
      linear_extrude(inlay_d) rail_tok_2d(r, k);
  for (si = ws) let (r = walls()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1]) if (tok_wanted(k))
    color(tok_color(k)) wall_tok_at(r, k) translate([0, 0, -inlay_d])
      linear_extrude(inlay_d) tok2d(r[0], k, wall_sz(r));
}
module text_emboss(rs = [0, 1, 2, 3], ws = [0, 1, 2, 3]) { // emboss: raised + beveled, welds to the frame
  for (si = rs) let (r = rails()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
    translate([0, 0, s_fh - 0.1]) {
      linear_extrude(0.1 + emboss_h - bevel) rail_tok_2d(r, k);
      translate([0, 0, 0.1 + emboss_h - bevel]) linear_extrude(bevel)
        offset(delta = -bevel) rail_tok_2d(r, k);
    }
  for (si = ws) let (r = walls()[si]) if (len(r[0]) > 0) for (k = [0 : len(r[0]) - 1])
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
/* The feet trio takes explicit positions (x, y[, along_x]) so module columns
   (Gitea #30) can place per-module feet at their own derived spots; the
   *_at(k) wrappers bind the monolith's FEET_POS table and stay the only
   callers in mono. Pure refactor — verified by the --same fingerprint on
   both the mono and only="feet" renders. */
module feet_pocket_xy(x, y, mouth = feet_mouth, seat = feet_seat) {
  // mouth at z=0, seat floor at z=feet_depth_eff (dovetail). mouth/seat
  // default to the monolith's foot class; module columns pass their own.
  translate([x, y, -0.01]) {
    if (feet_shape == "circle")
      cylinder(h = feet_depth_eff + 0.01, d1 = mouth, d2 = seat);
    else
      linear_extrude(feet_depth_eff + 0.01, scale = seat / mouth)
        square(mouth, center = true);
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
module xbar_xy(x, y, along_x, seat = feet_seat) {
  xlen = seat + 2 * xbar_embed;
  translate([x, y, xbar_under]) {
    if (along_x)
      translate([-xlen / 2, -xbar_w / 2, 0]) cube([xlen, xbar_w, xbar_h]);
    else
      translate([-xbar_w / 2, -xlen / 2, 0]) cube([xbar_w, xlen, xbar_h]);
  }
}
module xbar_at(k) xbar_xy(FEET_POS[k][0], FEET_POS[k][1], xbar_along_x(k));
/* The printed foot (only="feet" part pass): the pocket-filling frustum —
   coincident with feet_pocket_at, zero shrink — plus a straight stand-off of
   the MOUTH cross-section below the face (two stacked primitives on purpose:
   one continuous taper from −feet_proud would change the mouth diameter at
   z=0), minus the crossbar the frame threads through it. */
module foot_xy(x, y, along_x, mouth = feet_mouth, seat = feet_seat) {
  difference() {
    translate([x, y, 0]) union() {
      translate([0, 0, -feet_proud]) {
        if (feet_shape == "circle") cylinder(h = feet_proud + 0.01, d = mouth);
        else linear_extrude(feet_proud + 0.01) square(mouth, center = true);
      }
      if (feet_shape == "circle")
        cylinder(h = feet_depth_eff, d1 = mouth, d2 = seat);
      else
        linear_extrude(feet_depth_eff, scale = seat / mouth)
          square(mouth, center = true);
    }
    if (feet_crossbar) xbar_xy(x, y, along_x, seat);
  }
}
module foot_at(k) foot_xy(FEET_POS[k][0], FEET_POS[k][1], xbar_along_x(k));
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

/* ===== modular seam coupon — derived + geometry (SPIKE, Gitea #30) =====
   The seam crosses the slab's three solid full-thickness Y-bands — front
   strip, reckoning bar, back strip. Their edges are derived below from the
   SAME travel stack the channels came from, so a joint cannot collide with a
   bead channel by construction: joints and channels live in disjoint Y. */
sc_wall = web * S;             // module edge wall = a FULL web. A monolithic
                               // mid-web cut would leave web/2 = 1.25 per side
                               // — too flimsy to capture beads — so modular
                               // pitch is s_cp + web·S: the honest +2.5 mm/col
                               // cost of modularity, stated once, here.
sc_w    = s_bd + 2 * clearance + 2 * sc_wall;    // coupon width (15.5 @ defaults)
sc_f1   = s_bw + s_elo - s_bl / 2 - clearance;   // front band  [0, 13.0]
sc_b0   = s_bw + s_ehi + s_bl / 2 + clearance;   // bar band    [61.5,
sc_b1   = s_bw + s_hlo - s_bl / 2 - clearance;   //              69.0]
sc_k0   = s_bw + s_hhi + s_bl / 2 + clearance;   // back band   [87.5, outer_d]
SC_DOVE_Y = [sc_f1 / 2, (sc_k0 + outer_d) / 2];  // dovetail centers (front, back)
sc_clip_y = (sc_b0 + sc_b1) / 2;                 // clip center (bar strip)
sc_slot   = 1.5;               // prong root web — flex length = joint_clip_l − this
sc_prong  = 1.2;               // prong thickness (= 2 lines of the 0.6 nozzle wood
                               // PLA wants; bends in-plane w.r.t. layers)
sc_ridge_h = 0.6;              // ridge half-height: flank ≈ 72° from horizontal,
                               // printable on a vertical wall, gentle cam in AND out
sc_seat   = 1.2;               // positive bottom seat: dovetail posts stop this far
                               // above the module bottom and the socket keeps a
                               // matching solid floor — a HARD stop that makes
                               // downward slide-through impossible and defines
                               // seated Z (tops flush by contact, not by eye).
                               // Upward removal stays clip-gated. 45° chamfer on
                               // the post underside / 45° ramp on the floor keep
                               // both supportless; the pair mates full-contact.
sc_deep   = 0.3;               // socket deepening past the tab tip — faces seat
                               // before any tip bottoms out (also the extra ramp
                               // run that keeps the socket floor at exactly 45°)
/* wood-PLA flexure gate — the eink dfm-checks screen (#367 "PLA flexures don't
   flex"), applied here at authoring time: peak outer-fibre strain ε% =
   150·t·Y/L² at the worst INTENDED engagement (ridge fully proud + 0.05 of
   negative-joint_fit tuning headroom) must clear wood PLA's ~1.5% break
   strain with 1.5× safety. In-plane bend ⇒ no layer derate. The TS mirror
   (seam-flexure-dfm.test.ts) runs these same numbers through
   @eink/frames-engine's real gate, force checks included. */
assert(150 * sc_prong * (joint_ridge + 0.05) / pow(joint_clip_l - sc_slot, 2) <= 1.0,
       "snap-clip strain would crack wood PLA — lengthen joint_clip_l or shrink sc_prong/joint_ridge");
function is_module_pass(o) =   // the six module render passes (bodies + feet)
  o == "module_left"      || o == "module_mid"      || o == "module_right" ||
  o == "module_left_feet" || o == "module_mid_feet" || o == "module_right_feet";
mod_active = is_module_pass(only) || only == "module_pair"
          || (only == "" && seam_mode == "modular");   // the assembled modular preview (CP5)
sc_active = only == "seam_coupon" || only == "seam_coupon_pair" || mod_active;
                               // seam geometry in this render? The strain gate
                               // above is knob-only (S-free) and stays loud in
                               // EVERY render, but the asserts below compare
                               // ABSOLUTE joint dims against SCALED strip widths
                               // and s_fh — they genuinely fail at small
                               // scale_factor (clip walls below S≈0.95!) and
                               // must never trip a render that instantiates no
                               // seam geometry at all.
assert(!sc_active || joint_neck + 2 * (joint_flare + joint_fit) + 3.2 <= min(sc_f1, outer_d - sc_k0),
       "dovetail socket leaves <1.6mm walls in the border strips — shrink joint_neck/joint_flare or raise scale_factor");
assert(!sc_active || joint_clip_w + 2 * (joint_fit + joint_ridge + 0.05) + 2.4 <= sc_b1 - sc_b0,
       "clip socket leaves <1.2mm walls in the bar strip — shrink joint_clip_w/joint_ridge or raise scale_factor");
assert(!sc_active || (sc_seat >= 0.6 && sc_seat + joint_tab + 1 <= s_fh),
       "bottom seat + 45° chamfer leave <1mm of straight dovetail wall — raise scale_factor or shrink sc_seat/joint_tab");

/* ----- module family (CP3): real per-column modules -----
   mid    = the coupon geometry grown up: rim-chamfered slab (never on the seam
            faces — the chamfer profile is the seam cross-section, so it runs
            CONTINUOUSLY across assembled seams like mono's rim), plus its OWN
            two TPU feet so any module stands at any abacus position.
   left  /
   right  = mono's border block CUT AT THE SEAM PLANE (outer_solid intersected
            with a half-space: rounding, chamfers, the flat seam face and the
            marker/feet corner positions are all the same solid mono ships),
            carrying column 0 / cols−1, two corner feet and two ArUco pockets
            (engraved only in phase 1 — plugs are a follow-up).
   Widths: 2·mod_we + (cols−2)·sc_w == frame_w + (cols−1)·web·S exactly — the
   modular assembly reproduces the mono footprint plus one full web per seam. */
mod_we = s_bw + s_em + s_bd / 2 + clearance + sc_wall;  // end-module width (26.0
                               // @ defaults): border + field margin + half of
                               // its column's channel + a full edge web
/* mid-module feet: the monolith's foot Y-centers are CONCENTRIC with the
   dovetails (same solid bands), and the socket eats x∈[0, mf_sock] at full
   height — so the mid foot moves BESIDE the socket on X instead. Width is a
   DERIVATION, not a constant: capped at the 6.35 (1/4") class the user chose,
   floored by what actually fits between socket wall and seam face — joint dims
   are absolute while sc_w scales, so the cap only closes near S = 1. */
mf_sock  = joint_tab + joint_fit + sc_deep;  // deepest socket cut into x (4.9)
mf_wall  = 1.6;                              // min wall: socket→pocket and pocket→seam face
mf_w     = min(feet_w, 6.35,
               sc_w - mf_sock - 2 * mf_wall - 2 * feet_undercut_eff - 2 * feet_fit_eff);
mf_mouth = mf_w + 2 * feet_fit_eff;
mf_seat  = mf_mouth + 2 * feet_undercut_eff;
mf_x     = (mf_sock + sc_w) / 2;             // centered in the band beside the socket
MF_Y     = [feet_c, outer_d - feet_c];       // front + back solid strips, same
                                             // edge inset as the mono corners
assert(!(mod_active && feet) || mf_w >= 4,
       "module feet don't fit beside the seam socket — raise scale_factor (or feet_mode=none)");
assert(!(mod_active && feet) || (mf_x - mf_seat / 2 - mf_sock >= 1.5 && sc_w - mf_x - mf_seat / 2 >= 1.5),
       "module foot pocket too close to the seam socket or the seam face");
assert(!(mod_active && feet && feet_crossbar) || feet_c + mf_seat / 2 + xbar_embed + 0.8 <= sc_f1,
       "module foot crossbar would break into the bead channel — shrink feet_w or raise scale_factor");

/* 2D plan profiles. Both are CONVEX — the top-taper hulls below depend on it. */
module sc_dove_2d(g = 0)       // dovetail plan: base on x=0, pointing +x
  offset(delta = g) polygon([[0, -joint_neck / 2], [joint_tab, -joint_neck / 2 - joint_flare],
                             [joint_tab, joint_neck / 2 + joint_flare], [0, joint_neck / 2]]);
module sc_clip_2d(g = 0)       // clip envelope plan (the prong slot is cut in 3D)
  offset(delta = g) square([joint_clip_l, joint_clip_w], center = false);
module sc_deep_2d(ext = sc_deep)   // socket-only: deepen a profile so FACES seat
  hull() { children(); translate([ext, 0]) children(); }   // before any tab tip
                                                           // bottoms out
module sc_post(z0 = 0) {       // tab prism z∈[z0, s_fh], top edge broken 0.4
  translate([0, 0, z0]) linear_extrude(s_fh - 0.4 - z0) children();
  translate([0, 0, s_fh - 0.4]) hull() {
    linear_extrude(0.01) children();
    translate([0, 0, 0.39]) linear_extrude(0.01) offset(delta = -0.4) children();
  }
}
module sc_seat_wedge(rise)     // 45° chamfer/ramp: the profile pinched to a sliver
  hull() {                     // on the module face at z=sc_seat, full at
    translate([0, 0, sc_seat]) // z=sc_seat+rise. Pass rise = the profile's x-depth
      linear_extrude(0.01) scale([0.002, 1]) children();   // ⇒ exactly 45°. Tab
    translate([0, 0, sc_seat + rise]) linear_extrude(0.01) children();
  }                            // underside and socket floor use this SAME
                               // construction, so the ramps mate full-contact at
                               // seated flush; every printed layer roots on the
                               // module wall ⇒ supportless in both parts.
module sc_seated_post() {      // dovetail tab with the bottom seat: no material
  sc_seat_wedge(joint_tab) children();      // below z=sc_seat ⇒ downward
  sc_post(sc_seat + joint_tab) children();  // slide-through is impossible
}
module sc_seated_pocket() {    // matching socket: the cut floats above a solid
                               // floor (rise = deepened+grown profile depth)
  sc_seat_wedge(joint_tab + joint_fit + sc_deep) children();
  sc_pocket(sc_seat + joint_tab + joint_fit + sc_deep - 0.01) children();
}
module sc_pocket(z0 = -0.01) { // socket cut z∈[z0, s_fh+0.01] + 0.8 flared rim lead-in
  translate([0, 0, z0]) linear_extrude(s_fh + 0.01 - z0) children();
  translate([0, 0, s_fh - 0.8]) hull() {
    linear_extrude(0.01) children();
    translate([0, 0, 0.81]) linear_extrude(0.01) offset(delta = 0.8) children();
  }
}
module sc_ridge_xz(len, g = 0) // click ridge along +x: YZ triangle, apex +y
  rotate([90, 0, 90]) linear_extrude(height = len)
    offset(delta = g) polygon([[0, -sc_ridge_h], [joint_ridge, 0], [0, sc_ridge_h]]);

/* The snap clip: two prongs whose outer-flank ridges click into grooves in the
   socket walls at mid-height. This is the locking flexure — it holds Z (lift-
   out) AND registers Z across the seam (a ridge seated in its groove resists
   one module sliding down relative to its neighbor). Compliance lives in the
   PRONGS, not the load-bearing socket walls; if a prong ever snaps, the
   dovetails still hold the chain together. The ridge stops sc_slot+1 short of
   the root: ridge over the rigid root would jam rigid-on-rigid at insertion. */
module sc_clip_tab() {
  translate([0, -joint_clip_w / 2, 0]) difference() {
    sc_post() sc_clip_2d();
    translate([sc_slot, sc_prong, -0.5])
      cube([joint_clip_l, joint_clip_w - 2 * sc_prong, s_fh + 1]);
  }
  if (joint_ridge > 0)
    for (m = [0, 1]) mirror([0, m, 0])
      translate([sc_slot + 1, joint_clip_w / 2, s_fh / 2])
        sc_ridge_xz(joint_clip_l - sc_slot - 1);
}
module sc_clip_pocket() {
  sc_pocket() sc_deep_2d() translate([0, -joint_clip_w / 2, 0]) sc_clip_2d(joint_fit);
  if (joint_ridge > 0)
    for (m = [0, 1]) mirror([0, m, 0])
      translate([-0.01, joint_clip_w / 2 + joint_fit, s_fh / 2])
        sc_ridge_xz(joint_clip_l + joint_fit + 0.31, 0.05);
}

module sc_tabs()               // on the RIGHT face (x = sc_w)
  translate([sc_w, 0, 0]) {
    for (yc = SC_DOVE_Y) translate([0, yc, 0]) sc_seated_post() sc_dove_2d();
    translate([0, sc_clip_y, 0]) sc_clip_tab();
  }
module sc_pockets() {          // into the LEFT face (x = 0)
  for (yc = SC_DOVE_Y) translate([0, yc, 0]) sc_seated_pocket() sc_deep_2d() sc_dove_2d(joint_fit);
  translate([0, sc_clip_y, 0]) sc_clip_pocket();
}

/* The coupon: a real single column — live captive beads, real strip positions,
   full outer_d depth — with the seam features on its faces. No markers, feet,
   text or rim chamfer: those are Phase-1 module concerns, not seam questions. */
module seam_coupon() {
  color(frame_color) difference() {
    union() {
      linear_extrude(s_fh) square([sc_w, outer_d]);
      sc_tabs();
    }
    translate([0, s_bw, 0]) {
      channel(sc_w / 2, s_elo, s_ehi);
      channel(sc_w / 2, s_hlo, s_hhi);
    }
    sc_pockets();
  }
  translate([0, s_bw, 0]) {   // the ones column, per place_value(cols−1)
    for (j = [0 : earth - 1]) color(bead_color(cols - 1, false)) bead(sc_w / 2, earthy(j));
    color(bead_color(cols - 1, true)) bead(sc_w / 2, s_hy);
  }
}

/* ===== module columns (Gitea #30 CP3) =====
   The printable per-column modules the studio's modular mode exports. Every
   piece composes the SAME modules mono ships (outer_solid, channel, bead,
   marker_pocket, the feet trio, the sc_ joint family), so a module can never
   drift from the monolith it replaces. */
module mod_xsec_2d()           // the seam-face cross-section: outer_d × s_fh with
  if (chamf > 0.01)            // mono's 45° rim chamfers on the front/back edges
    polygon([[chamf, 0], [outer_d - chamf, 0], [outer_d, chamf],
             [outer_d, s_fh - chamf], [outer_d - chamf, s_fh],
             [chamf, s_fh], [0, s_fh - chamf], [0, chamf]]);
  else square([outer_d, s_fh]);
module mod_slab(w)             // mid-module blank: the cross-section extruded
  rotate([90, 0, 90])          // along +x — chamfers run along front/back only,
    linear_extrude(w)          // both seam faces stay flat and congruent, so the
      mod_xsec_2d();           // rim chamfer is CONTINUOUS across every seam
module mod_end_body(left)      // end-module blank: mono outer_solid cut at the
  intersection() {             // seam plane — rounding, chamfers, and the flat
    outer_solid();             // seam face all come from the one solid mono ships
    translate([left ? -1 : frame_w - mod_we, -1, -1])
      cube([mod_we + 1, outer_d + 2, s_fh + 2]);
  }

module module_mid() {          // any interior column: sockets left, tabs right
  color(frame_color) difference() {
    union() { mod_slab(sc_w); sc_tabs(); }
    translate([0, s_bw, 0]) {
      channel(sc_w / 2, s_elo, s_ehi);
      channel(sc_w / 2, s_hlo, s_hhi);
    }
    sc_pockets();
    if (feet) for (y = MF_Y) feet_pocket_xy(mf_x, y, mf_mouth, mf_seat);
  }
  if (feet_crossbar)           // Y-run bars (an X-run would hit both seam faces)
    color(frame_color) intersection() {
      mod_slab(sc_w);
      for (y = MF_Y) xbar_xy(mf_x, y, false, mf_seat);
    }
  translate([0, s_bw, 0]) {    // captive beads; place-value color of a generic
                               // interior column (3MF slotting is per-column)
    for (j = [0 : earth - 1]) color(bead_color(min(1, cols - 1), false)) bead(sc_w / 2, earthy(j));
    color(bead_color(min(1, cols - 1), true)) bead(sc_w / 2, s_hy);
  }
}

module module_end(left) {      // left: border + column 0, tabs on the right face.
                               // right: border + column cols−1, sockets at x=0.
                               // Built in mono frame coords (marker/feet corner
                               // tables apply verbatim), shifted local at the end.
  x0 = left ? 0 : frame_w - mod_we;
  ci = left ? 0 : cols - 1;
  translate([-x0, 0, 0]) {
    color(frame_color) difference() {
      union() {
        mod_end_body(left);
        if (left) translate([mod_we - sc_w, 0, 0]) sc_tabs();
      }
      translate([s_bw, s_bw, 0]) {
        channel(colx(ci), s_elo, s_ehi);
        channel(colx(ci), s_hlo, s_hhi);
      }
      if (!left) translate([x0, 0, 0]) sc_pockets();
      if (show_markers) for (k = left ? [0, 3] : [1, 2]) marker_pocket(k);
      // This side's rail + end wall ride the module (both sit ≥14 mm inboard of
      // the seam plane); the seam-crossing slots are unrepresentable here — the
      // selection is hard-coded, not policy the caller could get wrong.
      if (text_mode == "inset") text_pockets(rs = left ? [2] : [3], ws = left ? [2] : [3]);
      if (feet) for (k = left ? [0, 3] : [1, 2]) feet_pocket_at(k);
    }
    if (text_mode == "emboss")
      color(frame_color) text_emboss(rs = left ? [2] : [3], ws = left ? [2] : [3]);
    if (feet_crossbar)
      color(frame_color) intersection() {
        mod_end_body(left);
        for (k = left ? [0, 3] : [1, 2]) xbar_at(k);
      }
    translate([s_bw, s_bw, 0]) {
      for (j = [0 : earth - 1]) color(bead_color(ci, false)) bead(colx(ci), earthy(j));
      color(bead_color(ci, true)) bead(colx(ci), s_hy);
    }
  }
}

module module_feet(kind) {     // the TPU pass per module kind (renders empty
  if (feet) {                  // when feet are off — the exporter treats an
    if (kind == "mid")         // empty feet render as an error, same as mono)
      for (y = MF_Y) color("#1f2937") foot_xy(mf_x, y, false, mf_mouth, mf_seat);
    else {
      x0 = kind == "left" ? 0 : frame_w - mod_we;
      translate([-x0, 0, 0])
        for (k = kind == "left" ? [0, 3] : [1, 2]) color("#1f2937") foot_at(k);
    }
  }
}

/* ===== assemble ===== (color() is preview/3MF only — ignored by binstl, no geom change) */
if (only == "marker_black")      for (k = [0 : 3]) color("black") marker_plug(k, true);
else if (only == "marker_white") for (k = [0 : 3]) color("white") marker_plug(k, false);
/* text_plugs is seam-aware: in modular mode only the SIDE slots exist (the
   crossing slots are laid out on the mono frame_w no module ships), and the
   right side shifts to its assembled seat — left slots hug x=0 so the mono
   width cancels for them. Feeds the on-screen overlay; the modular 3MFs use
   the module-local *_text passes below instead. */
else if (only == "text_plugs") {
  if (seam_mode == "modular") {
    text_plugs(rs = [2], ws = [2]);
    translate([2 * mod_we + (cols - 2) * sc_w - frame_w, 0, 0]) text_plugs(rs = [3], ws = [3]);
  }
  else text_plugs();
}
/* Per-end text-plug passes for the module 3MFs: the same side-slot inlays,
   re-based to the module's local frame exactly as module_end() re-bases its
   body — so a plug lands flush in the pocket the module carved. plug_group
   filters these like plain text_plugs (the export splits per ink color). */
else if (only == "module_left_text")  text_plugs(rs = [2], ws = [2]);
else if (only == "module_right_text")
  translate([-(frame_w - mod_we), 0, 0]) text_plugs(rs = [3], ws = [3]);
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
/* The modular-seam coupon (SPIKE, Gitea #30). `seam_coupon` is the printable
   part — print it TWICE and the two copies snap into a chain. The pair pass
   shows the assembled seam for inspection; it is also the disjointness proof
   the harness leans on: at joint_fit > 0 the pair's volume must equal exactly
   2× the single coupon's, or a tab is fused into its socket. */
else if (only == "seam_coupon")      seam_coupon();
else if (only == "seam_coupon_pair") { seam_coupon(); translate([sc_w, 0, 0]) seam_coupon(); }
/* Module columns (Gitea #30 CP3): the six per-module passes the kit exporter
   renders — three PLA bodies, three TPU feet sets — plus `module_pair`, the
   inspection/harness twin of seam_coupon_pair (two seated mids; volume must be
   exactly 2× one mid or a tab is fused into its socket). Six explicit names,
   no role define — a `-Dmodule_role` that went missing would silently render
   its scad default, the exact plug_group failure family these tests exist for. */
else if (only == "module_left")       module_end(true);
else if (only == "module_mid")        module_mid();
else if (only == "module_right")      module_end(false);
else if (only == "module_left_feet")  module_feet("left");
else if (only == "module_mid_feet")   module_feet("mid");
else if (only == "module_right_feet") module_feet("right");
else if (only == "module_pair")      { module_mid(); translate([sc_w, 0, 0]) module_mid(); }
/* The assembled modular preview (CP5): the same left + mids + right the kit
   prints, seated at zero gap on the sc_w pitch — one full web per seam, total
   width 2·mod_we + (cols−2)·sc_w (the TS derived() identity). Everything here
   IS the module_* parts the kit exports, so preview and kit cannot drift; the
   seams Nef-weld into one solid, which is what the viewer's shell classifier
   expects. No marker plugs on purpose: the phase-1 end modules carry engraved
   ArUco pockets only. Frame text: the SIDE slots (text_left/right rails,
   edge_left/right walls) ride the end modules — module_end carves/embosses
   them itself, and the seam-aware text_plugs pass overlays the inset colors —
   while the crossing slots (top/bottom rails, front/back walls) are laid out
   on the mono frame_w no module ships and stay mono-only. The mono tree below
   is untouched — mono renders stay byte-identical, which the fingerprint
   harness pins after every scad change. */
else if (seam_mode == "modular") {
  module_end(true);
  for (i = [1 : cols - 2]) translate([mod_we + (i - 1) * sc_w, 0, 0]) module_mid();
  translate([mod_we + (cols - 2) * sc_w, 0, 0]) module_end(false);
}
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
