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
// the synced/identity follow model can never be bypassed. overrides / profileId /
// fabrication are pure view state and never detach.

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
import { useAbacusDesignSnapshot } from '@/hooks/useAbacusDesignSnapshot'
import { useAbacusPrintConnections } from '@/hooks/useAbacusPrintConnections'
import {
  usePlayerAbacusIdentity,
  useSavePlayerAbacusIdentity,
} from '@/hooks/usePlayerAbacusIdentity'
import { usePlayerAccess } from '@/hooks/usePlayerAccess'
import { useThhFilamentCatalog } from '@/hooks/useThhFilamentCatalog'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { type AbacusIdentity, parseAbacusIdentity } from '@/lib/abacus/identity'
import type { AbacusExportParts } from './abacus-3mf'
import { catalogFromParams } from './abacus-catalog'
import { toAbacusDesign } from './abacus-design'
import {
  DEFAULT_FABRICATION,
  type FabricationKind,
  type FabricationTarget,
} from './abacus-fabrication'
import { selectSourceIdentity } from './abacus-identity-source'
import { type DisplayConfigInput, type Params, paramsFromDisplayConfig } from './abacus-model'
import { materialize, planToFilamentMap } from './abacus-plan'
import { DEFAULT_PROFILE_ID, profileById, solve } from './abacus-solver'

// Per-browser memory of which paired print service the studio prints to, so a
// devbox pointed at both prod and a local service reopens on the same one.
const PRINT_CONNECTION_STORAGE_KEY = 'abacus-studio-print-connection'

// The viewer's worker-bound export surface, registered into the store on mount.
// `exportStl` renders just the whole-abacus STL (the plain-STL download);
// `exportParts` adds the ArUco marker part passes for the 3MF build, all from
// one params snapshot.
export type AbacusExporter = {
  exportStl: () => Promise<ArrayBuffer>
  exportParts: () => Promise<AbacusExportParts>
}

// The identity slice of the current params, or null when a custom scheme/palette
// string can't be expressed as a saved identity (save stays disabled).
function identityFromParams(p: Params): AbacusIdentity | null {
  return parseAbacusIdentity({
    colorScheme: p.color_scheme,
    colorPalette: p.color_palette,
    columns: p.cols,
  })
}

function useStudioController(playerId: string | null, designId: string | null) {
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
  // manual filament mapping: roleKey → spoolId. Pure view state — it only reshapes
  // the PRINT projection (the reconcile strip + the 3MF), so a pin never detaches
  // `synced`. The 3D model always renders the user's designed colors, unmapped.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  // which physical output the shared design is being made into — a studio-state
  // axis, NOT part of the abacus identity, so switching it never
  // detaches `synced`. It gates the 3D-only cost below: on 'paper' the filament
  // catalog read is disabled (no printer discovery, no AMS poll), and the page
  // never mounts the three.js viewer.
  const [fabrication, setFabrication] = useState<FabricationTarget>(DEFAULT_FABRICATION)
  const setFabricationKind = useCallback((kind: FabricationKind) => setFabrication({ kind }), [])

  // the serializable design projection — the single source of truth for the
  // preview's bead/frame colors. Intrinsic colors, not AMS-snapped.
  const design = useMemo(() => toAbacusDesign(params, profileId), [params, profileId])

  // the print plan = the design projected onto the loaded filaments, honoring the
  // user's pins. The catalog is the live AMS snapshot when a print service is
  // paired and reachable, falling back to the params-derived color-only catalog
  // when it isn't — the studio never blocks on the print service. Only read when
  // the design is being made as a 3D print; the paper lane needs no filaments.
  // Which paired print service the print reads/writes target. The proxy accepts
  // an explicit ?connectionId= and 400s once the user has more than one paired
  // without one, so the studio resolves it here: the user's remembered pick when
  // it's still a live connection, else the first (listConnections sorts by
  // createdAt). The list read is cheap and shared with Settings › Printing; only
  // the fdm lane actually consumes the resolved id.
  const { connectionsQuery } = useAbacusPrintConnections()
  const connections = useMemo(() => connectionsQuery.data ?? [], [connectionsQuery.data])
  const [pickedConnectionId, setPickedConnectionId] = useState<string | null>(null)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PRINT_CONNECTION_STORAGE_KEY)
      if (stored) setPickedConnectionId(stored)
    } catch {
      /* private mode / storage disabled — fall through to the default pick */
    }
  }, [])
  const selectConnection = useCallback((id: string) => {
    setPickedConnectionId(id)
    try {
      localStorage.setItem(PRINT_CONNECTION_STORAGE_KEY, id)
    } catch {
      /* non-fatal: the pick just won't persist across reloads */
    }
  }, [])
  const selectedConnectionId = useMemo<string | undefined>(() => {
    if (connections.length === 0) return undefined
    if (pickedConnectionId && connections.some((c) => c.id === pickedConnectionId)) {
      return pickedConnectionId
    }
    return connections[0].id
  }, [connections, pickedConnectionId])

  const thhFilaments = useThhFilamentCatalog({
    enabled: fabrication.kind === 'fdm',
    connectionId: selectedConnectionId,
  })
  // The catalog the print plan quantizes onto. It MUST be non-empty: materialize
  // runs in this provider (above every error boundary), and an empty spool list
  // makes the quantizer emit an out-of-range slot that throws and blanks the whole
  // studio. Two empty vectors both fall back to the params catalog (always ≥1
  // spool): a null live catalog (service unpaired / unreachable / read failed) AND
  // a live thh-ams catalog with zero loaded filaments (printer on, AMS empty). In
  // the fallback the preview shows the designed colors and the print path stays
  // blocked (source !== 'thh-ams') until a real roster loads — never a crash.
  const catalog = useMemo(() => {
    const live = thhFilaments.catalog
    return live && live.spools.length > 0 ? live : catalogFromParams(params)
  }, [thhFilaments.catalog, params])
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

  // ---- ?design= hydration (Gitea #22) --------------------------------------
  // Restore a persisted snapshot ONCE per design id. Hydration IS detachment:
  // it sets synced=false, so the identity follow-effect above can never stomp
  // the restored params — the design wins the params, while the ?player=
  // selection keeps choosing WHOSE abacus this is. Declared after the
  // follow-effect so the restore also wins the commit where both fire.
  const designSnapshot = useAbacusDesignSnapshot(designId)
  const hydratedDesignRef = useRef<string | null>(null)
  useEffect(() => {
    const snapshot = designSnapshot.data
    if (!designId || !snapshot || hydratedDesignRef.current === designId) return
    hydratedDesignRef.current = designId
    setParams(snapshot.params)
    setOverrides(snapshot.overrides)
    setProfileId(snapshot.profileId)
    setSynced(false)
  }, [designId, designSnapshot.data])

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
  // The heavy renders live in the lazy, three.js-bound viewer, but the Export
  // buttons live in the fabrication rail — a sibling that can't reach the viewer's
  // worker directly. The viewer registers its worker-bound exporter here on mount
  // (mirroring the drawRef lifetime): `exportStl` is the plain whole-abacus STL,
  // `exportParts` the full 3MF bundle (frame + the ArUco marker part passes),
  // snapshotting params ONCE inside the viewer so the three renders can never mix
  // designs. Rails assemble the 3MF from the bundle plus the store's live
  // filamentMap/catalog. `exporterReady` gates the buttons while the viewer chunk
  // is still loading — and stays false on the paper lane, where the viewer never
  // mounts.
  const exporterRef = useRef<AbacusExporter | null>(null)
  const [exporterReady, setExporterReady] = useState(false)
  const registerExporter = useCallback((exp: AbacusExporter | null) => {
    exporterRef.current = exp
    setExporterReady(exp != null)
  }, [])
  const requestExportStl = useCallback(
    (): Promise<ArrayBuffer> =>
      exporterRef.current
        ? exporterRef.current.exportStl()
        : Promise.reject(new Error('3D exporter not ready')),
    []
  )
  const requestExportParts = useCallback(
    (): Promise<AbacusExportParts> =>
      exporterRef.current
        ? exporterRef.current.exportParts()
        : Promise.reject(new Error('3D exporter not ready')),
    []
  )

  // The 3D model previews the REAL print (filament colors) by default; hovering a
  // tile's true-color fleck in the reconcile strip momentarily flips the whole
  // model to the user's designed colors. The strip (a rail sibling) can't reach
  // the viewer's mount-once recolor closure, so the viewer registers an imperative
  // reveal handle here (like the exporter) and the strip pokes it on hover — no
  // full-studio re-render per hover. No-op on the paper lane (viewer unmounted).
  const revealIntrinsicRef = useRef<((v: boolean) => void) | null>(null)
  const registerRevealIntrinsic = useCallback((fn: ((v: boolean) => void) | null) => {
    revealIntrinsicRef.current = fn
  }, [])
  const setRevealIntrinsic = useCallback((v: boolean) => {
    revealIntrinsicRef.current?.(v)
  }, [])

  // Hovering/focusing a filament-mapping row highlights THAT part on the 3D model
  // and x-rays the rest (Gitea #17). Same imperative-handle shape as reveal: the rail
  // row (a sibling) can't reach the viewer's mount-once recolor closure, and a hover
  // must not re-render the studio tree — the viewer registers the poke, the row
  // calls it with a role key (or null to clear). The optional human label rides
  // along so the viewer can caption WHAT it's emphasizing on the hero. No-op on the
  // paper lane.
  const highlightRoleRef = useRef<((k: string | null, label?: string | null) => void) | null>(null)
  const registerHighlightRole = useCallback(
    (fn: ((k: string | null, label?: string | null) => void) | null) => {
      highlightRoleRef.current = fn
    },
    []
  )
  const setHighlightRole = useCallback((k: string | null, label?: string | null) => {
    highlightRoleRef.current?.(k, label)
  }, [])

  // hero→row (Gitea #18): the reverse of the hover lenses above. The viewer
  // raycasts a click on the 3D model to a shell → role key and calls pickModelRole;
  // the fabrication rail hands the pick to the mapping panel, which opens + scrolls
  // that role's row. A click is discrete (not a per-frame hover), so plain state +
  // a re-render is fine here — the monotonic nonce lets a repeat click re-open a row
  // the user had collapsed. Null role keys never reach here (shellRoleKey is total).
  const [modelPick, setModelPick] = useState<{ key: string; nonce: number } | null>(null)
  const pickModelRole = useCallback(
    (key: string) => setModelPick((prev) => ({ key, nonce: (prev?.nonce ?? 0) + 1 })),
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
    overrides,
    setOverrides,
    fabrication,
    setFabricationKind,
    design,
    thhFilaments,
    connections,
    selectedConnectionId,
    selectConnection,
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
    registerExporter,
    requestExportStl,
    requestExportParts,
    registerRevealIntrinsic,
    setRevealIntrinsic,
    registerHighlightRole,
    setHighlightRole,
    modelPick,
    pickModelRole,
  }
}

export type AbacusStudioContextValue = ReturnType<typeof useStudioController>

const AbacusStudioContext = createContext<AbacusStudioContextValue | null>(null)

export interface AbacusStudioProviderProps {
  /** Selected player whose "my abacus" the studio manifests; null = the viewer's own config */
  playerId?: string | null
  /** Persisted design snapshot to restore (?design=<id>, Gitea #22); null = none.
   *  The page passes null when the read failed — the degrade happens there. */
  designId?: string | null
  children: ReactNode
}

export function AbacusStudioProvider({
  playerId = null,
  designId = null,
  children,
}: AbacusStudioProviderProps) {
  const value = useStudioController(playerId, designId)
  return <AbacusStudioContext.Provider value={value}>{children}</AbacusStudioContext.Provider>
}

export function useAbacusStudio(): AbacusStudioContextValue {
  const ctx = useContext(AbacusStudioContext)
  if (!ctx) throw new Error('useAbacusStudio must be used within an AbacusStudioProvider')
  return ctx
}
