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

import { button, STUDIO } from '@/components/studio/theme'
import { useAbacusStudio } from './AbacusStudioContext'

export function DesignShareToggle() {
  const { designShared, canShareDesign, setDesignShared, designSharePending, designShareFailed } =
    useAbacusStudio()

  // Also covers `undefined` from a partial context — the control simply isn't
  // there for anyone who has nothing saved, or whose saved link isn't theirs.
  if (!canShareDesign) return null

  const segmentStyle = (active: boolean) => ({
    ...button('pill', { on: active, disabled: designSharePending }),
    cursor: designSharePending ? 'default' : 'pointer',
  })

  return (
    <div
      data-element="abacus-design-share"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <span style={STUDIO.type.eyebrow}>Who can open it</span>
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
          style={{ ...STUDIO.type.note, color: STUDIO.color.dangerInline }}
        >
          Couldn&apos;t change who can open this — try again.
        </span>
      )}
    </div>
  )
}
