'use client'

// DesignInspectorRail — the studio's LEFT docked rail (Gitea epic #5, full-bleed
// CP1a). "For whom, and the design details" live here, fabrication-neutral:
//   • a live 2D mini-preview of the current design (tracks every edit),
//   • the player picker + owner/identity chips (the shared identity both outputs
//     make real),
//   • the sync/save/reset controls (lifted out of the viewer overlay), and
//   • the Customize disclosure (design sliders/selects).
// The headline fabrication chooser (paper ↔ 3D print) does NOT live here anymore —
// it was promoted to the shell's persistent top toolbar (FabricationSwitch) so it
// reads on every breakpoint instead of hiding in the mobile drawer. This rail
// reads the shared studio store; the page owns only the ?player= URL, so it
// passes the picker's selection down.

import { AbacusReact } from '@soroban/abacus-react'
import { PlayerPicker } from '@/components/shared/PlayerPicker'
import { Disclosure } from '@/components/studio/Disclosure'
import { StudioSelect } from '@/components/studio/StudioSelect'
import { DebugCheckbox, DebugColor, DebugSlider } from '@/components/toys/ToyDebugPanel'
import {
  ABACUS_COLOR_PALETTES,
  ABACUS_COLOR_SCHEMES,
  type AbacusColorPalette,
  type AbacusColorScheme,
} from '@/lib/abacus/identity'
import { useAbacusStudio } from './AbacusStudioContext'
import { feetEffective, PRESET_OPTS } from './abacus-model'
import { DesignLinkChip } from './DesignLinkChip'
import { MyDesignsList } from './MyDesignsList'

const SCHEME_LABEL: Record<string, string> = {
  monochrome: 'Monochrome',
  'place-value': 'Place-value colors',
  'heaven-earth': 'Heaven & earth colors',
  alternating: 'Alternating colors',
}

export interface DesignInspectorRailProps {
  /** ?player= value (pre-fallback), for the picker + notice */
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string | null) => void
  /** the selected player's row failed to load → we're showing the user's own */
  playerUnavailable: boolean
  /** the ?design= snapshot failed to load (not shared with you / gone,
   *  Gitea #22 + #24) → the studio opened without it. The route answers one
   *  404 for every case on purpose, so the notice must not guess which. */
  designUnavailable?: boolean
  /** the link chip saved the design (Gitea #25) → the page mirrors the minted
   *  id into the ?design= URL */
  onDesignSaved: (designId: string) => void
}

export function DesignInspectorRail({
  selectedPlayerId,
  onSelectPlayer,
  playerUnavailable,
  designUnavailable = false,
  onDesignSaved,
}: DesignInspectorRailProps) {
  const {
    params,
    set,
    synced,
    resync,
    playerId,
    playerName,
    playerPossessive,
    canWriteIdentity,
    savableIdentity,
    saveAsPlayerAbacus,
    saveIsPending,
    saveIsError,
    savedDesignId,
  } = useAbacusStudio()

  const ownerLabel = playerUnavailable
    ? 'This is your abacus'
    : playerName
      ? `This is ${playerName}'s abacus`
      : selectedPlayerId
        ? 'This is their abacus'
        : 'This is your abacus'

  return (
    <div
      data-component="design-inspector-rail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px',
        color: 'rgba(243,244,246,1)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.02em' }}>Your abacus</div>

      {/* live mini-preview — the identity, reflecting every design edit */}
      <div
        data-element="design-mini-preview"
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '12px 8px',
          overflowX: 'auto',
        }}
      >
        <AbacusReact
          value={0}
          columns={params.cols}
          colorScheme={params.color_scheme as AbacusColorScheme}
          colorPalette={params.color_palette as AbacusColorPalette}
          scaleFactor={0.6}
          interactive={false}
          animated={false}
          showNumbers={false}
        />
      </div>

      {/* who this abacus is for + its identity chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PlayerPicker selectedPlayerId={selectedPlayerId} onSelect={onSelectPlayer} isDark />
        <span
          data-element="abacus-identity-owner"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(148,163,184,0.95)',
          }}
        >
          {ownerLabel}
        </span>
        {playerUnavailable && (
          <span
            data-element="abacus-identity-unavailable"
            style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
          >
            Couldn't load that player's abacus — showing yours instead.
          </span>
        )}
        {designUnavailable && (
          <span
            data-element="abacus-design-unavailable"
            style={{ fontSize: 11, color: 'rgba(148,163,184,0.95)' }}
          >
            That design is private or no longer available — starting from the abacus instead. If
            it's yours, open it from the account that made it.
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span data-element="abacus-chip-columns" style={chipStyle}>
            {params.cols} columns
          </span>
          <span data-element="abacus-chip-colors" style={chipStyle}>
            {SCHEME_LABEL[params.color_scheme] ?? 'Custom colors'}
          </span>
        </div>
      </div>

      {/* sync/save/reset — lifted from the viewer overlay (identity concern) */}
      <div
        data-element="abacus-studio-sync-status"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: synced ? 'rgba(134,239,172,0.95)' : 'rgba(252,211,77,0.95)',
          }}
        >
          <span>
            {synced
              ? `● showing ${playerId ? `${playerPossessive} abacus` : 'your abacus'}`
              : '● customized'}
          </span>
          {!synced && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {playerId && (
                <button
                  type="button"
                  data-action="save-as-player-abacus"
                  onClick={saveAsPlayerAbacus}
                  disabled={!canWriteIdentity || !savableIdentity || saveIsPending}
                  title={
                    canWriteIdentity
                      ? undefined
                      : `Only a parent — or a teacher while ${playerName ?? 'this student'} is in class — can change their abacus`
                  }
                  style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: '1px solid rgba(6,182,212,0.6)',
                    background: 'rgba(6,182,212,0.15)',
                    color: 'rgba(165,243,252,1)',
                    fontSize: 11,
                    cursor:
                      !canWriteIdentity || !savableIdentity || saveIsPending
                        ? 'default'
                        : 'pointer',
                    opacity: !canWriteIdentity || !savableIdentity ? 0.55 : 1,
                  }}
                >
                  {saveIsPending ? 'saving…' : `make this ${playerPossessive} abacus`}
                </button>
              )}
              <button
                type="button"
                data-action="reset-to-my-abacus"
                onClick={resync}
                style={{
                  padding: '3px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(148,163,184,0.5)',
                  background: 'transparent',
                  color: 'rgba(226,232,240,1)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                reset to {playerId ? `${playerPossessive} abacus` : 'my abacus'}
              </button>
            </div>
          )}
        </div>
        {saveIsError && (
          <span
            data-element="abacus-identity-save-error"
            style={{ fontSize: 11, color: 'rgba(252,165,165,0.95)' }}
          >
            Couldn't save — check your access and try again.
          </span>
        )}
      </div>

      {/* design link (Gitea #25) — adjacent to the identity save so the two
          save-ish acts read as one neighborhood, but a clearly different verb:
          the identity save is about a PERSON, this is about an ADDRESS */}
      <DesignLinkChip selectedPlayerId={selectedPlayerId} onDesignSaved={onDesignSaved} />

      {/* "My abacuses" (#11) — everything you've saved or printed, grown from
          #24's ledger of what you've made public. A sibling of the chip rather
          than a child of it: the chip is pure orchestration over a mocked
          context seam, and this fetches. Renders nothing until you have saved
          something. */}
      <MyDesignsList currentDesignId={savedDesignId} />

      {/* the fabrication chooser (paper ↔ 3D print) now lives in the shell's
          persistent top toolbar (FabricationSwitch), not here */}

      {/* design knobs, tucked behind progressive disclosure */}
      <Disclosure label="Customize" dataElement="abacus-studio-customize">
        <DebugSlider
          label="size ×"
          value={params.scale_factor}
          min={0.5}
          max={2}
          step={0.05}
          onChange={(v) => set('scale_factor', v)}
          formatValue={(v) => v.toFixed(2)}
        />
        <DebugSlider
          label="columns"
          value={params.cols}
          min={3}
          max={21}
          step={1}
          onChange={(v) => set('cols', v)}
        />
        <DebugSlider
          label="fit gap (mm)"
          value={params.clearance}
          min={0.1}
          max={0.8}
          step={0.01}
          onChange={(v) => set('clearance', v)}
          formatValue={(v) => v.toFixed(2)}
        />
        <DebugSlider
          label="$fn (quality)"
          value={params.fn}
          min={8}
          max={64}
          step={1}
          onChange={(v) => set('fn', v)}
        />
        <StudioSelect
          label="color scheme"
          value={params.color_scheme}
          options={[...ABACUS_COLOR_SCHEMES]}
          onChange={(v) => set('color_scheme', v)}
        />
        <StudioSelect
          label="palette"
          value={params.color_palette}
          options={[...ABACUS_COLOR_PALETTES]}
          onChange={(v) => set('color_palette', v)}
        />
        <StudioSelect
          label="top rail"
          value={params.top_preset}
          options={PRESET_OPTS}
          onChange={(v) => set('top_preset', v)}
        />
        <StudioSelect
          label="bottom rail"
          value={params.bottom_preset}
          options={PRESET_OPTS}
          onChange={(v) => set('bottom_preset', v)}
        />
        {/* Inlay ink (Gitea #26): the writing prints as filament plugs pressed
            into its pockets, one 3MF body per color group. Rainbow costs up to
            five ink slots on the plate — one per group — so the choice belongs
            in front of the user, not buried in params. */}
        <StudioSelect
          label="text ink"
          value={params.text_fill}
          options={[
            { value: 'rainbow', label: 'rainbow (up to 5 filaments)' },
            { value: 'single', label: 'one color' },
          ]}
          onChange={(v) => set('text_fill', v)}
          dataElement="abacus-text-fill"
          dataAction="set-text-fill"
        />
        {params.text_fill === 'single' && (
          <DebugColor
            label="text color"
            value={params.text_color}
            onChange={(v) => set('text_color', v)}
          />
        )}
        <DebugCheckbox
          label="ArUco corner markers"
          checked={params.show_markers}
          onChange={(v) => set('show_markers', v)}
        />
        {/* Feet (Gitea #23): printed = in-place TPU feet, the default — the
            print stands on them and the bottom face rides supports; adhesive =
            today's empty dovetail pockets for stick-on bumpers; none. Retention
            only means anything for printed feet, so the second select follows
            the first conditionally. */}
        <StudioSelect
          label="feet"
          value={params.feet_mode}
          options={[
            { value: 'printed', label: 'printed TPU feet' },
            { value: 'adhesive', label: 'pockets for stick-on feet' },
            { value: 'none', label: 'no feet' },
          ]}
          onChange={(v) => set('feet_mode', v)}
          dataElement="abacus-feet-mode"
          dataAction="set-feet-mode"
        />
        {params.feet_mode === 'printed' && (
          <>
            <StudioSelect
              label="feet retention"
              value={params.feet_retention}
              options={[
                { value: 'crossbar', label: 'linked crossbar (strongest)' },
                { value: 'dovetail', label: 'dovetail (friction fit)' },
              ]}
              onChange={(v) => set('feet_retention', v)}
              dataElement="abacus-feet-retention"
              dataAction="set-feet-retention"
            />
            {/* The bar is real-world sized but the frame it hides in scales, so a
                small enough abacus has nowhere to put it. Say so rather than
                letting the select claim retention the print won't have. */}
            {feetEffective(params).crossbarTooThin && (
              <p
                data-component="DesignInspectorRail"
                data-element="abacus-feet-crossbar-note"
                style={{ fontSize: 11, color: '#b45309', lineHeight: 1.4, margin: '2px 0 0' }}
              >
                At this size the frame is too thin to hide a crossbar — these feet use the dovetail
                flare. Raise size × to about 0.75 to get the linked bar back.
              </p>
            )}
          </>
        )}
      </Disclosure>
    </div>
  )
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(148,163,184,0.25)',
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(226,232,240,0.95)',
} as const
