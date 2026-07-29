'use client'

// DesignLinkChip (Gitea #25) — the studio-native front door to a persisted
// design: one click saves the current design (idempotent — the server dedups
// identical content per owner, and the controller short-circuits an unchanged
// re-copy with no POST at all) and copies its ?design= deep link. The page also
// rewrites the address bar to the same link, so what's copied === what's shown.
// Deliberately NOT called "save" — that verb belongs to the player-identity
// save ("make this {player}'s abacus"), which is about a PERSON. Who may open
// the link is a separate axis, rendered under the chip by DesignShareToggle
// (#24) as a property of the link rather than a third competing verb.
//
// Feedback is an in-place label swap (useClipboard's copied window), never a
// floating toast — HUD overlays are reserved for the scene.

import { useState } from 'react'
import { useClipboard } from '@/hooks/useClipboard'
import { useAbacusStudio } from './AbacusStudioContext'
import { DesignShareToggle } from './DesignShareToggle'
import { studioHref } from './studio-url'

export interface DesignLinkChipProps {
  /** ?player= value the copied link should keep selecting (pre-fallback) */
  selectedPlayerId: string | null
  /** the save minted/re-used an id — the page mirrors it into the URL */
  onDesignSaved: (designId: string) => void
}

export function DesignLinkChip({ selectedPlayerId, onDesignSaved }: DesignLinkChipProps) {
  const {
    saveDesignSnapshot,
    designLinkPending,
    savedDesignId,
    designShared,
    designAccess,
    designLinkStale,
  } = useAbacusStudio()
  const { copied, copy } = useClipboard()
  // saveFailed and clipboardRefused are mutually exclusive outcomes of the last
  // click; both clear on the next attempt.
  const [saveFailed, setSaveFailed] = useState(false)
  const [clipboardRefused, setClipboardRefused] = useState(false)

  const onCopyLink = async () => {
    setSaveFailed(false)
    setClipboardRefused(false)
    const id = await saveDesignSnapshot()
    if (!id) {
      setSaveFailed(true)
      return
    }
    // URL first: the address bar is the honest fallback if the clipboard says no.
    onDesignSaved(id)
    const href = `${window.location.origin}${studioHref('/create/abacus', {
      playerId: selectedPlayerId,
      designId: id,
    })}`
    const ok = await copy(href)
    if (!ok) setClipboardRefused(true)
  }

  const label = designLinkPending
    ? 'Saving design…'
    : copied
      ? '✓ Link copied'
      : '🔗 Copy design link'

  // Four states, because the honest sentence differs in each. Only `manageable`
  // licenses a claim about who can open it; `not-yours` is the stranger reading
  // a shared design (necessarily shared — an unshared one would not have
  // loaded), where the useful thing to say is how to make a copy of your own;
  // `unknown` (access failed, or a partial context) claims nothing at all.
  const access = designAccess ?? 'unknown'
  const title = !savedDesignId
    ? 'Saves this exact design and copies a link that reopens it. Only you can open it until you share it.'
    : access === 'manageable'
      ? designShared
        ? 'This design is saved and shared — anyone with the link can open it.'
        : 'This design is saved — copy its link. Only you can open it.'
      : access === 'not-yours'
        ? "Someone else's shared design — this link opens for anyone who has it. Change anything to start a copy of your own."
        : 'This design is saved — copy its link.'

  return (
    <div
      data-element="abacus-design-link"
      style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <button
        type="button"
        data-action="copy-design-link"
        onClick={onCopyLink}
        disabled={designLinkPending}
        title={title}
        style={{
          alignSelf: 'flex-start',
          padding: '3px 8px',
          borderRadius: 5,
          border: copied ? '1px solid rgba(134,239,172,0.6)' : '1px solid rgba(148,163,184,0.5)',
          background: 'transparent',
          color: copied ? 'rgba(134,239,172,0.95)' : 'rgba(226,232,240,1)',
          fontSize: 11,
          cursor: designLinkPending ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
      {saveFailed && (
        <span
          data-element="abacus-design-link-error"
          style={{ fontSize: 11, color: 'rgba(252,165,165,0.95)' }}
        >
          Couldn&apos;t save the design — try again.
        </span>
      )}
      {clipboardRefused && (
        <span
          data-element="abacus-design-link-note"
          style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
        >
          Design saved — its link is in the address bar.
        </span>
      )}
      {designLinkStale && (
        <span
          data-element="abacus-design-link-stale"
          style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
        >
          Edited — copy a new link to share this version.
        </span>
      )}
      {/* who may open the saved link (#24) — a property of the link, not a
          third save verb. Renders only for an owner with something saved. */}
      <DesignShareToggle />
    </div>
  )
}
