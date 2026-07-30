// Abacus Studio — JobNotices stories (Gitea #29, THH #429).
//
// Each `cause` the print service documents, staged without a live service. All
// five are the same visual line by design: the reader's situation is identical
// in every one of them ("nothing looked at the plate"), and only the service's
// own sentence differs. These stories exist to check that sentence reads well
// at the panel's real width — the notice wraps to three lines in the quota case
// and must stay legible there.

import type { Meta, StoryObj } from '@storybook/react'
import { JobNotices } from './JobNotices'

const meta: Meta<typeof JobNotices> = {
  title: 'AbacusStudio/JobNotices',
  component: JobNotices,
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

type Story = StoryObj<typeof JobNotices>

/** The incident that produced THH #429: their OpenAI billing was exhausted, and
 *  our print parked at `needs_attention` reading "bed-clear request failed".
 *  Now it runs, and this is the only thing that says the bed went unchecked.
 *  The longest copy of the five — the wrap test. */
export const QuotaExhausted: Story = {
  args: {
    notices: [
      {
        code: 'bed_check_unavailable',
        detail:
          'the bed wasn’t checked — the OpenAI account is out of quota. Nothing looked at the build plate. Top up billing at platform.openai.com to bring the check back.',
        cause: 'insufficient_quota',
      },
    ],
  },
}

/** Rate-limited rather than unpaid: the one 429 that fixes itself. */
export const RateLimited: Story = {
  args: {
    notices: [
      {
        code: 'bed_check_unavailable',
        detail:
          'the bed wasn’t checked — OpenAI rate-limited the request (HTTP 429). Nothing looked at the build plate. A retry should succeed.',
        cause: 'http_429',
      },
    ],
  },
}

/** The service couldn't reach its vision provider at all. */
export const NetworkDown: Story = {
  args: {
    notices: [
      {
        code: 'bed_check_unavailable',
        detail:
          'the bed wasn’t checked — could not reach OpenAI (URLError). Nothing looked at the build plate.',
        cause: 'network',
      },
    ],
  },
}

/** The camera blinked — no frame to judge. */
export const NoFrame: Story = {
  args: {
    notices: [
      {
        code: 'bed_check_unavailable',
        detail:
          'the bed wasn’t checked — camera frame unavailable. Nothing looked at the build plate.',
        cause: 'no_frame',
      },
    ],
  },
}

/** The check itself threw. Rare, and the one cause that means the service has a
 *  bug rather than a dependency having a bad day. */
export const CaptureFailed: Story = {
  args: {
    notices: [
      {
        code: 'bed_check_unavailable',
        detail:
          'the bed wasn’t checked — the bed-clear check crashed. Nothing looked at the build plate.',
        cause: 'capture_failed',
      },
    ],
  },
}

/** A notice the service sent with no prose attached — the code is the fallback,
 *  and it is deliberately ugly: it should look like something to go fix. */
export const NoProse: Story = {
  args: { notices: [{ code: 'bed_check_unavailable', detail: null, cause: null }] },
}

/** Nothing went unchecked. Renders nothing — a normal print is unchanged, which
 *  is the criterion that keeps this feature from becoming panel noise. */
export const Healthy: Story = {
  args: { notices: [] },
}
