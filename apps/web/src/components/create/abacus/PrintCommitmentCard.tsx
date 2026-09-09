import type { ReactNode } from 'react'
import { COMMITMENT_LABELS, COMMITMENT_ORDER, type CommitmentSummary } from './abacus-commitment'

export function PrintCommitmentCard({
  summary,
  plate,
  heading = 'What you’ll print',
}: {
  summary: CommitmentSummary
  plate?: ReactNode
  heading?: string
}) {
  return (
    <section
      data-element="print-commitment-card"
      aria-label={heading}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 8 }}>{heading}</div>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 1fr',
          rowGap: 6,
          columnGap: 10,
          margin: 0,
        }}
      >
        {COMMITMENT_ORDER.map((key) => (
          <div
            key={key}
            data-element="print-commitment-line"
            data-line={key}
            style={{ display: 'contents' }}
          >
            <dt style={{ fontSize: 10, color: 'rgba(148,163,184,0.95)' }}>
              {COMMITMENT_LABELS[key]}
            </dt>
            <dd style={{ margin: 0, fontSize: 12, color: 'rgba(243,244,246,1)', lineHeight: 1.4 }}>
              {summary[key].value}
              {summary[key].note && (
                <div
                  data-element="print-commitment-note"
                  style={{ fontSize: 10, color: 'rgba(148,163,184,0.85)' }}
                >
                  {summary[key].note}
                </div>
              )}
            </dd>
            {key === 'pieces' && plate && (
              <div data-element="print-commitment-plate" style={{ gridColumn: '1 / -1' }}>
                {plate}
              </div>
            )}
          </div>
        ))}
      </dl>
    </section>
  )
}
