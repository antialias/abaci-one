'use client'

import * as Popover from '@radix-ui/react-popover'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import type { UseShareCodeReturn } from '@/hooks/useShareCode'
import { css, cx } from '../../../styled-system/css'
import { AbacusQRCode } from './AbacusQRCode'

export interface ShareCodePanelProps {
  /** Share code state from useShareCode hook */
  shareCode: UseShareCodeReturn

  /** Panel title (e.g., "Share Access", "Invite Parents") */
  title?: string

  /** Panel subtitle/description */
  subtitle?: string

  /** Compact chip mode (inline) vs full panel mode */
  compact?: boolean

  /** Show QR code option (default: true) */
  showQR?: boolean

  /** Show link copy button (default: true) */
  showLink?: boolean

  /** Show regenerate button (default: true if regenerate is available) */
  showRegenerate?: boolean

  /** Show native share button when available (default: true) */
  showShare?: boolean

  /** Additional CSS class name */
  className?: string
}

/**
 * Unified share code panel for classroom, family, and room codes.
 *
 * Supports two modes:
 * - Full panel: Title, subtitle, QR with refresh overlay, code badge, compact action bar
 * - Compact chip: Inline button that opens a popover with QR and copy options
 */
export function ShareCodePanel({
  shareCode,
  title,
  subtitle,
  compact = false,
  showQR = true,
  showLink = true,
  showRegenerate = true,
  showShare = true,
  className,
}: ShareCodePanelProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (compact) {
    return (
      <CompactShareChip
        shareCode={shareCode}
        showQR={showQR}
        showLink={showLink}
        showShare={showShare}
        showRegenerate={showRegenerate}
        isDark={isDark}
        className={className}
      />
    )
  }

  return (
    <FullSharePanel
      shareCode={shareCode}
      title={title}
      subtitle={subtitle}
      showQR={showQR}
      showLink={showLink}
      showRegenerate={showRegenerate}
      showShare={showShare}
      isDark={isDark}
      className={className}
    />
  )
}

interface FullSharePanelProps extends Omit<ShareCodePanelProps, 'compact'> {
  isDark: boolean
}

function FullSharePanel({
  shareCode,
  title,
  subtitle,
  showQR,
  showLink,
  showRegenerate,
  showShare,
  isDark,
  className,
}: FullSharePanelProps) {
  const {
    code,
    shareUrl,
    copyCode,
    codeCopied,
    copyLink,
    linkCopied,
    canShare,
    share,
    shared,
    regenerate,
    isRegenerating,
  } = shareCode

  const canRegenerate = showRegenerate && regenerate
  const showShareHalf = !!(showShare && canShare)

  return (
    <div
      data-component="share-code-panel"
      className={cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '16px',
          bg: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        }),
        className
      )}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div data-element="share-panel-header">
          {title && (
            <h3
              className={css({
                fontSize: '18px',
                fontWeight: 'semibold',
                color: isDark ? 'gray.100' : 'gray.900',
                marginBottom: subtitle ? '4px' : '0',
              })}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className={css({
                fontSize: '14px',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* QR Code with regenerate overlay */}
      {showQR && (
        <QRWithOverlay
          shareUrl={shareUrl}
          size={150}
          canRegenerate={!!canRegenerate}
          isRegenerating={isRegenerating}
          onRegenerate={regenerate}
          isDark={isDark}
        />
      )}

      {/* Code display badge */}
      <CodeBadge
        code={code}
        copied={codeCopied}
        onCopy={copyCode}
        isDark={isDark}
      />

      {/* Action bar */}
      <ActionBar
        showLink={!!showLink}
        showShareHalf={showShareHalf}
        copyLink={copyLink}
        linkCopied={linkCopied}
        share={share}
        shared={shared}
        isDark={isDark}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// QR with regenerate overlay
// ---------------------------------------------------------------------------

function QRWithOverlay({
  shareUrl,
  size,
  canRegenerate,
  isRegenerating,
  onRegenerate,
  isDark,
}: {
  shareUrl: string
  size: number
  canRegenerate: boolean
  isRegenerating: boolean
  onRegenerate: (() => Promise<void>) | undefined
  isDark: boolean
}) {
  return (
    <div
      data-element="share-qr-code"
      className={css({
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        padding: '12px',
        bg: 'white',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: isDark ? 'gray.600' : 'gray.200',
      })}
    >
      <AbacusQRCode value={shareUrl} size={size} />

      {canRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          data-action="regenerate-code"
          aria-label="Regenerate code"
          className={css({
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            bg: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            cursor: isRegenerating ? 'wait' : 'pointer',
            transition: 'background 0.15s ease',
            _hover: {
              bg: isDark ? 'gray.700' : 'gray.100',
            },
          })}
        >
          <RefreshCw
            size={14}
            className={css({
              color: isDark ? 'gray.400' : 'gray.500',
              animation: isRegenerating ? 'spin 1s linear infinite' : 'none',
            })}
          />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Code badge with split copy button: [FAM-AB12 | Copy]
// ---------------------------------------------------------------------------

function CodeBadge({
  code,
  copied,
  onCopy,
  isDark,
}: {
  code: string
  copied: boolean
  onCopy: () => void
  isDark: boolean
}) {
  const borderColor = copied
    ? isDark
      ? 'green.700'
      : 'green.300'
    : isDark
      ? 'gray.600'
      : 'gray.300'

  return (
    <div
      data-element="code-badge"
      data-status={copied ? 'copied' : 'idle'}
      className={css({
        display: 'flex',
        borderRadius: '8px',
        borderWidth: '1px',
        borderStyle: copied ? 'solid' : 'dashed',
        borderColor,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        _hover: {
          borderStyle: 'solid',
        },
      })}
    >
      {/* Code display — tappable to copy */}
      <button
        type="button"
        onClick={onCopy}
        data-action="copy-code"
        className={css({
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 16px',
          bg: copied
            ? isDark
              ? 'green.900/60'
              : 'green.50'
            : isDark
              ? 'gray.900'
              : 'gray.50',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          _hover: {
            bg: copied
              ? isDark
                ? 'green.800/60'
                : 'green.100'
              : isDark
                ? 'gray.800'
                : 'gray.100',
          },
        })}
      >
        <span
          className={css({
            fontSize: '15px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            color: copied
              ? isDark
                ? 'green.300'
                : 'green.700'
              : isDark
                ? 'gray.200'
                : 'gray.700',
          })}
        >
          {copied ? '✓ Copied!' : code}
        </span>
      </button>

      {/* Copy button half */}
      <button
        type="button"
        onClick={onCopy}
        data-action="copy-code-text"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          bg: copied
            ? isDark
              ? 'green.900/60'
              : 'green.50'
            : isDark
              ? 'gray.900'
              : 'gray.50',
          border: 'none',
          borderLeftWidth: '1px',
          borderLeftStyle: copied ? 'solid' : 'dashed',
          borderLeftColor: borderColor,
          cursor: 'pointer',
          fontSize: '13px',
          color: copied
            ? isDark
              ? 'green.300'
              : 'green.600'
            : isDark
              ? 'gray.400'
              : 'gray.500',
          transition: 'all 0.15s ease',
          _hover: {
            bg: copied
              ? isDark
                ? 'green.800/60'
                : 'green.100'
              : isDark
                ? 'gray.800'
                : 'gray.100',
            color: copied
              ? isDark
                ? 'green.300'
                : 'green.600'
              : isDark
                ? 'gray.300'
                : 'gray.600',
          },
        })}
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action bar: [Copy link | ↗ Share]
// ---------------------------------------------------------------------------

function ActionBar({
  showLink,
  showShareHalf,
  copyLink,
  linkCopied,
  share,
  shared,
  isDark,
}: {
  showLink: boolean
  showShareHalf: boolean
  copyLink: () => void
  linkCopied: boolean
  share: () => Promise<void>
  shared: boolean
  isDark: boolean
}) {
  if (!showLink) return null

  return (
    <SplitCopyLinkButton
      showShareHalf={showShareHalf}
      copyLink={copyLink}
      linkCopied={linkCopied}
      share={share}
      shared={shared}
      isDark={isDark}
    />
  )
}

// ---------------------------------------------------------------------------
// Split button: [🔗 Copy link | ↗]
// ---------------------------------------------------------------------------

function SplitCopyLinkButton({
  showShareHalf,
  copyLink,
  linkCopied,
  share,
  shared,
  isDark,
}: {
  showShareHalf: boolean
  copyLink: () => void
  linkCopied: boolean
  share: () => Promise<void>
  shared: boolean
  isDark: boolean
}) {
  const borderColor = isDark ? 'blue.700' : 'blue.200'

  return (
    <div
      data-element="split-copy-link"
      className={css({
        display: 'flex',
        borderRadius: '8px',
        border: '1px solid',
        borderColor,
        overflow: 'hidden',
      })}
    >
      {/* Left half: Copy link */}
      <button
        type="button"
        onClick={copyLink}
        data-action="copy-link"
        data-status={linkCopied ? 'copied' : 'idle'}
        className={css({
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          padding: '8px 12px',
          bg: linkCopied
            ? isDark
              ? 'green.900/60'
              : 'green.50'
            : isDark
              ? 'blue.900/40'
              : 'blue.50',
          border: 'none',
          borderRightWidth: showShareHalf ? '1px' : '0',
          borderRightStyle: 'solid',
          borderRightColor: borderColor,
          cursor: 'pointer',
          fontSize: '13px',
          color: linkCopied
            ? isDark
              ? 'green.300'
              : 'green.600'
            : isDark
              ? 'blue.300'
              : 'blue.700',
          transition: 'all 0.15s ease',
          _hover: {
            bg: linkCopied
              ? isDark
                ? 'green.800/60'
                : 'green.100'
              : isDark
                ? 'blue.800/40'
                : 'blue.100',
          },
        })}
      >
        {linkCopied ? '✓ Copied!' : '🔗 Copy link'}
      </button>

      {/* Right half: Native share */}
      {showShareHalf && (
        <button
          type="button"
          onClick={share}
          data-action="native-share"
          data-status={shared ? 'shared' : 'idle'}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            bg: shared
              ? isDark
                ? 'green.900/60'
                : 'green.50'
              : isDark
                ? 'blue.900/40'
                : 'blue.50',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: shared
              ? isDark
                ? 'green.300'
                : 'green.600'
              : isDark
                ? 'blue.300'
                : 'blue.700',
            transition: 'all 0.15s ease',
            _hover: {
              bg: shared
                ? isDark
                  ? 'green.800/60'
                  : 'green.100'
                : isDark
                  ? 'blue.800/40'
                  : 'blue.100',
            },
          })}
        >
          {shared ? '✓' : '↗'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact chip mode (popover)
// ---------------------------------------------------------------------------

interface CompactShareChipProps {
  shareCode: UseShareCodeReturn
  showQR?: boolean
  showLink?: boolean
  showShare?: boolean
  showRegenerate?: boolean
  isDark: boolean
  className?: string
}

function CompactShareChip({
  shareCode,
  showQR = true,
  showLink = true,
  showShare = true,
  showRegenerate = true,
  isDark,
  className,
}: CompactShareChipProps) {
  const [open, setOpen] = useState(false)
  const {
    code,
    shareUrl,
    copyCode,
    codeCopied,
    copyLink,
    linkCopied,
    canShare,
    share,
    shared,
    regenerate,
    isRegenerating,
  } = shareCode

  const showShareHalf = showShare && canShare
  const canRegenerate = showRegenerate && regenerate

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-element="share-code-chip"
          className={cx(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              bg: 'transparent',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: '500',
              color: isDark ? 'gray.400' : 'gray.500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                bg: isDark ? 'gray.700' : 'gray.200',
                color: isDark ? 'gray.300' : 'gray.600',
              },
              _active: {
                transform: 'scale(0.98)',
              },
            }),
            className
          )}
        >
          <span className={css({ fontSize: '10px' })}>📋</span>
          <span>{code}</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="center"
          side="bottom"
          sideOffset={8}
          className={css({
            bg: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: 'lg',
            zIndex: Z_INDEX.DROPDOWN,
            maxWidth: '260px',
          })}
        >
          {/* QR Code with regenerate overlay */}
          {showQR && (
            <div className={css({ marginBottom: '10px' })}>
              <QRWithOverlay
                shareUrl={shareUrl}
                size={120}
                canRegenerate={!!canRegenerate}
                isRegenerating={isRegenerating}
                onRegenerate={regenerate}
                isDark={isDark}
              />
            </div>
          )}

          {/* Code badge */}
          <div className={css({ marginBottom: '10px' })}>
            <CodeBadge
              code={code}
              copied={codeCopied}
              onCopy={copyCode}
              isDark={isDark}
            />
          </div>

          {/* Action bar */}
          <ActionBar
            showLink={!!showLink}
            showShareHalf={!!showShareHalf}
            copyLink={copyLink}
            linkCopied={linkCopied}
            share={share}
            shared={shared}
            isDark={isDark}
          />

          <Popover.Arrow
            className={css({
              fill: isDark ? 'gray.800' : 'white',
            })}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export default ShareCodePanel
