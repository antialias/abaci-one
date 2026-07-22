// Abacus Studio — the submit-error panel (gh#163).
//
// Presentational and hook-free: an honest headline, the job currently holding
// the printer (when the service named one), and the situational next step. All
// wording arrives as data (a parsed `SubmitFailure` from `describeSubmitFailure`
// plus the roster row it points at), so every failure state is reproducible in
// Storybook without staging a live print service.

import type { JobRow } from './print-jobs'
import type { SubmitFailure } from './print-submit-failure'

export interface PrintSubmitErrorNoticeProps {
  /** The parsed service failure, or null when the throw wasn't a coded submit
   *  rejection (e.g. the pre-submit export timeout) — then `fallbackMessage`
   *  is shown as the headline. */
  failure: SubmitFailure | null
  /** The roster row for `failure.blockingJobId`, when it resolved — names the
   *  job that's holding the printer. Null when there's none to name. */
  blockingJob: JobRow | null
  /** Headline shown when `failure` is null. */
  fallbackMessage: string
}

export function PrintSubmitErrorNotice({
  failure,
  blockingJob,
  fallbackMessage,
}: PrintSubmitErrorNoticeProps) {
  return (
    <div
      data-element="print-submit-error"
      data-error-code={failure?.code}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'rgba(127,29,29,0.35)',
        border: '1px solid rgba(248,113,113,0.5)',
        color: 'rgba(254,226,226,0.96)',
        lineHeight: 1.45,
      }}
    >
      <div data-element="print-submit-error-headline" style={{ fontWeight: 600 }}>
        {failure ? failure.headline : fallbackMessage}
      </div>
      {blockingJob && (
        <div
          data-element="print-submit-error-blocking"
          style={{ color: 'rgba(251,191,36,0.95)', overflowWrap: 'anywhere' }}
        >
          On the printer now: “{blockingJob.name}” ({blockingJob.phase}
          {blockingJob.progress !== null ? ` · ${Math.round(blockingJob.progress)}%` : ''}).
        </div>
      )}
      {failure?.remediation && (
        <div
          data-element="print-submit-error-remediation"
          style={{ color: 'rgba(254,226,226,0.82)' }}
        >
          {failure.remediation}
        </div>
      )}
    </div>
  )
}
