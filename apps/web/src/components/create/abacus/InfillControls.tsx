'use client'

// InfillControls — the infill block (abacus-infill.ts), in the PRINT rail's
// "Print options" section.
//
// WHY THE PRINT RAIL. Infill is not visible in the design and does not exist on
// the paper lane: it is purely how the same object gets made — how stiff it is,
// how the beads weigh and click, how long the plate takes. It rode in the design
// rail beside the feet for a while, which put a slicer question in front of
// people printing stickers.
//
// Linked is the default because "make it sturdier" is one thought, not two. The
// split exists for the one combination worth asking for — heavy beads on a light
// frame — so the second select stays out of the way until it's asked for.

import { StudioSelect } from '@/components/studio/StudioSelect'
import { DebugCheckbox } from '@/components/toys/ToyDebugPanel'
import { useAbacusStudio } from './AbacusStudioContext'
import { INFILL_OPTIONS, type InfillLevel, infillOption } from './abacus-infill'

const NOTE = {
  fontSize: 11,
  lineHeight: 1.5,
  color: 'rgba(226,232,240,0.75)',
} as const

export function InfillControls() {
  const { params, set } = useAbacusStudio()
  return (
    <>
      <StudioSelect
        label={params.infill_linked ? 'infill' : 'infill — frame'}
        value={params.infill_frame}
        options={INFILL_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        onChange={(v) => {
          set('infill_frame', v as InfillLevel)
          // While linked the beads follow the frame in the STORED value too, so
          // "set beads separately" starts the beads where the frame is and the
          // checkbox on its own never changes the print. (`set` is a functional
          // update, so the two writes compose.)
          if (params.infill_linked) set('infill_beads', v as InfillLevel)
        }}
        dataElement="abacus-infill-frame"
        dataAction="set-infill-frame"
      />
      <div data-component="InfillControls" data-element="abacus-infill-frame-note" style={NOTE}>
        {infillOption(params.infill_frame).frame}{' '}
        {params.infill_linked ? `${infillOption(params.infill_frame).beads} ` : ''}
        {infillOption(params.infill_frame).time}
      </div>
      <div data-element="abacus-infill-link">
        <DebugCheckbox
          label="Set beads separately"
          checked={!params.infill_linked}
          onChange={(separate) => set('infill_linked', !separate)}
        />
      </div>
      {!params.infill_linked && (
        <>
          <StudioSelect
            label="infill — beads"
            value={params.infill_beads}
            options={INFILL_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
            onChange={(v) => set('infill_beads', v as InfillLevel)}
            dataElement="abacus-infill-beads"
            dataAction="set-infill-beads"
          />
          <div data-component="InfillControls" data-element="abacus-infill-beads-note" style={NOTE}>
            {infillOption(params.infill_beads).beads}
          </div>
          {/* Bodies are per FILAMENT slot, so a scheme that paints the beads in
              the frame's spool leaves one body to carry one density — and the
              frame's wins. Only monochrome makes that certain, so only
              monochrome gets told. */}
          {params.color_scheme === 'monochrome' && (
            <div
              data-component="InfillControls"
              data-element="abacus-infill-monochrome-note"
              style={{ fontSize: 11, lineHeight: 1.5, color: '#b45309' }}
            >
              In the monochrome scheme the beads print in the frame&apos;s filament, so they take
              the frame&apos;s infill.
            </div>
          )}
        </>
      )}
      {params.feet_mode === 'printed' && (
        <div
          data-component="InfillControls"
          data-element="abacus-infill-feet-note"
          style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(148,163,184,0.95)' }}
        >
          Feet always print solid.
        </div>
      )}
    </>
  )
}
