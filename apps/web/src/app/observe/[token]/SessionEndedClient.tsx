'use client'

import Link from 'next/link'
import { SessionEndedSummary } from '@/components/classroom/SessionEndedSummary'
import { SubscribeButton } from '@/components/notifications/SubscribeButton'
import { SessionSongPlayer } from '@/components/practice/SessionSongPlayer'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { css } from '../../../../styled-system/css'

interface SessionEndedClientProps {
  studentName: string
  studentEmoji: string
  /**
   * The ended session's report (completed, ended early or abandoned; Phase
   * 4c); null when the session has not started yet. Every number shown here
   * comes from it.
   */
  report: SessionReport | null
  playerId: string
  sessionPlanId: string
  shareToken: string
  /** URL to the session report (only shown if user has access) */
  sessionReportUrl?: string
  /** Set if the viewer is authenticated */
  userId?: string
}

export function SessionEndedClient({
  studentName,
  studentEmoji,
  report,
  playerId,
  sessionPlanId,
  shareToken,
  sessionReportUrl,
  userId,
}: SessionEndedClientProps) {
  const sessionEnded = report !== null
  return (
    <div
      data-component="session-ended-page"
      className={css({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bg: 'bg.canvas',
      })}
    >
      {/* Banner with link to session report (only shown if user has access) */}
      {sessionReportUrl && sessionEnded && (
        <div
          data-element="session-report-banner"
          className={css({
            bg: 'green.500',
            color: 'white',
            py: 3,
            px: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            flexWrap: 'wrap',
            textAlign: 'center',
          })}
        >
          <span className={css({ fontWeight: 'medium' })}>
            You have access to view the full session report.
          </span>
          <Link
            href={sessionReportUrl}
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              bg: 'white',
              color: 'green.700',
              px: 4,
              py: 1.5,
              borderRadius: 'md',
              fontWeight: 'semibold',
              fontSize: 'sm',
              transition: 'all 0.2s',
              _hover: {
                bg: 'green.50',
              },
            })}
          >
            View Session Report
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      <div
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 6,
          textAlign: 'center',
        })}
      >
        {report ? (
          <div className={css({ mb: 6, w: '100%', display: 'flex', justifyContent: 'center' })}>
            <SessionEndedSummary
              report={report}
              studentName={studentName}
              studentEmoji={studentEmoji}
            />
          </div>
        ) : (
          <>
            <div
              className={css({
                fontSize: '6xl',
                mb: 4,
              })}
            >
              ⏳
            </div>

            <h1
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: 'text.primary',
                mb: 2,
              })}
            >
              Session Not Started
            </h1>

            <p
              className={css({
                fontSize: 'lg',
                color: 'text.secondary',
                mb: 6,
                maxWidth: '400px',
              })}
            >
              {`${studentEmoji} ${studentName}'s practice session hasn't started yet.`}
            </p>
          </>
        )}

        {/* Session song player — shown once the session ended */}
        {sessionEnded && (
          <div data-element="session-song" className={css({ w: '100%', maxW: '480px', mb: 4 })}>
            <SessionSongPlayer playerId={playerId} planId={sessionPlanId} />
          </div>
        )}

        {!sessionReportUrl && sessionEnded && (
          <p
            className={css({
              fontSize: 'sm',
              color: 'text.muted',
              mb: 6,
            })}
          >
            If you have an account with access to this student, you can sign in to view the session
            report.
          </p>
        )}

        {!sessionEnded && (
          <p
            className={css({
              fontSize: 'sm',
              color: 'text.muted',
              mb: 6,
            })}
          >
            Check back once the session has started.
          </p>
        )}

        {/* Notification subscribe CTA */}
        {sessionEnded && (
          <div
            data-element="subscribe-cta"
            className={css({
              marginBottom: 6,
            })}
          >
            <SubscribeButton
              playerId={playerId}
              playerName={studentName}
              userId={userId}
              shareToken={shareToken}
              variant="prominent"
            />
          </div>
        )}

        <Link
          href="/"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            px: 6,
            py: 3,
            bg: 'brand.500',
            color: 'white',
            borderRadius: 'lg',
            fontWeight: 'semibold',
            transition: 'all 0.2s',
            _hover: {
              bg: 'brand.600',
            },
          })}
        >
          Go to Home
        </Link>
      </div>
    </div>
  )
}
