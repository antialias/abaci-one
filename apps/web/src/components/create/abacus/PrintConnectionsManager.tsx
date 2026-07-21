'use client'

// Abacus Studio — print-service connection manager (Gitea epic #5, #8).
//
// The roster/pairing UI itself is the shared PrintConnectionsManager from
// @eink/print-dialog — the same component the eink Frame Studio settings page
// mounts — so every THH-connected app presents pairing identically:
// pairing-first add (paste `CODE@host`, Pair, done), capability-gated row
// actions, one polite live region, two-tap remove with focus re-home. This
// file is the abaci HOST around it: DTOs → view-models, module transport fns →
// adapter, React Query invalidation → onChanged. The kit never sees a URL
// scheme, a probe wire shape, or an error code; the server never shows the
// browser a secret.
//
// Two entry points, one adapter:
//   • <PrintConnectionsManager> — the full roster (Settings › Printing).
//   • <PairPrinterPrompt>       — a compact paste-and-pair for the studio's
//                                 print panel, shown when nothing is paired.

import {
  PrintConnectionsManager as KitPrintConnectionsManager,
  PairConnectionForm,
  type PrintConnectionItem,
  type PrintConnectionsAdapter,
  type PrintConnectionsRoster,
} from '@eink/print-dialog/ui'
import '@eink/print-dialog/ui/style.css'
import { useState } from 'react'
import {
  type PrintConnectionDTO,
  type PrintProbeResult,
  pairConnection,
  probeConnection,
  removeConnection,
  renameConnection,
  useAbacusPrintConnections,
} from '@/hooks/useAbacusPrintConnections'
import { css } from '../../../../styled-system/css'

// ---------------------------------------------------------------------------
// Copy — abaci's voice, fed to the kit as data
// ---------------------------------------------------------------------------

const PROBE_REASON_COPY: Record<string, string> = {
  unreachable: 'No answer from the service right now.',
  unauthorized: 'The service rejected our credentials — re-pair to reconnect.',
  bad_response: 'The service answered, but not the way we expected.',
  'no-printer': 'Connected, but the service has no printers.',
}

function probeCopy(result: PrintProbeResult): string {
  if (result.ok) {
    const n = result.printerCount ?? 0
    return n === 1 ? 'Reachable — 1 printer' : `Reachable — ${n} printers`
  }
  return PROBE_REASON_COPY[result.reason ?? ''] ?? 'Connection check failed.'
}

/** The service origin, minus the scheme, for a compact row address. */
function displayHost(origin: string): string {
  try {
    return new URL(origin).host
  } catch {
    return origin.replace(/^https?:\/\//, '')
  }
}

/** Display name: the user's label, else the service host it points at. */
function connectionLabel(c: PrintConnectionDTO): string {
  return c.name || displayHost(c.origin)
}

/** DTO → kit view-model. No `health` chip: abaci's probe is on-demand only
 *  (nothing persisted), so rows wear no freshness state — verdicts flow
 *  through the kit's live region when the user checks. The webhook line
 *  always speaks (on OR not registered): whether live job updates work
 *  changes what the studio's queue can show, so both states earn a glance. */
function toItem(c: PrintConnectionDTO): PrintConnectionItem {
  return {
    id: c.id,
    label: connectionLabel(c),
    address: displayHost(c.origin),
    statusNote: c.webhookRegistered ? 'Live updates on' : 'Live updates not registered',
  }
}

// Transport → kit adapter. Every method throws Error whose .message is the
// server's display-ready prose (readError in the hook module) — the kit
// renders it verbatim. Absences are deliberate capability gating: no
// setDefault (nothing ever auto-picks a print target) and no addManual
// (pairing is the only abaci entry path), so those controls never render.
const adapter: PrintConnectionsAdapter = {
  pair: async (artifact) => {
    const connection = await pairConnection(artifact)
    return { label: connectionLabel(connection) }
  },
  remove: removeConnection,
  probe: async (id) => probeCopy(await probeConnection(id)),
  rename: async (id, name) => {
    await renameConnection(id, name)
  },
}

// ---------------------------------------------------------------------------
// Full manager (Settings › Printing)
// ---------------------------------------------------------------------------

export function PrintConnectionsManager({ isDark = false }: { readonly isDark?: boolean }) {
  const { connectionsQuery, invalidateAll } = useAbacusPrintConnections()

  const roster: PrintConnectionsRoster = connectionsQuery.isLoading
    ? { kind: 'loading' }
    : connectionsQuery.isError
      ? { kind: 'error', message: (connectionsQuery.error as Error).message }
      : { kind: 'ready', items: (connectionsQuery.data ?? []).map(toItem) }

  return (
    <div data-component="print-connections-manager">
      <KitPrintConnectionsManager
        roster={roster}
        adapter={adapter}
        onChanged={invalidateAll}
        description="Print services this account can send abacus plates to. Add one by pasting a pairing code from the service's pairing screen; removing it here forgets the access it granted."
        emptyHint="Pair one below to print your abacus designs."
        theme={isDark ? 'dark' : 'light'}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact prompt (Abacus Studio print panel — the dark slot)
// ---------------------------------------------------------------------------

/**
 * The paste-and-pair form for the studio's print panel, shown where the panel
 * would otherwise only say "No print service paired". Always renders on the
 * panel's dark ground. The kit's bare form deliberately carries no live region
 * of its own — this wrapper's status line is the `announce` outlet. On
 * success, invalidating the print queries flips the panel from unavailable to
 * ready with no reload; `onPaired` awaits it so the pending state covers the
 * refetch.
 */
export function PairPrinterPrompt() {
  const { invalidateAll } = useAbacusPrintConnections()
  const [notice, setNotice] = useState('')

  return (
    <div
      data-component="pair-printer-prompt"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginTop: '0.5rem',
      })}
    >
      <PairConnectionForm
        pair={adapter.pair}
        onPaired={invalidateAll}
        announce={setNotice}
        theme="dark"
      />
      <p
        role="status"
        aria-live="polite"
        data-element="pair-printer-notice"
        className={css({ minHeight: '0.9rem', fontSize: '0.75rem', color: 'green.400' })}
      >
        {notice}
      </p>
    </div>
  )
}
