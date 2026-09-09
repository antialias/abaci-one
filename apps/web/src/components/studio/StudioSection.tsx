'use client'

// StudioSection — an always-open labelled group for the dark studio rails
// (Gitea epic #5). The sibling of Disclosure, and the default: a rail that hides
// its content behind five closed disclosures makes the user click to find out
// what the studio can even do. Progressive disclosure is for the rare and the
// advanced (Writing, Advanced, Print settings); everything a print commits you
// to — shape, colors, feet, infill, the files — is a plain open section with a
// header in the SAME type as a Disclosure's, so the two read as one ladder and
// the open/closed distinction carries the only meaning it should: "you will
// probably want this" vs "ask for it".

import type { ReactNode } from 'react'

export interface StudioSectionProps {
  label: string
  children: ReactNode
  dataElement?: string
}

export function StudioSection({
  label,
  children,
  dataElement = 'studio-section',
}: StudioSectionProps) {
  return (
    <div
      data-component="studio-section"
      data-element={dataElement}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div
        style={{
          padding: '6px 2px',
          color: 'rgba(203,213,225,0.9)',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  )
}
