/**
 * StudioNotice — the studio's one way of interrupting.
 *
 * The tone is carried by a 3 px LEFT BAR, not an outline, and this test pins the
 * bar to theme.ts rather than to a hex it copies: the whole point of the theme
 * file is that a tone is defined once, and a notice that quietly grows its own
 * amber is the failure mode.
 *
 * Roles are pinned too. Only `danger` defaults to `alert` — a one-shot failure
 * that stands between the user and a print. ok/info/warn are `status`: a warn
 * notice stays up for as long as a setting is wrong and typically recomputes as
 * a slider moves, so an assertive role would interrupt on every step of a drag.
 * A danger box that recomputes the same way overrides to `role="status"`.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StudioNotice } from '../StudioNotice'
import { STUDIO, type StudioTone } from '../theme'

/** jsdom rewrites colours when it parses them; normalise both sides the same way. */
function asCss(color: string) {
  const probe = document.createElement('div')
  probe.style.borderLeftColor = color
  return probe.style.borderLeftColor
}

const CASES: Array<[StudioTone, string]> = [
  ['ok', 'status'],
  ['info', 'status'],
  ['warn', 'status'],
  ['danger', 'alert'],
]

describe('StudioNotice', () => {
  it.each(CASES)('%s wears the theme bar and the %s role', (tone, role) => {
    render(<StudioNotice tone={tone}>Something to know.</StudioNotice>)
    const el = screen.getByRole(role)
    expect(el).toHaveTextContent('Something to know.')
    expect(el.style.borderLeftColor).toBe(asCss(STUDIO.color.tone[tone].bar))
    expect(el.style.borderLeftWidth).toBe('3px')
    expect(el.dataset.tone).toBe(tone)
  })

  it('lets a caller override the role', () => {
    render(
      <StudioNotice tone="danger" role="status">
        Quietly.
      </StudioNotice>
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Quietly.')
  })

  it('renders a title and actions alongside the body', () => {
    render(
      <StudioNotice
        tone="warn"
        title="Plate is crowded"
        actions={<button type="button">Shrink the brim</button>}
      >
        Two objects are within 3 mm of the tower.
      </StudioNotice>
    )
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Plate is crowded')
    expect(el).toHaveTextContent('Two objects are within 3 mm of the tower.')
    expect(screen.getByRole('button', { name: 'Shrink the brim' })).toBeInTheDocument()
  })

  it('carries a default data-element a caller can override', () => {
    const { container, rerender } = render(<StudioNotice tone="info">Hi.</StudioNotice>)
    expect(container.querySelector('[data-element="studio-notice"]')).not.toBeNull()
    rerender(
      <StudioNotice tone="info" dataElement="print-gate-brim">
        Hi.
      </StudioNotice>
    )
    expect(container.querySelector('[data-element="print-gate-brim"]')).not.toBeNull()
  })
})
