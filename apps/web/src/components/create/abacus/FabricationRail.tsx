'use client'

// FabricationRail — the studio's RIGHT docked rail (Gitea epic #5, full-bleed
// CP1a). It answers the studio's second and third questions: HOW is this design
// made, and WHAT am I committing my printer and myself to?
//   • the filament reconcile strip (how the designed colors land on the loaded
//     filaments), the printer profile and the printability verdict,
//   • "Print options" — infill, the modular joint's fit + coupon, and the two
//     slicer knobs (bead clearance, curve smoothness) behind "Advanced",
//   • the commitment: ONE primary action, and the files.
// Mounted only on the 3D-print target, so the paper lane pays for none of it.
// The 3D model always shows the user's designed colors — the design→filament
// reconciliation is whispered by the strip, not a preview toggle.
//
// ONE PRIMARY ACTION. Paired with a print service, the cyan button is the
// PrintPanel's submit and the files sit below it in the secondary style. Unpaired,
// there is nothing to submit to, so the main file (the 3MF, or the module kit)
// takes the cyan and sits ABOVE the panel's pairing prompt. Never two.
//
// The heavy renders stay bound to the three.js viewer; this rail calls the
// store's registered `requestExportParts()` (whole abacus + the ArUco marker
// part passes, one params snapshot) and assembles the 3MF from that bundle plus
// the store's live filamentMap/catalog. `exporterReady` gates the buttons while
// the viewer chunk is still loading.

import { type CSSProperties, useMemo, useState } from 'react'
import { Disclosure } from '@/components/studio/Disclosure'
import { StudioSection } from '@/components/studio/StudioSection'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { DebugSlider } from '@/components/toys/ToyDebugPanel'
import { useAbacusStudio } from './AbacusStudioContext'
import { buildAbacusThreeMf } from './abacus-3mf'
import { commitmentSummary } from './abacus-commitment'
import { isModular } from './abacus-model'
import { PRINTER_PROFILES } from './abacus-solver'
import { downloadBlob } from './download-blob'
import { FilamentPlanPanel } from './FilamentPlanPanel'
import { InfillControls } from './InfillControls'
import {
  BTN,
  ModularFitPanel,
  ModuleKitExport,
  PRIMARY_BTN,
  type SeamBusy,
  type SeamBusyProps,
} from './ModularSeamPanel'
import { PrintCommitmentCard } from './PrintCommitmentCard'
import { PrintPanel } from './PrintPanel'

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

const NOTE: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.5,
  color: 'rgba(148,163,184,0.95)',
}

/**
 * ExportFiles — the "Files" section: what you can carry to a slicer yourself.
 * `primary` is true only when nothing else in the rail is the primary action
 * (i.e. no paired print service), and then the MAIN file — the 3MF, or the
 * module kit in modular mode — wears the cyan. The mono buttons are simply
 * absent in modular mode rather than shown disabled: the kit IS the file, and
 * the old "3MF is one piece — kit below" label only existed because the kit was
 * far away.
 */
function ExportFiles({ primary, ...busyProps }: { primary: boolean } & SeamBusyProps) {
  const {
    params,
    profile,
    catalog,
    filamentMap,
    servicePlan,
    exportBlocked,
    exporterReady,
    requestExportStl,
    requestExportParts,
  } = useAbacusStudio()

  // A failed export render (e.g. a marker part pass) now REJECTS instead of
  // hanging — surfaced inline under the button. Silently swallowing it would
  // recreate the markerless-print bug in UX form (Gitea #12).
  const [exportError, setExportError] = useState<string | null>(null)

  const modular = isModular(params)
  const canExport = exporterReady && !exportBlocked
  const summary = useMemo(
    () =>
      commitmentSummary({
        params,
        filamentMap,
        catalog,
        plan: servicePlan ?? null,
        printer: { kind: 'unpaired' },
      }),
    [params, filamentMap, catalog, servicePlan]
  )

  // the multi-material 3MF — the print projection's colors baked in as one
  // co-registered body per filament slot (#9), plus the ArUco corner marker
  // bodies from their own part renders (#12). Falls back to the raw colorless
  // STL for anyone whose slicer wants that.
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
    <StudioSection label="Files" dataElement="abacus-section-files">
      {primary && <PrintCommitmentCard summary={summary} />}
      {modular ? (
        <>
          <ModuleKitExport primary={primary} {...busyProps} />
          <div data-element="modular-kit-caveat" style={{ ...NOTE, fontSize: 10 }}>
            End modules carry engraved marker pockets, not printed markers. Words on the top/bottom
            rails and front/back walls print on the one-piece abacus only.
          </div>
        </>
      ) : (
        <>
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
            style={primary ? PRIMARY_BTN(canExport) : BTN(canExport)}
          >
            ⬇ 3MF
          </button>
          <button
            type="button"
            data-action="export-stl"
            onClick={onExportPlainStl}
            disabled={!canExport}
            style={BTN(canExport)}
          >
            ⬇ plain STL
          </button>
        </>
      )}
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
    </StudioSection>
  )
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
    requestExportParts,
    requestExportModuleParts,
    setRevealIntrinsic,
    setHighlightRole,
    modelPick,
    playerId,
  } = useAbacusStudio()

  // Modular columns (Gitea #30): the whole-abacus exports would print a
  // fused-seam monolith with dead sockets, so in modular mode the Files section
  // offers the kit instead. The print-service panel does NOT switch away: it
  // submits the kit (Gitea #32), packing every module onto one bed, and refuses
  // only when the modules genuinely don't fit one plate.
  const modular = isModular(params)

  // One render at a time across the two seam downloads — they sit in different
  // sections now (fit/coupon in Print options, kit in Files), so the interlock
  // they always had lives here, in their common owner.
  const [seamBusy, setSeamBusy] = useState<SeamBusy>(null)

  // Rebuilt only when the requestor identity changes, so the panel's submit
  // mutation isn't handed a fresh object every render.
  const kitPrint = useMemo(() => ({ requestExportModuleParts }), [requestExportModuleParts])

  // The single primary action. With a paired service the submit is the point of
  // the rail and the files are a fallback; without one there is nothing to
  // submit to, so the file IS the commitment and takes the cyan.
  const paired = connections.length > 0
  const files = <ExportFiles primary={!paired} busy={seamBusy} onBusy={setSeamBusy} />

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
                      ↕ Raise bead clearance to {clearanceFix.toFixed(2)} mm
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

      {/* HOW it's made. Everything here is invisible in the finished design and
          meaningless on paper: density, the joint's tuning, and the two slicer
          knobs that used to sit in the design rail. */}
      <StudioSection label="Print options" dataElement="abacus-section-print-options">
        <InfillControls />
        {modular && <ModularFitPanel busy={seamBusy} onBusy={setSeamBusy} />}
        {/* Two real knobs that almost nobody should touch: one is a printer's
            tolerance, the other is preview/slice cost. Collapsed, not removed. */}
        <Disclosure
          label="Advanced"
          dataElement="abacus-print-advanced"
          dataAction="toggle-print-advanced"
        >
          <DebugSlider
            label="bead clearance (mm)"
            value={params.clearance}
            min={0.1}
            max={0.8}
            step={0.01}
            onChange={(v) => set('clearance', v)}
            formatValue={(v) => v.toFixed(2)}
          />
          <div data-element="abacus-clearance-note" style={NOTE}>
            Gap between each bead and its rod. Raise it if beads bind on your printer.
          </div>
          <DebugSlider
            label="curve smoothness"
            value={params.fn}
            min={8}
            max={64}
            step={1}
            onChange={(v) => set('fn', v)}
          />
          <div data-element="abacus-fn-note" style={NOTE}>
            Facets per curve. Higher is smoother, and slower to preview and slice.
          </div>
        </Disclosure>
      </StudioSection>

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

      {!paired && files}

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
        servicePlan={servicePlan}
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

      {paired && files}
    </div>
  )
}
