'use client'

// StudioTextInput — a tiny labeled text field for the dark studio rails. The kit
// had Disclosure, SegmentedControl and StudioSelect but no input at all, which
// is why nothing in the studio could WRITE anything: the abacus has eight
// engravable slots (Gitea #28) and until now a user could only pick from two
// canned presets. Styled off the inline rename field in MyDesignsList, the only
// working text input in the studio, so the two read as the same control.
//
// `disabled` keeps the field VISIBLE with `disabledReason` standing in for the
// value — the same house rule StudioSelect's greyed options follow. A slot held
// by a teaching aid is not a slot we don't support; hiding it would say that,
// while "showing Friends of 10" says what is true and names what to move.

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
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <span style={{ flex: '0 0 4.5em', color: 'rgba(203,213,225,0.9)' }}>{label}</span>
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
          flex: 1,
          minWidth: 0,
          padding: '2px 5px',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.15)',
          background: disabled ? 'transparent' : 'rgba(255,255,255,0.08)',
          color: 'inherit',
          fontSize: 12,
          fontStyle: disabled ? 'italic' : 'normal',
        }}
      />
    </label>
  )
}
