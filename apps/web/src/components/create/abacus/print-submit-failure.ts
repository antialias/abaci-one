/**
 * Honest, remediation-carrying reading of a print-submit rejection (gh#163).
 *
 * The submit proxy relays the THH service's `{ detail: { code, message, … } }`
 * envelope byte-faithfully, so the browser already holds the service's own
 * explanation of *why* a submit failed — this is the one place that explanation
 * is turned into something the panel can show. The rule mirrors the jobs list
 * (`print-jobs.ts`): if the service says why, the panel says why. We NEVER
 * collapse a coded refusal into a bare status number, and NEVER answer a 409
 * conflict with "try again" — a conflict is a state to resolve, not a retry.
 */
import { type InvalidTicketDetail, parseInvalidTicket } from '@eink/print-dialog'

export interface SubmitFailure {
  /** The service's machine code, or a synthetic `http_<status>` when it sent none. */
  code: string
  /** One honest sentence naming what happened — safe as the error headline. */
  headline: string
  /** The concrete next step, or null when there is genuinely nothing to advise. */
  remediation: string | null
  /** `printer_busy`: the job already on the printer, to correlate against the roster. */
  blockingJobId: string | null
  /** `invalid_ticket`: per-key detail routed back into the settings editor. */
  invalidTicket: InvalidTicketDetail | null
  /** `acknowledgement_required`: what the printer is waiting to have confirmed. */
  missing: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Translate a non-OK submit Response (its status + parsed JSON body) into an
 *  honest, actionable {@link SubmitFailure}. `body` is the service envelope the
 *  proxy relayed, or null when the body was empty/unparseable. */
export function describeSubmitFailure(status: number, body: unknown): SubmitFailure {
  const detail = asRecord(asRecord(body)?.detail)
  const code = str(detail?.code) ?? `http_${status}`
  const serviceMessage = str(detail?.message)

  switch (code) {
    case 'invalid_ticket':
      return {
        code,
        headline: 'The print service rejected some settings — highlighted below.',
        remediation: 'Adjust the highlighted settings, then print again.',
        blockingJobId: null,
        invalidTicket: parseInvalidTicket(body),
        missing: [],
      }

    case 'printer_busy': {
      const activeJob = asRecord(detail?.activeJob)
      return {
        code,
        headline: 'The printer is busy with another job, and it can only run one at a time.',
        remediation:
          'Wait for the current job to finish, or cancel it from the print service — then print this abacus again.',
        blockingJobId: str(activeJob?.jobId) ?? str(activeJob?.id),
        invalidTicket: null,
        missing: [],
      }
    }

    case 'acknowledgement_required': {
      const missing = Array.isArray(detail?.missing)
        ? (detail.missing as unknown[]).filter((m): m is string => typeof m === 'string')
        : []
      return {
        code,
        headline:
          serviceMessage ??
          'The printer needs you to confirm something before it can start this job.',
        remediation: missing.length
          ? `Confirm on the printer: ${missing.join(', ')} — then release the job.`
          : 'Confirm the pending prompt on the printer, then release the job.',
        blockingJobId: null,
        invalidTicket: null,
        missing,
      }
    }

    default: {
      // Credentials failed — a re-pair, not a retry, is the fix.
      if (status === 401 || status === 403) {
        return {
          code,
          headline: serviceMessage ?? 'The print service rejected our credentials.',
          remediation: 'Re-pair the printer in Settings › Printing, then print again.',
          blockingJobId: null,
          invalidTicket: null,
          missing: [],
        }
      }
      return {
        code,
        // Prefer the service's own words, verbatim — only fall back to a status
        // sentence when it gave us nothing to show.
        headline: serviceMessage ?? httpFallbackHeadline(status),
        remediation: defaultRemediation(status),
        blockingJobId: null,
        invalidTicket: null,
        missing: [],
      }
    }
  }
}

function httpFallbackHeadline(status: number): string {
  if (status === 0) return 'The print service is unreachable right now.'
  if (status === 409) return 'The print service says this job conflicts with its current state.'
  if (status >= 500) return `The print service hit a problem on its end (error ${status}).`
  return `The print service couldn’t accept this job (error ${status}).`
}

function defaultRemediation(status: number): string | null {
  if (status === 0 || status >= 500)
    return 'This is usually temporary — wait a moment, then try again.'
  // A 409 with no machine code: still a conflict, so retrying blind is wrong.
  if (status === 409) return 'Check the job list below to see what conflicts before trying again.'
  return null
}
