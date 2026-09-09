import type { ReactNode } from 'react'
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
        <div data-element="print-gates">
          <div data-element="print-gates-heading">Before you can print</div>
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
        // the PrintPanel button's styles, unchanged — except that the disabled
        // look now follows the real `disabled` (it used to key off
        // submitBlocked alone, so a two-stage seam miss left a dead button
        // looking live)
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: 'none',
          background: submit.disabled
            ? 'rgba(75,85,99,0.55)'
            : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
          color: submit.disabled ? 'rgba(209,213,219,0.7)' : '#fff',
          fontSize: 13,
          fontWeight: 700,
          cursor: submit.disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {submit.label}
      </button>
    </>
  )
}
