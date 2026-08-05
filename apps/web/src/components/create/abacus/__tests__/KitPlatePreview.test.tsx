/**
 * KitPlatePreview (Gitea #32) — the build-plate picture.
 *
 * Pins the things a picture of a bed can get silently wrong: the Y-FLIP (3MF +Y
 * is the back of the bed, SVG y grows down — get it backwards and the drawing is
 * a mirror of the print, which looks perfectly plausible), the KEEP-OUT actually
 * being drawn (eink's preview honours it invisibly; ours draws it because it's
 * what the layout slides against), and a refusal rendering AS a refusal rather
 * than as an empty bed.
 *
 * Presentational, so it renders from plain geometry — no packer, no export, no
 * printer.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { KitPlateLayout, KitPlatePlacement } from '../abacus-kit-plate'
import { KitPlatePreview, labelFit } from '../KitPlatePreview'

const at = (over: Partial<KitPlatePlacement> = {}): KitPlatePlacement => ({
  id: 'm1',
  label: 'mid 1 of 11',
  kind: 'mid',
  column: 1,
  file: 'module_mid.3mf',
  xMm: 20,
  yMm: 30,
  rotated: false,
  wMm: 16,
  hMm: 100,
  ...over,
})

const layout = (over: Partial<KitPlateLayout> = {}): KitPlateLayout => ({
  placements: [at()],
  tower: { xMm: 180, yMm: 200, wMm: 70, dMm: 42, pinXMm: 215, pinYMm: 221 },
  bed: { wMm: 256, dMm: 256, exclude: [{ xMm: 0, yMm: 0, wMm: 18, dMm: 28 }] },
  ...over,
})

const rectOf = (el: Element | null): DOMStringMap & Record<string, string | null> =>
  ({
    x: el?.getAttribute('x') ?? null,
    y: el?.getAttribute('y') ?? null,
    width: el?.getAttribute('width') ?? null,
    height: el?.getAttribute('height') ?? null,
  }) as never

describe('KitPlatePreview', () => {
  it('draws the bed at 1:1 in millimetres, so no scale factor exists to get wrong', () => {
    const { container } = render(<KitPlatePreview layout={layout()} />)
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 256 256')
  })

  it('flips Y, because +Y in the 3MF is the BACK of the bed', () => {
    // A module at y=30 with depth 100 occupies 30..130 from the front. Drawn
    // without the flip it would sit at SVG y=30 — visually near the back — and
    // the whole picture would be a mirror of the print that still looked fine.
    const { container } = render(<KitPlatePreview layout={layout()} />)
    const rect = container.querySelector('[data-element="kit-plate-module"] rect')
    expect(rectOf(rect)).toMatchObject({ x: '20', y: '126', width: '16', height: '100' })
  })

  it('draws the printer keep-out — the thing the layout is slid clear of', () => {
    const { container } = render(<KitPlatePreview layout={layout()} />)
    const zone = container.querySelector('[data-element="kit-plate-keepout"] rect')
    // 18 × 28 at the bed origin ⇒ flipped to the bottom-left of the drawing.
    expect(rectOf(zone)).toMatchObject({ x: '0', y: '228', width: '18', height: '28' })
    expect(
      container.querySelector('[data-element="kit-plate-keepout"] title')?.textContent
    ).toMatch(/keep-out/i)
  })

  it('draws no keep-out when the printer declares none', () => {
    const { container } = render(
      <KitPlatePreview layout={layout({ bed: { wMm: 256, dMm: 256 } })} />
    )
    expect(container.querySelector('[data-element="kit-plate-keepout"]')).toBeNull()
  })

  it('draws the reserved purge tower', () => {
    const { container } = render(<KitPlatePreview layout={layout()} />)
    const tower = container.querySelector('[data-element="kit-plate-tower"] rect')
    expect(rectOf(tower)).toMatchObject({ x: '180', y: '14', width: '70', height: '42' })
    expect(tower?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(screen.getByText('purge')).toBeInTheDocument()
  })

  it('captions the bed with what is on it', () => {
    render(<KitPlatePreview layout={layout()} filaments={3} />)
    expect(screen.getByText(/256 × 256 mm bed · 1 module · 3 filaments/)).toBeInTheDocument()
  })

  it('renders a refusal as a refusal, not as an empty bed', () => {
    render(
      <KitPlatePreview
        layout={null}
        refusal={{
          headline: 'this kit needs 2 build plates',
          remediation: 'Print fewer columns.',
          modules: ['mid 11 of 11'],
        }}
      />
    )
    expect(screen.getByText('this kit needs 2 build plates')).toBeInTheDocument()
    expect(screen.getByText('Print fewer columns.')).toBeInTheDocument()
    expect(screen.getByText('mid 11 of 11')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('says it is working rather than showing an empty bed while it packs', () => {
    const { container } = render(<KitPlatePreview layout={null} pending />)
    expect(container.querySelector('[data-state="pending"]')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('names each module in its title, since colour deliberately carries no identity', () => {
    const { container } = render(
      <KitPlatePreview
        layout={layout({ placements: [at({ rotated: true, wMm: 100, hMm: 16 })] })}
      />
    )
    const titles = [...container.querySelectorAll('[data-element="kit-plate-module"] title')]
    expect(titles[0]?.textContent).toMatch(/mid 1 of 11 — 100.0 × 16.0 mm, turned 90°/)
  })
})

describe('the stories stay stories', () => {
  // The stories run the REAL packer, which means a packer change can quietly
  // turn "the shipped 13-column kit" into a refusal — and a refusal renders as
  // a perfectly tidy red card, so nobody looking at Storybook would notice the
  // gallery had stopped showing a packed bed at all.
  it('still packs the kits they claim to show', async () => {
    const stories = await import('../KitPlatePreview.stories')
    expect(stories.FullKit.args?.layout?.placements).toHaveLength(13)
    expect(stories.SupportsOn.args?.layout?.placements).toHaveLength(13)
    expect(stories.FourFilaments.args?.layout?.placements).toHaveLength(13)
    expect(stories.SmallKit.args?.layout?.placements).toHaveLength(4)
    expect(stories.NoKeepOut.args?.layout?.bed.exclude).toBeUndefined()
    expect(stories.WontFit.args?.layout).toBeNull()
    expect(stories.WontFit.args?.refusal?.headline).toBeTruthy()
  })

  it('shows a fourth filament costing more bed than three', async () => {
    // The per-count envelope read (Gitea #34) is why a 3-filament kit fits a bed
    // the 6-filament worst case would have taken away — and the gallery is where
    // that becomes visible, so it should stay visible.
    const stories = await import('../KitPlatePreview.stories')
    const three = stories.FullKit.args?.layout?.tower
    const four = stories.FourFilaments.args?.layout?.tower
    expect(four?.dMm).toBeGreaterThan(three?.dMm ?? Infinity)
  })
})

describe('labelFit', () => {
  it('measures text along the LONG side — a kit module is a tall narrow strip', () => {
    // 16 × 100 mm. Measured across the width, an 11-character label would score
    // (16 × 1.5) / 11 = 2.2 and vanish; every label on the plate would.
    expect(labelFit(16, 100, 'mid 1 of 11')).toBeGreaterThan(0)
  })

  it('gives up rather than drawing an illegible label', () => {
    expect(labelFit(4, 6, 'mid 1 of 11')).toBe(0)
  })

  it('never exceeds the eink ceiling, however much room there is', () => {
    expect(labelFit(400, 400, 'a')).toBe(11)
  })
})
