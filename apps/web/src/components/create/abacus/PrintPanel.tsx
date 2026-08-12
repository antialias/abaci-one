'use client'

// Abacus Studio — print-service panel (Phase 2b, Gitea #9).
//
// The right-side companion to the studio's control panel: submit the current
// design to the paired THH print service as a multi-material 3MF + v2 ticket,
// tune slicer settings through `@eink/print-dialog`'s schema-driven editor,
// and watch the job move. All reads/writes go through abaci's own proxy
// (#8.3) — the package client only ever sees the injected transport.
//
// Invariants this component holds:
//   • The settings editor is CONTROLLED — the TicketStyle here is the single
//     source of truth — and once opened it stays mounted (visibility toggles
//     via CSS), so solver re-runs and doorbell invalidations flow in as data,
//     never as a remount.
//   • Submission is v2-discipline: the ticket carries the editor's style
//     verbatim; per-key rejects render through `parseInvalidTicket` and the
//     service's `applied` clamp echoes feed straight back into the editor.
//   • Job state moves on events, not a timer: doorbell rings invalidate the
//     job queries, and `usePrintJobRing`'s reconnect reconcile repairs
//     anything missed during a disconnect. Progress % between phase rings is
//     deliberately coarse until THH ships throttled progress rings.

import type {
  ParamScalarValue,
  SupportRecommendation,
  SupportRosterEntry,
  TicketStartPolicy,
  TicketStyle,
} from '@eink/print-dialog'
import { PrintSettingsEditor, SupportRoleEditor, supportsLine } from '@eink/print-dialog/ui'
import '@eink/print-dialog/ui/style.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { persistAbacusDesign } from '@/hooks/useAbacusDesignSnapshot'
import { useAbacusPrintJobs, useCancelPrintJob, useStartPrintJob } from '@/hooks/useAbacusPrintJobs'
import { useAbacusPrintSettings, useSaveAbacusPrintSettings } from '@/hooks/useAbacusPrintSettings'
import { usePrintJobRing } from '@/hooks/usePrintJobRing'
import { useUserId } from '@/hooks/useUserId'
import { createAbacusPrintClient } from '@/lib/abacus/print/browser-transport'
import type {
  PrintUnavailableReason,
  ThhBedGeometry,
  ThhWipeTowerCapability,
} from '@/lib/abacus/print/filament-wire'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { type AbacusExportParts, buildAbacusThreeMf } from './abacus-3mf'
import { type FilamentCatalog, spoolSupportKind } from './abacus-catalog'
import type { FilamentMap, Params } from './abacus-model'
import {
  abacusPrintPanelState,
  designSlotIds,
  FEET_SUPPORT_PROCESS,
  feetSupportGate,
  SLOW_FIRST_LAYER_PROCESS,
  slowFirstLayerEnabled,
  supportsEnabled,
  supportsSlowFirstLayer,
  withSlowFirstLayer,
} from './abacus-print-panel-state'
import { buildAbacusAuthoring, buildAbacusTicket } from './abacus-ticket'
import { JobNotices } from './JobNotices'
import { ParkedJobCard } from './ParkedJobCard'
import { PairPrinterPrompt } from './PrintConnectionsManager'
import { PrintSubmitErrorNotice } from './PrintSubmitErrorNotice'
import {
  abacusModelFileName,
  abacusPrintSignature,
  type IdempotencyToken,
  resolveIdempotencyKey,
} from './print-idempotency'
import { describeJobError, isParked } from './print-jobs'
import { PrintServiceError, type SubmitFailure } from './print-submit-failure'
import { studioHref } from './studio-url'

export interface PrintPanelProps {
  /** Rendered but hidden when false — internal state (style edits) survives. */
  visible: boolean
  /**
   * Docked in a normal-flow rail (studio full-bleed CP1a) rather than floated
   * over the canvas. Switches the root from absolute/top-right to static/full-
   * width; the `visible` display-toggle (single mount) is unchanged.
   */
  embedded?: boolean
  params: Params
  filamentMap: FilamentMap
  catalog: FilamentCatalog
  /** Manual filament-role pins — part of the RESTORABLE design snapshot the
   *  submit persists (abaci#22), unlike filamentMap which is provenance. */
  overrides: Record<string, string>
  /** Printer profile — a print setting, and part of the design snapshot. */
  profileId: string
  /** The discovered THH printer (multi-material preferred), or null. */
  printerId: string | null
  /** Whether the chosen printer is AMS-equipped (static model capability) — the
   *  back-compat fallback for wording the empty-roster notice when the live
   *  `amsPresent` signal is absent (pre things-haunt-house#382 service). */
  printerMultiMaterial?: boolean
  /** Live bed dimensions/exclusions from THH's addressed Orca machine profile. */
  printerBed?: ThhBedGeometry
  /** Bounded wipe-tower profile advertised by the selected THH printer. */
  wipeTower?: ThhWipeTowerCapability | null
  /** Live AMS presence from the roster read (#382): `true`/`false` when reported,
   *  `undefined` against a pre-#382 service. Preferred over `printerMultiMaterial`
   *  for empty-roster wording (`amsPresent ?? printerMultiMaterial`) — a live
   *  `false` must not fall through to the static flag. */
  amsPresent?: boolean
  /** A spool is loaded on the external holder but THH couldn't identify its
   *  material (`external:true`, `family:null`) — so the catalog dropped it and the
   *  print isn't settable. Distinct from an empty roster: something IS loaded. */
  externalUnprintable?: boolean
  /** Service reachable + printer found, but it reports zero loaded spools. A
   *  distinct, surfaced state — not a failure and not printable-yet. */
  rosterEmpty?: boolean
  /** The first printer+filament read is still in flight. Kept distinct from a
   *  resolved-empty roster so a mid-load studio never shows the settled
   *  "nothing loaded" notice — "still asking" and "asked, nothing" differ. */
  isLoading?: boolean
  /** A background refetch is running while cached data is shown (e.g. after Try
   *  again) — used to put the retry control in a pending state. */
  isFetching?: boolean
  /** The connection all print reads/writes here target. Omit for the sole-
   *  connection fallback; required once the user has paired more than one. */
  connectionId?: string
  unavailable: PrintUnavailableReason | null
  /** Solver gate — a design that won't print can't be submitted either. */
  exportBlocked: boolean
  /** One-shot high-quality export renders (whole abacus + the ArUco marker part
   *  passes), all from a single params snapshot taken inside the viewer. */
  requestExportParts: () => Promise<AbacusExportParts>
  /** Whose abacus (the page's `?player=` selection, null = the user's own) —
   *  rides the authoring hand-off so the job's edit link reopens the studio on
   *  the same student (things-haunt-house#408). */
  playerId?: string | null
}

/** How long the export render may take before the submit gives up. */
const EXPORT_TIMEOUT_MS = 180_000

/** Host-named first-screen keys (#535) — the handful an abacus print actually
 *  tweaks. Keys the capability document doesn't declare are dropped by the kit. */
const COMMON_KEYS = [
  'layer_height',
  'sparse_infill_density',
  'wall_loops',
  'enable_support',
  // Printed feet make this one first-screen material: the whole bottom face
  // prints on supports, and off, Orca is free to grow them on the beads. See
  // FEET_SUPPORT_PROCESS.
  'support_on_build_plate_only',
  'initial_layer_speed',
  'initial_layer_acceleration',
  'brim_type',
] as const

const UNAVAILABLE_COPY: Record<PrintUnavailableReason, string> = {
  'not-configured': 'No print service paired — download the 3MF instead.',
  unreachable: 'Print service unreachable right now.',
  unauthorized: 'The print service rejected our credentials — re-pair to reconnect.',
  'no-printer': 'The print service has no printers.',
  error:
    'The print service hit an unexpected error reading your filaments — retry, or check the connection in Settings.',
}

/** The service's clamp echoes (`style.applied`) from a submit response, if any. */
function extractApplied(body: unknown): Record<string, ParamScalarValue> | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const style = (body as { style?: unknown }).style
  if (typeof style !== 'object' || style === null) return undefined
  const applied = (style as { applied?: unknown }).applied
  if (typeof applied !== 'object' || applied === null) return undefined
  const out: Record<string, ParamScalarValue> = {}
  for (const [key, value] of Object.entries(applied)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function PrintPanel(props: PrintPanelProps) {
  const {
    visible,
    embedded = false,
    params,
    filamentMap,
    catalog,
    overrides,
    profileId,
    printerId,
    printerMultiMaterial = false,
    printerBed,
    wipeTower,
    amsPresent,
    externalUnprintable = false,
    rosterEmpty = false,
    isLoading = false,
    isFetching = false,
    connectionId,
    unavailable,
    exportBlocked,
    requestExportParts,
    playerId = null,
  } = props

  // Which body state to render — the pure decision lives in `abacusPrintPanelState`
  // (framework-free, unit-tested) so this component owns only the wording. The four
  // degrade `kind`s double as the `data-degrade` attribute below; `printable` carries
  // whether it's the single-external-spool case that needs the monochrome note (#19).
  const panelState = abacusPrintPanelState({
    unavailable,
    isLoading,
    catalog,
    rosterEmpty,
    externalUnprintable,
    amsPresent,
    printerMultiMaterial,
  })
  const monochromeExternal = panelState.kind === 'printable' && panelState.monochromeExternal

  const queryClient = useQueryClient()
  const userId = useUserId().data ?? undefined
  // Doorbell listener: rings invalidate the job/filament queries read below.
  const ring = usePrintJobRing(userId)

  const serviceReady = unavailable === null && printerId !== null

  // ---- capabilities through the package client (ETag revalidation inside) ---
  // The client is scoped to the selected connection; re-created when it changes
  // so the ?connectionId= rides every read the kit makes.
  const client = useMemo(() => createAbacusPrintClient(connectionId), [connectionId])
  const caps = useQuery({
    queryKey: abacusPrintKeys.capabilities(connectionId),
    queryFn: () => client.getCapabilities(),
    enabled: visible && serviceReady,
    staleTime: 5 * 60_000,
    retry: 1, // contract-version skew is permanent — don't retry-storm it
  })

  // ---- the controlled ticket style (single source of truth) -----------------
  // Three-tier seed: this session's edits > the user's persisted overlay >
  // the capability doc's default intent. The overlay stores the user's edits
  // verbatim — the service's `applied` clamp echoes are never persisted.
  const [styleEdits, setStyleEdits] = useState<TicketStyle | null>(null)
  const savedSettings = useAbacusPrintSettings(visible && serviceReady)
  const seededStyle = useMemo<TicketStyle | null>(() => {
    const presets = caps.data?.basePresets
    if (!presets) return null
    const preset = presets.intents[presets.defaultIntent]?.preset
    return preset ? { basePreset: preset, process: {} } : null
  }, [caps.data])
  const style = styleEdits ?? savedSettings.data ?? seededStyle
  const slowFirstLayerSupported = supportsSlowFirstLayer(caps.data)
  const slowFirstLayerActive = slowFirstLayerEnabled(style)

  // ---- support-interface negotiation (Gitea #23, THH#367) -------------------
  // Active only when the style EXPLICITLY enables supports (the client owns
  // enable_support; THH 400s a role entry on a supports-off ticket). The
  // recommendation is the service's pre-slice availability-first ladder over the
  // live roster — keyed on the FRAME spool's family (the body material the
  // supports touch), refetched on a slow cadence so a mid-session spool swap
  // updates the ★ without a manual refresh.
  const supportsWanted = supportsEnabled(style)
  const frameSpool = catalog.spools[filamentMap.frame]
  const modelFamily = catalog.source === 'thh-ams' && frameSpool ? frameSpool.material : null
  const supportRec = useQuery({
    queryKey: abacusPrintKeys.supportRecommendation(
      printerId ?? 'none',
      modelFamily ?? 'unknown',
      connectionId
    ),
    queryFn: async (): Promise<SupportRecommendation> => {
      const qs = new URLSearchParams({ modelFamily: modelFamily ?? '' })
      if (connectionId) qs.set('connectionId', connectionId)
      const res = await api(
        `abacus/print/printers/${encodeURIComponent(printerId ?? '')}/support-recommendation?${qs}`
      )
      if (!res.ok) throw new Error(`support recommendation read failed: ${res.status}`)
      return (await res.json()) as SupportRecommendation
    },
    enabled: visible && serviceReady && supportsWanted && modelFamily !== null,
    refetchInterval: 30_000,
  })

  // The operator's pick — controlled state for the kit's SupportRoleEditor.
  // `null` is a REAL state (interface prints in the model material), so the
  // recommendation seeds it exactly once: the first recommendation to land
  // sets the pick, after which the user's choice — including choosing null —
  // is never clobbered by a refetch.
  const [supportSlotId, setSupportSlotId] = useState<string | null>(null)
  // Seeded once per RECOMMENDATION, not once per mount: the recommendation is
  // computed for a specific printer / connection / model family, so switching any
  // of those (changing the frame spool changes the family) produces a different
  // answer that the old pick has no claim on. Within one set of inputs the latch
  // still holds, so a 30 s refetch never clobbers the operator.
  const supportSeedKey = `${printerId ?? 'none'}|${modelFamily ?? 'unknown'}|${connectionId ?? ''}`
  const supportSeededRef = useRef<string | null>(null)

  // The roster the editor renders, projected from the loaded catalog. External
  // spools are excluded (a role entry must be a LOADED slot); slots the design
  // already prints in are excluded because the ticket can't honour them (see
  // designSlotIds); the editor itself shows only supportKind === 'interface'
  // rows as pickable.
  const supportRoster = useMemo<SupportRosterEntry[]>(() => {
    if (catalog.source !== 'thh-ams') return []
    const taken = designSlotIds(filamentMap, catalog.spools)
    return catalog.spools
      .filter((s) => !s.external && !taken.has(s.id))
      .map((s) => ({
        slotId: s.id,
        label: `Slot ${s.id}`,
        family: s.material,
        colorHex: s.hex,
        product: s.name,
        supportKind: spoolSupportKind(s),
      }))
  }, [catalog, filamentMap])

  useEffect(() => {
    if (supportSeededRef.current === supportSeedKey || !supportRec.data) return
    supportSeededRef.current = supportSeedKey
    // Seed only from a slot the editor can actually show. THH's ladder can drop
    // to a cross-material rung and land on a spool the design itself uses; that
    // pick is unhonourable, so it seeds as "model material" rather than leaving
    // the controlled value pointing at a row that isn't rendered.
    const recommended = supportRec.data.slotId
    setSupportSlotId(
      recommended !== null && supportRoster.some((r) => r.slotId === recommended)
        ? recommended
        : null
    )
  }, [supportRec.data, supportSeedKey, supportRoster])

  // What actually rides the ticket + idempotency signature: the pick exists
  // only while supports are on (flipping them off must not leave a phantom
  // role entry — or a stale idempotency key), and only while its spool is still
  // loaded. Unloading the picked spool otherwise gets as far as submit, where
  // buildAbacusTicket throws "not in the loaded roster".
  const supportPick =
    supportsWanted && supportRoster.some((r) => r.slotId === supportSlotId) ? supportSlotId : null

  // Persist edits with a 600ms trailing debounce (event-driven — armed only by
  // onChange), deduped against the last-saved snapshot, flushed on unmount so
  // a tune-then-navigate never drops the last edit.
  const saveSettings = useSaveAbacusPrintSettings()
  const saveSettingsRef = useRef(saveSettings.mutate)
  saveSettingsRef.current = saveSettings.mutate
  const lastSavedRef = useRef<string | null>(null)
  const pendingSaveRef = useRef<{
    timer: ReturnType<typeof setTimeout>
    style: TicketStyle
  } | null>(null)
  if (lastSavedRef.current === null && savedSettings.data) {
    lastSavedRef.current = JSON.stringify(savedSettings.data)
  }
  const flushPendingSave = () => {
    const pending = pendingSaveRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    pendingSaveRef.current = null
    const snapshot = JSON.stringify(pending.style)
    if (snapshot === lastSavedRef.current) return
    lastSavedRef.current = snapshot
    saveSettingsRef.current(pending.style)
  }
  const flushPendingSaveRef = useRef(flushPendingSave)
  flushPendingSaveRef.current = flushPendingSave
  const handleStyleChange = (next: TicketStyle) => {
    setStyleEdits(next)
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current.timer)
    pendingSaveRef.current = {
      style: next,
      timer: setTimeout(() => flushPendingSaveRef.current(), 600),
    }
  }
  useEffect(() => () => flushPendingSaveRef.current(), [])

  const [settingsOpen, setSettingsOpen] = useState(false)
  // mount-once: after the first open the editor stays mounted, only hidden
  const settingsEverOpened = useRef(false)
  if (settingsOpen) settingsEverOpened.current = true

  // Auto-start is the studio default: the print goes the moment THH's preflight
  // clears (idle printer, clean bed, passing checks). When it can't, THH parks
  // the job and the roster's ParkedJobCard resolves it in place — so there's no
  // held-job dead-end, and no reason to make the user choose a policy up front.
  const startPolicy: TicketStartPolicy = 'auto'

  // ---- submit ---------------------------------------------------------------
  // The idempotency key is bound to the submit's CONTENT, not the panel's
  // lifetime (see ./print-idempotency): an unchanged resubmit — the lost- or
  // ambiguous-response retry the key exists for — reuses it so THH replays the
  // one job, while editing any print-determining input rotates it so the edit
  // becomes a new job instead of being silently deduped onto the stale one. A
  // success clears it, so the next print (even an identical one) is fresh.
  const idemRef = useRef<IdempotencyToken | null>(null)

  const submit = useMutation({
    mutationFn: async (): Promise<unknown> => {
      if (!printerId) throw new Error('No printer available')
      if (!style) throw new Error('Print settings are still loading')

      // The race covers the whole bundle (frame + marker part passes) — the
      // bundle promise resolves only after all renders land. The 3MF builds from
      // the bundle's own params snapshot; the ticket/idempotency below keep using
      // the live `params` prop (they describe submit intent, and any divergence
      // requires editing the design inside the render window).
      //
      // The design-snapshot persist (abaci#22) rides IN PARALLEL with the render:
      // it's bounded and TOTAL — null on any failure — so a dead snapshot API
      // costs the job its deep edit link, never the print. The envelope is the
      // restorable intent (params + pins + profile); the AMS projection
      // (filamentMap/slotLabels) rides as provenance only.
      const slotLabels = catalog.spools.map((s) => s.name)
      const [parts, designId] = await Promise.all([
        Promise.race([
          requestExportParts(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("The 3D render didn't finish — try again")),
              EXPORT_TIMEOUT_MS
            )
          ),
        ]),
        persistAbacusDesign({ v: 1, params, overrides, profileId }, { filamentMap, slotLabels }),
      ])
      // Supports push the first layer past the model outline, eating into the 6 mm the
      // tower was pinned at — the best available reading of prod's exit 155 on
      // 2026-07-29 (a later A/B slices 6 mm clean, so treat the wider gap as margin,
      // not a proven cure). The style's `enable_support`, not the design's feet
      // setting, is the print's real source of truth, so the gap keys off the style.
      const model = buildAbacusThreeMf({
        ...parts,
        filamentMap,
        slotLabels,
        supportsAtSlice: supportsWanted,
        bed: printerBed
          ? {
              wMm: printerBed.sizeMm.x,
              dMm: printerBed.sizeMm.y,
              exclude: (printerBed.exclusionsMm ?? []).flatMap((zone) => {
                if (zone.pointsMm.length === 0) return []
                const xs = zone.pointsMm.map((point) => point[0])
                const ys = zone.pointsMm.map((point) => point[1])
                const x0 = Math.min(...xs)
                const y0 = Math.min(...ys)
                return [
                  {
                    xMm: x0,
                    yMm: y0,
                    wMm: Math.max(...xs) - x0,
                    dMm: Math.max(...ys) - y0,
                  },
                ]
              }),
            }
          : undefined,
        wipeTower: wipeTower ?? undefined,
      })

      // Reuse the key only for an identical resubmit; any edit rotates it.
      const idem = resolveIdempotencyKey(
        idemRef.current,
        abacusPrintSignature({
          params,
          filamentMap,
          slotLabels,
          style,
          startPolicy,
          supportInterfaceSlotId: supportPick,
          printerBed,
          wipeTower,
        }),
        () => crypto.randomUUID()
      )
      idemRef.current = idem
      const baseTicket = buildAbacusTicket({
        name: `Abacus — ${params.cols} columns`,
        // With a persisted snapshot the artifact IS the design row (abaci#22);
        // a failed persist degrades to the pre-#22 shallow provenance.
        source: designId
          ? {
              artifactId: `design-${designId}`,
              artifactUrl: `${window.location.origin}${studioHref('/create/abacus', {
                playerId: null,
                designId,
              })}`,
              label: `${params.cols}-column abacus`,
            }
          : {
              artifactId: `abacus-${params.cols}col-x${params.scale_factor}`,
              artifactUrl: `${window.location.origin}/create/abacus`,
              label: `${params.cols}-column abacus`,
            },
        bodies: model.bodies,
        catalog,
        style,
        startPolicy,
        idempotencyKey: idem.key,
        supportInterfaceSlotId: supportPick,
        // A link back to the editor, not print content — deliberately outside
        // the idempotency signature (changing players must not rotate the key,
        // and neither may a transiently failed snapshot persist).
        authoring: buildAbacusAuthoring(playerId, { designId }),
      })
      // Send the machine-readable contract only when this service advertised it and the
      // FINAL routed filament list (including an added support-interface spool) is inside
      // the profile's tested bound. Older/over-capacity jobs still carry the embedded pin
      // and follow THH's non-blocking legacy leg.
      const ticket =
        wipeTower &&
        model.wipeTower &&
        baseTicket.filaments.length > 1 &&
        baseTicket.filaments.length <= wipeTower.maxFilaments
          ? { ...baseTicket, wipeTower: model.wipeTower }
          : baseTicket

      const form = new FormData()
      form.set(
        'model',
        new File([model.bytes as BlobPart], abacusModelFileName(params.cols, idem.sig), {
          type: 'model/3mf',
        })
      )
      form.set('job', JSON.stringify(ticket))
      const cq = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ''
      const res = await api(`abacus/print/printers/${encodeURIComponent(printerId)}/jobs${cq}`, {
        method: 'POST',
        body: form,
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new PrintServiceError(res.status, body)
      return body
    },
    onSuccess: () => {
      idemRef.current = null
      queryClient.invalidateQueries({ queryKey: abacusPrintKeys.jobs() })
    },
  })

  const submitFailure = submit.error instanceof PrintServiceError ? submit.error.failure : null
  const invalidDetail = submitFailure?.invalidTicket ?? undefined
  const applied = useMemo(() => extractApplied(submit.data), [submit.data])

  // ---- jobs roster + resolve actions (ring-invalidated; no poll) ------------
  const { jobRows } = useAbacusPrintJobs({ enabled: visible && serviceReady, connectionId })
  const startJob = useStartPrintJob()
  const cancelJob = useCancelPrintJob()

  // One mutation instance backs every row; scope its pending/error to the row
  // it's acting on by matching the in-flight variables' jobId, so acting on one
  // parked job never spins or reddens another.
  const startFailureFor = (jobId: string): SubmitFailure | null =>
    startJob.error instanceof PrintServiceError && startJob.variables?.jobId === jobId
      ? startJob.error.failure
      : null
  const cancelFailureFor = (jobId: string): SubmitFailure | null =>
    cancelJob.error instanceof PrintServiceError && cancelJob.variables?.jobId === jobId
      ? cancelJob.error.failure
      : null

  // When the service refused because the printer is busy, name the job that's
  // holding it — correlate its id against the roster we already read.
  const blockingJob = useMemo(
    () =>
      submitFailure?.blockingJobId
        ? (jobRows.find((j) => j.id === submitFailure.blockingJobId) ?? null)
        : null,
    [submitFailure, jobRows]
  )

  // Printed TPU feet stand the bottom face off the bed — a supports-off submit
  // would print a floating first layer. Blocked with a one-click fix (below),
  // never a silent style injection (see feetSupportGate).
  const feetGate = feetSupportGate(params, style)

  const submitBlocked =
    exportBlocked ||
    !serviceReady ||
    !style ||
    catalog.source !== 'thh-ams' ||
    submit.isPending ||
    feetGate.blocked

  return (
    <div
      data-component="abacus-studio-print-panel"
      data-embedded={embedded || undefined}
      style={{
        position: embedded ? 'static' : 'absolute',
        ...(embedded ? {} : { top: 12, right: 12 }),
        width: embedded ? '100%' : settingsOpen ? 380 : 280,
        maxHeight: embedded ? undefined : 'calc(100% - 24px)',
        overflowY: embedded ? undefined : 'auto',
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 12,
        background: 'rgba(17,24,39,0.9)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(226,232,240,0.95)',
        fontSize: 12,
        transition: 'width 0.15s ease',
      }}
    >
      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true">🖨</span> Print service
        {ring.connected && (
          <span
            data-element="print-ring-live"
            title="Live job updates connected"
            style={{ fontSize: 10, color: 'rgba(74,222,128,0.9)', fontWeight: 600 }}
          >
            · live
          </span>
        )}
      </div>

      {unavailable !== null ? (
        <div data-element="print-service-unavailable" style={{ color: 'rgba(148,163,184,0.95)' }}>
          {UNAVAILABLE_COPY[unavailable]}
          {/* Remediation is per-reason: not-configured (zero connections) gets an
              inline quick-pair (0 → 1, keeps the sole-connection fallback);
              unreachable/error get a retry that re-runs the reads; unauthorized/
              error also link to Settings › Printing (a dead or ambiguous
              connection must be fixed there, not re-paired inline). no-printer is
              service-side with no client action, so it stays copy-only. */}
          {unavailable === 'not-configured' ? (
            <PairPrinterPrompt />
          ) : (
            <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
              {/* Transient reads (unreachable) and unexpected faults (error) are
                  worth retrying in place — re-run the printer/filament reads. */}
              {(unavailable === 'unreachable' || unavailable === 'error') && (
                <button
                  type="button"
                  data-action="retry-print-service"
                  onClick={() => queryClient.invalidateQueries({ queryKey: abacusPrintKeys.all })}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(148,163,184,0.12)',
                    color: 'rgba(226,232,240,0.95)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              )}
              {/* unauthorized means a broken connection already exists; re-pairing
                  inline would make a SECOND one and break the sole-connection
                  fallback, so send those to Settings › Printing to remove the dead
                  one first. 'error' is ambiguous enough (a 400 from a connection
                  the studio can't disambiguate, a 5xx) that Settings is the right
                  escape hatch too. */}
              {(unavailable === 'unauthorized' || unavailable === 'error') && (
                <a
                  data-action="manage-print-connections"
                  href="/settings?tab=printing"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(196,181,253,0.95)',
                    textDecoration: 'underline',
                  }}
                >
                  Manage printers in Settings →
                </a>
              )}
            </div>
          )}
        </div>
      ) : isLoading ? (
        // First roster read in flight. Deliberately its OWN neutral state, never
        // the amber empty-roster notice below: "still asking the printer" and
        // "asked, nothing loaded" are different states, and only the latter is
        // actionable. No retry control — nothing to retry while a read is running.
        <div
          data-element="print-service-loading"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(148,163,184,0.95)',
            lineHeight: 1.5,
          }}
        >
          <span aria-hidden="true">⏳</span> Reading your printer’s loaded filaments…
        </div>
      ) : catalog.source !== 'thh-ams' ? (
        // Service reachable + a printer found + the read RESOLVED, but there's no
        // printable live roster to map onto. Not a failure and NOT loading (those
        // are the branches above). This is a PRIORITY CHAIN, most-specific first:
        //   E. externalUnprintable — a spool IS loaded on the external holder but
        //      its material is unresolved (family:null → catalog dropped it). Must
        //      be checked BEFORE rosterEmpty: a row exists (rosterEmpty is false),
        //      yet something is physically loaded, so "nothing loaded" would lie.
        //   defensive — roster read didn't resolve to an empty count either (should
        //      not normally reach source!=='thh-ams'); preview the designed colors.
        //   C(AMS)  — hasAms: an AMS that reports no loaded spools.
        //   C(noAMS)— else: no AMS and the external holder is empty.
        // hasAms = live amsPresent ?? static printerMultiMaterial (see above).
        <div
          data-element="print-roster-empty"
          data-degrade={panelState.kind}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(120,53,15,0.30)',
            border: '1px solid rgba(251,191,36,0.45)',
            color: 'rgba(254,243,199,0.96)',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true">
              {panelState.kind === 'external-unprintable' ? '🎨' : '🎞️'}
            </span>{' '}
            {panelState.kind === 'external-unprintable'
              ? 'Loaded filament not recognized'
              : 'No loaded filament to print with'}
          </div>
          <div>
            {panelState.kind === 'external-unprintable'
              ? 'A spool is loaded on the external holder, but the printer couldn’t identify its material, so one-click print can’t choose settings for it.'
              : panelState.kind === 'roster-unavailable'
                ? 'The live filament roster isn’t available right now, so the studio is previewing your designed colors instead of the real spools.'
                : panelState.kind === 'ams-empty'
                  ? 'The printer is connected, but its AMS reports no loaded spools. One-click print maps your designed colors onto the filaments that are actually loaded, so it needs at least one.'
                  : 'The printer is connected, but nothing is loaded — no AMS, and the external spool holder is empty. Load a spool and press Try again.'}
          </div>
          <div style={{ color: 'rgba(254,243,199,0.82)' }}>
            {panelState.kind === 'external-unprintable' ? (
              <>
                Reload a recognized filament, or use <strong>Download 3MF to print</strong> above
                and pick the material yourself.
              </>
            ) : (
              <>
                Use <strong>Download 3MF to print</strong> above to slice it yourself, or load
                filament and press Try again.
              </>
            )}
          </div>
          <button
            type="button"
            data-action="retry-print-service"
            onClick={() => queryClient.invalidateQueries({ queryKey: abacusPrintKeys.all })}
            disabled={isFetching}
            style={{
              alignSelf: 'flex-start',
              padding: '5px 11px',
              borderRadius: 6,
              border: '1px solid rgba(251,191,36,0.5)',
              background: 'rgba(254,243,199,0.12)',
              color: 'rgba(254,243,199,0.98)',
              fontSize: 12,
              fontWeight: 600,
              cursor: isFetching ? 'progress' : 'pointer',
              opacity: isFetching ? 0.7 : 1,
            }}
          >
            {isFetching ? 'Checking…' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          {/* No-AMS single-spool print (state D): the design is still submittable,
              but a one-nozzle printer lays it down in ONE color — surface that here,
              non-blocking, so the collapse from multi-color is never a surprise. The
              submit button below stays enabled (submitBlocked doesn't gate on this). */}
          {monochromeExternal && (
            <div
              data-element="print-monochrome-note"
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(30,58,138,0.28)',
                border: '1px solid rgba(96,165,250,0.45)',
                color: 'rgba(219,234,254,0.96)',
                lineHeight: 1.45,
              }}
            >
              <span aria-hidden="true">🎨</span>
              <span>
                No AMS — this prints in a single color ({catalog.spools[0]?.name}). Your multi-color
                design collapses to one filament.
              </span>
            </div>
          )}
          {/* Printed-feet support gate (Gitea #23), in two grades: supports OFF
              blocks the submit, supports on but free to land on the model is
              advice. Either way the button writes the missing keys through the
              normal debounce-persisted style path — visible in the editor, never
              a silent injection at ticket-build time (the v2 discipline holds).
              These have to ride the STYLE: THH's --load-settings overrides the
              3MF's project_settings, so the 3MF copy reaches downloads only. */}
          {feetGate.missing.length > 0 && (
            <div
              data-element="print-feet-support-gate"
              data-grade={feetGate.blocked ? 'blocking' : 'advisory'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: feetGate.blocked ? 'rgba(120,53,15,0.30)' : 'rgba(30,58,138,0.28)',
                border: feetGate.blocked
                  ? '1px solid rgba(251,191,36,0.45)'
                  : '1px solid rgba(96,165,250,0.45)',
                color: feetGate.blocked ? 'rgba(254,243,199,0.96)' : 'rgba(219,234,254,0.96)',
                lineHeight: 1.45,
              }}
            >
              <span>
                <span aria-hidden="true">🦶 </span>
                {feetGate.blocked
                  ? 'Printed TPU feet stand the abacus off the bed, so the bottom face needs supports — turn them on to print.'
                  : 'Supports are on. Keep them off the model too, or they can grow inside the bead channels where you cannot reach them.'}
              </span>
              <button
                type="button"
                data-action="enable-feet-supports"
                disabled={!style}
                onClick={() =>
                  style &&
                  handleStyleChange({
                    ...style,
                    process: {
                      ...style.process,
                      ...Object.fromEntries(
                        feetGate.missing.map((key) => [key, FEET_SUPPORT_PROCESS[key]])
                      ),
                    },
                  })
                }
                style={{
                  alignSelf: 'flex-start',
                  padding: '5px 11px',
                  borderRadius: 6,
                  border: feetGate.blocked
                    ? '1px solid rgba(251,191,36,0.5)'
                    : '1px solid rgba(96,165,250,0.5)',
                  background: feetGate.blocked
                    ? 'rgba(254,243,199,0.12)'
                    : 'rgba(219,234,254,0.12)',
                  color: feetGate.blocked ? 'rgba(254,243,199,0.98)' : 'rgba(219,234,254,0.98)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {feetGate.blocked ? 'Enable supports' : 'Keep supports off the model'}
              </button>
            </div>
          )}
          {slowFirstLayerSupported && (
            <div
              data-element="slow-first-layer-choice"
              data-active={slowFirstLayerActive || undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: slowFirstLayerActive ? 'rgba(8,145,178,0.22)' : 'rgba(30,41,59,0.48)',
                border: slowFirstLayerActive
                  ? '1px solid rgba(34,211,238,0.5)'
                  : '1px solid rgba(148,163,184,0.3)',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.35 }}>
                <strong style={{ color: 'rgba(226,232,240,0.98)' }}>Slow first layer</strong>
                <span style={{ color: 'rgba(148,163,184,0.95)', fontSize: 11 }}>
                  {SLOW_FIRST_LAYER_PROCESS.initial_layer_speed} mm/s ·{' '}
                  {SLOW_FIRST_LAYER_PROCESS.initial_layer_acceleration} mm/s². Try this before
                  adding a brim.
                </span>
              </span>
              <button
                type="button"
                data-action="toggle-slow-first-layer"
                aria-pressed={slowFirstLayerActive}
                disabled={!style}
                onClick={() =>
                  style && handleStyleChange(withSlowFirstLayer(style, !slowFirstLayerActive))
                }
                style={{
                  flex: '0 0 auto',
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: slowFirstLayerActive
                    ? '1px solid rgba(34,211,238,0.7)'
                    : '1px solid rgba(148,163,184,0.45)',
                  background: slowFirstLayerActive
                    ? 'rgba(34,211,238,0.16)'
                    : 'rgba(255,255,255,0.06)',
                  color: slowFirstLayerActive ? 'rgba(207,250,254,0.98)' : 'rgba(226,232,240,0.95)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: style ? 'pointer' : 'not-allowed',
                }}
              >
                {slowFirstLayerActive ? 'Use preset speed' : 'Slow it down'}
              </button>
            </div>
          )}
          <button
            type="button"
            data-action="submit-print-job"
            onClick={() => submit.mutate()}
            disabled={submitBlocked}
            title={
              exportBlocked
                ? 'Fix the printability errors first'
                : feetGate.blocked
                  ? 'Enable supports first — printed feet need them'
                  : 'Slice and print on the paired printer'
            }
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: submitBlocked
                ? 'rgba(75,85,99,0.55)'
                : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              color: submitBlocked ? 'rgba(209,213,219,0.7)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: submitBlocked ? 'not-allowed' : 'pointer',
            }}
          >
            {submit.isPending ? 'Rendering & submitting…' : '🖨 Print this abacus'}
          </button>

          {submit.isSuccess && (
            <div
              data-element="print-submit-success"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(20,83,45,0.35)',
                border: '1px solid rgba(74,222,128,0.5)',
                color: 'rgba(220,252,231,0.96)',
                lineHeight: 1.45,
              }}
            >
              Job submitted — it’ll start on its own once the printer’s ready, or show up below to
              resolve if the bed needs a look.
              {applied && ' Some settings were adjusted by the printer — see the editor.'}
            </div>
          )}

          {submit.isError && (
            <PrintSubmitErrorNotice
              failure={submitFailure}
              blockingJob={blockingJob}
              fallbackMessage={
                submit.error instanceof Error ? submit.error.message : 'Submit failed.'
              }
            />
          )}

          {/* settings disclosure — the editor mounts once and stays mounted */}
          <button
            type="button"
            data-action="toggle-print-settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 2px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(203,213,225,0.9)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>Print settings</span>
            <span aria-hidden="true">{settingsOpen ? '▾' : '▸'}</span>
          </button>

          {settingsEverOpened.current && (
            <div
              data-element="print-settings-editor"
              style={{ display: settingsOpen ? 'block' : 'none' }}
            >
              {caps.isError ? (
                <div style={{ color: 'rgba(252,165,165,0.95)', lineHeight: 1.45 }}>
                  Couldn&apos;t load the printer&apos;s settings schema.
                </div>
              ) : caps.data && style ? (
                <PrintSettingsEditor
                  doc={caps.data}
                  value={style}
                  onChange={handleStyleChange}
                  errors={invalidDetail}
                  applied={applied}
                  theme="dark"
                  commonKeys={COMMON_KEYS}
                />
              ) : (
                <div style={{ color: 'rgba(148,163,184,0.95)' }}>Loading settings…</div>
              )}
            </div>
          )}

          {/* Support-interface routing (Gitea #23, THH#367) — visible whenever the
              style enables supports, independent of the settings disclosure: the
              pick changes what the printer lays down, so it must never hide behind
              a collapsed editor. The recommendation ★ and any service caution
              render inside the kit editor; the reminder ("load your Support for
              PLA") is service DATA the kit leaves to the host. */}
          {supportsWanted && (
            <div
              data-element="print-support-role"
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {/* A `null` recommendation is the kit's "supports aren't needed"
                  state, so an unresolved query must NOT be flattened into one —
                  that would tell the operator no support is needed directly under
                  the banner that just forced supports on. Say what's true instead:
                  still asking, or couldn't ask. */}
              {supportRec.data === undefined ? (
                <span
                  data-element="print-supports-line"
                  style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.95)' }}
                >
                  {supportRec.isError
                    ? "Couldn't reach the printer for a support-interface recommendation — the interface will print in the model's own filament."
                    : 'Checking which filament should face the supports…'}
                </span>
              ) : (
                <>
                  <span
                    data-element="print-supports-line"
                    style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,0.95)' }}
                  >
                    {supportsLine(supportRec.data, supportSlotId, supportRoster)}
                  </span>
                  <SupportRoleEditor
                    roster={supportRoster}
                    recommendation={supportRec.data}
                    value={supportSlotId}
                    onChange={setSupportSlotId}
                    errors={invalidDetail}
                    theme="dark"
                  />
                </>
              )}
              {supportRec.data?.reminder && (
                <div
                  data-element="print-support-reminder"
                  style={{ color: 'rgba(251,191,36,0.95)', lineHeight: 1.45 }}
                >
                  <span aria-hidden="true">💡 </span>
                  Loading {supportRec.data.reminder.product} ({supportRec.data.reminder.family})
                  would give these supports a cleaner release.
                </div>
              )}
            </div>
          )}

          {/* recent jobs — identifiers from the ring, truth from the proxy read */}
          {jobRows.length > 0 && (
            <div
              data-element="print-jobs-list"
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'rgba(148,163,184,0.9)',
                }}
              >
                Jobs
              </span>
              {jobRows.slice(0, 5).map((job) => {
                const failure = job.error ? describeJobError(job.error) : null
                const supportCollision = job.error?.context?.supportsEnabled === true
                return (
                  <div
                    key={job.id}
                    data-element="print-job-row"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {job.name}
                      </span>
                      <span style={{ color: 'rgba(148,163,184,0.95)', whiteSpace: 'nowrap' }}>
                        {job.phase}
                        {job.progress !== null && ` · ${Math.round(job.progress)}%`}
                      </span>
                    </div>
                    {job.error && failure && (
                      <div
                        data-element="print-job-error"
                        role="alert"
                        style={{
                          color: 'rgba(251,191,36,0.95)',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5,
                        }}
                      >
                        <div>
                          <span aria-hidden="true">✕ </span>
                          <strong>{failure.summary}</strong>
                        </div>
                        <div>{failure.action}</div>
                        {supportCollision && (
                          <div>
                            Printed feet add supports beneath the abacus. Those supports occupy
                            plate space too, so replacing TPU with another filament does not remove
                            the collision.
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {failure.recommended === 'relayout_plate' && (
                            <button
                              type="button"
                              onClick={() => submit.mutate()}
                              disabled={submit.isPending}
                              style={{
                                border: '1px solid rgba(251,191,36,0.55)',
                                borderRadius: 5,
                                background: 'rgba(251,191,36,0.08)',
                                color: 'inherit',
                                padding: '4px 8px',
                                cursor: submit.isPending ? 'wait' : 'pointer',
                              }}
                            >
                              {submit.isPending ? 'Rebuilding…' : 'Rebuild plate & resubmit'}
                            </button>
                          )}
                          {job.authoring && (
                            <a
                              href={job.authoring.editUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'rgba(147,197,253,0.98)', padding: '4px 0' }}
                            >
                              Edit in {job.authoring.editTool ?? 'Abacus Studio'} ↗
                            </a>
                          )}
                        </div>
                        <details>
                          <summary style={{ cursor: 'pointer' }}>Technical details</summary>
                          <div style={{ marginTop: 3 }}>{failure.technical ?? job.error.code}</div>
                        </details>
                      </div>
                    )}
                    {/* What the service couldn't CHECK before running it (#29).
                      Reads after the failure and before the resolver: facts
                      first, then the thing you can press. Renders on every
                      phase — a notice-only job never parks, so ParkedJobCard
                      below would never mount to carry it. */}
                    <JobNotices notices={job.notices} />
                    {/* Auto-start couldn't just go (or paused mid-print): resolve
                      it here — bed photo, the service's reasons, start-anyway or
                      cancel — instead of leaving it a dead-end. */}
                    {(isParked(job.phase) || job.attention.length > 0) && (
                      <ParkedJobCard
                        job={job}
                        onStart={(acknowledge) => startJob.mutate({ jobId: job.id, acknowledge })}
                        onCancel={(stopPrint) => cancelJob.mutate({ jobId: job.id, stopPrint })}
                        startPending={startJob.isPending && startJob.variables?.jobId === job.id}
                        cancelPending={cancelJob.isPending && cancelJob.variables?.jobId === job.id}
                        startFailure={startFailureFor(job.id)}
                        cancelFailure={cancelFailureFor(job.id)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
