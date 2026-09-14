// Abacus Studio — the parked-job resolver (Gitea #9).
//
// When an auto-start print can't just go — the bed isn't clear, a verdict
// failed, the printer paused mid-print for a nozzle check or on a fault of its
// own (its codes are linked to the printer's own pages, never explained) — THH parks the job
// and captures why. This card turns that standstill into something the user
// can act on in place: it shows the situation honestly (the service's own
// reason sentences + the latest bed photo) AND the remediation (start it
// anyway, or cancel it). Start is one tap: the reasons are on the card, the
// button says what it does, and a start can be undone from this same card
// seconds later. Stop on a running print is the one two-tap, because that
// cannot be undone.
//
// Presentational and hook-free of data: the roster read + the start/cancel
// mutations live in useAbacusPrintJobs; here everything arrives as props, so
// every state is reproducible in Storybook without a live print service. The
// only local state is UI ceremony (arming Stop, hiding a broken photo).

import { useState } from 'react'
import { button, notice, STUDIO } from '@/components/studio/theme'
import { isParked, type JobRow } from './print-jobs'
import type { SubmitFailure } from './print-submit-failure'

export interface ParkedJobCardProps {
  job: JobRow
  /** Acknowledge every parked reason and start. Codes are passed for you. */
  onStart: (acknowledge: string[]) => void
  /** Cancel (`false`) a parked job, or stop (`true`) one that's printing. */
  onCancel: (stopPrint: boolean) => void
  startPending?: boolean
  cancelPending?: boolean
  /** The service's honest reason a start was refused, if the last one was. */
  startFailure?: SubmitFailure | null
  /** The service's honest reason a cancel/stop was refused, if the last one was. */
  cancelFailure?: SubmitFailure | null
}

const amber = STUDIO.color.warnInline

function reasonText(job: JobRow): string {
  return job.attention.map((r) => r.detail ?? r.code).join('; ')
}

/** A start/cancel refusal, rendered with the same honest copy as the submit panel. */
function ActionError({ failure }: { failure: SubmitFailure }) {
  return (
    <div
      data-element="parked-job-error"
      data-error-code={failure.code}
      role="alert"
      style={notice('danger')}
    >
      <div style={{ ...STUDIO.type.strong, color: 'inherit' }}>{failure.headline}</div>
      {failure.remediation && (
        <div style={{ ...STUDIO.type.note, color: 'inherit', opacity: 0.85, marginTop: 2 }}>
          {failure.remediation}
        </div>
      )}
    </div>
  )
}

export function ParkedJobCard({
  job,
  onStart,
  onCancel,
  startPending = false,
  cancelPending = false,
  startFailure = null,
  cancelFailure = null,
}: ParkedJobCardProps) {
  // Stop is two-tap: the first tap arms, the second commits, onBlur disarms.
  // Start is not — see the header.
  const [stopArmed, setStopArmed] = useState(false)
  // A verdict-only park has no bed photo (404); hide the <img> when it fails.
  // Key the broken flag to updatedAt so a re-park's fresh frame gets a new try:
  // a different token makes frameBroken derive back to false with no effect.
  const frameToken = String(job.updatedAt ?? '')
  const [brokenToken, setBrokenToken] = useState<string | null>(null)
  const frameBroken = brokenToken === frameToken

  const parked = isParked(job.phase)
  const printing = job.phase === 'printing'
  const hasReasons = job.attention.length > 0
  // A chained Stage B (Gitea #38) the gateway prepared but refuses to start:
  // `chain_start_disabled` is the one reason acknowledging can't clear (the
  // gateway re-parks it), so the start button says so instead of round-tripping.
  const chainStartDisabled = job.attention.some((reason) => reason.code === 'chain_start_disabled')
  const hasUnverifiedProfile = job.attention.some((reason) =>
    reason.code.startsWith('filament_profile_unverified:')
  )
  // A mid-print pause the printer raised itself (THH `print_paused_fault` /
  // `print_paused`): the service reports the printer's own facts and no
  // diagnosis, and nothing resumes on its own — unlike the nozzle-confirm pause.
  const faultPause = job.attention.some((reason) => reason.code === 'print_paused_fault')
  const plainPause = job.attention.some((reason) => reason.code === 'print_paused')

  const title = printing
    ? faultPause
      ? 'Paused mid-print — the printer reported an error. Read its codes, then resume or stop at the printer.'
      : plainPause
        ? 'Paused mid-print — the printer reported no error. Resume or stop at the printer.'
        : 'Paused mid-print — confirm at the printer, then it resumes.'
    : job.phase === 'needs_attention'
      ? chainStartDisabled
        ? 'Prepared, but chained starts are switched off on this print service.'
        : hasUnverifiedProfile
          ? 'Review required — this filament was sliced with a fallback profile.'
          : 'Paused before printing — the printer flagged something to check.'
      : 'Sliced and waiting — start it when you’re ready.'

  const handleStart = () => {
    if (startPending) return
    onStart(job.attention.map((r) => r.code))
  }
  const handleStop = () => {
    if (cancelPending) return
    if (!stopArmed) {
      setStopArmed(true)
      return
    }
    setStopArmed(false)
    onCancel(true)
  }
  const handleCancel = () => {
    if (cancelPending) return
    onCancel(false)
  }

  return (
    <div
      data-component="abacus-parked-job-card"
      data-element="parked-job-card"
      data-phase={job.phase}
      // status, not alert: the card holds a polled camera frame and a live
      // phase/progress, so every print-ring invalidation would re-announce it.
      role="status"
      style={{
        ...notice('warn'),
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginTop: 6,
      }}
    >
      <div data-element="parked-job-title" style={{ ...STUDIO.type.strong, color: 'inherit' }}>
        <span aria-hidden="true">⏸ </span>
        {title}
      </div>

      {job.attention.length > 0 && !frameBroken && (
        // The service's latest camera view of the bed, so the override is an
        // informed one. Job-level endpoint (not the per-reason frameRef); 404s
        // to hidden for parks that carry no photo.
        // biome-ignore lint/performance/noImgElement: live camera JPEG streamed from the print proxy; next/image can't optimize a per-park dynamic frame
        <img
          data-element="parked-job-frame"
          src={`/api/abacus/print/jobs/${encodeURIComponent(job.id)}/attention-frame?t=${job.updatedAt ?? ''}`}
          alt="Latest camera view of the printer bed"
          onError={() => setBrokenToken(frameToken)}
          style={{ width: '100%', borderRadius: STUDIO.radius.notice, display: 'block' }}
        />
      )}

      {hasReasons && (
        <ul
          data-element="parked-job-reasons"
          style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {job.attention.map((reason) => (
            <li
              key={reason.code}
              data-element="parked-job-reason"
              data-reason-code={reason.code}
              style={{ color: amber, overflowWrap: 'anywhere' }}
            >
              {reason.detail ?? reason.code}
              {reason.printer && reason.printer.hms.length > 0 && (
                // Each code links to the printer maker's own page for it — the
                // printer's word on what its code means, not ours.
                <div data-element="parked-job-printer-codes" style={{ marginTop: 2 }}>
                  Printer codes:{' '}
                  {reason.printer.hms.map((alert, i) => (
                    <span key={alert.hex}>
                      {i > 0 && ', '}
                      {alert.wiki ? (
                        <a
                          data-element="parked-job-hms"
                          href={alert.wiki}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'inherit' }}
                        >
                          {alert.hex}
                        </a>
                      ) : (
                        <span data-element="parked-job-hms">{alert.hex}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        {parked && (
          <button
            type="button"
            data-action="acknowledge-start"
            onClick={handleStart}
            disabled={startPending || chainStartDisabled}
            title={
              chainStartDisabled
                ? 'The print service refuses chained same-plate starts (CHAINED_START_ENABLED is off) — acknowledging cannot override it.'
                : undefined
            }
            aria-label={
              hasReasons ? `Acknowledge and start, despite: ${reasonText(job)}` : undefined
            }
            style={{
              ...button('primary', { disabled: startPending || chainStartDisabled }),
              flex: 1,
            }}
          >
            {startPending
              ? 'Starting…'
              : job.phase === 'needs_attention'
                ? 'Acknowledge & start'
                : 'Start print'}
          </button>
        )}

        {printing ? (
          <button
            type="button"
            data-action="stop-print"
            onClick={handleStop}
            onBlur={() => setStopArmed(false)}
            disabled={cancelPending}
            style={{ ...button('danger', { disabled: cancelPending }), flex: 1 }}
          >
            {cancelPending ? 'Stopping…' : stopArmed ? 'Stop the print?' : 'Stop print'}
          </button>
        ) : (
          parked && (
            <button
              type="button"
              data-action="cancel-job"
              onClick={handleCancel}
              disabled={cancelPending}
              style={{ ...button('secondary', { disabled: cancelPending }), color: 'inherit' }}
            >
              {cancelPending ? 'Canceling…' : 'Cancel'}
            </button>
          )
        )}
      </div>

      {startFailure && <ActionError failure={startFailure} />}
      {cancelFailure && <ActionError failure={cancelFailure} />}
    </div>
  )
}
