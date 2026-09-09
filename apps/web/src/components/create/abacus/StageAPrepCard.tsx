// Abacus Studio — the pre-Stage-A checklist (Gitea #38 / things-haunt-house #463).
//
// Shown while two-stage feet is on and no Stage A has been submitted yet: the
// feed swap the operator does at the printer BEFORE the feet stage. The steps
// live in `two-stage-print.ts` next to the Stage B hand-off steps so the two
// lists stay in one place; this is the presentation.
import { STAGE_A_PREP_STEPS, TWO_STAGE_VARIANT_COPY, type TwoStageVariant } from './two-stage-print'

export interface StageAPrepCardProps {
  /** Which two-stage print this is (Gitea #45); the feed swap is the same, the
   *  copy for what Stage A then prints is not. */
  variant?: TwoStageVariant
}

export function StageAPrepCard({ variant = 'tpu-floor' }: StageAPrepCardProps = {}) {
  return (
    <div
      data-element="two-stage-prep"
      data-variant={variant}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(8,145,178,0.12)',
        border: '1px solid rgba(34,211,238,0.35)',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontWeight: 600, color: 'rgba(226,232,240,0.98)' }}>
        Before Stage A — at the printer:
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
        {STAGE_A_PREP_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {variant === 'feet-only' && (
        <span data-element="two-stage-prep-variant" style={{ color: 'rgba(253,230,138,0.95)' }}>
          Feet-only (experimental): Stage A {TWO_STAGE_VARIANT_COPY['feet-only'].stageA}. Stage B{' '}
          {TWO_STAGE_VARIANT_COPY['feet-only'].stageB}.
        </span>
      )}
      <span style={{ color: 'rgba(148,163,184,0.95)', fontSize: 11 }}>
        If an AMS tray is still at the nozzle when you submit, the print service parks Stage A until
        you swap the feed. It can’t see what is on the external spool, so check the material
        yourself.
      </span>
    </div>
  )
}
