'use client'

// StudioCheckbox — the studio's on/off box (Gitea #43). Same props as the toy
// debug panel's `DebugCheckbox` (which the rails borrowed, indigo and all), plus
// an optional `description`, styled from theme.ts.
//
// The label is label-type but in `text2`, not `muted`: a checkbox's text is the
// CHOICE, not a caption for something else, so it reads a step brighter than the
// labels that sit above selects and sliders. The description, when there is one,
// is note-type under the row and indented to the label's column, and it is tied
// to the input with `aria-describedby` rather than being swept into the
// accessible name — a screen reader should hear "Slow first layer, checkbox",
// then the reason, not one run-on sentence.

import { type ReactNode, useId } from 'react'
import { STUDIO } from './theme'

export interface StudioCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  dataElement?: string
  dataAction?: string
  disabled?: boolean
  /** one-line reason under the row */
  description?: ReactNode
}

export function StudioCheckbox({
  label,
  checked,
  onChange,
  dataElement = 'debug-checkbox',
  dataAction,
  disabled = false,
  description,
}: StudioCheckboxProps) {
  const descriptionId = useId()
  return (
    <div
      data-component="studio-checkbox"
      data-element={dataElement}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          data-action={dataAction}
          aria-describedby={description != null ? descriptionId : undefined}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            accentColor: STUDIO.color.accent,
            width: 14,
            height: 14,
            cursor: disabled ? 'default' : 'pointer',
          }}
        />
        <span style={{ ...STUDIO.type.label, color: STUDIO.color.text2 }}>{label}</span>
      </label>
      {description != null && (
        <span id={descriptionId} style={{ ...STUDIO.type.note, paddingLeft: 22 }}>
          {description}
        </span>
      )}
    </div>
  )
}
