'use client'

// StudioColor — a labelled colour well for the dark studio rails (Gitea #43).
// Same props as the toy debug panel's `DebugColor`, styled from theme.ts.
//
// Two changes from the borrowed control. The label goes ABOVE, so a column of
// colours lines up with the selects and sliders beside them instead of being the
// one control whose label is inline. And the swatch + hex live together inside a
// CONTROL-shaped well that is itself the click target (the whole thing is one
// <label>), because a 22 px square is a small thing to ask someone to hit when
// the row it sits in is full-width anyway.

import { CONTROL, STUDIO } from './theme'

export interface StudioColorProps {
  label: string
  /** `#rrggbb` — a native color input accepts nothing else. */
  value: string
  onChange: (hex: string) => void
  dataElement?: string
  dataAction?: string
}

export function StudioColor({
  label,
  value,
  onChange,
  dataElement = 'debug-color',
  dataAction,
}: StudioColorProps) {
  return (
    <label
      data-component="studio-color"
      data-element={dataElement}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: STUDIO.space.field,
        cursor: 'pointer',
      }}
    >
      <span style={STUDIO.type.label}>{label}</span>
      <span
        style={{
          ...CONTROL,
          // a 22 px swatch on CONTROL's own 8 px padding would make this the one
          // 40 px control in a column of 32 px ones; trim the block padding so
          // the well still lands on the control height rule 6 asks for
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <input
          type="color"
          value={value}
          aria-label={label}
          data-action={dataAction}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 22,
            height: 22,
            padding: 0,
            border: `1px solid ${STUDIO.color.buttonBorder}`,
            borderRadius: STUDIO.radius.swatch,
            background: 'none',
            cursor: 'pointer',
          }}
        />
        <span style={STUDIO.type.value}>{value}</span>
      </span>
    </label>
  )
}
