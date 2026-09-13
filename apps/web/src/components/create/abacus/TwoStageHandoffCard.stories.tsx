// Abacus Studio — TwoStageHandoffCard stories (Gitea #38 / things-haunt-house #456).
//
// Every state the hand-off card passes through over the life of a two-stage feet
// print, staged without a print service. The states are exactly the variants of
// `HandoffView` — what `handoffView()` decides from the two job ids and the
// roster — plus the ways the Stage B button can be held back. The phases in the
// running/open states are rendered verbatim from the roster, which is why a
// parked stage reads as its raw `needs_attention` here: that is what ships.
import type { Meta, StoryObj } from '@storybook/react'
import { TwoStageHandoffCard } from './TwoStageHandoffCard'

const meta: Meta<typeof TwoStageHandoffCard> = {
  title: 'AbacusStudio/TwoStageHandoffCard',
  component: TwoStageHandoffCard,
  tags: ['autodocs'],
  args: {
    name: 'Abacus — 4 columns',
    disabled: false,
    disabledReason: null,
    submitting: false,
    onSubmitStageB: () => {},
    onVouchStageB: () => {},
    onForget: () => {},
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
          color: 'rgba(226,232,240,0.98)',
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
type Story = StoryObj<typeof TwoStageHandoffCard>

// ── Stage A ─────────────────────────────────────────────────────────────────

/** Just submitted: the record exists but the roster hasn't shown the job yet
 *  (the doorbell ring is on its way). */
export const StageANotListedYet: Story = {
  args: { view: { kind: 'stage-a-running', phase: null } },
}

/** The feet are printing from the external spool. Nothing to do but wait. */
export const StageAPrinting: Story = {
  args: { view: { kind: 'stage-a-running', phase: 'printing' } },
}

/** Stage A parked (for instance `awaiting_external_spool`, #463): the card only
 *  knows the phase; the reasons live on the job card further down the panel. */
export const StageAParked: Story = {
  args: { view: { kind: 'stage-a-running', phase: 'needs_attention' } },
}

/** Stage A failed. The service will not chain onto it, but a stage that died after its
 *  parts were down still left them there — so the card offers the operator's override
 *  rather than a dead end. */
export const StageAFailed: Story = {
  args: { view: { kind: 'stage-a-ended', phase: 'failed' } },
}

/** Stage A canceled by the operator — the common case: a clog mid-print, stopped by hand
 *  with four good feet already on the bed. */
export const StageACanceled: Story = {
  args: { view: { kind: 'stage-a-ended', phase: 'canceled' } },
}

// ── The hand-off ────────────────────────────────────────────────────────────

/** Stage A completed: the steps the operator does at the printer, then the
 *  Stage B submit. This is the card doing its actual job. */
export const ReadyForStageB: Story = {
  args: { view: { kind: 'ready-for-b', retry: false } },
}

/** A submitted Stage B failed or was canceled before it started. Stage A is
 *  still the last thing on the plate, so it can be submitted again. */
export const ReadyForStageBRetry: Story = {
  args: { view: { kind: 'ready-for-b', retry: true } },
}

/** The Stage B render + upload is in flight; the submit gate blocks a second
 *  click while it runs. */
export const SubmittingStageB: Story = {
  args: { view: { kind: 'ready-for-b', retry: false }, disabled: true, submitting: true },
}

/** The feet tray was swapped for something that isn't AMS TPU between the
 *  stages: Stage B can't chain until it is reloaded. Reason is the button's
 *  title — hover to read it. */
export const FeetTrayNoLongerTpu: Story = {
  args: {
    view: { kind: 'ready-for-b', retry: false },
    disabled: true,
    disabledReason: 'The feet tray is no longer an AMS TPU spool — reload it to chain Stage B',
  },
}

/** The experimental feet-only variant (Gitea #45): Stage A printed only the feet,
 *  so the hand-off says Stage B goes back to the plate for the supports first. */
export const FeetOnlyReadyForStageB: Story = {
  args: { variant: 'feet-only', view: { kind: 'ready-for-b', retry: false } },
}

/** The print style changed so the seam no longer lands on a layer boundary. */
export const SeamOffLayerGrid: Story = {
  args: {
    view: { kind: 'ready-for-b', retry: false },
    disabled: true,
    disabledReason: 'The feet seam has to land on a layer boundary',
  },
}

/** The ordinary submit gate (service not ready, a role unplaced, …) with no
 *  card-level reason: a grey button and nothing that says why. On touch there
 *  is no hover, so this is the dead end to fix — the story keeps it visible. */
export const BlockedWithoutReason: Story = {
  args: { view: { kind: 'ready-for-b', retry: false }, disabled: true },
}

// ── Stage B ─────────────────────────────────────────────────────────────────

/** Stage B submitted; the roster hasn't shown it yet. */
export const StageBNotListedYet: Story = {
  args: { view: { kind: 'stage-b-open', phase: null } },
}

/** Stage B sliced and sitting `ready` — the shape of a `hold` start policy, or
 *  the moment before an `auto` one goes. Whatever it needs is on its job card. */
export const StageBHeld: Story = {
  args: { view: { kind: 'stage-b-open', phase: 'ready' } },
}

/** Stage B parked by the gateway (spool still on the external feed, the bed
 *  not matching Stage A's finish frames, chained starts switched off). */
export const StageBParked: Story = {
  args: { view: { kind: 'stage-b-open', phase: 'needs_attention' } },
}

/** The body is printing onto the feet. */
export const StageBPrinting: Story = {
  args: { view: { kind: 'stage-b-open', phase: 'printing' } },
}

/** Both stages completed. The only control left is to forget the record. */
export const Done: Story = {
  args: { view: { kind: 'done' } },
}
