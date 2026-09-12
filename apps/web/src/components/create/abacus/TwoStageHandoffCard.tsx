// Abacus Studio — the Stage A → Stage B hand-off (Gitea #38 / things-haunt-house #456).
//
// One card for the whole life of a two-stage feet print, keyed on `HandoffView`:
// what Stage A is doing, the operator's steps between the stages, the Stage B
// submit, and the way out. Pure presentation — the panel owns the record, the
// job roster and the submit; this only renders what `handoffView` decided.
import { button, CARD, STUDIO } from '@/components/studio/theme'
import {
  type HandoffView,
  STAGE_B_VOUCH_DISCLAIMER,
  stageBHandoffSteps,
  TWO_STAGE_VARIANT_COPY,
  type TwoStageVariant,
} from './two-stage-print'

export interface TwoStageHandoffCardProps {
  /** The design the pair of jobs prints — the two-stage record's name. */
  name: string
  /** Which two-stage print this is (Gitea #45) — from the record, never the panel's checkbox. */
  variant?: TwoStageVariant
  view: HandoffView
  /** Stage B can't be submitted right now (the ordinary submit gate, the feet tray, the seam). */
  disabled: boolean
  /** The reason worth words, when there is one; it becomes the button's title. */
  disabledReason: string | null
  /** The Stage B submit is in flight (render + upload). */
  submitting: boolean
  onSubmitStageB: () => void
  /** Submit Stage B on the operator's word about the plate, past the service's ledger
   *  checks. The only way back in when a stage died with good parts on the bed. */
  onVouchStageB: () => void
  /** Drop the record: the panel goes back to the one-job / Stage A choice. */
  onForget: () => void
}

export function TwoStageHandoffCard({
  name,
  variant = 'tpu-floor',
  view,
  disabled,
  disabledReason,
  submitting,
  onSubmitStageB,
  onVouchStageB,
  onForget,
}: TwoStageHandoffCardProps) {
  // The override, offered in the two places an operator can be standing in front of good
  // parts the ledger has written off: a stage that ended badly, and a chain the service
  // refuses. Deliberately verbose — it trades away every check the service would have run.
  const vouchOffer = (lead: string, tone: 'primary' | 'chip') => (
    <div data-element="stage-b-vouch" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: STUDIO.color.text2 }}>{lead}</span>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          color: STUDIO.color.text2,
        }}
      >
        {STAGE_B_VOUCH_DISCLAIMER.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        data-action="vouch-stage-b"
        onClick={onVouchStageB}
        disabled={disabled}
        title={disabledReason ?? 'Print Stage B onto parts you have checked are on the plate'}
        style={
          tone === 'primary'
            ? button('primary', { disabled })
            : { ...button('chip'), alignSelf: 'flex-start' }
        }
      >
        {submitting
          ? 'Rendering & submitting…'
          : '🖨 The parts are on the plate — print Stage B anyway'}
      </button>
    </div>
  )
  return (
    <div
      data-element="two-stage-handoff"
      data-handoff={view.kind}
      data-variant={variant}
      style={{
        ...CARD,
        // the one card that is a live thread rather than a summary — it keeps the
        // accent edge so the hand-off reads as the thing currently happening
        border: `1px solid ${STUDIO.color.accentBorder}`,
        display: 'flex',
        flexDirection: 'column',
        gap: STUDIO.space.card,
        lineHeight: 1.45,
      }}
    >
      <strong style={STUDIO.type.strong}>Two-stage print — {name}</strong>
      {view.kind === 'stage-a-running' ? (
        <span>
          Stage A (feet) is {view.phase ?? 'not in the job list yet'} — Stage B unlocks when it
          completes.
        </span>
      ) : view.kind === 'stage-a-ended' ? (
        <>
          <span>
            Stage A {view.phase} — so the print service will not chain onto it. That is a statement
            about the job, not about the plate: a stage stopped after its parts were down leaves
            them there, and they are still printable.
          </span>
          {vouchOffer(
            "If Stage A's parts are on the plate, say so and Stage B will print onto them.",
            'primary'
          )}
        </>
      ) : view.kind === 'stage-b-open' ? (
        <span>
          Stage B (body) is {view.phase ?? 'on its way to the job list'} — resolve it from its job
          card below.
        </span>
      ) : view.kind === 'done' ? (
        <span>Stage B completed — the abacus is done. Forget this print to start another.</span>
      ) : (
        <>
          <span>
            {view.retry
              ? 'Stage B did not start — it can be submitted again while Stage A is still the last thing on the plate.'
              : variant === 'feet-only'
                ? `Stage A (feet) is done — Stage B ${TWO_STAGE_VARIANT_COPY['feet-only'].stageB}.`
                : 'Stage A (feet) is done.'}{' '}
            Before Stage B:
          </span>
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              color: STUDIO.color.text2,
            }}
          >
            {stageBHandoffSteps(variant).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            data-action="submit-stage-b"
            onClick={onSubmitStageB}
            disabled={disabled}
            title={disabledReason ?? 'Chain the body onto the feet Stage A printed'}
            style={button('primary', { disabled })}
          >
            {submitting
              ? 'Rendering & submitting…'
              : view.retry
                ? '🖨 Submit Stage B again'
                : '🖨 Submit Stage B (body)'}
          </button>
          {vouchOffer(
            'Refused because the chain is broken — something else printed here, or Stage A ended badly? The plate is the only thing that actually matters, and you can see it.',
            'chip'
          )}
        </>
      )}
      <button
        type="button"
        data-action="forget-two-stage"
        onClick={onForget}
        style={{ ...button('chip'), alignSelf: 'flex-start' }}
      >
        Forget this two-stage print
      </button>
    </div>
  )
}
