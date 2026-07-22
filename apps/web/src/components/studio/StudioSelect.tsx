'use client'

// StudioSelect — a tiny labeled <select> for the dark studio rails (the app's
// debug panel has no select primitive). Extracted verbatim from the viewer's
// local Select so the design rail (scheme/palette/rails) and the fabrication rail
// (printer profile) share one control instead of forking it. Options are plain
// strings (value === label) or {value,label} pairs for id→label menus.

export interface StudioSelectProps {
  label: string
  value: string
  options: Array<string | { value: string; label: string }>
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
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 500 }}
    >
      {label}
      <select
        value={value}
        data-action={dataAction}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.08)',
          color: 'inherit',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4,
          padding: '4px 6px',
          fontSize: 12,
        }}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value} style={{ color: '#111' }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
