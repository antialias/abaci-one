// Abacus Studio — the pre-Stage-A checklist (Gitea #38 / things-haunt-house #463).
//
// Shown while two-stage feet is on and no Stage A has been submitted yet: the
// feed swap the operator does at the printer BEFORE the feet stage. The steps
// live in `two-stage-print.ts` next to the Stage B hand-off steps so the two
// lists stay in one place; this is the presentation.
import { StudioNotice } from '@/components/studio/StudioNotice'
import { STUDIO } from '@/components/studio/theme'
import { STAGE_A_PREP_STEPS } from './two-stage-print'

export function StageAPrepCard() {
  return (
    <StudioNotice tone="info" dataElement="two-stage-prep" title="Before Stage A — at the printer:">
      <ol
        style={{
          margin: 0,
          paddingLeft: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {STAGE_A_PREP_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div style={{ ...STUDIO.type.note, marginTop: 6 }}>
        If an AMS tray is still at the nozzle when you submit, the print service parks Stage A until
        you swap the feed. It can’t see what is on the external spool, so check the material
        yourself.
      </div>
    </StudioNotice>
  )
}
