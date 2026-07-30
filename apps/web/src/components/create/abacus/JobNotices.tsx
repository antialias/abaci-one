// Abacus Studio — the advisory notices on a print job (Gitea #29, THH #429).
//
// A notice is not a failure and not a park. It is the print service saying
// "I let this run without checking X." We submit with `startPolicy: 'auto'`,
// so when the service's bed camera can't reach its vision provider our print
// starts unattended with nothing having looked at the plate — this line is the
// only place that fact surfaces. It renders on every phase the job passes
// through, including `completed`, because a finished print is exactly when
// "nobody checked the bed" explains what you're looking at.
//
// Presentational and hook-free, so every state is reachable from Storybook and
// from a plain render test without staging a live print service.
//
// Deliberately does NOT branch on `cause`. The service writes `detail` as a
// complete sentence including its own remedy ("Top up billing at
// platform.openai.com…"), and anything we compose alongside it can contradict
// it the moment that prose changes. `cause` is the stable machine class, so it
// rides out as a data attribute for tests and support rather than as copy.

import type { JobNotice } from './print-jobs'

export interface JobNoticesProps {
  /** The job's `notices[]`, already projected. Empty renders nothing at all. */
  notices: JobNotice[]
}

export function JobNotices({ notices }: JobNoticesProps) {
  if (notices.length === 0) return null
  return (
    <>
      {notices.map((notice, i) => (
        <div
          // Composite with the position: the service emits one notice per
          // blocker, and nothing stops two from sharing a code + cause.
          key={`${i}:${notice.code}:${notice.cause ?? ''}`}
          data-component="job-notices"
          data-element="print-job-notice"
          data-code={notice.code}
          data-cause={notice.cause ?? undefined}
          style={{
            display: 'flex',
            gap: 6,
            padding: '4px 7px',
            borderRadius: 5,
            background: 'rgba(120,53,15,0.30)',
            border: '1px solid rgba(251,191,36,0.35)',
            color: 'rgba(254,243,199,0.94)',
            lineHeight: 1.45,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          <span aria-hidden="true">⚠</span>
          {/* The service's own sentence, verbatim and never truncated — the
              actionable part is often the tail. `code` is the fallback for a
              service that reported a notice with no prose attached. */}
          <span>{notice.detail ?? notice.code}</span>
        </div>
      ))}
    </>
  )
}
