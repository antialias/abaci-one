'use client'

// DesignShareToggle (Gitea #24) — who may open the saved design link.
//
// Deliberately NOT a third verb. The rail already has "make this {player}'s
// abacus" (about a PERSON) and "🔗 Copy design link" (about an ADDRESS); a
// "Share" button would compete with both. Sharing is a PROPERTY of the link,
// so it renders as a two-segment readout under the chip — grammatically it
// can't be mistaken for another save.
//
// One click each way, and the control is its own undo: because sharing is a
// flag on the design row rather than a minted code, turning it back on revives
// the very same URL. That is why there's no confirm modal and no separate Undo
// affordance. Hidden entirely unless the viewer owns a currently-saved design.

import { useAbacusStudio } from './AbacusStudioContext'

const SEGMENT = {
  padding: '3px 8px',
  borderRadius: 5,
  fontSize: 11,
  background: 'transparent',
} as const

export function DesignShareToggle() {
  const { designShared, canShareDesign, setDesignShared, designSharePending, designShareFailed } =
    useAbacusStudio()

  // Also covers `undefined` from a partial context — the control simply isn't
  // there for anyone who has nothing saved, or whose saved link isn't theirs.
  if (!canShareDesign) return null

  const segmentStyle = (active: boolean) => ({
    ...SEGMENT,
    border: active ? '1px solid rgba(6,182,212,0.6)' : '1px solid rgba(148,163,184,0.5)',
    background: active ? 'rgba(6,182,212,0.15)' : 'transparent',
    color: active ? 'rgba(165,243,252,1)' : 'rgba(226,232,240,1)',
    cursor: designSharePending ? 'default' : 'pointer',
    opacity: designSharePending ? 0.55 : 1,
  })

  return (
    <div
      data-element="abacus-design-share"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'rgba(148,163,184,0.95)',
        }}
      >
        Who can open it
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-action="set-design-private"
          onClick={() => setDesignShared(false)}
          disabled={designSharePending}
          title="Only your account can open this link."
          style={segmentStyle(!designShared)}
        >
          🔒 Only me
        </button>
        <button
          type="button"
          data-action="set-design-shared"
          onClick={() => setDesignShared(true)}
          disabled={designSharePending}
          title="Anyone with this link can open and copy this design — including any name engraved on it. You can turn this off again, but you can't un-copy a link someone already took."
          style={segmentStyle(designShared)}
        >
          🔗 Anyone with the link
        </button>
      </div>
      {designShareFailed && (
        <span
          data-element="abacus-design-share-error"
          style={{ fontSize: 11, color: 'rgba(252,165,165,0.95)' }}
        >
          Couldn&apos;t change who can open this — try again.
        </span>
      )}
    </div>
  )
}
