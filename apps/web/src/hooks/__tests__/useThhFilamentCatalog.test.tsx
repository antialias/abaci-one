/**
 * useThhFilamentCatalog (Gitea #19) — the live roster read, pinned at the wire→signal
 * seam. The proxy read is mocked (no service), so this locks exactly what #382's new
 * fields become for the panel: an external row folds into an `external` spool; a
 * null-family external DROPS from the catalog yet still raises `externalUnprintable`
 * (the signal survives the drop); `amsPresent` is a tri-state (true / false / undefined
 * against a pre-#382 service); and AMS rows are unchanged. Two sequential queries fire
 * (printers → filaments), so the mock dispatches on the request path.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThhFilamentRow, ThhPrinterRow } from '@/lib/abacus/print/filament-wire'
import { api } from '@/lib/queryClient'
import { useThhFilamentCatalog } from '../useThhFilamentCatalog'

vi.mock('@/lib/queryClient', () => ({ api: vi.fn() }))
const mockApi = vi.mocked(api)

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

/** Wire the two reads: a single printer, then the given filaments payload. */
function mockRoster(opts: {
  multiMaterial?: boolean
  filaments: ThhFilamentRow[]
  amsPresent?: boolean
  printer?: Partial<ThhPrinterRow>
}) {
  const filamentsBody: Record<string, unknown> = { filaments: opts.filaments }
  if (opts.amsPresent !== undefined) filamentsBody.amsPresent = opts.amsPresent
  mockApi.mockImplementation((path: string) => {
    if (path.includes('/filaments')) return Promise.resolve(ok(filamentsBody))
    return Promise.resolve(
      ok({
        printers: [{ id: 'p1', multiMaterial: opts.multiMaterial ?? false, ...opts.printer }],
      })
    )
  })
}

let queryClient: QueryClient
beforeEach(() => {
  mockApi.mockReset()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useThhFilamentCatalog — external (no-AMS) spool', () => {
  it('folds a resolved external row into an external spool; amsPresent false, not unprintable', async () => {
    mockRoster({
      multiMaterial: false,
      amsPresent: false,
      filaments: [
        {
          external: true,
          slotId: null,
          family: 'PLA',
          colorHex: '112233FF',
          brand: 'Sunlu',
          product: 'PLA+',
        },
      ],
    })
    const { result } = renderHook(() => useThhFilamentCatalog({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.catalog?.source).toBe('thh-ams'))
    expect(result.current.catalog?.spools).toEqual([
      {
        id: 'external-0',
        name: 'Sunlu PLA+',
        hex: '#112233',
        material: 'PLA',
        // kept as fields so a pin can name this spool by identity (Gitea #37)
        brand: 'Sunlu',
        product: 'PLA+',
        external: true,
      },
    ])
    expect(result.current.amsPresent).toBe(false)
    expect(result.current.externalUnprintable).toBe(false)
    expect(result.current.rosterEmpty).toBe(false)
    expect(result.current.unavailable).toBeNull()
  })

  it('DROPS a null-family external from the catalog but still raises externalUnprintable', async () => {
    mockRoster({
      amsPresent: false,
      filaments: [{ external: true, slotId: null, family: null, colorHex: '112233FF' }],
    })
    const { result } = renderHook(() => useThhFilamentCatalog({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.externalUnprintable).toBe(true))
    // the row is dropped (no PLA default), yet the catalog stays thh-ams with 0 spools…
    expect(result.current.catalog?.source).toBe('thh-ams')
    expect(result.current.catalog?.spools).toHaveLength(0)
    // …and rosterEmpty is FALSE — a row DOES exist, distinguishing state E from state C.
    expect(result.current.rosterEmpty).toBe(false)
    expect(result.current.amsPresent).toBe(false)
  })
})

describe('useThhFilamentCatalog — AMS + back-compat', () => {
  it('an AMS roster reports amsPresent:true and no external-unprintable', async () => {
    const wipeTower = {
      version: 1 as const,
      profile: 'orca-rectangle-60-v1',
      maxFilaments: 6,
      envelopeMm: { minX: -4, minY: -4, maxX: 66, maxY: 56 },
      process: {
        prime_tower_width: 60,
        prime_tower_brim_width: 3,
        wipe_tower_wall_type: 'rectangle',
      },
    }
    mockRoster({
      multiMaterial: true,
      amsPresent: true,
      printer: { bed: { sizeMm: { x: 256, y: 256, z: 250 } }, wipeTower },
      filaments: [{ slotId: '0.1', family: 'PLA', colorHex: 'A0A0A0FF', brand: 'Bambu Lab' }],
    })
    const { result } = renderHook(() => useThhFilamentCatalog({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.catalog?.spools).toHaveLength(1))
    expect(result.current.catalog?.spools[0]).toMatchObject({ id: '0.1', material: 'PLA' })
    expect(result.current.catalog?.spools[0].external).toBeUndefined()
    expect(result.current.amsPresent).toBe(true)
    expect(result.current.externalUnprintable).toBe(false)
    expect(result.current.printerBed?.sizeMm).toEqual({ x: 256, y: 256, z: 250 })
    expect(result.current.wipeTower).toBe(wipeTower)
  })

  it('a pre-#382 response (no amsPresent field) yields amsPresent: undefined', async () => {
    mockRoster({
      multiMaterial: true,
      // amsPresent omitted → the service predates #382
      filaments: [{ slotId: '0.1', family: 'PLA', colorHex: 'A0A0A0FF' }],
    })
    const { result } = renderHook(() => useThhFilamentCatalog({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.catalog?.spools).toHaveLength(1))
    expect(result.current.amsPresent).toBeUndefined()
    // the static capability is still available for the panel's `?? printerMultiMaterial` fallback
    expect(result.current.printerMultiMaterial).toBe(true)
  })

  it('an empty roster reports rosterEmpty with no external-unprintable', async () => {
    mockRoster({ multiMaterial: false, amsPresent: false, filaments: [] })
    const { result } = renderHook(() => useThhFilamentCatalog({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.rosterEmpty).toBe(true))
    expect(result.current.externalUnprintable).toBe(false)
    expect(result.current.amsPresent).toBe(false)
  })
})
