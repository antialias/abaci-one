/**
 * JobNotices (Gitea #29, THH #429) — the advisory channel on a print job.
 *
 * The acceptance criteria this pins are all about VISIBILITY, because the whole
 * point of the upstream change is that a service outage no longer stops the
 * print: we send `startPolicy: 'auto'`, so a job carrying one of these already
 * ran with nothing having looked at the build plate. If this doesn't render,
 * that fact reaches nobody.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JobNotices } from '../JobNotices'
import type { JobNotice } from '../print-jobs'

/** The shape THH documents for an exhausted vision quota, verbatim. */
const quota: JobNotice = {
  code: 'bed_check_unavailable',
  detail:
    'the bed wasn’t checked — the OpenAI account is out of quota. Nothing looked at the build plate. Top up billing at platform.openai.com to bring the check back.',
  cause: 'insufficient_quota',
}

describe('JobNotices', () => {
  it('a normal print renders nothing at all', () => {
    const { container } = render(<JobNotices notices={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the service sentence verbatim, never truncated', () => {
    render(<JobNotices notices={[quota]} />)
    // The tail is the actionable part — assert on the WHOLE sentence, not a
    // prefix, so a future truncation fails here rather than in the field.
    expect(screen.getByText(quota.detail as string)).toBeInTheDocument()
  })

  it('carries the machine cause out as a data attribute, not as copy', () => {
    const { container } = render(<JobNotices notices={[quota]} />)
    const line = container.querySelector('[data-element="print-job-notice"]')
    expect(line).not.toBeNull()
    expect(line?.getAttribute('data-cause')).toBe('insufficient_quota')
    expect(line?.getAttribute('data-code')).toBe('bed_check_unavailable')
    // `cause` is a class name, not a sentence — it must never reach the reader.
    expect(line?.textContent).not.toContain('insufficient_quota')
  })

  it('falls back to the code when the service sent no prose', () => {
    render(<JobNotices notices={[{ code: 'bed_check_unavailable', detail: null, cause: null }]} />)
    expect(screen.getByText('bed_check_unavailable')).toBeInTheDocument()
  })

  it('renders every notice, not just the first', () => {
    const { container } = render(
      <JobNotices
        notices={[
          quota,
          {
            code: 'bed_check_unavailable',
            detail: 'the camera frame was unavailable.',
            cause: 'no_frame',
          },
        ]}
      />
    )
    expect(container.querySelectorAll('[data-element="print-job-notice"]')).toHaveLength(2)
  })

  it('a cause-less notice still renders (the attribute is simply absent)', () => {
    const { container } = render(
      <JobNotices notices={[{ code: 'x', detail: 'something went unchecked.', cause: null }]} />
    )
    const line = container.querySelector('[data-element="print-job-notice"]')
    expect(line?.hasAttribute('data-cause')).toBe(false)
    expect(screen.getByText('something went unchecked.')).toBeInTheDocument()
  })
})
