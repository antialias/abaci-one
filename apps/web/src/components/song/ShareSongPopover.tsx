'use client'

/**
 * Owner control to create / copy / revoke permanent public links to a song.
 *
 * Adapted from `classroom/SessionShareButton` (Radix Popover + CopyButton +
 * AbacusQRCode) but: no expiry, per-share visibility toggles (stats opt-in,
 * default all off), and React Query via `useSongShares` instead of raw fetch.
 *
 * Editing an existing share's toggles (PATCH) lands in Phase 2.
 */

import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { useSongShares } from '@/hooks/useSongShares'
import type { SongShareVisibility } from '@/db/schema/song-shares'
import { AbacusQRCode } from '../common/AbacusQRCode'
import { CopyButton } from '../common/CopyButton'
import { css } from '../../../styled-system/css'

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

export function ShareSongPopover({
  songId,
  songTitle,
}: {
  songId: string
  songTitle: string | null
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SongShareVisibility>(ALL_OFF)
  const { shares, isLoading, createShare, revokeShare } = useSongShares(songId, open)

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

      <Popover.Portal>
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
            maxHeight: 'calc(100vh - 100px)',
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
                  bg: draft[key] ? 'purple.50' : 'gray.50',
                  border: '1px solid',
                  borderColor: draft[key] ? 'purple.200' : 'gray.200',
                  borderRadius: '8px',
                  px: '10px',
                  py: '8px',
                })}
              >
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>

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
                {shares.map((share) => {
                  const onKeys = TOGGLES.filter((t) => share.visibility[t.key]).map((t) => t.label)
                  return (
                    <div
                      key={share.id}
                      data-element="active-song-share"
                      className={css({
                        display: 'flex',
                        gap: '12px',
                        bg: 'gray.50',
                        border: '1px solid token(colors.gray.200)',
                        borderRadius: '10px',
                        p: '10px',
                      })}
                    >
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
                          disabled={revokeShare.isPending}
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
                          Revoke
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
