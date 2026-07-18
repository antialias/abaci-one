'use client'

import { css } from '../../../styled-system/css'
import { classifySongFailure } from '@/lib/session-song/classify-failure'
import type { SessionSongFailureKind } from '@/db/schema/session-songs'

interface SongFailureCardProps {
  /** Classified failure kind from the server. Null for legacy rows without a classification. */
  failureKind: SessionSongFailureKind | null
  /** Raw provider error — only present when the viewer is the account owner or admin. */
  errorDetail: string | null
  /** Whether to show the owner-actionable second line. */
  viewerIsOwner: boolean
}

/**
 * Soft-styled card shown in place of the song player when generation failed.
 *
 * Always shows a kid-safe top line. When the viewer owns the account (or is an
 * admin), an expandable second block surfaces the underlying problem and a
 * direct remediation link.
 */
export function SongFailureCard({ failureKind, errorDetail, viewerIsOwner }: SongFailureCardProps) {
  // Use the classifier to rebuild the messages from the kind. We also pass any
  // raw error string so the classifier's defaults match what the server stored.
  const classified = classifySongFailure(errorDetail ?? failureKind ?? 'unknown')
  const showOwnerBlock = viewerIsOwner

  return (
    <div
      data-component="song-failure-card"
      data-failure-kind={failureKind ?? 'unknown'}
      className={css({
        mx: 'auto',
        maxW: '480px',
        p: 4,
        borderRadius: 'xl',
        bg: 'amber.50',
        border: '1px solid',
        borderColor: 'amber.200',
        _dark: {
          bg: 'amber.900/20',
          borderColor: 'amber.700/40',
        },
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        })}
      >
        <div
          aria-hidden
          className={css({
            fontSize: '2xl',
            lineHeight: 1,
            flexShrink: 0,
          })}
        >
          🎵
        </div>
        <p
          className={css({
            fontSize: 'md',
            color: 'amber.900',
            _dark: { color: 'amber.100' },
            margin: 0,
          })}
        >
          {classified.userMessage}
        </p>
      </div>

      {showOwnerBlock && (
        <div
          data-element="owner-remediation"
          className={css({
            mt: 3,
            pt: 3,
            borderTop: '1px solid',
            borderColor: 'amber.200',
            fontSize: 'sm',
            color: 'amber.800',
            _dark: { borderColor: 'amber.700/40', color: 'amber.200' },
          })}
        >
          <p className={css({ margin: 0 })}>{classified.ownerMessage}</p>
          {classified.remediation && (
            <a
              data-action="song-failure-remediation"
              href={classified.remediation.href}
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                display: 'inline-block',
                mt: 2,
                px: 3,
                py: 1,
                borderRadius: 'md',
                bg: 'amber.600',
                color: 'white',
                textDecoration: 'none',
                fontSize: 'sm',
                fontWeight: 'medium',
                _hover: { bg: 'amber.700' },
              })}
            >
              {classified.remediation.label} →
            </a>
          )}
          {errorDetail && (
            <details
              data-element="error-detail"
              className={css({
                mt: 2,
                fontSize: 'xs',
                color: 'amber.700',
                _dark: { color: 'amber.300' },
              })}
            >
              <summary className={css({ cursor: 'pointer' })}>Provider error</summary>
              <code
                className={css({
                  display: 'block',
                  mt: 1,
                  p: 2,
                  borderRadius: 'sm',
                  bg: 'amber.100',
                  _dark: { bg: 'amber.900/40' },
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 'xs',
                })}
              >
                {errorDetail}
              </code>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
