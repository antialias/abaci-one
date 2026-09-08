// Abacus Studio — the Stage A → Stage B hand-off (Gitea #38 / things-haunt-house #456).
//
// One card for the whole life of a two-stage feet print, keyed on `HandoffView`:
// what Stage A is doing, the operator's steps between the stages, the Stage B
// submit, and the way out. Pure presentation — the panel owns the record, the
// job roster and the submit; this only renders what `handoffView` decided.
import { type HandoffView, STAGE_B_HANDOFF_STEPS } from './two-stage-print'

export interface TwoStageHandoffCardProps {
  /** The design the pair of jobs prints — the two-stage record's name. */
  name: string
  view: HandoffView
  /** Stage B can't be submitted right now (the ordinary submit gate, the feet tray, the seam). */
  disabled: boolean
  /** The reason worth words, when there is one; it becomes the button's title. */
  disabledReason: string | null
  /** The Stage B submit is in flight (render + upload). */
  submitting: boolean
  onSubmitStageB: () => void
  /** Drop the record: the panel goes back to the one-job / Stage A choice. */
  onForget: () => void
}

export function TwoStageHandoffCard({
  name,
  view,
  disabled,
  disabledReason,
  submitting,
  onSubmitStageB,
  onForget,
}: TwoStageHandoffCardProps) {
  return (
    <div
      data-element="two-stage-handoff"
      data-handoff={view.kind}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'rgba(30,41,59,0.6)',
        border: '1px solid rgba(34,211,238,0.45)',
        lineHeight: 1.45,
      }}
    >
      <strong style={{ color: 'rgba(226,232,240,0.98)' }}>Two-stage print — {name}</strong>
      {view.kind === 'stage-a-running' ? (
        <span>
          Stage A (feet) is {view.phase ?? 'not in the job list yet'} — Stage B unlocks when it
          completes.
        </span>
      ) : view.kind === 'stage-a-ended' ? (
        <span>
          Stage A {view.phase} — there is nothing to chain onto. Clear the plate and print Stage A
          again.
        </span>
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
              color: 'rgba(203,213,225,0.96)',
            }}
          >
            {STAGE_B_HANDOFF_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            data-action="submit-stage-b"
            onClick={onSubmitStageB}
            disabled={disabled}
            title={disabledReason ?? 'Chain the body onto the feet Stage A printed'}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: disabled
                ? 'rgba(75,85,99,0.55)'
                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: disabled ? 'rgba(209,213,219,0.7)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting
              ? 'Rendering & submitting…'
              : view.retry
                ? '🖨 Submit Stage B again'
                : '🖨 Submit Stage B (body)'}
          </button>
        </>
      )}
      <button
        type="button"
        data-action="forget-two-stage"
        onClick={onForget}
        style={{
          alignSelf: 'flex-start',
          padding: '3px 8px',
          borderRadius: 6,
          border: '1px solid rgba(148,163,184,0.45)',
          background: 'transparent',
          color: 'rgba(203,213,225,0.9)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Forget this two-stage print
      </button>
    </div>
  )
}
