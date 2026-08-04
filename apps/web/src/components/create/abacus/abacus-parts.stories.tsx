import type { Meta, StoryObj } from '@storybook/react'
import { AbacusPartBench, type AbacusPartBenchProps } from './AbacusPartBench'
import type { Params } from './abacus-model'

/**
 * Every piece of the abacus, rendered alone from the real `abacus.scad` via the
 * real WASM worker (`only=<part>`) — see `AbacusPartBench`. Each story's
 * **Download STL** is directly sliceable, so a bead or a foot can go on a plate
 * by itself to check a fit without reprinting the whole frame.
 *
 * The `only=` vocabulary is two kinds of slice riding one mechanism:
 *  - **inspection parts** (`INSPECT_PARTS` — bead, its two halves, the channel
 *    cavity, the bare frame): not filament bodies, just one thing in isolation.
 *  - **export passes** (`ExportPass` — markers, feet, text plugs): each really
 *    IS one body in the 3MF, so these stories double as a look at exactly what
 *    the printer will be handed per extruder.
 *
 * Stories are deliberately at stock params. A part story is a baseline: it's the
 * geometry every design deviation is measured against, and pinning knobs here
 * would quietly make it a story about the knobs instead.
 */

const meta = {
  title: 'Create/Abacus/Parts',
  component: AbacusPartBench,
  parameters: { layout: 'fullscreen' }, // the bench fills the iframe; chrome overlays the 3D
} satisfies Meta<typeof AbacusPartBench>

export default meta
type Story = StoryObj<typeof meta>

/** One-line story factory, so each part below stays a single readable line. */
const part = (props: AbacusPartBenchProps): { args: AbacusPartBenchProps } => ({ args: props })

// ── the bead ────────────────────────────────────────────────────────────────
// The bead is TWO solids joined at the belt, and the split is load-bearing:
// everything up to base z 7 is CAPTURE geometry that rides in the track (its
// profile is a fit contract with the channel and must not drift), and everything
// above is the exposed cap, which is free to be shaped for looks. The frame's top
// face sits at base z 8, so the handover blend is hidden inside the chimney —
// which is why `Bead` and `BeadExposed` look like different objects.

/** The whole bead as it prints: capture body + exposed cap, one solid. */
export const Bead: Story = part({ pass: { only: 'bead' } })

/** The part that rides in the track — the fit contract with `Channel`. If this
 *  silhouette ever changes, every already-printed frame stops accepting the bead. */
export const BeadCapture: Story = part({ pass: { only: 'bead_capture' } })

/** The exposed cap alone: 1 mm of straight belt under a superellipse (n = 4)
 *  dome. Rendered from base z 7 up, so its lower band is the part the frame
 *  swallows — compare with `BeadExposed` for what's actually visible. */
export const BeadCap: Story = part({ pass: { only: 'bead_cap' } })

/** Only what clears the frame's top face — i.e. everything anyone ever SEES of a
 *  bead on a finished abacus. The one to judge the look on. */
export const BeadExposed: Story = part({ pass: { only: 'bead_exposed' } })

// ── frame + the negative space in it ────────────────────────────────────────

/** The bead's channel: the NEGATIVE, i.e. the cavity carved out of the frame —
 *  the bead grown by `clearance`, swept through one earth bead's travel, plus the
 *  chimney. This is the shape of the track, so it's what a fit question is asked
 *  of: put it beside `BeadCapture` and the clearance is the difference. */
export const Channel: Story = part({ pass: { only: 'channel' } })

/** The bare frame — no beads, no plugs, no feet. The slowest story here (it's
 *  most of the model), so it renders at a lower $fn; bump it to inspect a fillet. */
export const Frame: Story = part({ pass: { only: 'frame' }, fn: 32 })

// ── modular seam spike (Gitea #30) ──────────────────────────────────────────

/** The Phase-0 modular-seam coupon: a single-column mini-module with dovetail
 *  tabs on its right face, sockets in its left, and a snap clip in the bar
 *  strip. Print the STL TWICE and the copies click into a chain — then tune
 *  `joint_fit` until the seam has zero free play. */
export const SeamCoupon: Story = part({ pass: { only: 'seam_coupon' } })

/** Two coupons seated — the assembled seam for inspection. Faces meet at zero
 *  gap by design (the tabs carry `joint_fit`); the harness's disjointness
 *  proof is that this pass's volume is exactly 2× `SeamCoupon`'s. */
export const SeamCouponPair: Story = part({ pass: { only: 'seam_coupon_pair' } })

// ── module columns (Gitea #30): the pieces the modular kit prints ────────────
// Unlike the coupon these are the REAL deliverables: rim chamfers that run
// continuously across seams, per-module TPU feet (every module carries its own,
// so any module works at any position), and end modules that are the monolith's
// own border — outer_solid cut at the seam plane, corner feet and ArUco pockets
// included.

/** The left end module: monolith border + column 0, dovetail tabs on its seam
 *  face. Carries the two left corner feet and both left ArUco pockets (engraved
 *  only in Phase 1 — no plug passes yet). */
export const ModuleLeft: Story = part({ pass: { only: 'module_left' } })

/** An interior column module: sockets on the left face, tabs on the right, its
 *  own two TPU feet beside the socket. One geometry serves every interior
 *  position — only bead colors differ per column, and that's a 3MF-slotting
 *  concern, not a shape one. */
export const ModuleMid: Story = part({ pass: { only: 'module_mid' } })

/** The right end module: border + the ones column, sockets on its seam face,
 *  right corner feet and ArUco pockets. */
export const ModuleRight: Story = part({ pass: { only: 'module_right' } })

/** Two mid modules seated — the modular twin of `SeamCouponPair`, and the same
 *  harness contract: volume must be exactly 2× `ModuleMid`'s. */
export const ModulePair: Story = part({ pass: { only: 'module_pair' } })

/** The mid module's own TPU feet: the smaller module-foot class (≤6.35 mm),
 *  placed beside the seam socket on X, crossbars rotated to run along Y. */
export const ModuleMidFeet: Story = part({ pass: { only: 'module_mid_feet' } })

/** The left end module's feet — monolith corner-class feet at positions 0/3. */
export const ModuleLeftFeet: Story = part({ pass: { only: 'module_left_feet' } })

/** The right end module's feet — corner-class at positions 1/2. */
export const ModuleRightFeet: Story = part({ pass: { only: 'module_right_feet' } })

// ── export passes: one body per filament in the 3MF ─────────────────────────

/** The TPU feet (Gitea #23), printed in place: the print stands on these, with
 *  the frame's bottom face on supports. Bottom vantage shows the retention. */
export const Feet: Story = part({ pass: { only: 'feet' } })

/** The dark half of the four ArUco corner markers (Gitea #12) — the bit pattern
 *  the camera reads back off a finished print. */
export const MarkerBlack: Story = part({ pass: { only: 'marker_black' } })

/** The light half of the markers: the quiet zone and the unset cells. */
export const MarkerWhite: Story = part({ pass: { only: 'marker_white' } })

/** The inset text inlays for color group 0. The plug pass is the one define whose
 *  absence fails silently — without `-Dplug_group` the scad's −1 default emits
 *  EVERY token, so a broken group split ships N copies of the whole inlay rather
 *  than a partition. Stock params carry the two auto-placed teaching aids, so
 *  this renders the 10/5 markings. */
export const TextPlugs: Story = part({
  pass: { only: 'text_plugs', group: 0 },
  params: { text_mode: 'inset' } satisfies Partial<Params>,
})

// ── the whole thing ─────────────────────────────────────────────────────────

/** No `only=` at all: the full assembly the studio previews, for scale. Low $fn —
 *  this is the one render here that's genuinely expensive. */
export const WholeAbacus: Story = part({ fn: 24 })
