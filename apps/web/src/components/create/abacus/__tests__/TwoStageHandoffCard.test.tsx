/**
 * TwoStageHandoffCard — the operator's way back into a two-stage print (Gitea #38).
 *
 * The case these pin is the one that stranded a real print: Stage A clogged and was
 * stopped by hand with four good TPU feet already on the bed. The job ledger called
 * that `canceled`, and the card used to answer "there is nothing to chain onto —
 * clear the plate and print Stage A again", which means scrapping good parts because
 * of a record. Every state where the operator can be looking at printable parts now
 * offers the vouch instead.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TwoStageHandoffCard, type TwoStageHandoffCardProps } from '../TwoStageHandoffCard'
import { STAGE_B_VOUCH_DISCLAIMER } from '../two-stage-print'

function renderCard(over: Partial<TwoStageHandoffCardProps> = {}) {
  const props: TwoStageHandoffCardProps = {
    name: 'Abacus — 4 columns',
    view: { kind: 'ready-for-b', retry: false },
    disabled: false,
    disabledReason: null,
    submitting: false,
    onSubmitStageB: vi.fn(),
    onVouchStageB: vi.fn(),
    onForget: vi.fn(),
    unattendedStart: false,
    onUnattendedStartChange: vi.fn(),
    ...over,
  }
  render(<TwoStageHandoffCard {...props} />)
  return props
}

const vouchButton = () => screen.getByRole('button', { name: /print Stage B anyway/i })

describe('TwoStageHandoffCard', () => {
  it.each(['canceled', 'failed'])('a Stage A that %s is not a dead end', (phase) => {
    const props = renderCard({ view: { kind: 'stage-a-ended', phase } })
    // The old copy told the operator to bin the parts. It must not come back.
    expect(screen.queryByText(/print Stage A\s+again/i)).toBeNull()
    fireEvent.click(vouchButton())
    expect(props.onVouchStageB).toHaveBeenCalledTimes(1)
    expect(props.onSubmitStageB).not.toHaveBeenCalled()
  })

  it('says everything the service will not check before it offers the override', () => {
    renderCard({ view: { kind: 'stage-a-ended', phase: 'canceled' } })
    for (const line of STAGE_B_VOUCH_DISCLAIMER) expect(screen.getByText(line)).toBeTruthy()
  })

  it('offers the override alongside the ordinary submit, not instead of it', () => {
    const props = renderCard({ view: { kind: 'ready-for-b', retry: true } })
    fireEvent.click(screen.getByRole('button', { name: /Submit Stage B again/i }))
    expect(props.onSubmitStageB).toHaveBeenCalledTimes(1)
    fireEvent.click(vouchButton())
    expect(props.onVouchStageB).toHaveBeenCalledTimes(1)
  })

  it('holds the override behind the same gate as the ordinary submit', () => {
    const props = renderCard({
      view: { kind: 'stage-a-ended', phase: 'canceled' },
      disabled: true,
      disabledReason: 'The feet seam has to land on a layer boundary',
    })
    fireEvent.click(vouchButton())
    expect(props.onVouchStageB).not.toHaveBeenCalled()
  })

  it.each([
    ['stage-a-running', { kind: 'stage-a-running', phase: 'printing' }],
    ['stage-b-open', { kind: 'stage-b-open', phase: 'printing' }],
    ['done', { kind: 'done' }],
  ] as const)('offers nothing to vouch for while %s', (_label, view) => {
    renderCard({ view })
    expect(screen.queryByRole('button', { name: /print Stage B anyway/i })).toBeNull()
  })
})

/** The opt-in unattended start (things-haunt-house `chain.startWhenFeedClears`): the one
 *  control that can make the printer move with nobody pressing anything, so it is off
 *  until the operator ticks it and the consequence is on the card in both states. */
describe('the unattended Stage B start', () => {
  const box = () => screen.getByRole('checkbox', { name: /start Stage B by itself/i })

  it('is off by default, and says so: Stage B waits for one tap', () => {
    renderCard()
    expect(box()).not.toBeChecked()
    expect(screen.getByText(/waits for one tap on its job card/i)).toBeTruthy()
    expect(screen.queryByText(/with no tap/i)).toBeNull()
  })

  it('ticking it hands the choice to the panel, which owns the persisted preference', () => {
    const props = renderCard()
    fireEvent.click(box())
    expect(props.onUnattendedStartChange).toHaveBeenCalledWith(true)
  })

  it('on, the caveat is right under the box: the sensor sees the spool, not the tube or your hands', () => {
    renderCard({ unattendedStart: true })
    expect(box()).toBeChecked()
    expect(screen.getByText(/with no tap/i)).toBeTruthy()
    expect(screen.getByText(/not the AMS tube, the door or your hands/i)).toBeTruthy()
  })

  it('is offered with the vouch too, since a vouched Stage B chains the same way', () => {
    renderCard({ view: { kind: 'stage-a-ended', phase: 'canceled' } })
    expect(box()).not.toBeChecked()
  })

  it.each([
    { kind: 'stage-a-running', phase: 'printing' } as const,
    { kind: 'stage-b-open', phase: 'needs_attention' } as const,
    { kind: 'done' } as const,
  ])('is not on the card at $kind — it only shapes the next submit', (view) => {
    renderCard({ view })
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
