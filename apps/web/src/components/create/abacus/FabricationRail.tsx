'use client'

// FabricationRail — the studio's RIGHT docked rail (Gitea epic #5, full-bleed
// CP1a). Everything specific to turning the shared design into a 3D print lives
// here: the filament reconcile strip (how the designed colors land on the loaded
// filaments), the printer profile + printability verdict, the Export actions, and
// the print-service panel. Mounted only on the 3D-print target, so the paper lane
// pays for none of it. The 3D model always shows the user's designed colors — the
// design→filament reconciliation is whispered by the strip, not a preview toggle.
//
// The heavy renders stay bound to the three.js viewer; this rail calls the
// store's registered `requestExportParts()` (whole abacus + the ArUco marker
// part passes, one params snapshot) and assembles the 3MF from that bundle plus
// the store's live filamentMap/catalog. `exporterReady` gates the buttons while
// the viewer chunk is still loading.

import { type CSSProperties, useMemo, useState } from 'react'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { useAbacusStudio } from './AbacusStudioContext'
import { buildAbacusThreeMf } from './abacus-3mf'
import { isModular } from './abacus-model'
import { PRINTER_PROFILES } from './abacus-solver'
import { downloadBlob } from './download-blob'
import { FilamentPlanPanel } from './FilamentPlanPanel'
import { ModularSeamPanel } from './ModularSeamPanel'
import { PrintPanel } from './PrintPanel'

const CYAN_GRADIENT = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'

// shared style for the one-click solver-fix buttons (sit inside the red error box)
const FIX_BTN: CSSProperties = {
  padding: '5px 9px',
  borderRadius: 6,
  border: '1px solid rgba(248,113,113,0.6)',
  background: 'rgba(254,226,226,0.12)',
  color: 'rgba(254,226,226,0.98)',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
}

export function FabricationRail() {
  const {
    params,
    set,
    profileId,
    setProfileId,
    profile,
    overrides,
    setOverrides,
    design,
    thhFilaments,
    connections,
    selectedConnectionId,
    selectConnection,
    catalog,
    servicePlan,
    unpinnedServicePlan,
    servicePlanUnavailable,
    servicePlanUnavailableDetail,
    planPending,
    unplacedRoles,
    filamentMap,
    solveResult,
    errors,
    warnings,
    exportBlocked,
    scaleFix,
    clearanceFix,
    requestExportStl,
    requestExportParts,
    requestExportModuleParts,
    exporterReady,
    setRevealIntrinsic,
    setHighlightRole,
    modelPick,
    playerId,
  } = useAbacusStudio()

  const canExport = exporterReady && !exportBlocked

  // Modular columns (Gitea #30): the whole-abacus exports are a footgun in
  // modular mode — they'd print a fused-seam monolith with dead sockets — so
  // they lock with a pointer at the kit. The print-service panel does NOT lock:
  // it switches to the kit (Gitea #32), packing every module onto one bed and
  // submitting that plate, and refuses to the kit-zip download only when the
  // modules genuinely don't fit one plate.
  const modular = isModular(params)
  const canExportMono = canExport && !modular

  // Rebuilt only when the requestor identity changes, so the panel's submit
  // mutation isn't handed a fresh object every render.
  const kitPrint = useMemo(() => ({ requestExportModuleParts }), [requestExportModuleParts])

  // A failed export render (e.g. a marker part pass) now REJECTS instead of
  // hanging — surfaced inline under the button. Silently swallowing it would
  // recreate the markerless-print bug in UX form (Gitea #12).
  const [exportError, setExportError] = useState<string | null>(null)

  // primary export: the multi-material 3MF — the print projection's colors baked
  // in as one co-registered body per filament slot (#9), plus the ArUco corner
  // marker bodies from their own part renders (#12). Falls back to the raw
  // colorless STL for anyone whose slicer wants that.
  const onExport3mf = async () => {
    setExportError(null)
    try {
      const parts = await requestExportParts()
      const { bytes } = buildAbacusThreeMf({
        ...parts, // stl + marker/feet part renders + the params snapshot they rendered from
        filamentMap,
        slotLabels: catalog.spools.map((s) => s.name),
      })
      downloadBlob(
        new Blob([bytes as BlobPart], { type: 'model/3mf' }),
        `abacus-${params.cols}col-x${params.scale_factor}.3mf`
      )
    } catch (err) {
      setExportError(String((err as Error)?.message ?? err))
    }
  }

  const onExportPlainStl = async () => {
    setExportError(null)
    try {
      const stl = await requestExportStl()
      downloadBlob(
        new Blob([stl], { type: 'model/stl' }),
        `abacus-${params.cols}col-x${params.scale_factor}.stl`
      )
    } catch (err) {
      setExportError(String((err as Error)?.message ?? err))
    }
  }

  return (
    <div
      data-component="fabrication-rail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '16px',
        color: 'rgba(243,244,246,1)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>3D print</div>

      {/* the single part-aware filament↔color list (Gitea #17): one row per abacus
          part, each with a thumbnail + a flecked tile of the filament it prints on.
          Hovering a row highlights that part on the 3D hero (onHighlightRole);
          hovering its tile flips the hero to the designed colors (onRevealIntrinsic).
          The reverse binding (#18): clicking a part on the hero opens its row here
          (modelPick, emitted by the viewer's raycaster). */}
      <FilamentPlanPanel
        design={design}
        catalog={catalog}
        overrides={overrides}
        servicePlan={servicePlan}
        unpinnedServicePlan={unpinnedServicePlan}
        planPending={planPending}
        onOverridesChange={setOverrides}
        onRevealIntrinsic={setRevealIntrinsic}
        onHighlightRole={setHighlightRole}
        modelPick={modelPick}
      />

      {/* printer profile — a first-class print setting (drives the gate below) */}
      <StudioSelect
        label="printer profile"
        value={profileId}
        options={PRINTER_PROFILES.map((p) => ({ value: p.id, label: p.label }))}
        onChange={setProfileId}
        dataElement="abacus-studio-profile"
        dataAction="select-profile"
      />

      {/* printability verdict: red errors block Export (with one-click fixes),
          amber warnings inform but don't block */}
      {solveResult.reasons.length > 0 && (
        <div
          data-element="abacus-studio-solver-reasons"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {errors.length > 0 && (
            <div
              data-element="abacus-studio-solver-errors"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(127,29,29,0.35)',
                border: '1px solid rgba(248,113,113,0.5)',
                color: 'rgba(254,226,226,0.96)',
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden="true">⛔</span> Won&apos;t print on {profile.label}
              </div>
              {errors.map((r) => (
                <div key={r.dim}>{r.message}</div>
              ))}
              {(scaleFix != null || clearanceFix != null) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                  {scaleFix != null && (
                    <button
                      type="button"
                      data-action="apply-solver-fix"
                      onClick={() => set('scale_factor', scaleFix)}
                      style={FIX_BTN}
                    >
                      ⤢ Scale up to {scaleFix}×
                    </button>
                  )}
                  {clearanceFix != null && (
                    <button
                      type="button"
                      data-action="apply-solver-fix"
                      onClick={() => set('clearance', clearanceFix)}
                      style={FIX_BTN}
                    >
                      ↕ Raise fit gap to {clearanceFix.toFixed(2)} mm
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {warnings.length > 0 && (
            <div
              data-element="abacus-studio-solver-warnings"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(120,53,15,0.30)',
                border: '1px solid rgba(251,191,36,0.45)',
                color: 'rgba(254,243,199,0.96)',
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden="true">⚠️</span> Heads up
              </div>
              {warnings.map((r) => (
                <div key={r.dim}>{r.message}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* primary action — the whole point of the print path */}
      <button
        type="button"
        data-action="export-3mf"
        onClick={onExport3mf}
        disabled={!canExportMono}
        title={
          modular
            ? 'Modular columns print as a per-module kit — use the Modular columns panel below'
            : exportBlocked
              ? `Fix the errors above to print on ${profile.label}`
              : exporterReady
                ? 'Download a print-ready multi-material 3MF'
                : 'Preparing the 3D exporter…'
        }
        style={{
          padding: '11px 12px',
          borderRadius: 8,
          border: 'none',
          background: canExportMono ? CYAN_GRADIENT : 'rgba(75,85,99,0.55)',
          color: canExportMono ? '#fff' : 'rgba(209,213,219,0.7)',
          fontSize: 13,
          fontWeight: 700,
          cursor: canExportMono ? 'pointer' : 'not-allowed',
          boxShadow: canExportMono ? '0 4px 14px rgba(6,182,212,0.35)' : 'none',
        }}
      >
        {modular ? '⬇ 3MF is one piece — kit below' : '⬇ Download 3MF to print'}
      </button>
      <button
        type="button"
        data-action="export-stl"
        onClick={onExportPlainStl}
        disabled={!canExportMono}
        title={
          modular
            ? 'Modular columns print as a per-module kit — use the Modular columns panel below'
            : undefined
        }
        style={{
          alignSelf: 'center',
          padding: '2px 4px',
          border: 'none',
          background: 'transparent',
          color: canExportMono ? 'rgba(148,163,184,0.9)' : 'rgba(148,163,184,0.5)',
          fontSize: 11,
          cursor: canExportMono ? 'pointer' : 'not-allowed',
          textDecoration: 'underline',
        }}
      >
        plain STL instead
      </button>
      {exportError != null && (
        <div
          data-element="abacus-studio-export-error"
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(127,29,29,0.35)',
            border: '1px solid rgba(248,113,113,0.5)',
            color: 'rgba(254,226,226,0.96)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          Export failed: {exportError}
        </div>
      )}

      {/* modular columns (Gitea #30): seam toggle, fit verdicts, coupon +
          module-kit downloads. Sits below the whole-abacus exports it replaces
          in modular mode. Always mounted — the toggle inside it is the config
          option, and the disclosure keeps it collapsed until asked for. */}
      <ModularSeamPanel />

      {/* which paired print service this design prints to. Only shown once the
          user has more than one — with a single connection there's nothing to
          choose and the proxy resolves it implicitly. Switching re-reads the
          printer, filament roster, capabilities, and job list for that service. */}
      {connections.length > 1 && (
        <StudioSelect
          label="print service"
          value={selectedConnectionId ?? ''}
          options={connections.map((c) => ({ value: c.id, label: c.name }))}
          onChange={selectConnection}
          dataElement="abacus-studio-print-connection"
          dataAction="select-print-connection"
        />
      )}

      {/* print-service panel (Gitea #9) — embedded (normal flow) in the rail.
          One panel, two shapes of print: in modular mode `kit` switches the
          submit onto the packed module plate (Gitea #32) instead of the
          one-piece abacus, which in modular mode would be the same footgun the
          whole-abacus download buttons are. Everything else — settings, jobs,
          filament roster — is the same abacus and is shared verbatim. */}
      <PrintPanel
        embedded
        visible={true}
        params={params}
        filamentMap={filamentMap}
        catalog={catalog}
        overrides={overrides}
        profileId={profileId}
        printerId={thhFilaments.printerId}
        printerMultiMaterial={thhFilaments.printerMultiMaterial}
        printerBed={thhFilaments.printerBed}
        wipeTower={thhFilaments.wipeTower}
        amsPresent={thhFilaments.amsPresent}
        externalUnprintable={thhFilaments.externalUnprintable}
        rosterEmpty={thhFilaments.rosterEmpty}
        isLoading={thhFilaments.isLoading}
        isFetching={thhFilaments.isFetching}
        connectionId={selectedConnectionId}
        // The roster read wins: when it fails the plan read never fires (an empty
        // rosterSignature disables it), so this `??` is belt-and-braces, not a
        // precedence rule anyone should rely on. The detail rides unconditionally
        // because only the PLAN hook can produce 'refused', and the panel shows
        // the detail only under that reason — so a catalog failure can never wear
        // the planner's words.
        unavailable={thhFilaments.unavailable ?? servicePlanUnavailable}
        unavailableDetail={servicePlanUnavailableDetail}
        exportBlocked={exportBlocked}
        unplacedRoles={unplacedRoles}
        requestExportParts={requestExportParts}
        playerId={playerId}
        kit={modular ? kitPrint : undefined}
      />
    </div>
  )
}
