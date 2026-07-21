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

import {
  type InvalidTicketDetail,
  type ParamScalarValue,
  parseInvalidTicket,
  type TicketStartPolicy,
  type TicketStyle,
} from '@eink/print-dialog'
import { PrintSettingsEditor } from '@eink/print-dialog/ui'
import '@eink/print-dialog/ui/style.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAbacusPrintSettings, useSaveAbacusPrintSettings } from '@/hooks/useAbacusPrintSettings'
import { usePrintJobRing } from '@/hooks/usePrintJobRing'
import { useUserId } from '@/hooks/useUserId'
import { createAbacusPrintClient } from '@/lib/abacus/print/browser-transport'
import type { PrintUnavailableReason } from '@/lib/abacus/print/filament-wire'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { buildAbacusThreeMf } from './abacus-3mf'
import type { FilamentCatalog } from './abacus-catalog'
import type { FilamentMap, Params } from './abacus-model'
import { buildAbacusTicket } from './abacus-ticket'
import { PairPrinterPrompt } from './PrintConnectionsManager'
import { normalizeJobs } from './print-jobs'

export interface PrintPanelProps {
  /** Rendered but hidden when false — internal state (style edits) survives. */
  visible: boolean
  params: Params
  filamentMap: FilamentMap
  catalog: FilamentCatalog
  /** The discovered THH printer (multi-material preferred), or null. */
  printerId: string | null
  unavailable: PrintUnavailableReason | null
  /** Solver gate — a design that won't print can't be submitted either. */
  exportBlocked: boolean
  /** One-shot high-quality export render of the current params. */
  requestExportStl: () => Promise<ArrayBuffer>
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
  'brim_type',
] as const

const UNAVAILABLE_COPY: Record<PrintUnavailableReason, string> = {
  'not-configured': 'No print service paired — download the 3MF instead.',
  unreachable: 'Print service unreachable right now.',
  unauthorized: 'The print service rejected our credentials — re-pair to reconnect.',
  'no-printer': 'The print service has no printers.',
}

/** A submit rejection, with the per-key detail when the body was invalid_ticket. */
class PrintSubmitError extends Error {
  readonly status: number
  readonly detail: InvalidTicketDetail | null
  constructor(status: number, body: unknown) {
    const detail = parseInvalidTicket(body)
    super(
      detail
        ? 'The print service rejected some settings — highlighted below.'
        : `Submit failed (${status}). Try again.`
    )
    this.status = status
    this.detail = detail
  }
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
    params,
    filamentMap,
    catalog,
    printerId,
    unavailable,
    exportBlocked,
    requestExportStl,
  } = props

  const queryClient = useQueryClient()
  const userId = useUserId().data ?? undefined
  // Doorbell listener: rings invalidate the job/filament queries read below.
  const ring = usePrintJobRing(userId)

  const serviceReady = unavailable === null && printerId !== null

  // ---- capabilities through the package client (ETag revalidation inside) ---
  const client = useMemo(() => createAbacusPrintClient(), [])
  const caps = useQuery({
    queryKey: abacusPrintKeys.capabilities(),
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

  const [startPolicy, setStartPolicy] = useState<TicketStartPolicy>('hold')

  // ---- submit ---------------------------------------------------------------
  // One idempotency key per submit intent: retries of a failed submit reuse it
  // (the service dedupes), a success mints fresh for the next job.
  const idemRef = useRef<string | null>(null)

  const submit = useMutation({
    mutationFn: async (): Promise<unknown> => {
      if (!printerId) throw new Error('No printer available')
      if (!style) throw new Error('Print settings are still loading')

      const stl = await Promise.race([
        requestExportStl(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("The 3D render didn't finish — try again")),
            EXPORT_TIMEOUT_MS
          )
        ),
      ])
      const model = buildAbacusThreeMf({
        stl,
        params,
        filamentMap,
        slotLabels: catalog.spools.map((s) => s.name),
      })
      idemRef.current ??= crypto.randomUUID()
      const ticket = buildAbacusTicket({
        name: `Abacus — ${params.cols} columns`,
        source: {
          artifactId: `abacus-${params.cols}col-x${params.scale_factor}`,
          artifactUrl: `${window.location.origin}/create/abacus`,
          label: `${params.cols}-column abacus`,
        },
        bodies: model.bodies,
        catalog,
        style,
        startPolicy,
        idempotencyKey: idemRef.current,
      })

      const form = new FormData()
      form.set(
        'model',
        new File([model.bytes as BlobPart], `abacus-${params.cols}col.3mf`, { type: 'model/3mf' })
      )
      form.set('job', JSON.stringify(ticket))
      const res = await api(`abacus/print/printers/${encodeURIComponent(printerId)}/jobs`, {
        method: 'POST',
        body: form,
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new PrintSubmitError(res.status, body)
      return body
    },
    onSuccess: () => {
      idemRef.current = null
      queryClient.invalidateQueries({ queryKey: abacusPrintKeys.jobs() })
    },
  })

  const invalidDetail =
    submit.error instanceof PrintSubmitError ? (submit.error.detail ?? undefined) : undefined
  const applied = useMemo(() => extractApplied(submit.data), [submit.data])

  // ---- jobs roster (ring-invalidated; reconcile on reconnect — no poll) -----
  const jobs = useQuery({
    queryKey: abacusPrintKeys.jobs(),
    queryFn: async () => {
      const res = await api('abacus/print/jobs')
      if (!res.ok) throw new Error(`jobs read failed: ${res.status}`)
      return (await res.json()) as unknown
    },
    enabled: visible && serviceReady,
    staleTime: 5_000,
  })
  const jobRows = useMemo(() => normalizeJobs(jobs.data), [jobs.data])

  const submitBlocked =
    exportBlocked || !serviceReady || !style || catalog.source !== 'thh-ams' || submit.isPending

  return (
    <div
      data-component="abacus-studio-print-panel"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        width: settingsOpen ? 380 : 280,
        maxHeight: 'calc(100% - 24px)',
        overflowY: 'auto',
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
          {/* not-configured means zero connections — inline quick-pair is
              unambiguous (0 → 1) and the studio's sole-connection proxy
              fallback keeps working. unauthorized means a broken connection
              already exists; re-pairing inline would make a SECOND one and
              break that fallback, so send those to Settings › Printing to
              remove the dead one first. unreachable / no-printer are
              service-side — pairing won't help — so they stay copy-only. */}
          {unavailable === 'not-configured' ? (
            <PairPrinterPrompt />
          ) : unavailable === 'unauthorized' ? (
            <a
              data-action="manage-print-connections"
              href="/settings?tab=printing"
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(196,181,253,0.95)',
                textDecoration: 'underline',
              }}
            >
              Manage printers in Settings →
            </a>
          ) : null}
        </div>
      ) : (
        <>
          {/* start policy — hold is the cautious default for a first print */}
          <div
            data-element="print-start-policy"
            role="radiogroup"
            aria-label="When should the print start"
            style={{ display: 'flex', gap: 6 }}
          >
            {(
              [
                { policy: 'hold', label: 'Hold for release' },
                { policy: 'auto', label: 'Start right away' },
              ] as const
            ).map(({ policy, label }) => (
              <button
                key={policy}
                type="button"
                role="radio"
                aria-checked={startPolicy === policy}
                data-action="set-start-policy"
                data-policy={policy}
                onClick={() => setStartPolicy(policy)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border:
                    startPolicy === policy
                      ? '1px solid rgba(34,211,238,0.7)'
                      : '1px solid rgba(255,255,255,0.14)',
                  background: startPolicy === policy ? 'rgba(8,145,178,0.35)' : 'transparent',
                  color: 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-action="submit-print-job"
            onClick={() => submit.mutate()}
            disabled={submitBlocked}
            title={
              exportBlocked
                ? 'Fix the printability errors first'
                : catalog.source !== 'thh-ams'
                  ? 'Waiting for the AMS filament roster'
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
              Job submitted{startPolicy === 'hold' ? ' — release it from the print service' : ''}.
              {applied && ' Some settings were adjusted by the printer — see the editor.'}
            </div>
          )}

          {submit.isError && (
            <div
              data-element="print-submit-error"
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(127,29,29,0.35)',
                border: '1px solid rgba(248,113,113,0.5)',
                color: 'rgba(254,226,226,0.96)',
                lineHeight: 1.45,
              }}
            >
              {submit.error instanceof Error ? submit.error.message : 'Submit failed.'}
            </div>
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
              {jobRows.slice(0, 5).map((job) => (
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
                  {job.error && (
                    // The service's own explanation, verbatim and never
                    // truncated — the actionable part is often the tail.
                    <div
                      data-element="print-job-error"
                      style={{
                        color: 'rgba(251,191,36,0.95)',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span aria-hidden="true">✕ </span>
                      {job.error.message ?? job.error.code}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
