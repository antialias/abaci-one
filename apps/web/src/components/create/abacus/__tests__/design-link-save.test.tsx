/**
 * Design-link save (Gitea #25): `saveDesignSnapshot` mints (or re-uses) the
 * current design's ?design= id without printing. Pins the contract that makes
 * the URL rewrite safe: the controller pre-seeds its hydration guard before
 * the minted id ever reaches ?design=, so the save can NEVER hydrate back
 * over live state — the exact replaceState hazard #22 side-stepped.
 *
 * Same harness as design-hydration.test.tsx: data hooks mocked at the module
 * seam, every derivation (canonical hash, dirty check, solve) runs for real.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { persistAbacusDesign, useAbacusDesignSnapshot } from '@/hooks/useAbacusDesignSnapshot'
import { useMyDesigns } from '@/hooks/useMyDesigns'
import { AbacusStudioProvider, useAbacusStudio } from '../AbacusStudioContext'
import { defaultParams } from '../abacus-model'

// Stable like the real context value — a fresh object per render would make
// sourceIdentity churn and spin the follow-effect into an infinite re-seed.
const DISPLAY_CONFIG = vi.hoisted(() => ({
  colorScheme: 'place-value',
  colorPalette: 'default',
  physicalAbacusColumns: 13,
}))
vi.mock('@soroban/abacus-react', () => ({
  useAbacusConfig: () => DISPLAY_CONFIG,
}))
vi.mock('@/hooks/useAbacusPrintConnections', () => ({
  useAbacusPrintConnections: () => ({ connectionsQuery: { data: [] } }),
}))
vi.mock('@/hooks/usePlayerAbacusIdentity', () => ({
  usePlayerAbacusIdentity: vi.fn(() => ({ data: undefined })),
  useSavePlayerAbacusIdentity: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))
vi.mock('@/hooks/usePlayerAccess', () => ({
  usePlayerAccess: () => ({ data: null }),
}))
vi.mock('@/hooks/useThhFilamentCatalog', () => ({
  useThhFilamentCatalog: () => ({ catalog: null }),
}))
vi.mock('@/hooks/useUserPlayers', () => ({
  useUserPlayers: () => ({ data: [] }),
}))
vi.mock('@/hooks/useAbacusDesignSnapshot', () => ({
  useAbacusDesignSnapshot: vi.fn(() => ({ data: undefined, isError: false })),
  persistAbacusDesign: vi.fn(),
}))
// "My abacuses" (#11) — the controller reads it for ONE thing: the name of the
// design an edit came from, so a name survives being tweaked.
vi.mock('@/hooks/useMyDesigns', () => ({
  useMyDesigns: vi.fn(() => ({ designs: [] })),
}))

// What a stale/foreign read of the minted id might return — nothing like the
// live state, so a hydration stomp would be unmissable.
const OTHER_SNAPSHOT = {
  v: 1 as const,
  params: { ...defaultParams, cols: 21 },
  overrides: { 'bead:earth': 'spool-3' },
  profileId: 'fdm-0.4',
}

// The wrapper reads this box so a test can move ?design= and rerender — the
// page does exactly that after a save (router.replace with the minted id).
let currentDesignId: string | null = null
const wrap = () => {
  const queryClient = new QueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AbacusStudioProvider playerId={null} designId={currentDesignId}>
        {children}
      </AbacusStudioProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  currentDesignId = null
  vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
    data: undefined,
    isError: false,
    // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
  } as any)
  vi.mocked(persistAbacusDesign).mockReset()
  vi.mocked(useMyDesigns).mockReturnValue({ designs: [] } as unknown as ReturnType<
    typeof useMyDesigns
  >)
})

describe('saveDesignSnapshot (Gitea #25)', () => {
  it('persists the live design with studio-link provenance and marks it linked', async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-new')
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    act(() => {
      result.current.set('cols', 9)
    })

    let id: string | null = null
    await act(async () => {
      id = await result.current.saveDesignSnapshot()
    })

    expect(id).toBe('dsn-new')
    expect(persistAbacusDesign).toHaveBeenCalledWith(
      expect.objectContaining({ v: 1, params: expect.objectContaining({ cols: 9 }) }),
      { origin: 'studio-link' },
      null // nothing to inherit — this design came from scratch
    )
    expect(result.current.savedDesignId).toBe('dsn-new')
  })

  it("the post-save URL rewrite can't hydrate the save back over live state", async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-minted')
    const { result, rerender } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    act(() => {
      result.current.set('cols', 9)
    })
    await act(async () => {
      await result.current.saveDesignSnapshot()
    })

    // the page mirrors the minted id into ?design= — and worst case the
    // snapshot hook answers with content that is NOT the live state
    currentDesignId = 'dsn-minted'
    vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
      data: OTHER_SNAPSHOT,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)
    rerender()

    // pre-seeded hydration guard held: live state untouched
    expect(result.current.params.cols).toBe(9)
    expect(result.current.overrides).toEqual({})
  })

  it('editing after a save diverges the link; a re-save mints a fresh id', async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValueOnce('dsn-a').mockResolvedValueOnce('dsn-b')
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })
    expect(result.current.savedDesignId).toBe('dsn-a')

    act(() => {
      result.current.set('cols', 7)
    })
    expect(result.current.savedDesignId).toBeNull() // diverged — id stays immutable

    let id: string | null = null
    await act(async () => {
      id = await result.current.saveDesignSnapshot()
    })
    expect(id).toBe('dsn-b')
    expect(persistAbacusDesign).toHaveBeenCalledTimes(2)
  })

  it('re-copying unchanged content never re-POSTs', async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-a')
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })
    let id: string | null = null
    await act(async () => {
      id = await result.current.saveDesignSnapshot()
    })

    expect(id).toBe('dsn-a')
    expect(persistAbacusDesign).toHaveBeenCalledTimes(1)
  })

  it('a failed persist resolves null and leaves no linked state behind', async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValue(null)
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    let id: string | null = 'sentinel'
    await act(async () => {
      id = await result.current.saveDesignSnapshot()
    })

    expect(id).toBeNull()
    expect(result.current.savedDesignId).toBeNull()
    expect(result.current.designLinkPending).toBe(false)
  })
})

/**
 * Names across an edit (Gitea #11). A design's id IS its content, so editing
 * mints a new row — and without carrying the name forward, "Ada's abacus" would
 * quietly become an unnamed row the first time anyone moved a slider.
 */
describe('name inheritance', () => {
  const listing = (designs: Array<{ id: string; name: string | null }>) =>
    vi
      .mocked(useMyDesigns)
      .mockReturnValue({ designs } as unknown as ReturnType<typeof useMyDesigns>)

  /** open a saved design, then diverge from it — the state a re-save mints from */
  const openThenEdit = async (designId: string) => {
    currentDesignId = designId
    vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
      data: OTHER_SNAPSHOT,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })
    // the hydration effect adopts the id as "already linked"…
    expect(result.current.savedDesignId).toBe(designId)
    act(() => {
      result.current.set('cols', 7)
    })
    // …and the edit detaches from it, which is why the STALE id is the one that
    // knows the name
    expect(result.current.savedDesignId).toBeNull()
    expect(result.current.designLinkStale).toBe(true)
    return result
  }

  it('carries the name of the design the edit came FROM', async () => {
    listing([{ id: 'dsn-ada', name: 'Ada’s abacus' }])
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-ada-v2')
    const result = await openThenEdit('dsn-ada')

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })

    expect(persistAbacusDesign).toHaveBeenCalledWith(
      expect.objectContaining({ params: expect.objectContaining({ cols: 7 }) }),
      { origin: 'studio-link' },
      'Ada’s abacus'
    )
  })

  it('inherits nothing when forking a design that is not yours', async () => {
    // a stranger's shared design is openable but absent from YOUR list, which
    // is exactly what makes the fork start out unnamed
    listing([{ id: 'dsn-mine', name: 'Mine' }])
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-fork')
    const result = await openThenEdit('dsn-theirs')

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })

    expect(persistAbacusDesign).toHaveBeenCalledWith(
      expect.anything(),
      { origin: 'studio-link' },
      null
    )
  })

  it('inherits nothing from an unnamed design', async () => {
    listing([{ id: 'dsn-plain', name: null }])
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-plain-v2')
    const result = await openThenEdit('dsn-plain')

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })

    expect(persistAbacusDesign).toHaveBeenCalledWith(
      expect.anything(),
      { origin: 'studio-link' },
      null
    )
  })
})
