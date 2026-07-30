/**
 * ?design= hydration (Gitea #22): the provider restores a persisted snapshot
 * once per id, and the restore DETACHES (synced=false) so the ?player=
 * identity follow-effect can never stomp the restored params — the design
 * wins the params, the player selection keeps choosing the student.
 *
 * The data hooks are mocked at the module seam; everything the provider
 * derives (materialize, solve, catalog fallback) runs for real.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusDesignSnapshot } from '@/hooks/useAbacusDesignSnapshot'
import { usePlayerAbacusIdentity } from '@/hooks/usePlayerAbacusIdentity'
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
// the controller reads "my abacuses" only to carry a NAME across an edit (#11)
vi.mock('@/hooks/useMyDesigns', () => ({
  useMyDesigns: () => ({ designs: [] }),
}))

const SNAPSHOT = {
  v: 1 as const,
  params: { ...defaultParams, cols: 17, top_text: 'restored rail' },
  overrides: { 'bead:earth': 'spool-9' },
  profileId: 'fdm-0.4',
}

const wrap = (designId: string | null, playerId: string | null = null) => {
  // the controller reads useQueryClient (design-link cache seeding, Gitea #25)
  const queryClient = new QueryClient()
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AbacusStudioProvider playerId={playerId} designId={designId}>
        {children}
      </AbacusStudioProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
    data: undefined,
    isError: false,
    // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
  } as any)
  vi.mocked(usePlayerAbacusIdentity).mockReturnValue({
    data: undefined,
    // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
  } as any)
})

describe('?design= hydration', () => {
  it('restores params, overrides, and profile from the snapshot — detached', () => {
    vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
      data: SNAPSHOT,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)

    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap('dsn-1') })

    expect(result.current.params.cols).toBe(17)
    expect(result.current.params.top_text).toBe('restored rail')
    expect(result.current.overrides).toEqual({ 'bead:earth': 'spool-9' })
    expect(result.current.profileId).toBe('fdm-0.4')
    expect(result.current.synced).toBe(false) // hydration IS detachment
    // a deep-linked design opens "already linked" (Gitea #25)
    expect(result.current.savedDesignId).toBe('dsn-1')
  })

  it("a later-arriving player identity can't stomp the restored params", () => {
    vi.mocked(useAbacusDesignSnapshot).mockReturnValue({
      data: SNAPSHOT,
      isError: false,
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)

    const { result, rerender } = renderHook(() => useAbacusStudio(), {
      wrapper: wrap('dsn-1', 'player-1'),
    })
    expect(result.current.params.cols).toBe(17)

    // the player's saved identity row lands AFTER hydration
    vi.mocked(usePlayerAbacusIdentity).mockReturnValue({
      data: { colorScheme: 'monochrome', colorPalette: 'default', columns: 5 },
      // biome-ignore lint/suspicious/noExplicitAny: partial React Query result
    } as any)
    rerender()

    expect(result.current.params.cols).toBe(17) // design still wins the params
    expect(result.current.playerId).toBe('player-1') // player still selected
  })

  it('without a design id the studio follows the identity source as before', () => {
    const { result } = renderHook(() => useAbacusStudio(), { wrapper: wrap(null) })
    expect(result.current.params.cols).toBe(13) // from the mocked display config
    expect(result.current.synced).toBe(true)
  })
})
