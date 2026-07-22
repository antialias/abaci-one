'use client'

// SegmentedControl — the studio's dark, cyan-active pill toggle (Gitea epic #5,
// full-bleed CP1a). Factored from the viewer's hand-rolled "My colors / Print
// preview" lens so the same primitive drives the fabrication-target chooser (the
// old fork), the preview lens, and — later — the start-policy toggle. Inline
// styles keep it self-contained inside the dark studio; CP5 promotes the cyan to
// a Panda token.

const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** optional leading glyph (emoji/icon char) */
  icon?: string
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  /** required — the group needs an accessible name */
  ariaLabel: string
  /** data-element on the group wrapper */
  dataElement?: string
  /** data-action stamped on each segment button */
  dataAction?: string
  /** compact (preview lens) vs larger (target chooser) */
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  dataElement = 'segmented-control',
  dataAction = 'segmented-select',
  size = 'sm',
}: SegmentedControlProps<T>) {
  const pad = size === 'md' ? '9px 10px' : '6px 8px'
  const fontSize = size === 'md' ? 12 : 11
  return (
    <div
      data-component="segmented-control"
      data-element={dataElement}
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        borderRadius: 7,
        overflow: 'hidden',
        border: '1px solid rgba(148,163,184,0.35)',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            data-action={dataAction}
            data-value={opt.value}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: pad,
              border: 'none',
              background: active ? CYAN_GRADIENT : 'transparent',
              color: active ? '#fff' : 'rgba(203,213,225,0.9)',
              fontSize,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {opt.icon && <span aria-hidden="true">{opt.icon}</span>}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
