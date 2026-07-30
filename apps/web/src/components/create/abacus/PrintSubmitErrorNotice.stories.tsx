// Abacus Studio — PrintSubmitErrorNotice stories (gh#163).
//
// Every failure the submit panel can show, staged without a live print service.
// Each story feeds a real service envelope through `describeSubmitFailure` — the
// same function the panel uses — so the copy shown here is exactly the copy a
// user gets, and it can't drift from the mapping. The headline example that
// motivated this work is `PrinterBusyHeldJob`: the prod 409 that used to read
// "Submit failed (409). Try again."

import type { Meta, StoryObj } from '@storybook/react'
import { PrintSubmitErrorNotice } from './PrintSubmitErrorNotice'
import type { JobRow } from './print-jobs'
import { describeSubmitFailure } from './print-submit-failure'

const meta: Meta<typeof PrintSubmitErrorNotice> = {
  title: 'AbacusStudio/PrintSubmitErrorNotice',
  component: PrintSubmitErrorNotice,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // the studio's dark sidebar column; the notice's palette assumes it
      <div
        style={{
          width: 300,
          padding: 12,
          borderRadius: 12,
          background: '#111827',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 12,
        }}
      >
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof PrintSubmitErrorNotice>

const resolveDefaults = {
  attention: [],
  notices: [],
  startPolicy: null,
  acknowledged: [],
  updatedAt: null,
}
const heldJob: JobRow = {
  id: 'j0',
  name: 'Abacus — 4 columns',
  phase: 'ready',
  progress: null,
  error: null,
  ...resolveDefaults,
}
const printingJob: JobRow = {
  id: 'j1',
  name: 'Abacus — 7 columns',
  phase: 'printing',
  progress: 42,
  error: null,
  ...resolveDefaults,
}

/**
 * The prod 409 that motivated this work. THH refuses the submit because the
 * printer already holds a job — here the "ready" (held) one from a prior
 * submit — and the notice names it and says exactly what to do, in place of the
 * old "Submit failed (409). Try again."
 */
export const PrinterBusyHeldJob: Story = {
  args: {
    failure: describeSubmitFailure(409, {
      detail: { code: 'printer_busy', message: 'busy', activeJob: { jobId: 'j0' } },
    }),
    blockingJob: heldJob,
    fallbackMessage: 'Submit failed.',
  },
}

/** Same refusal while the blocking job is actively printing — the phase and
 *  progress read straight off the roster row. */
export const PrinterBusyPrinting: Story = {
  args: {
    failure: describeSubmitFailure(409, {
      detail: { code: 'printer_busy', activeJob: { jobId: 'j1' } },
    }),
    blockingJob: printingJob,
    fallbackMessage: 'Submit failed.',
  },
}

/** printer_busy where the service named no job (or it isn't in our roster):
 *  still an honest explanation and the same remediation, no phantom job line. */
export const PrinterBusyUnnamed: Story = {
  args: {
    failure: describeSubmitFailure(409, { detail: { code: 'printer_busy' } }),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** A per-key ticket rejection — the headline points at the settings editor,
 *  where the highlighted keys live. */
export const InvalidTicket: Story = {
  args: {
    failure: describeSubmitFailure(400, {
      detail: {
        code: 'invalid_ticket',
        message: 'bad',
        keys: { layer_height: 'out of range' },
      },
    }),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** The printer needs something confirmed before it can start — the missing
 *  acknowledgements are named in the remediation. */
export const AcknowledgementRequired: Story = {
  args: {
    failure: describeSubmitFailure(409, {
      detail: {
        code: 'acknowledgement_required',
        message: 'Confirm the bed and AMS mapping before printing.',
        missing: ['bed_temp_unverified', 'ams_mapping'],
      },
    }),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** A code we don't special-case: the service's own message is shown VERBATIM
 *  rather than swallowed into a status number. */
export const UnknownCodedRefusal: Story = {
  args: {
    failure: describeSubmitFailure(409, {
      detail: {
        code: 'nozzle_mismatch',
        message: 'This printer has a 0.4 mm nozzle; this job needs 0.2 mm.',
      },
    }),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** A 409 with no parseable body — still named a conflict, never a blind retry. */
export const ConflictNoBody: Story = {
  args: {
    failure: describeSubmitFailure(409, null),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** A 5xx / unreachable: the one case where "try again" is the honest advice. */
export const TransientServiceError: Story = {
  args: {
    failure: describeSubmitFailure(503, null),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** Credentials rejected — a re-pair, not a retry. */
export const CredentialsRejected: Story = {
  args: {
    failure: describeSubmitFailure(403, null),
    blockingJob: null,
    fallbackMessage: 'Submit failed.',
  },
}

/** A throw that isn't a coded submit rejection (e.g. the pre-submit export
 *  render timing out): `failure` is null and the raw Error message is shown. */
export const NonCodedThrow: Story = {
  args: {
    failure: null,
    blockingJob: null,
    fallbackMessage: "The 3D render didn't finish — try again",
  },
}
