'use client'

// SharedDesignsList (Gitea #24) — everything of yours that is currently open to
// anyone with its link, and a one-click way to close each one.
//
// This exists because the share toggle can only speak for the design on screen.
// Share a design, edit it, copy a new link, and the first one is still public
// with no control anywhere addressing it — the address bar was rewritten in
// place, so even Back won't take you there. That is a revocation promise the
// toggle alone cannot keep.
//
// Unobtrusive by construction: no heading, no empty state, nothing at all until
// you have actually shared something. Each row opens the design (its ?design=
// link, the same one strangers hold) so "which one is this?" is answerable
// without leaving the studio.

import Link from 'next/link'
import { useSharedDesigns } from '@/hooks/useSharedDesigns'
import { studioHref } from './studio-url'

/** What the row calls a design that was never given a name. Falls back through
 *  engraved text → shape → nothing, because an unparseable envelope still has
 *  to be revocable (see the route: it is listed anyway, unlabelled). */
function describe(label: string | null, cols: number | null): string {
  if (label) return `“${label}”`
  if (cols) return `${cols}-column abacus`
  return 'Saved design'
}

export function SharedDesignsList() {
  const { designs, truncated, unshare, unsharingId, unshareFailed } = useSharedDesigns()

  if (designs.length === 0) return null

  return (
    <div
      data-element="abacus-shared-designs"
      style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}
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
        Shared by you ({designs.length})
      </span>
      {designs.map((design) => (
        <div
          key={design.id}
          data-element="abacus-shared-design-row"
          data-design-id={design.id}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          {/* a NEW TAB, deliberately: navigating in place would hydrate this
              design over whatever you are working on and silently discard
              unsaved edits, with Back unable to bring them back. "Show me what
              this one is" must not cost you the thing you're editing. */}
          <Link
            href={studioHref('/create/abacus', { playerId: null, designId: design.id })}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(165,243,252,1)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title="Open this design in a new tab — the same link anyone you shared it with holds."
          >
            {describe(design.label, design.cols)}
          </Link>
          <button
            type="button"
            data-action="unshare-design"
            onClick={() => unshare(design.id)}
            disabled={unsharingId === design.id}
            title="Stop anyone with the link from opening this. You can share it again later — same link."
            style={{
              marginLeft: 'auto',
              padding: '1px 6px',
              borderRadius: 5,
              border: '1px solid rgba(148,163,184,0.5)',
              background: 'transparent',
              color: 'rgba(226,232,240,1)',
              fontSize: 10,
              cursor: unsharingId === design.id ? 'default' : 'pointer',
              opacity: unsharingId === design.id ? 0.55 : 1,
            }}
          >
            🔒 Un-share
          </button>
        </div>
      ))}
      {truncated && (
        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.95)' }}>
          Showing the 50 most recently shared.
        </span>
      )}
      {unshareFailed && (
        <span
          data-element="abacus-shared-designs-error"
          style={{ fontSize: 11, color: 'rgba(252,165,165,0.95)' }}
        >
          Couldn&apos;t un-share that one — try again.
        </span>
      )}
    </div>
  )
}
