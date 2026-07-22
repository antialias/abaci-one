'use client'

// Shared studio state (Gitea epic #5 — full-bleed CP0).
//
// The Abacus Studio's design + print state lifted out of AbacusStudioViewer so a
// docked-rail shell can read and write one source of truth without remounting the
// mount-once three.js canvas. This provider is deliberately three.js-free: it
// holds only pure derivations + React Query reads, so the paper/express lane can
// mount it without paying for the WebGL viewer.
//
// The `set()` detach chokepoint lives here and is the ONLY exposed param writer
// (the context type omits raw setParams) — every design edit routes through it so
// the synced/identity follow model can never be bypassed. viewMode / overrides /
// profileId are pure view state and never detach.

import { useAbacusConfig } from '@soroban/abacus-react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  usePlayerAbacusIdentity,
  useSavePlayerAbacusIdentity,
} from '@/hooks/usePlayerAbacusIdentity'
import { usePlayerAccess } from '@/hooks/usePlayerAccess'
import { useThhFilamentCatalog } from '@/hooks/useThhFilamentCatalog'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { type AbacusIdentity, parseAbacusIdentity } from '@/lib/abacus/identity'
import { catalogFromParams } from './abacus-catalog'
import { toAbacusDesign } from './abacus-design'
import { selectSourceIdentity } from './abacus-identity-source'
import { type DisplayConfigInput, type Params, paramsFromDisplayConfig } from './abacus-model'
import { materialize, planToFilamentMap } from './abacus-plan'
import { DEFAULT_PROFILE_ID, profileById, solve } from './abacus-solver'

// The identity slice of the current params, or null when a custom scheme/palette
// string can't be expressed as a saved identity (save stays disabled).
function identityFromParams(p: Params): AbacusIdentity | null {
  return parseAbacusIdentity({
    colorScheme: p.color_scheme,
    colorPalette: p.color_palette,
    columns: p.cols,
  })
}

function useStudioController(playerId: string | null) {
  // The studio opens showing an abacus IDENTITY and follows it until the user
  // touches a control. With a player selected, that identity is the player's
  // saved "my abacus" row; otherwise it's the viewer's own live
  // AbacusDisplayConfig — exactly the pre-player behavior.
  const displayConfig = useAbacusConfig()
  const playerIdentity = usePlayerAbacusIdentity(playerId)
  const playerAccess = usePlayerAccess(playerId)
  const { data: allPlayers } = useUserPlayers()
  const playerName = playerId ? (allPlayers?.find((p) => p.id === playerId)?.name ?? null) : null

  // The identity source `synced` mirrors. Null while a selected player's row is
  // still loading — the follow-effect holds rather than seeding a fake.
  const sourceIdentity: DisplayConfigInput | null = useMemo(
    () => selectSourceIdentity(playerId, playerIdentity.data, displayConfig),
    [playerId, playerIdentity.data, displayConfig]
  )

  const [params, setParams] = useState<Params>(() => paramsFromDisplayConfig(displayConfig))
  // `synced` = params still mirror the identity source. Any manual edit detaches
  // (so a customization is never stomped by a config change); "reset" re-attaches.
  const [synced, setSynced] = useState(true)
  // printer profile: a print setting (Common / Wide / Fine), NOT part of the
  // abacus identity — changing it must not detach `synced`.
  const [profileId, setProfileId] = useState<string>(DEFAULT_PROFILE_ID)
  // preview lens: 'design' shows the user's INTRINSIC colors, 'print' shows the
  // same design QUANTIZED onto the loaded filaments. A pure view concern.
  const [viewMode, setViewMode] = useState<'design' | 'print'>('design')
  // manual filament mapping: roleKey → spoolId. Pure view state like viewMode —
  // it only reshapes the PRINT projection, so a pin never detaches `synced`.
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  // the serializable design projection — the single source of truth for the
  // preview's bead/frame colors. Intrinsic colors, not AMS-snapped.
  const design = useMemo(() => toAbacusDesign(params, profileId), [params, profileId])

  // the print plan = the design projected onto the loaded filaments, honoring the
  // user's pins. The catalog is the live AMS snapshot when a print service is
  // paired and reachable, falling back to the params-derived color-only catalog
  // when it isn't — the studio never blocks on the print service.
  const thhFilaments = useThhFilamentCatalog()
  const catalog = useMemo(
    () => thhFilaments.catalog ?? catalogFromParams(params),
    [thhFilaments.catalog, params]
  )
  const plan = useMemo(
    () => materialize(design, catalog, { overrides }),
    [design, catalog, overrides]
  )
  // the legacy FilamentMap the recolor passes color through, derived FROM the
  // plan so overrides flow into the live preview for free.
  const filamentMap = useMemo(
    () =>
      planToFilamentMap(
        plan,
        catalog.spools.map((s) => s.hex)
      ),
    [plan, catalog]
  )

  // follow the identity source while synced. Re-seeds when the provider hydrates
  // its stored config after mount, when the user changes their abacus elsewhere,
  // and when the selected player (or their saved identity) changes. Holds while a
  // player's row is in flight (sourceIdentity null), and is a no-op once the user
  // has customized.
  useEffect(() => {
    if (!synced || !sourceIdentity) return
    setParams(paramsFromDisplayConfig(sourceIdentity))
  }, [sourceIdentity, synced])

  // any manual edit detaches from the live config (see `synced`). THE chokepoint.
  const set = <K extends keyof Params>(k: K, v: Params[K]) => {
    setSynced(false)
    setParams((prev) => ({ ...prev, [k]: v }))
  }
  const resync = () => setSynced(true)

  // ---- player identity save -------------------------------------------------
  // Explicit act, not auto-save. Saving the identity slice of the current params
  // re-syncs — the optimistic cache makes the follow-effect's re-seed a no-op.
  const saveIdentity = useSavePlayerAbacusIdentity(playerId ?? 'anonymous')
  const canWriteIdentity = playerAccess.data
    ? playerAccess.data.isParent || playerAccess.data.isPresent
    : false
  const savableIdentity = identityFromParams(params)
  const saveAsPlayerAbacus = () => {
    if (!playerId || !savableIdentity) return
    saveIdentity.mutate(savableIdentity, { onSuccess: () => setSynced(true) })
  }
  // Possessive for pill/buttons: a roster player's name, or a neutral fallback
  // for shared deep links outside the viewer's own roster.
  const playerPossessive = playerName ? `${playerName}'s` : "this student's"

  // ---- printability gate ----------------------------------------------------
  // Run the pure solver against the selected profile; errors block Export, the
  // inlay warning does not. See abacus-solver.ts.
  const profile = profileById(profileId)
  const solveResult = useMemo(() => solve(params, profile), [params, profile])
  const errors = solveResult.reasons.filter((r) => r.severity === 'error')
  const warnings = solveResult.reasons.filter((r) => r.severity === 'warning')
  const exportBlocked = errors.length > 0
  // the two mechanical one-click fixes derivable from the errors: scale up to
  // clear all proportional floors at once, and/or raise the absolute fit gap.
  const proportionalScales = errors
    .map((r) => r.suggestedScale)
    .filter((s): s is number => typeof s === 'number')
  const scaleFix = proportionalScales.length ? Math.max(...proportionalScales) : null
  const clearanceFix = errors.find((r) => r.dim === 'clearance')?.floorMm ?? null

  // ---- 3D export handle -----------------------------------------------------
  // The heavy STL export lives in the lazy, three.js-bound viewer, but the Export
  // buttons live in the fabrication rail — a sibling that can't reach the viewer's
  // worker directly. The viewer registers its worker-bound exporter here on mount
  // (mirroring the drawRef lifetime); rails call requestExportStl() and assemble
  // the 3MF from the store's live params/filamentMap/catalog. `exporterReady` gates
  // the buttons while the viewer chunk is still loading — and stays false on the
  // paper lane, where the viewer never mounts.
  const exportStlRef = useRef<(() => Promise<ArrayBuffer>) | null>(null)
  const [exporterReady, setExporterReady] = useState(false)
  const registerExportStl = useCallback((fn: (() => Promise<ArrayBuffer>) | null) => {
    exportStlRef.current = fn
    setExporterReady(fn != null)
  }, [])
  const requestExportStl = useCallback(
    (): Promise<ArrayBuffer> =>
      exportStlRef.current
        ? exportStlRef.current()
        : Promise.reject(new Error('3D exporter not ready')),
    []
  )

  return {
    playerId,
    playerName,
    playerPossessive,
    params,
    synced,
    set,
    resync,
    profileId,
    setProfileId,
    profile,
    viewMode,
    setViewMode,
    overrides,
    setOverrides,
    design,
    thhFilaments,
    catalog,
    plan,
    filamentMap,
    solveResult,
    errors,
    warnings,
    exportBlocked,
    scaleFix,
    clearanceFix,
    canWriteIdentity,
    savableIdentity,
    saveAsPlayerAbacus,
    saveIsPending: saveIdentity.isPending,
    saveIsError: saveIdentity.isError,
    exporterReady,
    registerExportStl,
    requestExportStl,
  }
}

export type AbacusStudioContextValue = ReturnType<typeof useStudioController>

const AbacusStudioContext = createContext<AbacusStudioContextValue | null>(null)

export interface AbacusStudioProviderProps {
  /** Selected player whose "my abacus" the studio manifests; null = the viewer's own config */
  playerId?: string | null
  children: ReactNode
}

export function AbacusStudioProvider({ playerId = null, children }: AbacusStudioProviderProps) {
  const value = useStudioController(playerId)
  return <AbacusStudioContext.Provider value={value}>{children}</AbacusStudioContext.Provider>
}

export function useAbacusStudio(): AbacusStudioContextValue {
  const ctx = useContext(AbacusStudioContext)
  if (!ctx) throw new Error('useAbacusStudio must be used within an AbacusStudioProvider')
  return ctx
}
