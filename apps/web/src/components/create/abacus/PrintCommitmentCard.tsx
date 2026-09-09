import type { ReactNode } from 'react'
import { CARD, STUDIO } from '@/components/studio/theme'
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
    <section data-element="print-commitment-card" aria-label={heading} style={CARD}>
      <div style={{ ...STUDIO.type.eyebrow, marginBottom: 10 }}>{heading}</div>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 1fr',
          rowGap: STUDIO.space.card,
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
            <dt style={STUDIO.type.note}>{COMMITMENT_LABELS[key]}</dt>
            <dd style={{ ...STUDIO.type.value, margin: 0, lineHeight: 1.4 }}>
              {summary[key].value}
              {summary[key].note && (
                <div data-element="print-commitment-note" style={STUDIO.type.note}>
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
