// Abacus Studio — user-facing infill for the frame and the beads.
//
// WHY THIS IS A DESIGN KNOB AND NOT A PRINT SETTING. Infill is the one slicer
// number that changes how the finished abacus FEELS — a light frame flexes under
// a thumb, heavy beads click differently — so it belongs beside the geometry that
// decides the rest of the feel, not in the printer's settings sheet. It also has
// to survive the trip: THH's `--load-settings` replaces the project's global
// settings wholesale, so a plate-wide `sparse_infill_density` written into
// project_settings.config is gone by the time the job slices. Per-part config is
// the one channel that reaches a submitted print untouched (see `AssemblyBody.process`),
// so every body carries its own density and nothing can overwrite it.
//
// THE FEET ARE NOT HERE. Printed feet are always solid, for a mechanical reason
// rather than a taste one: Stage B's first layer lands on whatever infill the feet
// have, and a sparse foot is a sparse bed for the seam. That stays a constant
// (`FEET_PART_PROCESS` in abacus-3mf-assembly.ts) and is deliberately not exposed.
//
// THE SHARED-SLOT RULE. Bodies are per FILAMENT SLOT, not per role, and the plan's
// quantizer is free to land the frame and a bead role on the same slot (the
// monochrome scheme always does). A body can therefore only have one density, so
// the frame's wins: it is the structural part, and it is the one the user was
// thinking about when they moved the knob. The rail says so out loud when the
// scheme makes it certain.

import type { Params } from './abacus-model'

export type InfillLevel = 'light' | 'standard' | 'sturdy' | 'solid'

export interface InfillOption {
  id: InfillLevel
  label: string
  /** Orca `sparse_infill_density`, as a percentage number (serialized `"15%"`). */
  densityPct: number
  /** What this level does to the frame — the structural half. */
  frame: string
  /** What it does to the beads — weight and click. */
  beads: string
  /** What it costs in print time. */
  time: string
}

/** Ascending density. The rail renders this list in order, so it doubles as the menu. */
export const INFILL_OPTIONS: readonly InfillOption[] = [
  {
    id: 'light',
    label: 'Light',
    densityPct: 10,
    frame: 'Lightest frame. Fine on a desk; flexes a little under a hard press.',
    beads: 'Light beads with a quieter, tappier click.',
    time: 'Fastest print.',
  },
  {
    id: 'standard',
    label: 'Standard',
    densityPct: 15,
    frame: "The printer's usual density. Rigid enough for everyday use.",
    beads: 'Ordinary bead weight and click.',
    time: 'The baseline print time.',
  },
  {
    id: 'sturdy',
    label: 'Sturdy',
    densityPct: 30,
    frame: 'Noticeably stiffer; shrugs off drops and knocks.',
    beads: 'Heavier beads with a firmer, more satisfying click.',
    time: "Adds roughly a quarter to the frame's print time; beads are small and add little.",
  },
  {
    id: 'solid',
    label: 'Solid',
    densityPct: 100,
    frame: 'Heavy and as rigid as it gets; feels like one solid object.',
    beads: 'The heaviest beads: the fullest click and the most carry in a flick.',
    time: "Roughly doubles the frame's print time; beads still add little.",
  },
]

const BY_ID = Object.fromEntries(INFILL_OPTIONS.map((o) => [o.id, o])) as Record<
  InfillLevel,
  InfillOption
>

/** The option row for a level — the label/explanation lookup the rail and the
 *  print panel share, so neither restates the copy. */
export const infillOption = (level: InfillLevel): InfillOption => BY_ID[level]

/** The two densities a design actually prints at. `infill_linked` (the default)
 *  means the beads follow the frame and `infill_beads` is ignored here; the rail
 *  mirrors the frame into the stored bead value while linked, so a stale
 *  `infill_beads` can only come from a hand-edited snapshot — and even then it
 *  is inert until the user separates the two. */
export function resolveInfill(
  params: Pick<Params, 'infill_frame' | 'infill_beads' | 'infill_linked'>
): { frame: InfillLevel; beads: InfillLevel } {
  const frame = params.infill_frame
  return { frame, beads: params.infill_linked ? frame : params.infill_beads }
}

/** The per-part process keys a body at this level carries. Solid also pins the
 *  pattern, for the same reason `FEET_PART_PROCESS` does: at 100 % a gyroid is a
 *  slow way to draw a solid layer. */
export function infillPartProcess(level: InfillLevel): Readonly<Record<string, string>> {
  const density = `${infillOption(level).densityPct}%`
  return level === 'solid'
    ? { sparse_infill_density: density, sparse_infill_pattern: 'rectilinear' }
    : { sparse_infill_density: density }
}
