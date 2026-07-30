// Abacus Studio — ParkedJobCard stories (Gitea #9).
//
// Every standstill an auto-start print can land in, staged without a live print
// service: a dirty/uncertain bed, a failed verdict, a mid-print nozzle pause, a
// plain sliced-and-waiting job, and a refused start. Failure copy is fed through
// the real `describeSubmitFailure`, the same function the panel uses, so the
// words here are exactly the words a user gets. The bed-photo <img> points at a
// live proxy endpoint that isn't up in Storybook, so it self-hides (onError) —
// the reasons and controls are the point of these stories.

import type { Meta, StoryObj } from '@storybook/react'
import { ParkedJobCard } from './ParkedJobCard'
import type { JobRow } from './print-jobs'
import { describeSubmitFailure } from './print-submit-failure'

const meta: Meta<typeof ParkedJobCard> = {
  title: 'AbacusStudio/ParkedJobCard',
  component: ParkedJobCard,
  tags: ['autodocs'],
  args: {
    // Internal two-tap arming is still exercisable in the canvas with no-ops.
    onStart: () => {},
    onCancel: () => {},
  },
  decorators: [
    (Story) => (
      // the studio's dark sidebar column; the card's palette assumes it
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

type Story = StoryObj<typeof ParkedJobCard>

/** A parked/healthy job row with the fields a story cares about; the rest are
 *  the empty/neutral defaults `normalizeJobs` would produce. */
function job(overrides: Partial<JobRow>): JobRow {
  return {
    id: 'job-1',
    name: 'Abacus — 4 columns',
    phase: 'needs_attention',
    progress: null,
    error: null,
    attention: [],
    notices: [],
    startPolicy: 'auto',
    acknowledged: [],
    updatedAt: 1_784_700_000,
    ...overrides,
  }
}

/** The common case: the printer's vision check couldn't confirm a clear bed,
 *  so the print is held for a human to look and start-anyway (two-tap). */
export const BedNotClear: Story = {
  args: {
    job: job({
      attention: [
        {
          code: 'bed_not_clear',
          detail: 'The print bed doesn’t look clear — remove anything left on it before printing.',
        },
      ],
    }),
  },
}

/** Vision was inconclusive (never promotes to "clear"): the human decides. */
export const BedUnknown: Story = {
  args: {
    job: job({
      attention: [
        {
          code: 'bed_unknown',
          detail: 'Couldn’t get a clear view of the bed — check it, then start when it’s clear.',
        },
      ],
    }),
  },
}

/** A filament/verdict check failed. Verdict-only parks carry no bed photo, so
 *  the <img> self-hides and the reason stands on its own. */
export const VerdictFailed: Story = {
  args: {
    job: job({
      attention: [
        {
          code: 'verdict:filament-mismatch',
          detail: 'The loaded filaments don’t match this job’s plate — check the AMS mapping.',
        },
      ],
    }),
  },
}

/** A clean `hold` slice waiting on a human ▶. Auto-start won't produce these,
 *  but a pre-existing held job resolves the same way — plain Start, no photo. */
export const ReadyToStart: Story = {
  args: {
    job: job({ phase: 'ready', startPolicy: 'hold', attention: [] }),
  },
}

/** The printer paused mid-print for a hands-on nozzle confirmation: no Start
 *  (it's already printing), just the situation and a Stop. */
export const PrintingNozzleConfirm: Story = {
  args: {
    job: job({
      name: 'Abacus — 7 columns',
      phase: 'printing',
      attention: [
        {
          code: 'nozzle_confirm',
          detail: 'Paused to confirm the nozzle — check it at the printer, then press Resume.',
        },
      ],
    }),
  },
}

/** A start that was refused: the service's honest, coded reason renders inline
 *  through the same copy the submit panel uses. */
export const StartRefused: Story = {
  args: {
    job: job({
      attention: [{ code: 'bed_not_clear', detail: 'The print bed doesn’t look clear.' }],
    }),
    startFailure: describeSubmitFailure(409, {
      detail: {
        code: 'acknowledgement_required',
        message: 'Confirm the bed before printing.',
        missing: ['bed_not_clear'],
      },
    }),
  },
}
