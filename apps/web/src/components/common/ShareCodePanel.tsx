'use client'

import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'

import { Z_INDEX } from '@/constants/zIndex'
import { useTheme } from '@/contexts/ThemeContext'
import type { UseShareCodeReturn } from '@/hooks/useShareCode'
import { css } from '../../../styled-system/css'
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

  /** Additional CSS class name */
  className?: string
}

/**
 * Unified share code panel for classroom, family, and room codes.
 *
 * Supports two modes:
 * - Full panel: Title, subtitle, large QR, code button, link button, regenerate
 * - Compact chip: Inline button that opens a popover with QR and copy options
 *
 * @example Full panel mode
 * ```tsx
 * const share = useShareCode({ type: 'classroom', code: 'ABC123' })
 *
 * <ShareCodePanel
 *   shareCode={share}
 *   title="Classroom Code"
 *   subtitle="Share this code with parents to give them access."
 * />
 * ```
 *
 * @example Compact mode
 * ```tsx
 * const share = useShareCode({ type: 'classroom', code: 'ABC123' })
 *
 * <ShareCodePanel shareCode={share} compact />
 * ```
 */
export function ShareCodePanel({
  shareCode,
  title,
  subtitle,
  compact = false,
  showQR = true,
  showLink = true,
  showRegenerate = true,
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
  isDark,
  className,
}: FullSharePanelProps) {
  const { code, shareUrl, copyCode, codeCopied, copyLink, linkCopied, regenerate, isRegenerating } =
    shareCode

  const canRegenerate = showRegenerate && regenerate

  return (
    <div
      data-component="share-code-panel"
      className={
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          bg: isDark ? 'gray.800' : 'white',
          borderRadius: '12px',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
        }) + (className ? ` ${className}` : '')
      }
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

      {/* QR Code */}
      {showQR && (
        <div
          data-element="share-qr-code"
          className={css({
            display: 'flex',
            justifyContent: 'center',
            padding: '16px',
            bg: 'white',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.200',
          })}
        >
          <AbacusQRCode value={shareUrl} size={180} />
        </div>
      )}

      {/* Code button */}
      <button
        type="button"
        onClick={copyCode}
        data-action="copy-code"
        data-status={codeCopied ? 'copied' : 'idle'}
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 16px',
          bg: codeCopied
            ? isDark
              ? 'green.900/60'
              : 'green.50'
            : isDark
              ? 'purple.900/60'
              : 'purple.50',
          border: '2px solid',
          borderColor: codeCopied
            ? isDark
              ? 'green.700'
              : 'green.300'
            : isDark
              ? 'purple.700'
              : 'purple.300',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          _hover: {
            bg: codeCopied
              ? isDark
                ? 'green.800/60'
                : 'green.100'
              : isDark
                ? 'purple.800/60'
                : 'purple.100',
          },
        })}
      >
        <span
          className={css({
            fontSize: '16px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            color: codeCopied
              ? isDark
                ? 'green.300'
                : 'green.700'
              : isDark
                ? 'purple.300'
                : 'purple.700',
          })}
        >
          {codeCopied ? '✓ Copied!' : code}
        </span>
        {!codeCopied && (
          <span
            className={css({
              fontSize: '12px',
              color: isDark ? 'purple.400' : 'purple.500',
            })}
          >
            Copy code
          </span>
        )}
      </button>

      {/* Link button */}
      {showLink && (
        <button
          type="button"
          onClick={copyLink}
          data-action="copy-link"
          data-status={linkCopied ? 'copied' : 'idle'}
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            bg: linkCopied
              ? isDark
                ? 'green.900/60'
                : 'green.50'
              : isDark
                ? 'blue.900/60'
                : 'blue.50',
            border: '1px solid',
            borderColor: linkCopied
              ? isDark
                ? 'green.700'
                : 'green.300'
              : isDark
                ? 'blue.700'
                : 'blue.300',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            _hover: {
              bg: linkCopied
                ? isDark
                  ? 'green.800/60'
                  : 'green.100'
                : isDark
                  ? 'blue.800/60'
                  : 'blue.100',
            },
          })}
        >
          <span
            className={css({
              fontSize: '14px',
              color: linkCopied
                ? isDark
                  ? 'green.300'
                  : 'green.700'
                : isDark
                  ? 'blue.300'
                  : 'blue.700',
            })}
          >
            {linkCopied ? '✓ Link copied!' : '🔗 Copy link'}
          </span>
        </button>
      )}

      {/* Regenerate button */}
      {canRegenerate && (
        <button
          type="button"
          onClick={regenerate}
          disabled={isRegenerating}
          data-action="regenerate-code"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            bg: 'transparent',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
            borderRadius: '8px',
            cursor: isRegenerating ? 'wait' : 'pointer',
            opacity: isRegenerating ? 0.6 : 1,
            transition: 'all 0.2s ease',
            _hover: {
              bg: isDark ? 'gray.700' : 'gray.50',
            },
          })}
        >
          <span
            className={css({
              fontSize: '14px',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {isRegenerating ? 'Generating...' : '🔄 Generate new code'}
          </span>
        </button>
      )}
    </div>
  )
}

interface CompactShareChipProps {
  shareCode: UseShareCodeReturn
  showQR?: boolean
  showLink?: boolean
  isDark: boolean
  className?: string
}

function CompactShareChip({
  shareCode,
  showQR = true,
  showLink = true,
  isDark,
  className,
}: CompactShareChipProps) {
  const [open, setOpen] = useState(false)
  const { code, shareUrl, copyCode, codeCopied, copyLink, linkCopied } = shareCode

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-element="share-code-chip"
          className={
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              bg: isDark ? 'gray.700' : 'gray.100',
              border: '1px solid',
              borderColor: isDark ? 'gray.600' : 'gray.300',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: isDark ? 'gray.300' : 'gray.600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: {
                bg: isDark ? 'gray.600' : 'gray.200',
                borderColor: isDark ? 'gray.500' : 'gray.400',
              },
              _active: {
                transform: 'scale(0.98)',
              },
            }) + (className ? ` ${className}` : '')
          }
        >
          <span>📋</span>
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
            padding: '16px',
            boxShadow: 'lg',
            zIndex: Z_INDEX.DROPDOWN,
            maxWidth: '280px',
          })}
        >
          {/* QR Code */}
          {showQR && (
            <div
              className={css({
                display: 'flex',
                justifyContent: 'center',
                padding: '12px',
                bg: 'white',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isDark ? 'gray.600' : 'gray.200',
                marginBottom: '12px',
              })}
            >
              <AbacusQRCode value={shareUrl} size={160} />
            </div>
          )}

          {/* Copy code button */}
          <button
            type="button"
            onClick={copyCode}
            data-action="copy-code"
            className={css({
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 12px',
              bg: codeCopied
                ? isDark
                  ? 'green.900/60'
                  : 'green.50'
                : isDark
                  ? 'purple.900/60'
                  : 'purple.50',
              border: '1px solid',
              borderColor: codeCopied
                ? isDark
                  ? 'green.700'
                  : 'green.300'
                : isDark
                  ? 'purple.700'
                  : 'purple.300',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: showLink ? '8px' : '0',
            })}
          >
            <span
              className={css({
                fontSize: '14px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                color: codeCopied
                  ? isDark
                    ? 'green.300'
                    : 'green.700'
                  : isDark
                    ? 'purple.300'
                    : 'purple.700',
              })}
            >
              {codeCopied ? '✓ Copied!' : code}
            </span>
          </button>

          {/* Copy link button */}
          {showLink && (
            <button
              type="button"
              onClick={copyLink}
              data-action="copy-link"
              className={css({
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                bg: linkCopied
                  ? isDark
                    ? 'green.900/60'
                    : 'green.50'
                  : isDark
                    ? 'blue.900/60'
                    : 'blue.50',
                border: '1px solid',
                borderColor: linkCopied
                  ? isDark
                    ? 'green.700'
                    : 'green.300'
                  : isDark
                    ? 'blue.700'
                    : 'blue.300',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              })}
            >
              <span
                className={css({
                  fontSize: '12px',
                  color: linkCopied
                    ? isDark
                      ? 'green.300'
                      : 'green.700'
                    : isDark
                      ? 'blue.300'
                      : 'blue.700',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                })}
              >
                {linkCopied ? '✓ Link copied!' : `🔗 ${shareUrl}`}
              </span>
            </button>
          )}

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
