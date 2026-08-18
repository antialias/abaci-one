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
import { useQueryClient } from '@tanstack/react-query'
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
import { useAbacusDesignShare } from '@/hooks/useAbacusDesignShare'
import { persistAbacusDesign, useAbacusDesignSnapshot } from '@/hooks/useAbacusDesignSnapshot'
import { useAbacusPrintConnections } from '@/hooks/useAbacusPrintConnections'
import { useMyDesigns } from '@/hooks/useMyDesigns'
import {
  usePlayerAbacusIdentity,
  useSavePlayerAbacusIdentity,
} from '@/hooks/usePlayerAbacusIdentity'
import { usePlayerAccess } from '@/hooks/usePlayerAccess'
import { useFilamentPlan } from '@/hooks/useFilamentPlan'
import { useThhFilamentCatalog } from '@/hooks/useThhFilamentCatalog'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { type AbacusDesignSnapshot, canonicalDesignSnapshot } from '@/lib/abacus/design-snapshot'
import { type AbacusIdentity, parseAbacusIdentity } from '@/lib/abacus/identity'
import { abacusDesignKeys } from '@/lib/queryKeys'
import type { AbacusExportParts } from './abacus-3mf'
import { catalogFromParams } from './abacus-catalog'
import { toAbacusDesign } from './abacus-design'
import {
  DEFAULT_FABRICATION,
  type FabricationKind,
  type FabricationTarget,
} from './abacus-fabrication'
import { selectSourceIdentity } from './abacus-identity-source'
import {
  type DisplayConfigInput,
  type Params,
  paramsFromDisplayConfig,
  type RenderPass,
} from './abacus-model'
import type { ModuleExportParts } from './abacus-module-kit'
import {
  designFilamentMap,
  materialize,
  planToFilamentMap,
  unplacedRoleLabels,
} from './abacus-plan'
import { buildFilamentPlanRequest } from './abacus-plan-request'
import { DEFAULT_PROFILE_ID, profileById, solve } from './abacus-solver'

// Per-browser memory of which paired print service the studio prints to, so a
// devbox pointed at both prod and a local service reopens on the same one.
const PRINT_CONNECTION_STORAGE_KEY = 'abacus-studio-print-connection'

// The viewer's worker-bound export surface, registered into the store on mount.
// `exportStl` renders just the whole-abacus STL (the plain-STL download);
// `exportParts` adds the ArUco marker part passes for the 3MF build, all from
// one params snapshot. `exportModuleParts` is the modular kit's bundle (Gitea
// #30) under the same snapshot-once contract; `exportPass` is the generic
// single-pass escape hatch (seam coupon download, bench parts) — it reads the
// live params at call time, so multi-render bundles must NOT be built from it.
export type AbacusExporter = {
  exportStl: () => Promise<ArrayBuffer>
  exportParts: () => Promise<AbacusExportParts>
  exportModuleParts: () => Promise<ModuleExportParts>
  exportPass: (pass: RenderPass) => Promise<ArrayBuffer>
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
  // The design's colour/constraint intent, as the planner's request. Built only
  // for a LIVE roster: a params catalog describes no real spools, so asking which
  // of them to use would be asking the service to plan a fiction. Pins ride along
  // as `required` selectors, which is what makes the service judge compatibility
  // around the user's actual choice.
  const planRequest = useMemo(
    () =>
      catalog.source === 'thh-ams'
        ? buildFilamentPlanRequest(design, { catalog, overrides })
        : null,
    [design, catalog, overrides]
  )
  const filamentPlan = useFilamentPlan({
    printerId: thhFilaments.printerId,
    request: planRequest,
    rosterSignature: thhFilaments.rosterSignature,
    connectionId: selectedConnectionId,
    enabled: fabrication.kind === 'fdm',
  })

  // The same question asked WITHOUT the user's pins — "what would the service pick
  // if you hadn't chosen?" The picker badges it as the recommendation, and the
  // warning strip's Fix button restores it.
  //
  // Costs nothing until it differs: with no pins the two requests are byte-equal,
  // so they share a cache key and there is exactly one fetch. Only once the user
  // has pinned something does this become a second (then permanently cached) read.
  const unpinnedRequest = useMemo(
    () => (catalog.source === 'thh-ams' ? buildFilamentPlanRequest(design, { catalog }) : null),
    [design, catalog]
  )
  const unpinnedPlan = useFilamentPlan({
    printerId: thhFilaments.printerId,
    request: unpinnedRequest,
    rosterSignature: thhFilaments.rosterSignature,
    connectionId: selectedConnectionId,
    enabled: fabrication.kind === 'fdm',
  })
  const plan = useMemo(
    () => materialize(design, catalog, { overrides, plan: filamentPlan.plan }),
    [design, catalog, overrides, filamentPlan.plan]
  )
  const unplacedRoles = useMemo(() => unplacedRoleLabels(plan), [plan])

  // The legacy FilamentMap the recolor passes color through.
  //
  // Two sources, and the split is the point. With a plan, it derives FROM the plan
  // — so a pin flows into the live preview for free and the pixels and the
  // warnings can't disagree. WITHOUT one ('unplanned': no printer, roster still
  // loading, or a params catalog), it renders the DESIGNED colors instead of
  // quantizing onto spools nobody can print. That case used to run the full local
  // matcher against the eight `filament_N` params and present the result as if it
  // meant something.
  const filamentMap = useMemo(
    () =>
      plan.planStatus === 'unplanned'
        ? designFilamentMap(design)
        : planToFilamentMap(
            plan,
            catalog.spools.map((s) => s.hex)
          ),
    [plan, catalog, design]
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
  // The last persisted design (id + canonical form) — seeded by hydration and
  // by the link chip's save (design-link block below).
  const [savedDesign, setSavedDesign] = useState<{ id: string; canonical: string } | null>(null)
  useEffect(() => {
    const snapshot = designSnapshot.data
    if (!designId || !snapshot || hydratedDesignRef.current === designId) return
    hydratedDesignRef.current = designId
    setParams(snapshot.params)
    setOverrides(snapshot.overrides)
    setProfileId(snapshot.profileId)
    setSynced(false)
    // a deep-linked design opens "already linked": copying its link is instant
    // and offline-safe (no re-POST until the content diverges).
    setSavedDesign({ id: designId, canonical: canonicalDesignSnapshot(snapshot) })
  }, [designId, designSnapshot.data])

  // ---- design link (Gitea #25) ---------------------------------------------
  // "Copy design link": an explicit, idempotent save that mints (or re-uses)
  // the current design's ?design= id WITHOUT printing. `savedDesignId` is the
  // dirty derivation — non-null only while live content still matches the last
  // persisted snapshot (the `synced` analogue for design links, derived not
  // stored). Unchanged content re-copies with no POST (synchronous inside the
  // click gesture); edited content mints a fresh id — a stored id's content is
  // immutable, old links keep meaning what they meant.
  const queryClient = useQueryClient()
  const [designLinkPending, setDesignLinkPending] = useState(false)
  const liveCanonical = useMemo(
    () => canonicalDesignSnapshot({ v: 1, params, overrides, profileId }),
    [params, overrides, profileId]
  )
  const savedDesignId =
    savedDesign && savedDesign.canonical === liveCanonical ? savedDesign.id : null
  // Who may open the saved link (#24). Keyed on savedDesignId, NOT the URL's
  // designId: sharing belongs to the id whose content is actually on screen, so
  // editing a shared design hides the control until a new link is saved — the
  // old id's sharing says nothing about what you're looking at now.
  const designShare = useAbacusDesignShare(savedDesignId)
  // "My abacuses" (#11) — read here for ONE reason: it is where a design's name
  // lives, and a save has to carry that name forward across the edit. The rail's
  // list calls the same hook; React Query serves both from one query.
  const myDesigns = useMyDesigns()
  // the saved link no longer addresses what's on screen (save, then edit)
  const designLinkStale = savedDesign !== null && savedDesignId === null
  const saveDesignSnapshot = useCallback(async (): Promise<string | null> => {
    if (savedDesignId) return savedDesignId
    const snapshot: AbacusDesignSnapshot = { v: 1, params, overrides, profileId }
    const canonical = canonicalDesignSnapshot(snapshot)
    // Carry the name of the design this edit came FROM (#11) — `savedDesign`,
    // the STALE id, not `savedDesignId`, which is null precisely because the
    // content diverged. So "Ada's abacus" stays named as you tweak it. A fork of
    // someone else's design inherits nothing: their id isn't in your list.
    const inheritedName = myDesigns.designs.find((d) => d.id === savedDesign?.id)?.name ?? null
    setDesignLinkPending(true)
    try {
      const id = await persistAbacusDesign(snapshot, { origin: 'studio-link' }, inheritedName)
      if (id) {
        // This content came FROM live state: pre-seed the hydration guard and
        // the query cache BEFORE the URL ever carries the new id, so the
        // ?design= rewrite can never hydrate the save back over live edits
        // (the replaceState hazard #22 side-stepped, resolved here).
        hydratedDesignRef.current = id
        queryClient.setQueryData(abacusDesignKeys.detail(id), snapshot)
        setSavedDesign({ id, canonical })
        // a design you just made belongs in your list, named or not
        queryClient.invalidateQueries({ queryKey: abacusDesignKeys.list() })
      }
      return id
    } finally {
      setDesignLinkPending(false)
    }
  }, [savedDesignId, savedDesign, myDesigns.designs, params, overrides, profileId, queryClient])

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
  const requestExportModuleParts = useCallback(
    (): Promise<ModuleExportParts> =>
      exporterRef.current
        ? exporterRef.current.exportModuleParts()
        : Promise.reject(new Error('3D exporter not ready')),
    []
  )
  const requestExportPass = useCallback(
    (pass: RenderPass): Promise<ArrayBuffer> =>
      exporterRef.current
        ? exporterRef.current.exportPass(pass)
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
    // The service's raw answers, forwarded so a child can re-project them through
    // `materialize` without re-fetching. Passing the RESPONSE rather than the
    // finished PrintPlan keeps `materialize` the one place that turns a plan into
    // roles and warnings — two call sites projecting the same response cannot
    // disagree, which is the property the panel has always relied on.
    servicePlan: filamentPlan.plan,
    unpinnedServicePlan: unpinnedPlan.plan,
    // The PINNED plan's refusal — that read is the one that drives `materialize`,
    // the ticket and the submit, so it is the one whose absence would otherwise
    // let the panel paint designed colors as if they were printable. The unpinned
    // read only badges the picker's recommendation; a refusal there costs a badge,
    // not a correct print, and must not take over the panel.
    servicePlanUnavailable: filamentPlan.unavailable,
    servicePlanUnavailableDetail: filamentPlan.unavailableDetail,
    // "no settled answer for the CURRENT question" — which covers both the first
    // load and the window where `keepPreviousData` is holding the previous key's
    // answer on screen. A consumer that only watched `isLoading` would read a
    // held-over plan as final.
    planPending: filamentPlan.isLoading || filamentPlan.isPlaceholder,
    // The print gate (#37). Roles the planner answered and could not place render
    // in their DESIGNED color, which is right for the viewer and unprintable — so
    // the same `plan` that feeds the pixels also names what blocks the submit.
    // Derived here rather than in the panel so the gate and the preview can never
    // be computed from two different projections of the same response.
    unplacedRoles,
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
    saveDesignSnapshot,
    designLinkPending,
    savedDesignId,
    designLinkStale,
    designShared: designShare.shared,
    // WHAT we know about who can open it, not just the answer — the chip must
    // not say "only you can open it" about a stranger's shared design, nor
    // about a design whose access simply failed to load.
    designAccess: designShare.access,
    canShareDesign: designShare.canShare,
    setDesignShared: designShare.setShared,
    designSharePending: designShare.isPending,
    designShareFailed: designShare.isError,
    exporterReady,
    registerExporter,
    requestExportStl,
    requestExportParts,
    requestExportModuleParts,
    requestExportPass,
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
