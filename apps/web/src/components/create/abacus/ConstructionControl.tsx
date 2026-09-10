'use client'

// ConstructionControl — one-piece vs column modules (Gitea #30), in the DESIGN
// rail's "Shape" section.
//
// WHY THE DESIGN RAIL. `seam_mode` is a geometry Param: it changes the
// footprint (a web per seam), it greys four engraving slots, and it decides
// whether the object in the hand comes apart. That is what the thing IS, not
// how it is made — so it belongs beside size and columns, above the fabrication
// question, and it is asked once whatever the output. What modular COSTS a
// printer — the joint-fit tuning, the seam coupon, the kit zip — stays in the
// print rail, where the rest of "how it's made" lives.
//
// PRESENTATION. An option list (StudioChoice), not a switch. Each option says
// what it is and what it measures BEFORE it is chosen, and the controls that
// only exist because modules were chosen — the joint, its three-sentence
// description, the pointer to the print rail — live inside the Column modules
// option itself. Nothing below the list can be mistaken for part of it.
//
// The joint description is deliberately short: the studio's job here is to make
// the choice legible, not to teach the mechanism. Three sentences: how it goes
// together, how it holds, how it comes apart.

import { StudioChoice } from '@/components/studio/StudioChoice'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { STUDIO } from '@/components/studio/theme'
import { useAbacusStudio } from './AbacusStudioContext'
import { isModular, type JointType, SLIDING_FIT_VALUES } from './abacus-model'
import { modularSizeDelta } from './ModularSeamPanel'

const mm = (v: number) => v.toFixed(1)

const NOTE = STUDIO.type.note

export function ConstructionControl() {
  const { params, set } = useAbacusStudio()
  const on = isModular(params)
  const sliding = params.joint_type === 'sliding_dovetail'
  // Both sizes come from the ONE derived chain the geometry uses, evaluated at
  // each mode — a second copy of the arithmetic here is exactly how a readout
  // and the thing it describes drift apart.
  const delta = modularSizeDelta(params)
  const wider = delta.modular[0] - delta.mono[0]

  return (
    <div data-element="abacus-construction">
      <StudioChoice
        label="construction"
        value={on ? 'modular' : 'mono'}
        onChange={(v) => set('seam_mode', v)}
        dataElement="abacus-construction-choice"
        dataAction="set-construction-mode"
        options={[
          {
            value: 'mono',
            title: 'One piece',
            description: `One solid frame, ${mm(delta.mono[0])} × ${mm(delta.mono[1])} mm.`,
          },
          {
            value: 'modular',
            title: 'Column modules',
            // the seam cost as a delta against the one-piece line just above —
            // every seam keeps a full wall on both sides, and every module
            // carries its own feet
            description: `Columns that join and come apart, each on its own feet — any subset stands. ${mm(wider)} mm wider, ${mm(delta.modular[0])} × ${mm(delta.modular[1])} mm.`,
            children: (
              <>
                <StudioSelect
                  label="joint"
                  value={params.joint_type}
                  options={[
                    { value: 'vertical_snap', label: 'Vertical dovetail with snap clip' },
                    { value: 'sliding_dovetail', label: 'Sliding dovetail, rear entry' },
                  ]}
                  onChange={(v) => {
                    const joint = v as JointType
                    set('joint_type', joint)
                    if (
                      joint === 'sliding_dovetail' &&
                      !SLIDING_FIT_VALUES.some(
                        (fitValue) => Math.abs(fitValue - params.joint_fit) < 1e-9
                      )
                    ) {
                      set('joint_fit', SLIDING_FIT_VALUES[0])
                    }
                  }}
                  dataElement="modular-joint-type"
                  dataAction="select-modular-joint-type"
                />
                <div data-element="modular-joint-explanation" style={NOTE}>
                  {sliding
                    ? 'Each module slides in from the back along a tapered dovetail rail and clicks into a notch at the front stop. The taper holds itself; a firm rearward tug releases it. No seam opens through the underside.'
                    : 'Tilt the module ~45°, hook the thin foot of its dovetail posts into the open pockets, then roll it upright — the posts wedge home as it straightens, and the crossbar clip clicks at full depth. Any middle module rolls in — or out — of an assembled row.'}
                </div>
                {/* the tuning and the coupon are a printer's problem, so they
                    live in the print rail — say where, or the choice looks
                    unfinished */}
                <div data-element="modular-print-pointer" style={NOTE}>
                  Tune the fit and print the seam coupon under Print options.
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  )
}
