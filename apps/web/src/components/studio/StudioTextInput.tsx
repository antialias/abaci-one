'use client'

// StudioTextInput — a tiny labeled text field for the dark studio rails. The kit
// had Disclosure, SegmentedControl and StudioSelect but no input at all, which
// is why nothing in the studio could WRITE anything: the abacus has eight
// engravable slots (Gitea #28) and until now a user could only pick from two
// canned presets.
//
// Styled from theme.ts, and column-shaped like every other control: the label
// sits above in muted label-type and the input is the shared `CONTROL` box at
// full width. The old beside-the-label layout capped the field at whatever was
// left of 4.5em of label, which on the engraving slots meant a text input you
// could not read your own text in.
//
// `disabled` keeps the field VISIBLE with `disabledReason` standing in for the
// value — the same house rule StudioSelect's greyed options follow. A slot held
// by a teaching aid is not a slot we don't support; hiding it would say that,
// while "showing Friends of 10" says what is true and names what to move.

import { CONTROL, STUDIO } from './theme'

export interface StudioTextInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  /** taken by something else — shows `disabledReason` in place of the value */
  disabled?: boolean
  disabledReason?: string
  dataElement?: string
  dataAction?: string
}

export function StudioTextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 64,
  disabled = false,
  disabledReason,
  dataElement = 'studio-text-input',
  dataAction,
}: StudioTextInputProps) {
  return (
    <label
      data-element={dataElement}
      data-disabled={disabled || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: STUDIO.space.field,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <span style={STUDIO.type.label}>{label}</span>
      <input
        type="text"
        value={disabled ? '' : value}
        placeholder={disabled ? disabledReason : placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={label}
        data-action={dataAction}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...CONTROL,
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          background: disabled ? 'transparent' : CONTROL.background,
          fontStyle: disabled ? 'italic' : 'normal',
        }}
      />
    </label>
  )
}
