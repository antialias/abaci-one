'use client'

// StudioChoice — a vertical list of radio options for the dark studio rails.
// Each option is a row: radio, title, one-line description. The SELECTED option
// may carry nested controls, rendered inside its own highlighted block, so the
// controls that exist only because of that choice are parented by it
// structurally — not by sitting somewhere underneath a switch.
//
// WHY NOT A SEGMENTED CONTROL. A full-width pill pair reads as a tab bar, and a
// tab bar claims everything beneath it: the first cut of the construction
// control had the joint select, its description and the NEXT section heading
// all reading as "the Column modules tab". A boxed sub-panel under the switch
// did not fix it — the accent sat on the left while the active segment sat on
// the right, and the box was a card in a rail that has none. An option list
// has no "beneath": the only things inside a row are that row's.
//
// The options are native radios sharing one `name`, so arrow keys move between
// them and the label text is the click target. The nested controls render
// OUTSIDE the <label> (a select inside a label would be activated by the
// label and is invalid nesting) but inside the option's block.

import { type CSSProperties, type ReactNode, useId } from 'react'

export interface StudioChoiceOption<V extends string> {
  value: V
  title: string
  description?: ReactNode
  /** Controls that exist only because this option is chosen. Rendered inside
   *  the option's block, only while it is selected. */
  children?: ReactNode
}

export interface StudioChoiceProps<V extends string> {
  label: string
  value: V
  options: ReadonlyArray<StudioChoiceOption<V>>
  onChange: (value: V) => void
  dataElement?: string
  dataAction?: string
}

const LABEL: CSSProperties = { fontSize: 11, fontWeight: 500 }

const OPTION: CSSProperties = {
  borderRadius: 8,
  border: '1px solid transparent',
  padding: '7px 10px 7px 8px',
}

const OPTION_SELECTED: CSSProperties = {
  ...OPTION,
  background: 'rgba(6,182,212,0.08)',
  border: '1px solid rgba(6,182,212,0.35)',
}

const ROW: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '14px 1fr',
  columnGap: 10,
  alignItems: 'start',
  cursor: 'pointer',
}

const RADIO: CSSProperties = {
  width: 14,
  height: 14,
  margin: '2px 0 0',
  accentColor: '#06b6d4',
  cursor: 'pointer',
}

const TITLE: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.3,
  color: 'rgba(243,244,246,1)',
}

const DESCRIPTION: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.45,
  color: 'rgba(148,163,184,0.95)',
}

// indented to the title's column, so the nested controls hang off the option
// the way the description does
const DETAILS: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 8,
  paddingLeft: 24,
}

export function StudioChoice<V extends string>({
  label,
  value,
  options,
  onChange,
  dataElement = 'studio-choice',
  dataAction = 'set-choice',
}: StudioChoiceProps<V>) {
  const name = useId()
  return (
    <div
      data-component="studio-choice"
      data-element={dataElement}
      role="radiogroup"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span style={{ ...LABEL, marginBottom: 2 }}>{label}</span>
      {options.map((o) => {
        const selected = o.value === value
        const descriptionId = `${name}-${o.value}-description`
        return (
          <div
            key={o.value}
            data-element={`${dataElement}-option`}
            data-value={o.value}
            data-selected={selected ? 'true' : undefined}
            style={selected ? OPTION_SELECTED : OPTION}
          >
            <label style={ROW}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                data-action={dataAction}
                aria-describedby={o.description != null ? descriptionId : undefined}
                style={RADIO}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={TITLE}>{o.title}</span>
                {o.description != null && (
                  <span id={descriptionId} style={DESCRIPTION}>
                    {o.description}
                  </span>
                )}
              </span>
            </label>
            {selected && o.children != null && (
              <div data-element={`${dataElement}-details`} style={DETAILS}>
                {o.children}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
