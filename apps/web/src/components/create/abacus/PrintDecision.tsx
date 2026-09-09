import type { ReactNode } from 'react'
import { button, STUDIO } from '@/components/studio/theme'
import type { CommitmentSummary } from './abacus-commitment'
import { PrintCommitmentCard } from './PrintCommitmentCard'

export interface PrintDecisionProps {
  summary: CommitmentSummary
  plate?: ReactNode
  gates: ReactNode[]
  prep?: ReactNode
  submit: {
    label: string
    disabled: boolean
    pending: boolean
    onClick: () => void
    title?: string
  }
}
export function PrintDecision({ summary, plate, gates, prep, submit }: PrintDecisionProps) {
  return (
    <>
      <PrintCommitmentCard summary={summary} plate={plate} />
      {gates.length > 0 && (
        <div
          data-element="print-gates"
          style={{ display: 'flex', flexDirection: 'column', gap: STUDIO.space.card }}
        >
          <div
            data-element="print-gates-heading"
            style={{ ...STUDIO.type.eyebrow, marginBottom: 2 }}
          >
            Before you can print
          </div>
          {gates}
        </div>
      )}
      {prep}
      <button
        type="button"
        data-action="submit-print-job"
        disabled={submit.disabled}
        onClick={submit.onClick}
        title={submit.title}
        // the studio's ONE primary style — the disabled look follows the real
        // `disabled` (it used to key off submitBlocked alone, so a two-stage seam
        // miss left a dead button looking live)
        style={button('primary', { disabled: submit.disabled })}
      >
        {submit.label}
      </button>
    </>
  )
}
