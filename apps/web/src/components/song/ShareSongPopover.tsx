'use client'

/**
 * Owner control to create / copy / edit / revoke permanent public links to a
 * song.
 *
 * Adapted from `classroom/SessionShareButton` (Radix Popover + CopyButton +
 * AbacusQRCode) but: no expiry, per-share visibility toggles (stats opt-in,
 * default all off), and React Query via `useSongShares` instead of raw fetch.
 *
 * Each active link's toggles are editable in place (PATCH) — changing them
 * re-projects what `/song/[code]` reveals without minting a new link.
 */

import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { usePortalContainer } from '@/contexts/PortalContainerContext'
import type { SongShareVisibility } from '@/db/schema/song-shares'
import { type SongShareInfo, useSongShares } from '@/hooks/useSongShares'
import { css } from '../../../styled-system/css'
import { AbacusQRCode } from '../common/AbacusQRCode'
import { CopyButton } from '../common/CopyButton'

const TOGGLES: { key: keyof SongShareVisibility; label: string }[] = [
  { key: 'showAge', label: 'Age' },
  { key: 'showAccuracy', label: 'Accuracy & score' },
  { key: 'showProblemDetail', label: 'Problem detail' },
  { key: 'showStreakSkills', label: 'Streak & skills' },
]

const ALL_OFF: SongShareVisibility = {
  showAge: false,
  showAccuracy: false,
  showProblemDetail: false,
  showStreakSkills: false,
}

/** Shared toggle-grid presentation for both the new-link draft and edit rows. */
function ToggleGrid({
  value,
  onChange,
}: {
  value: SongShareVisibility
  onChange: (next: SongShareVisibility) => void
}) {
  return (
    <div
      className={css({
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      })}
    >
      {TOGGLES.map(({ key, label }) => (
        <label
          key={key}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: 'gray.700',
            cursor: 'pointer',
            bg: value[key] ? 'purple.50' : 'gray.50',
            border: '1px solid',
            borderColor: value[key] ? 'purple.200' : 'gray.200',
            borderRadius: '8px',
            px: '10px',
            py: '8px',
          })}
        >
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  )
}

/**
 * One active link: QR + copy + view count + an in-place editable toggle grid.
 * Holds the edited visibility locally; "Save" only appears once it differs
 * from what's persisted.
 */
function ShareRow({
  share,
  updateVisibility,
  revokeShare,
}: {
  share: SongShareInfo
  updateVisibility: ReturnType<typeof useSongShares>['updateVisibility']
  revokeShare: ReturnType<typeof useSongShares>['revokeShare']
}) {
  const [edit, setEdit] = useState<SongShareVisibility>(share.visibility)
  const dirty = TOGGLES.some(({ key }) => edit[key] !== share.visibility[key])
  const onKeys = TOGGLES.filter((t) => share.visibility[t.key]).map((t) => t.label)
  const savingThis = updateVisibility.isPending && updateVisibility.variables?.token === share.id
  const revokingThis = revokeShare.isPending && revokeShare.variables === share.id

  return (
    <div
      data-element="active-song-share"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        bg: 'gray.50',
        border: '1px solid token(colors.gray.200)',
        borderRadius: '10px',
        p: '10px',
      })}
    >
      <div className={css({ display: 'flex', gap: '12px' })}>
        <div
          className={css({
            bg: 'white',
            p: '6px',
            borderRadius: '8px',
            border: '1px solid token(colors.gray.200)',
            flexShrink: 0,
          })}
        >
          <AbacusQRCode value={share.url} size={84} />
        </div>
        <div
          className={css({
            flex: 1,
            minW: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          })}
        >
          <CopyButton
            text={share.url}
            label="🔗 Copy link"
            copiedLabel="Link copied!"
            variant="link"
          />
          <div className={css({ fontSize: '11px', color: 'gray.500' })}>
            👁 {share.views} view{share.views === 1 ? '' : 's'} ·{' '}
            {onKeys.length > 0 ? `shows ${onKeys.join(', ')}` : 'name + song only'}
          </div>
          <button
            type="button"
            data-action="revoke-song-share"
            disabled={revokingThis}
            onClick={() => revokeShare.mutate(share.id)}
            className={css({
              alignSelf: 'flex-start',
              px: '8px',
              py: '4px',
              bg: 'transparent',
              color: 'red.600',
              border: '1px solid token(colors.red.200)',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              _hover: { bg: 'red.50' },
              _disabled: { opacity: 0.6, cursor: 'not-allowed' },
            })}
          >
            {revokingThis ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      </div>

      {/* In-place visibility editing */}
      <div className={css({ borderTop: '1px dashed token(colors.gray.200)', pt: '10px' })}>
        <ToggleGrid value={edit} onChange={setEdit} />
        {dirty && (
          <div className={css({ display: 'flex', gap: '8px', mt: '8px' })}>
            <button
              type="button"
              data-action="save-song-share-visibility"
              disabled={savingThis}
              onClick={() => updateVisibility.mutate({ token: share.id, visibility: edit })}
              className={css({
                px: '12px',
                py: '6px',
                bg: 'purple.600',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                _hover: { bg: 'purple.700' },
                _disabled: { opacity: 0.6, cursor: 'not-allowed' },
              })}
            >
              {savingThis ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              data-action="reset-song-share-visibility"
              disabled={savingThis}
              onClick={() => setEdit(share.visibility)}
              className={css({
                px: '12px',
                py: '6px',
                bg: 'transparent',
                color: 'gray.600',
                border: '1px solid token(colors.gray.300)',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                _hover: { bg: 'gray.100' },
                _disabled: { opacity: 0.6, cursor: 'not-allowed' },
              })}
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ShareSongPopover({
  songId,
  songTitle,
}: {
  songId: string
  songTitle: string | null
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SongShareVisibility>(ALL_OFF)
  const { shares, isLoading, createShare, updateVisibility, revokeShare } = useSongShares(
    songId,
    open
  )
  // When rendered inside a modal, portal into the modal's subtree so the
  // popover shares its stacking/focus context instead of fighting its z-index.
  const portalContainer = usePortalContainer()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-action="share-song"
          className={css({
            px: '12px',
            py: '8px',
            bg: 'purple.100',
            color: 'purple.700',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            flexShrink: 0,
            _hover: { bg: 'purple.200' },
          })}
        >
          🔗 Share
        </button>
      </Popover.Trigger>

      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          data-component="share-song-popover"
          align="end"
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className={css({
            bg: 'white',
            borderRadius: '14px',
            p: '18px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
            border: '1px solid token(colors.gray.200)',
            width: 'min(440px, calc(100vw - 32px))',
            // Cap to the space Radix computes between the trigger and the
            // viewport edge (set via the Popper) and scroll internally, so
            // the popover never runs off-screen — works both standalone and
            // when portaled inside the My Stuff modal.
            maxHeight: 'var(--radix-popover-content-available-height)',
            overflowY: 'auto',
            zIndex: Z_INDEX.POPOVER,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          })}
        >
          <div>
            <h3 className={css({ fontSize: '15px', fontWeight: '700', color: 'gray.900', m: 0 })}>
              Share {songTitle ? `“${songTitle}”` : 'this song'}
            </h3>
            <p className={css({ fontSize: '12px', color: 'gray.500', mt: '4px' })}>
              Anyone with the link can view. By default it shows only the name, song, and lyrics —
              turn on extras below.
            </p>
          </div>

          {/* New-link visibility toggles */}
          <ToggleGrid value={draft} onChange={setDraft} />

          <button
            type="button"
            data-action="create-song-share"
            disabled={createShare.isPending}
            onClick={() => createShare.mutate(draft, { onSuccess: () => setDraft(ALL_OFF) })}
            className={css({
              px: '14px',
              py: '10px',
              bg: 'purple.600',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              _hover: { bg: 'purple.700' },
              _disabled: { opacity: 0.6, cursor: 'not-allowed' },
            })}
          >
            {createShare.isPending ? 'Creating…' : '+ Create link'}
          </button>

          {createShare.isError && (
            <p className={css({ fontSize: '12px', color: 'red.600' })}>
              {(createShare.error as Error)?.message ?? 'Could not create link'}
            </p>
          )}

          {/* Active links */}
          <div className={css({ borderTop: '1px solid token(colors.gray.100)', pt: '12px' })}>
            <div
              className={css({
                fontSize: '12px',
                fontWeight: '700',
                color: 'gray.600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                mb: '8px',
              })}
            >
              Active links
            </div>

            {isLoading ? (
              <p className={css({ fontSize: '13px', color: 'gray.400' })}>Loading…</p>
            ) : shares.length === 0 ? (
              <p className={css({ fontSize: '13px', color: 'gray.400' })}>No links yet.</p>
            ) : (
              <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
                {shares.map((share) => (
                  <ShareRow
                    key={share.id}
                    share={share}
                    updateVisibility={updateVisibility}
                    revokeShare={revokeShare}
                  />
                ))}
              </div>
            )}

            {updateVisibility.isError && (
              <p className={css({ fontSize: '12px', color: 'red.600', mt: '8px' })}>
                {(updateVisibility.error as Error)?.message ?? 'Could not update link'}
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
