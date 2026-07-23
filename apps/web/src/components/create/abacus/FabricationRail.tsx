'use client'

// FabricationRail — the studio's RIGHT docked rail (Gitea epic #5, full-bleed
// CP1a). Everything specific to turning the shared design into a 3D print lives
// here: the filament reconcile strip (how the designed colors land on the loaded
// filaments), the printer profile + printability verdict, the Export actions, and
// the print-service panel. Mounted only on the 3D-print target, so the paper lane
// pays for none of it. The 3D model always shows the user's designed colors — the
// design→filament reconciliation is whispered by the strip, not a preview toggle.
//
// The heavy STL render stays bound to the three.js viewer; this rail calls the
// store's registered `requestExportStl()` and assembles the 3MF from the store's
// live params/filamentMap/catalog. `exporterReady` gates the buttons while the
// viewer chunk is still loading.

import type { CSSProperties } from 'react'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { useAbacusStudio } from './AbacusStudioContext'
import { buildAbacusThreeMf } from './abacus-3mf'
import { PRINTER_PROFILES } from './abacus-solver'
import { FilamentPlanPanel } from './FilamentPlanPanel'
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

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
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
    filamentMap,
    solveResult,
    errors,
    warnings,
    exportBlocked,
    scaleFix,
    clearanceFix,
    requestExportStl,
    exporterReady,
    setRevealIntrinsic,
    setHighlightRole,
    modelPick,
  } = useAbacusStudio()

  const canExport = exporterReady && !exportBlocked

  // primary export: the multi-material 3MF — the print projection's colors baked
  // in as one co-registered body per filament slot (#9). Falls back to the raw
  // colorless STL for anyone whose slicer wants that.
  const onExport3mf = async () => {
    try {
      const stl = await requestExportStl()
      const { bytes } = buildAbacusThreeMf({
        stl,
        params,
        filamentMap,
        slotLabels: catalog.spools.map((s) => s.name),
      })
      downloadBlob(
        new Blob([bytes as BlobPart], { type: 'model/3mf' }),
        `abacus-${params.cols}col-x${params.scale_factor}.3mf`
      )
    } catch {
      // exporter not ready yet — the button is gated on exporterReady, so this is
      // only reachable in a brief load race; the user can click again.
    }
  }

  const onExportPlainStl = async () => {
    try {
      const stl = await requestExportStl()
      downloadBlob(
        new Blob([stl], { type: 'model/stl' }),
        `abacus-${params.cols}col-x${params.scale_factor}.stl`
      )
    } catch {
      /* see onExport3mf */
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
        disabled={!canExport}
        title={
          exportBlocked
            ? `Fix the errors above to print on ${profile.label}`
            : exporterReady
              ? 'Download a print-ready multi-material 3MF'
              : 'Preparing the 3D exporter…'
        }
        style={{
          padding: '11px 12px',
          borderRadius: 8,
          border: 'none',
          background: canExport ? CYAN_GRADIENT : 'rgba(75,85,99,0.55)',
          color: canExport ? '#fff' : 'rgba(209,213,219,0.7)',
          fontSize: 13,
          fontWeight: 700,
          cursor: canExport ? 'pointer' : 'not-allowed',
          boxShadow: canExport ? '0 4px 14px rgba(6,182,212,0.35)' : 'none',
        }}
      >
        ⬇ Download 3MF to print
      </button>
      <button
        type="button"
        data-action="export-stl"
        onClick={onExportPlainStl}
        disabled={!canExport}
        style={{
          alignSelf: 'center',
          padding: '2px 4px',
          border: 'none',
          background: 'transparent',
          color: canExport ? 'rgba(148,163,184,0.9)' : 'rgba(148,163,184,0.5)',
          fontSize: 11,
          cursor: canExport ? 'pointer' : 'not-allowed',
          textDecoration: 'underline',
        }}
      >
        plain STL instead
      </button>

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

      {/* print-service panel (Gitea #9) — embedded (normal flow) in the rail */}
      <PrintPanel
        embedded
        visible={true}
        params={params}
        filamentMap={filamentMap}
        catalog={catalog}
        printerId={thhFilaments.printerId}
        printerMultiMaterial={thhFilaments.printerMultiMaterial}
        amsPresent={thhFilaments.amsPresent}
        externalUnprintable={thhFilaments.externalUnprintable}
        rosterEmpty={thhFilaments.rosterEmpty}
        isLoading={thhFilaments.isLoading}
        isFetching={thhFilaments.isFetching}
        connectionId={selectedConnectionId}
        unavailable={thhFilaments.unavailable}
        exportBlocked={exportBlocked}
        requestExportStl={requestExportStl}
      />
    </div>
  )
}
