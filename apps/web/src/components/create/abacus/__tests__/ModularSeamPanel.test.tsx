/**
 * ModularSeamPanel (Gitea #30, CP7) — the panel is thin wiring over four
 * contracts, and each is pinned here: seam_mode flows through the ONE store
 * setter; verdicts and the size delta come from the shared model (never a
 * second copy of the arithmetic); the coupon rides the single-pass escape
 * hatch with the fit in the filename; the kit rides the snapshot-once bundle
 * into buildModuleKit and is unreachable outside modular mode. The kit build
 * itself has its own suite over real STL soups — here it's a stubbed
 * collaborator (moduleKitPlan stays real: the hint line quotes it).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusStudio } from '../AbacusStudioContext'
import { defaultParams, type FilamentMap, type Params } from '../abacus-model'
import { buildModuleKit, type ModuleExportParts, type ModuleKit } from '../abacus-module-kit'
import { MODULAR_COLUMNS_FLAG, ModularSeamPanel, modularSizeDelta } from '../ModularSeamPanel'

vi.mock('../AbacusStudioContext', () => ({
  useAbacusStudio: vi.fn(),
}))

vi.mock('../abacus-module-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../abacus-module-kit')>()
  return { ...actual, buildModuleKit: vi.fn() }
})

// All five bead roles pinned to one spool → a single mid variant, so the
// 13-col default plan is exactly 3 files (left, mid ×11, right) = 13 pieces.
const fm: FilamentMap = {
  slots: ['#1a1a1a', '#e11d48'],
  frame: 0,
  markerWhite: 0,
  markerBlack: 0,
  beadRoles: [1, 1, 1, 1, 1],
  markerContrast: 21,
  feet: 0,
}

const set = vi.fn()
const requestExportPass = vi.fn()
const requestExportModuleParts = vi.fn()

function studio(params: Partial<Params> = {}, overrides: Record<string, unknown> = {}) {
  vi.mocked(useAbacusStudio).mockReturnValue({
    params: { ...defaultParams, ...params },
    set,
    requestExportPass,
    requestExportModuleParts,
    exporterReady: true,
    filamentMap: fm,
    catalog: { spools: [{ name: 'Matte Black' }, { name: 'Crimson' }] },
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: partial context value
  } as any)
}

/** Render + open the disclosure (it defaults closed). */
function open() {
  const view = render(<ModularSeamPanel />)
  fireEvent.click(screen.getByText('Modular columns'))
  return view
}

const modularParts = (): ModuleExportParts => ({
  left: new ArrayBuffer(84),
  mid: new ArrayBuffer(84),
  right: new ArrayBuffer(84),
  leftFeet: null,
  midFeet: null,
  rightFeet: null,
  leftText: [],
  rightText: [],
  params: { ...defaultParams, seam_mode: 'modular' },
})

const fakeKit = (): ModuleKit => ({
  bytes: new Uint8Array([0x50, 0x4b]),
  filename: 'abacus-modular-kit-13col-x1-fit0.1.zip',
  modules: [],
})

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

// jsdom implements neither object URLs nor anchor navigation — capture the
// download names instead of letting a.click() try to navigate.
let downloads: string[]
const realClick = HTMLAnchorElement.prototype.click

beforeEach(() => {
  vi.clearAllMocks()
  studio()
  downloads = []
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  }
})

afterEach(() => {
  HTMLAnchorElement.prototype.click = realClick
})

describe('ModularSeamPanel', () => {
  it('pins the flag key the CP8 mount point reads', () => {
    expect(MODULAR_COLUMNS_FLAG).toBe('abacus.modular_columns')
  })

  it('modularSizeDelta: seams widen the row and never the depth', () => {
    const d = modularSizeDelta(defaultParams)
    expect(d.modular[0]).toBeGreaterThan(d.mono[0])
    expect(d.modular[1]).toBeCloseTo(d.mono[1], 10)
  })

  it('quotes both sizes from the one derived chain', () => {
    const { container } = open()
    const d = modularSizeDelta(defaultParams)
    const el = container.querySelector('[data-element="modular-seam-size-delta"]')
    expect(el?.textContent).toContain(`${d.mono[0].toFixed(1)} × ${d.mono[1].toFixed(1)} mm`)
    expect(el?.textContent).toContain(`${d.modular[0].toFixed(1)} × ${d.modular[1].toFixed(1)} mm`)
  })

  it('the toggle writes seam_mode through the one store setter', () => {
    open()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(set).toHaveBeenCalledWith('seam_mode', 'modular')
  })

  it('…and back to mono when already modular', () => {
    studio({ seam_mode: 'modular' })
    open()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(set).toHaveBeenCalledWith('seam_mode', 'mono')
  })

  it('shows the wood-PLA strain provenance when every verdict passes', () => {
    const { container } = open()
    const ok = container.querySelector('[data-element="modular-seam-verdict-ok"]')
    // 45/64 % at stock constants — the flexure-gate number, shown as provenance
    expect(ok?.textContent).toMatch(/strain 0\.70%/)
    expect(container.querySelector('[data-element="modular-seam-verdict-bad"]')).toBeNull()
  })

  it('a failing seamFit blocks both downloads and names the knobs', () => {
    // S = 0.6 trips exactly clip_walls, seat, module_feet (pinned in CP4)
    studio({ scale_factor: 0.6, seam_mode: 'modular' })
    const { container } = open()
    expect(container.querySelector('[data-element="modular-seam-verdict-bad"]')).not.toBeNull()
    expect(screen.getByText(/clip socket leaves/)).toBeInTheDocument()
    expect(screen.getByText(/bottom seat/)).toBeInTheDocument()
    expect(screen.getByText(/module feet/)).toBeInTheDocument()
    expect((screen.getByText('⬇ Seam coupon (STL)') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText('⬇ Module print kit (.zip)') as HTMLButtonElement).disabled).toBe(true)
  })

  it('the kit needs modular mode; the coupon does not', () => {
    open() // defaults: mono, everything passing
    expect((screen.getByText('⬇ Seam coupon (STL)') as HTMLButtonElement).disabled).toBe(false)
    const kit = screen.getByText('⬇ Module print kit (.zip)') as HTMLButtonElement
    expect(kit.disabled).toBe(true)
    expect(kit.title).toBe('Switch to modular columns first')
  })

  it('both buttons wait for the exporter chunk', () => {
    studio({ seam_mode: 'modular' }, { exporterReady: false })
    open()
    const coupon = screen.getByText('⬇ Seam coupon (STL)') as HTMLButtonElement
    expect(coupon.disabled).toBe(true)
    expect(coupon.title).toBe('Preparing the 3D exporter…')
    expect((screen.getByText('⬇ Module print kit (.zip)') as HTMLButtonElement).disabled).toBe(true)
  })

  it('coupon: single-pass escape hatch, fit and scale in the filename', async () => {
    requestExportPass.mockResolvedValue(new ArrayBuffer(84))
    open()
    fireEvent.click(screen.getByText('⬇ Seam coupon (STL)'))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(requestExportPass).toHaveBeenCalledWith({ only: 'seam_coupon' })
    expect(downloads[0]).toBe(
      `abacus-seam-coupon-fit${defaultParams.joint_fit}-x${defaultParams.scale_factor}.stl`
    )
  })

  it('kit: snapshot bundle → buildModuleKit with the live map and spool names', async () => {
    studio({ seam_mode: 'modular' })
    const parts = modularParts()
    requestExportModuleParts.mockResolvedValue(parts)
    vi.mocked(buildModuleKit).mockReturnValue(fakeKit())
    open()
    fireEvent.click(screen.getByText('⬇ Module print kit (.zip)'))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(buildModuleKit).toHaveBeenCalledWith({
      parts,
      filamentMap: fm,
      slotLabels: ['Matte Black', 'Crimson'],
    })
    expect(downloads[0]).toBe(fakeKit().filename)
  })

  it('quotes the real kit plan in the hint', () => {
    studio({ seam_mode: 'modular' })
    open()
    expect(screen.getByText(/13 modules across 3 files/)).toBeInTheDocument()
  })

  it('the footer tells the side-text truth: sides print, crossing slots are one-piece only', () => {
    // The stale claim this replaces said frame text was mono-only outright —
    // since the side rails and end walls ride the end modules, that would
    // wrongly warn users off text the kit actually prints.
    studio({ seam_mode: 'modular' })
    open()
    const note = screen.getByText(/side rails and end walls/)
    expect(note.textContent).toContain('one-piece abacus only')
    expect(note.textContent).not.toContain('mono-only')
  })

  it('locks both downloads while one render is in flight', async () => {
    studio({ seam_mode: 'modular' })
    let finish!: (v: ModuleExportParts) => void
    requestExportModuleParts.mockReturnValue(
      new Promise<ModuleExportParts>((r) => {
        finish = r
      })
    )
    vi.mocked(buildModuleKit).mockReturnValue(fakeKit())
    open()
    fireEvent.click(screen.getByText('⬇ Module print kit (.zip)'))
    expect(await screen.findByText('Rendering module passes…')).toBeInTheDocument()
    expect((screen.getByText('⬇ Seam coupon (STL)') as HTMLButtonElement).disabled).toBe(true)
    finish(modularParts())
    await waitFor(() => expect(screen.getByText('⬇ Module print kit (.zip)')).toBeInTheDocument())
    expect(downloads).toHaveLength(1)
  })

  it('a rejected render surfaces in place instead of vanishing', async () => {
    requestExportPass.mockRejectedValue(new Error('the seam_coupon render has no triangles'))
    open()
    fireEvent.click(screen.getByText('⬇ Seam coupon (STL)'))
    expect(await screen.findByText(/Export failed: .*no triangles/)).toBeInTheDocument()
    expect(downloads).toHaveLength(0)
  })
})
