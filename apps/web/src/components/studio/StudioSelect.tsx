'use client'

// StudioSelect — a tiny labeled <select> for the dark studio rails (the app's
// debug panel has no select primitive). Extracted verbatim from the viewer's
// local Select so the design rail (scheme/palette/rails) and the fabrication rail
// (printer profile) share one control instead of forking it. Options are plain
// strings (value === label) or {value,label} pairs for id→label menus.
//
// Styled from theme.ts: label ABOVE the control in muted label-type, the select
// itself the shared `CONTROL` box at full width, so selects, text fields, colour
// wells and sliders all line up on the same left edge down a rail.
//
// An option may be `disabled` — kept visible on purpose. When a choice is real
// hardware the user might own but the current geometry can't seat (a 1/2"
// bumper on a stock-width brim), hiding it would read as "we don't support
// that"; greying it with the reason in its own label says "not at these
// settings", which is the true statement and names the fix. The option colours
// are the light-popup pair from the theme — every platform paints the native
// menu on white, whatever the rail behind it looks like.

import { CONTROL, STUDIO } from './theme'

export interface StudioSelectProps {
  label: string
  value: string
  options: Array<string | { value: string; label: string; disabled?: boolean }>
  onChange: (v: string) => void
  dataElement?: string
  dataAction?: string
}

export function StudioSelect({
  label,
  value,
  options,
  onChange,
  dataElement = 'studio-select',
  dataAction,
}: StudioSelectProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <label
      data-element={dataElement}
      style={{ display: 'flex', flexDirection: 'column', gap: STUDIO.space.field }}
    >
      <span style={STUDIO.type.label}>{label}</span>
      <select
        value={value}
        data-action={dataAction}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...CONTROL, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
      >
        {opts.map((o) => (
          <option
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            style={{
              color: o.disabled ? STUDIO.color.optionTextDisabled : STUDIO.color.optionText,
            }}
          >
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
