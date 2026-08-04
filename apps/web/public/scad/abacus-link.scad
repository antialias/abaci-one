// abacus-link.scad — the AbacusLink modular-column joint + its test coupon
// ---------------------------------------------------------------------------
// SPEC: apps/web/docs/abacus-studio/modular-columns-spec.md
// TS MIRROR: src/components/create/abacus/abacus-link.ts (the derived chain and
// the fit guards; this file stays the source of truth for the GEOMETRY, exactly
// as abacus.scad does for the monolith).
//
// STATUS: unrendered. There is no headless OpenSCAD in this repo (see
// __tests__/export-defines.test.ts), so nothing here has been through the
// evaluator. Render `part="coupon"` in the studio or on the desktop before
// spending filament on it.
//
// WHY THIS IS A SEPARATE FILE. abacus.scad's captive-track geometry is the
// hardest-won thing in the model, and a seam never crosses a bead channel — so
// the joint can be designed, printed and measured entirely on its own. This
// file is that experiment. Once the coupon passes §9 of the spec, these modules
// get `include`d by abacus.scad rather than copied into it.
//
// THE ORIENTATION CONSTRAINT that shapes every decision below: the beads are
// captive and print in place, so the build orientation is FLAT (frame bottom on
// the bed) and is not negotiable. Therefore:
//   - anything prismatic in Z is free            (vertical walls print perfectly)
//   - anything within 45° of vertical is free    (self-supporting)
//   - anything else needs support, and support inside a snap fit is not a thing
// The chevron obeys the second rule; the latch obeys the first. Neither needs a
// single support interface.
//
// FRAME. The seam plane is x = 0. Module A is at x < 0 and presents the MALE
// face (chevron ridge + latch tongue, both reaching into +x). Module B starts at
// x = link_relief and presents the FEMALE face (chevron groove + latch slot).
// Every module is male on its right and female on its left, so they chain and
// the stack is loaded from one end. y runs from the outer wall at y = 0 inward;
// z is the slab height.
//
// ONE TONGUE PER STATION, NOT TWO. Doubling the tongues would double the clamp,
// but the release poke has to reach a tongue from the outer wall, and the second
// tongue's shoulder is exactly the material the second bore would have to drill
// through. So a seam gets two tongues by having two STATIONS — one at the front
// strip released from the front wall, one at the back strip released from the
// back wall. That is also what makes release two-handed, and two-handed is what
// makes it impossible by accident.

/* ===== the interface — FROZEN once a size class ships ===================== */
link_h        = 8;     // seam height = frame_h · S
link_pitch    = 15;    // modular col_pitch: bead 10 + 2·clearance + web 4.5
link_station  = 14.75; // Y depth of the station this coupon models (front strip)
                       // = border_w 7.0 + shelf 7.75. The monolith's 5.25 border
                       // gives a 13.0 strip, and 13.0 holds a latch OR a foot,
                       // not both — the foot-vs-slot assert below is what found
                       // that. Modular mode buys the extra 1.75 by widening the
                       // border, at +3.5 mm on the abacus's overall depth.

/* ---- chevron: Z registration and Z shear --------------------------------- */
// Two teeth across the height. The flank angle off vertical is
// atan(link_tooth_d / (link_h/link_teeth/2)) = 38.7° at these values — inside
// the 45° self-support limit with 6.3° to spare, in BOTH the ridge and the
// groove. Push link_tooth_d past link_h/(2·link_teeth) and the groove roof
// becomes an unprintable overhang; that is what the first assert is for.
link_teeth    = 2;
link_tooth_d  = 1.6;   // ridge protrusion into +x
link_back     = 0.6;   // profile backing, buried in A — keeps the polygon simple
link_fit      = 0.10;  // per-face groove clearance (what lets it go together)
link_relief   = 0.25;  // flat-face standoff: the chevron flanks are the ONLY
                       // contact, so nothing else can hold them off their seat

/* ---- cam latch: X preload, take-up, retention ---------------------------- */
// A cantilever along X springing in Y, prismatic in Z over the full height —
// support-free by construction, and 8 mm tall, so it is stiff about the axis
// that matters and compliant about the one it needs to be.
//
// The barb's proximal face is a ramp at link_ramp off the Y axis. That single
// angle does three jobs: it converts the spring's Y force into X clamp at
// 1/tan(ramp), it drives the seam shut so the ASSEMBLED clearance is zero
// whatever the manufactured clearance was, and — being below the PLA-on-PLA
// friction angle (~16.7°) — it self-locks, so load cannot back it out.
link_ramp     = 8;     // cam/retain ramp, degrees off the Y axis. SELF-LOCKING
                       // REQUIRES < ~16.7. Coupon sweep: 8 / 12 / 16.
link_lead     = 40;    // insertion lead-in, degrees off the X axis (shallow, so
                       // pushing two modules together is a kid-force operation)
link_beam_t   = 1.8;   // tongue thickness in Y
link_beam_l   = 12;    // tongue length in X — the stress lever. Shortening this
                       // raises clamp force as 1/L³ but beam stress as 1/L²;
                       // 12 mm keeps peak fibre stress ≈ 30 MPa, under PLA yield.
link_beam_x0  = -5;    // tongue root, inside A
link_beam_y0  = 2.6;   // tongue's near face, measured from the outer wall. The
                       // barb reaches 0.9 nearer still, so this sets the outer
                       // wall's remaining thickness (1.55 mm) — the wall the
                       // release bore goes through.
link_bump     = 1.1;   // barb height = the cam travel = the tolerance the joint
                       // can swallow (take-up = link_bump · tan(link_ramp)).
                       // NOTE the preload a seated seam holds comes from the
                       // travel REMAINING when the chevron bottoms — nominally
                       // half of this — not from the full height. The full
                       // height is the insertion peak. See linkMechanics().
link_slot     = 1.4;   // spring room on the tongue's far side. MUST exceed
                       // link_bump or the barb cannot deflect past the throat.
link_release  = 2.6;   // release-poke bore through the outer wall

/* ---- per-module stick-on foot -------------------------------------------- */
// Affordance, not obligation (spec §5): every module gets the pocket, you stick
// feet on as many as you want.
//
// The foot and the latch slot compete for the same strip, and the slot wins on
// X — it runs from the seam out to x = 8.2 of a 15 mm pitch, which leaves less
// clear width than even the smallest bumper needs. So they are separated in Y
// instead: latch inboard-of-the-wall, foot inboard of the latch. That is what
// sets link_station, and it caps the preset at 1/4" — the largest BUMPER_PRESETS
// entry that fits behind the slot in a widened strip.
link_foot     = true;
link_foot_w   = 6.35;  // 1/4"
link_foot_d   = 1.2;
link_foot_x   = 7.5;   // module-local — centred, since Y is what separates it
link_foot_y   = 10.0;

part = "coupon";       // coupon | male | female | assembled | ridge
$fn  = 48;

/* ===== derived ============================================================ */
link_th       = link_h / link_teeth;                  // one tooth's height
link_flank    = atan(link_tooth_d / (link_th / 2));   // chevron flank, off VERTICAL
link_beam_x1  = link_beam_x0 + link_beam_l;           // tongue tip
link_barb_x   = link_beam_x1 - 3.4;                   // where the barb bears
link_cam_run  = link_bump * tan(link_ramp);           // cam face's x-run
link_lead_run = link_bump / tan(link_lead);           // lead-in face's x-run
link_takeup   = link_cam_run;                         // X drawn per full travel
link_slot_end = link_beam_x1 + 1.2;                   // slot's far wall
link_bore_x   = link_beam_x1 - 0.5;                   // bore lands PAST the barb
// The two footprints that have to stay out of each other's way, as bounding
// boxes in the module's own frame: [x0, y0, x1, y1].
link_slot_bb  = [link_relief - 0.1,       link_beam_y0 - link_bump - 0.15,
                 link_slot_end,           link_beam_y0 + link_beam_t + link_slot];
link_foot_bb  = [link_foot_x - link_foot_w / 2, link_foot_y - link_foot_w / 2,
                 link_foot_x + link_foot_w / 2, link_foot_y + link_foot_w / 2];

/* ===== coherence floors =================================================== */
assert(link_tooth_d <= link_th / 2 + 0.001,
       "chevron flank steeper than 45° — the groove roof needs support. Lower link_tooth_d or raise link_teeth.");
assert(link_ramp > 0 && link_ramp < 16.7,
       "cam ramp outside the self-locking band (0 < ramp < atan(mu_PLA) ~ 16.7°)");
// Closing a link_fit normal gap on a flank inclined link_flank off vertical
// costs link_fit / cos(link_flank) of X travel. The flats have to stay clear of
// each other over at least that much, or they bottom out first and the chevron
// never seats — which loses the Z registration the markers depend on, silently.
assert(link_relief > link_fit / cos(link_flank) + 0.05,
       "flat relief too small — the seam faces would bottom out before the chevron flanks seat");
assert(link_takeup >= 0.12,
       "cam take-up under 0.12 mm cannot swallow a normal print's spread — raise link_bump or link_ramp");
assert(link_slot > link_bump + 0.2,
       "slot narrower than the barb's travel — the tongue would bind on insertion");
// The bore has to open into the slot BEYOND the shoulder. Drill it at or before
// the barb and it removes the very material the barb bears on — which is a
// silent failure: the part renders, prints, clicks, and holds nothing.
assert(link_bore_x - link_release / 2 > link_barb_x + link_lead_run,
       "release bore would eat the latch shoulder — move link_bore_x toward the tongue tip");
assert(link_beam_y0 - link_bump > 1.2,
       "outer wall left in front of the barb is thinner than a printable wall — raise link_beam_y0");
assert(link_slot_bb[3] < link_station,
       "latch slot runs past the station into the bead channel — raise link_station or shrink the tongue");
// Foot vs. latch. These two want the same strip, and the slot wins on X (it
// spans the seam out to link_slot_end, leaving less clear width than any bumper
// needs), so the only way past each other is Y. Stated as a real box-disjoint
// test rather than a one-axis check, because a one-axis check is what would let
// a future pitch/preset change quietly reintroduce the overlap.
link_bb_clear = 0.8;
assert(link_foot_bb[1] > link_slot_bb[3] + link_bb_clear ||
       link_foot_bb[3] < link_slot_bb[1] - link_bb_clear ||
       link_foot_bb[0] > link_slot_bb[2] + link_bb_clear ||
       link_foot_bb[2] < link_slot_bb[0] - link_bb_clear,
       "foot pocket overlaps the latch slot — move link_foot_y past the slot, shrink link_foot_w, or widen the station");
assert(link_foot_bb[0] > link_relief + 0.8 && link_foot_bb[2] < link_relief + link_pitch - 0.8 &&
       link_foot_bb[1] > 0.8 && link_foot_bb[3] < link_station - 0.8,
       "foot pocket runs off the module's solid strip — smaller link_foot_w, or a bigger pitch/station");

/* ===== chevron ============================================================ */
// XZ profile of the ridge, sitting on the seam plane: flat back buried in A,
// teeth reaching into +x. `each` is deliberately avoided so this parses on
// older evaluators.
function link_ridge_pts() = concat(
  [[-link_back, 0], [0, 0]],
  [for (i = [0 : 2 * link_teeth - 1]) let (k = floor(i / 2))
     i % 2 == 0 ? [link_tooth_d, (k + 0.5) * link_th] : [0, (k + 1) * link_th]],
  [[-link_back, link_h]]);

// Cross-section in X-Z, extruded along Y — the same helper shape as
// abacus.scad's prism_xz, so the two files stay idiomatically identical.
module link_prism_xz(pts, y0, y1, grow = 0)
  translate([0, (y0 + y1) / 2, 0])
    rotate([90, 0, 0])
      linear_extrude(height = y1 - y0, center = true)
        offset(r = grow) polygon(pts);

module link_ridge(y0, y1)  link_prism_xz(link_ridge_pts(), y0, y1);
// The groove is the ridge grown by link_fit on every face — so the ridge floats
// free until the cam pulls it in and the FLANKS bear, which is what centres the
// two modules in Z and makes the top faces flush by construction rather than by
// tolerance. Overshot in Y so the cut breaks cleanly out of both station ends.
module link_groove(y0, y1) link_prism_xz(link_ridge_pts(), y0 - 0.1, y1 + 0.1, link_fit);

/* ===== cam latch ========================================================== */
// Everything here is a plan-view (XY) profile extruded through the full height:
// no overhang exists anywhere in the latch, at any angle.
//
// The barb protrudes in −y and the slot's shoulder is the B material at −y, so
// disengaging pushes the tongue +y — i.e. INWARD from the outer wall at y = 0,
// which is the one direction a poke can reach an interior column from.
module link_tongue_2d() {
  y = link_beam_y0;
  union() {
    translate([link_beam_x0, y]) square([link_beam_l, link_beam_t]);
    // barb: cam face on the −x side (short and steep — that IS the mechanical
    // advantage), insertion lead-in on the +x side (long and shallow). As the
    // barb travels −y the face's x grows, so the spring draws A into B.
    polygon([[link_barb_x - link_cam_run,  y],
             [link_barb_x,                 y - link_bump],
             [link_barb_x + link_lead_run, y]]);
  }
}

// The slot: a throat only as wide as the bare tongue, so the barb must deflect
// to pass it, then an opening past the shoulder where the barb springs home.
// The shoulder face is cut on the same ramp as the barb's, so they bear flat.
module link_slot_2d() {
  y = link_beam_y0;
  union() {
    translate([link_relief - 0.1, y - 0.05])
      square([link_barb_x - link_relief + 0.1, link_beam_t + link_slot]);
    polygon([[link_barb_x - link_cam_run, y - 0.05],
             [link_barb_x,                y - link_bump - 0.15],
             [link_slot_end,              y - link_bump - 0.15],
             [link_slot_end,              y + link_beam_t + link_slot],
             [link_barb_x - link_cam_run, y + link_beam_t + link_slot]]);
  }
}

module link_tongue() linear_extrude(link_h) link_tongue_2d();
module link_slot()   linear_extrude(link_h) link_slot_2d();

// Release bore: from the outer wall at y = 0, in +y, onto the tongue's TIP —
// past the barb, so it opens into slot void instead of into the shoulder. Poke
// with a pencil, a paperclip, or the AbacusLink key, and the tongue lifts off
// its shoulder. One bore per station; a real module is released by squeezing
// the front and back bores together.
module link_release_bore()
  translate([link_bore_x, -0.1, link_h / 2])
    rotate([-90, 0, 0])
      cylinder(h = link_beam_y0 + 0.5, d = link_release);

/* ===== foot pocket ======================================================== */
// Straight-walled, not the monolith's dovetail: this one is only ever a seat for
// an adhesive bumper, and a module has no room to spare around it.
module link_foot_pocket(x)
  translate([x, link_foot_y, -0.01])
    cylinder(h = link_foot_d + 0.01, d = link_foot_w);

/* ===== the two coupon halves ============================================== */
// Each is a plain block of one column pitch carrying one real interface, so what
// the coupon measures is what the abacus gets. A is male on its right face, B is
// female on its left — the same handedness every module has. Module-local x is
// measured from each block's own female (left) face.
module link_male_half() {
  difference() {
    union() {
      translate([-link_pitch, 0, 0]) cube([link_pitch, link_station, link_h]);
      link_ridge(0, link_station);
      link_tongue();
    }
    if (link_foot) link_foot_pocket(-link_pitch + link_foot_x);
  }
}

module link_female_half() {
  difference() {
    translate([link_relief, 0, 0]) cube([link_pitch, link_station, link_h]);
    link_groove(0, link_station);
    link_slot();
    link_release_bore();
    if (link_foot) link_foot_pocket(link_relief + link_foot_x);
  }
}

/* ===== dispatch =========================================================== */
if (part == "male")           link_male_half();
else if (part == "female")    link_female_half();
else if (part == "ridge")     link_ridge(0, link_station);
else if (part == "assembled") {                         // preview only — the two
  link_male_half();                                     // halves in their seated
  link_female_half();                                   // pose, relief gap visible
}
else {                                                  // "coupon": print pose —
  link_male_half();                                     // both halves flat on the
  translate([link_pitch + 6, 0, 0]) link_female_half(); // bed, clear of each other
}
