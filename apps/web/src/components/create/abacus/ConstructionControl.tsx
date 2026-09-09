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
// PRESENTATION. A full-width segmented control reads as a TAB BAR, and a tab
// bar claims everything beneath it — the first cut had the joint select, the
// description and even the next section's heading reading as "the Column
// modules tab". So the controls that exist only because modules were chosen
// live in an INSET SUB-PANEL (left accent rule, own surface) directly under
// the switch, bounded top and bottom, and nothing else follows inside it. The
// footprint rides the label row as a value readout, the same shape the size
// and columns sliders use, so it reads as a property of the current choice
// rather than a caption for the block below.
//
// The joint description is deliberately short: the studio's job here is to make
// the choice legible, not to teach the mechanism. Three sentences: how it goes
// together, how it holds, how it comes apart.

import type { CSSProperties } from 'react'
import { SegmentedControl } from '@/components/studio/SegmentedControl'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { useAbacusStudio } from './AbacusStudioContext'
import { isModular, type JointType, SLIDING_FIT_VALUES } from './abacus-model'
import { modularSizeDelta } from './ModularSeamPanel'

const mm = (v: number) => v.toFixed(1)

const NOTE: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  color: 'rgba(226,232,240,0.75)',
}

// the "these belong to the choice above" surface: an inset with a cyan rule on
// the left — the same cyan as the active segment — and a hairline around it so
// the block visibly ENDS before the next control
const SUBPANEL: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 2,
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.16)',
  borderLeft: '2px solid rgba(6,182,212,0.7)',
  background: 'rgba(255,255,255,0.03)',
}

export function ConstructionControl() {
  const { params, set } = useAbacusStudio()
  const on = isModular(params)
  const sliding = params.joint_type === 'sliding_dovetail'
  // Both sizes come from the ONE derived chain the geometry uses, evaluated at
  // each mode — a second copy of the arithmetic here is exactly how a readout
  // and the thing it describes drift apart.
  const delta = modularSizeDelta(params)
  const size = on ? delta.modular : delta.mono
  const wider = delta.modular[0] - delta.mono[0]

  return (
    <div
      data-element="abacus-construction"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {/* label row shaped like a slider's: name on the left, the live value on
          the right — here the footprint of whichever construction is chosen */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500 }}>construction</span>
        <span
          data-element="abacus-construction-size"
          style={{ fontSize: 11, color: 'rgba(243,244,246,1)', fontVariantNumeric: 'tabular-nums' }}
        >
          {mm(size[0])} × {mm(size[1])} mm
        </span>
      </div>
      <SegmentedControl
        options={[
          { value: 'mono', label: 'One piece' },
          { value: 'modular', label: 'Column modules' },
        ]}
        value={on ? 'modular' : 'mono'}
        onChange={(v) => set('seam_mode', v)}
        ariaLabel="construction"
        size="sm"
        dataElement="abacus-construction-mode"
        dataAction="set-construction-mode"
      />

      {on && (
        <div data-element="abacus-construction-details" style={SUBPANEL}>
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
                !SLIDING_FIT_VALUES.some((fitValue) => Math.abs(fitValue - params.joint_fit) < 1e-9)
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
              : 'Modules press straight down on vertical dovetails and the crossbar clip clicks at full depth. Any middle module lifts straight out.'}
          </div>

          {/* what the seams cost, as a delta against the one-piece footprint the
              readout showed a moment ago — both numbers from modularSizeDelta */}
          <div data-element="modular-seam-size-delta" style={NOTE}>
            <strong style={{ color: 'rgba(243,244,246,1)' }}>{mm(wider)} mm wider</strong> than one
            piece at {mm(delta.mono[0])} mm: every seam keeps a full wall on both sides, and every
            module carries its own feet, so any subset stands.
          </div>

          {/* the tuning and the coupon are a printer's problem, so they live in
              the print rail — say where, or the choice looks unfinished */}
          <div
            data-element="modular-print-pointer"
            style={{ fontSize: 10, lineHeight: 1.45, color: 'rgba(148,163,184,0.95)' }}
          >
            Fit tuning and the seam coupon are under Print options.
          </div>
        </div>
      )}
    </div>
  )
}
