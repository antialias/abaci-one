/**
 * The two studio rails, as a division of labour (Gitea epic #5, PR A). Three
 * properties are structural rather than cosmetic, so they are pinned here:
 *
 *  1. PAPER PAYS FOR NOTHING. The sticker-sheet lane realizes the same design
 *     through intentOf — columns, resolved colors, markers — so the design rail
 *     must not ask it about size, construction, ink, feet or engraving.
 *  2. ONE PRIMARY ACTION. With a paired print service the submit is the point of
 *     the print rail and the files are a fallback below it; with no service the
 *     main FILE is the commitment, so it goes above the pairing prompt and wears
 *     the cyan. Never two cyan buttons, never a file the user has to scroll past
 *     the panel to find.
 *  3. RIGHT RAIL, RIGHT QUESTION. Infill is how the thing is MADE, so it lives
 *     in the print rail and nowhere else — the design rail carried it for a
 *     while, which put a slicer question in front of people printing stickers.
 */
import { render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusStudio } from '../AbacusStudioContext'
import { defaultParams, type FilamentMap, type Params } from '../abacus-model'
import { DesignInspectorRail } from '../DesignInspectorRail'
import { FabricationRail } from '../FabricationRail'

vi.mock('../AbacusStudioContext', () => ({ useAbacusStudio: vi.fn() }))

// The rails' heavy children are somebody else's suite: the 2D preview, the
// identity chip, the filament reconcile strip and the whole print panel. Stubbed
// to their presence, which is all these tests read.
vi.mock('@soroban/abacus-react', () => ({ AbacusReact: () => <div data-element="mock-hero" /> }))
vi.mock('@/components/shared/PlayerPicker', () => ({
  PlayerPicker: () => <div data-element="mock-player-picker" />,
}))
vi.mock('../DesignLinkChip', () => ({
  DesignLinkChip: () => <div data-element="mock-link-chip" />,
}))
vi.mock('../MyDesignsList', () => ({ MyDesignsList: () => <div data-element="mock-my-designs" /> }))
vi.mock('../FilamentPlanPanel', () => ({
  FilamentPlanPanel: () => <div data-element="mock-filament-plan" />,
}))
vi.mock('../PrintPanel', () => ({ PrintPanel: () => <div data-element="mock-print-panel" /> }))
vi.mock('../abacus-3mf', () => ({ buildAbacusThreeMf: vi.fn() }))

const fm: FilamentMap = {
  slots: ['#1a1a1a', '#e11d48'],
  frame: 0,
  markerWhite: 0,
  markerBlack: 0,
  beadRoles: [1, 1, 1, 1, 1],
  markerContrast: 21,
  feet: 0,
}

function studio(params: Partial<Params> = {}, overrides: Record<string, unknown> = {}) {
  vi.mocked(useAbacusStudio).mockReturnValue({
    params: { ...defaultParams, ...params },
    set: vi.fn(),
    fabrication: { kind: 'fdm' },
    profileId: 'stock',
    setProfileId: vi.fn(),
    profile: { label: 'Stock' },
    thhFilaments: {},
    connections: [],
    catalog: { spools: [{ name: 'Matte Black' }, { name: 'Crimson' }] },
    filamentMap: fm,
    servicePlan: null,
    solveResult: { reasons: [] },
    errors: [],
    warnings: [],
    exportBlocked: false,
    exporterReady: true,
    requestExportStl: vi.fn(),
    requestExportParts: vi.fn(),
    requestExportPass: vi.fn(),
    requestExportModuleParts: vi.fn(),
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial context value
  } as any)
}

const railProps = {
  selectedPlayerId: null,
  onSelectPlayer: vi.fn(),
  playerUnavailable: false,
  onDesignSaved: vi.fn(),
}

// jsdom lacks ResizeObserver, which the radix slider under DebugSlider needs.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      // biome-ignore lint/suspicious/noExplicitAny: jsdom polyfill
    } as any
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  studio()
})

describe('DesignInspectorRail — the paper lane is asked nothing a printer owns', () => {
  it('drops size, construction, ink, feet and writing on paper', () => {
    studio({}, { fabrication: { kind: 'paper' } })
    const { container } = render(<DesignInspectorRail {...railProps} />)

    expect(screen.queryByText('size ×')).toBeNull()
    expect(container.querySelector('[data-element="abacus-construction"]')).toBeNull()
    expect(container.querySelector('[data-element="abacus-text-fill"]')).toBeNull()
    expect(container.querySelector('[data-element="abacus-section-feet"]')).toBeNull()
    expect(screen.queryByText('Writing')).toBeNull()

    // …and still asks the two questions the sticker sheet honours, plus the
    // markers, which are the camera loop's input on BOTH outputs.
    expect(screen.getByText('columns')).toBeInTheDocument()
    expect(container.querySelector('[data-element="abacus-section-colors"]')).not.toBeNull()
    expect(screen.getByText('color scheme')).toBeInTheDocument()
    expect(screen.getByText('camera markers')).toBeInTheDocument()
  })

  it('asks all of them on the 3D-print lane', () => {
    const { container } = render(<DesignInspectorRail {...railProps} />)
    expect(screen.getByText('size ×')).toBeInTheDocument()
    expect(container.querySelector('[data-element="abacus-construction"]')).not.toBeNull()
    expect(container.querySelector('[data-element="abacus-text-fill"]')).not.toBeNull()
    expect(container.querySelector('[data-element="abacus-section-feet"]')).not.toBeNull()
    expect(screen.getByText('Writing')).toBeInTheDocument()
  })
})

describe('FabricationRail — one primary action', () => {
  /** Does the file button come BEFORE the print panel in the rail? (jsdom's
   *  querySelectorAll groups a comma selector by branch rather than by document
   *  order, so the two nodes are compared directly.) */
  const fileBeforePanel = (container: HTMLElement, fileSelector: string) => {
    const file = container.querySelector(fileSelector)
    const panel = container.querySelector('[data-element="mock-print-panel"]')
    if (!file || !panel) throw new Error(`missing ${fileSelector} or the print panel`)
    return Boolean(file.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING)
  }

  it('unpaired: the 3MF is the commitment — above the panel, in cyan', () => {
    const { container } = render(<FabricationRail />)
    expect(fileBeforePanel(container, '[data-action="export-3mf"]')).toBe(true)
    const btn = container.querySelector('[data-action="export-3mf"]') as HTMLElement
    expect(btn.style.background).toContain('gradient')
  })

  it('unpaired: one commitment card sits immediately before the primary 3MF action', () => {
    const { container } = render(<FabricationRail />)
    const card = container.querySelector('[data-element="print-commitment-card"]')!
    const action = container.querySelector('[data-action="export-3mf"]')!
    expect(container.querySelectorAll('[data-element="print-commitment-card"]')).toHaveLength(1)
    expect(Boolean(card.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    )
    expect(card.querySelector('[data-line="pieces"]')?.textContent).toContain('One piece ·')
    const between = [...container.querySelectorAll('[data-action]')].filter(
      (node) =>
        Boolean(card.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(node.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING)
    )
    expect(between).toHaveLength(0)
  })

  it('paired: the submit is the commitment — files below it, secondary', () => {
    studio({}, { connections: [{ id: 'c1', name: 'Home printer' }] })
    const { container } = render(<FabricationRail />)
    expect(fileBeforePanel(container, '[data-action="export-3mf"]')).toBe(false)
    const btn = container.querySelector('[data-action="export-3mf"]') as HTMLElement
    expect(btn.style.background).not.toContain('gradient')
    expect(container.querySelectorAll('[data-element="print-commitment-card"]')).toHaveLength(0)
  })

  // paired is not the same as "can submit": a dead service or an empty roster
  // leaves the download as the only real action, so it takes the cyan and the
  // card comes up with it — instead of both hiding below a panel that can't act
  it.each([
    ['service unreachable', { thhFilaments: { unavailable: 'unreachable' } }],
    ['plan refused', { servicePlanUnavailable: 'unreachable' }],
    ['roster empty', { thhFilaments: { rosterEmpty: true } }],
  ] as const)('paired but %s: the download is the commitment again', (_label, overrides) => {
    studio({}, { connections: [{ id: 'c1', name: 'Home printer' }], ...overrides })
    const { container } = render(<FabricationRail />)
    expect(fileBeforePanel(container, '[data-action="export-3mf"]')).toBe(true)
    const btn = container.querySelector('[data-action="export-3mf"]') as HTMLElement
    expect(btn.style.background).toContain('gradient')
    const cards = container.querySelectorAll('[data-element="print-commitment-card"]')
    expect(cards).toHaveLength(1)
    expect(Boolean(cards[0].compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true
    )
  })

  it('modular: the kit zip replaces the 3MF outright', () => {
    studio({ seam_mode: 'modular' })
    const { container } = render(<FabricationRail />)
    expect(container.querySelector('[data-action="export-3mf"]')).toBeNull()
    expect(container.querySelector('[data-action="export-stl"]')).toBeNull()
    expect(fileBeforePanel(container, '[data-action="download-module-kit"]')).toBe(true)
    const kit = container.querySelector('[data-action="download-module-kit"]') as HTMLElement
    expect(kit.style.background).toContain('gradient')
    expect(screen.getByText(/engraved marker pockets/)).toBeInTheDocument()
    const card = container.querySelector('[data-element="print-commitment-card"]')!
    expect(Boolean(card.compareDocumentPosition(kit) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it('modular: the joint fit and its coupon ride in Print options, not Files', () => {
    studio({ seam_mode: 'modular' })
    const { container } = render(<FabricationRail />)
    const options = container.querySelector('[data-element="abacus-section-print-options"]')
    expect(options?.querySelector('[data-element="modular-fit-panel"]')).not.toBeNull()
    expect(
      container
        .querySelector('[data-element="abacus-section-files"]')
        ?.querySelector('[data-element="modular-fit-panel"]')
    ).toBeNull()
  })
})

describe('infill is a print question', () => {
  it('renders in the print rail and not in the design rail', () => {
    const { container: right } = render(<FabricationRail />)
    expect(right.querySelector('[data-element="abacus-infill-frame"]')).not.toBeNull()
    expect(
      right
        .querySelector('[data-element="abacus-section-print-options"]')
        ?.querySelector('[data-element="abacus-infill-frame"]')
    ).not.toBeNull()

    const { container: left } = render(<DesignInspectorRail {...railProps} />)
    expect(left.querySelector('[data-element="abacus-infill-frame"]')).toBeNull()
  })
})
