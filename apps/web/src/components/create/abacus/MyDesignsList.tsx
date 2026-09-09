'use client'

// MyDesignsList (Gitea #11) — "my abacuses": everything you've saved or printed,
// what you call it, and the two things you can do to it.
//
// Grown out of #24's shared-design ledger, which existed to keep one promise:
// the share toggle can only speak for the design on screen, so share a design,
// edit it, copy a new link, and the first one was still public with no control
// anywhere addressing it — the address bar had been rewritten in place, so even
// Back wouldn't take you there. That promise now lives inside a wider list, and
// it survives because the route lists a shared design even when it's hidden.
//
// Removing is a HIDE, never a delete: design rows are permanent so a ?design=
// link printed on a THH job card keeps resolving. So the honest verb is about
// the list, not the design — and it comes with an undo rather than a confirm.
//
// Unobtrusive by construction: nothing at all until you have saved something,
// then a collapsed disclosure whose LABEL still carries the shared count, so
// revocation stays discoverable without the panel being open.

import Link from 'next/link'
import { type CSSProperties, useRef, useState } from 'react'
import { Disclosure } from '@/components/studio/Disclosure'
import { button, CARD, CONTROL, STUDIO } from '@/components/studio/theme'
import { useMyDesigns } from '@/hooks/useMyDesigns'
import { DESIGN_NAME_MAX } from '@/lib/abacus/design-name'
import { studioHref } from './studio-url'

export interface MyDesignsListProps {
  /** the design currently on screen (its saved id), marked in the list so a
   *  row of similar names is still answerable */
  currentDesignId?: string | null
}

/** What to call a design. A name if it has one; otherwise the engraving, then
 *  the shape — an unparseable envelope still has to be listed (and un-shared),
 *  so the last fallback has to work with nothing at all. */
function describe(name: string | null, label: string | null, cols: number | null): string {
  if (name) return name
  if (label) return `“${label}”`
  if (cols) return `${cols}-column abacus`
  return 'Saved design'
}

const dated = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** A design row: the job-row card — a card's surface at a row's height. */
const ROW: CSSProperties = {
  ...CARD,
  padding: '8px 10px',
  borderRadius: STUDIO.radius.button,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
}

/** The row's own buttons: a chip, tightened so three of them fit a rail row. */
const ROW_BTN: CSSProperties = { ...button('chip'), padding: '2px 8px' }

export function MyDesignsList({ currentDesignId = null }: MyDesignsListProps) {
  const {
    designs,
    truncated,
    sharedCount,
    unshare,
    unsharingId,
    unshareFailed,
    rename,
    renameFailed,
    remove,
    removingId,
    removeFailed,
    undoable,
    undoRemove,
  } = useMyDesigns()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  // Escape has to beat the blur that follows it — the flag makes the order
  // explicit instead of depending on which event React delivers first.
  const cancelled = useRef(false)

  // Keep rendering while an undo offer stands: removing your LAST design would
  // otherwise unmount the offer along with the list, which is the one moment
  // you most need it.
  if (designs.length === 0 && !undoable) return null

  const startRename = (id: string, name: string | null) => {
    cancelled.current = false
    setDraft(name ?? '')
    setEditingId(id)
  }

  const commitRename = (id: string, current: string | null) => {
    setEditingId(null)
    if (cancelled.current) {
      cancelled.current = false
      return
    }
    const trimmed = draft.trim()
    const next = trimmed.length > 0 ? trimmed : null
    if (next !== current) rename(id, next)
  }

  const errorText = removeFailed
    ? "Couldn't remove that one — try again."
    : unshareFailed
      ? "Couldn't un-share that one — try again."
      : renameFailed
        ? "Couldn't rename that one — try again."
        : null

  const label = `My abacuses (${designs.length})${sharedCount > 0 ? ` · ${sharedCount} shared` : ''}`

  return (
    <Disclosure label={label} dataElement="abacus-my-designs" dataAction="toggle-my-designs">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: -6 }}>
        {designs.map((design) => {
          const busy = unsharingId === design.id || removingId === design.id
          const shared = design.sharedAt !== null
          return (
            <div
              key={design.id}
              data-element="abacus-my-design-row"
              data-design-id={design.id}
              style={ROW}
            >
              {editingId === design.id ? (
                <input
                  data-element="abacus-design-name-input"
                  // biome-ignore lint/a11y/noAutofocus: the click that opens it IS the intent to type
                  autoFocus
                  value={draft}
                  maxLength={DESIGN_NAME_MAX}
                  aria-label="Design name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(design.id, design.name)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(design.id, design.name)
                    if (e.key === 'Escape') {
                      cancelled.current = true
                      setEditingId(null)
                    }
                  }}
                  style={{
                    ...CONTROL,
                    // a row-height field: the control box, tightened so renaming
                    // in place doesn't make the row jump
                    padding: '3px 6px',
                    fontSize: 11,
                    border: `1px solid ${STUDIO.color.accentBorder}`,
                    flex: 1,
                    minWidth: 0,
                  }}
                />
              ) : (
                <>
                  {/* a NEW TAB, deliberately: navigating in place would hydrate
                      this design over whatever you are working on and silently
                      discard unsaved edits, with Back unable to bring them
                      back. "Show me which one this is" must not cost you the
                      thing you're editing. */}
                  <Link
                    href={studioHref('/create/abacus', { playerId: null, designId: design.id })}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: STUDIO.color.accentText,
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title="Open this design in a new tab."
                  >
                    {describe(design.name, design.label, design.cols)}
                  </Link>
                  {design.id === currentDesignId && (
                    <span
                      data-element="abacus-my-design-open"
                      style={{ color: STUDIO.color.tone.ok.text }}
                    >
                      · open
                    </span>
                  )}
                  {shared && (
                    <span
                      data-element="abacus-my-design-shared"
                      title="Anyone with this link can open it."
                    >
                      🔗
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', color: STUDIO.color.muted2, fontSize: 10 }}>
                    {dated(design.createdAt)}
                  </span>
                  <button
                    type="button"
                    data-action="rename-design"
                    onClick={() => startRename(design.id, design.name)}
                    title="Rename this design. The link never changes."
                    style={ROW_BTN}
                  >
                    ✎
                  </button>
                  {/* one action per row, whichever one is meaningful: a public
                      design's question is "should it still be?", a private
                      one's is "do I still want to see it?" */}
                  {shared ? (
                    <button
                      type="button"
                      data-action="unshare-design"
                      onClick={() => unshare(design.id)}
                      disabled={busy}
                      title="Stop anyone with the link from opening this. You can share it again later — same link."
                      style={{ ...ROW_BTN, opacity: busy ? 0.55 : 1 }}
                    >
                      🔒 Un-share
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-action="remove-design"
                      onClick={() => remove(design)}
                      disabled={busy}
                      title="Take this out of your list. The design itself is kept, so any link you've already printed keeps working."
                      style={{ ...ROW_BTN, opacity: busy ? 0.55 : 1 }}
                    >
                      ✕ Remove
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
        {undoable && (
          <div
            data-element="abacus-my-designs-undo"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
          >
            <span style={{ color: STUDIO.color.muted }}>
              Removed {undoable.name ? `“${undoable.name}”` : 'that design'}
            </span>
            <button
              type="button"
              data-action="undo-remove-design"
              onClick={() => undoRemove(undoable.id)}
              style={{ ...ROW_BTN, borderColor: STUDIO.color.accentBorderStrong }}
            >
              Undo
            </button>
          </div>
        )}
        {truncated && <span style={STUDIO.type.note}>Showing your 50 most recent.</span>}
        {errorText && (
          <span
            data-element="abacus-my-designs-error"
            style={{ ...STUDIO.type.note, color: STUDIO.color.dangerInline }}
          >
            {errorText}
          </span>
        )}
      </div>
    </Disclosure>
  )
}
