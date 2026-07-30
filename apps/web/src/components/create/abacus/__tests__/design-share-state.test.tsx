/**
 * Design-share wiring (Gitea #24). The one contract worth pinning at the
 * controller level: sharing follows the SAVED design id, not the ?design= URL
 * param. Edit a shared design and the control must go away — the old id's
 * sharing says nothing about the content now on screen, and an edit must never
 * silently inherit "anyone with the link".
 *
 * Same harness as design-link-save.test.tsx (module-seam mocks, the vi.hoisted
 * stable DISPLAY_CONFIG, a QueryClientProvider around the controller).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusDesignShare } from '@/hooks/useAbacusDesignShare'
import { persistAbacusDesign, useAbacusDesignSnapshot } from '@/hooks/useAbacusDesignSnapshot'
import { AbacusStudioProvider, useAbacusStudio } from '../AbacusStudioContext'
import { defaultParams } from '../abacus-model'

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
// the controller reads "my abacuses" only to carry a NAME across an edit (#11)
vi.mock('@/hooks/useMyDesigns', () => ({
  useMyDesigns: () => ({ designs: [] }),
}))
vi.mock('@/hooks/useAbacusDesignShare', () => ({
  useAbacusDesignShare: vi.fn(() => ({
    shared: false,
    canShare: false,
    setShared: vi.fn(),
    isPending: false,
    isError: false,
  })),
}))

const HYDRATED = {
  v: 1 as const,
  params: { ...defaultParams, cols: 17 },
  overrides: {},
  profileId: 'fdm-0.4',
}

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

/** the id the share hook was last asked about */
const askedFor = () =>
  vi.mocked(useAbacusDesignShare).mock.calls.at(-1)?.[0] as string | null | undefined

beforeEach(() => {
  currentDesignId = null
  vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
    data: undefined,
    isError: false,
    // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
  } as any)
  vi.mocked(persistAbacusDesign).mockReset()
  vi.mocked(useAbacusDesignShare).mockClear()
})

describe('design sharing wiring (Gitea #24)', () => {
  it('asks about nothing until a design is actually saved', () => {
    renderHook(() => useAbacusStudio(), { wrapper: wrap() })
    expect(askedFor()).toBeNull()
  })

  it('follows the id a save mints, then drops it the moment the design is edited', async () => {
    vi.mocked(persistAbacusDesign).mockResolvedValue('dsn-shared')
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })

    await act(async () => {
      await result.current.saveDesignSnapshot()
    })
    expect(askedFor()).toBe('dsn-shared')
    expect(result.current.designLinkStale).toBe(false)

    act(() => {
      result.current.set('cols', 7)
    })
    // the saved link no longer addresses what's on screen — sharing goes with it
    expect(askedFor()).toBeNull()
    expect(result.current.designLinkStale).toBe(true)
  })

  it('a hydrated ?design= link is manageable straight away', () => {
    currentDesignId = 'dsn-deep'
    vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
      data: HYDRATED,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)

    renderHook(() => useAbacusStudio(), { wrapper: wrap() })
    expect(askedFor()).toBe('dsn-deep')
  })

  it('surfaces the share hook through the studio context', () => {
    const setShared = vi.fn()
    vi.mocked(useAbacusDesignShare).mockReturnValue({
      shared: true,
      canShare: true,
      setShared,
      isPending: false,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial hook value
    } as any)

    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap() })
    expect(result.current.designShared).toBe(true)
    expect(result.current.canShareDesign).toBe(true)

    result.current.setDesignShared(false)
    expect(setShared).toHaveBeenCalledWith(false)
  })
})
