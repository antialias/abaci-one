/**
 * The mapping panel is TOTAL over `materialize`'s output — including the rows
 * `materialize` has always been contractually allowed to produce and the panel
 * never handled: `spoolIndex: NO_SPOOL` for a role the service could not place.
 *
 * The first live end-to-end plans (THH#446 era) produced exactly that, and an
 * unguarded `catalog.spools[-1].name` took the entire panel down into the
 * fabrication error boundary. This render is the regression test: staging an
 * unplaced role must yield a labelled "no spool" row, not a throw.
 */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { stubFilamentPlan } from '../__fixtures__/filament-plan-stub'
import type { FilamentCatalog, FilamentSpool } from '../abacus-catalog'
import { toAbacusDesign } from '../abacus-design'
import { defaultParams } from '../abacus-model'
import { FilamentPlanPanel } from '../FilamentPlanPanel'

const spool = (id: string, name: string, hex: string): FilamentSpool => ({
  id,
  name,
  hex,
  material: 'PLA',
})
const catalog: FilamentCatalog = {
  source: 'thh-ams',
  fetchedAt: '2026-08-18T00:00:00Z',
  spools: [spool('s-a', 'Matte Black', '#000000'), spool('s-b', 'Matte White', '#ffffff')],
}
const design = toAbacusDesign({ ...defaultParams, color_scheme: 'heaven-earth' }, 'test-profile')

const renderPanel = (extra: Parameters<typeof FilamentPlanPanel>[0] extends infer P
  ? Partial<P>
  : never) =>
  render(
    <FilamentPlanPanel
      design={design}
      catalog={catalog}
      overrides={{}}
      onOverridesChange={() => {}}
      {...extra}
    />
  )

describe('FilamentPlanPanel — a role the service could not place', () => {
  it('renders a labelled unplaced row instead of crashing on spools[-1]', () => {
    const plan = stubFilamentPlan(design, catalog, {}, {
      unplaced: ['bead-0'],
      status: 'unresolved',
    })
    const { container, getAllByText } = renderPanel({ servicePlan: plan })
    const tile = container.querySelector(
      '[data-element="abacus-studio-role-tile"][data-role="bead-0"]'
    )
    expect(tile).not.toBeNull()
    expect(tile?.getAttribute('data-unplaced')).toBe('true')
    expect(getAllByText('no spool').length).toBeGreaterThan(0)
    // placed rows are untouched by the guard
    const placed = container.querySelector(
      '[data-element="abacus-studio-role-tile"][data-role="frame"]'
    )
    expect(placed?.getAttribute('data-unplaced')).toBe('false')
  })
})

describe('FilamentPlanPanel — the async plan announces itself', () => {
  it('shows the pending line while the service is answering, and only then', () => {
    const plan = stubFilamentPlan(design, catalog)
    const pending = renderPanel({ servicePlan: plan, planPending: true })
    expect(pending.queryByText(/asking your printer/)).not.toBeNull()
    pending.unmount()
    const settled = renderPanel({ servicePlan: plan, planPending: false })
    expect(settled.queryByText(/asking your printer/)).toBeNull()
  })
})
