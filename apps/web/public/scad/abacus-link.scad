// abacus-link.scad — the AbacusLink modular-column joint (LIBRARY)
// ---------------------------------------------------------------------------
// SPEC: apps/web/docs/abacus-studio/modular-columns-spec.md
// TS MIRROR: src/components/create/abacus/abacus-link.ts (the derived chain and
// the fit guards; this file stays the source of truth for the GEOMETRY, exactly
// as abacus.scad does for the monolith).
//
// THIS FILE EMITS NOTHING ON ITS OWN. It is `include`d by abacus.scad, and
// `include` inlines top-level statements — so a top-level `part=` dispatch here
// would render a coupon into every abacus, and top-level `assert()`s would fire
// on designs that never asked for a joint. Everything is therefore a module or a
// function, every module takes its dimensions as PARAMETERS rather than reading
// the includer's globals, and the checks live in `link_assert()` for the
// consumer to call under its own `link_mode`.
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
// FRAME. Every module is MALE on its right face and FEMALE on its left, so they
// chain and the stack is loaded from one end. The male face carries the chevron
// ridge and the latch tongue, both reaching into +x past the module's own right
// wall; the female face carries the groove and the slot, both cut into +x from
// the module's left wall. All of the modules below are authored in a LOCAL frame
// whose origin is the joint plane, x = 0, with the ridge reaching into +x — the
// caller translates them onto whichever wall they belong to.
//
// ONE TONGUE PER STATION, NOT TWO. Doubling the tongues would double the clamp,
// but the release poke has to reach a tongue from an outer wall, and the second
// tongue's shoulder is exactly the material the second bore would have to drill
// through. So a seam gets two tongues by having two STATIONS — one at the front
// strip released from the front wall, one at the back strip released from the
// back wall. That is also what makes release two-handed, and two-handed is what
// makes it impossible by accident.

/* ===== interface constants ================================================
   These are the joint's own proportions and are NOT scaled by the abacus's
   scale_factor: a latch tongue is a spring and a bumper is real hardware, so
   both live in absolute millimetres, exactly like `clearance` and the feet in
   abacus.scad. What DOES follow the design is the joint's envelope — height,
   pitch, station depth — which every module below takes as a parameter. */
link_teeth     = 2;    // chevron teeth across the seam height
link_tooth_d   = 1.6;  // ridge protrusion into +x
link_back      = 0.6;  // profile backing, buried in the male module
link_lead      = 40;   // insertion lead-in, degrees off the X axis (shallow, so
                       // pushing two modules together is a kid-force operation)
link_beam_t    = 1.8;  // tongue thickness in Y
link_beam_l    = 12;   // tongue length in X — the stress lever. Shortening this
                       // raises clamp force as 1/L³ but beam stress as 1/L²;
                       // 12 mm keeps the insertion-peak fibre stress ≈ 41 MPa,
                       // under PLA's ~55 MPa yield.
link_beam_x0   = -5;   // tongue root, inside the male module
link_beam_y0   = 2.6;  // tongue's near face, from the station's outer edge. The
                       // barb reaches link_bump nearer still, so this sets the
                       // outer wall's remaining thickness — the wall the release
                       // bore passes through.
link_release_d = 2.6;  // release-poke bore
link_barb_back = 3.4;  // barb's setback from the tongue tip
link_slot_over = 1.2;  // slot's reach past the tongue tip

/* the module-local X of the far wall of a latch slot, and of the release bore.
   Hoisted to functions because the consumer needs both to keep a foot pocket
   clear of the slot, and a second copy of either would be a second truth. */
function link_beam_x1()  = link_beam_x0 + link_beam_l;
function link_barb_x()   = link_beam_x1() - link_barb_back;
function link_slot_end() = link_beam_x1() + link_slot_over;
function link_bore_x()   = link_beam_x1() - 0.5;
/* Chevron flank angle off VERTICAL. 45° is where the groove's roof stops being
   printable, so this is the number the first assert guards. */
function link_flank(h)   = atan(link_tooth_d / (h / link_teeth / 2));
/* X travel that closes a `fit` normal gap on the flank — what the flat relief
   has to exceed, or the flats bottom out before the chevron seats. */
function link_seat_travel(h, fit) = fit / cos(link_flank(h));
/* X the cam draws per full barb travel. */
function link_takeup(ramp, bump)  = bump * tan(ramp);

/* ===== the checks =========================================================
   A module rather than top-level asserts, so including this file is free and
   only a consumer that actually builds a joint pays for the guards. Mirrored
   one-for-one, in this order, by linkFit() in abacus-link.ts — which is the copy
   that runs in CI, since no headless OpenSCAD exists in this repo. */
module link_assert(h, pitch, station, ramp, fit, relief, bump, slot) {
  assert(link_tooth_d <= h / link_teeth / 2 + 0.001,
         "chevron flank steeper than 45° — the groove roof needs support. Lower link_tooth_d or raise link_teeth.");
  assert(ramp > 0 && ramp < 16.7,
         "cam ramp outside the self-locking band (0 < ramp < atan(mu_PLA) ~ 16.7°)");
  // Closing a `fit` normal gap on a flank inclined link_flank off vertical costs
  // fit/cos(flank) of X travel. The flats have to stay clear over at least that
  // much or they bottom out first and the chevron never seats — which loses the
  // Z registration the ArUco markers depend on, silently.
  assert(relief > link_seat_travel(h, fit) + 0.05,
         "flat relief too small — the seam faces would bottom out before the chevron flanks seat");
  assert(link_takeup(ramp, bump) >= 0.12,
         "cam take-up under 0.12 mm cannot swallow a normal print's spread — raise link_bump or link_ramp");
  assert(slot > bump + 0.2,
         "slot narrower than the barb's travel — the tongue would bind on insertion");
  assert(link_beam_y0 - bump > 1.2,
         "outer wall left in front of the barb is thinner than a printable wall");
  // The bore has to open into the slot BEYOND the shoulder. Drill it at or
  // before the barb and it removes the very material the barb bears on — which
  // is a silent failure: the part renders, prints, clicks, and holds nothing.
  assert(link_bore_x() - link_release_d / 2 > link_barb_x() + bump / tan(link_lead),
         "release bore would eat the latch shoulder — move link_bore_x toward the tongue tip");
  assert(link_beam_y0 + link_beam_t + slot < station,
         "latch slot runs past the station into the bead channel — widen border_w or shrink the tongue");
  assert(link_slot_end() + 1.0 < pitch,
         "latch slot runs past the module's far wall — raise the modular web/pitch");
}

/* ===== chevron ============================================================
   XZ profile of the ridge, sitting on the joint plane: flat back buried in the
   male module, teeth reaching into +x. `each` is deliberately avoided so this
   parses on older evaluators. */
function link_ridge_pts(h) =
  let (th = h / link_teeth)
  concat(
    [[-link_back, 0], [0, 0]],
    [for (i = [0 : 2 * link_teeth - 1]) let (k = floor(i / 2))
       i % 2 == 0 ? [link_tooth_d, (k + 0.5) * th] : [0, (k + 1) * th]],
    [[-link_back, h]]);

// Cross-section in X-Z, extruded along Y — the same helper shape as
// abacus.scad's prism_xz, so the two files stay idiomatically identical.
module link_prism_xz(pts, y0, y1, grow = 0)
  translate([0, (y0 + y1) / 2, 0])
    rotate([90, 0, 0])
      linear_extrude(height = y1 - y0, center = true)
        offset(r = grow) polygon(pts);

module link_ridge(h, y0, y1) link_prism_xz(link_ridge_pts(h), y0, y1);
// The groove is the ridge grown by `fit` on every face — so the ridge floats
// free until the cam pulls it in and the FLANKS bear, which is what centres the
// two modules in Z and makes their top faces flush by construction rather than
// by tolerance. Overshot in Y so the cut breaks cleanly out of both station ends.
module link_groove(h, y0, y1, fit) link_prism_xz(link_ridge_pts(h), y0 - 0.1, y1 + 0.1, fit);

/* ===== cam latch ==========================================================
   Everything here is a plan-view (XY) profile extruded through the full height:
   no overhang exists anywhere in the latch, at any angle.

   The barb protrudes in −y and the slot's shoulder is the material at −y, so
   disengaging pushes the tongue +y — i.e. INWARD from the outer wall, which is
   the one direction a release poke can reach an interior column from. `yEdge` is
   the station's outer edge; the caller passes the abacus's y=0 or y=outer_d wall
   and a sign, and the whole latch mirrors with it. */
module link_tongue_2d(ramp, bump) {
  y = link_beam_y0;
  union() {
    translate([link_beam_x0, y]) square([link_beam_l, link_beam_t]);
    // barb: cam face on the −x side (short and steep — that IS the mechanical
    // advantage), insertion lead-in on the +x side (long and shallow). As the
    // barb travels −y the face's x grows, so the spring draws the modules shut.
    polygon([[link_barb_x() - link_takeup(ramp, bump), y],
             [link_barb_x(),                          y - bump],
             [link_barb_x() + bump / tan(link_lead),  y]]);
  }
}

// The slot: a throat only as wide as the bare tongue, so the barb must deflect
// to pass it, then an opening past the shoulder where the barb springs home. The
// shoulder is cut on the same ramp as the barb's, so the two bear flat.
module link_slot_2d(ramp, bump, slot, relief) {
  y = link_beam_y0;
  union() {
    translate([relief - 0.1, y - 0.05])
      square([link_barb_x() - relief + 0.1, link_beam_t + slot]);
    polygon([[link_barb_x() - link_takeup(ramp, bump), y - 0.05],
             [link_barb_x(),                          y - bump - 0.15],
             [link_slot_end(),                        y - bump - 0.15],
             [link_slot_end(),                        y + link_beam_t + slot],
             [link_barb_x() - link_takeup(ramp, bump), y + link_beam_t + slot]]);
  }
}

/* The latch trio, each placed against a station's outer edge. `dir` is +1 when
   the station's outer wall is at low y (the front strip) and −1 when it is at
   high y (the back strip); `yEdge` is that wall's y. Mirroring both together is
   what keeps each station's release bore pointing at its OWN outer wall. */
// `mirror`, not `scale([1,-1,1])` — the same transform, but the one that says
// what it means, and the one the evaluator treats as a reflection rather than a
// degenerate-looking scale.
module link_at_station(yEdge, dir)
  translate([0, yEdge, 0])
    mirror([0, dir < 0 ? 1 : 0, 0])
      children();

module link_tongue(h, yEdge, dir, ramp, bump)
  link_at_station(yEdge, dir) linear_extrude(h) link_tongue_2d(ramp, bump);

module link_slot(h, yEdge, dir, ramp, bump, slot, relief)
  link_at_station(yEdge, dir) linear_extrude(h) link_slot_2d(ramp, bump, slot, relief);

// Release bore: from the outer wall inward, onto the tongue's TIP — past the
// barb, so it opens into slot void instead of into the shoulder. Poke with a
// pencil, a paperclip, or the AbacusLink key, and the tongue lifts off its
// shoulder. One bore per station; a module is released by squeezing the front
// and back bores together.
module link_release_bore(h, yEdge, dir, bump)
  link_at_station(yEdge, dir)
    translate([link_bore_x(), -0.1, h / 2])
      rotate([-90, 0, 0])
        cylinder(h = link_beam_y0 + 0.5, d = link_release_d);

/* ===== the two faces ======================================================
   Composed so a consumer never has to remember which half goes where: a module
   UNIONs link_male_face onto its right wall and DIFFERENCEs link_female_face out
   of its left. `stations` is a list of [yEdge, dir, y0, y1] rows — the front
   strip, the reckoning bar, the back strip — so the same call covers all three
   and the bar (which gets a chevron but no latch, having no outer wall to be
   released from) is expressed by passing dir = 0. */
module link_male_face(h, stations, ramp, bump) {
  for (s = stations) {
    link_ridge(h, s[2], s[3]);
    if (s[1] != 0) link_tongue(h, s[0], s[1], ramp, bump);
  }
}

module link_female_face(h, stations, ramp, bump, slot, relief, fit) {
  for (s = stations) {
    link_groove(h, s[2], s[3], fit);
    if (s[1] != 0) {
      link_slot(h, s[0], s[1], ramp, bump, slot, relief);
      link_release_bore(h, s[0], s[1], bump);
    }
  }
}
