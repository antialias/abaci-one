'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { Z_INDEX } from '@/constants/zIndex'
import {
  PostcardsSection,
  CelebrationSongsSection,
  EuclidCreationsSection,
} from '@/components/my-stuff/PlayerStuffSections'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

interface PlayerStuffModalProps {
  open: boolean
  onClose: () => void
  playerId: string
  playerName: string
  playerEmoji?: string
}

/**
 * Mini "My Stuff" modal — a compact view of one player's postcards, celebration
 * songs, and Euclid creations, summonable from the per-player popover in
 * `PracticeSubNav`. Renders the same factored sections as the full
 * `/my-stuff/player/[playerId]` page (never fork, always factor).
 */
export function PlayerStuffModal({
  open,
  onClose,
  playerId,
  playerName,
  playerEmoji,
}: PlayerStuffModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-element="player-stuff-modal-overlay"
          className={css({
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: Z_INDEX.MODAL_BACKDROP,
            animation: 'fadeIn 0.15s ease',
          })}
        />

        <Dialog.Content
          data-component="player-stuff-modal"
          className={css({
            position: 'fixed',
            top: { base: 0, md: '50%' },
            left: { base: 0, md: '50%' },
            transform: { base: 'none', md: 'translate(-50%, -50%)' },
            width: { base: '100vw', md: '92vw' },
            maxWidth: { base: 'none', md: '720px' },
            height: { base: '100vh', md: 'auto' },
            maxHeight: { base: '100vh', md: '85vh' },
            backgroundColor: 'gray.50',
            borderRadius: { base: 0, md: '16px' },
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            zIndex: Z_INDEX.MODAL,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
          })}
        >
          {/* Header */}
          <div
            data-element="player-stuff-modal-header"
            className={hstack({
              gap: '12px',
              alignItems: 'center',
              p: '16px 20px',
              bg: 'white',
              borderBottom: '1px solid token(colors.gray.200)',
              flexShrink: 0,
            })}
          >
            <span
              className={css({
                fontSize: '28px',
                lineHeight: '1',
                w: '44px',
                h: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bg: 'gray.50',
                borderRadius: '50%',
                border: '1px solid token(colors.gray.200)',
                flexShrink: 0,
              })}
            >
              {playerEmoji ?? '🧒'}
            </span>
            <div className={vstack({ alignItems: 'flex-start', gap: '1px', flex: 1, minW: 0 })}>
              <Dialog.Title
                className={css({
                  fontSize: '18px',
                  fontWeight: '800',
                  color: 'gray.900',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxW: '100%',
                })}
              >
                {playerName}&apos;s Stuff
              </Dialog.Title>
              <Dialog.Description className={css({ fontSize: '12px', color: 'gray.500' })}>
                Songs, creations & postcards
              </Dialog.Description>
            </div>

            <Link
              href={`/my-stuff/player/${playerId}`}
              data-action="view-full-player-stuff"
              onClick={onClose}
              className={css({
                fontSize: '13px',
                fontWeight: '600',
                color: 'blue.600',
                textDecoration: 'none',
                px: '10px',
                py: '6px',
                borderRadius: '8px',
                flexShrink: 0,
                _hover: { bg: 'blue.50', textDecoration: 'underline' },
              })}
            >
              View full page →
            </Link>

            <Dialog.Close asChild>
              <button
                type="button"
                data-action="close-player-stuff-modal"
                aria-label="Close"
                className={css({
                  w: '32px',
                  h: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  bg: 'transparent',
                  color: 'gray.500',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  _hover: { bg: 'gray.100', color: 'gray.800' },
                })}
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <div
            data-element="player-stuff-modal-body"
            className={vstack({
              alignItems: 'stretch',
              gap: '32px',
              p: '20px',
              overflow: 'auto',
              flex: 1,
              minH: 0,
            })}
          >
            <PostcardsSection playerId={playerId} />
            <CelebrationSongsSection playerId={playerId} />
            <EuclidCreationsSection playerId={playerId} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
